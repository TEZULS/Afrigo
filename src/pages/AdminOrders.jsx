import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Package, ArrowLeft, MapPin, Calendar, Phone, Mail, Search, Filter, X, Plus, Check, Clock, AlertCircle, Eye, Edit, Printer, Trash2
} from 'lucide-react';
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import OrderStatusBadge from '@/components/orders/OrderStatusBadge';
import OrderPrintBordereau, { printBordereau } from '@/components/orders/OrderPrintBordereau';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function AdminOrders() {
  const [user, setUser] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderDetail, setShowOrderDetail] = useState(false);
  const [showPrintBordereau, setShowPrintBordereau] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [showGpsDialog, setShowGpsDialog] = useState(false);
  const [gpsOrder, setGpsOrder] = useState(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u?.role !== 'admin') {
        window.location.href = '/';
        return;
      }
      setUser(u);
    }).catch(() => window.location.href = '/');
  }, []);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => base44.entities.Order.list('-created_date', 1000),
  });

  const { data: deliverers = [] } = useQuery({
    queryKey: ['deliverers'],
    queryFn: () => base44.entities.Deliverer.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const assignDeliveryMutation = useMutation({
    mutationFn: ({ orderId, delivererEmail, status }) =>
      base44.entities.Order.update(orderId, {
        assigned_deliverer: delivererEmail,
        status: status || 'ready'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    }
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, status, customerEmail }) => {
      await base44.entities.Order.update(orderId, { status });
      // Notifier le client
      await base44.functions.invoke('sendOrderStatusEmail', { 
        orderId, 
        customerEmail, 
        status 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    }
  });

  const updatePaymentStatusMutation = useMutation({
    mutationFn: ({ orderId, paymentStatus }) =>
      base44.entities.Order.update(orderId, { payment_status: paymentStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    }
  });

  const cancelOrderMutation = useMutation({
    mutationFn: ({ orderId, reason }) =>
      base44.entities.Order.update(orderId, {
        status: 'cancelled',
        cancellation_reason: reason,
        cancelled_by: user.email,
        cancelled_by_role: 'admin'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setShowCancelDialog(false);
      setCancellationReason('');
      setOrderToCancel(null);
    }
  });

  const getStatusColor = (status, paymentStatus) => {
    if (paymentStatus === 'failed') return 'bg-orange-100 text-orange-800';
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      preparing: 'bg-purple-100 text-purple-800',
      ready: 'bg-indigo-100 text-indigo-800',
      shipped: 'bg-orange-100 text-orange-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      failed_delivery: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.customer_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          order.id.includes(searchQuery) ||
                          (order.delivery_address?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesPayment = paymentStatusFilter === 'all' || order.payment_status === paymentStatusFilter;
    return matchesSearch && matchesStatus && matchesPayment;
  });

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.history.back()}
            className="rounded-lg"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-800 mb-2">Gestion des commandes</h1>
            <p className="text-slate-600">{filteredOrders.length} commande(s) trouvée(s)</p>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex gap-3 flex-wrap items-center">
              <div className="relative flex-1 min-w-[250px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Rechercher par email, ID ou adresse..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 rounded-lg"
                />
              </div>

              {searchQuery && (
                <Button
                  variant="outline"
                  onClick={() => setSearchQuery('')}
                  className="rounded-lg"
                >
                  <X className="w-4 h-4 mr-2" />
                  Réinitialiser
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Orders Table */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Aucune commande trouvée</p>
            </CardContent>
          </Card>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">N° Commande</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">Client</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">Montant</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600">Statut</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600">Paiement</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600">Nb Commandes</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredOrders.map((order) => {
                    const customer = users.find(u => u.email === order.customer_email);
                    const customerName = customer?.first_name && customer?.last_name 
                      ? `${customer.first_name} ${customer.last_name}`
                      : order.customer_email;

                    return (
                    <tr key={order.id} className={`hover:bg-slate-50 ${order.payment_status === 'failed' ? 'bg-orange-50' : ''}`}>
                      <td className="px-6 py-4 text-sm font-medium text-slate-800">{order.id.slice(-8).toUpperCase()}</td>
                      <td className="px-6 py-4 text-sm text-slate-700 font-medium">{customerName}</td>
                      <td className="px-6 py-4 text-sm text-slate-500">{order.customer_email}</td>
                      <td className="px-6 py-4 text-sm font-bold text-emerald-600">{order.total_amount?.toFixed(2)}€</td>
                      <td className="px-3 py-4 text-sm">
                        <Select 
                          value={order.payment_status === 'failed' ? 'payment_failed' : order.status} 
                          onValueChange={(newStatus) => {
                            if (newStatus === 'payment_failed') {
                              updatePaymentStatusMutation.mutate({ orderId: order.id, paymentStatus: 'failed' });
                            } else if (newStatus === 'cancelled') {
                              setOrderToCancel(order);
                              setShowCancelDialog(true);
                            } else {
                              // Si on change depuis échec de paiement vers un autre statut, remettre le paiement en pending
                              if (order.payment_status === 'failed') {
                                updatePaymentStatusMutation.mutate({ orderId: order.id, paymentStatus: 'pending' });
                              }
                              updateOrderStatusMutation.mutate({ 
                                orderId: order.id, 
                                status: newStatus,
                                customerEmail: order.customer_email 
                              });
                            }
                          }}
                        >
                          <SelectTrigger className={`w-36 rounded-lg ${getStatusColor(order.status, order.payment_status)}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">En attente</SelectItem>
                            <SelectItem value="confirmed">Confirmée</SelectItem>
                            <SelectItem value="preparing">En préparation</SelectItem>
                            <SelectItem value="ready">Prête</SelectItem>
                            <SelectItem value="shipped">En livraison</SelectItem>
                            <SelectItem value="delivered">Livrée</SelectItem>
                            <SelectItem value="cancelled">Annulée</SelectItem>
                            <SelectItem value="payment_failed">Échec de paiement</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-4 text-sm">
                        <Select 
                          value={order.payment_status || 'pending'} 
                          onValueChange={(newStatus) => {
                            updatePaymentStatusMutation.mutate({ 
                              orderId: order.id, 
                              paymentStatus: newStatus
                            });
                          }}
                        >
                          <SelectTrigger className={`w-28 rounded-lg ${
                            order.payment_status === 'completed' ? 'bg-green-100 text-green-800' :
                            order.payment_status === 'failed' ? 'bg-orange-100 text-orange-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">En attente</SelectItem>
                            <SelectItem value="completed">Payé</SelectItem>
                            <SelectItem value="failed">Échec</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-4 text-sm text-slate-600">{filteredOrders.filter(o => o.customer_email === order.customer_email).length}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => {
                              setSelectedOrder(order);
                              setShowPrintBordereau(true);
                            }}
                            className="rounded-lg"
                            title="Imprimer"
                          >
                            <Printer className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="destructive"
                            onClick={() => {
                              if (confirm('Supprimer cette commande ?')) {
                                base44.entities.Order.delete(order.id).then(() => {
                                  queryClient.invalidateQueries({ queryKey: ['orders'] });
                                });
                              }
                            }}
                            className="rounded-lg"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Cancel Order Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={(open) => {
        if (!open) { setShowCancelDialog(false); setCancellationReason(''); setOrderToCancel(null); }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Annuler la commande</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Commande <b>#{orderToCancel?.id.slice(-8).toUpperCase()}</b> — veuillez indiquer le motif d'annulation.
            </p>
            <textarea
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              placeholder="Ex: Rupture de stock, erreur de commande..."
              className="w-full min-h-[100px] border border-slate-200 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-300"
            />
            <div className="flex gap-3 justify-end">
              <Button variant="outline" className="rounded-lg" onClick={() => {
                setShowCancelDialog(false);
                setCancellationReason('');
                setOrderToCancel(null);
              }}>
                Fermer
              </Button>
              <Button
                disabled={!cancellationReason.trim() || cancelOrderMutation.isPending}
                onClick={() => cancelOrderMutation.mutate({ orderId: orderToCancel.id, reason: cancellationReason })}
                className="bg-rose-600 hover:bg-rose-700 rounded-lg"
              >
                Confirmer l'annulation
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print Bordereau Dialog */}
      {(() => {
        const liveOrder = orders.find(o => o.id === selectedOrder?.id) || selectedOrder;
        return (
          <Dialog open={showPrintBordereau} onOpenChange={setShowPrintBordereau}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
              <DialogTitle className="sr-only">Bordereau {liveOrder?.id}</DialogTitle>
              {liveOrder && (
                <div>
                  <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center z-10">
                    <h2 className="font-semibold">Bordereau #{liveOrder?.id.slice(-8).toUpperCase()}</h2>
                    <Button 
                      onClick={() => printBordereau(liveOrder, users)}
                      className="bg-emerald-500 hover:bg-emerald-600 rounded-lg"
                    >
                      <Printer className="w-4 h-4 mr-2" />
                      Imprimer
                    </Button>
                  </div>
                  <OrderPrintBordereau order={liveOrder} users={users} />
                </div>
              )}
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Order Detail Dialog */}
      <Dialog open={showOrderDetail} onOpenChange={setShowOrderDetail}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedOrder && (
            <>
              <DialogHeader>
                <DialogTitle>Commande #{selectedOrder.id.slice(-8).toUpperCase()}</DialogTitle>
              </DialogHeader>

              <div className="space-y-6">
                {/* QR Code centered */}
                <div className="flex justify-center">
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent('https://www.afrigo.app')}`} 
                      alt="QR Code" 
                      style={{ width: '120px', height: '120px' }} 
                    />
                    <p className="text-center text-xs text-slate-600 mt-2">📱 Scannez pour commander</p>
                  </div>
                </div>

                {/* Items */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4 text-emerald-500" />
                    Articles
                  </h3>
                  <div className="border rounded-lg divide-y">
                    {selectedOrder.items?.map((item, index) => (
                      <div key={index} className="flex justify-between items-start p-3">
                        <div className="flex-1">
                          <p className="font-medium text-slate-800">{item.product_name}</p>
                          {item.selected_variants && Object.keys(item.selected_variants).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {Object.entries(item.selected_variants).map(([key, variant]) => (
                                <Badge key={key} variant="secondary" className="text-xs">
                                  {variant.type}: {variant.value}
                                </Badge>
                              ))}
                            </div>
                          )}
                          <p className="text-sm text-slate-500 mt-1">
                            {item.quantity} × {item.unit_price?.toFixed(2)}€
                          </p>
                        </div>
                        <p className="font-semibold text-slate-800 ml-4">
                          {item.total_price?.toFixed(2)}€
                        </p>
                      </div>
                    ))}
                    <div className="flex justify-between items-center p-3 bg-emerald-50">
                      <p className="font-semibold text-slate-800">Total</p>
                      <p className="font-bold text-lg text-emerald-600">
                        {selectedOrder.total_amount?.toFixed(2)}€
                      </p>
                    </div>
                  </div>
                </div>

                {/* Notes & Alerts */}
                {selectedOrder.notes && (
                  <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                    <p className="text-sm font-medium text-amber-900 mb-1">📝 Notes de livraison</p>
                    <p className="text-sm text-amber-800">{selectedOrder.notes}</p>
                  </div>
                )}

                {selectedOrder.payment_status === 'failed' && (
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <p className="text-sm font-medium text-red-900 mb-1">❌ Paiement échoué</p>
                    <p className="text-sm text-red-800">{selectedOrder.payment_failure_reason || 'Raison inconnue'}</p>
                  </div>
                )}

                {selectedOrder.status === 'cancelled' && selectedOrder.cancellation_reason && (
                  <div className="bg-rose-50 p-4 rounded-lg border border-rose-200">
                    <p className="text-sm font-medium text-rose-900 mb-1">❌ Motif d'annulation</p>
                    <p className="text-sm text-rose-800">{selectedOrder.cancellation_reason}</p>
                    {selectedOrder.cancelled_by && (
                      <p className="text-xs text-rose-700 mt-2">
                        Par: {selectedOrder.cancelled_by_role === 'admin' ? '🔧 Administrateur' : '👤 Client'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* GPS Dialog */}
      <Dialog open={showGpsDialog} onOpenChange={setShowGpsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>📍 Adresse de livraison</DialogTitle>
          </DialogHeader>
          {gpsOrder && (
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="font-medium text-slate-800">{gpsOrder.delivery_address}</p>
                <p className="text-slate-600">{gpsOrder.delivery_postal_code} {gpsOrder.delivery_city}</p>
              </div>
              <div className="h-80 bg-slate-200 rounded-lg flex items-center justify-center">
                <p className="text-slate-500">Carte intégrée</p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    const address = encodeURIComponent(`${gpsOrder.delivery_address}, ${gpsOrder.delivery_postal_code} ${gpsOrder.delivery_city}`);
                    window.open(`https://www.google.com/maps/search/${address}`, '_blank');
                  }}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 rounded-lg"
                >
                  Ouvrir dans Google Maps
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowGpsDialog(false)}
                  className="rounded-lg"
                >
                  Fermer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}