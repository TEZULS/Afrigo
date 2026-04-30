import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { ShoppingCart, Search, ArrowLeft, User, Package, Mail, MessageCircle, Send, CheckCircle, ShoppingBag, Truck, CreditCard, Banknote, Wallet, Plus, Minus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminCarts() {
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [reminderTarget, setReminderTarget] = useState(null);
  const [reminderMode, setReminderMode] = useState(null);
  const [customMessage, setCustomMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [validateTarget, setValidateTarget] = useState(null);
  const [editableItems, setEditableItems] = useState([]);
  const [includeDelivery, setIncludeDelivery] = useState(true);
  const [deliveryFee, setDeliveryFee] = useState(5);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [validating, setValidating] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [useWallet, setUseWallet] = useState(false);
  const [variantProduct, setVariantProduct] = useState(null); // produit pour sélection de variantes
  const [selectedVariants, setSelectedVariants] = useState({});
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u?.role !== 'admin') { window.location.href = '/'; return; }
      setUser(u);
    }).catch(() => window.location.href = '/');
  }, []);

  const { data: cartItems = [], isLoading } = useQuery({
    queryKey: ['allCartItems'],
    queryFn: () => base44.entities.CartItem.list('-created_date', 1000),
    enabled: !!user,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
    enabled: !!user,
  });

  const { data: walletTransactions = [] } = useQuery({
    queryKey: ['walletTransactions'],
    queryFn: () => base44.entities.WalletTransaction.list(),
    enabled: !!user,
  });

  const cartsByCustomer = cartItems.reduce((acc, item) => {
    const email = item.customer_email;
    if (!acc[email]) acc[email] = [];
    acc[email].push(item);
    return acc;
  }, {});

  const filteredEntries = Object.entries(cartsByCustomer).filter(([email]) => {
    const u = users.find(u => u.email === email);
    const name = u?.first_name && u?.last_name
      ? `${u.first_name} ${u.last_name}`
      : (u?.full_name || '');
    const id = u?.id || '';
    const q = searchQuery.toLowerCase();
    return (
      email.toLowerCase().includes(q) ||
      name.toLowerCase().includes(q) ||
      id.toLowerCase().includes(q)
    );
  });

  const getCustomerData = (email) => {
    const u = users.find(u => u.email === email);
    const name = u?.first_name && u?.last_name
      ? `${u.first_name} ${u.last_name}`
      : (u?.full_name || email);
    const phone = u?.phone || null;
    return { name, phone };
  };

  const getWalletBalance = (email) => {
    const txs = walletTransactions.filter(t => t.customer_email === email);
    return txs.reduce((sum, t) => t.type === 'credit' ? sum + t.amount : sum - t.amount, 0);
  };

  const { data: deliveryZones = [] } = useQuery({
    queryKey: ['deliveryZones'],
    queryFn: () => base44.entities.DeliveryZone.list(),
    enabled: !!user,
  });

  const getCartTotal = (items) =>
    items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);

  const openValidate = (email, items) => {
    const u = users.find(u => u.email === email);
    const zone = deliveryZones.find(z => z.is_active && z.postal_codes?.includes(u?.postal_code));
    const fee = zone ? Number(zone.delivery_fee) : 5;
    setDeliveryFee(fee);
    setIncludeDelivery(true);
    setSelectedPaymentMethod('');
    setProductSearch('');
    setUseWallet(false);
    setEditableItems(items.map(i => ({ ...i })));
    setValidateTarget({ email, items, user: u });
  };

  // Gestion des articles dans la modale
  const updateItemQty = (id, delta) => {
    setEditableItems(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.quantity + delta;
        if (newQty <= 0) return null;
        // Bloquer si dépasse le stock disponible
        const fullProduct = products.find(p => p.id === item.product_id);
        if (delta > 0 && fullProduct && newQty > fullProduct.stock_quantity) return item;
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(Boolean));
  };

  const removeItem = (id) => {
    setEditableItems(prev => prev.filter(item => item.id !== id));
  };

  const openVariantSelector = (product) => {
    setVariantProduct(product);
    setSelectedVariants({});
    setProductSearch('');
  };

  const confirmAddProduct = () => {
    if (!variantProduct) return;
    const product = variantProduct;
    const basePrice = product.is_promotion && product.promotion_price ? product.promotion_price : product.price;
    const priceModifier = Object.values(selectedVariants).reduce((sum, v) => sum + (v.price_modifier || 0), 0);
    const finalPrice = basePrice + priceModifier;

    // Créer une clé unique incluant les variantes
    const variantKey = JSON.stringify(selectedVariants);
    const existing = editableItems.find(i => i.product_id === product.id && JSON.stringify(i.selected_variants || {}) === variantKey);

    if (existing) {
      setEditableItems(prev => prev.map(i =>
        (i.product_id === product.id && JSON.stringify(i.selected_variants || {}) === variantKey)
          ? { ...i, quantity: i.quantity + 1 }
          : i
      ));
    } else {
      setEditableItems(prev => [...prev, {
        id: `new_${product.id}_${Date.now()}`,
        product_id: product.id,
        product_name: product.name,
        product_image: product.image_url || '',
        quantity: 1,
        unit_price: finalPrice,
        unit: product.unit || '',
        selected_variants: selectedVariants,
        isNew: true,
      }]);
    }
    setVariantProduct(null);
    setSelectedVariants({});
  };

  const addProductToCart = (product) => {
    // Si le produit a des variantes, ouvrir le sélecteur
    if (product.variants && product.variants.length > 0) {
      openVariantSelector(product);
    } else {
      const basePrice = product.is_promotion && product.promotion_price ? product.promotion_price : product.price;
      const existing = editableItems.find(i => i.product_id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock_quantity) {
          toast.error(`Stock insuffisant (max: ${product.stock_quantity})`);
          return;
        }
        setEditableItems(prev => prev.map(i =>
          i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        ));
      } else {
        setEditableItems(prev => [...prev, {
          id: `new_${product.id}_${Date.now()}`,
          product_id: product.id,
          product_name: product.name,
          product_image: product.image_url || '',
          quantity: 1,
          unit_price: basePrice,
          unit: product.unit || '',
          selected_variants: {},
          isNew: true,
        }]);
      }
      setProductSearch('');
    }
  };

  // Quand le portefeuille couvre tout, sélectionner automatiquement 'wallet'
  React.useEffect(() => {
    if (!validateTarget) return;
    const bal = getWalletBalance(validateTarget.email);
    const total = getCartTotal(editableItems) + (includeDelivery ? deliveryFee : 0);
    if (useWallet && Math.min(bal, total) >= total) {
      setSelectedPaymentMethod('wallet');
    } else if (selectedPaymentMethod === 'wallet') {
      setSelectedPaymentMethod('');
    }
  }, [useWallet, editableItems, includeDelivery, deliveryFee, validateTarget]);

  const handleValidateOrder = async () => {
    if (!validateTarget || editableItems.length === 0) return;
    setValidating(true);
    const { email, user: targetUser } = validateTarget;
    const subtotal = getCartTotal(editableItems);
    const deliveryAmount = includeDelivery ? deliveryFee : 0;
    const total = subtotal + deliveryAmount;

    const walletBalance = getWalletBalance(email);
    const walletUsed = useWallet ? Math.min(walletBalance, total) : 0;
    const amountToPay = Math.max(0, total - walletUsed);

    const createdOrder = await base44.entities.Order.create({
      customer_email: email,
      items: editableItems.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.unit_price * item.quantity,
        selected_variants: item.selected_variants
      })),
      total_amount: total,
      payment_method: amountToPay === 0 ? 'delivery' : selectedPaymentMethod,
      payment_status: (selectedPaymentMethod === 'card' || amountToPay === 0) ? 'completed' : 'pending',
      wallet_amount_used: walletUsed,
      amount_to_pay: amountToPay,
      status: 'confirmed',
      delivery_address: targetUser?.address || '',
      delivery_postal_code: targetUser?.postal_code || '',
      delivery_city: targetUser?.city || '',
      notes: includeDelivery ? '' : 'Frais de livraison offerts par l\'admin'
    });

    // Débiter le portefeuille si utilisé
    if (walletUsed > 0) {
      await base44.entities.WalletTransaction.create({
        customer_email: email,
        amount: walletUsed,
        type: 'debit',
        reason: 'Paiement commande (validé par admin)',
        admin_email: user?.email
      });
    }

    // Vider le panier original
    await Promise.all(validateTarget.items.map(item => base44.entities.CartItem.delete(item.id)));

    // Mettre à jour le stock (avec gestion des variantes)
    await base44.functions.invoke('updateStockAfterOrder', { orderId: createdOrder.id });

    queryClient.invalidateQueries({ queryKey: ['allCartItems'] });
    queryClient.invalidateQueries({ queryKey: ['walletTransactions'] });
    setValidateTarget(null);
    setValidating(false);
    toast.success(`Commande validée pour ${email}`);
  };

  const buildDefaultMessage = (name, items, total) => {
    const itemsList = items.map(i => `- ${i.product_name} (x${i.quantity}) — ${(i.unit_price * i.quantity).toFixed(2)}€`).join('\n');
    return `Bonjour ${name} 👋,\n\nNous avons remarqué que vous avez des articles dans votre panier AfriGo :\n\n${itemsList}\n\nTotal : ${total.toFixed(2)}€\n\nNe laissez pas vos produits s'envoler ! Finalisez votre commande dès maintenant 🛒\n\nhttps://afrigo.app\n\nL'équipe AfriGo`;
  };

  const openReminder = (email, items, mode) => {
    const { name } = getCustomerData(email);
    const total = getCartTotal(items);
    setReminderTarget({ email, items, name });
    setReminderMode(mode);
    setCustomMessage(buildDefaultMessage(name, items, total));
    setSent(false);
  };

  const closeReminder = () => {
    setReminderTarget(null);
    setReminderMode(null);
    setCustomMessage('');
    setSent(false);
  };

  const handleSendEmail = () => {
    const subject = encodeURIComponent('🛒 Votre panier AfriGo vous attend !');
    const body = encodeURIComponent(customMessage);
    window.location.href = `mailto:${reminderTarget.email}?subject=${subject}&body=${body}`;
    setSent(true);
  };

  const handleSendWhatsApp = () => {
    const { phone } = getCustomerData(reminderTarget.email);
    const encoded = encodeURIComponent(customMessage);
    const phoneClean = phone ? phone.replace(/\s+/g, '').replace(/^\+/, '') : '';
    const url = phoneClean
      ? `https://wa.me/${phoneClean}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
    setSent(true);
  };

  // Produits filtrés pour la recherche d'ajout
  const filteredProducts = productSearch.trim().length >= 2
    ? products.filter(p =>
        p.name.toLowerCase().includes(productSearch.toLowerCase()) && p.stock_quantity > 0
      ).slice(0, 6)
    : [];

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => window.history.back()} className="rounded-lg">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-800 mb-1">Paniers clients</h1>
            <p className="text-slate-600">{filteredEntries.length} panier(s) actif(s)</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Rechercher par nom, email ou ID client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>

        {/* Carts */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
          </div>
        ) : filteredEntries.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Aucun panier trouvé</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredEntries.map(([email, items]) => {
              const { name, phone } = getCustomerData(email);
              return (
                <Card key={email} className="overflow-hidden">
                  <div className="bg-slate-50 border-b px-5 py-3 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-orange-500" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{name}</p>
                        <p className="text-xs text-slate-500">{email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-bold text-emerald-600 text-lg">{getCartTotal(items).toFixed(2)}€</p>
                        <Badge variant="secondary" className="text-xs">{items.length} article(s)</Badge>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-lg gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                          onClick={() => openReminder(email, items, 'email')}
                        >
                          <Mail className="w-4 h-4" />
                          <span className="hidden sm:inline">Email</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-lg gap-1 text-green-600 border-green-200 hover:bg-green-50"
                          onClick={() => openReminder(email, items, 'whatsapp')}
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span className="hidden sm:inline">WhatsApp</span>
                        </Button>
                        <Button
                          size="sm"
                          className="rounded-lg gap-1 bg-emerald-500 hover:bg-emerald-600 text-white"
                          onClick={() => openValidate(email, items)}
                        >
                          <ShoppingBag className="w-4 h-4" />
                          <span className="hidden sm:inline">Valider</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {items.map((item) => (
                        <div key={item.id} className="flex items-center gap-4 px-5 py-3">
                          {item.product_image ? (
                            <img src={item.product_image} alt={item.product_name} className="w-12 h-12 object-cover rounded-lg border" />
                          ) : (
                            <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                              <Package className="w-5 h-5 text-slate-400" />
                            </div>
                          )}
                          <div className="flex-1">
                            <p className="font-medium text-slate-800">{item.product_name}</p>
                            {item.selected_variants && Object.keys(item.selected_variants).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {Object.entries(item.selected_variants).map(([key, v]) => (
                                  <Badge key={key} variant="outline" className="text-xs">{v.type}: {v.value}</Badge>
                                ))}
                              </div>
                            )}
                            <p className="text-sm text-slate-500 mt-0.5">{item.quantity} × {item.unit_price?.toFixed(2)}€</p>
                          </div>
                          <p className="font-semibold text-slate-700">{(item.quantity * item.unit_price).toFixed(2)}€</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Validate Order Dialog */}
      <Dialog open={!!validateTarget} onOpenChange={(open) => { if (!open) setValidateTarget(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-emerald-500" />
              Valider la commande
            </DialogTitle>
          </DialogHeader>
          {validateTarget && (
            <div className="space-y-4">
              <div className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
                <span className="font-medium">Client :</span> {getCustomerData(validateTarget.email).name} — {validateTarget.email}
                {(() => {
                  const bal = getWalletBalance(validateTarget.email);
                  if (bal > 0) return <span className="ml-2 text-purple-600 font-medium">· Portefeuille : {bal.toFixed(2)}€</span>;
                  return null;
                })()}
              </div>

              {/* Articles modifiables */}
              <div>
                <p className="text-sm font-semibold text-slate-800 mb-2">Articles</p>
                <div className="border rounded-xl overflow-hidden divide-y">
                  {editableItems.map(item => {
                    const fullProduct = products.find(p => p.id === item.product_id);
                    return (
                      <div key={item.id} className="flex items-center gap-3 px-4 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{item.product_name}</p>
                        <p className="text-xs text-slate-500">{item.unit_price?.toFixed(2)}€/u</p>
                        {item.selected_variants && Object.keys(item.selected_variants).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Object.values(item.selected_variants).map((v, i) => (
                              <span key={i} className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">{v.type}: {v.value}</span>
                            ))}
                          </div>
                        )}
                        {fullProduct?.variants?.length > 0 && (
                          <button
                            onClick={() => {
                              setVariantProduct(fullProduct);
                              // Pré-remplir avec les variantes actuelles
                              setSelectedVariants(item.selected_variants || {});
                              // Stocker l'id de l'item à modifier
                              setVariantProduct({ ...fullProduct, _editingItemId: item.id });
                            }}
                            className="text-xs text-blue-500 hover:text-blue-700 mt-0.5 underline"
                          >
                            Modifier variantes
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateItemQty(item.id, -1)} className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <button onClick={() => updateItemQty(item.id, 1)} className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-sm font-semibold text-slate-700 w-16 text-right">{(item.unit_price * item.quantity).toFixed(2)}€</span>
                      <button onClick={() => removeItem(item.id)} className="w-7 h-7 rounded-full hover:bg-rose-50 flex items-center justify-center text-rose-400 hover:text-rose-600">
                        <Trash2 className="w-3 h-3" />
                      </button>
                      </div>
                    );
                  })}
                  {editableItems.length === 0 && (
                    <div className="px-4 py-6 text-center text-slate-400 text-sm">Aucun article</div>
                  )}
                  <div className="flex justify-between px-4 py-2 bg-slate-50 text-sm font-semibold">
                    <span>Sous-total</span>
                    <span>{getCartTotal(editableItems).toFixed(2)}€</span>
                  </div>
                </div>

                {/* Recherche de produit à ajouter */}
                <div className="mt-2 relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Ajouter un produit par nom..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="pl-9 rounded-xl text-sm"
                    />
                    {productSearch && (
                      <button onClick={() => setProductSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                        <X className="w-4 h-4 text-slate-400" />
                      </button>
                    )}
                  </div>
                  {filteredProducts.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border rounded-xl shadow-lg overflow-hidden">
                      {filteredProducts.map(p => (
                        <button
                          key={p.id}
                          onClick={() => addProductToCart(p)}
                          className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-50 text-left"
                        >
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="w-8 h-8 object-cover rounded" />
                          ) : (
                            <div className="w-8 h-8 bg-slate-100 rounded flex items-center justify-center">
                              <Package className="w-4 h-4 text-slate-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{p.name}</p>
                            <p className="text-xs text-slate-500">{p.is_promotion && p.promotion_price ? p.promotion_price : p.price}€</p>
                          </div>
                          <Plus className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Frais de livraison */}
              <div className="flex items-center justify-between p-4 border rounded-xl">
                <div className="flex items-center gap-3">
                  <Truck className="w-4 h-4 text-slate-500" />
                  <div>
                    <p className="font-medium text-slate-800 text-sm">Inclure frais de livraison</p>
                    <p className="text-xs text-slate-500">Décochez pour offrir la livraison</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {includeDelivery && (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={deliveryFee}
                        onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                        className="w-20 h-8 text-sm"
                      />
                      <span className="text-sm text-slate-500">€</span>
                    </div>
                  )}
                  <Switch checked={includeDelivery} onCheckedChange={setIncludeDelivery} />
                </div>
              </div>

              {/* Portefeuille disponible */}
              {(() => {
                const bal = getWalletBalance(validateTarget.email);
                const total = getCartTotal(editableItems) + (includeDelivery ? deliveryFee : 0);
                const walletApplied = useWallet ? Math.min(bal, total) : 0;
                const remaining = Math.max(0, total - walletApplied);
                if (bal <= 0) return null;
                return (
                  <div className="p-4 border-2 border-purple-200 bg-purple-50 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-semibold text-purple-800">Utiliser le solde portefeuille</span>
                        <span className="text-xs bg-purple-200 text-purple-700 px-2 py-0.5 rounded-full font-medium">{bal.toFixed(2)}€ disponible</span>
                      </div>
                      <Switch checked={useWallet} onCheckedChange={setUseWallet} />
                    </div>
                    {useWallet && (
                      <div className="text-sm text-purple-700 space-y-1 pt-1 border-t border-purple-200">
                        <div className="flex justify-between">
                          <span>Déduit du portefeuille</span>
                          <span className="font-semibold">− {walletApplied.toFixed(2)}€</span>
                        </div>
                        <div className="flex justify-between font-bold">
                          <span>Reste à payer</span>
                          <span className={remaining === 0 ? 'text-emerald-600' : 'text-slate-800'}>{remaining.toFixed(2)}€</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Total */}
              {(() => {
                const bal = getWalletBalance(validateTarget.email);
                const total = getCartTotal(editableItems) + (includeDelivery ? deliveryFee : 0);
                const walletApplied = useWallet ? Math.min(bal, total) : 0;
                const remaining = Math.max(0, total - walletApplied);
                return (
                  <div className="flex justify-between items-center px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <span className="font-semibold text-slate-800">Total commande</span>
                    <div className="text-right">
                      {useWallet && walletApplied > 0 && (
                        <p className="text-xs text-slate-400 line-through">{total.toFixed(2)}€</p>
                      )}
                      <span className="text-xl font-bold text-emerald-600">{remaining.toFixed(2)}€</span>
                    </div>
                  </div>
                );
              })()}

              {/* Mode de paiement */}
              {(() => {
                const bal = getWalletBalance(validateTarget.email);
                const total = getCartTotal(editableItems) + (includeDelivery ? deliveryFee : 0);
                const walletApplied = useWallet ? Math.min(bal, total) : 0;
                const remaining = Math.max(0, total - walletApplied);
                // Si le portefeuille couvre tout, pas besoin d'autre mode
                if (useWallet && remaining === 0) {
                  return (
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                      <p className="text-sm font-medium text-emerald-700">Commande entièrement couverte par le portefeuille</p>
                    </div>
                  );
                }
                return (
                  <div>
                    <p className="text-sm font-semibold text-slate-800 mb-2">Mode de paiement {remaining > 0 && <span className="text-rose-500">*</span>}</p>
                    <div className="grid gap-2">
                      {[
                        { value: 'delivery', label: 'Paiement à la livraison', sub: 'Espèces ou carte au livreur', icon: Banknote, color: 'emerald' },
                        { value: 'card', label: 'Carte bancaire', sub: 'Paiement déjà effectué', icon: CreditCard, color: 'blue' },
                      ].map(({ value, label, sub, icon: Icon, color }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setSelectedPaymentMethod(value)}
                          className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                            selectedPaymentMethod === value
                              ? `border-${color}-500 bg-${color}-50`
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                            selectedPaymentMethod === value ? `bg-${color}-100` : 'bg-slate-100'
                          }`}>
                            <Icon className={`w-4 h-4 ${selectedPaymentMethod === value ? `text-${color}-600` : 'text-slate-500'}`} />
                          </div>
                          <div>
                            <p className="font-medium text-slate-800 text-sm">{label}</p>
                            <p className="text-xs text-slate-500">{sub}</p>
                          </div>
                          {selectedPaymentMethod === value && (
                            <CheckCircle className={`w-4 h-4 text-${color}-500 ml-auto`} />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setValidateTarget(null)} className="flex-1 rounded-xl">
                  Annuler
                </Button>
                <Button
                  onClick={handleValidateOrder}
                  disabled={validating || editableItems.length === 0 || (() => {
                    const bal = getWalletBalance(validateTarget?.email);
                    const total = getCartTotal(editableItems) + (includeDelivery ? deliveryFee : 0);
                    const remaining = Math.max(0, total - (useWallet ? Math.min(bal, total) : 0));
                    return remaining > 0 && !selectedPaymentMethod;
                  })()}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 rounded-xl"
                >
                  {validating ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  ) : (
                    <ShoppingBag className="w-4 h-4 mr-2" />
                  )}
                  Confirmer la commande
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Variant Selector Dialog */}
      <Dialog open={!!variantProduct} onOpenChange={(open) => { if (!open) { setVariantProduct(null); setSelectedVariants({}); } }}>
        <DialogContent className="max-w-sm max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-4 h-4 text-orange-500" />
              {variantProduct?.name}
            </DialogTitle>
          </DialogHeader>
          {variantProduct && (() => {
            // Grouper les variantes par type
            const variantGroups = (variantProduct.variants || []).reduce((acc, v) => {
              if (!acc[v.type]) acc[v.type] = [];
              acc[v.type].push(v);
              return acc;
            }, {});
            const isEditing = !!variantProduct._editingItemId;
            const basePrice = variantProduct.is_promotion && variantProduct.promotion_price ? variantProduct.promotion_price : variantProduct.price;
            const priceModifier = Object.values(selectedVariants).reduce((sum, v) => sum + (v.price_modifier || 0), 0);
            const finalPrice = basePrice + priceModifier;

            return (
              <div className="space-y-4">
                {variantProduct.image_url && (
                  <img src={variantProduct.image_url} alt={variantProduct.name} className="w-full h-36 object-cover rounded-xl" />
                )}
                <p className="text-lg font-bold text-emerald-600 text-center">{finalPrice.toFixed(2)}€</p>
                {Object.entries(variantGroups).map(([type, variants]) => (
                  <div key={type}>
                    <p className="text-sm font-semibold text-slate-700 mb-2 capitalize">{type}</p>
                    <div className="flex flex-wrap gap-2">
                      {variants.map((v, i) => {
                        const isSelected = selectedVariants[type]?.value === v.value;
                        return (
                          <button
                            key={i}
                            onClick={() => {
                              if (isSelected) {
                                // Décocher
                                const updated = { ...selectedVariants };
                                delete updated[type];
                                setSelectedVariants(updated);
                              } else {
                                setSelectedVariants(prev => ({ ...prev, [type]: { type, value: v.value, price_modifier: v.price_modifier || 0 } }));
                              }
                            }}
                            className={`px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition-all ${
                              isSelected
                                ? 'border-orange-500 bg-orange-50 text-orange-700'
                                : 'border-slate-200 hover:border-slate-300 text-slate-700'
                            }`}
                          >
                            {v.type === 'couleur' && v.color_code && (
                              <span className="inline-block w-3 h-3 rounded-full mr-1 border" style={{ backgroundColor: v.color_code }} />
                            )}
                            {v.value}
                            {v.price_modifier && v.price_modifier !== 0 && (
                              <span className="ml-1 text-xs opacity-70">{v.price_modifier > 0 ? '+' : ''}{v.price_modifier}€</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={() => { setVariantProduct(null); setSelectedVariants({}); }} className="flex-1 rounded-xl">
                    Annuler
                  </Button>
                  <Button
                    onClick={() => {
                      if (isEditing) {
                        // Modifier l'article existant
                        const priceModifier = Object.values(selectedVariants).reduce((sum, v) => sum + (v.price_modifier || 0), 0);
                        const finalPrice = basePrice + priceModifier;
                        setEditableItems(prev => prev.map(i =>
                          i.id === variantProduct._editingItemId
                            ? { ...i, selected_variants: selectedVariants, unit_price: finalPrice }
                            : i
                        ));
                        setVariantProduct(null);
                        setSelectedVariants({});
                      } else {
                        confirmAddProduct();
                      }
                    }}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 rounded-xl"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    {isEditing ? 'Appliquer' : 'Ajouter'}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Reminder Dialog */}
      <Dialog open={!!reminderTarget} onOpenChange={(open) => { if (!open) closeReminder(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {reminderMode === 'email' ? (
                <><Mail className="w-5 h-5 text-blue-500" /> Rappel par email</>
              ) : (
                <><MessageCircle className="w-5 h-5 text-green-500" /> Rappel par WhatsApp</>
              )}
            </DialogTitle>
          </DialogHeader>

          {sent ? (
            <div className="py-8 flex flex-col items-center gap-3 text-center">
              <CheckCircle className="w-12 h-12 text-emerald-500" />
              <p className="font-semibold text-slate-800">
                {reminderMode === 'email' ? 'Email envoyé avec succès !' : 'WhatsApp ouvert !'}
              </p>
              <p className="text-sm text-slate-500">Le client {reminderTarget?.name} a été contacté.</p>
              <Button onClick={closeReminder} className="mt-2 rounded-xl">Fermer</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
                <span className="font-medium">Destinataire :</span> {reminderTarget?.name} — {reminderTarget?.email}
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Message (modifiable)</label>
                <Textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={10}
                  className="text-sm rounded-xl resize-none"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={closeReminder} className="rounded-xl">Annuler</Button>
                {reminderMode === 'email' ? (
                  <Button
                    onClick={handleSendEmail}
                    disabled={sending || !customMessage.trim()}
                    className="bg-blue-600 hover:bg-blue-700 rounded-xl gap-2"
                  >
                    {sending ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Envoyer l'email
                  </Button>
                ) : (
                  <Button
                    onClick={handleSendWhatsApp}
                    disabled={!customMessage.trim()}
                    className="bg-green-600 hover:bg-green-700 rounded-xl gap-2"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Ouvrir WhatsApp
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}