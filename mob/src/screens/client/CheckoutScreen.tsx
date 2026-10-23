import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  MapPin,
  CreditCard,
  Banknote,
  Tag,
  CheckCircle2,
  FileText,
  Edit2,
  Save,
} from 'lucide-react-native';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete';
import { useTheme } from '@/theme/ThemeProvider';
import { useCart, cartLineKey } from '@/stores/cart';
import type { CartLine } from '@/stores/cart';
import {
  Order,
  DeliveryZone,
  DeliverySlot,
  DiscountCode,
  DiscountCodeUsage,
  invokeFunction,
} from '@/api/entities';
import { useAuth } from '@/lib/AuthContext';
import { debitWalletForOrder } from '@/lib/wallet';
import { formatPrice } from '@/utils/format';
import {
  computeCheckoutTotals,
  formatWalletAmountInput,
  parseWalletAmountInput,
} from '@/utils/checkoutMath';
import { useToast } from '@/hooks/useToast';
import { consumeOrderedLines } from '@/services/cartServerSync';
import { useAppSettings } from '@/hooks/useAppSettings';
import type { AddressSuggestion } from '@/services/addressAutocomplete';
import { DeliveryScheduleInfo } from '@/components/checkout/DeliveryScheduleInfo';
import {
  deliveryDiscountPercent,
  discountDependsOnOrderNumber,
  discountedDeliveryFee,
  type ZoneDeliveryDiscount,
} from '@/utils/deliveryDiscount';
import { DeliverySlotSection, type SlotChoice } from '@/components/checkout/DeliverySlotSection';
import type { ScheduleDay } from '@/utils/deliverySchedule';
import { generateDeliveryCode } from '@/utils/deliveryCode';
import {
  formatSlotDay,
  formatSlotRange,
  hasZoneTimeSlots,
  slotHasStarted,
  splitSlotRange,
  toYmd,
} from '@/utils/deliverySlots';
import { selectedVariantsPayload } from '@/utils/selectedVariants';
import type { RootStackParamList } from '@/navigation/types';
import { userErrorMessage } from '@/lib/userErrors';
import { palette } from '@/theme/tokens';
import { useCartVatRates } from '@/hooks/useCartVatRates';

/** Message d'erreur interne : zone de livraison désactivée au moment de la commande. */
const ZONE_UNAVAILABLE = 'zone_unavailable';
/** Message d'erreur interne : le créneau choisi a commencé avant la confirmation. */
const SLOT_EXPIRED = 'slot_expired';

/** Schéma Order aligné sur Checkout.jsx + entité Base44 */
type ApiPaymentMethod = 'card' | 'delivery';

interface ZoneRow {
  id: string;
  name: string;
  delivery_fee: number;
  free_delivery_threshold?: number;
  postal_codes?: string[];
  is_active?: boolean;
  min_order_amount?: number;
  delivery_schedule?: ScheduleDay[];
  min_days_before_delivery?: number;
  /** Réduction sur la livraison (%, période, rang de commande, niveau client). */
  discount?: ZoneDeliveryDiscount;
}


interface PromoCodeRow {
  id: string;
  code: string;
  discount_percentage: number;
  is_active?: boolean;
  valid_from?: string;
  valid_until?: string;
  min_order_amount?: number;
  max_uses_per_customer?: number;
  total_uses?: number;
  applicable_order_numbers?: number[];
}

/**
 * `Order.items[].selected_variants` : même format que le panier — voir
 * `@/utils/selectedVariants`. La cloud function `updateStockAfterOrder` s'en
 * sert pour retrouver la variante du produit et déduire le bon stock.
 */
function lineToSelectedVariants(line: CartLine) {
  return selectedVariantsPayload(line.variant);
}

