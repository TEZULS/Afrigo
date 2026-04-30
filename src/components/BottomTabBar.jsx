import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, ShoppingCart, ShoppingBag, User, Menu } from 'lucide-react';
import { createPageUrl } from '@/utils';

const tabs = [
  { name: 'Accueil', page: 'Home', icon: Home, path: '/' },
  { name: 'Commandes', page: 'Orders', icon: ShoppingBag, path: null },
  { name: 'Panier', page: null, icon: ShoppingCart, action: 'cart' },
  { name: 'Profil', page: 'Profile', icon: User, path: null },
  { name: 'Menu', page: null, icon: Menu, action: 'menu' },
];

export default function BottomTabBar({ onOpenCart, onOpenMenu, cartCount = 0, unreadMessages = 0 }) {
  const location = useLocation();
  const [hidden, setHidden] = React.useState(false);
  const lastScrollY = React.useRef(0);

  React.useEffect(() => {
    let scrollTimeout;
    
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const isScrollingDown = currentScrollY > lastScrollY.current;
      
      // Afficher immédiatement si on défile vers le haut
      if (!isScrollingDown) {
        setHidden(false);
      } 
      // Cacher si on défile vers le bas
      else if (isScrollingDown && currentScrollY > 100) {
        setHidden(true);
      }
      lastScrollY.current = currentScrollY;

      // Réafficher après arrêt du scroll
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        setHidden(false);
      }, 500);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, []);

  const isActive = (tab) => {
    if (tab.page === 'Home' && tab.path === '/') {
      return location.pathname === '/';
    }
    if (tab.page) {
      return location.pathname === `/${tab.page}`;
    }
    return false;
  };

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-stretch transition-transform duration-300 ease-out ${
        hidden ? 'translate-y-full' : 'translate-y-0'
      }`}
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)', minHeight: '72px' }}
    >
      {tabs.map((tab) => {
        const active = isActive(tab);
        const Icon = tab.icon;

        if (tab.action === 'menu') {
          return (
            <button
              key="menu"
              onClick={onOpenMenu}
              className="flex-1 flex flex-col items-center justify-center py-3 gap-1 relative active:scale-95 transition-transform duration-200"
            >
              <div className="p-2 md:p-3 rounded-full transition-colors duration-200">
                <Icon className="w-5 h-5 md:w-6 md:h-6 text-slate-500 dark:text-slate-400" />
              </div>
              <span className="text-[10px] md:text-xs font-semibold text-slate-500 dark:text-slate-400">
                {tab.name}
              </span>
            </button>
          );
        }

        if (tab.action === 'cart') {
          return (
            <button
              key="cart"
              onClick={onOpenCart}
              className="flex-1 flex flex-col items-center justify-center py-3 gap-1 relative active:scale-95 transition-transform duration-200"
            >
              <div className="relative">
                <div className={`p-2 md:p-3 rounded-full transition-colors duration-200`}>
                  <Icon className={`w-8 h-8 md:w-9 md:h-9 transition-colors duration-200 ${
                    active ? 'text-orange-500' : 'text-slate-500 dark:text-slate-400'
                  }`} />
                </div>
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[1.3rem] h-5 px-1 bg-orange-500 dark:bg-orange-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] md:text-xs font-semibold transition-colors duration-200 ${
                active ? 'text-orange-500' : 'text-slate-500 dark:text-slate-400'
              }`}>
                {tab.name}
              </span>
            </button>
          );
        }

        const href = tab.path || (tab.page ? createPageUrl(tab.page) : '#');

        return (
          <Link
            key={tab.page + (tab.path || '')}
            to={href}
            className="flex-1 flex flex-col items-center justify-center py-3 gap-1 active:scale-95 transition-transform duration-200"
          >
            <div className={`relative p-2 md:p-3 rounded-full transition-colors duration-200 ${
              active ? 'bg-orange-100 dark:bg-orange-900/30' : ''
            }`}>
              <Icon className={`w-5 h-5 md:w-6 md:h-6 transition-colors duration-200 ${
                active ? 'text-orange-500 dark:text-orange-400' : 'text-slate-500 dark:text-slate-400'
              }`} />
              {tab.page === 'Messages' && unreadMessages > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[1.2rem] h-5 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadMessages > 99 ? '99+' : unreadMessages}
                </span>
              )}
            </div>
            <span className={`text-[10px] md:text-xs font-semibold transition-colors duration-200 ${
              active ? 'text-orange-500 dark:text-orange-400' : 'text-slate-500 dark:text-slate-400'
            }`}>
              {tab.name}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}