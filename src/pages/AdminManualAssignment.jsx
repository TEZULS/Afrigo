import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  ArrowLeft, Package, MapPin, User, Calendar, 
  Phone, Truck, CheckCircle, Search, Star, Trash2
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import OrderStatusBadge from '@/components/orders/OrderStatusBadge';

export default function AdminManualAssignment() {
  const [user, setUser] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u.role !== 'admin') {
        navigate(createPageUrl('Home'));
      } else {
        setUser(u);
      }
    }).catch(() => navigate(createPageUrl('Home')));
  }, [navigate]);

  const { data: orders = [] } = useQuery({
    queryKey: ['all-orders'],
    queryFn: () => base44.entities.Order.list('-created_date'),
    enabled: !!user
  });

  const { data: deliverers = [] } = useQuery({
    queryKey: ['deliverers'],
    queryFn: () => base44.entities.Deliverer.list(),
    enabled: !!user
  });

  const { data: zones = [] } = useQuery({
    queryKey: ['deliveryZones'],
    queryFn: () => base44.entities.DeliveryZone.list(),
    enabled: !!user
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user
  });

  const assignDelivererMutation = useMutation({
    mutationFn: ({ orderId, delivererEmail }) => 
      base44.entities.Order.update(orderId, { assigned_deliverer: delivererEmail }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-orders'] });
      setSelectedOrder(null);
      toast.success('Livreur assigné avec succès');
    }
  });

  const deleteOrderMutation = useMutation({
    mutationFn: (orderId) => base44.entities.Order.delete(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-orders'] });
      toast.success('Commande supprimée');
    },
    onError: () => {
      toast.error('Erreur lors de la suppression');
    }
  });

  // Trouver la zone de la commande
  const getOrderZone = (order) => {
    return zones.find(zone => 
      zone.postal_codes?.includes(order.delivery_postal_code)
    );
  };

  // Obtenir les livreurs recommandés pour une commande
  const getRecommendedDeliverers = (order) => {
    const orderZone = getOrderZone(order);
    if (!orderZone) return [];
    
    return deliverers.filter(d => 
      d.is_active && d.assigned_zones?.includes(orderZone.id)
    );
  };

  const filteredOrders = orders.filter(order => {
    const query = searchQuery.toLowerCase();
    const orderNumber = order.id.slice(-8).toUpperCase();
    const customer = users.find(u => u.email === order.customer_email);
    const customerName = customer?.first_name && customer?.last_name 
      ? `${customer.first_name} ${customer.last_name}`.toLowerCase()
      : '';
    
    return orderNumber.includes(query.toUpperCase()) ||
           customerName.includes(query) ||
           order.customer_email.toLowerCase().includes(query) ||
           order.delivery_city?.toLowerCase().includes(query) ||
           order.delivery_postal_code?.includes(query);
  });

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Link to={createPageUrl('AdminDashboard')} className="inline-flex items-center text-slate-600 hover:text-emerald-600 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour au tableau de bord
        </Link>

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Truck className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Assignation manuelle des livreurs</h1>
              <p className="text-slate-500">{orders.length} commandes au total</p>
            </div>
          </div>
          <Link to={createPageUrl('AdminDeliverers')}>
            <Button className="bg-emerald-600 hover:bg-emerald-700 rounded-xl">
              <User className="w-4 h-4 mr-2" />
              Gérer les livreurs
            </Button>
          </Link>
        </div>

        {/* Search */}
        <Card className="border-0 shadow-sm rounded-2xl mb-6">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <Input
                placeholder="Rechercher par numéro, client, ville, code postal..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 rounded-xl"
              />
            </div>
          </CardContent>
        </Card>

        {/* Orders List */}
        <div className="grid gap-4">
          {filteredOrders.map(order => {
            const customer = users.find(u => u.email === order.customer_email);
            const orderZone = getOrderZone(order);
            const recommendedDeliverers = getRecommendedDeliverers(order);
            const assignedDeliverer = deliverers.find(d => d.email === order.assigned_deliverer);

            return (
              <Card 
                key={order.id} 
                className="border-0 shadow-sm rounded-2xl hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedOrder(order)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="font-bold text-lg text-slate-800">
                          #{order.id.slice(-8).toUpperCase()}
                        </h3>
                        <OrderStatusBadge status={order.status} />
                        {assignedDeliverer && (
                          <Badge className="bg-blue-100 text-blue-700">
                            <Truck className="w-3 h-3 mr-1" />
                            {assignedDeliverer.full_name}
                          </Badge>
                        )}
                      </div>

                      <div className="grid md:grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2 text-slate-600">
                          <User className="w-4 h-4 text-slate-400" />
                          <span className="font-medium">
                            {customer?.first_name && customer?.last_name 
                              ? `${customer.first_name} ${customer.last_name}`
                              : order.customer_email}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          {format(new Date(order.created_date), 'dd/MM/yyyy HH:mm', { locale: fr })}
                        </div>
                        <div className="flex items-start gap-2 text-slate-600">
                          <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                          <span>{order.delivery_address}, {order.delivery_postal_code} {order.delivery_city}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-slate-400" />
                          <span className="font-semibold text-emerald-600">
                            {order.total_amount?.toFixed(2)}€
                          </span>
                        </div>
                      </div>

                      {orderZone && (
                        <div className="mt-3">
                          <Badge variant="outline" className="bg-blue-50 text-blue-700">
                            <MapPin className="w-3 h-3 mr-1" />
                            Zone: {orderZone.name}
                          </Badge>
                          {recommendedDeliverers.length > 0 && (
                            <Badge className="bg-emerald-50 text-emerald-700 ml-2">
                              <Star className="w-3 h-3 mr-1" />
                              {recommendedDeliverers.length} livreur{recommendedDeliverers.length > 1 ? 's' : ''} recommandé{recommendedDeliverers.length > 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOrder(order);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 rounded-xl"
                      >
                        Assigner
                      </Button>
                      <Button
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Êtes-vous sûr de vouloir supprimer la commande #${order.id.slice(-8).toUpperCase()} ?`)) {
                            deleteOrderMutation.mutate(order.id);
                          }
                        }}
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 rounded-xl"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredOrders.length === 0 && (
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="py-12 text-center">
              <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Aucune commande trouvée</p>
            </CardContent>
          </Card>
        )}

        {/* Order Details & Assignment Dialog */}
        <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">
                Détails de la commande #{selectedOrder?.id.slice(-8).toUpperCase()}
              </DialogTitle>
            </DialogHeader>

            {selectedOrder && (
              <div className="space-y-6 py-4">
                {/* Customer Info */}
                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="border-2 border-slate-200 rounded-xl">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-slate-500 mb-2">
                        <User className="w-4 h-4" />
                        <span className="text-sm font-medium">Client</span>
                      </div>
                      <p className="font-semibold text-slate-800">
                        {(() => {
                          const customer = users.find(u => u.email === selectedOrder.customer_email);
                          return customer?.first_name && customer?.last_name
                            ? `${customer.first_name} ${customer.last_name}`
                            : selectedOrder.customer_email;
                        })()}
                      </p>
                      <p className="text-sm text-slate-500">
                        {users.find(u => u.email === selectedOrder.customer_email)?.customer_id || ''}
                      </p>
                      {users.find(u => u.email === selectedOrder.customer_email)?.phone && (
                        <div className="flex items-center gap-1 mt-2 text-sm text-slate-600">
                          <Phone className="w-3 h-3" />
                          {users.find(u => u.email === selectedOrder.customer_email)?.phone}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-2 border-slate-200 rounded-xl">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-slate-500 mb-2">
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm font-medium">Date de commande</span>
                      </div>
                      <p className="font-semibold text-slate-800">
                        {format(new Date(selectedOrder.created_date), 'dd MMMM yyyy', { locale: fr })}
                      </p>
                      <p className="text-sm text-slate-500">
                        {format(new Date(selectedOrder.created_date), 'HH:mm', { locale: fr })}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Delivery Info */}
                <Card className="border-2 border-blue-200 bg-blue-50 rounded-xl">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-blue-700 mb-3">
                      <MapPin className="w-5 h-5" />
                      <span className="font-semibold">Adresse de livraison</span>
                    </div>
                    <p className="font-medium text-slate-800">{selectedOrder.delivery_address}</p>
                    <p className="text-slate-700">
                      {selectedOrder.delivery_postal_code} {selectedOrder.delivery_city}
                    </p>
                    {selectedOrder.notes && (
                      <div className="mt-3 p-3 bg-white rounded-lg">
                        <p className="text-sm text-slate-500 mb-1">Note de livraison :</p>
                        <p className="text-sm text-slate-700 italic">{selectedOrder.notes}</p>
                      </div>
                    )}
                    {selectedOrder.delivery_time && (
                      <div className="mt-2 flex items-center gap-2 text-sm text-blue-700">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {selectedOrder.estimated_delivery ? format(new Date(selectedOrder.estimated_delivery), 'dd/MM/yyyy', { locale: fr }) : ''} 
                          {' '} à {selectedOrder.delivery_time}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Order Items */}
                <Card className="border-2 border-slate-200 rounded-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Package className="w-5 h-5 text-emerald-500" />
                      Articles commandés
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {selectedOrder.items?.map((item, index) => (
                        <div key={index} className="flex justify-between items-start p-3 bg-slate-50 rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium text-slate-800">{item.product_name}</p>
                            {item.selected_variants && Object.keys(item.selected_variants).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {Object.entries(item.selected_variants).map(([key, variant]) => (
                                  <Badge key={key} variant="secondary" className="text-xs">
                                    {variant.type}: {variant.value}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            <p className="text-sm text-slate-500 mt-1">
                              {item.quantity} x {item.unit_price?.toFixed(2)}€
                            </p>
                          </div>
                          <p className="font-semibold text-slate-800">
                            {item.total_price?.toFixed(2)}€
                          </p>
                        </div>
                      ))}
                      <div className="flex justify-between items-center p-4 bg-emerald-50 border-2 border-emerald-200 rounded-lg mt-3">
                        <p className="font-bold text-lg text-slate-800">Total</p>
                        <p className="font-bold text-2xl text-emerald-600">
                          {selectedOrder.total_amount?.toFixed(2)}€
                        </p>
                      </div>
                      <div className="p-3 rounded-lg" style={{
                        background: selectedOrder.payment_method === 'delivery' ? '#fef3c7' : '#dbeafe'
                      }}>
                        <p className="text-sm font-medium text-slate-700">Mode de paiement:</p>
                        <p className="font-bold mt-1" style={{
                          color: selectedOrder.payment_method === 'delivery' ? '#d97706' : '#2563eb'
                        }}>
                          {selectedOrder.payment_method === 'delivery' ? '💵 Paiement à la livraison' : '💳 Payé par carte'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Deliverer Assignment */}
                <Card className="border-2 border-indigo-200 bg-indigo-50 rounded-xl">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Truck className="w-5 h-5 text-indigo-600" />
                        Assigner un livreur
                      </CardTitle>
                      {selectedOrder.assigned_deliverer && (
                        <Badge className="bg-blue-100 text-blue-700">
                          Réassignation possible
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const orderZone = getOrderZone(selectedOrder);
                      const recommendedDeliverers = getRecommendedDeliverers(selectedOrder);
                      const otherDeliverers = deliverers.filter(d => 
                        d.is_active && !recommendedDeliverers.find(r => r.id === d.id)
                      );

                      return (
                        <div className="space-y-4">
                          {selectedOrder.assigned_deliverer && (
                            <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-xl">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-semibold text-amber-900 mb-1">🚚 Livreur actuellement assigné</p>
                                  <p className="font-bold text-amber-800">
                                    {deliverers.find(d => d.email === selectedOrder.assigned_deliverer)?.full_name || selectedOrder.assigned_deliverer}
                                  </p>
                                  <p className="text-xs text-amber-700 mt-2">
                                    💡 Sélectionnez un autre livreur ci-dessous pour changer l'assignation
                                  </p>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    assignDelivererMutation.mutate({
                                      orderId: selectedOrder.id,
                                      delivererEmail: null
                                    });
                                  }}
                                  className="text-amber-700 border-amber-400 hover:bg-amber-100"
                                >
                                  Retirer
                                </Button>
                              </div>
                            </div>
                          )}
                          {orderZone && recommendedDeliverers.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <Star className="w-5 h-5 text-amber-500" />
                                <h4 className="font-semibold text-slate-800">
                                  Livreurs recommandés pour la zone "{orderZone.name}"
                                </h4>
                              </div>
                              <div className="space-y-2">
                                {recommendedDeliverers.map(deliverer => (
                                  <div
                                    key={deliverer.id}
                                    className="p-4 bg-amber-50 border-2 border-amber-300 rounded-xl hover:bg-amber-100 transition-colors"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                          <p className="font-semibold text-slate-800">{deliverer.full_name}</p>
                                          {deliverer.deliverer_id && (
                                            <Badge variant="outline" className="text-xs">
                                              {deliverer.deliverer_id}
                                            </Badge>
                                          )}
                                          <Badge className="bg-amber-500 text-white">
                                            ⭐ Recommandé
                                          </Badge>
                                        </div>
                                        <div className="flex gap-3 text-sm text-slate-600">
                                          <span className="flex items-center gap-1">
                                            <Phone className="w-3 h-3" />
                                            {deliverer.phone}
                                          </span>
                                          <span className="flex items-center gap-1">
                                            <MapPin className="w-3 h-3" />
                                            {deliverer.assigned_zones?.length || 0} zone(s)
                                          </span>
                                        </div>
                                      </div>
                                      <Button
                                        onClick={() => assignDelivererMutation.mutate({
                                          orderId: selectedOrder.id,
                                          delivererEmail: deliverer.email
                                        })}
                                        disabled={assignDelivererMutation.isPending}
                                        className="bg-amber-600 hover:bg-amber-700 rounded-xl"
                                      >
                                        <CheckCircle className="w-4 h-4 mr-2" />
                                        Assigner
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {otherDeliverers.length > 0 && (
                            <div>
                              <h4 className="font-semibold text-slate-700 mb-3">
                                {recommendedDeliverers.length > 0 ? 'Autres livreurs disponibles' : 'Livreurs disponibles'}
                              </h4>
                              <div className="space-y-2">
                                {otherDeliverers.map(deliverer => (
                                  <div
                                    key={deliverer.id}
                                    className="p-4 bg-white border-2 border-slate-200 rounded-xl hover:border-indigo-300 transition-colors"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                          <p className="font-semibold text-slate-800">{deliverer.full_name}</p>
                                          {deliverer.deliverer_id && (
                                            <Badge variant="outline" className="text-xs">
                                              {deliverer.deliverer_id}
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="flex gap-3 text-sm text-slate-600">
                                          <span className="flex items-center gap-1">
                                            <Phone className="w-3 h-3" />
                                            {deliverer.phone}
                                          </span>
                                          <span className="flex items-center gap-1">
                                            <MapPin className="w-3 h-3" />
                                            {deliverer.assigned_zones?.length || 0} zone(s)
                                          </span>
                                        </div>
                                      </div>
                                      <Button
                                        onClick={() => assignDelivererMutation.mutate({
                                          orderId: selectedOrder.id,
                                          delivererEmail: deliverer.email
                                        })}
                                        disabled={assignDelivererMutation.isPending}
                                        variant="outline"
                                        className="rounded-xl"
                                      >
                                        <CheckCircle className="w-4 h-4 mr-2" />
                                        Assigner
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {deliverers.filter(d => d.is_active).length === 0 && (
                            <div className="text-center py-8">
                              <Truck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                              <p className="text-slate-500">Aucun livreur actif disponible</p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}