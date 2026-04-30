import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Truck, CheckCircle, XCircle, Euro, Activity, Clock, MapPin, Banknote, ArrowLeft, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AdminDelivererTracking() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u?.role !== 'admin') {
        navigate(createPageUrl('Home'));
      } else {
        setUser(u);
      }
    });
  }, [navigate]);

  // Rafraîchissement automatique toutes les 10 secondes
  const { data: deliverers = [] } = useQuery({
    queryKey: ['deliverers'],
    queryFn: () => base44.entities.Deliverer.list(),
    enabled: !!user,
    refetchInterval: 10000
  });

  const { data: allOrders = [] } = useQuery({
    queryKey: ['allOrders'],
    queryFn: () => base44.entities.Order.list('-updated_date'),
    enabled: !!user,
    refetchInterval: 10000
  });

  const { data: cashCollections = [] } = useQuery({
    queryKey: ['allCashCollections'],
    queryFn: () => base44.entities.CashCollection.list('-collection_date'),
    enabled: !!user,
    refetchInterval: 10000
  });

  // Commandes livrées dans les dernières 24h
  const recentDeliveries = allOrders.filter(order => {
    if (!order.delivered_date) return false;
    const deliveryTime = new Date(order.delivered_date);
    const now = new Date();
    const diff = now - deliveryTime;
    return diff <= 24 * 60 * 60 * 1000; // 24 heures
  }).sort((a, b) => new Date(b.delivered_date) - new Date(a.delivered_date));

  // Échecs de livraison dans les dernières 24h
  const recentFailures = allOrders.filter(order => {
    if (order.status !== 'failed_delivery' || !order.delivered_date) return false;
    const failureTime = new Date(order.delivered_date);
    const now = new Date();
    const diff = now - failureTime;
    return diff <= 24 * 60 * 60 * 1000;
  }).sort((a, b) => new Date(b.delivered_date) - new Date(a.delivered_date));

  // Collectes d'espèces par livreur (non archivées)
  const cashByDeliverer = deliverers.map(deliverer => {
    const collections = cashCollections.filter(c => 
      c.deliverer_email === deliverer.email && !c.is_archived
    );
    const total = collections.reduce((sum, c) => sum + (c.amount || 0), 0);
    return {
      ...deliverer,
      cashBalance: total,
      collectionsCount: collections.length
    };
  }).filter(d => d.cashBalance > 0);

  // Livreurs actifs avec leurs statistiques
  const activeDeliverers = deliverers.filter(d => d.is_active).map(deliverer => {
    const assignedOrders = allOrders.filter(o => 
      o.assigned_deliverer === deliverer.email && o.status === 'shipped'
    );
    const todayDeliveries = recentDeliveries.filter(o => 
      o.assigned_deliverer === deliverer.email
    );
    const todayFailures = recentFailures.filter(o => 
      o.assigned_deliverer === deliverer.email
    );
    
    return {
      ...deliverer,
      activeDeliveries: assignedOrders.length,
      todaySuccess: todayDeliveries.length,
      todayFailures: todayFailures.length,
      lastActivity: [...todayDeliveries, ...todayFailures][0]?.delivered_date
    };
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link to={createPageUrl('AdminDashboard')}>
            <Button variant="outline" size="icon" className="rounded-xl">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Activity className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Suivi Livreurs en Temps Réel</h1>
              <p className="text-slate-500">Mise à jour automatique toutes les 10 secondes</p>
            </div>
          </div>
          <Link to={createPageUrl('AdminDelivererPreview')}>
            <Button variant="outline" className="rounded-xl">
              <Eye className="w-4 h-4 mr-2" />
              Prévisualiser interface livreur
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-0 shadow-lg rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Livreurs actifs</p>
                  <p className="text-3xl font-bold text-slate-800">
                    {activeDeliverers.filter(d => d.activeDeliveries > 0).length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Truck className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Livraisons (24h)</p>
                  <p className="text-3xl font-bold text-green-600">
                    {recentDeliveries.length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Échecs (24h)</p>
                  <p className="text-3xl font-bold text-rose-600">
                    {recentFailures.length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-rose-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Espèces à remettre</p>
                  <p className="text-3xl font-bold text-emerald-600">
                    {cashCollections.filter(c => !c.is_archived).reduce((sum, c) => sum + c.amount, 0).toFixed(2)}€
                  </p>
                </div>
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Euro className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="activity" className="space-y-6">
          <TabsList className="bg-white border rounded-xl p-1">
            <TabsTrigger value="activity" className="rounded-lg">
              Activité Récente
            </TabsTrigger>
            <TabsTrigger value="deliverers" className="rounded-lg">
              Livreurs Actifs ({activeDeliverers.length})
            </TabsTrigger>
            <TabsTrigger value="cash" className="rounded-lg">
              Collectes Espèces ({cashByDeliverer.length})
            </TabsTrigger>
          </TabsList>

          {/* Activité Récente */}
          <TabsContent value="activity">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Livraisons réussies */}
              <Card className="border-0 shadow-lg rounded-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    Livraisons réussies (24h)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {recentDeliveries.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      Aucune livraison récente
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[600px] overflow-y-auto">
                      {recentDeliveries.map(order => {
                        const deliverer = deliverers.find(d => d.email === order.assigned_deliverer);
                        return (
                          <div key={order.id} className="p-4 bg-green-50 border border-green-200 rounded-xl">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="font-semibold text-slate-800">
                                  {deliverer?.full_name || 'Livreur inconnu'}
                                </p>
                                <p className="text-sm text-slate-600">
                                  Commande #{order.id.slice(-8).toUpperCase()}
                                </p>
                              </div>
                              <Badge className="bg-green-600 text-white">
                                {order.total_amount?.toFixed(2)}€
                              </Badge>
                            </div>
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center gap-2 text-slate-600">
                                <Clock className="w-4 h-4" />
                                {format(new Date(order.delivered_date), "dd/MM/yyyy 'à' HH:mm", { locale: fr })}
                              </div>
                              <div className="flex items-start gap-2 text-slate-600">
                                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span>{order.delivery_address}</span>
                              </div>
                              {order.payment_method === 'delivery' && (
                                <div className="flex items-center gap-2 text-green-700 font-medium">
                                  <Banknote className="w-4 h-4" />
                                  {order.cash_collected?.toFixed(2)}€ collectés
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Échecs de livraison */}
              <Card className="border-0 shadow-lg rounded-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-rose-600" />
                    Échecs de livraison (24h)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {recentFailures.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      Aucun échec récent
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[600px] overflow-y-auto">
                      {recentFailures.map(order => {
                        const deliverer = deliverers.find(d => d.email === order.assigned_deliverer);
                        return (
                          <div key={order.id} className="p-4 bg-rose-50 border border-rose-200 rounded-xl">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="font-semibold text-slate-800">
                                  {deliverer?.full_name || 'Livreur inconnu'}
                                </p>
                                <p className="text-sm text-slate-600">
                                  Commande #{order.id.slice(-8).toUpperCase()}
                                </p>
                              </div>
                              <Badge variant="outline" className="border-rose-600 text-rose-600">
                                Échec
                              </Badge>
                            </div>
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center gap-2 text-slate-600">
                                <Clock className="w-4 h-4" />
                                {format(new Date(order.delivered_date), "dd/MM/yyyy 'à' HH:mm", { locale: fr })}
                              </div>
                              <div className="flex items-start gap-2 text-slate-600">
                                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span>{order.delivery_address}</span>
                              </div>
                              {order.delivery_failure_reason && (
                                <div className="mt-2 p-2 bg-rose-100 rounded text-rose-700">
                                  <strong>Motif:</strong> {order.delivery_failure_reason}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Livreurs Actifs */}
          <TabsContent value="deliverers">
            <Card className="border-0 shadow-lg rounded-2xl">
              <CardHeader>
                <CardTitle>État des livreurs</CardTitle>
              </CardHeader>
              <CardContent>
                {activeDeliverers.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    Aucun livreur actif
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeDeliverers.map(deliverer => (
                      <div key={deliverer.id} className="p-4 border-2 border-slate-200 rounded-xl hover:border-blue-400 transition-colors">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-slate-800">{deliverer.full_name}</h3>
                            <p className="text-sm text-slate-500">{deliverer.phone}</p>
                          </div>
                          {deliverer.activeDeliveries > 0 && (
                            <Badge className="bg-blue-600 text-white">
                              {deliverer.activeDeliveries} en cours
                            </Badge>
                          )}
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600">Livrées (24h)</span>
                            <span className="font-semibold text-green-600">{deliverer.todaySuccess}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600">Échecs (24h)</span>
                            <span className="font-semibold text-rose-600">{deliverer.todayFailures}</span>
                          </div>
                          {deliverer.lastActivity && (
                            <div className="pt-2 border-t text-xs text-slate-500">
                              Dernière activité: {format(new Date(deliverer.lastActivity), "HH:mm", { locale: fr })}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Collectes Espèces */}
          <TabsContent value="cash">
            <Card className="border-0 shadow-lg rounded-2xl">
              <CardHeader>
                <CardTitle>Soldes espèces par livreur</CardTitle>
              </CardHeader>
              <CardContent>
                {cashByDeliverer.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    Aucune collecte en attente
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cashByDeliverer.map(deliverer => {
                      const collections = cashCollections.filter(c => 
                        c.deliverer_email === deliverer.email && !c.is_archived
                      );
                      return (
                        <div key={deliverer.id} className="p-4 border-2 border-emerald-200 bg-emerald-50 rounded-xl">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h3 className="font-semibold text-slate-800">{deliverer.full_name}</h3>
                              <p className="text-sm text-slate-600">
                                {deliverer.collectionsCount} collecte{deliverer.collectionsCount > 1 ? 's' : ''}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-emerald-600">
                                {deliverer.cashBalance.toFixed(2)}€
                              </p>
                              <Badge className="bg-emerald-600 text-white mt-1">
                                À remettre
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="space-y-1 border-t pt-3">
                            {collections.map(collection => (
                              <div key={collection.id} className="flex items-center justify-between text-sm">
                                <span className="text-slate-600">
                                  #{collection.order_id.slice(-8)} - {format(new Date(collection.collection_date), "dd/MM 'à' HH:mm", { locale: fr })}
                                </span>
                                <span className="font-medium text-slate-800">
                                  {collection.amount.toFixed(2)}€
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}