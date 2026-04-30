import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Banknote, Clock, CheckCircle, XCircle, AlertCircle, ArrowLeft, Eye, CreditCard, Wallet } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function MyRefunds() {
  const [user, setUser] = useState(null);
  const [selectedRefund, setSelectedRefund] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  useEffect(() => {
    base44.auth.me()
      .then(setUser)
      .catch(() => {
        base44.auth.redirectToLogin();
      });
  }, []);

  const { data: refunds = [], isLoading } = useQuery({
    queryKey: ['myRefunds', user?.email],
    queryFn: () => base44.entities.Refund.filter({ customer_email: user?.email }),
    enabled: !!user?.email
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['myOrders', user?.email],
    queryFn: () => base44.entities.Order.filter({ customer_email: user?.email }),
    enabled: !!user?.email
  });

  const statusConfig = {
    pending: {
      label: 'En attente',
      icon: Clock,
      color: 'bg-amber-100 text-amber-800',
      description: 'Votre demande de remboursement est en cours d\'examen'
    },
    approved: {
      label: 'Approuvé',
      icon: CheckCircle,
      color: 'bg-blue-100 text-blue-800',
      description: 'Votre remboursement a été approuvé et est en cours de traitement'
    },
    completed: {
      label: 'Remboursé',
      icon: CheckCircle,
      color: 'bg-green-100 text-green-800',
      description: 'Le remboursement a été effectué avec succès'
    },
    rejected: {
      label: 'Refusé',
      icon: XCircle,
      color: 'bg-red-100 text-red-800',
      description: 'Votre demande de remboursement a été refusée'
    }
  };

  const getOrderInfo = (orderId) => {
    return orders.find(o => o.id === orderId);
  };

  const filterByStatus = (status) => {
    if (status === 'all') return refunds;
    return refunds.filter(r => r.status === status);
  };

  const RefundCard = ({ refund }) => {
    const Status = statusConfig[refund.status];
    const order = getOrderInfo(refund.order_id);

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card 
          className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => {
            setSelectedRefund(refund);
            setDetailsDialogOpen(true);
          }}
        >
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Banknote className="w-5 h-5 text-purple-500" />
                  <h3 className="font-semibold text-slate-800">
                    Remboursement #{refund.id.slice(-8)}
                  </h3>
                </div>
                <p className="text-sm text-slate-500">
                  Commande #{refund.order_id?.slice(-8)}
                </p>
              </div>
              <Badge className={Status.color}>
                <Status.icon className="w-3 h-3 mr-1" />
                {Status.label}
              </Badge>
            </div>

            {/* Informations de la demande */}
            <div className="space-y-3 mb-4">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-sm text-slate-600 mb-1">
                  <strong>Motif:</strong> {refund.reason}
                </p>
                {refund.description && (
                  <p className="text-sm text-slate-600">
                    <strong>Description:</strong> {refund.description}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Montant demandé:</span>
                <span className="font-semibold text-lg text-purple-600">
                  {refund.amount?.toFixed(2) || '0.00'}€
                </span>
              </div>

              {refund.refund_method && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Méthode de remboursement:</span>
                  <span className="font-medium">
                    {refund.refund_method === 'wallet' ? '💰 Portefeuille' : '💳 Carte bancaire'}
                  </span>
                </div>
              )}

              <div className="text-xs text-slate-500">
                Demandé le {format(new Date(refund.created_date), 'dd MMMM yyyy à HH:mm', { locale: fr })}
              </div>
            </div>

            {/* Progression du remboursement */}
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Status.icon className={`w-5 h-5 ${refund.status === 'completed' ? 'text-green-500' : refund.status === 'rejected' ? 'text-red-500' : 'text-amber-500'}`} />
                <p className="text-sm font-medium text-slate-800">
                  {Status.description}
                </p>
              </div>

              {/* Timeline */}
              <div className="space-y-2 mt-4">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${refund.status === 'pending' || refund.status === 'approved' || refund.status === 'completed' || refund.status === 'rejected' ? 'bg-green-500' : 'bg-slate-300'}`} />
                  <span className="text-xs text-slate-600">Demande créée</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${refund.status === 'approved' || refund.status === 'completed' ? 'bg-green-500' : refund.status === 'rejected' ? 'bg-red-500' : 'bg-slate-300'}`} />
                  <span className="text-xs text-slate-600">
                    {refund.status === 'rejected' ? 'Demande refusée' : 'En cours d\'examen'}
                  </span>
                </div>
                {refund.status !== 'rejected' && (
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${refund.status === 'completed' ? 'bg-green-500' : 'bg-slate-300'}`} />
                    <span className="text-xs text-slate-600">Remboursement effectué</span>
                  </div>
                )}
              </div>
            </div>

            {/* Réponse admin si refusé */}
            {refund.status === 'rejected' && refund.rejection_reason && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">
                  <strong>Motif du refus:</strong> {refund.rejection_reason}
                </p>
              </div>
            )}

            {/* Note pour remboursement en portefeuille */}
            {refund.status === 'completed' && refund.refund_method === 'wallet' && (
              <div className="mt-4 bg-purple-50 border border-purple-200 rounded-lg p-3">
                <p className="text-sm text-purple-800">
                  ✅ Le montant de {refund.amount?.toFixed(2)}€ a été crédité dans votre portefeuille
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  if (!user || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link to={createPageUrl('Orders')} className="inline-flex items-center text-slate-600 hover:text-emerald-600 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour aux commandes
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Mes remboursements</h1>
          <p className="text-slate-600">
            Suivez l'état de vos demandes de remboursement
          </p>
        </div>

        {/* Stats rapides */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {Object.entries(statusConfig).map(([status, config]) => {
            const count = filterByStatus(status).length;
            return (
              <Card key={status} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <config.icon className={`w-4 h-4 ${status === 'completed' ? 'text-green-500' : status === 'rejected' ? 'text-red-500' : 'text-amber-500'}`} />
                    <span className="text-2xl font-bold text-slate-800">{count}</span>
                  </div>
                  <p className="text-xs text-slate-600">{config.label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Tabs par statut */}
        <Tabs defaultValue="all" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 bg-white rounded-xl p-1 shadow-sm">
            <TabsTrigger value="all" className="rounded-lg">
              Tous ({refunds.length})
            </TabsTrigger>
            <TabsTrigger value="pending" className="rounded-lg">
              En attente ({filterByStatus('pending').length})
            </TabsTrigger>
            <TabsTrigger value="approved" className="rounded-lg">
              Approuvés ({filterByStatus('approved').length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="rounded-lg">
              Remboursés ({filterByStatus('completed').length})
            </TabsTrigger>
            <TabsTrigger value="rejected" className="rounded-lg">
              Refusés ({filterByStatus('rejected').length})
            </TabsTrigger>
          </TabsList>

          {['all', 'pending', 'approved', 'completed', 'rejected'].map(status => (
            <TabsContent key={status} value={status} className="space-y-4">
              {filterByStatus(status).length === 0 ? (
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-12 text-center">
                    <Banknote className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">
                      {status === 'all' 
                        ? 'Aucune demande de remboursement'
                        : `Aucune demande ${statusConfig[status]?.label.toLowerCase()}`
                      }
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filterByStatus(status)
                  .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
                  .map(refund => (
                    <RefundCard key={refund.id} refund={refund} />
                  ))
              )}
            </TabsContent>
          ))}
        </Tabs>

        {/* Dialog de détails */}
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            {selectedRefund && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Banknote className="w-5 h-5 text-purple-500" />
                    Détails du remboursement #{selectedRefund.id.slice(-8)}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                  {/* Statut */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                    <span className="text-sm font-medium text-slate-700">Statut actuel</span>
                    <Badge className={statusConfig[selectedRefund.status].color}>
                      {React.createElement(statusConfig[selectedRefund.status].icon, { className: "w-3 h-3 mr-1" })}
                      {statusConfig[selectedRefund.status].label}
                    </Badge>
                  </div>

                  {/* Informations de la commande */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-slate-800">Informations de la commande</h3>
                    <div className="p-4 bg-slate-50 rounded-xl space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Numéro de commande:</span>
                        <span className="font-mono font-medium">#{selectedRefund.order_id?.slice(-8)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Date de demande:</span>
                        <span className="font-medium">
                          {format(new Date(selectedRefund.created_date), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Montant du remboursement */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-slate-800">Montant du remboursement</h3>
                    <div className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border-2 border-purple-200">
                      <p className="text-sm text-purple-700 mb-1">Montant remboursé</p>
                      <p className="text-4xl font-bold text-purple-900">
                        {selectedRefund.amount?.toFixed(2) || '0.00'}€
                      </p>
                    </div>
                  </div>

                  {/* Méthode de remboursement */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-slate-800">Méthode de remboursement</h3>
                    <div className={`p-4 rounded-xl border-2 ${
                      selectedRefund.refund_method === 'wallet' 
                        ? 'bg-emerald-50 border-emerald-200' 
                        : 'bg-blue-50 border-blue-200'
                    }`}>
                      <div className="flex items-center gap-3">
                        {selectedRefund.refund_method === 'wallet' ? (
                          <>
                            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                              <Wallet className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-emerald-900">Portefeuille</p>
                              <p className="text-sm text-emerald-700">Crédité directement sur votre solde</p>
                              {selectedRefund.status === 'completed' && (
                                <p className="text-xs text-emerald-600 mt-1">✅ Sans frais - Montant total reçu</p>
                              )}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <CreditCard className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-blue-900">Carte bancaire</p>
                              <p className="text-sm text-blue-700">Crédité sur votre portefeuille</p>
                              {selectedRefund.status === 'completed' && (
                                <p className="text-xs text-blue-600 mt-1">ℹ️ Frais de 5% appliqués</p>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Motif */}
                  {selectedRefund.cancellation_reason && (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-slate-800">Motif de la demande</h3>
                      <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-sm text-slate-700">{selectedRefund.cancellation_reason}</p>
                      </div>
                    </div>
                  )}

                  {/* Timeline */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-slate-800">Progression du remboursement</h3>
                    <div className="p-4 bg-slate-50 rounded-xl">
                      <div className="space-y-4">
                        <div className="flex items-start gap-3">
                          <div className={`w-4 h-4 rounded-full mt-1 ${
                            ['pending', 'approved', 'completed', 'rejected'].includes(selectedRefund.status) 
                              ? 'bg-green-500' 
                              : 'bg-slate-300'
                          }`} />
                          <div className="flex-1">
                            <p className="font-medium text-slate-800">Demande créée</p>
                            <p className="text-xs text-slate-500">
                              {format(new Date(selectedRefund.created_date), 'dd MMM yyyy à HH:mm', { locale: fr })}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-3">
                          <div className={`w-4 h-4 rounded-full mt-1 ${
                            ['approved', 'completed'].includes(selectedRefund.status) 
                              ? 'bg-green-500' 
                              : selectedRefund.status === 'rejected'
                                ? 'bg-red-500'
                                : 'bg-slate-300'
                          }`} />
                          <div className="flex-1">
                            <p className="font-medium text-slate-800">
                              {selectedRefund.status === 'rejected' ? 'Demande refusée' : 'Demande approuvée'}
                            </p>
                            {(selectedRefund.status === 'approved' || selectedRefund.status === 'completed' || selectedRefund.status === 'rejected') && (
                              <p className="text-xs text-slate-500">
                                {format(new Date(selectedRefund.updated_date), 'dd MMM yyyy à HH:mm', { locale: fr })}
                              </p>
                            )}
                          </div>
                        </div>

                        {selectedRefund.status !== 'rejected' && (
                          <div className="flex items-start gap-3">
                            <div className={`w-4 h-4 rounded-full mt-1 ${
                              selectedRefund.status === 'completed' 
                                ? 'bg-green-500' 
                                : 'bg-slate-300'
                            }`} />
                            <div className="flex-1">
                              <p className="font-medium text-slate-800">Remboursement effectué</p>
                              {selectedRefund.status === 'completed' && (
                                <p className="text-xs text-slate-500">
                                  {format(new Date(selectedRefund.updated_date), 'dd MMM yyyy à HH:mm', { locale: fr })}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Notes admin (si rejet) */}
                  {selectedRefund.status === 'rejected' && selectedRefund.admin_notes && (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-slate-800">Motif du refus</h3>
                      <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                        <p className="text-sm text-red-800">{selectedRefund.admin_notes}</p>
                      </div>
                    </div>
                  )}

                  {/* Message de confirmation */}
                  {selectedRefund.status === 'completed' && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                      <div className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-green-900 mb-1">Remboursement effectué avec succès</p>
                          <p className="text-sm text-green-700">
                            Le montant de {selectedRefund.amount?.toFixed(2)}€ a été crédité sur votre portefeuille. 
                            Vous pouvez l'utiliser pour vos prochaines commandes.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={() => setDetailsDialogOpen(false)}
                    className="bg-emerald-500 hover:bg-emerald-600"
                  >
                    Fermer
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}