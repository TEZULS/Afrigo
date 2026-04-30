import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Package, ShoppingBag, Users, TrendingUp, 
  AlertTriangle, Clock, CheckCircle, BarChart3
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { format, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function AdminDashboard() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Vérifier d'abord la connexion normale (pour super admin)
    base44.auth.me()
      .then(u => {
        if (u.role === 'admin') {
          setUser(u);
          return;
        }
        throw new Error('Not admin');
      })
      .catch(() => {
        // Si pas connecté normalement, vérifier session admin
        const session = localStorage.getItem('admin_session');
        if (!session) {
          navigate(createPageUrl('AdminLogin'));
          return;
        }

        const parsed = JSON.parse(session);
        if (parsed.expires < Date.now()) {
          localStorage.removeItem('admin_session');
          navigate(createPageUrl('AdminLogin'));
          return;
        }

        // Créer un objet user à partir de la session
        setUser({ email: parsed.email, role: 'admin', username: parsed.username });
      });
  }, [navigate]);

  const { data: allOrders = [] } = useQuery({
    queryKey: ['all-orders'],
    queryFn: () => base44.entities.Order.list('-created_date'),
    enabled: !!user
  });

  // Afficher toutes les commandes sauf celles annulées avec paiement échoué
  const orders = allOrders.filter(order => {
    // Exclure les commandes annulées avec paiement échoué (abandons)
    if (order.status === 'cancelled' && order.payment_status === 'failed') return false;
    return true;
  });

  const { data: products = [] } = useQuery({
    queryKey: ['all-products'],
    queryFn: () => base44.entities.Product.list(),
    enabled: !!user
  });

  const { data: returns = [] } = useQuery({
    queryKey: ['all-returns'],
    queryFn: () => base44.entities.Return.list('-created_date'),
    enabled: !!user
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['all-messages'],
    queryFn: () => base44.entities.Message.filter({ is_read: false }),
    enabled: !!user
  });

  // Stats du jour uniquement (réinitialisation automatique à 00h00)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayOrders = orders.filter(o => new Date(o.created_date) >= today);
  const totalRevenue = todayOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const pendingOrders = orders.filter(o => ['pending', 'confirmed', 'preparing'].includes(o.status));
  const lowStockProducts = products.filter(p => p.stock_quantity <= 5);
  const pendingReturns = returns.filter(r => r.status === 'pending');

  // Chart data
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dayOrders = orders.filter(o => {
      const orderDate = new Date(o.created_date);
      return orderDate.toDateString() === date.toDateString();
    });
    return {
      date: format(date, 'EEE', { locale: fr }),
      orders: dayOrders.length,
      revenue: dayOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0)
    };
  });

  const categoryStats = products.reduce((acc, p) => {
    const cat = p.category || 'other';
    if (!acc[cat]) acc[cat] = 0;
    acc[cat]++;
    return acc;
  }, {});

  const categoryChartData = Object.entries(categoryStats).map(([name, count]) => ({
    name: name.replace(/_/g, ' '),
    count
  }));

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800">Tableau de bord</h1>
          <p className="text-slate-500">Statistiques du jour — {format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { title: 'CA du jour', value: `${totalRevenue.toFixed(0)}€`, icon: TrendingUp, color: 'emerald' },
            { title: 'Commandes du jour', value: todayOrders.length, icon: ShoppingBag, color: 'blue' },
            { title: 'Produits', value: products.length, icon: Package, color: 'purple' },
            { title: 'Messages non lus', value: messages.length, icon: Users, color: 'amber' },
          ].map((stat, i) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="border-0 shadow-sm rounded-2xl">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-slate-500 mb-1">{stat.title}</p>
                      <p className="text-3xl font-bold text-slate-800">{stat.value}</p>
                    </div>
                    <div className={`w-12 h-12 bg-${stat.color}-100 rounded-xl flex items-center justify-center`}>
                      <stat.icon className={`w-6 h-6 text-${stat.color}-500`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Alerts */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Link to={createPageUrl('AdminOrders')}>
            <Card className="border-0 shadow-sm rounded-2xl bg-amber-50 hover:shadow-md transition-all cursor-pointer">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="font-semibold text-amber-800">{pendingOrders.length} commandes en attente</p>
                  <p className="text-sm text-amber-600">À traiter</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to={createPageUrl('AdminProducts')}>
            <Card className="border-0 shadow-sm rounded-2xl bg-rose-50 hover:shadow-md transition-all cursor-pointer">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-rose-600" />
                </div>
                <div>
                  <p className="font-semibold text-rose-800">{lowStockProducts.length} stocks faibles</p>
                  <p className="text-sm text-rose-600">À réapprovisionner</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to={createPageUrl('AdminReturns')}>
            <Card className="border-0 shadow-sm rounded-2xl bg-blue-50 hover:shadow-md transition-all cursor-pointer">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-blue-800">{pendingReturns.length} retours en attente</p>
                  <p className="text-sm text-blue-600">À valider</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-500" />
                Ventes des 7 derniers jours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={last7Days}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: 'none', 
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' 
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    dot={{ fill: '#10b981', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-500" />
                Produits par catégorie
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={categoryChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" stroke="#64748b" />
                  <YAxis dataKey="name" type="category" stroke="#64748b" width={100} />
                  <Tooltip
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: 'none', 
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' 
                    }}
                  />
                  <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}