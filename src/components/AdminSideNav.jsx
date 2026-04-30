import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Home, User, ShoppingBag, ShoppingCart, Package, MessageCircle,
  Settings, LayoutDashboard, RotateCcw, QrCode, MapPin, Star, Banknote,
  History, Users, Handshake, Sparkles, Calendar, Truck, Eye, Bell,
  CreditCard, Tag, Mail, BarChart3, ShieldCheck, Search, ChevronDown, ChevronRight
} from 'lucide-react';

const adminGroups = [
  {
    label: '📊 Vue générale',
    links: [
      { name: 'Tableau de bord', page: 'AdminDashboard', icon: LayoutDashboard, permission: 'dashboard' },
      { name: 'Historique revenus', page: 'AdminRevenueHistory', icon: BarChart3, permission: 'dashboard' },
    ]
  },
  {
    label: '👥 Clients',
    links: [
      { name: 'Utilisateurs', page: 'AdminUsers', icon: Users, permission: 'users' },
      { name: 'Visiteurs', page: 'AdminVisitors', icon: Eye, permission: 'users' },
      { name: 'Meilleurs clients', page: 'AdminTopCustomers', icon: Star, permission: 'top_customers' },
      { name: 'Historique clients', page: 'AdminCustomerHistory', icon: History, permission: 'customer_history' },
    ]
  },
  {
    label: '🛍️ Catalogue',
    links: [
      { name: 'Produits', page: 'AdminProducts', icon: Package, permission: 'products' },
      { name: 'Avis clients', page: 'AdminReviews', icon: Star, permission: 'reviews' },
    ]
  },
  {
    label: '📦 Commandes',
    links: [
      { name: 'Commandes', page: 'AdminOrders', icon: ShoppingBag, permission: 'orders', badge: true },
      { name: 'Paniers clients', page: 'AdminCarts', icon: ShoppingCart, permission: 'orders' },
      { name: 'Retours', page: 'AdminReturns', icon: RotateCcw, permission: 'returns' },
    ]
  },
  {
    label: '🚚 Livraison',
    links: [
      { name: 'Zones de livraison', page: 'AdminDeliveryZones', icon: MapPin, permission: 'delivery' },
      { name: 'Créneaux horaires', page: 'AdminDeliverySlots', icon: Calendar, permission: 'delivery' },
      { name: 'Assignation manuelle', page: 'AdminManualAssignment', icon: Truck, permission: 'delivery' },
      { name: 'Suivi temps réel', page: 'AdminDelivererTracking', icon: Truck, permission: 'delivery' },
    ]
  },
  {
    label: '🎁 Fidélité & Promo',
    links: [
      { name: 'Fidélité', page: 'AdminLoyalty', icon: Star, permission: 'loyalty' },
      { name: 'Parrainages', page: 'AdminReferrals', icon: Handshake, permission: 'referrals' },
      { name: 'Codes promo', page: 'AdminPromoCodes', icon: Tag, permission: 'settings' },
      { name: 'Portefeuilles', page: 'AdminWallet', icon: Banknote, permission: 'wallet' },
      { name: 'QR Code', page: 'AdminQRCode', icon: QrCode, permission: 'qrcode' },
    ]
  },
  {
    label: '💬 Communication',
    links: [
      { name: 'Messages', page: 'AdminMessages', icon: MessageCircle, permission: 'messages' },
      { name: 'Diffusion messages', page: 'AdminBroadcast', icon: Mail, permission: 'messages' },
      { name: 'Message bienvenue', page: 'AdminWelcomeMessage', icon: Sparkles, permission: 'welcome_message' },
    ]
  },
  {
    label: '⚙️ Configuration',
    links: [
      { name: 'Paiement Stripe', page: 'AdminPayment', icon: CreditCard, permission: 'settings' },
      { name: 'Notifications (son)', page: 'AdminNotifications', icon: Bell, permission: 'settings' },
      { name: 'Paramètres', page: 'AdminSettings', icon: Settings, permission: 'settings' },
      { name: 'Règlement intérieur', page: 'AdminInternalRegulations', icon: ShieldCheck, permission: 'settings' },
      { name: 'Politique confidentialité', page: 'AdminPrivacyPolicy', icon: ShieldCheck, permission: 'settings' },
      { name: 'Gestion admins', page: 'AdminManagement', icon: Settings, permission: 'admin_management' },
    ]
  },
];

export default function AdminSideNav({ currentPageName, isSuperAdmin, userPermissions, pendingOrders, onClose }) {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState({});

  const toggleGroup = (label) => {
    setCollapsed(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const hasPermission = (permission) => isSuperAdmin || userPermissions.includes(permission);

  const filterLink = (link) => {
    if (!hasPermission(link.permission)) return false;
    if (search) return link.name.toLowerCase().includes(search.toLowerCase());
    return true;
  };

  const visibleGroups = adminGroups.map(group => ({
    ...group,
    links: group.links.filter(filterLink)
  })).filter(group => group.links.length > 0);

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          type="text"
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 pl-9 pr-3 rounded-xl border-slate-200 text-sm"
        />
      </div>

      {/* Groups */}
      <div className="space-y-1 overflow-y-auto flex-1">
        {visibleGroups.map((group) => {
          const isOpen = search ? true : !collapsed[group.label];
          return (
            <div key={group.label}>
              {!search && (
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-700 transition-colors"
                >
                  <span>{group.label}</span>
                  {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
              )}
              {isOpen && (
                <div className="space-y-0.5">
                  {group.links.map(link => (
                    <Link
                      key={link.page}
                      to={createPageUrl(link.page)}
                      onClick={onClose}
                    >
                      <Button
                        variant={currentPageName === link.page ? 'secondary' : 'ghost'}
                        className="w-full justify-start rounded-lg h-8 text-sm px-2 relative"
                      >
                        <link.icon className="w-4 h-4 mr-2 shrink-0" />
                        <span className="truncate">{link.name}</span>
                        {link.badge && pendingOrders > 0 && (
                          <span className="ml-auto w-5 h-5 bg-rose-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                            {pendingOrders}
                          </span>
                        )}
                      </Button>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}