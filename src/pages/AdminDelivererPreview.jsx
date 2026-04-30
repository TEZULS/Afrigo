import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, MapPin, Clock, CheckCircle, Truck, AlertCircle, Euro, ChevronRight, Eye, ArrowLeft, Star } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AdminDelivererPreview() {
  const [user, setUser] = useState(null);
  const [selectedDeliverer, setSelectedDeliverer] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (u?.role !== 'admin') {
        navigate(createPageUrl('Home'));
      }
    });
  }, [navigate]);

  const { data: deliverers = [] } = useQuery({
    queryKey: ['deliverers'],
    queryFn: () => base44.entities.Deliverer.list('-created_date')
  });

  const { data: allOrders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: () => base44.entities.Order.list('-created_date')
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['reviews'],
    queryFn: () => base44.entities.Review.list(),
    enabled: !!user
  });

  const delivererProfile = deliverers.find(d => d.email === selectedDeliverer);
  
  const myOrders = selectedDeliverer ? allOrders.filter(order => order.assigned_deliverer === selectedDeliverer) : [];
  const activeOrders = myOrders.filter(order => order.status === 'shipped');
  const completedOrders = myOrders.filter(order => order.status === 'delivered' || order.status === 'failed_delivery');
  
  const cashBalance = myOrders
    .filter(order => order.status === 'delivered' && order.payment_method === 'delivery')
    .reduce((sum, order) => sum + (order.cash_collected || 0), 0);

  const statusColors = {
    shipped: 'bg-purple-100 text-purple-700',
    delivered: 'bg-green-100 text-green-700',
    failed_delivery: 'bg-rose-100 text-rose-700',
    not_delivered: 'bg-rose-100 text-rose-700'
  };

  const statusLabels = {
    shipped: 'En livraison',
    delivered: 'Livrée',
    failed_delivery: 'Échec de livraison',
    not_delivered: 'Non livrée'
  };

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
        <Link to={createPageUrl('AdminDelivererTracking')} className="inline-flex items-center text-slate-600 hover:text-blue-600 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour au suivi temps réel
        </Link>
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Eye className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Prévisualisation interface livreur</h1>
              <p className="text-slate-500">Visualisez comment les livreurs voient leurs commandes</p>
            </div>
          </div>

          <Card className="border-0 shadow-lg rounded-2xl mb-6">
            <CardContent className="p-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Sélectionner un livreur
              </label>
              <Select value={selectedDeliverer} onValueChange={setSelectedDeliverer}>
                <SelectTrigger className="w-full md:w-96">
                  <SelectValue placeholder="Choisir un livreur pour prévisualiser son interface" />
                </SelectTrigger>
                <SelectContent>
                  {deliverers.filter(d => d.is_active).map(d => (
                    <SelectItem key={d.email} value={d.email}>
                      {d.full_name} - {d.email}
                      {d.assigned_zones?.length > 0 && (
                        <span className="text-xs text-slate-500 ml-2">
                          ({d.assigned_zones.length} zone{d.assigned_zones.length > 1 ? 's' : ''})
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>

        {!selectedDeliverer ? (
          <Card className="border-0 shadow-lg rounded-2xl">
            <CardContent className="p-12 text-center">
              <Truck className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Sélectionnez un livreur pour voir son interface</p>
            </CardContent>
          </Card>
        ) : !delivererProfile ? (
          <Card className="border-0 shadow-lg rounded-2xl">
            <CardContent className="p-12 text-center">
              <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
              <p className="text-slate-500">Livreur introuvable</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Deliverer Info Card */}
            <Card className="border-0 shadow-lg rounded-2xl mb-6">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Truck className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-slate-800 mb-2">{delivererProfile.full_name}</h3>
                    <div className="flex flex-wrap gap-3 text-sm text-slate-600 mb-3">
                      <span className="flex items-center gap-1">
                        📧 {delivererProfile.email}
                      </span>
                      <span className="flex items-center gap-1">
                        📱 {delivererProfile.phone}
                      </span>
                      <Badge className={delivererProfile.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}>
                        {delivererProfile.is_active ? 'Actif' : 'Inactif'}
                      </Badge>
                    </div>
                    {delivererProfile.assigned_zones?.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-slate-700 mb-2">Zones assignées:</p>
                        <div className="flex flex-wrap gap-2">
                          {delivererProfile.assigned_zones.map(zoneId => {
                            const zone = allOrders.find(o => o.delivery_postal_code)?.delivery_postal_code;
                            return (
                              <Badge key={zoneId} variant="outline" className="text-xs">
                                Zone {zoneId.slice(-4)}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Card className="border-0 shadow-lg rounded-2xl">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500 mb-1">En cours</p>
                      <p className="text-3xl font-bold text-slate-800">{activeOrders.length}</p>
                    </div>
                    <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                      <Package className="w-6 h-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg rounded-2xl">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Livrées</p>
                      <p className="text-3xl font-bold text-slate-800">
                        {completedOrders.filter(o => o.status === 'delivered').length}
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
                      <p className="text-sm text-slate-500 mb-1">Solde espèces</p>
                      <p className="text-3xl font-bold text-slate-800">{cashBalance.toFixed(2)}€</p>
                    </div>
                    <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                      <Euro className="w-6 h-6 text-emerald-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="active" className="space-y-6">
              <TabsList className="bg-white border rounded-xl p-1">
                <TabsTrigger value="active" className="rounded-lg">
                  En cours ({activeOrders.length})
                </TabsTrigger>
                <TabsTrigger value="history" className="rounded-lg">
                  Historique ({completedOrders.length})
                </TabsTrigger>
                <TabsTrigger value="cash" className="rounded-lg">
                  Solde espèces
                </TabsTrigger>
              </TabsList>

              {/* Active Orders */}
              <TabsContent value="active">
                <Card className="border-0 shadow-lg rounded-2xl">
                  <CardHeader>
                    <CardTitle>Commandes en cours</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {activeOrders.length === 0 ? (
                      <div className="text-center py-12">
                        <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500">Aucune commande en cours</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {activeOrders.map(order => (
                          <div key={order.id} className="p-4 border-2 border-slate-200 rounded-xl">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h3 className="font-semibold text-slate-800 mb-1">
                                  Commande #{order.id.slice(-8).toUpperCase()}
                                </h3>
                                <Badge className={statusColors[order.status]}>
                                  {statusLabels[order.status]}
                                </Badge>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-bold text-slate-800">
                                  {order.total_amount?.toFixed(2)}€
                                </p>
                                {order.payment_method === 'delivery' && (
                                  <Badge variant="outline" className="mt-1">
                                    <Package className="w-3 h-3 mr-1" />
                                    Espèces
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-start gap-2 text-sm">
                                <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="font-medium text-slate-700">{order.delivery_address}</p>
                                  <p className="text-slate-500">
                                    {order.delivery_postal_code} {order.delivery_city}
                                  </p>
                                </div>
                              </div>
                              {order.delivery_time && (
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                  <Clock className="w-4 h-4 text-slate-400" />
                                  <span>
                                    {order.estimated_delivery ? format(new Date(order.estimated_delivery), 'dd/MM/yyyy', { locale: fr }) : '-'} à {order.delivery_time}
                                  </span>
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

              {/* History */}
              <TabsContent value="history">
                <Card className="border-0 shadow-lg rounded-2xl">
                  <CardHeader>
                    <CardTitle>Historique des livraisons</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {completedOrders.length === 0 ? (
                      <div className="text-center py-12">
                        <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500">Aucun historique</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {completedOrders.map(order => {
                          const customer = users.find(u => u.email === order.customer_email);
                          const orderReviews = reviews.filter(r => r.order_id === order.id);
                          
                          return (
                            <div key={order.id} className="p-4 bg-slate-50 rounded-xl border-2 border-slate-200">
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <h3 className="font-semibold text-slate-800 mb-1">
                                    Commande #{order.id.slice(-8).toUpperCase()}
                                  </h3>
                                  <Badge className={statusColors[order.status]}>
                                    {statusLabels[order.status]}
                                  </Badge>
                                </div>
                                <div className="text-right">
                                  <span className="text-2xl font-bold text-slate-800">
                                    {order.total_amount?.toFixed(2)}€
                                  </span>
                                  {order.payment_method === 'delivery' && order.status === 'delivered' && (
                                    <div className="mt-1">
                                      <Badge className="bg-emerald-100 text-emerald-700">
                                        <Euro className="w-3 h-3 mr-1" />
                                        {order.cash_collected?.toFixed(2)}€ collectés
                                      </Badge>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="space-y-2 text-sm">
                                {/* Informations client */}
                                <div className="p-3 bg-white rounded-lg border border-slate-200">
                                  <p className="text-xs font-semibold text-slate-500 mb-2">INFORMATIONS CLIENT</p>
                                  <div className="space-y-1">
                                    <p className="font-medium text-slate-800">
                                      {customer?.first_name && customer?.last_name 
                                        ? `${customer.first_name} ${customer.last_name}`
                                        : customer?.full_name || order.customer_email}
                                    </p>
                                    {customer?.customer_id && (
                                      <p className="text-xs text-slate-500">ID: {customer.customer_id}</p>
                                    )}
                                  </div>
                                </div>

                                {/* Adresse de livraison */}
                                <div className="flex items-start gap-2 text-slate-600">
                                  <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                                  <div>
                                    <p className="font-medium">{order.delivery_address}</p>
                                    <p className="text-slate-500">
                                      {order.delivery_postal_code} {order.delivery_city}
                                    </p>
                                  </div>
                                </div>
                                
                                {/* Date et heure de livraison */}
                                <div className="flex items-center gap-2 text-slate-600">
                                  <Clock className="w-4 h-4 text-slate-400" />
                                  <span>
                                    Livrée le {order.delivered_date ? format(new Date(order.delivered_date), "dd/MM/yyyy 'à' HH:mm", { locale: fr }) : '-'}
                                  </span>
                                </div>

                                {/* Avis clients */}
                                {orderReviews.length > 0 && (
                                  <div className="p-3 bg-amber-50 border border-amber-200 rounded">
                                    <p className="text-xs font-semibold text-amber-900 mb-2 flex items-center gap-1">
                                      <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                                      AVIS CLIENT
                                    </p>
                                    {orderReviews.map((review, idx) => (
                                      <div key={idx} className="mb-2 last:mb-0">
                                        <div className="flex items-center gap-1 mb-1">
                                          {[...Array(5)].map((_, i) => (
                                            <Star 
                                              key={i} 
                                              className={`w-3 h-3 ${i < review.rating ? 'fill-amber-500 text-amber-500' : 'text-slate-300'}`}
                                            />
                                          ))}
                                          <span className="text-xs font-semibold text-amber-800 ml-1">
                                            {review.rating}/5
                                          </span>
                                        </div>
                                        {review.comment && (
                                          <p className="text-xs text-amber-800 italic">"{review.comment}"</p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {order.notes && (
                                  <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                                    <strong className="text-blue-900">Note de livraison:</strong>
                                    <p className="text-blue-800 mt-1">{order.notes}</p>
                                  </div>
                                )}

                                {(order.status === 'failed_delivery' || order.status === 'not_delivered') && order.delivery_failure_reason && (
                                  <div className="p-2 bg-rose-50 border border-rose-200 rounded text-xs">
                                    <strong className="text-rose-900">
                                      {order.status === 'not_delivered' ? 'Motif de non-livraison:' : 'Motif de l\'échec:'}
                                    </strong>
                                    <p className="text-rose-800 mt-1">{order.delivery_failure_reason}</p>
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
              </TabsContent>

              {/* Cash Balance */}
              <TabsContent value="cash">
                <Card className="border-0 shadow-lg rounded-2xl">
                  <CardHeader>
                    <CardTitle>Solde des paiements en espèces</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 mb-6">
                      <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Euro className="w-10 h-10 text-emerald-600" />
                      </div>
                      <p className="text-5xl font-bold text-slate-800 mb-2">
                        {cashBalance.toFixed(2)}€
                      </p>
                      <p className="text-slate-500">Total à remettre</p>
                    </div>

                    {myOrders.filter(order => order.status === 'delivered' && order.payment_method === 'delivery').length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-slate-800 mb-3">Détails des paiements</h4>
                        {myOrders
                          .filter(order => order.status === 'delivered' && order.payment_method === 'delivery')
                          .map(order => (
                            <div key={order.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                              <div>
                                <p className="font-medium text-slate-800">#{order.id.slice(-8).toUpperCase()}</p>
                                <p className="text-sm text-slate-500">
                                  {order.delivered_date ? format(new Date(order.delivered_date), 'dd/MM/yyyy', { locale: fr }) : '-'}
                                </p>
                              </div>
                              <span className="text-lg font-bold text-emerald-600">
                                {order.cash_collected?.toFixed(2)}€
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}