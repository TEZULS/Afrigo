import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { ArrowLeft, ShoppingCart, Minus, Plus, Star, Package, Truck, MapPin, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import ProductCard from '@/components/products/ProductCard';
import ProductReviews from '@/components/reviews/ProductReviews';
import { toast } from 'sonner';

const categoryLabels = {
  fruits_legumes: 'Fruits & Légumes',
  viandes_poissons: 'Viandes & Poissons',
  produits_laitiers: 'Produits Laitiers',
  epicerie: 'Épicerie',
  boissons: 'Boissons',
  surgeles: 'Surgelés',
  hygiene: 'Hygiène',
  entretien: 'Entretien'
};

const countries = {
  FR: { name: 'France', flag: '🇫🇷' },
  CM: { name: 'Cameroun', flag: '🇨🇲' },
  CI: { name: 'Côte d\'Ivoire', flag: '🇨🇮' },
  SN: { name: 'Sénégal', flag: '🇸🇳' },
  ML: { name: 'Mali', flag: '🇲🇱' },
  BJ: { name: 'Bénin', flag: '🇧🇯' },
  TG: { name: 'Togo', flag: '🇹🇬' },
  BF: { name: 'Burkina Faso', flag: '🇧🇫' },
  NE: { name: 'Niger', flag: '🇳🇪' },
  TD: { name: 'Tchad', flag: '🇹🇩' },
  CG: { name: 'Congo', flag: '🇨🇬' },
  CD: { name: 'RD Congo', flag: '🇨🇩' },
  GA: { name: 'Gabon', flag: '🇬🇦' },
  GN: { name: 'Guinée', flag: '🇬🇳' },
  MA: { name: 'Maroc', flag: '🇲🇦' },
  TN: { name: 'Tunisie', flag: '🇹🇳' },
  DZ: { name: 'Algérie', flag: '🇩🇿' },
  EG: { name: 'Égypte', flag: '🇪🇬' },
  NG: { name: 'Nigeria', flag: '🇳🇬' },
  GH: { name: 'Ghana', flag: '🇬🇭' },
  KE: { name: 'Kenya', flag: '🇰🇪' },
  ET: { name: 'Éthiopie', flag: '🇪🇹' },
  ZA: { name: 'Afrique du Sud', flag: '🇿🇦' },
  ES: { name: 'Espagne', flag: '🇪🇸' },
  IT: { name: 'Italie', flag: '🇮🇹' },
  PT: { name: 'Portugal', flag: '🇵🇹' },
  BE: { name: 'Belgique', flag: '🇧🇪' },
  NL: { name: 'Pays-Bas', flag: '🇳🇱' },
  DE: { name: 'Allemagne', flag: '🇩🇪' },
  GB: { name: 'Royaume-Uni', flag: '🇬🇧' },
  BR: { name: 'Brésil', flag: '🇧🇷' },
  US: { name: 'États-Unis', flag: '🇺🇸' },
  CN: { name: 'Chine', flag: '🇨🇳' },
  IN: { name: 'Inde', flag: '🇮🇳' },
  TH: { name: 'Thaïlande', flag: '🇹🇭' },
  VN: { name: 'Vietnam', flag: '🇻🇳' },
  MX: { name: 'Mexique', flag: '🇲🇽' },
  AR: { name: 'Argentine', flag: '🇦🇷' },
  CO: { name: 'Colombie', flag: '🇨🇴' },
  OTHER: { name: 'Autre', flag: '🌍' },
};

export default function ProductDetails() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [selectedVariants, setSelectedVariants] = useState({});
  const [showVariantError, setShowVariantError] = useState(false);
  const [guestCart, setGuestCart] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id');
  const fromCart = urlParams.get('fromCart') === 'true';

  useEffect(() => {
    base44.auth.me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
    
    const saved = localStorage.getItem('guestCart');
    if (saved) {
      setGuestCart(JSON.parse(saved));
    }
  }, []);

  const prevProductId = React.useRef(null);

  useEffect(() => {
    if (productId) {
      if (prevProductId.current && prevProductId.current !== productId) {
        // On change de produit : sauvegarder la position du produit qu'on quitte
        sessionStorage.setItem(`scrollPos:/ProductDetails?id=${prevProductId.current}`, window.scrollY.toString());
      }

      // Réinitialiser l'état quand le produit change
      setQuantity(1);
      setSelectedImage(0);
      setCurrentImageIndex(0);
      setSelectedVariants({});
      setShowVariantError(false);

      // Restaurer la position si on revient sur ce produit
      const savedPos = sessionStorage.getItem(`scrollPos:/ProductDetails?id=${productId}`);
      if (savedPos !== null) {
        const pos = parseInt(savedPos, 10);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.scrollTo({ top: pos, behavior: 'instant' });
          });
        });
      } else {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }

      prevProductId.current = productId;
    }
  }, [productId]);
  
  const handleVariantSelect = (variant) => {
    // Si la variante est déjà sélectionnée, la décocher
    const currentVariant = Object.values(selectedVariants)[0];
    if (currentVariant?.value === variant.value) {
      setSelectedVariants({});
      // Revenir à l'image principale
      setSelectedImage(0);
      return;
    }
    
    // Sinon, remplacer toutes les variantes par celle-ci (une seule à la fois)
    setSelectedVariants({ single: variant });
    
    // Si la variante a une image, afficher cette image en grand
    if (variant.image_url) {
      const productImages = [product.image_url, ...(product.images || [])];
      const variantImageIndex = productImages.findIndex(img => img === variant.image_url);
      
      if (variantImageIndex !== -1) {
        setSelectedImage(variantImageIndex);
      } else {
        // Si l'image n'est pas dans la galerie, l'ajouter temporairement
        const newIndex = productImages.length;
        setSelectedImage(newIndex);
      }
    } else {
      // Variante sans image : revenir à l'image principale
      setSelectedImage(0);
    }
  };

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => base44.entities.Product.filter({ id: productId }),
    enabled: !!productId
  });

  const product = products[0];

  const { data: allProducts = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list()
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['reviews', productId],
    queryFn: () => base44.entities.Review.filter({ product_id: productId }),
    enabled: !!productId
  });

  const { data: deliveryZones = [] } = useQuery({
    queryKey: ['deliveryZones'],
    queryFn: () => base44.entities.DeliveryZone.list()
  });

  // Trouver la zone de livraison de l'utilisateur
  const userDeliveryZone = user?.postal_code 
    ? deliveryZones.find(zone => zone.postal_codes?.includes(user.postal_code))
    : null;

  const { data: cartItems = [] } = useQuery({
    queryKey: ['cart', user?.email],
    queryFn: () => base44.entities.CartItem.filter({ customer_email: user?.email }),
    enabled: !!user?.email
  });

  // Helper function to compare variants
  const variantsMatch = (variants1, variants2) => {
    if (!variants1 && !variants2) return true;
    if (!variants1 || !variants2) return false;
    const keys1 = Object.keys(variants1).sort();
    const keys2 = Object.keys(variants2).sort();
    if (keys1.length !== keys2.length) return false;
    return keys1.every(key => variants1[key]?.value === variants2[key]?.value);
  };

  const addToCartMutation = useMutation({
    mutationFn: async () => {
      const currentPrice = product.is_promotion && product.promotion_price ? product.promotion_price : product.price;

      // Calculate price with variants
      let finalPrice = currentPrice;
      Object.values(selectedVariants).forEach(variant => {
        if (variant?.price_modifier) {
          finalPrice += variant.price_modifier;
        }
      });

      const variantsToSave = Object.keys(selectedVariants).length > 0 ? selectedVariants : null;

      if (!user) {
        // Panier invité - comparer product_id ET variantes
        const existingItem = guestCart.find(item => 
          item.product_id === product.id && variantsMatch(item.selected_variants, variantsToSave)
        );
        let updated;
        if (existingItem) {
          const newQty = Math.min(product.stock_quantity, existingItem.quantity + quantity);
          updated = guestCart.map(item =>
            item.id === existingItem.id
              ? { ...item, quantity: newQty }
              : item
          );
        } else {
          updated = [...guestCart, {
            id: `guest-${Date.now()}-${Math.random()}`,
            product_id: product.id,
            product_name: product.name,
            product_image: product.image_url,
            quantity: quantity,
            unit_price: finalPrice,
            unit: product.unit,
            selected_variants: variantsToSave
          }];
        }
        setGuestCart(updated);
        localStorage.setItem('guestCart', JSON.stringify(updated));
        return { success: true };
      }

      // Utilisateur connecté - comparer product_id ET variantes
      const existingItem = cartItems.find(item => 
        item.product_id === product.id && variantsMatch(item.selected_variants, variantsToSave)
      );
      if (existingItem) {
        const newQty = Math.min(product.stock_quantity, existingItem.quantity + quantity);
        return base44.entities.CartItem.update(existingItem.id, {
          quantity: newQty
        });
      } else {
        return base44.entities.CartItem.create({
          customer_email: user.email,
          product_id: product.id,
          product_name: product.name,
          product_image: product.image_url,
          quantity: quantity,
          unit_price: finalPrice,
          unit: product.unit,
          selected_variants: variantsToSave
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      toast.success('Produit ajouté au panier');
    }
  });

  const handleAddToCart = () => {
    // Vérification simplifiée : une variante doit être sélectionnée s'il y a des variantes
    const hasVariants = Object.keys(variantsByType).length > 0;
    if (hasVariants && Object.keys(selectedVariants).length === 0) {
      setShowVariantError(true);
      return;
    }

    setShowVariantError(false);
    addToCartMutation.mutate();
  };

  if (loading || isLoading || !product) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Récupérer l'image de la variante sélectionnée
  const selectedVariantImage = Object.values(selectedVariants).find(v => v?.image_url)?.image_url;
  
  // Utiliser l'image du premier variant si le produit n'a pas d'image principale
  const mainImage = product.image_url || product.variants?.find(v => v.image_url)?.image_url;
  
  // Image principale + images supplémentaires + image variante si elle existe et n'est pas déjà présente
  let images = mainImage 
    ? [mainImage, ...(product.images || []).filter(img => img !== mainImage)]
    : (product.images || []);
  
  if (selectedVariantImage && !images.includes(selectedVariantImage)) {
    images = [...images, selectedVariantImage];
  }

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe && selectedImage < images.length - 1) {
      setSelectedImage(selectedImage + 1);
    }
    if (isRightSwipe && selectedImage > 0) {
      setSelectedImage(selectedImage - 1);
    }
  };
  const similarProducts = product
    ? allProducts.filter(p => p.id !== product.id && p.category === product.category).slice(0, 8)
    : [];

  const selectedVariant = Object.values(selectedVariants)[0];
  // Si la variante sélectionnée a un prix promo, l'utiliser en priorité
  const currentPrice = selectedVariant?.promotion_price
    ? parseFloat(selectedVariant.promotion_price)
    : (product.is_promotion && product.promotion_price ? product.promotion_price : product.price);

  const basePrice = product.price;
  let finalPrice = currentPrice;
  // Appliquer le price_modifier seulement si pas de prix promo sur la variante
  if (!selectedVariant?.promotion_price) {
    Object.values(selectedVariants).forEach(variant => {
      if (variant?.price_modifier) {
        finalPrice += variant.price_modifier;
      }
    });
  }
  const hasVariantPromo = !!selectedVariant?.promotion_price;

  // Group variants by type
  const variantsByType = {};
  product.variants?.forEach(variant => {
    if (!variantsByType[variant.type]) {
      variantsByType[variant.type] = [];
    }
    variantsByType[variant.type].push(variant);
  });

  const variantTypeLabels = {
    taille: 'Taille',
    forme: 'Forme',
    poids: 'Poids',
    pack: 'Type de pack'
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <button 
          onClick={() => {
            if (fromCart) {
              window.history.back();
            } else {
              navigate(createPageUrl('Home'));
            }
          }}
          className="inline-flex items-center text-slate-600 hover:text-emerald-600 mb-6 hover:underline"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {fromCart ? 'Retour au panier' : 'Retour aux produits'}
        </button>

        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          {/* Images */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
              <CardContent className="p-0">
                <div 
                  className="aspect-square bg-white relative overflow-hidden"
                  onTouchStart={onTouchStart}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onTouchEnd}
                >
                  <img
                    src={images[selectedImage] || 'https://images.unsplash.com/photo-1543168256-418811576931?w=800'}
                    alt={`${product.name} - Image ${selectedImage + 1}`}
                    className="w-full h-full object-cover transition-opacity duration-300"
                    style={{ userSelect: 'none', touchAction: 'pan-y' }}
                  />
                  {images.length > 1 && (
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                      {images.map((_, idx) => (
                        <div
                          key={idx}
                          className={`w-2 h-2 rounded-full transition-all ${
                            selectedImage === idx ? 'bg-white w-6' : 'bg-white/50'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
                {images.length > 1 && (
                  <div className="p-4 flex gap-2 overflow-x-auto">
                    {images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedImage(idx)}
                        className={`
                          w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all
                          ${selectedImage === idx ? 'border-emerald-500' : 'border-transparent'}
                        `}
                      >
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Product Info */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Badge>{categoryLabels[product.category]}</Badge>
                {product.featured_groups && product.featured_groups.length > 0 && (
                  <>
                    {product.featured_groups.map((group, idx) => (
                      <Badge key={idx} className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border-0">
                        {group === 'nouveaute' && '✨ Nouveauté'}
                        {group === 'meilleure_vente' && '🔥 Meilleure vente'}
                        {group === 'coup_de_coeur' && '❤️ Coup de cœur'}
                        {group === 'recommande' && '⭐ Recommandé'}
                        {group === 'bio' && '🌱 Bio & Local'}
                        {group === 'exclusif' && '💎 Exclusif'}
                      </Badge>
                    ))}
                  </>
                )}
              </div>
              <h1 className="text-3xl font-bold text-slate-800 mb-2">{product.name}</h1>
              <p className="text-slate-600">{product.description}</p>
              
              {product.country_of_origin && countries[product.country_of_origin] && (
                <div className="mt-3 flex items-center gap-2 text-slate-600">
                  <span className="text-2xl">{countries[product.country_of_origin].flag}</span>
                  <span className="text-sm font-medium">
                    Origine : {countries[product.country_of_origin].name}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-4xl font-bold text-emerald-600">{finalPrice.toFixed(2)}€</span>
              {(hasVariantPromo || (product.is_promotion && product.promotion_price && !selectedVariant?.promotion_price)) && (
                <span className="text-xl text-slate-400 line-through">{product.price.toFixed(2)}€</span>
              )}
              {hasVariantPromo && (
                <span className="text-sm bg-rose-100 text-rose-600 font-semibold px-2 py-0.5 rounded-full">Promo variante</span>
              )}
              <span className="text-slate-500">/ {product.unit === 'piece' ? 'pièce' : product.unit}</span>
            </div>
            {product.is_promotion && product.promotion_end_date && (
              <div className="inline-flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium px-3 py-1.5 rounded-lg">
                🏷️ Promotion valable jusqu'au {new Date(product.promotion_end_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            )}

            {/* Variants */}
            {Object.keys(variantsByType).length > 0 && (
              <div className="space-y-4">
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  Choisir une option <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(variantsByType).flatMap(([type, variants]) =>
                    variants.map((variant, idx) => {
                      const isSelected = Object.values(selectedVariants).some(v => v?.value === variant.value);
                      return (
                        <button
                          key={`${type}-${idx}`}
                          onClick={() => {
                            handleVariantSelect(variant);
                            setShowVariantError(false);
                          }}
                          className={`
                            p-3 rounded-xl border-2 transition-all text-left
                            ${isSelected
                              ? 'border-emerald-500 bg-emerald-50' 
                              : 'border-slate-200 bg-white hover:border-slate-300'
                            }
                          `}
                        >
                          <div className="text-xs text-slate-500 mb-1">{variantTypeLabels[type] || type}</div>
                          <div className="font-medium text-slate-800">{variant.value}</div>
                          {variant.promotion_price ? (
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-sm font-bold text-rose-600">{parseFloat(variant.promotion_price).toFixed(2)}€</span>
                              <span className="text-xs text-slate-400 line-through">{(product.price + (variant.price_modifier || 0)).toFixed(2)}€</span>
                            </div>
                          ) : variant.price_modifier ? (
                            <div className="text-sm text-emerald-600">
                              {variant.price_modifier > 0 ? '+' : ''}{variant.price_modifier.toFixed(2)}€
                            </div>
                          ) : null}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            <Separator />

            {/* Quantity & Add to Cart */}
            <div className="space-y-4">
              {showVariantError && Object.keys(variantsByType).length > 0 && (
                <Card className="border-0 bg-rose-50 shadow-none">
                  <CardContent className="p-4">
                    <p className="text-sm text-rose-800 font-medium">
                      ⚠️ Veuillez sélectionner une option
                    </p>
                  </CardContent>
                </Card>
              )}
              
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <span className="text-slate-700 font-medium">Quantité</span>
                <div className="flex items-center gap-2 bg-white rounded-xl p-2 shadow-sm">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-12 w-12 rounded-lg flex-shrink-0"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    <Minus className="w-5 h-5" />
                  </Button>
                  <span className="flex-1 min-w-[3rem] text-center text-lg font-semibold">{quantity}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-12 w-12 rounded-lg flex-shrink-0"
                    onClick={() => setQuantity(Math.min(product.stock_quantity, quantity + 1))}
                    disabled={quantity >= product.stock_quantity}
                  >
                    <Plus className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              <Button
                onClick={handleAddToCart}
                disabled={product.stock_quantity <= 0 || addToCartMutation.isPending}
                className="w-full h-14 sm:h-16 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transition-all touch-manipulation"
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                {product.stock_quantity <= 0 ? 'Rupture de stock' : 'Ajouter au panier'}
              </Button>
            </div>

            <Card className="border-0 bg-blue-50 shadow-none">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2 text-blue-700">
                  <Truck className="w-5 h-5" />
                  <span className="text-sm font-medium">
                    Livraison gratuite dès {userDeliveryZone?.free_delivery_threshold || 29}€
                  </span>
                </div>
                {userDeliveryZone && (
                  <>
                    <div className="flex items-center gap-2 text-blue-700">
                      <Package className="w-5 h-5" />
                      <span className="text-sm font-medium">
                        Livraison : {userDeliveryZone.delivery_time_days || '2 jours'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-blue-700">
                      <MapPin className="w-5 h-5" />
                      <span className="text-sm font-medium">
                        Zone : {userDeliveryZone.name}
                      </span>
                    </div>
                  </>
                )}
                {!userDeliveryZone && user && (
                  <div className="flex items-center gap-2 text-amber-700">
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-sm font-medium">
                      Zone de livraison non disponible pour votre code postal
                    </span>
                  </div>
                )}
                {!user && (
                  <div className="flex items-center gap-2 text-slate-700">
                    <Package className="w-5 h-5" />
                    <span className="text-sm">
                      Connectez-vous pour voir vos délais de livraison
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Reviews */}
        {reviews.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <ProductReviews reviews={reviews} />
          </motion.div>
        )}

        {/* Similar Products */}
        {similarProducts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Produits similaires</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {similarProducts.map(p => (
                <ProductCard
                  key={p.id}
                  product={p}
                  cartQuantity={0}
                  onAddToCart={() => {}}
                  onRemoveFromCart={() => {}}
                />
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}