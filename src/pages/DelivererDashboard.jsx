import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Package, MapPin, Clock, CheckCircle, Truck, AlertCircle, Banknote, Euro, ChevronRight, Link2, Copy, ShoppingBag } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';

export default function DelivererDashboard() {
  const [user, setUser] = useState(null);
  const [permanentLink, setPermanentLink] = useState('');
  const [showGpsDialog, setShowGpsDialog] = useState(false);
  const [gpsOrder, setGpsOrder] = useState(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  useEffect(() => {
    // Si token présent, utiliser le système de connexion par token
    if (token) {
      const link = `${window.location.origin}${createPageUrl('DelivererDashboard')}?token=${token}`;
      setPermanentLink(link);

      base44.entities.Deliverer.list().then(deliverers => {
        const deliverer = deliverers.find(d => d.access_token === token && d.is_active);
        
        if (!deliverer) {
          navigate(createPageUrl('DelivererLogin'));
          return;
        }

        setUser({ email: deliverer.email, full_name: deliverer.full_name });
      }).catch(() => {
        navigate(createPageUrl('DelivererLogin'));
      });
    } else {
      // Sinon, vérifier si l'utilisateur est connecté normalement
      base44.auth.me().then(u => {
        if (u) {
          setUser(u);
          // Pas de lien permanent pour les utilisateurs connectés normalement
          setPermanentLink('');
        } else {
          navigate(createPageUrl('DelivererLogin'));
        }
      }).catch(() => {
        navigate(createPageUrl('DelivererLogin'));
      });
    }
  }, [navigate, token]);

  const { data: delivererProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['delivererProfile', user?.email],
    queryFn: () => base44.entities.Deliverer.filter({ email: user?.email }),
    enabled: !!user?.email,
    select: (data) => data[0]
  });

  // Redirection si pas livreur
  useEffect(() => {
    if (user && !profileLoading && !delivererProfile) {
      navigate(createPageUrl('Home'));
    }
  }, [user, profileLoading, delivererProfile, navigate]);

  const { data: allOrders = [] } = useQuery({
    queryKey: ['delivererOrders'],
    queryFn: () => base44.entities.Order.list('-created_date'),
    enabled: !!user?.email
  });

  const { data: cashCollections = [] } = useQuery({
    queryKey: ['cashCollections', user?.email],
    queryFn: () => base44.entities.CashCollection.filter({ 
      deliverer_email: user?.email,
      is_archived: false
    }),
    enabled: !!user?.email
  });

  const { data: archivedCollections = [] } = useQuery({
    queryKey: ['archivedCashCollections', user?.email],
    queryFn: () => base44.entities.CashCollection.filter({ 
      deliverer_email: user?.email,
      is_archived: true
    }, '-archived_date'),
    enabled: !!user?.email
  });

  // Commandes assignées à moi
  const myOrders = allOrders.filter(order => order.assigned_deliverer === user?.email);

  // Commandes en cours (uniquement les commandes prêtes ou en livraison)
  const activeOrders = myOrders.filter(order => 
    ['ready', 'shipped'].includes(order.status)
  );

  // Historique (delivered ou failed_delivery)
  const completedOrders = myOrders.filter(order => 
    order.status === 'delivered' || order.status === 'failed_delivery'
  );

  // Calculer le solde des paiements en espèces
  const cashBalance = cashCollections.reduce((sum, collection) => sum + (collection.amount || 0), 0);

  const archiveCashMutation = useMutation({
    mutationFn: async () => {
      const updates = cashCollections.map(collection =>
        base44.entities.CashCollection.update(collection.id, {
          is_archived: true,
          archived_date: new Date().toISOString()
        })
      );
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashCollections'] });
      queryClient.invalidateQueries({ queryKey: ['archivedCashCollections'] });
      toast.success('Solde archivé et remis à zéro');
    },
    onError: () => {
      toast.error('Erreur lors de l\'archivage');
    }
  });

  const statusColors = {
    shipped: 'bg-purple-100 text-purple-700',
    delivered: 'bg-green-100 text-green-700',
    failed_delivery: 'bg-rose-100 text-rose-700'
  };

  const statusLabels = {
    shipped: 'En livraison',
    delivered: 'Livrée',
    failed_delivery: 'Échec de livraison'
  };

  const handleOpenGps = (app, order) => {
    const address = encodeURIComponent(`${order.delivery_address}, ${order.delivery_postal_code} ${order.delivery_city}`);
    
    if (app === 'maps') {
      if (order.delivery_lat && order.delivery_lng) {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${order.delivery_lat},${order.delivery_lng}`, '_blank');
      } else {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${address}`, '_blank');
      }
    } else if (app === 'waze') {
      if (order.delivery_lat && order.delivery_lng) {
        window.open(`https://waze.com/ul?ll=${order.delivery_lat},${order.delivery_lng}&navigate=yes`, '_blank');
      } else {
        window.open(`https://waze.com/ul?q=${address}&navigate=yes`, '_blank');
      }
    }
    
    setShowGpsDialog(false);
    setGpsOrder(null);
  };

  if (!user || !delivererProfile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!delivererProfile.is_active) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">Compte désactivé</h2>
            <p className="text-slate-600">
              Votre compte livreur est actuellement désactivé. Contactez l'administrateur.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Truck className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Mes livraisons</h1>
                <p className="text-sm text-slate-500">{delivererProfile.full_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link to={createPageUrl('Home')}>
                <Button
                  className="rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold shadow-lg"
                >
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  Aller à la boutique
                </Button>
              </Link>
              <Button
                variant="outline"
                onClick={() => {
                  navigate(createPageUrl('DelivererLogin'));
                }}
                className="rounded-xl"
              >
                Déconnexion
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {/* Lien permanent - affiché uniquement si connecté via token */}
        {permanentLink && (
          <Card className="border-0 shadow-lg rounded-2xl mb-6 bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Link2 className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-800 mb-2">Votre lien d'accès permanent</h3>
                  <p className="text-sm text-slate-600 mb-3">
                    Gardez ce lien pour accéder directement à votre espace. Vous pouvez le partager sur vos appareils.
                  </p>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-white rounded-lg px-4 py-3 border-2 border-blue-200 overflow-x-auto">
                      <p className="text-sm font-mono text-slate-700 whitespace-nowrap">
                        {permanentLink}
                      </p>
                    </div>
                    <Button
                      onClick={() => {
                        navigator.clipboard.writeText(permanentLink);
                        toast.success('Lien copié !');
                      }}
                      className="bg-blue-600 hover:bg-blue-700 rounded-xl flex-shrink-0"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copier
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
                <CardTitle>Commandes à livrer</CardTitle>
              </CardHeader>
              <CardContent>
                {activeOrders.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">Aucune commande à livrer</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeOrders.map(order => (
                      <Link key={order.id} to={createPageUrl('DelivererOrderDetails') + `?id=${order.id}&token=${urlParams.get('token')}`}>
                        <div className="p-4 border-2 border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer">
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
                                  <Banknote className="w-3 h-3 mr-1" />
                                  Espèces
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-start gap-2 text-sm">
                              <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                              <div 
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setGpsOrder(order);
                                  setShowGpsDialog(true);
                                }}
                                className="cursor-pointer hover:bg-blue-50 p-2 -m-2 rounded-lg transition-colors flex-1"
                              >
                                <p className="font-medium text-blue-600 hover:text-blue-700 underline">
                                  {order.delivery_address}
                                </p>
                                <p className="text-slate-500">
                                  {order.delivery_postal_code} {order.delivery_city}
                                </p>
                                <p className="text-xs text-slate-400 mt-1">
                                  📍 Cliquez pour ouvrir dans GPS
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

                          <div className="flex items-center justify-end mt-3">
                            <Button variant="ghost" size="sm" className="text-blue-600">
                              Voir détails
                              <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                          </div>
                        </div>
                      </Link>
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
                    {completedOrders.map(order => (
                      <div key={order.id} className="p-4 bg-slate-50 rounded-xl">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-slate-800 mb-1">
                              Commande #{order.id.slice(-8).toUpperCase()}
                            </h3>
                            <Badge className={statusColors[order.status]}>
                              {statusLabels[order.status]}
                            </Badge>
                          </div>
                          <span className="text-xl font-bold text-slate-800">
                            {order.total_amount?.toFixed(2)}€
                          </span>
                        </div>

                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-2 text-slate-600">
                            <MapPin className="w-4 h-4 text-slate-400" />
                            <span>{order.delivery_address}</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-600">
                            <Clock className="w-4 h-4 text-slate-400" />
                            <span>
                              {order.delivered_date ? format(new Date(order.delivered_date), "dd/MM/yyyy 'à' HH:mm", { locale: fr }) : '-'}
                            </span>
                          </div>
                          {order.status === 'failed_delivery' && order.delivery_failure_reason && (
                            <div className="mt-2 p-2 bg-rose-50 border border-rose-200 rounded text-rose-700">
                              <strong>Motif:</strong> {order.delivery_failure_reason}
                            </div>
                          )}
                          {order.payment_method === 'delivery' && order.status === 'delivered' && (
                            <div className="mt-2 flex items-center gap-2 text-green-700">
                              <Banknote className="w-4 h-4" />
                              <span className="font-medium">
                                Espèces collectées: {order.cash_collected?.toFixed(2)}€
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

          {/* Cash Balance */}
          <TabsContent value="cash">
            <Card className="border-0 shadow-lg rounded-2xl mb-6">
              <CardHeader>
                <CardTitle>Solde actuel</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Euro className="w-10 h-10 text-emerald-600" />
                  </div>
                  <p className="text-5xl font-bold text-slate-800 mb-2">
                    {cashBalance.toFixed(2)}€
                  </p>
                  <p className="text-slate-500 mb-4">Total à remettre</p>
                  {cashBalance > 0 && (
                    <Button
                      onClick={() => archiveCashMutation.mutate()}
                      disabled={archiveCashMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {archiveCashMutation.isPending ? 'Archivage...' : 'Remettre le solde et archiver'}
                    </Button>
                  )}
                </div>

                {cashCollections.length > 0 && (
                  <div className="space-y-2 mt-6">
                    <h4 className="font-semibold text-slate-800 mb-3">Collectes du jour</h4>
                    {cashCollections.map(collection => (
                      <div key={collection.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <p className="font-medium text-slate-800">#{collection.order_id.slice(-8).toUpperCase()}</p>
                          <p className="text-sm text-slate-500">
                            {format(new Date(collection.collection_date), "dd/MM/yyyy 'à' HH:mm", { locale: fr })}
                          </p>
                        </div>
                        <span className="text-lg font-bold text-emerald-600">
                          {collection.amount?.toFixed(2)}€
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Historique des remises */}
            <Card className="border-0 shadow-lg rounded-2xl">
              <CardHeader>
                <CardTitle>Historique des remises</CardTitle>
              </CardHeader>
              <CardContent>
                {archivedCollections.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">Aucun historique</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(() => {
                      const grouped = archivedCollections.reduce((acc, collection) => {
                        const date = collection.archived_date.split('T')[0];
                        if (!acc[date]) acc[date] = [];
                        acc[date].push(collection);
                        return acc;
                      }, {});

                      return Object.entries(grouped).map(([date, collections]) => {
                        const total = collections.reduce((sum, c) => sum + c.amount, 0);
                        return (
                          <div key={date} className="border-2 border-slate-200 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <h4 className="font-bold text-slate-800">
                                  {format(new Date(date), "dd MMMM yyyy", { locale: fr })}
                                </h4>
                                <p className="text-sm text-slate-500">
                                  {collections.length} collecte{collections.length > 1 ? 's' : ''}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-bold text-emerald-600">{total.toFixed(2)}€</p>
                                <Badge className="mt-1 bg-blue-100 text-blue-700">Remis</Badge>
                              </div>
                            </div>
                            <div className="space-y-1 border-t pt-2">
                              {collections.map(collection => (
                                <div key={collection.id} className="flex items-center justify-between text-sm">
                                  <span className="text-slate-600">
                                    #{collection.order_id.slice(-8)} - {format(new Date(collection.collection_date), "HH:mm", { locale: fr })}
                                  </span>
                                  <span className="font-medium text-slate-800">{collection.amount.toFixed(2)}€</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </div>

        {/* GPS Selection Dialog */}
        <Dialog open={showGpsDialog} onOpenChange={setShowGpsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choisir votre GPS</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-slate-700 mb-4">
              Sélectionnez l'application GPS pour naviguer vers :
            </p>
            {gpsOrder && (
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-sm font-medium text-slate-800">{gpsOrder.delivery_address}</p>
                <p className="text-sm text-slate-600">{gpsOrder.delivery_postal_code} {gpsOrder.delivery_city}</p>
              </div>
            )}

            <Button
              onClick={() => handleOpenGps('maps', gpsOrder)}
              className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-lg font-semibold justify-start"
            >
              <MapPin className="w-6 h-6 mr-3" />
              Google Maps
            </Button>

            <Button
              onClick={() => handleOpenGps('waze', gpsOrder)}
              className="w-full h-14 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl text-lg font-semibold justify-start"
            >
              <MapPin className="w-6 h-6 mr-3" />
              Waze
            </Button>
          </div>
        </DialogContent>
        </Dialog>
        </div>
        );
        }