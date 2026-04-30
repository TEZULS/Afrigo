import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, ChevronRight, Calendar, MapPin, Clock, Star, RefreshCw, XCircle, CreditCard, Wallet } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import OrderStatusBadge from '@/components/orders/OrderStatusBadge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import ReviewForm from '@/components/reviews/ReviewForm';
import { toast } from 'sonner';

export default function Orders() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [orderToRefund, setOrderToRefund] = useState(null);
  const [selectedRefundMethod, setSelectedRefundMethod] = useState('');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const { data: allOrders = [], isLoading } = useQuery({
    queryKey: ['orders', user?.email],
    queryFn: () => base44.entities.Order.filter({ customer_email: user?.email }, '-created_date'),
    enabled: !!user?.email
  });

  // Filtrer les commandes pour exclure celles avec paiement non validé
  const orders = allOrders.filter(order => {
    // Afficher les commandes avec paiement à la livraison (incluant celles validées par l'admin)
    if (order.payment_method === 'delivery') return true;
    // Afficher les commandes par carte seulement si validées (pas pending)
    if (order.payment_method === 'card' && order.status !== 'pending') return true;
    // Afficher les commandes sans méthode de paiement spécifiée (validées par l'admin)
    if (!order.payment_method && order.status !== 'pending') return true;
    return false;
  });

  const { data: refunds = [] } = useQuery({
    queryKey: ['refunds', user?.email],
    queryFn: () => base44.entities.Refund.filter({ customer_email: user?.email }),
    enabled: !!user?.email
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['reviews', user?.email],
    queryFn: () => base44.entities.Review.filter({ customer_email: user?.email }),
    enabled: !!user?.email
  });

  // Ouvrir automatiquement le dialog d'avis une seule fois par session
  useEffect(() => {
    if (!orders.length || !reviews) return;
    const alreadyShown = sessionStorage.getItem('review_dialog_shown');
    if (alreadyShown) return;
    const deliveredOrders = orders.filter(o => o.status === 'delivered');
    const reviewedOrderIds = new Set(reviews.map(r => r.order_id));
    const unreviewedOrder = deliveredOrders.find(o => !reviewedOrderIds.has(o.id));
    if (unreviewedOrder) {
      sessionStorage.setItem('review_dialog_shown', 'true');
      setSelectedOrderId(unreviewedOrder.id);
      setReviewDialogOpen(true);
    }
  }, [orders, reviews]);

  const createReviewMutation = useMutation({
    mutationFn: async ({ rating, comment }) => {
      return base44.entities.Review.create({
        customer_email: user.email,
        customer_name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.full_name || 'Client',
        rating,
        comment,
        order_id: selectedOrderId,
        review_type: 'general'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      setReviewDialogOpen(false);
      setSelectedProduct(null);
      toast.success('Merci pour votre avis !');
    }
  });

  const reorderMutation = useMutation({
    mutationFn: async (order) => {
      // Ajouter tous les articles de la commande au panier
      const promises = order.items.map(item => {
        return base44.entities.CartItem.create({
          customer_email: user.email,
          product_id: item.product_id,
          product_name: item.product_name,
          product_image: item.product_image,
          quantity: item.quantity,
          unit_price: item.unit_price,
          unit: item.unit
        });
      });
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      toast.success('Articles ajoutés au panier !');
      navigate(createPageUrl('Home') + '?openCart=true');
    }
  });

  const cancelOrderMutation = useMutation({
    mutationFn: async ({ orderId, reason }) => {
      return base44.entities.Order.update(orderId, { 
        status: 'cancelled',
        cancellation_reason: reason,
        cancelled_by: user.email,
        cancelled_by_role: 'client'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setCancelDialogOpen(false);
      setCancellationReason('');
      setOrderToCancel(null);
      toast.success('Commande annulée avec succès');
    }
  });

  const requestRefundMutation = useMutation({
    mutationFn: async (refundData) => {
      console.log('Envoi de la demande:', refundData);
      return base44.entities.Refund.create(refundData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refunds'] });
      setRefundDialogOpen(false);
      setOrderToRefund(null);
      setSelectedRefundMethod('');
      toast.success('Demande de remboursement envoyée');
    },
    onError: (error) => {
      console.error('Erreur lors de la demande de remboursement:', error);
      toast.error('Erreur lors de la demande de remboursement');
    }
  });

  const handleReviewOrder = (orderId) => {
    setSelectedOrderId(orderId);
    setReviewDialogOpen(true);
  };

  const handleCancelOrder = (order) => {
    setOrderToCancel(order);
    setCancelDialogOpen(true);
  };

  const confirmCancelOrder = () => {
    if (!cancellationReason.trim()) {
      toast.error('Veuillez indiquer le motif d\'annulation');
      return;
    }
    cancelOrderMutation.mutate({ 
      orderId: orderToCancel.id, 
      reason: cancellationReason 
    });
  };

  const handleRequestRefund = (order) => {
    setOrderToRefund(order);
    setRefundDialogOpen(true);
  };

  const confirmRefund = () => {
    if (!selectedRefundMethod) {
      toast.error('Veuillez sélectionner un moyen de remboursement');
      return;
    }
    
    // Calculer le montant selon la méthode choisie
    const refundAmount = selectedRefundMethod === 'card' 
      ? orderToRefund.total_amount * 0.95  // 5% de frais pour carte
      : orderToRefund.total_amount;  // Montant total pour portefeuille
    
    console.log('Demande de remboursement:', {
      orderId: orderToRefund.id,
      amount: refundAmount,
      refundMethod: selectedRefundMethod,
      cancellationReason: orderToRefund.cancellation_reason
    });
    
    requestRefundMutation.mutate({
      order_id: orderToRefund.id,
      customer_email: user.email,
      amount: refundAmount,
      refund_method: selectedRefundMethod,
      cancellation_reason: orderToRefund.cancellation_reason,
      status: 'pending'
    });
  };

  const hasRefundRequest = (orderId) => {
    return refunds.some(r => r.order_id === orderId);
  };

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    if (filter === 'active') return ['pending', 'confirmed', 'preparing', 'ready', 'shipped'].includes(order.status);
    if (filter === 'completed') return order.status === 'delivered';
    if (filter === 'cancelled') return order.status === 'cancelled';
    return true;
  });

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link to={createPageUrl('Home')} className="inline-flex items-center text-slate-600 hover:text-emerald-600 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Link>
        
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Package className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Mes commandes</h1>
            <p className="text-slate-500">{orders.length} commande{orders.length > 1 ? 's' : ''}</p>
          </div>
        </div>

        <Tabs defaultValue="all" onValueChange={setFilter} className="mb-6">
          <TabsList className="bg-white shadow-sm rounded-xl p-1">
            <TabsTrigger value="all" className="rounded-lg">Toutes</TabsTrigger>
            <TabsTrigger value="active" className="rounded-lg">En cours</TabsTrigger>
            <TabsTrigger value="completed" className="rounded-lg">Livrées</TabsTrigger>
            <TabsTrigger value="cancelled" className="rounded-lg">Annulées</TabsTrigger>
          </TabsList>
        </Tabs>

        {filteredOrders.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-10 h-10 text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium">Aucune commande trouvée</p>
            <Link to={createPageUrl('Home')}>
              <Button 
                className="mt-4 bg-emerald-500 hover:bg-emerald-600 rounded-xl"
              >
                Découvrir nos produits
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order, index) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link to={createPageUrl('OrderDetails') + `?id=${order.id}`}>
                  <Card className="border-0 shadow-sm hover:shadow-lg transition-all duration-300 rounded-2xl overflow-hidden">
                    <CardContent className="p-0">
                      <div className="p-5">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <p className="text-sm text-slate-500 mb-1">
                              Commande #{order.id.slice(-8).toUpperCase()}
                            </p>
                            <p className="font-bold text-xl text-slate-800">
                              {order.total_amount?.toFixed(2)}€
                            </p>
                          </div>
                          <OrderStatusBadge status={order.status} />
                        </div>

                        <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-4 h-4" />
                            {format(new Date(order.created_date), 'dd MMM yyyy', { locale: fr })}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-4 h-4" />
                            {order.delivery_city}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Package className="w-4 h-4" />
                            {order.items?.length || 0} article{order.items?.length > 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-50 px-5 py-3">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm text-slate-600">Voir les détails</span>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
                
                <div className="flex gap-2 mt-2">
                  {(() => {
                    // Annulation disponible seulement pour pending et confirmed
                    if (!['pending', 'confirmed'].includes(order.status)) return null;
                    
                    // Si livré, vérifier le délai de 2 heures
                    if (order.status === 'delivered') {
                      const deliveryDate = new Date(order.delivered_date || order.updated_date);
                      const now = new Date();
                      const hoursSinceDelivery = (now - deliveryDate) / (1000 * 60 * 60);
                      
                      if (hoursSinceDelivery > 2) return null;
                    }
                    
                    return (
                      <Button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleCancelOrder(order);
                        }}
                        disabled={cancelOrderMutation.isPending}
                        variant="outline"
                        className="flex-1 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Annuler la commande
                      </Button>
                    );
                  })()}
                  
                  {(() => {
                    // Remboursement seulement si commande annulée
                    if (order.status !== 'cancelled' || hasRefundRequest(order.id)) return null;
                    
                    // Vérifier si la commande a été livrée avant annulation
                    let cancellationDate = new Date(order.updated_date);
                    if (order.delivered_date) {
                      cancellationDate = new Date(order.delivered_date);
                    }
                    
                    const now = new Date();
                    const hoursSinceCancellation = (now - cancellationDate) / (1000 * 60 * 60);
                    
                    // Le remboursement est disponible pendant 2 heures après la livraison/annulation
                    if (hoursSinceCancellation > 2) return null;
                    
                    return (
                      <Button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRequestRefund(order);
                        }}
                        disabled={requestRefundMutation.isPending}
                        variant="outline"
                        className="flex-1 rounded-xl border-amber-200 text-amber-600 hover:bg-amber-50"
                      >
                        <Wallet className="w-4 h-4 mr-2" />
                        Demander un remboursement
                      </Button>
                    );
                  })()}
                  
                  <Button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      reorderMutation.mutate(order);
                    }}
                    disabled={reorderMutation.isPending}
                    variant="outline"
                    className="flex-1 rounded-xl border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Repasser la commande
                  </Button>
                  
                  {order.status === 'delivered' && (
                    <Button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleReviewOrder(order.id);
                      }}
                      variant="outline"
                      className="flex-1 rounded-xl border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                    >
                      <Star className="w-4 h-4 mr-2" />
                      Donner un avis
                    </Button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Cancel Dialog */}
        <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Annuler la commande</DialogTitle>
              <DialogDescription>
                Veuillez indiquer la raison de l'annulation
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="reason">Motif d'annulation *</Label>
                <Textarea
                  id="reason"
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="Ex: Changement d'avis, erreur de commande..."
                  className="mt-2 min-h-[100px]"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCancelDialogOpen(false);
                    setCancellationReason('');
                    setOrderToCancel(null);
                  }}
                  className="rounded-xl"
                >
                  Annuler
                </Button>
                <Button
                  onClick={confirmCancelOrder}
                  disabled={cancelOrderMutation.isPending || !cancellationReason.trim()}
                  className="bg-rose-600 hover:bg-rose-700 rounded-xl"
                >
                  Confirmer l'annulation
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Refund Dialog */}
        <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Demander un remboursement</DialogTitle>
              <DialogDescription>
                Sélectionnez votre méthode de remboursement préférée
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {orderToRefund && (
                <>
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <p className="text-sm text-slate-600 mb-1">Montant à rembourser</p>
                    <p className="text-2xl font-bold text-slate-800">
                      {orderToRefund.total_amount?.toFixed(2)}€
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Label>Méthode de remboursement *</Label>
                    
                    {(orderToRefund.payment_method === 'card' && orderToRefund.wallet_amount_used === 0) && (
                      <>
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-3">
                          <p className="text-sm text-amber-800 font-medium mb-1">
                            ⚠️ Important : Frais de remboursement
                          </p>
                          <p className="text-sm text-amber-700">
                            Si vous choisissez le remboursement sur carte bancaire, des frais de 5% seront appliqués. 
                            Le remboursement sur portefeuille est sans frais et vous recevrez le montant total.
                          </p>
                        </div>

                        <button
                          onClick={() => setSelectedRefundMethod('card')}
                          className={`w-full p-4 border-2 rounded-xl transition-all ${
                            selectedRefundMethod === 'card'
                              ? 'border-amber-500 bg-amber-50'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                              selectedRefundMethod === 'card' ? 'bg-amber-100' : 'bg-slate-100'
                            }`}>
                              <CreditCard className={`w-5 h-5 ${
                                selectedRefundMethod === 'card' ? 'text-amber-600' : 'text-slate-600'
                              }`} />
                            </div>
                            <div className="text-left flex-1">
                              <p className="font-semibold text-slate-800">Carte bancaire</p>
                              <p className="text-sm text-slate-500">Remboursement sur la même carte</p>
                              <p className="text-xs text-amber-600 font-medium mt-1">
                                ⚠️ Frais de 5% : vous recevrez {(orderToRefund.total_amount * 0.95).toFixed(2)}€
                              </p>
                            </div>
                          </div>
                        </button>

                        <button
                          onClick={() => setSelectedRefundMethod('wallet')}
                          className={`w-full p-4 border-2 rounded-xl transition-all ${
                            selectedRefundMethod === 'wallet'
                              ? 'border-emerald-500 bg-emerald-50'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                              selectedRefundMethod === 'wallet' ? 'bg-emerald-100' : 'bg-slate-100'
                            }`}>
                              <Wallet className={`w-5 h-5 ${
                                selectedRefundMethod === 'wallet' ? 'text-emerald-600' : 'text-slate-600'
                              }`} />
                            </div>
                            <div className="text-left flex-1">
                              <p className="font-semibold text-slate-800">Portefeuille</p>
                              <p className="text-sm text-slate-500">Crédit sur votre solde</p>
                              <p className="text-xs text-emerald-600 font-medium mt-1">
                                ✅ Sans frais : vous recevrez {orderToRefund.total_amount.toFixed(2)}€
                              </p>
                            </div>
                          </div>
                        </button>
                      </>
                    )}

                    {(orderToRefund.payment_method === 'delivery' || orderToRefund.wallet_amount_used > 0) && (
                      <button
                        onClick={() => setSelectedRefundMethod('wallet')}
                        className={`w-full p-4 border-2 rounded-xl transition-all ${
                          selectedRefundMethod === 'wallet'
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            selectedRefundMethod === 'wallet' ? 'bg-emerald-100' : 'bg-slate-100'
                          }`}>
                            <Wallet className={`w-5 h-5 ${
                              selectedRefundMethod === 'wallet' ? 'text-emerald-600' : 'text-slate-600'
                            }`} />
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-slate-800">Portefeuille</p>
                            <p className="text-sm text-slate-500">Crédit sur votre solde</p>
                          </div>
                        </div>
                      </button>
                    )}
                  </div>

                  <div className="flex gap-3 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setRefundDialogOpen(false);
                        setOrderToRefund(null);
                        setSelectedRefundMethod('');
                      }}
                      className="rounded-xl"
                    >
                      Annuler
                    </Button>
                    <Button
                      onClick={confirmRefund}
                      disabled={requestRefundMutation.isPending || !selectedRefundMethod}
                      className="bg-emerald-600 hover:bg-emerald-700 rounded-xl"
                    >
                      Demander le remboursement
                    </Button>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Review Dialog */}
        <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Donnez votre avis</DialogTitle>
              <DialogDescription>
                Partagez votre expérience sur la commande, la livraison et le service
              </DialogDescription>
            </DialogHeader>
            <ReviewForm
              onSubmit={(data) => createReviewMutation.mutate(data)}
              onCancel={() => setReviewDialogOpen(false)}
              isGeneralReview={true}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}