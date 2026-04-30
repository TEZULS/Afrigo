import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, Trash2, ShoppingBag, ArrowRight, Tag, ArrowLeft, Gift, AlertCircle, Truck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

export default function CartDrawer({ open, onClose, items, onUpdateQuantity, onRemove, total, user, guestCart, setGuestCart }) {
  const [selectedItems, setSelectedItems] = useState(new Set());
  
  // Récupérer tous les produits pour vérifier les produits gratuits
  const { data: allProducts = [] } = useQuery({
    queryKey: ['all-products'],
    queryFn: () => base44.entities.Product.list(),
    enabled: open,
    refetchInterval: open ? 30000 : false, // Rafraîchir toutes les 30s quand le panier est ouvert
  });

  // Récupérer les réclamations de produits gratuits du client
  const { data: freeProductClaims = [] } = useQuery({
    queryKey: ['free-product-claims', user?.email],
    queryFn: () => base44.entities.FreeProductClaim.filter({ customer_email: user.email }),
    enabled: open && !!user
  });

  // Récupérer les zones de livraison pour afficher les frais corrects
  const { data: deliveryZones = [] } = useQuery({
    queryKey: ['delivery-zones'],
    queryFn: () => base44.entities.DeliveryZone.list(),
    enabled: open
  });

  // Fonction pour normaliser les noms de villes
  const normalizeCity = (city) => {
    if (!city) return '';
    return city
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/gi, '')
      .toLowerCase()
      .trim();
  };

  // Trouver la zone de livraison du client
  const findUserDeliveryZone = () => {
    if (!user) return null;
    
    const userPostalCode = user.postal_code?.trim();
    const userCity = normalizeCity(user.city);
    
    return deliveryZones.find(zone => {
      if (!zone.is_active) return false;
      
      // Vérifier le code postal
      if (userPostalCode && zone.postal_codes?.includes(userPostalCode)) {
        return true;
      }
      
      // Vérifier la ville normalisée
      if (userCity && zone.cities) {
        const normalizedZoneCities = zone.cities.map(c => normalizeCity(c));
        if (normalizedZoneCities.includes(userCity)) {
          return true;
        }
      }
      
      return false;
    });
  };

  const userDeliveryZone = findUserDeliveryZone();

  // Migrer le panier invité vers la base de données lors de la connexion
  const hasMigrated = React.useRef(false);
  React.useEffect(() => {
    if (hasMigrated.current) return;
    const migrateGuestCart = async () => {
      if (user && guestCart && guestCart.length > 0) {
        hasMigrated.current = true;
        try {
          for (const item of guestCart) {
            const existingItems = await base44.entities.CartItem.filter({
              customer_email: user.email,
              product_id: item.product_id
            });
            
            if (existingItems.length > 0) {
              await base44.entities.CartItem.update(existingItems[0].id, {
                quantity: existingItems[0].quantity + item.quantity
              });
            } else {
              await base44.entities.CartItem.create({
                customer_email: user.email,
                product_id: item.product_id,
                product_name: item.product_name,
                product_image: item.product_image,
                quantity: item.quantity,
                unit_price: item.unit_price,
                unit: item.unit
              });
            }
          }
          localStorage.removeItem('guestCart');
          if (setGuestCart) setGuestCart([]);
        } catch (error) {
          console.error('Erreur lors de la migration du panier:', error);
        }
      }
    };
    migrateGuestCart();
  }, [user?.email]);

  // Sélectionner automatiquement tous les articles (sauf ceux en rupture de stock)
  React.useEffect(() => {
    const inStockIds = items
      .filter(item => {
        const product = allProducts.find(p => p.id === item.product_id);
        if (!product) return true;
        return product.stock_quantity > 0;
      })
      .map(item => item.id);
    setSelectedItems(new Set(inStockIds));
  }, [items.length, allProducts.length]);

  // Articles en rupture de stock
  const outOfStockIds = new Set(
    items
      .filter(item => {
        const product = allProducts.find(p => p.id === item.product_id);
        return product && product.stock_quantity <= 0;
      })
      .map(item => item.id)
  );

  const toggleSelectAll = () => {
    const inStockIds = items.filter(item => !outOfStockIds.has(item.id)).map(item => item.id);
    if (selectedItems.size === inStockIds.length && inStockIds.length > 0) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(inStockIds));
    }
  };

  const toggleItem = (itemId) => {
    if (outOfStockIds.has(itemId)) return; // impossible de sélectionner un article en rupture
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleRemoveSelected = () => {
    selectedItems.forEach(itemId => onRemove(itemId));
    setSelectedItems(new Set());
  };

  const selectedItemsData = items.filter(item => selectedItems.has(item.id));
  
  // Séparer les produits gratuits et payants
  const freeItems = selectedItemsData.filter(item => {
    const product = allProducts.find(p => p.id === item.product_id);
    return product?.is_free;
  });
  
  const paidItems = selectedItemsData.filter(item => {
    const product = allProducts.find(p => p.id === item.product_id);
    return !product?.is_free;
  });
  
  const paidTotal = paidItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  const selectedTotal = selectedItemsData.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  
  // Vérifier les conditions pour les produits gratuits
  const freeProductErrors = freeItems.map(item => {
    const product = allProducts.find(p => p.id === item.product_id);
    if (!product) return null;
    
    const minPurchase = product.free_product_min_purchase || 15;
    const limitPerCustomer = product.free_product_limit_per_customer || 1;
    const claimed = freeProductClaims.filter(c => c.product_id === product.id).length;
    
    const errors = [];
    if (paidTotal < minPurchase) {
      errors.push(`Achat minimum: ${minPurchase}€ (actuel: ${paidTotal.toFixed(2)}€)`);
    }
    if (item.quantity + claimed > limitPerCustomer) {
      errors.push(`Limite: ${limitPerCustomer} par client (déjà réclamé: ${claimed})`);
    }
    
    return errors.length > 0 ? { item, product, errors } : null;
  }).filter(Boolean);
  
  // Afficher les frais de livraison
  const hasAddress = user && user.address && user.postal_code && user.city;
  const activeZone = hasAddress ? userDeliveryZone : null;
  const FREE_DELIVERY_THRESHOLD = activeZone?.free_delivery_threshold ?? 29;
  const DELIVERY_FEE = activeZone?.delivery_fee ?? 5;
  const deliveryFee = activeZone && paidTotal >= FREE_DELIVERY_THRESHOLD ? 0 : (activeZone ? DELIVERY_FEE : 0);
  const finalTotal = paidTotal + deliveryFee;

  // Trouver la meilleure zone active pour afficher les infos livraison à tous
  const bestZone = deliveryZones.find(z => z.is_active) || deliveryZones[0];
  const minFreeDelivery = bestZone?.free_delivery_threshold;
  const minDeliveryFee = bestZone?.delivery_fee;
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="p-6 pb-4">
          <SheetTitle className="flex items-center gap-3 text-xl">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-10 w-10 rounded-xl"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 128, 0, 0.1)' }}>
              <ShoppingBag className="w-5 h-5" style={{ color: '#008000' }} />
            </div>
            Mon Panier
            <span className="ml-auto text-sm font-normal text-slate-500">
              {items.length} article{items.length > 1 ? 's' : ''}
            </span>
          </SheetTitle>
          {items.length > 0 && (
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedItems.size === items.length && items.length > 0}
                  onCheckedChange={toggleSelectAll}
                  id="select-all"
                />
                <label
                  htmlFor="select-all"
                  className="text-sm text-slate-600 cursor-pointer"
                >
                  Tout sélectionner ({selectedItems.size}/{items.length})
                </label>
              </div>
              {selectedItems.size > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveSelected}
                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 md:h-10 md:px-4 md:font-semibold"
                >
                  <Trash2 className="w-4 h-4 md:w-5 md:h-5 mr-2" />
                  Supprimer ({selectedItems.size})
                </Button>
              )}
            </div>
          )}
        </SheetHeader>

        <Separator />

        <ScrollArea className="flex-1 px-6">
          <AnimatePresence mode="popLayout">
            {items.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-16 text-center"
              >
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <ShoppingBag className="w-10 h-10 text-slate-300" />
                </div>
                <p className="text-slate-500 font-medium">Votre panier est vide</p>
                <p className="text-sm text-slate-400 mt-1">Ajoutez des produits pour commencer</p>
              </motion.div>
            ) : (
              <div className="py-2 space-y-1.5">
                {items.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className={`flex gap-2 p-1.5 rounded-xl transition-all ${
                      selectedItems.has(item.id) 
                        ? 'border border-transparent' 
                        : 'bg-slate-50 border border-transparent'
                    }`}
                    style={selectedItems.has(item.id) ? { backgroundColor: 'rgba(0, 128, 0, 0.1)', borderColor: 'rgba(0, 128, 0, 0.3)' } : {}}
                  >
                    <div className="flex items-start pt-1">
                      <Checkbox
                        checked={selectedItems.has(item.id)}
                        onCheckedChange={() => toggleItem(item.id)}
                        id={`item-${item.id}`}
                      />
                    </div>
                    
                    <Link 
                      to={createPageUrl('ProductDetails') + `?id=${item.product_id}&fromCart=true`}
                      onClick={onClose}
                      className="w-12 h-12 rounded-lg overflow-hidden bg-white flex-shrink-0 hover:opacity-80 transition-opacity"
                    >
                      <img
                        src={item.product_image || 'https://images.unsplash.com/photo-1543168256-418811576931?w=200'}
                        alt={item.product_name}
                        className="w-full h-full object-cover"
                      />
                    </Link>
                    
                    <div className="flex-1 min-w-0">
                      <Link 
                        to={createPageUrl('ProductDetails') + `?id=${item.product_id}&fromCart=true`}
                        onClick={onClose}
                        className="hover:text-emerald-600 transition-colors"
                      >
                        <h4 className={`font-medium text-sm truncate ${outOfStockIds.has(item.id) ? 'text-slate-400' : 'text-slate-800'}`}>
                          {item.product_name}
                        </h4>
                        {outOfStockIds.has(item.id) && (
                          <span className="text-xs font-bold text-rose-600">Épuisé</span>
                        )}
                      </Link>
                      {item.selected_variants && Object.keys(item.selected_variants).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {Object.entries(item.selected_variants).map(([key, variant]) => (
                            <span key={key} className="text-xs bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                              {variant.type}: {variant.value}
                            </span>
                          ))}
                        </div>
                      )}
                      {(() => {
                        const product = allProducts.find(p => p.id === item.product_id);
                        return product?.is_free ? (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Badge className="bg-emerald-100 text-emerald-700 text-xs py-0 px-1.5">
                              <Gift className="w-2.5 h-2.5 mr-0.5" />
                              Gratuit
                            </Badge>
                          </div>
                        ) : (
                          <p className="text-xs font-medium mt-0.5" style={{ color: '#008000' }}>
                            {item.unit_price?.toFixed(2)}€
                          </p>
                        );
                      })()}
                      
                      <div className="flex items-center justify-between mt-1.5 gap-1">
                        <div className="flex items-center gap-0.5 bg-white rounded-md p-0.5 shadow-sm">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded touch-manipulation"
                          onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-6 text-center text-xs font-semibold">
                          {item.quantity}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded touch-manipulation"
                          onClick={() => {
                            const product = allProducts.find(p => p.id === item.product_id);
                            const maxStock = product?.stock_quantity ?? Infinity;
                            if (item.quantity < maxStock) {
                              onUpdateQuantity(item.id, item.quantity + 1);
                            }
                          }}
                          disabled={(() => {
                            const product = allProducts.find(p => p.id === item.product_id);
                            return product ? item.quantity >= product.stock_quantity : false;
                          })()}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-slate-800 text-xs">
                            {(item.unit_price * item.quantity).toFixed(2)}€
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-rose-500 hover:text-rose-600 hover:bg-rose-50 touch-manipulation"
                            onClick={() => onRemove(item.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </ScrollArea>

        {items.length > 0 && (
          <>
            <Separator />
            <SheetFooter className="p-4 md:p-6 pt-3 md:pt-4 block space-y-3 md:space-y-4">
              {/* Infos livraison toujours visibles dès qu'il y a des articles */}
              {selectedItems.size === 0 ? (
                <div className="space-y-3">
                  {/* Message sélection */}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg md:rounded-xl p-4 md:p-5 text-center">
                    <p className="text-amber-700 text-sm md:text-base font-medium md:font-semibold">
                      Sélectionnez au moins un article pour commander
                    </p>
                  </div>
                  {/* Infos livraison même sans sélection */}
                  {bestZone && (
                    <div className="space-y-2">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 md:p-3 flex items-center gap-2">
                        <Tag className="w-3 h-3 md:w-4 md:h-4 text-blue-600 flex-shrink-0" />
                        <p className="text-xs md:text-sm text-blue-700">
                          Livraison gratuite dès <strong>{bestZone.free_delivery_threshold}€</strong> d'achat
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {outOfStockIds.size > 0 && (
                    <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-rose-700">
                        <strong>{outOfStockIds.size} article{outOfStockIds.size > 1 ? 's' : ''} en rupture de stock</strong> — retirez-les de votre panier pour commander.
                      </p>
                    </div>
                  )}
                  {freeProductErrors.length > 0 && (
                    <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2 text-rose-700 font-semibold text-sm">
                        <AlertCircle className="w-4 h-4" />
                        Produits gratuits non éligibles
                      </div>
                      {freeProductErrors.map((error, idx) => (
                        <div key={idx} className="text-xs text-rose-600 pl-6">
                          <strong>{error.product.name}:</strong>
                          <ul className="list-disc pl-4 mt-1">
                            {error.errors.map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {freeItems.length > 0 && (
                    <div className="flex justify-between items-center text-emerald-600">
                      <span className="text-sm md:text-base md:font-medium flex items-center gap-1">
                        <Gift className="w-4 h-4" />
                        Produits gratuits
                      </span>
                      <span className="font-semibold md:font-bold">0.00€</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm md:text-base text-slate-600 md:font-medium">Sous-total ({paidItems.length} article{paidItems.length > 1 ? 's' : ''})</span>
                    <span className="font-semibold md:font-bold md:text-lg">{paidTotal.toFixed(2)}€</span>
                  </div>
                  {!hasAddress ? (
                    <>
                      {/* Infos livraison visibles même sans adresse */}
                      {bestZone && (
                        <div className="space-y-2">
                          {minFreeDelivery && paidTotal < minFreeDelivery ? (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 md:p-3 flex items-center gap-2">
                              <Tag className="w-3 h-3 md:w-4 md:h-4 text-blue-600 flex-shrink-0" />
                              <p className="text-xs md:text-sm text-blue-700">
                                Plus que <strong>{(minFreeDelivery - paidTotal).toFixed(2)}€</strong> pour la livraison gratuite
                              </p>
                            </div>
                          ) : minFreeDelivery && paidTotal >= minFreeDelivery ? (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 md:p-3 flex items-center gap-2">
                              <Truck className="w-3 h-3 md:w-4 md:h-4 text-emerald-600 flex-shrink-0" />
                              <p className="text-xs md:text-sm text-emerald-700 font-medium">
                                🎉 Vous bénéficiez de la livraison gratuite !
                              </p>
                            </div>
                          ) : null}
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 md:p-3 flex items-center gap-2">
                            <Truck className="w-3 h-3 md:w-4 md:h-4 text-amber-600 flex-shrink-0" />
                            <p className="text-xs md:text-sm text-amber-700">
                              Ajoutez votre adresse dans votre profil pour calculer les frais exacts
                            </p>
                          </div>
                        </div>
                      )}
                      {!bestZone && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 md:p-3 flex items-center gap-2">
                          <Truck className="w-3 h-3 md:w-4 md:h-4 text-amber-600 flex-shrink-0" />
                          <p className="text-xs md:text-sm text-amber-700 md:font-medium">
                            Ajoutez votre adresse de livraison pour voir les frais
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-sm md:text-base text-slate-600 md:font-medium">Livraison</span>
                        {deliveryFee === 0 ? (
                          <span className="font-medium md:font-bold text-sm md:text-base" style={{ color: '#008000' }}>Gratuite 🎉</span>
                        ) : (
                          <span className="font-semibold md:font-bold text-sm md:text-lg">{deliveryFee.toFixed(2)}€</span>
                        )}
                      </div>
                      
                      {activeZone && paidTotal < FREE_DELIVERY_THRESHOLD && deliveryFee > 0 && (
                        <div className="bg-blue-50 border border-blue-200 md:border-2 rounded-lg md:rounded-xl p-2 md:p-3 flex items-center gap-2">
                          <Tag className="w-3 h-3 md:w-4 md:h-4 text-blue-600 flex-shrink-0" />
                          <p className="text-xs md:text-sm text-blue-700 md:font-medium">
                            Plus que <strong>{(FREE_DELIVERY_THRESHOLD - paidTotal).toFixed(2)}€</strong> pour la livraison gratuite
                          </p>
                        </div>
                      )}
                      {deliveryFee === 0 && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 flex items-center gap-2">
                          <Truck className="w-3 h-3 md:w-4 md:h-4 text-emerald-600 flex-shrink-0" />
                          <p className="text-xs text-emerald-700 font-medium">
                            Livraison offerte dès {FREE_DELIVERY_THRESHOLD}€ d'achat ✓
                          </p>
                        </div>
                      )}
                    </>
                  )}
                  
                  <div className="flex justify-between items-center pt-2 md:pt-3 border-t md:border-t-2">
                    <span className="font-semibold md:font-bold md:text-lg">Total</span>
                    <span className="text-xl md:text-2xl font-bold" style={{ color: '#008000' }}>{finalTotal.toFixed(2)}€</span>
                  </div>
                  
                  <Link to={createPageUrl('Checkout')} onClick={onClose}>
                    <Button 
                      disabled={freeProductErrors.length > 0 || outOfStockIds.size > 0}
                      style={{ backgroundColor: (freeProductErrors.length > 0 || outOfStockIds.size > 0) ? '#94a3b8' : '#008000' }}
                      className="w-full h-12 md:h-16 hover:opacity-90 text-white rounded-xl font-semibold md:font-bold md:text-xl touch-manipulation shadow-lg md:shadow-xl transition-all hover:scale-[1.02] disabled:cursor-not-allowed"
                    >
                      Commander ({selectedItems.size})
                      <ArrowRight className="w-4 h-4 md:w-6 md:h-6 ml-2" />
                    </Button>
                  </Link>
                </>
              )}
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}