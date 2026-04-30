import React, { useState, useEffect, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Percent, ChevronRight, Sparkles, Star, X, Camera, Download, Camera as CameraIcon, Image as ImageIcon, SlidersHorizontal, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import ProductCard from '@/components/products/ProductCard';
import CustomerIdGenerator from '@/components/profile/CustomerIdGenerator';
import WelcomeMessageDialog from '@/components/WelcomeMessageDialog';
import InstallGuideModal from '@/components/InstallGuideModal';

export default function Home() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(() => sessionStorage.getItem('home_searchInput') || '');
  const [searchQuery, setSearchQuery] = useState(() => sessionStorage.getItem('home_searchQuery') || '');
  const [selectedCategory, setSelectedCategory] = useState(() => sessionStorage.getItem('home_selectedCategory') || 'all');
  const [shopMode, setShopMode] = useState(() => sessionStorage.getItem('home_shopMode') || 'food'); // 'food' | 'cosmetique'
  const [searchSticky, setSearchSticky] = useState(false);
  const searchSectionRef = useRef(null);
  
  const [welcomeMessageOpen, setWelcomeMessageOpen] = useState(false);
  const [guestCart, setGuestCart] = useState([]);
  const [imageSearchLoading, setImageSearchLoading] = useState(false);
  const hasRestoredScroll = React.useRef(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const queryClient = useQueryClient();

  // Catégories pour le filtre dropdown
  const ALL_CATEGORIES = [
    { id: 'all', label: 'Tous', icon: ({ className }) => <span className={className}>🛒</span> },
    { id: 'fruits_legumes', label: 'Fruits & Légumes', icon: ({ className }) => <span className={className}>🍎</span> },
    { id: 'viandes_poissons', label: 'Viandes & Poissons', icon: ({ className }) => <span className={className}>🥩</span> },
    { id: 'produits_laitiers', label: 'Produits Laitiers', icon: ({ className }) => <span className={className}>🥛</span> },
    { id: 'epices', label: 'Épices', icon: ({ className }) => <span className={className}>🌶️</span> },
    { id: 'boissons', label: 'Boissons', icon: ({ className }) => <span className={className}>🍷</span> },
    { id: 'surgeles', label: 'Surgelés', icon: ({ className }) => <span className={className}>❄️</span> },
    { id: 'entretien', label: 'Entretien', icon: ({ className }) => <span className={className}>🧹</span> },
    { id: 'cosmetique', label: 'Cosmétique', icon: ({ className }) => <span className={className}>✨</span> },
    { id: 'sec', label: 'Sec', icon: ({ className }) => <span className={className}>🌾</span> },
    { id: 'frais', label: 'Frais', icon: ({ className }) => <span className={className}>🥬</span> },
  ];
  const FOOD_CATS = ['fruits_legumes', 'viandes_poissons', 'produits_laitiers', 'epices', 'boissons', 'surgeles', 'entretien', 'sec', 'frais'];
  const COSMETIQUE_CATS = ['cosmetique'];

  // Fermer le filtre quand on clique ailleurs
  useEffect(() => {
    if (!filterOpen) return;
    const handleClick = (e) => {
      if (!e.target.closest('[data-filter-container]')) setFilterOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [filterOpen]);

  // Sauvegarder la position de scroll de la Home en continu + sticky search
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 0) {
        sessionStorage.setItem('home_scrollPos', window.scrollY.toString());
      }
      if (searchSectionRef.current) {
        const rect = searchSectionRef.current.getBoundingClientRect();
        // Sticky quand le haut du search dépasse le bas du header (64px)
        setSearchSticky(rect.top <= 64);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!user) {
      const saved = localStorage.getItem('guestCart');
      if (saved) {
        setGuestCart(JSON.parse(saved));
      }
    }
  }, [user]);

  // Persister les filtres dans sessionStorage
  useEffect(() => {
    sessionStorage.setItem('home_searchInput', searchInput);
  }, [searchInput]);

  useEffect(() => {
    sessionStorage.setItem('home_searchQuery', searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    sessionStorage.setItem('home_selectedCategory', selectedCategory);
  }, [selectedCategory]);

  useEffect(() => {
    sessionStorage.setItem('home_shopMode', shopMode);
    setSelectedCategory('all'); // reset catégorie quand on change de mode
  }, [shopMode]);

  useEffect(() => {
    base44.auth.me()
      .then(u => {
        if (u && u.is_active === false) {
          base44.auth.logout();
          return;
        }
        setUser(u);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const checkInstalled = window.matchMedia('(display-mode: standalone)').matches ||
                          window.navigator.standalone;
    setIsAppInstalled(checkInstalled);

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    const installedHandler = () => {
      setIsAppInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) {
      // Ouvrir le guide visuel d'installation
      setInstallGuideOpen(true);
      return;
    }
    
    try {
      // Déclenche l'installation automatique (Android, PC)
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsAppInstalled(true);
      }
    } catch (error) {
      console.error('Erreur lors de l\'installation:', error);
      setInstallGuideOpen(true);
    }
  };

  const { data: welcomeMessages = [] } = useQuery({
    queryKey: ['welcomeMessages'],
    queryFn: () => base44.entities.WelcomeMessage.list(),
    staleTime: 60 * 1000,
  });

  const { data: referralSettings = [] } = useQuery({
    queryKey: ['referralSettings'],
    queryFn: () => base44.entities.ReferralSettings.list(),
    staleTime: 60 * 1000,
  });

  const isReferralActive = referralSettings.length > 0 ? referralSettings[0].is_active : true;

  // Afficher le message de bienvenue selon le ciblage
  useEffect(() => {
    if (!loading && welcomeMessages.length > 0) {
      const message = welcomeMessages[0];
      if (!message.is_active) return;

      const frequency = message.display_frequency || 'once';

      // Vérifier selon la fréquence
      if (frequency === 'once') {
        const dismissedMessages = JSON.parse(localStorage.getItem('dismissedWelcomeMessages') || '[]');
        if (dismissedMessages.includes(message.id)) return;
      } else if (frequency === 'daily') {
        const dailyDismissed = JSON.parse(localStorage.getItem('dailyDismissedMessages') || '{}');
        const lastDismissed = dailyDismissed[message.id];
        const today = new Date().toDateString();
        if (lastDismissed === today) return;
      }
      // Si every_login, toujours afficher

      let shouldShow = false;

      if (message.target_audience === 'guests' && !user) {
        shouldShow = true;
      } else if (message.target_audience === 'registered' && user) {
        shouldShow = true;
      } else if (message.target_audience === 'all') {
        shouldShow = true;
      } else if (message.target_audience === 'specific' && user) {
        shouldShow = message.specific_users?.includes(user.email);
      }

      if (shouldShow) {
        setWelcomeMessageOpen(true);
      }
    }
  }, [loading, welcomeMessages, user]);

  const { data: deliveryZones = [] } = useQuery({
    queryKey: ['deliveryZones'],
    queryFn: () => base44.entities.DeliveryZone.list(),
    staleTime: 10 * 60 * 1000,
    refetchOnMount: false,
  });
  const deliveryTime = deliveryZones[0]?.delivery_time_days || '2 jours';

  // Restaurer le scroll après le chargement des produits
  const { data: products = [], isLoading: productsLoading, isError: productsError } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 2,
    retryDelay: 1000,
    placeholderData: (previousData) => previousData,
  });

  useEffect(() => {
    if (hasRestoredScroll.current) return;
    const savedPos = sessionStorage.getItem('home_scrollPos');
    if (!savedPos || parseInt(savedPos, 10) <= 0) {
      hasRestoredScroll.current = true;
      sessionStorage.removeItem('home_scrollPos');
      return;
    }
    const pos = parseInt(savedPos, 10);
    // Supprimer immédiatement pour éviter toute re-lecture
    sessionStorage.removeItem('home_scrollPos');
    hasRestoredScroll.current = true;

    // Attendre que la page ait assez de hauteur pour atteindre la position
    const observer = new ResizeObserver(() => {
      if (document.documentElement.scrollHeight >= pos + window.innerHeight) {
        window.scrollTo({ top: pos, behavior: 'instant' });
        observer.disconnect();
      }
    });
    observer.observe(document.documentElement);

    // Fallback après 3s
    const timeout = setTimeout(() => {
      observer.disconnect();
      window.scrollTo({ top: pos, behavior: 'instant' });
    }, 3000);

    return () => {
      observer.disconnect();
      clearTimeout(timeout);
    };
  }, []);

  const { data: cartItems = [] } = useQuery({
    queryKey: ['cart', user?.email],
    queryFn: () => base44.entities.CartItem.filter({ customer_email: user?.email }),
    enabled: !!user?.email,
    staleTime: 0,
    refetchOnMount: true,
  });

  const displayCart = user ? cartItems : guestCart;

  const { data: myOrders = [] } = useQuery({
    queryKey: ['myOrders', user?.email],
    queryFn: () => base44.entities.Order.filter({ customer_email: user?.email }),
    enabled: !!user?.email,
    staleTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    select: (data) => data.map(o => ({ items: o.items })), // ne garder que les items
  });

  const addToGuestCart = (product) => {
    // Pour Home.js, on ajoute sans variantes (variantes sélectionnées uniquement depuis ProductDetails)
    const existingItem = guestCart.find(item => 
      item.product_id === product.id && !item.selected_variants
    );
    let updated;
    if (existingItem) {
      // Ne pas dépasser le stock
      if (existingItem.quantity >= product.stock_quantity) return;
      updated = guestCart.map(item =>
        item.id === existingItem.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
    } else {
      updated = [...guestCart, {
        id: `guest-${Date.now()}-${Math.random()}`,
        product_id: product.id,
        product_name: product.name,
        product_image: product.image_url,
        quantity: 1,
        unit_price: product.is_promotion && product.promotion_price ? product.promotion_price : product.price,
        unit: product.unit,
        selected_variants: null
      }];
    }
    setGuestCart(updated);
    localStorage.setItem('guestCart', JSON.stringify(updated));
    
    // Forcer la mise à jour de toutes les queries
    queryClient.invalidateQueries({ queryKey: ['cart'] });
  };

  const addToCartMutation = useMutation({
    mutationFn: async (product) => {
      const existingItem = cartItems.find(item => 
        item.product_id === product.id && !item.selected_variants
      );
      if (existingItem) {
        if (existingItem.quantity >= product.stock_quantity) return;
        return base44.entities.CartItem.update(existingItem.id, {
          quantity: existingItem.quantity + 1
        });
      } else {
        return base44.entities.CartItem.create({
          customer_email: user.email,
          product_id: product.id,
          product_name: product.name,
          product_image: product.image_url,
          quantity: 1,
          unit_price: product.is_promotion && product.promotion_price ? product.promotion_price : product.price,
          unit: product.unit,
          selected_variants: null
        });
      }
    },
    onMutate: async (product) => {
      await queryClient.cancelQueries({ queryKey: ['cart', user?.email] });
      const previousCart = queryClient.getQueryData(['cart', user?.email]);
      
      queryClient.setQueryData(['cart', user?.email], (old = []) => {
        const existingItem = old.find(item => item.product_id === product.id);
        if (existingItem) {
          if (existingItem.quantity >= product.stock_quantity) return old;
          return old.map(item => 
            item.product_id === product.id 
              ? { ...item, quantity: item.quantity + 1 }
              : item
          );
        } else {
          return [...old, {
            id: `temp-${Date.now()}`,
            product_id: product.id,
            product_name: product.name,
            product_image: product.image_url,
            quantity: 1,
            unit_price: product.is_promotion && product.promotion_price ? product.promotion_price : product.price,
            unit: product.unit,
            customer_email: user.email
          }];
        }
      });
      
      return { previousCart };
    },
    onError: (err, product, context) => {
      queryClient.setQueryData(['cart', user?.email], context.previousCart);
    }
  });

  const handleAddToCart = (product) => {
    if (user) {
      addToCartMutation.mutate(product);
    } else {
      addToGuestCart(product);
    }
  };

  const updateCartMutation = useMutation({
    mutationFn: async ({ id, quantity }) => {
      if (quantity <= 0) {
        return base44.entities.CartItem.delete(id);
      }
      return base44.entities.CartItem.update(id, { quantity });
    },
    onMutate: async ({ id, quantity }) => {
      await queryClient.cancelQueries({ queryKey: ['cart', user?.email] });
      const previousCart = queryClient.getQueryData(['cart', user?.email]);
      
      queryClient.setQueryData(['cart', user?.email], (old = []) => {
        if (quantity <= 0) {
          return old.filter(item => item.id !== id);
        }
        return old.map(item => 
          item.id === id ? { ...item, quantity } : item
        );
      });
      
      return { previousCart };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['cart', user?.email], context.previousCart);
    }
  });

  const handleRemoveFromCart = (product) => {
    if (user) {
      const existingItem = cartItems.find(item => item.product_id === product.id);
      if (existingItem) {
        updateCartMutation.mutate({ id: existingItem.id, quantity: existingItem.quantity - 1 });
      }
    } else {
      const existingItem = guestCart.find(item => item.product_id === product.id);
      if (existingItem) {
        const updated = guestCart.map(item =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity - 1 }
            : item
        ).filter(item => item.quantity > 0);
        setGuestCart(updated);
        localStorage.setItem('guestCart', JSON.stringify(updated));
      }
    }
  };

  // Fonction de recherche flexible
  const flexibleSearch = (text, query) => {
    if (!text || !query) return false;
    
    // Normaliser (enlever accents, minuscules)
    const normalize = (str) => str.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Enlever le "s" final pour gérer pluriel/singulier
    const removePluralS = (str) => str.endsWith('s') && str.length > 2 ? str.slice(0, -1) : str;
    
    const normalizedText = normalize(text);
    const normalizedQuery = normalize(query);
    
    // Diviser la requête en mots
    const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length >= 2);
    
    // Vérifier si au moins un mot de la requête correspond
    return queryWords.some(word => {
      // Versions avec et sans "s" final
      const wordWithoutS = removePluralS(word);
      const textWithoutS = normalizedText.split(/\s+/).map(removePluralS).join(' ');
      
      // Recherche directe
      if (normalizedText.includes(word)) return true;
      if (normalizedText.includes(wordWithoutS)) return true;
      if (textWithoutS.includes(word)) return true;
      if (textWithoutS.includes(wordWithoutS)) return true;
      
      // Recherche inversée (mot à l'envers)
      const reversedWord = word.split('').reverse().join('');
      if (normalizedText.includes(reversedWord)) return true;
      
      return false;
    });
  };

  const userTier = user?.customer_tier || 'normal';

  const FOOD_CATEGORIES = ['fruits_legumes', 'viandes_poissons', 'produits_laitiers', 'epices', 'boissons', 'surgeles', 'sec', 'frais', 'entretien'];
  const COSMETIQUE_CATEGORIES = ['cosmetique'];

  const { filteredProducts, promotionProducts, habitualProducts, newProducts, availableCategories } = useMemo(() => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const purchasedProductIds = new Set(myOrders.flatMap(o => o.items?.map(i => i.product_id) || []));
    const cats = new Set();

    const accessible = [];
    for (const p of products) {
      const allowedTiers = p.allowed_tiers || ['normal', 'argent', 'or', 'diamant'];
      if (!allowedTiers.includes(userTier)) continue;
      // Filtrer par mode (alimentation ou cosmétique)
      if (shopMode === 'food' && COSMETIQUE_CATEGORIES.includes(p.category)) continue;
      if (shopMode === 'cosmetique' && !COSMETIQUE_CATEGORIES.includes(p.category)) continue;
      if (p.category) cats.add(p.category);
      accessible.push(p);
    }

    const matchesFilters = (p) => {
      if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
      if (searchQuery) {
        return flexibleSearch(p.name, searchQuery) ||
               flexibleSearch(p.description, searchQuery) ||
               flexibleSearch(p.category, searchQuery);
      }
      return true;
    };

    const filtered = accessible.filter(matchesFilters).sort((a, b) => {
      const normalize = (str) => (str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      // Trier d'abord par premier mot (pour grouper "Poisson bar", "Poisson dorade", etc.)
      // puis par nom complet pour ordonner les variantes
      const firstWordA = normalize(a.name || '').split(' ')[0];
      const firstWordB = normalize(b.name || '').split(' ')[0];
      const firstWordCmp = firstWordA.localeCompare(firstWordB);
      if (firstWordCmp !== 0) return firstWordCmp;
      return normalize(a.name).localeCompare(normalize(b.name));
    });

    const promos = accessible.filter(p => p.is_promotion && matchesFilters(p));

    const habitual = accessible.filter(p => purchasedProductIds.has(p.id) && matchesFilters(p));

    const newProds = accessible
      .filter(p => new Date(p.created_date) >= sevenDaysAgo && matchesFilters(p))
      .sort((a, b) => {
        const aBS = a.featured_groups?.includes('meilleure_vente') || false;
        const bBS = b.featured_groups?.includes('meilleure_vente') || false;
        if (bBS !== aBS) return (bBS ? 1 : 0) - (aBS ? 1 : 0);
        return new Date(b.created_date) - new Date(a.created_date);
      });

    return {
      filteredProducts: filtered,
      promotionProducts: promos,
      habitualProducts: habitual,
      newProducts: newProds,
      availableCategories: [...cats],
    };
  }, [products, searchQuery, selectedCategory, userTier, myOrders, shopMode]);

  const modeCats = shopMode === 'cosmetique' ? COSMETIQUE_CATS : FOOD_CATS;
  const visibleCategoriesForFilter = ALL_CATEGORIES.filter(cat =>
    cat.id === 'all' || (modeCats.includes(cat.id) && availableCategories.includes(cat.id))
  );

  const getCartQuantity = (productId) => {
    const item = displayCart.find(i => i.product_id === productId);
    return item?.quantity || 0;
  };

  const handleImageSearch = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImageSearchLoading(true);
    try {
      // Upload l'image
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // Utiliser l'IA pour identifier les produits dans l'image
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analysez cette image et identifiez les produits alimentaires visibles. 
        Retournez uniquement les noms des produits détectés, séparés par des espaces.
        Soyez précis et concis. Par exemple: "tomate oignon poulet"`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            products: { type: "string", description: "Noms des produits détectés séparés par des espaces" }
          }
        }
      });

      // Mettre à jour la recherche avec les produits détectés
      const searchText = result.products || '';
      setSearchInput(searchText);
      setSearchQuery(searchText);

      // Vérifier si des produits correspondent
      setTimeout(() => {
        const query = searchText.toLowerCase();
        const matchingProducts = products.filter(p => 
          p.name?.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query)
        );

        if (matchingProducts.length === 0) {
          alert('❌ Aucun produit trouvé correspondant à votre photo');
        } else {
          // Scroller vers les résultats
          window.scrollTo({ top: 600, behavior: 'smooth' });
        }
      }, 100);
    } catch (error) {
      console.error('Erreur lors de la recherche par image:', error);
      alert('Erreur lors de l\'analyse de l\'image. Veuillez réessayer.');
    } finally {
      setImageSearchLoading(false);
      event.target.value = '';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
    }

    if (productsError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-slate-600 mb-4">Erreur de chargement des produits</p>
          <Button onClick={() => window.location.reload()}>Réessayer</Button>
        </div>
      </div>
    );
    }

  return (
    <div className="min-h-screen bg-slate-50">
      <CustomerIdGenerator user={user} onIdGenerated={() => queryClient.invalidateQueries({ queryKey: ['user'] })} />

      {/* Hero Section */}
      <div className="text-white" style={{ background: 'linear-gradient(to bottom right, #FF8C00, #FF7F00, #FF6B00)' }}>
        <div className="max-w-7xl mx-auto px-4 pt-6 pb-6 md:pt-8 md:pb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-6"
          >
            <p className="text-white text-2xl md:text-3xl font-semibold mb-1">
              Bienvenue sur AfriGo
            </p>
            <p className="text-orange-100 text-base mb-4">
              Profitez de nos produits de qualité et nos bonus au quotidien
            </p>


            
            {/* Sentinel pour détecter quand le search sort du viewport */}
            <div ref={searchSectionRef} className="space-y-4 w-full">
              <div className="flex gap-2 w-full">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <Input
                    type="text"
                    placeholder="Rechercher un produit..."
                    value={searchInput}
                    onChange={(e) => {
                      setSearchInput(e.target.value);
                      setSearchQuery(e.target.value);
                    }}
                    onKeyPress={(e) => e.key === 'Enter' && setSearchQuery(searchInput)}
                    className="w-full h-14 pl-12 pr-14 bg-white !text-slate-900 placeholder:text-slate-400 border-0 rounded-2xl shadow-xl text-lg focus:ring-2 focus:ring-orange-500 focus-visible:ring-2 focus-visible:ring-orange-500"
                    disabled={imageSearchLoading}
                    style={{ color: '#1e293b' }}
                  />
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageSearch}
                    className="hidden"
                    id="camera-search-input"
                    disabled={imageSearchLoading}
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSearch}
                    className="hidden"
                    id="gallery-search-input"
                    disabled={imageSearchLoading}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    {imageSearchLoading ? (
                      <div className="animate-spin w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full" />
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="cursor-pointer">
                            <Camera className="w-5 h-5 text-slate-400 hover:text-orange-500 transition-colors" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <label htmlFor="camera-search-input" className="cursor-pointer flex items-center">
                              <CameraIcon className="w-4 h-4 mr-2" />
                              Prendre une photo
                            </label>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <label htmlFor="gallery-search-input" className="cursor-pointer flex items-center">
                              <ImageIcon className="w-4 h-4 mr-2" />
                              Choisir depuis la galerie
                            </label>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
                <Button
                  onClick={() => setSearchQuery(searchInput)}
                  disabled={imageSearchLoading}
                  className="h-14 px-6 bg-white hover:bg-slate-50 border-0 rounded-2xl shadow-xl"
                  style={{ color: '#FF8C00' }}
                >
                  <Search className="w-5 h-5" />
                </Button>
                {searchQuery && (
                  <Button
                    onClick={() => {
                      setSearchInput('');
                      setSearchQuery('');
                    }}
                    variant="outline"
                    className="h-14 px-6 bg-white hover:bg-slate-50 border-0 rounded-2xl shadow-xl"
                    style={{ color: '#FF8C00' }}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                )}
              </div>
              

            </div>
          </motion.div>
        </div>
      </div>

      {/* Sélecteur Alimentation / Cosmétiques - en dehors de la zone orange */}
      <div className="bg-white border-b border-slate-100 py-4">
        <div className="max-w-7xl mx-auto px-4 flex justify-center">
          <div className="flex bg-green-700 rounded-2xl p-1 gap-1">
            <button
              onClick={() => setShopMode('food')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${
                shopMode === 'food'
                  ? 'bg-white text-green-700 shadow-lg'
                  : 'text-white hover:text-slate-100'
              }`}
            >
              <img src="https://media.base44.com/images/public/6947869a3a13c81a6fad2204/c1b2e43ba_generated_image.png" alt="Alimentation" className="w-10 h-10 object-cover rounded-full" />
              Alimentation
            </button>
            <button
              onClick={() => setShopMode('cosmetique')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${
                shopMode === 'cosmetique'
                  ? 'bg-white text-pink-500 shadow-lg'
                  : 'text-white hover:text-slate-100'
              }`}
            >
              <img src="https://media.base44.com/images/public/6947869a3a13c81a6fad2204/2de187d66_generated_image.png" alt="Cosmétiques" className="w-10 h-10 object-cover rounded-full" />
              Cosmétiques
            </button>
          </div>
        </div>
      </div>

      {/* Bouton Filtrer en bas à gauche */}
      <div className="bg-white px-4 py-3">
        <div className="max-w-7xl mx-auto flex justify-start">
          <div className="relative" data-filter-container>
            <button
              onClick={() => setFilterOpen(prev => !prev)}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-2 rounded-xl transition-all duration-200 border border-orange-600"
            >
              <SlidersHorizontal className="w-4 h-4" />
              {selectedCategory !== 'all'
                ? `Filtrer (${ALL_CATEGORIES.find(c => c.id === selectedCategory)?.label || selectedCategory})`
                : 'Filtrer'
              }
            </button>
            {filterOpen && (
              <div className="absolute left-0 bottom-full mb-2 bg-white rounded-2xl shadow-2xl p-3 z-50 min-w-[220px]">
                <p className="text-xs font-semibold text-slate-400 uppercase mb-2 px-2">Catégories</p>
                {visibleCategoriesForFilter.map(cat => {
                  const Icon = cat.icon;
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => { setSelectedCategory(cat.id); setFilterOpen(false); }}
                      className={`flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
                        isSelected ? 'bg-emerald-50 text-emerald-600' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isSelected ? 'text-emerald-500' : 'text-slate-400'}`} />
                      {cat.label}
                      {isSelected && <Check className="w-4 h-4 ml-auto text-emerald-500" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky Search Bar - visible uniquement quand on défile au-delà du Hero */}
      {searchSticky && (
        <div
          className="fixed top-16 left-0 right-0 z-30 bg-white shadow-md px-4 py-2"
          style={{ borderBottom: '1px solid #e2e8f0' }}
        >
          <div className="max-w-7xl mx-auto flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Rechercher un produit..."
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setSearchQuery(e.target.value);
                }}
                onKeyPress={(e) => e.key === 'Enter' && setSearchQuery(searchInput)}
                className="w-full h-10 pl-10 pr-10 bg-slate-50 !text-slate-900 placeholder:text-slate-400 border border-slate-200 rounded-xl text-sm"
                style={{ color: '#1e293b', fontSize: '16px' }}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {imageSearchLoading ? (
                  <div className="animate-spin w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full" />
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="cursor-pointer">
                        <Camera className="w-4 h-4 text-slate-400 hover:text-orange-500 transition-colors" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <label htmlFor="camera-search-input" className="cursor-pointer flex items-center">
                          <CameraIcon className="w-4 h-4 mr-2" />
                          Prendre une photo
                        </label>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <label htmlFor="gallery-search-input" className="cursor-pointer flex items-center">
                          <ImageIcon className="w-4 h-4 mr-2" />
                          Choisir depuis la galerie
                        </label>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
            {searchQuery && (
              <Button
                onClick={() => { setSearchInput(''); setSearchQuery(''); }}
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-xl"
                style={{ color: '#FF8C00' }}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Promotions Section */}
      {promotionProducts.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
                <Percent className="w-5 h-5 text-rose-500" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">Promotions</h2>
            </div>
            {promotionProducts.length > 4 && (
              <Link to={createPageUrl('Promotions')}>
                <Button 
                  variant="ghost" 
                  className="text-emerald-600 hover:text-emerald-700"
                >
                  Voir plus
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {promotionProducts.slice(0, 4).map(product => (
              <ProductCard
              key={product.id}
              product={product}
              cartQuantity={getCartQuantity(product.id)}
              onAddToCart={() => handleAddToCart(product)}
              onRemoveFromCart={() => handleRemoveFromCart(product)}
              deliveryTime={deliveryTime}
              />
            ))}
          </div>
        </div>
      )}

      {/* Produits Habituels Section */}
      {habitualProducts.length > 0 && user && (
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <Star className="w-5 h-5 text-amber-500" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">Vos produits habituels</h2>
            </div>
            {habitualProducts.length > 4 && (
              <Link to={createPageUrl('HabitualProducts')}>
                <Button 
                  variant="ghost" 
                  className="text-emerald-600 hover:text-emerald-700"
                >
                  Voir plus
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {habitualProducts.slice(0, 4).map(product => (
              <ProductCard
              key={product.id}
              product={product}
              cartQuantity={getCartQuantity(product.id)}
              onAddToCart={() => handleAddToCart(product)}
              onRemoveFromCart={() => handleRemoveFromCart(product)}
              deliveryTime={deliveryTime}
              />
            ))}
          </div>
        </div>
      )}

      {/* Nouveaux Produits Section */}
      {newProducts.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-blue-500" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">Nouveaux produits</h2>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {newProducts.slice(0, 4).map(product => (
              <ProductCard
              key={product.id}
              product={product}
              cartQuantity={getCartQuantity(product.id)}
              onAddToCart={() => handleAddToCart(product)}
              onRemoveFromCart={() => handleRemoveFromCart(product)}
              deliveryTime={deliveryTime}
              />
            ))}
          </div>
        </div>
      )}

      {/* Main Products Section */}
      <div className="max-w-7xl mx-auto px-4 py-10">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">Nos Produits</h2>

        {(productsLoading && !products.length) ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl h-80 animate-pulse" />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-500">Aucun produit trouvé</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {filteredProducts.map(product => (
              <ProductCard
              key={product.id}
              product={product}
              cartQuantity={getCartQuantity(product.id)}
              onAddToCart={() => handleAddToCart(product)}
              onRemoveFromCart={() => handleRemoveFromCart(product)}
              deliveryTime={deliveryTime}
              />
            ))}
          </div>
        )}
      </div>

      {/* Welcome Message Dialog */}
      <WelcomeMessageDialog
        message={welcomeMessages[0]}
        open={welcomeMessageOpen}
        onClose={() => setWelcomeMessageOpen(false)}
        isGuest={!user}
      />

      {/* Install Guide Modal */}
      <InstallGuideModal
        open={installGuideOpen}
        onClose={() => setInstallGuideOpen(false)}
        isIOS={/iPad|iPhone|iPod/.test(navigator.userAgent)}
        isAndroid={/Android/.test(navigator.userAgent)}
      />
    </div>
  );
}