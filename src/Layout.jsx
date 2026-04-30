import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import MaintenanceMode from '@/components/MaintenanceMode';
import { Download, Search } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
              Home, User, ShoppingBag, ShoppingCart, Package, MessageCircle, 
              Menu, X, Settings, LayoutDashboard, RotateCcw, QrCode, MapPin, Star, Phone, Banknote, History, Users, Handshake, Sparkles, Calendar, Truck, Eye, Bell, CreditCard, Tag, Mail, BarChart3, ShieldCheck
            } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import CartDrawer from '@/components/cart/CartDrawer';
import BottomTabBar from '@/components/BottomTabBar';
import PrivacyPolicyDialog from '@/components/PrivacyPolicyDialog';
import AdminSideNav from '@/components/AdminSideNav';
import AdminBottomTabBar from '@/components/AdminBottomTabBar';
import AdminFloatingCart from '@/components/AdminFloatingCart';
import PullToRefresh from '@/components/PullToRefresh';
import ErrorBoundary from '@/components/ErrorBoundary';
import UpdatePrompt from '@/components/UpdatePrompt';
import NotificationListener from '@/components/NotificationListener';
import VisitorTracker from '@/components/VisitorTracker';
import InternalRegulationsDialog from '@/components/InternalRegulationsDialog';

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [regulationsOpen, setRegulationsOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  
  // Désactiver le scroll automatique du navigateur (une seule fois au chargement)
  React.useLayoutEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  // Système global de sauvegarde/restauration de scroll
  const prevPathname = React.useRef(null);

  useEffect(() => {
    const currentPath = location.pathname;
    const isHomePage = currentPath === '/' || currentPath === '/home' || currentPath.endsWith('/Home');

    // Si on quitte une autre page (non-Home), sauvegarder sa position
    if (prevPathname.current && prevPathname.current !== currentPath) {
      const prevIsHome = prevPathname.current === '/' || prevPathname.current === '/home' || prevPathname.current.endsWith('/Home');
      if (!prevIsHome) {
        sessionStorage.setItem(`scrollPos:${prevPathname.current}`, window.scrollY.toString());
      }
    }

    // Pour la Home : scroll géré entièrement par Home.jsx — le Layout n'intervient jamais
    if (!isHomePage) {
      const storageKey = `scrollPos:${currentPath}`;
      const savedPos = sessionStorage.getItem(storageKey);
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

      // Sauvegarder en continu uniquement pour les pages non-Home
      const handleScroll = () => {
        sessionStorage.setItem(storageKey, window.scrollY.toString());
      };
      window.addEventListener('scroll', handleScroll, { passive: true });
      prevPathname.current = currentPath;
      return () => window.removeEventListener('scroll', handleScroll);
    }

    prevPathname.current = currentPath;
  }, [location.pathname]);

  useEffect(() => {
    base44.auth.me().then(async u => {
      // Vérifier si le compte est actif
      if (u && u.is_active === false) {
        base44.auth.logout();
        alert('Votre compte a été désactivé. Veuillez contacter l\'administrateur.');
        return;
      }
      setUser(u);

      // Vérifier en amont si les documents légaux sont déjà acceptés (évite tout flash)
      await checkAndOpenLegalDialogs(u);
    }).catch(async () => {
      setUser(null);
      await checkAndOpenLegalDialogs(null);
    });
  }, []);

  // Vérifie via localStorage + API si les documents doivent être affichés
  const checkAndOpenLegalDialogs = async (u) => {
    const storageKey = u?.email || 'guest';

    try {
      // 1. Vérifier le règlement intérieur
      const regulations = await base44.entities.InternalRegulations.filter({ is_active: true });
      const activeReg = regulations.sort((a, b) => b.version - a.version)[0];

      if (activeReg) {
        const regAcceptances = JSON.parse(localStorage.getItem('regulationsAcceptances') || '{}');
        const regAccepted = regAcceptances[storageKey];
        const regNeedsAcceptance = !regAccepted ||
          regAccepted.regulationVersion !== activeReg.version ||
          regAccepted.regulationId !== activeReg.id;

        if (regNeedsAcceptance) {
          setRegulationsOpen(true);
          return; // La politique s'ouvrira après fermeture du règlement
        }
      }

      // 2. Règlement déjà accepté → vérifier la politique de confidentialité
      const policies = await base44.entities.PrivacyPolicy.filter({ is_active: true });
      const activePolicy = policies[0];

      if (activePolicy) {
        let policyNeedsAcceptance = true;
        if (u) {
          const freshUser = await base44.auth.me();
          const acceptedVersion = freshUser?.privacy_policy_accepted_version;
          policyNeedsAcceptance = !acceptedVersion || acceptedVersion !== activePolicy.version;
        } else {
          const guestAcceptances = JSON.parse(localStorage.getItem('privacyPolicyAcceptances') || '{}');
          policyNeedsAcceptance = guestAcceptances['guest'] !== activePolicy.version;
        }

        if (policyNeedsAcceptance) {
          setPrivacyOpen(true);
        }
      }
    } catch (e) {
      // En cas d'erreur réseau, ne pas bloquer l'utilisateur
      console.error('Erreur vérification légale:', e);
    }
  };

  useEffect(() => {
    // Vérifier si l'app est installée
    const checkInstalled = window.matchMedia('(display-mode: standalone)').matches ||
                          window.navigator.standalone;
    setIsAppInstalled(checkInstalled);

    // Écouter l'événement beforeinstallprompt
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Écouter l'événement appinstalled
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
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('openCart') === 'true') {
      setCartOpen(true);
      // Nettoyer l'URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Panier localStorage pour les non-connectés
  const [guestCart, setGuestCart] = useState([]);

  useEffect(() => {
    if (!user) {
      const saved = localStorage.getItem('guestCart');
      if (saved) {
        setGuestCart(JSON.parse(saved));
      }
    }
  }, [user]);

  // Fermer le menu mobile lors d'un changement de page
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const isAdmin = user?.role === 'admin';

  const { data: cartItems = [] } = useQuery({
    queryKey: ['cart', user?.email],
    queryFn: () => base44.entities.CartItem.filter({ customer_email: user?.email }),
    enabled: !!user?.email,
    staleTime: 0,
    refetchOnMount: true,
  });

  const { data: pendingOrders = [] } = useQuery({
    queryKey: ['pendingOrders', user?.email],
    queryFn: () => base44.entities.Order.filter({ status: 'pending' }),
    enabled: !!user?.email && isAdmin,
    staleTime: 5000,
    refetchInterval: 10000,
  });

  // Messages non lus pour le client (réponses admin non lues)
  const { data: customerUnreadMessages = [] } = useQuery({
    queryKey: ['customerUnreadMessages', user?.email],
    queryFn: () => base44.entities.Message.filter({ customer_email: user?.email, sender_type: 'admin', is_read: false }),
    enabled: !!user?.email && !isAdmin,
    refetchInterval: 10000,
  });

  // Messages non lus pour l'admin (messages clients non lus)
  const { data: adminUnreadMessages = [] } = useQuery({
    queryKey: ['adminUnreadMessages'],
    queryFn: () => base44.entities.Message.filter({ sender_type: 'customer', is_read: false }),
    enabled: !!user?.email && isAdmin,
    refetchInterval: 10000,
  });

  const unreadMessageCount = isAdmin ? adminUnreadMessages.length : customerUnreadMessages.length;

  // Forcer la mise à jour du displayCart quand guestCart change
  const displayCart = user ? cartItems : guestCart;
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);

  useEffect(() => {
    if (!user) {
      forceUpdate();
    }
  }, [guestCart, user]);

  const updateGuestCart = (id, quantity) => {
    const updated = guestCart.map(item => 
      item.id === id ? { ...item, quantity } : item
    ).filter(item => item.quantity > 0);
    setGuestCart(updated);
    localStorage.setItem('guestCart', JSON.stringify(updated));
  };

  const removeFromGuestCart = (id) => {
    const updated = guestCart.filter(item => item.id !== id);
    setGuestCart(updated);
    localStorage.setItem('guestCart', JSON.stringify(updated));
  };

  const updateCartMutation = useMutation({
    mutationFn: async ({ id, quantity }) => {
      if (quantity <= 0) {
        return base44.entities.CartItem.delete(id);
      }
      return base44.entities.CartItem.update(id, { quantity });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cart'] })
  });

  const removeFromCartMutation = useMutation({
    mutationFn: (id) => base44.entities.CartItem.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cart'] })
  });

  const handleUpdateQuantity = (id, quantity) => {
    if (user) {
      updateCartMutation.mutate({ id, quantity });
    } else {
      updateGuestCart(id, quantity);
    }
  };

  const handleRemove = (id) => {
    if (user) {
      removeFromCartMutation.mutate(id);
    } else {
      removeFromGuestCart(id);
    }
  };

  const cartTotal = displayCart.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  const cartCount = displayCart.reduce((sum, item) => sum + item.quantity, 0);

  const isAdminPage = currentPageName?.startsWith('Admin');
  const isDelivererPage = currentPageName?.startsWith('Deliverer');

  // Vérifier si l'utilisateur est un livreur via l'entité Deliverer
  const { data: delivererProfile } = useQuery({
    queryKey: ['delivererProfile', user?.email],
    queryFn: () => base44.entities.Deliverer.filter({ email: user?.email }),
    enabled: !!user?.email && !isAdmin,
    select: (data) => data[0]
  });

  const isDeliverer = !!delivererProfile;

  const customerLinks = [
    { name: 'Accueil', page: 'Home', icon: Home },
    { name: 'Mon profil', page: 'Profile', icon: User },
    { name: 'Mes commandes', page: 'Orders', icon: Package },
    { name: 'Paiement', page: 'Payment', icon: CreditCard },
    { name: 'Mes retours', page: 'MyReturns', icon: RotateCcw },
    { name: 'Mes remboursements', page: 'MyRefunds', icon: Banknote },
    { name: 'Avis clients', page: 'AllReviews', icon: Star },
    { name: 'Nous contacter', page: 'Messages', icon: Phone },
  ];

  const { data: adminPermissions = [] } = useQuery({
    queryKey: ['adminPermissions'],
    queryFn: () => base44.entities.AdminPermissions.list(),
    enabled: !!user && user?.role === 'admin'
  });

  const currentUserPermissions = adminPermissions.find(p => p.admin_email === user?.email);
  const isSuperAdmin = currentUserPermissions?.is_super_admin || false;
  const userPermissions = currentUserPermissions?.permissions || [];

  const allAdminLinks = [
    { name: 'Tableau de bord', page: 'AdminDashboard', icon: LayoutDashboard, permission: 'dashboard' },
    { name: 'Utilisateurs', page: 'AdminUsers', icon: Users, permission: 'users' },
    { name: 'Visiteurs', page: 'AdminVisitors', icon: Eye, permission: 'users' },
    { name: 'Produits', page: 'AdminProducts', icon: Package, permission: 'products' },
    { name: 'Commandes', page: 'AdminOrders', icon: ShoppingBag, permission: 'orders' },
    { name: 'Paniers clients', page: 'AdminCarts', icon: ShoppingCart, permission: 'orders' },
    { name: 'Retours', page: 'AdminReturns', icon: RotateCcw, permission: 'returns' },
    { name: 'Zones de livraison', page: 'AdminDeliveryZones', icon: MapPin, permission: 'delivery' },
    { name: 'Créneaux horaires', page: 'AdminDeliverySlots', icon: Calendar, permission: 'delivery' },
    { name: 'Assignation manuelle', page: 'AdminManualAssignment', icon: Truck, permission: 'delivery' },
    { name: 'Suivi temps réel', page: 'AdminDelivererTracking', icon: Truck, permission: 'delivery' },
    { name: 'Fidélité', page: 'AdminLoyalty', icon: Star, permission: 'loyalty' },
    { name: 'Parrainages', page: 'AdminReferrals', icon: Handshake, permission: 'referrals' },
    { name: 'Codes promo', page: 'AdminPromoCodes', icon: Tag, permission: 'settings' },
    { name: 'Messages', page: 'AdminMessages', icon: MessageCircle, permission: 'messages' },
    { name: 'Diffusion messages', page: 'AdminBroadcast', icon: Mail, permission: 'messages' },
    { name: 'Historique revenus', page: 'AdminRevenueHistory', icon: BarChart3, permission: 'dashboard' },
    { name: 'Portefeuilles', page: 'AdminWallet', icon: Banknote, permission: 'wallet' },
    { name: 'Paiement Stripe', page: 'AdminPayment', icon: CreditCard, permission: 'settings' },
    { name: 'QR Code', page: 'AdminQRCode', icon: QrCode, permission: 'qrcode' },
    { name: 'Meilleurs clients', page: 'AdminTopCustomers', icon: Star, permission: 'top_customers' },
    { name: 'Historique clients', page: 'AdminCustomerHistory', icon: History, permission: 'customer_history' },
    { name: 'Notifications (son)', page: 'AdminNotifications', icon: Bell, permission: 'settings' },
    { name: 'Paramètres', page: 'AdminSettings', icon: Settings, permission: 'settings' },
    { name: 'Message bienvenue', page: 'AdminWelcomeMessage', icon: Sparkles, permission: 'welcome_message' },
    { name: 'Règlements intérieurs', page: 'AdminInternalRegulations', icon: ShieldCheck, permission: 'settings' },
    { name: 'Politique de confidentialité', page: 'AdminPrivacyPolicy', icon: ShieldCheck, permission: 'settings' },
    { name: 'Gestion admins', page: 'AdminManagement', icon: Settings, permission: 'admin_management' },
    { name: 'Avis clients', page: 'AdminReviews', icon: Star, permission: 'reviews' },
  ];

  const adminLinks = isSuperAdmin 
    ? allAdminLinks 
    : allAdminLinks.filter(link => userPermissions.includes(link.permission));

  const delivererLinks = [
    { name: 'Mes livraisons', page: 'DelivererDashboard', icon: Truck }
  ];

  const links = isDelivererPage && isDeliverer 
    ? delivererLinks 
    : (isAdminPage && isAdmin ? adminLinks : customerLinks);

  const filteredLinks = (isAdminPage && isAdmin) || (isDelivererPage && isDeliverer)
    ? links.filter(link => 
        link.name.toLowerCase().includes(adminSearchQuery.toLowerCase())
      )
    : links;



  // Hide layout on checkout and order details print
  if (currentPageName === 'Checkout' || currentPageName === 'OrderDetails' || currentPageName === 'DelivererDashboard') {
    return <>{children}</>;
  }

  return (
    <ErrorBoundary>
      <PullToRefresh>
      <MaintenanceMode user={user}>
        {user?.role === 'admin' && <NotificationListener user={user} />}
        <VisitorTracker user={user} />
        <InternalRegulationsDialog 
          user={user} 
          open={regulationsOpen} 
          onClose={() => { setRegulationsOpen(false); setPrivacyOpen(true); }} 
        />
        <PrivacyPolicyDialog user={user} open={privacyOpen} onOpen={() => setPrivacyOpen(true)} onClose={() => setPrivacyOpen(false)} />
        <div className="min-h-screen bg-slate-50">

        {/* Header */}
        <header className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <Link
                to={createPageUrl('Home')}
                className="flex items-center gap-2"
                onClick={() => {
                  if (location.pathname === '/' || location.pathname.endsWith('/Home')) {
                    window.scrollTo({ top: 0, behavior: 'instant' });
                  }
                }}
              >
                <span className="text-2xl font-bold" style={{ color: '#FF8C00' }}>
                  AfriGo
                </span>
              </Link>
              {!isAppInstalled && (
                <Button
                  onClick={handleInstallApp}
                  size="sm"
                  className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl hidden md:flex"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Télécharger l'appli
                </Button>
              )}
            </div>

            {/* Desktop Navigation - customer/deliverer only */}
            {!(isAdminPage && isAdmin) && (
              <nav className="hidden md:flex items-center gap-1">
                {(isDelivererPage && isDeliverer) && (
                  <div className="relative mr-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      type="text"
                      placeholder="Rechercher..."
                      value={adminSearchQuery}
                      onChange={(e) => setAdminSearchQuery(e.target.value)}
                      className="h-9 pl-9 pr-3 w-48 rounded-xl border-slate-200"
                    />
                  </div>
                )}
                {filteredLinks.map(link => (
                  <Link key={link.page} to={createPageUrl(link.page)}>
                    <Button
                      variant={currentPageName === link.page ? 'secondary' : 'ghost'}
                      className="rounded-xl relative"
                    >
                      <link.icon className="w-4 h-4 mr-2" />
                      {link.name}
                    </Button>
                  </Link>
                ))}
              </nav>
            )}

            {/* User Menu */}
            <div className="flex items-center gap-3">
              {/* Bouton Espace Livreur */}
              {!isAdminPage && !isDelivererPage && isDeliverer && (
                <Link to={createPageUrl('DelivererDashboard')}>
                  <Button variant="outline" size="sm" className="rounded-xl hidden md:flex">
                    <Truck className="w-4 h-4 mr-2" />
                    Espace Livreur
                  </Button>
                </Link>
              )}

              {isAdmin && (
                <Link to={createPageUrl(isAdminPage ? 'Home' : 'AdminDashboard')}>
                  <Button variant="outline" size="sm" className="rounded-xl hidden md:flex">
                    {isAdminPage ? (
                      <>
                        <Home className="w-4 h-4 mr-2" />
                        Boutique
                      </>
                    ) : (
                      <>
                        <Settings className="w-4 h-4 mr-2" />
                        Admin
                      </>
                    )}
                  </Button>
                </Link>
              )}
              {isDeliverer && (
                <Link to={createPageUrl(isDelivererPage ? 'Home' : 'DelivererDashboard')}>
                  <Button variant="outline" size="sm" className="rounded-xl hidden md:flex">
                    {isDelivererPage ? (
                      <>
                        <Home className="w-4 h-4 mr-2" />
                        Boutique
                      </>
                    ) : (
                      <>
                        <Truck className="w-4 h-4 mr-2" />
                        Livraisons
                      </>
                    )}
                  </Button>
                </Link>
              )}

              {user ? (
                <Link to={createPageUrl('Profile')}>
                  <Button variant="ghost" className="rounded-xl">
                    <span className="text-lg font-bold text-slate-700">Bonjour, {user.first_name || user.full_name?.split(' ')[0]}</span>
                  </Button>
                </Link>
              ) : !isAppInstalled && deferredPrompt ? (
                <Button
                  onClick={handleInstallApp}
                  style={{ backgroundColor: '#FF8C00' }}
                  className="hover:opacity-90 rounded-xl"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Télécharger l'appli
                </Button>
              ) : (
                <Button
                  onClick={() => base44.auth.redirectToLogin(createPageUrl('Profile'))}
                  style={{ backgroundColor: '#008000' }}
                  className="hover:opacity-90 rounded-xl"
                >
                  S'inscrire/Se connecter
                </Button>
              )}


            </div>
          </div>
        </div>

      </header>

        {/* Drawer Menu Latéral Droit */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              {/* Overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 z-50"
                onClick={() => setMobileMenuOpen(false)}
              />
              {/* Drawer */}
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'tween', duration: 0.25 }}
                className="fixed top-0 right-0 h-full w-72 bg-white z-50 shadow-2xl flex flex-col"
              >
                {/* Header du drawer */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <span className="text-xl font-bold" style={{ color: '#FF8C00' }}>AfriGo</span>
                  <button onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-xl hover:bg-slate-100">
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>

                {/* Liens */}
                <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                  {isAdminPage && isAdmin ? (
                    <AdminSideNav
                      currentPageName={currentPageName}
                      isSuperAdmin={isSuperAdmin}
                      userPermissions={userPermissions}
                      pendingOrders={pendingOrders.length}
                      onClose={() => setMobileMenuOpen(false)}
                    />
                  ) : (
                    filteredLinks.map(link => (
                      <Link
                        key={link.page}
                        to={createPageUrl(link.page)}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Button
                          variant={currentPageName === link.page ? 'secondary' : 'ghost'}
                          className="w-full justify-start rounded-xl"
                        >
                          <link.icon className="w-4 h-4 mr-2" />
                          {link.name}
                        </Button>
                      </Link>
                    ))
                  )}

                  {isAdmin && (
                    <Link
                      to={createPageUrl(isAdminPage ? 'Home' : 'AdminDashboard')}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Button variant="outline" className="w-full justify-start rounded-xl mt-2">
                        {isAdminPage ? <><Home className="w-4 h-4 mr-2" />Boutique</> : <><Settings className="w-4 h-4 mr-2" />Administration</>}
                      </Button>
                    </Link>
                  )}
                  {isDeliverer && (
                    <Link
                      to={createPageUrl(isDelivererPage ? 'Home' : 'DelivererDashboard')}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Button variant="outline" className="w-full justify-start rounded-xl mt-2">
                        {isDelivererPage ? <><Home className="w-4 h-4 mr-2" />Boutique</> : <><Truck className="w-4 h-4 mr-2" />Livraisons</>}
                      </Button>
                    </Link>
                  )}
                  {!isAdminPage && !isDelivererPage && isDeliverer && (
                    <Link
                      to={createPageUrl('DelivererDashboard')}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Button variant="outline" className="w-full justify-start rounded-xl">
                        <Truck className="w-4 h-4 mr-2" />Espace Livreur
                      </Button>
                    </Link>
                  )}
                </nav>

                {/* Footer du drawer */}
                {user ? (
                  <div className="px-5 py-4 border-t border-slate-100">
                    <p className="text-sm text-slate-500 truncate">{user.email}</p>
                  </div>
                ) : (
                  <div className="px-5 py-4 border-t border-slate-100">
                    <Button
                      onClick={() => { setMobileMenuOpen(false); base44.auth.redirectToLogin(createPageUrl('Profile')); }}
                      className="w-full rounded-xl"
                      style={{ backgroundColor: '#008000' }}
                    >
                      S'inscrire / Se connecter
                    </Button>
                  </div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Main Content */}
        {isAdminPage && isAdmin ? (
          <div className="flex min-h-screen">
            {/* Admin Sidebar */}
            <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-slate-200 bg-white sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto p-3">
              <AdminSideNav
                currentPageName={currentPageName}
                isSuperAdmin={isSuperAdmin}
                userPermissions={userPermissions}
                pendingOrders={pendingOrders.length}
                onClose={() => {}}
              />
            </aside>
            <main className="flex-1 min-w-0 pb-16 md:pb-0">
              {children}
            </main>
          </div>
        ) : (
          <main>
            {children}
            {/* Spacer pour éviter que le contenu soit caché par la barre du bas */}
            {!isAdminPage && !isDelivererPage && (
              <div style={{ height: 'calc(64px + env(safe-area-inset-bottom))' }} />
            )}
          </main>
        )}

        <UpdatePrompt />

        {/* Bottom Tab Bar Admin - visible sur mobile/tablette uniquement */}
        {isAdminPage && isAdmin && (
          <>
            <AdminBottomTabBar
              currentPageName={currentPageName}
              isSuperAdmin={isSuperAdmin}
              userPermissions={userPermissions}
              pendingOrders={pendingOrders.length}
              unreadMessages={unreadMessageCount}
              onOpenMenu={() => setMobileMenuOpen(true)}
            />
            <AdminFloatingCart
              cartCount={cartCount}
              cartItems={displayCart}
              cartTotal={cartTotal}
              onUpdateQuantity={handleUpdateQuantity}
              onRemove={handleRemove}
              user={user}
              guestCart={guestCart}
              setGuestCart={setGuestCart}
            />
          </>
        )}

        {/* Bottom Tab Bar - visible sur tous les appareils pour les clients */}
        {!isAdminPage && !isDelivererPage && (
          <BottomTabBar
            onOpenCart={() => setCartOpen(true)}
            onOpenMenu={() => setMobileMenuOpen(true)}
            cartCount={cartCount}
            unreadMessages={unreadMessageCount}
          />
        )}

        {/* Cart Drawer */}
        <CartDrawer
          open={cartOpen}
          onClose={() => setCartOpen(false)}
          items={displayCart}
          onUpdateQuantity={handleUpdateQuantity}
          onRemove={handleRemove}
          total={cartTotal}
          user={user}
          guestCart={guestCart}
          setGuestCart={setGuestCart}
        />
        </div>
        </MaintenanceMode>
      </PullToRefresh>
      </ErrorBoundary>
      );
}