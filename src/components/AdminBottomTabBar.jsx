import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { LayoutDashboard, ShoppingBag, Package, MessageCircle, Menu } from 'lucide-react';

const tabs = [
  { name: 'Dashboard', page: 'AdminDashboard', icon: LayoutDashboard, permission: 'dashboard' },
  { name: 'Commandes', page: 'AdminOrders', icon: ShoppingBag, permission: 'orders' },
  { name: 'Produits', page: 'AdminProducts', icon: Package, permission: 'products' },
  { name: 'Messages', page: 'AdminMessages', icon: MessageCircle, permission: 'messages' },
];

export default function AdminBottomTabBar({ currentPageName, isSuperAdmin, userPermissions, pendingOrders, unreadMessages = 0, onOpenMenu }) {
  const hasPermission = (permission) => isSuperAdmin || userPermissions.includes(permission);

  const visibleTabs = tabs.filter(tab => hasPermission(tab.permission));

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-2 border-slate-200 flex items-stretch shadow-[0_-2px_10px_rgba(0,0,0,0.08)] md:hidden"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)', minHeight: '80px' }}
    >
      {visibleTabs.map((tab) => {
        const active = currentPageName === tab.page;
        const Icon = tab.icon;
        const href = createPageUrl(tab.page);

        return (
          <Link
            key={tab.page}
            to={href}
            className="flex-1 flex flex-col items-center justify-center py-3 gap-1"
          >
            <div className={`p-2 rounded-full relative ${active ? 'bg-orange-100' : ''}`}>
              <Icon className={`w-6 h-6 ${active ? 'text-orange-500' : 'text-slate-500'}`} />
              {tab.page === 'AdminOrders' && pendingOrders > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[1.2rem] h-5 px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {pendingOrders}
                </span>
              )}
              {tab.page === 'AdminMessages' && unreadMessages > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[1.2rem] h-5 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadMessages > 99 ? '99+' : unreadMessages}
                </span>
              )}
            </div>
            <span className={`text-[10px] font-semibold ${active ? 'text-orange-500' : 'text-slate-500'}`}>
              {tab.name}
            </span>
          </Link>
        );
      })}

      {/* Bouton Menu */}
      <button
        onClick={onOpenMenu}
        className="flex-1 flex flex-col items-center justify-center py-3 gap-1"
      >
        <div className="p-2 rounded-full">
          <Menu className="w-6 h-6 text-slate-500" />
        </div>
        <span className="text-[10px] font-semibold text-slate-500">Menu</span>
      </button>
    </nav>
  );
}