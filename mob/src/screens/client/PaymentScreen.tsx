import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, BackHandler } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';
import { useTheme } from '@/theme/ThemeProvider';
import { invokeFunction, Order } from '@/api/entities';
import { useCart } from '@/stores/cart';
import { useToast } from '@/hooks/useToast';
import { clearServerCartForCustomer } from '@/services/cartServerSync';
import { useAuth } from '@/lib/AuthContext';
import { formatPrice } from '@/utils/format';
import type { RootStackParamList } from '@/navigation/types';

interface CreatePaymentIntentResponse {
  clientSecret: string;
  ephemeralKey?: string;
  customerId?: string;
}

export const PaymentScreen: React.FC = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'Payment'>>();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const stripe = useStripe();
  const cart = useCart();
  const toast = useToast();
  const { user } = useAuth();

  const { orderId, amount } = route.params;
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
   */
  const cancelPendingOrder = React.useCallback(
    async (reason: string) => {
      if (paidRef.current || cancelledRef.current) return;
      cancelledRef.current = true;
      try {
        await Order().update?.(orderId, {
          status: 'cancelled',
          payment_status: 'failed',
          payment_failure_reason: reason,
          cancelled_by_role: 'client',
          cancellation_reason: reason,
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
      const { error } = await stripe.initPaymentSheet({
        merchantDisplayName: 'AfriGo',
        paymentIntentClientSecret: intent.clientSecret,
        customerId: intent.customerId,
        customerEphemeralKeySecret: intent.ephemeralKey,
        applePay: { merchantCountryCode: 'FR' },
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
      const msg = (e as Error).message ?? 'Initialisation Stripe impossible';
      toast.error('Paiement indisponible', msg);
      await cancelPendingOrder(`init_failed: ${msg}`);
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

  const presentSheet = async () => {
    setProcessing(true);
    const { error } = await stripe.presentPaymentSheet();
    setProcessing(false);
    if (error) {
      if (error.code !== 'Canceled') {
        toast.error('Paiement échoué', error.message);
        await cancelPendingOrder(`stripe_error: ${error.message}`);
      }
      return;
    }
    paidRef.current = true;
    if (user?.email) await clearServerCartForCustomer(user.email).catch(() => {});
    cart.clear();
    toast.success('Paiement réussi', 'Votre commande est confirmée.');
    nav.replace('OrderDetails', { id: orderId });
  };

  return (
    <Screen>
      <Header onBack={nav.goBack} title="Paiement" />
      <View style={styles.body}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Montant à payer</Text>
        <Text style={[styles.amount, { color: colors.foreground }]}>{formatPrice(amount)}</Text>

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
          AfriGo. Si une erreur survient, votre commande est automatiquement annulée.
        </Text>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  body: { paddingTop: 32 },
  label: { textAlign: 'center', fontSize: 13 },
  amount: { fontSize: 40, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  hint: { fontSize: 12, textAlign: 'center', marginTop: 16, lineHeight: 18 },
});