export const CheckoutScreen: React.FC = () => {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Checkout'>>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user, refreshUser } = useAuth();
  const { lines: allLines } = useCart();
  /**
   * Lignes commandées = celles cochées au panier (`lineKeys`), pas tout le
   * panier. Sans sélection transmise (deep link, ancien flux) : tout le panier.
   */
  const lineKeys = route.params?.lineKeys;
  const lines = useMemo(() => {
    if (!lineKeys) return allLines;
    const keys = new Set(lineKeys);
    return allLines.filter((l) => keys.has(cartLineKey(l)));
  }, [allLines, lineKeys]);
  const toast = useToast();
  const appSettings = useAppSettings();
  const deliverySlotsEnabled = Boolean(appSettings.data?.delivery_slots_enabled);
  /**
   * L'admin peut interdire le paiement à la livraison **client par client**
   * depuis base44 (`User.cash_on_delivery_disabled`, écran « Paiement à la
   * livraison »). Comme sur le web : l'option reste visible mais grisée et
   * inactive, et la carte est sélectionnée d'office.
   */
  const cashOnDeliveryBlocked = user?.cash_on_delivery_disabled === true;
  useEffect(() => {
    if (cashOnDeliveryBlocked) setPayment('card');
  }, [cashOnDeliveryBlocked]);
  /*
    Le drapeau vient du profil : on le relit à l'ouverture du paiement pour
    qu'un blocage posé par l'admin s'applique sans redémarrer l'application.
  */
  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const [address, setAddress] = useState((user?.['address'] as string) ?? '');
  const [postalCode, setPostalCode] = useState((user?.['postal_code'] as string) ?? '');
  const [city, setCity] = useState((user?.['city'] as string) ?? '');
  const [phone, setPhone] = useState((user?.['phone'] as string) ?? '');
  /**
   * Coordonnées repliées en un résumé (téléphone, adresse) avec « Modifier »,
   * comme le profil (demande du 2026-10-27) : « Modifier » déplie tous les
   * champs, « Enregistrer » les replie. Dépliées d'office si l'adresse du
   * profil est incomplète.
   */
  const [editingAddress, setEditingAddress] = useState(
    () =>
      !(
        String(user?.['address'] ?? '').trim() &&
        String(user?.['postal_code'] ?? '').trim() &&
        String(user?.['city'] ?? '').trim()
      ),
  );
  /** Coordonnées d'avant « Modifier », rétablies par « Annuler ». */
  const [addressBackup, setAddressBackup] = useState<{
    address: string;
    postalCode: string;
    city: string;
    phone: string;
  } | null>(null);
  /** Instructions de livraison (code d'entrée, étage…) → `Order.notes`, comme le web. */
  const [instructions, setInstructions] = useState('');
  /** Créneau de livraison retenu (toujours le jour même). */
  const [slotChoice, setSlotChoice] = useState<SlotChoice | null>(null);
  /** Incrémenté pour relire l'heure et la liste des créneaux (créneau expiré). */
  const [slotRefresh, setSlotRefresh] = useState(0);
  const [payment, setPayment] = useState<ApiPaymentMethod>('card');

  /**
   * Suggestion d'adresse choisie : remplit rue + code postal + ville. Le code
   * postal renseigné déclenche à son tour la détection de la zone de livraison.
   */
  const applyAddressSuggestion = useCallback((s: AddressSuggestion) => {
    if (s.street) setAddress(s.street);
    if (s.postalCode) setPostalCode(s.postalCode);
    if (s.city) setCity(s.city);
  }, []);

  /** Adresse, code postal (5 chiffres) et ville : de quoi livrer et trouver la zone. */
  const addressComplete = Boolean(address.trim() && /^\d{5}$/.test(postalCode.trim()) && city.trim());
  const startAddressEdit = () => {
    setAddressBackup({ address, postalCode, city, phone });
    setEditingAddress(true);
  };
  const saveAddress = () => {
    if (!addressComplete) return;
    setAddress((v) => v.trim());
    setPostalCode((v) => v.trim());
    setCity((v) => v.trim());
    setPhone((v) => v.trim());
    setAddressBackup(null);
    setEditingAddress(false);
  };
  const cancelAddressEdit = () => {
    if (!addressBackup) return;
    setAddress(addressBackup.address);
    setPostalCode(addressBackup.postalCode);
    setCity(addressBackup.city);
    setPhone(addressBackup.phone);
    setAddressBackup(null);
    setEditingAddress(false);
  };

  const [promoInput, setPromoInput] = useState('');
  const [promoError, setPromoError] = useState<string | null>(null);
  const [appliedPromo, setAppliedPromo] = useState<PromoCodeRow | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);

  /**
   * Portefeuille : case à cocher + montant précis. Le client peut régler
   * une partie par portefeuille et le reste par carte / à la livraison, ou
   * la totalité par portefeuille (aucun mode de paiement n'est alors demandé).
   * `walletInput` est le texte saisi ; le montant retenu est borné dans
   * `computeCheckoutTotals` (jamais plus que le solde ni que la commande).
   */
  const [useWallet, setUseWallet] = useState(false);
  const [walletInput, setWalletInput] = useState('');
  const walletBalance = Number((user?.['wallet_balance'] as number | undefined) ?? 0);

  /**
   * Toutes les zones, y compris désactivées : une zone coupée par l'admin doit
   * être reconnue pour bloquer la commande (et non simplement ignorée, sinon
   * l'écran affiche « Aucune zone trouvée » ou garde l'ancienne zone). Lecture
   * fraîche à chaque ouverture : l'admin peut couper une zone à tout moment.
   */
  const zonesQuery = useQuery<ZoneRow[]>({
    queryKey: ['delivery-zones'],
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: 60_000,
    queryFn: async () => {
      const raw = ((await DeliveryZone().list?.()) ?? []) as Record<string, unknown>[];
      return raw
        .map((z) => ({
          id: String(z.id),
          name: String(z.name ?? ''),
          delivery_fee: Number(z.delivery_fee ?? 0),
          free_delivery_threshold:
            z.free_delivery_threshold != null ? Number(z.free_delivery_threshold) : undefined,
          postal_codes: z.postal_codes as string[] | undefined,
          is_active: z.is_active as boolean | undefined,
          min_order_amount: z.min_order_amount != null ? Number(z.min_order_amount) : 0,
          delivery_schedule: (z.delivery_schedule as ScheduleDay[] | undefined) ?? [],
          min_days_before_delivery:
            z.min_days_before_delivery != null ? Number(z.min_days_before_delivery) : 0,
          discount: {
            delivery_discount_percentage: z.delivery_discount_percentage as number | null | undefined,
            discount_valid_from: z.discount_valid_from as string | null | undefined,
            discount_valid_until: z.discount_valid_until as string | null | undefined,
            discount_for_order_numbers: z.discount_for_order_numbers as number[] | null | undefined,
            discount_for_new_customers: z.discount_for_new_customers as boolean | null | undefined,
            tier_discounts: z.tier_discounts as Record<string, number> | null | undefined,
          },
        }));
    },
  });

  /**
   * Correspondance automatique zone / code postal — comme Checkout.jsx.
   * Dérivée (et non stockée) : si l'admin désactive la zone pendant que
   * l'écran est ouvert, le prochain rafraîchissement la fait disparaître.
   */
  const matchedZone = useMemo(() => {
    const cp = postalCode.trim();
    if (!cp) return null;
    const matches = (zonesQuery.data ?? []).filter((z) => z.postal_codes?.includes(cp));
    // Un même code postal dans deux zones : la zone active l'emporte.
    return matches.find((z) => z.is_active !== false) ?? matches[0] ?? null;
  }, [postalCode, zonesQuery.data]);
  /** Zone désactivée par l'admin : les clients de cette zone ne peuvent plus commander. */
  const zoneDisabled = matchedZone != null && matchedZone.is_active === false;
  const zone = zoneDisabled ? null : matchedZone;

  /**
   * Choix du créneau, dans le même ordre que le site :
   * - la zone a des horaires → jour + créneau tirés de `delivery_schedule` ;
   * - sinon, créneaux activés par l'admin → table `DeliverySlot` ;
   * - sinon → simple rappel « Prochaine livraison disponible ».
   */
  const slotMode: 'zone' | 'table' | 'none' =
    zone && hasZoneTimeSlots(zone.delivery_schedule) ? 'zone' : deliverySlotsEnabled ? 'table' : 'none';

  /**
   * Synchronise les champs adresse/CP/ville/téléphone avec le profil utilisateur :
   * quand l'utilisateur modifie son adresse côté Profil puis revient au Checkout,
   * la nouvelle adresse remplace la valeur initiale (sauf s'il a déjà saisi un
   * autre adresse manuellement dans le formulaire).
   */
  const lastSyncedRef = React.useRef({
    address: (user?.['address'] as string) ?? '',
    postal: (user?.['postal_code'] as string) ?? '',
    city: (user?.['city'] as string) ?? '',
    phone: (user?.['phone'] as string) ?? '',
  });
  useEffect(() => {
    const u = {
      address: (user?.['address'] as string) ?? '',
      postal: (user?.['postal_code'] as string) ?? '',
      city: (user?.['city'] as string) ?? '',
      phone: (user?.['phone'] as string) ?? '',
    };
    const ref = lastSyncedRef.current;
    if (u.address !== ref.address && (address === ref.address || !address)) {
      setAddress(u.address);
    }
    if (u.postal !== ref.postal && (postalCode === ref.postal || !postalCode)) {
      setPostalCode(u.postal);
    }
    if (u.city !== ref.city && (city === ref.city || !city)) {
      setCity(u.city);
    }
    if (u.phone !== ref.phone && (phone === ref.phone || !phone)) {
      setPhone(u.phone);
    }
    lastSyncedRef.current = u;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    (user?.['address'] as string) ?? '',
    (user?.['postal_code'] as string) ?? '',
    (user?.['city'] as string) ?? '',
    (user?.['phone'] as string) ?? '',
  ]);

  const subTotal = lines.reduce((acc, l) => acc + l.unitPrice * l.quantity, 0);
  /** TVA des lignes commandées (taux du produit, 0 % si jamais renseigné). */
  const { totalsOf, vatRateOf } = useCartVatRates(lines);
  const vat = totalsOf(lines);
  const freeTh = zone?.free_delivery_threshold;
  const FREE_THRESHOLD = freeTh != null ? Number(freeTh) : 0;
  const isFreeDelivery =
    Boolean(zone) && (FREE_THRESHOLD === 0 || subTotal >= FREE_THRESHOLD);
  const baseDeliveryFee =
    zone != null ? (isFreeDelivery ? 0 : Number(zone.delivery_fee ?? 0)) : 0;

  /**
   * Commandes passées du client : le rang de celle-ci (1re, 2e…) conditionne
   * la réduction de livraison « nouveaux clients » / « commandes n° … ».
   */
  const userOrdersQuery = useQuery<{ status?: string }[]>({
    queryKey: ['userOrders', user?.email],
    enabled: Boolean(user?.email),
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () =>
      ((await Order().filter?.({ customer_email: user!.email })) ?? []) as { status?: string }[],
  });
  const orderNumber = (userOrdersQuery.data ?? []).filter((o) => o.status !== 'cancelled').length + 1;
  /** Réduction de livraison de la zone (règles du site) ; 0 tant que le rang de commande est inconnu. */
  const deliveryDiscountPct =
    baseDeliveryFee > 0 &&
    (!discountDependsOnOrderNumber(zone?.discount) || userOrdersQuery.isSuccess)
      ? deliveryDiscountPercent(zone?.discount, {
          orderNumber,
          tier: (user?.['customer_tier'] as string | undefined) ?? 'normal',
          today: toYmd(new Date()),
        })
      : 0;
  const deliveryFee = discountedDeliveryFee(baseDeliveryFee, deliveryDiscountPct);

  const totals = computeCheckoutTotals({
    subTotal,
    deliveryFee,
    promoPercent: appliedPromo?.discount_percentage ?? 0,
    walletBalance,
    walletRequested: useWallet ? parseWalletAmountInput(walletInput, Infinity) : null,
  });
  const { totalBeforeDiscounts, promoDiscount, maxWalletUsage, walletApplied, grandTotal } = totals;
  /** Commande intégralement réglée par le portefeuille : aucun autre paiement à choisir. */
  const paidByWalletOnly = useWallet && walletApplied > 0 && grandTotal === 0;

  const toggleWallet = () => {
    setUseWallet((on) => {
      // Cocher = proposer le maximum utilisable, modifiable ensuite.
      if (!on) setWalletInput(formatWalletAmountInput(maxWalletUsage));
      return !on;
    });
  };

  /** Le plafond bouge avec le panier / la zone / le code promo : on rogne la saisie. */
  useEffect(() => {
    if (!useWallet) return;
    const requested = parseWalletAmountInput(walletInput, Infinity);
    if (requested != null && requested > maxWalletUsage) {
      setWalletInput(formatWalletAmountInput(maxWalletUsage));
    }
  }, [useWallet, walletInput, maxWalletUsage]);

  const minOrderAmount = zone != null ? Number(zone.min_order_amount ?? 0) : 0;
  const meetsMinimum = subTotal >= minOrderAmount;

  /** Créneau requis dès que la zone (ou l'admin) en propose, comme sur le site. */
  const slotsBlocked = slotMode !== 'none' && slotChoice == null;

  /** Rappel du créneau en bas de page : « Mercredi 23 Sept. · 11h00 - 12h00 ». */
  const slotLabel =
    slotMode !== 'none' && slotChoice
      ? `${formatSlotDay(slotChoice.date)} · ${formatSlotRange(slotChoice.time_slot)}`
      : '';

  const applyPromo = async () => {
    const code = promoInput.trim();
    if (!code) return;
    setPromoBusy(true);
    setPromoError(null);
    try {
      const codes = ((await DiscountCode().filter?.({ code: code.toUpperCase() })) ??
        []) as PromoCodeRow[];
      if (codes.length === 0) {
        setPromoError('Code promo invalide');
        setAppliedPromo(null);
        return;
      }
      const c = codes[0]!;
      if (c.is_active === false) {
        setPromoError("Ce code n'est plus actif");
        setAppliedPromo(null);
        return;
      }
      const today = new Date();
      if (c.valid_from && new Date(c.valid_from) > today) {
        setPromoError("Ce code n'est pas encore valide");
        setAppliedPromo(null);
        return;
      }
      if (c.valid_until && new Date(c.valid_until) < today) {
        setPromoError('Ce code a expiré');
        setAppliedPromo(null);
        return;
      }
      if (c.min_order_amount && subTotal < c.min_order_amount) {
        setPromoError(`Commande minimale de ${c.min_order_amount}€ requise`);
        setAppliedPromo(null);
        return;
      }
      if (user?.email) {
        const usages = ((await DiscountCodeUsage().filter?.({
          customer_email: user.email,
          code: c.code,
        })) ?? []) as { id: string }[];
        if (c.max_uses_per_customer && usages.length >= c.max_uses_per_customer) {
          setPromoError("Vous avez atteint la limite d'utilisation de ce code");
          setAppliedPromo(null);
          return;
        }
      }
      setAppliedPromo(c);
      toast.success(`Code appliqué : -${c.discount_percentage}%`);
    } catch (e) {
      setPromoError(userErrorMessage(e, 'Ce code promo n’a pas pu être vérifié. Réessayez.'));
      setAppliedPromo(null);
    } finally {
      setPromoBusy(false);
    }
  };

  const removePromo = () => {
    setAppliedPromo(null);
    setPromoInput('');
    setPromoError(null);
  };

  const placeOrder = useMutation({
    mutationFn: async () => {
      if (!user) {
        nav.navigate('Login');
        throw new Error('Login requis');
      }
      // Dernière vérification serveur : la zone a pu être coupée entre
      // l'affichage et l'appui sur « Confirmer ».
      const freshZones = await zonesQuery.refetch();
      const stillActive = (freshZones.data ?? []).some(
        (z) => z.postal_codes?.includes(postalCode.trim()) && z.is_active !== false,
      );
      if (!stillActive) throw new Error(ZONE_UNAVAILABLE);
      // Le créneau a pu commencer (ou son jour passer) pendant la saisie.
      const chosenSlot = slotMode !== 'none' ? slotChoice : null;
      const orderedAt = new Date();
      const orderDay = toYmd(orderedAt);
      if (
        chosenSlot &&
        (chosenSlot.date < orderDay ||
          (chosenSlot.date === orderDay && slotHasStarted(chosenSlot.time_slot, orderedAt)))
      ) {
        throw new Error(SLOT_EXPIRED);
      }
      if (chosenSlot?.tableRow) {
        await DeliverySlot().update?.(chosenSlot.tableRow.id, {
          current_orders: (chosenSlot.tableRow.current_orders ?? 0) + 1,
        });
      }

      const items = lines.map((l) => ({
        product_id: l.productId,
        product_name: l.name,
        quantity: l.quantity,
        unit_price: l.unitPrice,
        total_price: l.unitPrice * l.quantity,
        // Taux au moment de la commande, comme le web : sert à la facture
        // (HT / TVA / TTC) et reste vrai même si l'admin change la TVA après.
        vat_rate: vatRateOf(l) ?? 0,
        selected_variants: lineToSelectedVariants(l),
      }));

      /**
       * Commande couverte à 100 % par le portefeuille : enregistrée comme le
       * web (`payment_method: 'delivery'`, `amount_to_pay: 0`) — le schéma
       * `Order` ne connaît que `card` / `delivery` — mais marquée payée pour
       * que ni l'admin ni le livreur n'attendent d'encaissement.
       */
      const apiPayment: ApiPaymentMethod = paidByWalletOnly ? 'delivery' : payment;
      const notes = [instructions.trim(), phone.trim() ? `Tel: ${phone.trim()}` : '']
        .filter(Boolean)
        .join('\n');

      const created = (await Order().create?.({
        customer_email: user.email,
        items,
        total_amount: totalBeforeDiscounts,
        payment_method: apiPayment,
        payment_status: paidByWalletOnly ? 'completed' : 'pending',
        wallet_amount_used: walletApplied,
        promo_code: appliedPromo?.code ?? null,
        promo_discount: promoDiscount,
        amount_to_pay: grandTotal,
        status: 'pending',
        delivery_address: address.trim(),
        delivery_postal_code: postalCode.trim(),
        delivery_city: city.trim() || '—',
        notes: notes || undefined,
        // Comme le site : le jour, l'heure de début seule, et le créneau complet.
        ...(chosenSlot
          ? {
              estimated_delivery: chosenSlot.date,
              delivery_time: splitSlotRange(chosenSlot.time_slot).start,
              delivery_time_slot: chosenSlot.time_slot,
            }
          : {}),
        // Code à 4 chiffres que le client communiquera au livreur à la remise.
        delivery_code: generateDeliveryCode(),
      })) as { id: string };

      if (appliedPromo) {
        await DiscountCodeUsage().create?.({
          code: appliedPromo.code,
          customer_email: user.email,
          order_id: created.id,
          discount_amount: promoDiscount,
          used_at: new Date().toISOString(),
        }).catch(() => {});
        await DiscountCode().update?.(appliedPromo.id, {
          total_uses: (appliedPromo.total_uses ?? 0) + 1,
        }).catch(() => {});
      }

      // Paiement carte : le portefeuille n'est débité qu'après confirmation
      // Stripe (écran Paiement). Sinon un paiement refusé ou abandonné
      // laissait le solde débité alors que la commande était annulée.
      if (walletApplied > 0 && apiPayment !== 'card') {
        await debitWalletForOrder({
          email: user.email,
          knownBalance: walletBalance,
          amount: walletApplied,
          orderId: created.id,
        }).catch(() => {});
        void refreshUser();
      }

      await invokeFunction('updateStockAfterOrder', { orderId: created.id }).catch(() => {});
      await invokeFunction('notifyAdminsNewOrder', {
        orderId: created.id,
        customerEmail: user.email,
        customerName: (user.full_name as string | undefined) ?? user.email,
        totalAmount: grandTotal,
        // La fonction ne connaît que `card` (sinon « Paiement à la livraison ») :
        // on envoie les mêmes valeurs que le web, plus `wallet` pour le 100 % portefeuille.
        paymentMethod: paidByWalletOnly ? 'wallet' : apiPayment,
      }).catch(() => {});

      return { ...created, apiPayment };
    },
    onSuccess: async (order) => {
      if (order.apiPayment === 'card') {
        nav.replace('Payment', {
          orderId: order.id,
          amount: grandTotal,
          walletAmount: walletApplied,
          lineKeys,
        });
      } else {
        await consumeOrderedLines(user?.email, lineKeys);
        toast.success(
          'Commande passée',
          paidByWalletOnly
            ? 'Votre commande est réglée avec votre portefeuille.'
            : 'Votre commande a bien été enregistrée.',
        );
        nav.replace('OrderDetails', { id: order.id });
      }
    },
    onError: (e: Error) => {
      if (e.message === SLOT_EXPIRED) {
        setSlotChoice(null);
        setSlotRefresh((n) => n + 1);
        toast.error('Créneau indisponible', 'Ce créneau vient de commencer : choisissez-en un autre.');
        return;
      }
      if (e.message === ZONE_UNAVAILABLE) {
        toast.error(
          'Livraison indisponible',
          'La livraison dans votre zone n’est pas disponible pour le moment.',
        );
        return;
      }
      if (e.message !== 'Login requis') {
        toast.error(
          'Commande impossible',
          userErrorMessage(e, 'Votre commande n’a pas pu être enregistrée. Réessayez dans un instant.'),
        );
      }
    },
  });

  const canProceed =
    Boolean(address.trim() && postalCode.trim() && city.trim() && zone) &&
    !zoneDisabled &&
    meetsMinimum &&
    !slotsBlocked;

  return (
    <Screen
      scroll
      contentStyle={{ paddingBottom: Math.max(insets.bottom, 12) + 32 }}
      keyboardBehavior="padding"
      // En-tête hors du scroll : « AfriGo · Validation » reste toujours visible.
      header={<Header onBack={nav.goBack} title="Validation" />}
    >
      <Text style={[styles.section, { color: colors.foreground }]}>Coordonnées de livraison</Text>
      <Card padding={14} style={{ marginTop: 8 }}>
        {editingAddress ? (
          <View testID="checkout-address-form">
            <AddressAutocomplete
              value={address}
              onChangeText={setAddress}
              onSelectSuggestion={applyAddressSuggestion}
              postalCode={postalCode}
              placeholder="Rue…"
            />
            {/*
              Une case par ligne : partagée avec le code postal, la case Ville
              coupait les noms longs (« Châlons-en-Champagne ») sur Android.
            */}
            <Input
              label="Code postal"
              value={postalCode}
              onChangeText={setPostalCode}
              keyboardType="numeric"
              maxLength={5}
              testID="checkout-postal-code"
            />
            <Input label="Ville" value={city} onChangeText={setCity} testID="checkout-city" />
            <Input
              label="Téléphone"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              testID="checkout-phone"
            />
            <View style={styles.editActions}>
              <Button
                title="Enregistrer"
                variant="primary"
                size="md"
                disabled={!addressComplete}
                leftIcon={<Save size={14} color="#FFF" />}
                onPress={saveAddress}
                testID="checkout-address-save"
                style={{ flex: 1 }}
              />
              {addressBackup ? (
                <Button
                  title="Annuler"
                  variant="outline"
                  size="md"
                  onPress={cancelAddressEdit}
                  testID="checkout-address-cancel"
                />
              ) : null}
            </View>
            {!addressComplete ? (
              <Text style={[styles.editHint, { color: colors.mutedForeground }]}>
                Renseignez l&apos;adresse, le code postal (5 chiffres) et la ville.
              </Text>
            ) : null}
          </View>
        ) : (
          // Le téléphone n'est plus résumé ici (demande du 2026-10-27) : il
          // reste modifiable dans le formulaire ouvert par « Modifier ».
          <>
            <View style={styles.fieldHeader}>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Adresse de livraison *</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Modifier l’adresse de livraison"
                onPress={startAddressEdit}
                style={styles.editBtn}
                testID="checkout-edit-address"
              >
                <Edit2 size={14} color={palette.emerald[600]} />
                <Text style={[styles.editTxt, { color: palette.emerald[600] }]}>Modifier</Text>
              </Pressable>
            </View>
            <View style={[styles.addressBox, { backgroundColor: colors.muted }]} testID="checkout-address-summary">
              <Text style={{ color: colors.foreground, fontWeight: '700', fontSize: 15 }}>{address.trim()}</Text>
              <Text style={{ color: colors.mutedForeground, marginTop: 2 }}>
                {`${postalCode.trim()} ${city.trim()}`.trim()}
              </Text>
            </View>
          </>
        )}
      </Card>

      {/* Instructions pour le livreur — entre l'adresse et la zone, comme demandé. */}
      <Card padding={14} style={{ marginTop: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <FileText size={16} color={colors.brandOrange} />
          <Text style={{ color: colors.foreground, fontWeight: '700', fontSize: 13 }}>
            Instructions de livraison{' '}
            <Text style={{ color: colors.mutedForeground, fontWeight: '500' }}>(optionnel)</Text>
          </Text>
        </View>
        <Input
          value={instructions}
          onChangeText={setInstructions}
          placeholder="Code d'entrée, étage, interphone, horaires de présence…"
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          maxLength={500}
          showClear={false}
          containerStyle={{ marginBottom: 0 }}
          style={{ minHeight: 76 }}
        />
      </Card>

      {/*
        La zone de livraison est dérivée automatiquement du code postal saisi
        (cf. useEffect ci-dessus). Un récapitulatif léger remplace l'ancien
        bloc « Zone de livraison » qui obligeait l'utilisateur à choisir
        manuellement une zone.
      */}
      {zoneDisabled ? (
        <Card
          padding={12}
          style={{ marginTop: 8, borderColor: palette.orange[200], backgroundColor: palette.orange[50] }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <MapPin size={16} color={colors.brandOrange} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontWeight: '700', fontSize: 13 }}>
                Livraison indisponible dans votre zone
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2, lineHeight: 17 }}>
                La livraison dans cette zone n&apos;est pas disponible pour le moment. Réessayez
                plus tard : vos articles restent dans votre panier.
              </Text>
            </View>
          </View>
        </Card>
      ) : zone ? (
        <Card padding={12} style={{ marginTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <MapPin size={16} color={colors.brandOrange} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontWeight: '700', fontSize: 13 }}>
                {zone.name}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
                {isFreeDelivery || deliveryFee === 0
                  ? 'Livraison gratuite'
                  : `Livraison : ${formatPrice(deliveryFee)}${
                      deliveryDiscountPct > 0 ? ` (-${deliveryDiscountPct} %)` : ''
                    }`}
              </Text>
            </View>
          </View>
        </Card>
      ) : postalCode.trim() ? (
        // Client hors zone de livraison : message bien visible, en rouge foncé.
        <Text style={styles.noZone} testID="checkout-no-zone">
          Aucune zone trouvée pour le code postal {postalCode.trim()}.
        </Text>
      ) : null}

      {zone && slotMode === 'none' ? (
        <DeliveryScheduleInfo
          schedule={zone.delivery_schedule}
          minDaysBeforeDelivery={zone.min_days_before_delivery}
        />
      ) : null}

      {!meetsMinimum && zone != null && minOrderAmount > 0 ? (
        <Text
          style={{
            marginTop: 14,
            fontSize: 13,
            lineHeight: 19,
            color: colors.brandOrange,
            fontWeight: '600',
          }}
        >
          Montant minimum pour la zone sélectionnée : {formatPrice(minOrderAmount)} (panier{' '}
          {formatPrice(subTotal)}).
        </Text>
      ) : null}

      {slotMode !== 'none' ? (
        <>
          <Text style={[styles.section, { color: colors.foreground }]}>
            Créneau de livraison <Text style={{ color: colors.destructive }}>*</Text>
          </Text>
          <Card padding={12} style={{ marginTop: 8 }}>
            <DeliverySlotSection
              key={`${zone?.id ?? 'table'}-${slotRefresh}`}
              mode={slotMode}
              schedule={zone?.delivery_schedule}
              value={slotChoice}
              onChange={setSlotChoice}
            />
          </Card>
        </>
      ) : null}

      <Text style={[styles.section, { color: colors.foreground }]}>Code promo</Text>
      <Card padding={14} style={{ marginTop: 8 }}>
        {appliedPromo ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingVertical: 4,
            }}
          >
            <Tag size={18} color={colors.brandOrange} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontWeight: '700' }}>
                {appliedPromo.code}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                -{appliedPromo.discount_percentage}% sur les articles
              </Text>
            </View>
            <Button title="Retirer" variant="ghost" size="sm" onPress={removePromo} />
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <Input
              placeholder="Saisissez votre code"
              value={promoInput}
              onChangeText={(v) => {
                setPromoInput(v);
                if (promoError) setPromoError(null);
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              error={promoError ?? undefined}
              containerStyle={{ flex: 1, marginBottom: 0 }}
            />
            <Button
              title="Appliquer"
              variant="outline"
              size="md"
              loading={promoBusy}
              disabled={!promoInput.trim() || promoBusy}
              onPress={() => void applyPromo()}
            />
          </View>
        )}
      </Card>

      {walletBalance > 0 ? (
        <>
          <Text style={[styles.section, { color: colors.foreground }]}>Portefeuille</Text>
          <Card padding={14} style={{ marginTop: 8 }}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: useWallet }}
              accessibilityLabel="Utiliser mon portefeuille"
              testID="checkout-wallet-toggle"
              onPress={toggleWallet}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: useWallet ? colors.brandOrange : colors.border,
                  backgroundColor: useWallet ? colors.brandOrange : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {useWallet ? (
                  <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 14 }}>✓</Text>
                ) : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontWeight: '700' }}>
                  Utiliser mon portefeuille
                </Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
                  Solde disponible :{' '}
                  <Text style={styles.walletAmount}>{formatPrice(walletBalance)}</Text>
                </Text>
              </View>
              {useWallet ? (
                <Text style={{ color: colors.brandOrange, fontWeight: '800' }}>
                  -{formatPrice(walletApplied)}
                </Text>
              ) : null}
            </Pressable>

            {useWallet ? (
              <View style={{ marginTop: 12 }}>
                <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 13 }}>
                  Montant à utiliser{' '}
                  <Text style={{ color: colors.mutedForeground, fontWeight: '500' }}>
                    (max {formatPrice(maxWalletUsage)})
                  </Text>
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 6 }}>
                  <Input
                    testID="checkout-wallet-amount"
                    value={walletInput}
                    onChangeText={setWalletInput}
                    onBlur={() => {
                      const n = parseWalletAmountInput(walletInput, maxWalletUsage);
                      setWalletInput(formatWalletAmountInput(n ?? 0));
                    }}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    rightIcon={<Text style={{ color: colors.mutedForeground, fontWeight: '700' }}>€</Text>}
                    showClear={false}
                    containerStyle={{ flex: 1, marginBottom: 0 }}
                  />
                  <Button
                    title="Tout"
                    variant="outline"
                    size="md"
                    onPress={() => setWalletInput(formatWalletAmountInput(maxWalletUsage))}
                  />
                </View>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 8 }}>
                  Saisissez un montant pour ne régler qu&apos;une partie avec le portefeuille, le
                  reste sera payé par carte ou à la livraison.
                </Text>
                <View style={[styles.totalRow, { marginTop: 8 }]}>
                  <Text style={{ color: colors.foreground, fontWeight: '600' }}>Reste à payer</Text>
                  <Text style={{ color: colors.foreground, fontWeight: '800' }}>
                    {formatPrice(grandTotal)}
                  </Text>
                </View>
              </View>
            ) : null}
          </Card>
        </>
      ) : null}

      {paidByWalletOnly ? (
        <>
          <Text style={[styles.section, { color: colors.foreground }]}>Paiement</Text>
          <Card
            padding={12}
            style={{
              marginTop: 8,
              borderColor: palette.emerald[200],
              backgroundColor: palette.emerald[50],
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
              <CheckCircle2 size={18} color={palette.emerald[600]} style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.emerald[700], fontWeight: '700', fontSize: 13 }}>
                  Commande entièrement réglée avec votre portefeuille
                </Text>
                <Text style={{ color: palette.emerald[700], fontSize: 12, marginTop: 2, lineHeight: 17 }}>
                  Aucun autre moyen de paiement n&apos;est nécessaire :{' '}
                  {formatPrice(walletApplied)} seront débités de votre solde à la confirmation.
                </Text>
              </View>
            </View>
          </Card>
        </>
      ) : (
        <>
          <Text style={[styles.section, { color: colors.foreground }]}>
            Paiement
            {walletApplied > 0 ? (
              <Text style={{ color: colors.mutedForeground, fontWeight: '500' }}>
                {' '}
                (reste à payer : {formatPrice(grandTotal)})
              </Text>
            ) : null}
          </Text>
          <Card padding={6} style={{ marginTop: 8 }}>
            {(
              [
                {
                  id: 'card' as const,
                  label: 'Carte bancaire',
                  hint: 'Paiement sécurisé par Stripe',
                  Icon: CreditCard,
                },
                {
                  id: 'delivery' as const,
                  label: 'Paiement à la livraison',
                  hint: 'En espèces ou par carte auprès du livreur',
                  Icon: Banknote,
                },
              ] as const
            )
              .map((p) => {
              const blocked = p.id === 'delivery' && cashOnDeliveryBlocked;
              const selected = payment === p.id && !blocked;
              const labelColor = blocked ? colors.mutedForeground : colors.foreground;
              return (
                <Pressable
                  key={p.id}
                  testID={`payment-${p.id}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, disabled: blocked }}
                  disabled={blocked}
                  onPress={() => setPayment(p.id)}
                  style={[
                    styles.row,
                    blocked ? styles.rowBlocked : null,
                    { borderColor: selected ? colors.brandOrange : 'transparent' },
                  ]}
                >
                  <p.Icon size={18} color={selected ? colors.brandOrange : labelColor} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: labelColor, fontWeight: '600' }}>{p.label}</Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 1 }}>
                      {blocked
                        ? 'Non disponible pour votre compte — paiement par carte obligatoire'
                        : p.hint}
                    </Text>
                  </View>
                  {blocked ? null : (
                    <View
                      style={[
                        styles.radio,
                        { borderColor: selected ? colors.brandOrange : colors.border },
                      ]}
                    >
                      {selected ? (
                        <View style={[styles.radioDot, { backgroundColor: colors.brandOrange }]} />
                      ) : null}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </Card>
        </>
      )}

      <Card padding={14} style={{ marginTop: 16 }}>
        {/* HT / TVA uniquement quand la sélection porte de la TVA. */}
        {vat.vat > 0 ? (
          <>
            <View style={styles.totalRow}>
              <Text style={{ color: colors.mutedForeground }}>Montant HT</Text>
              <Text style={{ color: colors.foreground }}>{formatPrice(vat.ht)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={{ color: colors.mutedForeground }}>
                TVA{vat.byRate.length === 1 && vat.byRate[0]!.rate > 0 ? ` (${vat.byRate[0]!.rate} %)` : ''}
              </Text>
              <Text style={{ color: colors.foreground }}>{formatPrice(vat.vat)}</Text>
            </View>
          </>
        ) : null}
        <View style={styles.totalRow}>
          <Text style={{ color: colors.mutedForeground }}>{vat.vat > 0 ? 'Sous-total TTC' : 'Sous-total'}</Text>
          <Text style={{ color: colors.foreground, fontWeight: '600' }}>{formatPrice(subTotal)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={{ color: colors.mutedForeground }}>Livraison</Text>
          <Text style={{ color: colors.foreground }} testID="checkout-delivery-fee">
            {deliveryDiscountPct > 0 ? (
              <Text style={styles.strikePrice}>{formatPrice(baseDeliveryFee)} </Text>
            ) : null}
            {zone ? (isFreeDelivery || deliveryFee === 0 ? 'Gratuit' : formatPrice(deliveryFee)) : '—'}
          </Text>
        </View>
        {appliedPromo ? (
          <View style={styles.totalRow}>
            <Text style={{ color: colors.mutedForeground }}>
              Code promo {appliedPromo.code}
            </Text>
            <Text style={{ color: colors.brandOrange, fontWeight: '700' }}>
              -{formatPrice(promoDiscount)}
            </Text>
          </View>
        ) : null}
        {walletApplied > 0 ? (
          <View style={styles.totalRow}>
            <Text style={{ color: colors.mutedForeground }}>Portefeuille</Text>
            <Text style={{ color: colors.brandOrange, fontWeight: '700' }}>
              -{formatPrice(walletApplied)}
            </Text>
          </View>
        ) : null}
        {slotLabel ? (
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 6 }}>
            Créneau : {slotLabel}
          </Text>
        ) : null}
        <View style={[styles.totalRow, { marginTop: 6 }]}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.foreground }}>
            {paidByWalletOnly
              ? 'Reste à payer'
              : walletApplied > 0
                ? payment === 'card'
                  ? 'À régler par carte'
                  : 'À régler à la livraison'
                : 'Total à payer'}
          </Text>
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.foreground }}>
            {formatPrice(grandTotal)}
          </Text>
        </View>
      </Card>

      <Button
        title={
          !user
            ? 'Se connecter pour commander'
            : zoneDisabled
              ? 'Livraison indisponible dans votre zone'
              : 'Confirmer ma commande'
        }
        variant="brand"
        size="lg"
        fullWidth
        loading={placeOrder.isPending}
        disabled={!user ? false : !canProceed}
        onPress={() => (user ? placeOrder.mutate() : nav.navigate('Login'))}
        // Zone coupée : bouton « orange grisé » pour signaler le blocage.
        style={
          zoneDisabled
            ? { marginTop: 20, backgroundColor: palette.orange[300], opacity: 1 }
            : { marginTop: 20 }
        }
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  section: { marginTop: 16, fontSize: 14, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 6,
  },
  /** Moyen de paiement interdit à ce client : visible mais éteint (comme le web). */
  rowBlocked: { opacity: 0.6 },
  /** Résumé des coordonnées : mêmes libellés et « Modifier » que le profil. */
  fieldHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldLabel: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  editTxt: { fontSize: 13, fontWeight: '700' },
  addressBox: { paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12 },
  editActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  editHint: { fontSize: 12, marginTop: 8 },
  /** Code postal hors de toute zone de livraison. */
  noZone: { marginTop: 12, fontSize: 13, lineHeight: 18, fontWeight: '700', color: palette.red[700] },
  /** Solde du portefeuille : même violet que la carte du profil. */
  walletAmount: { color: palette.purple[600], fontWeight: '700' },
  /** Frais de livraison avant réduction. */
  strikePrice: { textDecorationLine: 'line-through', color: palette.slate[400] },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
});
