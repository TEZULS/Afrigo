import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, BackHandler } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Wallet, CreditCard } from 'lucide-react-native';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import { useTheme } from '@/theme/ThemeProvider';
import { invokeFunction, Order } from '@/api/entities';
import { useToast } from '@/hooks/useToast';
import { GENERIC_PAYMENT_ERROR, orderIssueMessage, userErrorMessage } from '@/lib/userErrors';
import { consumeOrderedLines } from '@/services/cartServerSync';
import { useAuth } from '@/lib/AuthContext';
import { debitWalletForOrder } from '@/lib/wallet';
import { formatPrice } from '@/utils/format';
import type { RootStackParamList } from '@/navigation/types';

interface CreatePaymentIntentResponse {
  clientSecret?: string;
  ephemeralKey?: string;
  customerId?: string;
  /** Renvoyé par la fonction quand Stripe n'est pas configuré côté admin. */
  error?: string;
}

export const PaymentScreen: React.FC = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'Payment'>>();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const stripe = useStripe();
  const toast = useToast();
  const { user, refreshUser } = useAuth();

  const { orderId, amount, lineKeys } = route.params;
  /** Part réglée par le portefeuille — débitée seulement une fois la carte acceptée. */
  const walletAmount = Number(route.params.walletAmount ?? 0) || 0;
  const [ready, setReady] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);
  /** Verrouille le flag `paid` pour ne pas annuler la commande quand on quitte
   *  l'écran après un paiement réussi. */
  const paidRef = useRef(false);
  const cancelledRef = useRef(false);

  /**
   * Si le paiement échoue (init Stripe KO, sheet erreur, retour utilisateur),
   * on marque la commande comme échouée + annulée côté serveur. L'admin ne
   * verra alors PAS la commande passer (elle est filtrée hors des listes
   * actives), évitant le bug « le paiement échoue mais l'admin reçoit ».
   *
   * Deux motifs distincts sont enregistrés : `cancellation_reason` est lu par
   * le client sur le détail de commande — il doit rester en français lisible ;
   * `payment_failure_reason` conserve le détail technique pour le support.
   * Le portefeuille n'ayant pas encore été débité, il n'y a rien à restituer.
   */
  const cancelPendingOrder = React.useCallback(
    async (clientReason: string, technicalDetail?: string) => {
      if (paidRef.current || cancelledRef.current) return;
      cancelledRef.current = true;
      try {
        await Order().update?.(orderId, {
          status: 'cancelled',
          payment_status: 'failed',
          payment_failure_reason: technicalDetail ?? clientReason,
          cancelled_by_role: 'client',
          cancellation_reason: clientReason,
        });
      } catch {
        /* best-effort */
      }
    },
    [orderId],
  );

  const initialize = React.useCallback(async () => {
    try {
      const intent = await invokeFunction<CreatePaymentIntentResponse>('createPaymentIntent', {
        orderId,
        amount,
      });
      if (intent?.error) throw new Error(intent.error);
      if (!intent?.clientSecret) throw new Error('missing_client_secret');
      const { error } = await stripe.initPaymentSheet({
        merchantDisplayName: 'AfriGo',
        paymentIntentClientSecret: intent.clientSecret,
        customerId: intent.customerId,
        customerEphemeralKeySecret: intent.ephemeralKey,
        // Apple Pay volontairement désactivé : AfriGo n'intègre pas Apple Pay.
        // Le paiement se fait par saisie de carte dans le PaymentSheet Stripe.
        // (PassKit reste lié par le SDK Stripe, mais n'est pas utilisé côté iOS.)
        googlePay: { merchantCountryCode: 'FR', testEnv: __DEV__ },
        returnURL: 'afrigo://payment-return',
        defaultBillingDetails: { address: { country: 'FR' } },
        appearance: {
          colors: { primary: colors.brandOrange },
        },
      });
      if (error) throw new Error(error.message);
      setReady(true);
    } catch (e: unknown) {
      // Le SDK Stripe renvoie des messages anglais truffés d'identifiants de
      // code : ils partent au support, jamais à l'écran.
      const detail = (e as Error).message ?? 'unknown';
      toast.error('Paiement indisponible', userErrorMessage(e, GENERIC_PAYMENT_ERROR));
      await cancelPendingOrder(orderIssueMessage('init_failed'), `init_failed: ${detail}`);
      // Retour à l'étape précédente : la commande est marquée failed.
      setTimeout(() => {
        if (nav.canGoBack()) nav.goBack();
      }, 800);
    }
  }, [orderId, amount, stripe, colors.brandOrange, toast, cancelPendingOrder, nav]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  /**
   * Si l'utilisateur quitte l'écran sans payer (back hardware ou flèche
   * du header), on annule la commande pour qu'elle ne reste pas en
   * « pending » côté admin.
   */
  useEffect(() => {
    const sub = nav.addListener('beforeRemove', () => {
      if (!paidRef.current && !cancelledRef.current) {
        void cancelPendingOrder('Paiement annulé par le client');
      }
    });
    return sub;
  }, [nav, cancelPendingOrder]);

  useEffect(() => {
    const handler = () => {
      if (!paidRef.current && !cancelledRef.current) {
        void cancelPendingOrder('Paiement annulé par le client');
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', handler);
    return () => sub.remove();
  }, [cancelPendingOrder]);

  /**
   * Après acceptation par Stripe :
   * 1. débit du portefeuille pour la part choisie au checkout ;
   * 2. commande marquée payée (le webhook Stripe fait la même chose côté
   *    serveur — ici c'est immédiat : la commande apparaît tout de suite dans
   *    « Mes commandes » et le bouton « Demande de remboursement » sait
   *    qu'un montant a réellement été prélevé) ;
   * 3. panier vidé, profil rechargé (nouveau solde).
   * Chaque étape est best-effort : le paiement, lui, est acquis.
   */
  const finalizePaidOrder = async () => {
    if (user?.email && walletAmount > 0) {
      await debitWalletForOrder({
        email: user.email,
        knownBalance: Number((user['wallet_balance'] as number | undefined) ?? 0),
        amount: walletAmount,
        orderId,
      }).catch(() => {});
    }
    await Order()
      .update?.(orderId, { payment_status: 'completed', status: 'confirmed' })
      ?.catch(() => {});
    // Seules les lignes commandées quittent le panier (sélection du panier).
    await consumeOrderedLines(user?.email, lineKeys);
    void refreshUser();
  };

  const presentSheet = async () => {
    setProcessing(true);
    const { error } = await stripe.presentPaymentSheet();
    if (error) {
      setProcessing(false);
      if (error.code !== 'Canceled') {
        toast.error('Paiement échoué', userErrorMessage(error, GENERIC_PAYMENT_ERROR));
        await cancelPendingOrder(orderIssueMessage('stripe_error'), `stripe_error: ${error.message}`);
      }
      return;
    }
    paidRef.current = true;
    await finalizePaidOrder();
    setProcessing(false);
    toast.success('Paiement réussi', 'Votre commande est confirmée.');
    nav.replace('OrderDetails', { id: orderId });
  };

  return (
    <Screen>
      <Header onBack={nav.goBack} title="Paiement" />
      <View style={styles.body}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          Montant à payer par carte
        </Text>
        <Text style={[styles.amount, { color: colors.foreground }]}>{formatPrice(amount)}</Text>

        {walletAmount > 0 ? (
          <Card padding={12} style={{ marginTop: 16 }}>
            <View style={styles.breakdownRow}>
              <Wallet size={16} color={colors.brandOrange} />
              <Text style={[styles.breakdownLabel, { color: colors.mutedForeground }]}>
                Portefeuille (débité après paiement)
              </Text>
              <Text style={{ color: colors.brandOrange, fontWeight: '700' }}>
                -{formatPrice(walletAmount)}
              </Text>
            </View>
            <View style={[styles.breakdownRow, { marginTop: 8 }]}>
              <CreditCard size={16} color={colors.foreground} />
              <Text style={[styles.breakdownLabel, { color: colors.mutedForeground }]}>
                Carte bancaire
              </Text>
              <Text style={{ color: colors.foreground, fontWeight: '800' }}>
                {formatPrice(amount)}
              </Text>
            </View>
          </Card>
        ) : null}

        {ready ? (
          <Button
            title="Payer maintenant"
            variant="brand"
            size="lg"
            fullWidth
            loading={processing}
            onPress={presentSheet}
            style={{ marginTop: 24 }}
          />
        ) : (
          <View style={{ marginTop: 24 }}>
            <Loader />
          </View>
        )}

        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Paiement sécurisé via Stripe. Vos informations bancaires ne sont jamais stockées par
          AfriGo. Si une erreur survient, votre commande est automatiquement annulée et votre
          portefeuille n&apos;est pas débité.
        </Text>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  body: { paddingTop: 32 },
  label: { textAlign: 'center', fontSize: 13 },
  amount: { fontSize: 40, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  breakdownLabel: { flex: 1, fontSize: 13 },
  hint: { fontSize: 12, textAlign: 'center', marginTop: 16, lineHeight: 18 },
});
