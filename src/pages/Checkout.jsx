import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { MapPin, CreditCard, Truck, CheckCircle, ArrowLeft, Package, Tag, Banknote, Calendar, Clock, Pencil, AlertCircle } from 'lucide-react';
import DeliveryScheduleInfo from '@/components/checkout/DeliveryScheduleInfo';
import { generateDeliveryCode } from '@/lib/deliveryCode';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from '@stripe/react-stripe-js';

function PaymentForm({ onSuccess, amount, formData, cartItems, user, loyaltySettings, deliverySlots, totalBeforeWallet, appliedPromo, promoDiscount, actualWalletAmount }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [cardholderName, setCardholderName] = useState('');
  const [saveCard, setSaveCard] = useState(false);
  const [useSavedCard, setUseSavedCard] = useState(true);
  const [deletingCard, setDeletingCard] = useState(false);

  const savedCardInfo = user?.saved_card_info ? JSON.parse(user.saved_card_info) : null;
  const hasSavedCard = !!user?.saved_payment_method_id && !!savedCardInfo;

  const handlePayment = async () => {
    if (!stripe || !elements) return;
    setProcessing(true);
    setError(null);

    let createdOrder = null;

    try {
      // Étape 1 : Créer la commande en statut "pending" AVANT le paiement
      if (formData.delivery_slot_id) {
        const slot = deliverySlots.find(s => s.id === formData.delivery_slot_id);
        if (slot) {
          await base44.entities.DeliverySlot.update(slot.id, {
            current_orders: (slot.current_orders || 0) + 1
          });
        }
      }

      createdOrder = await base44.entities.Order.create({
        customer_email: user.email,
        items: cartItems.map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.unit_price * item.quantity,
          selected_variants: item.selected_variants
        })),
        total_amount: totalBeforeWallet,
        payment_method: 'card',
        payment_status: 'pending',
        wallet_amount_used: actualWalletAmount,
        promo_code: appliedPromo?.code || null,
        promo_discount: promoDiscount || 0,
        amount_to_pay: amount,
        status: 'pending',
        delivery_address: formData.address,
        delivery_postal_code: formData.postal_code,
        delivery_city: formData.city,
        notes: formData.notes,
        estimated_delivery: formData.delivery_date,
        delivery_time: formData.delivery_time,
        // Code à 4 chiffres que le client communiquera au livreur à la remise.
        delivery_code: generateDeliveryCode()
      });

      // Étape 2 : Créer le PaymentIntent avec l'order_id dans les métadonnées
      const { data: paymentData } = await base44.functions.invoke('createPaymentIntent', {
        amount,
        orderId: createdOrder.id,
        useSavedCard: hasSavedCard && useSavedCard,
        saveCard: saveCard,
        orderData: { customer_email: user.email, items: cartItems, delivery_address: formData.address }
      });

      // Cas 1 : Paiement avec carte enregistrée (déjà confirmé côté serveur)
      if (hasSavedCard && useSavedCard) {
        if (paymentData.status !== 'succeeded') {
          // Marquer la commande comme échouée
          await base44.entities.Order.update(createdOrder.id, { payment_status: 'failed', status: 'cancelled' });
          setError('Le paiement avec la carte enregistrée a échoué. Veuillez utiliser une autre carte.');
          setProcessing(false);
          return;
        }
        // Le webhook confirmera la commande, mais on peut aussi confirmer ici
        if (actualWalletAmount > 0) {
          const newBalance = (user.wallet_balance || 0) - actualWalletAmount;
          await base44.auth.updateMe({ wallet_balance: newBalance });
          await base44.entities.WalletTransaction.create({
            customer_email: user.email,
            amount: actualWalletAmount,
            type: 'debit',
            reason: `Paiement commande #${createdOrder.id.slice(-8)}`
          });
        }
        await Promise.all(cartItems.map(item => base44.entities.CartItem.delete(item.id)));
        await base44.functions.invoke('updateStockAfterOrder', { orderId: createdOrder.id });
        await base44.functions.invoke('notifyAdminsNewOrder', {
          orderId: createdOrder.id,
          customerEmail: user.email,
          customerName: user.full_name || user.email,
          totalAmount: amount,
          paymentMethod: 'card'
        });
        onSuccess(createdOrder.id);
        return;
      }

      // Cas 2 : Nouvelle carte
      if (!paymentData.clientSecret) {
        await base44.entities.Order.update(createdOrder.id, { payment_status: 'failed', status: 'cancelled' });
        setError('Erreur lors de la création du paiement');
        setProcessing(false);
        return;
      }

      const cardNumberElement = elements.getElement(CardNumberElement);
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        paymentData.clientSecret,
        {
          payment_method: {
            card: cardNumberElement,
            billing_details: {
              name: cardholderName || user.full_name || user.email,
              email: user.email,
            },
          },
        }
      );

      if (stripeError) {
        // Marquer la commande comme échouée
        await base44.entities.Order.update(createdOrder.id, { payment_status: 'failed', status: 'cancelled', cancellation_reason: stripeError.message });
        setError(stripeError.message);
        setProcessing(false);
        return;
      }

      if (paymentIntent.status === 'succeeded') {
        // saveCard est déjà géré côté serveur via setup_future_usage,
        // mais on appelle saveCard pour enregistrer les infos de carte sur l'utilisateur
        if (saveCard && paymentIntent.payment_method) {
          await base44.functions.invoke('saveCard', { paymentMethodId: paymentIntent.payment_method });
        }
        // Débiter le portefeuille si utilisé
        if (actualWalletAmount > 0) {
          const newBalance = (user.wallet_balance || 0) - actualWalletAmount;
          await base44.auth.updateMe({ wallet_balance: newBalance });
          await base44.entities.WalletTransaction.create({
            customer_email: user.email,
            amount: actualWalletAmount,
            type: 'debit',
            reason: `Paiement commande #${createdOrder.id.slice(-8)}`
          });
        }
        await Promise.all(cartItems.map(item => base44.entities.CartItem.delete(item.id)));
        await base44.functions.invoke('updateStockAfterOrder', { orderId: createdOrder.id });
        // Notifier les admins de la nouvelle commande payée par carte
        await base44.functions.invoke('notifyAdminsNewOrder', {
          orderId: createdOrder.id,
          customerEmail: user.email,
          customerName: user.full_name || user.email,
          totalAmount: amount,
          paymentMethod: 'card'
        });
        onSuccess(createdOrder.id);
      }
    } catch (err) {
      console.error('Payment error:', err);
      // Si la commande a été créée, la marquer comme échouée
      if (createdOrder?.id) {
        await base44.entities.Order.update(createdOrder.id, { payment_status: 'failed', status: 'cancelled', cancellation_reason: err.message });
      }
      setError(err.message || 'Erreur lors du paiement. Veuillez réessayer.');
      setProcessing(false);
    }
  };

  const handleDeleteCard = async () => {
    setDeletingCard(true);
    await base44.functions.invoke('deleteCard', {});
    // Rafraîchir l'utilisateur
    window.location.reload();
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#1e293b',
        '::placeholder': { color: '#94a3b8' },
      },
    },
  };

  const brandIcons = { visa: '💳', mastercard: '💳', amex: '💳', default: '💳' };

  return (
    <div className="space-y-4">
      {/* Carte enregistrée */}
      {hasSavedCard && (
        <div className={`border-2 rounded-xl p-4 transition-all ${useSavedCard ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <input
                type="radio"
                checked={useSavedCard}
                onChange={() => setUseSavedCard(true)}
                className="w-4 h-4 text-emerald-600"
              />
              <div>
                <p className="font-medium text-slate-800 capitalize">{savedCardInfo.brand} •••• {savedCardInfo.last4}</p>
                <p className="text-xs text-slate-500">Expire {savedCardInfo.exp_month}/{savedCardInfo.exp_year}</p>
              </div>
            </div>
            <button
              onClick={handleDeleteCard}
              disabled={deletingCard}
              className="text-xs text-rose-500 hover:text-rose-700 underline"
            >
              Supprimer
            </button>
          </div>
        </div>
      )}

      {/* Nouvelle carte */}
      {hasSavedCard && (
        <div className={`border-2 rounded-xl p-4 transition-all ${!useSavedCard ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <input
              type="radio"
              checked={!useSavedCard}
              onChange={() => setUseSavedCard(false)}
              className="w-4 h-4 text-emerald-600"
            />
            <p className="font-medium text-slate-800">Utiliser une autre carte</p>
          </div>
        </div>
      )}

      {/* Formulaire nouvelle carte (si pas de carte enregistrée OU si on veut une nouvelle) */}
      {(!hasSavedCard || !useSavedCard) && (
        <div className="space-y-4">
          <div>
            <Label>Numéro de carte</Label>
            <div className="mt-1 p-3 border border-slate-200 rounded-xl bg-white">
              <CardNumberElement options={cardElementOptions} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date d'expiration</Label>
              <div className="mt-1 p-3 border border-slate-200 rounded-xl bg-white">
                <CardExpiryElement options={cardElementOptions} />
              </div>
            </div>
            <div>
              <Label>CVV</Label>
              <div className="mt-1 p-3 border border-slate-200 rounded-xl bg-white">
                <CardCvcElement options={cardElementOptions} />
              </div>
            </div>
          </div>

          <div>
            <Label>Nom sur la carte</Label>
            <Input
              type="text"
              placeholder="Prénom Nom"
              value={cardholderName}
              onChange={(e) => setCardholderName(e.target.value.toUpperCase())}
              className="h-12 rounded-xl mt-1"
            />
          </div>

          <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl">
            <input
              type="checkbox"
              id="save-card"
              checked={saveCard}
              onChange={(e) => setSaveCard(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-emerald-600"
            />
            <Label htmlFor="save-card" className="cursor-pointer text-sm text-slate-700">
              Enregistrer ma carte pour les prochains paiements
            </Label>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-700">
          {error}
        </div>
      )}
      
      <Button
        onClick={handlePayment}
        disabled={!stripe || processing || ((!hasSavedCard || !useSavedCard) && !cardholderName)}
        className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-lg font-semibold shadow-lg shadow-emerald-500/25"
      >
        {processing ? 'Traitement du paiement...' : `Payer ${amount.toFixed(2)}€`}
      </Button>
    </div>
  );
}

const normalizeCity = (city) => {
  return city
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/gi, '')
    .toLowerCase()
    .trim();
};

export default function Checkout() {
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(1);
  const [orderComplete, setOrderComplete] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('delivery');
  const [walletAmount, setWalletAmount] = useState(0);
  const [useWallet, setUseWallet] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoError, setPromoError] = useState('');
  const [editAddress, setEditAddress] = useState(false);
  const [addressSearch, setAddressSearch] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    address: '',
    postal_code: '',
    city: '',
    notes: '',
    delivery_date: '',
    delivery_time: '',
    delivery_slot_id: ''
  });

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      
      // Vérifier que toutes les informations obligatoires sont présentes
      if (!u.civility || !u.first_name || !u.last_name || !u.phone || !u.address || !u.postal_code || !u.city) {
        // Rediriger vers le profil pour compléter les informations
        navigate(createPageUrl('Profile') + '?redirect=checkout');
        return;
      }
      
      setFormData({
        address: u.address || '',
        postal_code: u.postal_code || '',
        city: u.city || '',
        notes: '',
        delivery_date: '',
        delivery_time: '',
        delivery_slot_id: ''
      });
    }).catch(() => {
      // Rediriger vers login avec nextUrl vers checkout
      base44.auth.redirectToLogin(window.location.pathname);
    });
  }, [navigate]);

  const { data: cartItems = [] } = useQuery({
    queryKey: ['cart', user?.email],
    queryFn: () => base44.entities.CartItem.filter({ customer_email: user?.email }),
    enabled: !!user?.email
  });

  const { data: allProducts = [] } = useQuery({
    queryKey: ['all-products'],
    queryFn: () => base44.entities.Product.list(),
    enabled: !!user?.email
  });

  // Vérifier les articles en rupture de stock dans le panier
  const outOfStockCartItems = cartItems.filter(item => {
    const product = allProducts.find(p => p.id === item.product_id);
    return product && product.stock_quantity <= 0;
  });

  const { data: deliveryZones = [] } = useQuery({
    queryKey: ['deliveryZones'],
    queryFn: () => base44.entities.DeliveryZone.list()
  });

  const { data: appSettings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list()
  });

  const deliverySlotsEnabled = appSettings[0]?.delivery_slots_enabled || false;
  const stripePublishableKey = appSettings[0]?.stripe_publishable_key;
  const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

  const { data: deliverySlots = [] } = useQuery({
    queryKey: ['deliverySlots'],
    queryFn: () => base44.entities.DeliverySlot.list('-date'),
    enabled: deliverySlotsEnabled,
    select: (data) => data.filter(slot => 
      slot.is_available && 
      slot.date >= new Date().toISOString().split('T')[0] &&
      (slot.current_orders || 0) < slot.max_orders
    )
  });

  const { data: loyaltySettings } = useQuery({
    queryKey: ['loyaltySettings'],
    queryFn: () => base44.entities.LoyaltySettings.list(),
    select: (data) => data[0] || { points_per_euro: 1, min_purchase_amount: 10, is_active: true, auto_points_on_delivery: false }
  });

  const { data: discountCodeSettings = [] } = useQuery({
    queryKey: ['discountCodeSettings'],
    queryFn: () => base44.entities.DiscountCodeSettings.list()
  });

  const { data: userOrders = [] } = useQuery({
    queryKey: ['userOrders', user?.email],
    queryFn: () => base44.entities.Order.filter({ customer_email: user?.email }),
    enabled: !!user?.email
  });

  const { data: discountCodeUsages = [] } = useQuery({
    queryKey: ['discountCodeUsages', user?.email],
    queryFn: () => base44.entities.DiscountCodeUsage.filter({ customer_email: user?.email }),
    enabled: !!user?.email
  });

  const promoSystemEnabled = discountCodeSettings[0]?.system_enabled !== false;

  const subtotal = cartItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  
  // Trouver la zone de livraison selon le code postal uniquement
  const currentZone = deliveryZones.find(zone => 
    zone.is_active && zone.postal_codes?.includes(formData.postal_code)
  );
  
  // Utiliser Number() pour s'assurer que 0 est bien traité comme 0 et non comme valeur manquante
  const FREE_DELIVERY_THRESHOLD = currentZone ? Number(currentZone.free_delivery_threshold) : 0;
  const DELIVERY_FEE = currentZone ? Number(currentZone.delivery_fee) : 0;
  const MIN_ORDER_AMOUNT = currentZone?.min_order_amount || 0;
  const DELIVERY_TIME_DAYS = currentZone?.delivery_time_days || '2 jours';
  
  // Livraison gratuite si threshold = 0 (activé par l'admin) ou si subtotal >= threshold
  const isFreeDelivery = currentZone && (FREE_DELIVERY_THRESHOLD === 0 || subtotal >= FREE_DELIVERY_THRESHOLD);

  // Calculer les réductions sur la livraison
  const calculateDeliveryDiscount = () => {
    if (!currentZone || isFreeDelivery) return 0;
    
    let discount = 0;
    const today = new Date().toISOString().split('T')[0];
    
    // Vérifier la validité de la période
    const isValidPeriod = (!currentZone.discount_valid_from || currentZone.discount_valid_from <= today) &&
                          (!currentZone.discount_valid_until || currentZone.discount_valid_until >= today);
    
    if (!isValidPeriod) return 0;
    
    // Vérifier si applicable sur le numéro de commande
    const customerOrderCount = userOrders.filter(o => o.status !== 'cancelled').length + 1;
    const isApplicableOrderNumber = currentZone.discount_for_order_numbers?.length === 0 || 
                                     currentZone.discount_for_order_numbers?.includes(customerOrderCount);
    
    if (!isApplicableOrderNumber) return 0;
    
    // Vérifier si nouveaux clients uniquement
    if (currentZone.discount_for_new_customers && customerOrderCount > 1) return 0;
    
    // Réduction de base
    discount = currentZone.delivery_discount_percentage || 0;
    
    // Ajouter la réduction par niveau
    const userTier = user?.customer_tier || 'normal';
    const tierDiscount = currentZone.tier_discounts?.[userTier] || 0;
    discount += tierDiscount;
    
    return Math.min(discount, 100); // Maximum 100%
  };
  
  const deliveryDiscountPercentage = calculateDeliveryDiscount();
  const baseDeliveryFee = isFreeDelivery ? 0 : DELIVERY_FEE;
  const deliveryFee = baseDeliveryFee * (1 - deliveryDiscountPercentage / 100);
  const totalBeforeWallet = subtotal + deliveryFee;
  
  const isZoneAvailable = formData.postal_code ? !!currentZone : true;
  const meetsMinimum = subtotal >= MIN_ORDER_AMOUNT;
  
  // Calculer la réduction du code promo
  const promoDiscount = appliedPromo ? (totalBeforeWallet * appliedPromo.discount_percentage / 100) : 0;
  const totalAfterPromo = Math.max(0, totalBeforeWallet - promoDiscount);
  
  const maxWalletUsage = Math.min(user?.wallet_balance || 0, totalAfterPromo);
  const actualWalletAmount = useWallet ? Math.min(walletAmount || 0, maxWalletUsage) : 0;
  const total = Math.max(0, totalAfterPromo - actualWalletAmount);

  const handleSearchAddress = async (query) => {
    if (query.length < 3) {
      setAddressSuggestions([]);
      return;
    }

    try {
      const response = await fetch(
        `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=5`
      );
      const data = await response.json();
      setAddressSuggestions(data.features || []);
    } catch (error) {
      console.error('Erreur lors de la recherche d\'adresse:', error);
    }
  };

  const handleSelectAddress = (feature) => {
    const props = feature.properties;
    setFormData({
      ...formData,
      address: props.name,
      postal_code: props.postcode,
      city: props.city
    });
    setAddressSearch('');
    setAddressSuggestions([]);
    setEditAddress(false);
  };

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    
    setPromoError('');
    
    const codes = await base44.entities.DiscountCode.filter({ code: promoCode.toUpperCase() });
    
    if (codes.length === 0) {
      setPromoError('Code promo invalide');
      return;
    }
    
    const code = codes[0];
    
    // Vérifications
    if (!code.is_active) {
      setPromoError('Ce code n\'est plus actif');
      return;
    }
    
    const today = new Date();
    if (code.valid_from && new Date(code.valid_from) > today) {
      setPromoError('Ce code n\'est pas encore valide');
      return;
    }
    
    if (code.valid_until && new Date(code.valid_until) < today) {
      setPromoError('Ce code a expiré');
      return;
    }
    
    if (code.min_order_amount && totalBeforeWallet < code.min_order_amount) {
      setPromoError(`Commande minimale de ${code.min_order_amount}€ requise`);
      return;
    }
    
    // Vérifier le nombre d'utilisations par client
    const customerUsages = discountCodeUsages.filter(u => u.code === code.code);
    if (customerUsages.length >= code.max_uses_per_customer) {
      setPromoError('Vous avez atteint la limite d\'utilisation de ce code');
      return;
    }
    
    // Vérifier si applicable sur le numéro de commande
    if (code.applicable_order_numbers?.length > 0) {
      const customerOrderCount = userOrders.filter(o => o.status !== 'cancelled').length + 1;
      if (!code.applicable_order_numbers.includes(customerOrderCount)) {
        const applicableOrders = code.applicable_order_numbers.map(n => 
          n === 1 ? '1ère' : n === 2 ? '2ème' : n === 3 ? '3ème' : `${n}ème`
        ).join(', ');
        setPromoError(`Ce code est uniquement applicable sur la ${applicableOrders} commande`);
        return;
      }
    }
    
    setAppliedPromo(code);
    toast.success(`Code promo appliqué: -${code.discount_percentage}%`);
  };

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      // Incrémenter current_orders du créneau sélectionné
      if (formData.delivery_slot_id) {
        const slot = deliverySlots.find(s => s.id === formData.delivery_slot_id);
        if (slot) {
          await base44.entities.DeliverySlot.update(slot.id, {
            current_orders: (slot.current_orders || 0) + 1
          });
        }
      }

      const order = await base44.entities.Order.create({
        customer_email: user.email,
        items: cartItems.map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.unit_price * item.quantity,
          selected_variants: item.selected_variants
        })),
        total_amount: totalBeforeWallet,
        payment_method: 'delivery',
        wallet_amount_used: actualWalletAmount,
        promo_code: appliedPromo?.code || null,
        promo_discount: promoDiscount || 0,
        amount_to_pay: total,
        status: 'pending',
        delivery_address: formData.address,
        delivery_postal_code: formData.postal_code,
        delivery_city: formData.city,
        notes: formData.notes,
        estimated_delivery: formData.delivery_date,
        delivery_time: formData.delivery_time,
        // Code à 4 chiffres que le client communiquera au livreur à la remise.
        delivery_code: generateDeliveryCode()
      });

      // Enregistrer l'utilisation du code promo
      if (appliedPromo) {
        await base44.entities.DiscountCodeUsage.create({
          code: appliedPromo.code,
          customer_email: user.email,
          order_id: order.id,
          discount_amount: promoDiscount,
          used_at: new Date().toISOString()
        });
        
        // Incrémenter le compteur total d'utilisations
        await base44.entities.DiscountCode.update(appliedPromo.id, {
          total_uses: (appliedPromo.total_uses || 0) + 1
        });
      }

      // Débiter le portefeuille si utilisé
      if (actualWalletAmount > 0) {
        const newBalance = (user.wallet_balance || 0) - actualWalletAmount;
        await base44.auth.updateMe({ wallet_balance: newBalance });
        
        await base44.entities.WalletTransaction.create({
          customer_email: user.email,
          amount: actualWalletAmount,
          type: 'debit',
          reason: `Paiement commande #${order.id.slice(-8)}`
        });
      }

      await Promise.all(cartItems.map(item => base44.entities.CartItem.delete(item.id)));
      await base44.functions.invoke('updateStockAfterOrder', { orderId: order.id });

      // Notifier les admins de la nouvelle commande
      await base44.functions.invoke('notifyAdminsNewOrder', {
        orderId: order.id,
        customerEmail: user.email,
        customerName: user.full_name || user.email,
        totalAmount: total,
        paymentMethod: 'delivery'
      });

      return order;
    },
    onSuccess: (order) => {
      setCreatedOrderId(order.id);
      setOrderComplete(true);
      queryClient.setQueryData(['cart', user?.email], []);
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['loyaltyPoints'] });
    }
  });

  const handlePaymentSuccess = (orderId) => {
    setCreatedOrderId(orderId);
    setOrderComplete(true);
    // Vider le cache du panier immédiatement pour que le panier s'affiche vide
    queryClient.setQueryData(['cart', user?.email], []);
    queryClient.invalidateQueries({ queryKey: ['cart'] });
    queryClient.invalidateQueries({ queryKey: ['products'] });
  };

  if (orderComplete) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl p-8 md:p-12 max-w-md w-full text-center shadow-xl"
        >
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Commande confirmée !</h1>
          <p className="text-slate-500 mb-8">
            Votre commande a été passée avec succès. Vous pouvez suivre son statut dans vos commandes.
          </p>
          <div className="space-y-3">
            <Link to={createPageUrl('OrderDetails') + `?id=${createdOrderId}`}>
              <Button className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 rounded-xl">
                <Package className="w-4 h-4 mr-2" />
                Suivre ma commande
              </Button>
            </Link>
            <Link to={createPageUrl('Home')}>
              <Button variant="outline" className="w-full h-12 rounded-xl">
                Continuer mes achats
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link to={createPageUrl('Home')} className="inline-flex items-center text-slate-600 hover:text-emerald-600 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour aux produits
        </Link>

        <h1 className="text-3xl font-bold text-slate-800 mb-8">Finaliser ma commande</h1>

        {/* Steps */}
        <div className="flex items-center justify-center mb-10">
          {[
            { num: 1, label: 'Livraison', icon: MapPin },
            { num: 2, label: 'Paiement', icon: CreditCard },
          ].map((s, i) => (
            <React.Fragment key={s.num}>
              <div className="flex flex-col items-center">
                <div className={`
                  w-12 h-12 rounded-full flex items-center justify-center font-semibold transition-all
                  ${step >= s.num 
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' 
                    : 'bg-slate-200 text-slate-500'
                  }
                `}>
                  <s.icon className="w-5 h-5" />
                </div>
                <span className={`text-sm mt-2 font-medium ${step >= s.num ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {s.label}
                </span>
              </div>
              {i < 1 && (
                <div className={`w-24 h-1 mx-4 rounded ${step > s.num ? 'bg-emerald-500' : 'bg-slate-200'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Form */}
          <div className="md:col-span-2">
            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <Card className="border-0 shadow-lg rounded-2xl">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Truck className="w-5 h-5 text-emerald-500" />
                        Adresse de livraison
                      </div>
                      {!editAddress && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditAddress(true)}
                          className="rounded-xl"
                        >
                          <Pencil className="w-4 h-4 mr-2" />
                          Modifier
                        </Button>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!editAddress ? (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <p className="font-medium text-slate-800">{formData.address}</p>
                        <p className="text-slate-600">{formData.postal_code} {formData.city}</p>
                      </div>
                    ) : (
                      <>
                      <div className="relative">
                       <Label>Rechercher une adresse</Label>
                       <Input
                         value={addressSearch}
                         onChange={(e) => {
                           setAddressSearch(e.target.value);
                           handleSearchAddress(e.target.value);
                         }}
                         placeholder="Tapez votre adresse..."
                         className="h-12 rounded-xl mt-1"
                       />
                       {addressSuggestions.length > 0 && (
                         <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                           {addressSuggestions.map((suggestion, index) => (
                             <button
                               key={index}
                               onClick={() => handleSelectAddress(suggestion)}
                               className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b last:border-b-0"
                             >
                               <p className="font-medium text-slate-800">{suggestion.properties.label}</p>
                             </button>
                           ))}
                         </div>
                       )}
                      </div>

                      <div>
                       <Label>Adresse</Label>
                       <Input
                         value={formData.address}
                         onChange={(e) => setFormData({...formData, address: e.target.value})}
                         placeholder="123 rue de la Paix"
                         className="h-12 rounded-xl mt-1"
                       />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                       <div>
                         <Label>Code postal *</Label>
                         <Input
                           value={formData.postal_code}
                           onChange={(e) => setFormData({...formData, postal_code: e.target.value})}
                           placeholder="75001"
                           className="h-12 rounded-xl mt-1"
                         />
                       </div>
                       <div>
                         <Label>Ville</Label>
                         <Input
                           value={formData.city}
                           onChange={(e) => setFormData({...formData, city: e.target.value})}
                           placeholder="Paris"
                           className="h-12 rounded-xl mt-1"
                         />
                       </div>
                      </div>
                      <Button
                         variant="outline"
                         onClick={() => {
                           // Vérifier que le code postal est couvert
                           const zone = deliveryZones.find(z => 
                             z.is_active && z.postal_codes?.includes(formData.postal_code)
                           );
                           if (!zone && formData.postal_code) {
                             toast.error('Désolé, le code postal ' + formData.postal_code + ' n\'est pas couvert par nos zones de livraison');
                             return;
                           }
                           setEditAddress(false);
                         }}
                         className="w-full rounded-xl"
                       >
                         Valider l'adresse
                       </Button>
                      </>
                    )}
                    <div>
                      <Label>Instructions de livraison (optionnel)</Label>
                      <Textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({...formData, notes: e.target.value})}
                        placeholder="Code d'entrée, étage, etc."
                        className="rounded-xl mt-1"
                      />
                    </div>
                    
                    {deliverySlotsEnabled && (
                      <div>
                        <Label className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-emerald-500" />
                          Créneau de livraison <span className="text-rose-500">*</span>
                        </Label>
                        {deliverySlots.length === 0 ? (
                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700 mt-1">
                            ⚠️ Aucun créneau de livraison disponible pour le moment
                          </div>
                        ) : (
                          <select
                            value={formData.delivery_slot_id}
                            onChange={(e) => {
                              const slotId = e.target.value;
                              const slot = deliverySlots.find(s => s.id === slotId);
                              setFormData({
                                ...formData,
                                delivery_slot_id: slotId,
                                delivery_date: slot?.date || '',
                                delivery_time: slot?.time_slot?.split('-')[0]?.trim() || ''
                              });
                            }}
                            className="w-full h-12 rounded-xl mt-1 border border-slate-200 px-3 bg-white"
                          >
                            <option value="">Sélectionnez un créneau</option>
                            {deliverySlots.map(slot => (
                              <option key={slot.id} value={slot.id}>
                                {format(new Date(slot.date), 'dd/MM/yyyy', { locale: fr })} - {slot.time_slot} ({(slot.current_orders || 0)}/{slot.max_orders} places)
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}
                    {/* Horaires de livraison de la zone - affichage intelligent */}
                    {currentZone?.delivery_schedule?.length > 0 && (
                     <DeliveryScheduleInfo zone={currentZone} />
                    )}

                    {!isZoneAvailable && (formData.city || formData.postal_code) && (
                      <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">
                        ⚠️ Désolé, nous ne livrons pas à {formData.postal_code} {formData.city}.
                      </div>
                    )}
                    {!meetsMinimum && isZoneAvailable && formData.postal_code && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
                        ⚠️ Montant minimum de commande pour cette zone: {MIN_ORDER_AMOUNT}€ (vous avez {subtotal.toFixed(2)}€)
                      </div>
                    )}
                    <Button
                      onClick={() => setStep(2)}
                      disabled={
                        !formData.address || 
                        !formData.postal_code || 
                        !formData.city || 
                        !isZoneAvailable || 
                        !meetsMinimum || 
                        (deliverySlotsEnabled && (!formData.delivery_slot_id || deliverySlots.length === 0))
                      }
                      className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 rounded-xl mt-4"
                    >
                      Continuer vers le paiement
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <Card className="border-0 shadow-lg rounded-2xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                      <CreditCard className="w-5 h-5 text-emerald-500" />
                      Paiement
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Utiliser le portefeuille */}
                    {user?.wallet_balance > 0 && (
                     <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                       <div className="flex items-center justify-between mb-3">
                         <div className="flex items-center gap-2">
                           <input
                             type="checkbox"
                             checked={useWallet}
                             onChange={(e) => {
                               setUseWallet(e.target.checked);
                               if (e.target.checked) {
                                 setWalletAmount(maxWalletUsage);
                               } else {
                                 setWalletAmount(0);
                               }
                             }}
                             className="w-4 h-4 rounded border-purple-300 text-purple-600"
                           />
                           <Label className="font-medium text-purple-900">
                             Utiliser mon portefeuille
                           </Label>
                         </div>
                         <span className="text-purple-700 font-semibold">
                           {user.wallet_balance.toFixed(2)}€
                         </span>
                       </div>
                       {useWallet && (
                         <div>
                           <Label className="text-sm text-purple-700">
                             Montant à utiliser (max {maxWalletUsage.toFixed(2)}€)
                           </Label>
                           <Input
                             type="number"
                             step="0.01"
                             max={maxWalletUsage}
                             value={walletAmount}
                             onChange={(e) => setWalletAmount(Math.min(parseFloat(e.target.value) || 0, maxWalletUsage))}
                             className="mt-1"
                           />
                         </div>
                       )}
                     </div>
                    )}

                    {/* Choix du mode de paiement */}
                    {total > 0 && (
                      <div className="space-y-3">
                       <Label>Mode de paiement (Reste à payer: {total.toFixed(2)}€)</Label>
                       <div className="grid gap-3">
                          <button
                            onClick={() => setPaymentMethod('card')}
                            className={`p-4 rounded-xl border-2 transition-all text-left ${
                              paymentMethod === 'card' 
                                ? 'border-emerald-500 bg-emerald-50' 
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <CreditCard className="w-5 h-5 text-emerald-600" />
                              <div>
                                <p className="font-medium text-slate-800">Carte bancaire</p>
                                <p className="text-sm text-slate-500">Paiement sécurisé par Stripe</p>
                              </div>
                            </div>
                          </button>
                          
                          <button
                            onClick={() => setPaymentMethod('delivery')}
                            className={`p-4 rounded-xl border-2 transition-all text-left ${
                              paymentMethod === 'delivery' 
                                ? 'border-emerald-500 bg-emerald-50' 
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Banknote className="w-5 h-5 text-emerald-600" />
                              <div>
                                <p className="font-medium text-slate-800">Paiement à la livraison</p>
                                <p className="text-sm text-slate-500">Vous payerez directement au livreur en espèces ou par carte</p>
                              </div>
                            </div>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Formulaire de paiement carte */}
                    {paymentMethod === 'card' && (
                      <>
                        {!stripePublishableKey ? (
                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
                            ⚠️ Le paiement par carte n'est pas encore configuré. Veuillez contacter l'administrateur ou choisir le paiement à la livraison.
                          </div>
                        ) : (
                          <Elements stripe={stripePromise}>
                           <PaymentForm
                             onSuccess={handlePaymentSuccess}
                             amount={total}
                             formData={formData}
                             cartItems={cartItems}
                             user={user}
                             loyaltySettings={loyaltySettings}
                             deliverySlots={deliverySlots}
                             totalBeforeWallet={totalBeforeWallet}
                             appliedPromo={appliedPromo}
                             promoDiscount={promoDiscount}
                             actualWalletAmount={actualWalletAmount}
                           />
                          </Elements>
                        )}
                      </>
                    )}

                    {/* Paiement à la livraison */}
                    {paymentMethod === 'delivery' && total > 0 && (
                      <div className="space-y-3">
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                          <p className="text-emerald-700 text-sm">
                            💵 Vous payerez directement au livreur en espèces ou par carte.
                          </p>
                        </div>
                        
                        <Button
                          onClick={() => createOrderMutation.mutate()}
                          disabled={createOrderMutation.isPending || outOfStockCartItems.length > 0}
                          className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-lg font-semibold shadow-lg shadow-emerald-500/25"
                        >
                          {createOrderMutation.isPending ? 'Traitement...' : `Confirmer la commande • ${total.toFixed(2)}€`}
                        </Button>
                      </div>
                    )}

                    {/* Commande entièrement payée par le portefeuille */}
                    {total === 0 && (
                      <div className="space-y-3">
                        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                          <p className="text-purple-700 text-sm font-medium">
                            ✅ Votre commande est entièrement payée avec votre portefeuille !
                          </p>
                        </div>
                        
                        <Button
                          onClick={() => createOrderMutation.mutate()}
                          disabled={createOrderMutation.isPending || outOfStockCartItems.length > 0}
                          className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-lg font-semibold shadow-lg shadow-emerald-500/25"
                        >
                          {createOrderMutation.isPending ? 'Traitement...' : 'Confirmer la commande'}
                        </Button>
                      </div>
                    )}

                    <Button
                      variant="ghost"
                      onClick={() => setStep(1)}
                      className="w-full text-slate-600"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Modifier l'adresse
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>

          {/* Order Summary */}
          <div>
            <Card className="border-0 shadow-lg rounded-2xl sticky top-4">
              <CardHeader>
                <CardTitle>Récapitulatif</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {outOfStockCartItems.length > 0 && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-rose-700">
                      <strong>{outOfStockCartItems.length} article{outOfStockCartItems.length > 1 ? 's' : ''} en rupture de stock</strong> — retournez au panier pour les retirer.
                    </p>
                  </div>
                )}
                {cartItems.map(item => {
                  const isOOS = outOfStockCartItems.some(o => o.id === item.id);
                  return (
                  <div key={item.id} className={`flex justify-between text-sm ${isOOS ? 'opacity-50' : ''}`}>
                    <span className="text-slate-600">
                      {item.product_name} x{item.quantity}
                      {isOOS && <span className="ml-2 text-rose-500 font-medium">(Rupture)</span>}
                    </span>
                    <span className="font-medium">
                      {(item.unit_price * item.quantity).toFixed(2)}€
                    </span>
                  </div>
                  );
                })}
                
                <Separator />
                
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Sous-total</span>
                  <span className="font-medium">{subtotal.toFixed(2)}€</span>
                </div>
                {!formData.postal_code ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                    <Truck className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-700">
                      Ajoutez votre adresse de livraison pour voir les frais
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Livraison</span>
                      <div className="text-right">
                        {baseDeliveryFee === 0 ? (
                          <span className="text-emerald-600 font-medium">Gratuite</span>
                        ) : deliveryDiscountPercentage > 0 ? (
                          <div>
                            <span className="line-through text-slate-400 text-xs mr-2">{baseDeliveryFee.toFixed(2)}€</span>
                            <span className="font-medium text-purple-600">{deliveryFee.toFixed(2)}€</span>
                            <Badge className="ml-2 bg-purple-100 text-purple-700 text-xs">-{deliveryDiscountPercentage.toFixed(0)}%</Badge>
                          </div>
                        ) : (
                          <span className="font-medium">{deliveryFee.toFixed(2)}€</span>
                        )}
                        {currentZone && <p className="text-xs text-slate-400">{DELIVERY_TIME_DAYS}</p>}
                      </div>
                    </div>
                    
                    {currentZone && FREE_DELIVERY_THRESHOLD > 0 && subtotal < FREE_DELIVERY_THRESHOLD && deliveryFee > 0 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                        <Tag className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-blue-700">
                          Plus que <strong>{(FREE_DELIVERY_THRESHOLD - subtotal).toFixed(2)}€</strong> pour la livraison gratuite !
                        </p>
                      </div>
                    )}
                  </>
                )}
                
                <Separator />
                
                {promoSystemEnabled && step === 2 && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-purple-500" />
                      Code promo
                    </Label>
                    {!appliedPromo ? (
                      <div className="flex gap-2">
                        <Input
                          value={promoCode}
                          onChange={(e) => {
                            setPromoCode(e.target.value.toUpperCase());
                            setPromoError('');
                          }}
                          placeholder="CODE PROMO"
                          className="flex-1 h-10 rounded-lg uppercase"
                        />
                        <Button
                          onClick={handleApplyPromo}
                          disabled={!promoCode.trim()}
                          variant="outline"
                          className="h-10 rounded-lg"
                        >
                          Appliquer
                        </Button>
                      </div>
                    ) : (
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4 text-purple-600" />
                          <span className="font-semibold text-purple-900">{appliedPromo.code}</span>
                          <Badge className="bg-purple-600 text-white">-{appliedPromo.discount_percentage}%</Badge>
                        </div>
                        <Button
                          onClick={() => {
                            setAppliedPromo(null);
                            setPromoCode('');
                          }}
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-purple-600"
                        >
                          Retirer
                        </Button>
                      </div>
                    )}
                    {promoError && (
                      <p className="text-xs text-rose-600">{promoError}</p>
                    )}
                  </div>
                )}

                {appliedPromo && (
                  <div className="flex justify-between text-purple-600 text-sm">
                    <span>Code promo ({appliedPromo.code})</span>
                    <span className="font-medium">-{promoDiscount.toFixed(2)}€</span>
                  </div>
                )}
                
                {actualWalletAmount > 0 && (
                  <div className="flex justify-between text-purple-600 text-sm">
                    <span>Portefeuille</span>
                    <span className="font-medium">-{actualWalletAmount.toFixed(2)}€</span>
                  </div>
                )}
                
                <div className="flex justify-between text-lg">
                  <span className="font-semibold">Total à payer</span>
                  <span className="font-bold text-emerald-600">{total.toFixed(2)}€</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}