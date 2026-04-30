import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, TrendingUp, ShoppingBag, Calendar, ArrowLeft, Crown } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function AdminTopCustomers() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u.role !== 'admin') {
        navigate(createPageUrl('Home'));
      } else {
        setUser(u);
      }
    }).catch(() => navigate(createPageUrl('Home')));
  }, [navigate]);

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user
  });

  const { data: allOrders = [] } = useQuery({
    queryKey: ['all-orders'],
    queryFn: () => base44.entities.Order.list('-created_date'),
    enabled: !!user
  });

  // Analyser les données clients
  const customersStats = users.map(customer => {
    const customerOrders = allOrders.filter(o => o.customer_email === customer.email);
    const totalSpent = customerOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const ordersCount = customerOrders.length;
    
    // Dernière commande
    const lastOrder = customerOrders[0];
    const daysSinceLastOrder = lastOrder ? differenceInDays(new Date(), new Date(lastOrder.created_date)) : null;
    
    // Première commande
    const firstOrder = customerOrders[customerOrders.length - 1];
    const daysSinceFirstOrder = firstOrder ? differenceInDays(new Date(), new Date(firstOrder.created_date)) : 0;
    
    // Fréquence d'achat (commandes par mois)
    const frequency = daysSinceFirstOrder > 0 ? (ordersCount / (daysSinceFirstOrder / 30)) : 0;
    
    // Panier moyen
    const averageBasket = ordersCount > 0 ? totalSpent / ordersCount : 0;
    
    return {
      ...customer,
      totalSpent,
      ordersCount,
      lastOrder,
      daysSinceLastOrder,
      frequency,
      averageBasket
    };
  }).filter(c => c.ordersCount > 0);

  // Top par montant dépensé
  const topBySpending = [...customersStats].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 20);
  
  // Top par nombre de commandes
  const topByOrders = [...customersStats].sort((a, b) => b.ordersCount - a.ordersCount).slice(0, 20);
  
  // Top par fréquence d'achat
  const topByFrequency = [...customersStats]
    .filter(c => c.ordersCount >= 2)
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 20);
  
  // Clients actifs récents (commandé dans les 30 derniers jours)
  const recentActive = [...customersStats]
    .filter(c => c.daysSinceLastOrder !== null && c.daysSinceLastOrder <= 30)
    .sort((a, b) => a.daysSinceLastOrder - b.daysSinceLastOrder)
    .slice(0, 20);

  const renderCustomerRow = (customer, rank, showMetric) => (
    <TableRow key={customer.email}>
      <TableCell>
        <div className="flex items-center gap-2">
          {rank <= 3 && (
            <Crown className={`w-5 h-5 ${
              rank === 1 ? 'text-yellow-500' : 
              rank === 2 ? 'text-slate-400' : 
              'text-amber-600'
            }`} />
          )}
          <span className="font-semibold text-slate-600">#{rank}</span>
        </div>
      </TableCell>
      <TableCell>
        <div>
          <p className="font-medium">{customer.first_name} {customer.last_name}</p>
          <p className="text-xs text-slate-500">{customer.customer_id || customer.email}</p>
        </div>
      </TableCell>
      <TableCell>
        <span className="font-semibold text-emerald-600">
          {customer.totalSpent.toFixed(2)}€
        </span>
      </TableCell>
      <TableCell>
        <Badge variant="outline">{customer.ordersCount} commandes</Badge>
      </TableCell>
      <TableCell>
        <span className="text-sm">{customer.averageBasket.toFixed(2)}€</span>
      </TableCell>
      <TableCell>
        {customer.lastOrder && (
          <div>
            <p className="text-sm">{format(new Date(customer.lastOrder.created_date), 'dd/MM/yyyy', { locale: fr })}</p>
            <p className="text-xs text-slate-500">
              Il y a {customer.daysSinceLastOrder} jour{customer.daysSinceLastOrder > 1 ? 's' : ''}
            </p>
          </div>
        )}
      </TableCell>
      {showMetric && (
        <TableCell>
          <span className="font-medium text-blue-600">
            {showMetric === 'frequency' ? `${customer.frequency.toFixed(1)}/mois` : showMetric}
          </span>
        </TableCell>
      )}
    </TableRow>
  );

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Link to={createPageUrl('AdminDashboard')} className="inline-flex items-center text-slate-600 hover:text-emerald-600 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour au tableau de bord
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
            <Trophy className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Meilleurs Clients</h1>
            <p className="text-slate-500">Analyse de vos clients les plus fidèles</p>
          </div>
        </div>

        {/* Stats globales */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Clients actifs</p>
                  <p className="text-2xl font-bold text-slate-800">{customersStats.length}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 mb-1">CA total</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {customersStats.reduce((sum, c) => sum + c.totalSpent, 0).toFixed(2)}€
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-emerald-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Panier moyen</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {customersStats.length > 0 
                      ? (customersStats.reduce((sum, c) => sum + c.totalSpent, 0) / 
                         customersStats.reduce((sum, c) => sum + c.ordersCount, 0)).toFixed(2)
                      : '0.00'}€
                  </p>
                </div>
                <ShoppingBag className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Actifs (30j)</p>
                  <p className="text-2xl font-bold text-slate-800">{recentActive.length}</p>
                </div>
                <Calendar className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs avec différents classements */}
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-6">
            <Tabs defaultValue="spending" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="spending">Par montant</TabsTrigger>
                <TabsTrigger value="orders">Par commandes</TabsTrigger>
                <TabsTrigger value="frequency">Par fréquence</TabsTrigger>
                <TabsTrigger value="recent">Actifs récents</TabsTrigger>
              </TabsList>

              <TabsContent value="spending">
                <div className="mt-4">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                    Top 20 - Montant total dépensé
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rang</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Total dépensé</TableHead>
                        <TableHead>Commandes</TableHead>
                        <TableHead>Panier moyen</TableHead>
                        <TableHead>Dernière commande</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topBySpending.map((customer, index) => 
                        renderCustomerRow(customer, index + 1)
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="orders">
                <div className="mt-4">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-blue-600" />
                    Top 20 - Nombre de commandes
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rang</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Total dépensé</TableHead>
                        <TableHead>Commandes</TableHead>
                        <TableHead>Panier moyen</TableHead>
                        <TableHead>Dernière commande</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topByOrders.map((customer, index) => 
                        renderCustomerRow(customer, index + 1)
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="frequency">
                <div className="mt-4">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-purple-600" />
                    Top 20 - Fréquence d'achat (minimum 2 commandes)
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rang</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Total dépensé</TableHead>
                        <TableHead>Commandes</TableHead>
                        <TableHead>Panier moyen</TableHead>
                        <TableHead>Dernière commande</TableHead>
                        <TableHead>Fréquence</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topByFrequency.map((customer, index) => 
                        renderCustomerRow(customer, index + 1, 'frequency')
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="recent">
                <div className="mt-4">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-orange-600" />
                    Clients actifs (30 derniers jours)
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rang</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Total dépensé</TableHead>
                        <TableHead>Commandes</TableHead>
                        <TableHead>Panier moyen</TableHead>
                        <TableHead>Dernière commande</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentActive.map((customer, index) => 
                        renderCustomerRow(customer, index + 1)
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}