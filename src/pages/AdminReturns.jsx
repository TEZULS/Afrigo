import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  RotateCcw, ArrowLeft, Check, X, Eye, Clock, Euro
} from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

const returnReasons = {
  wrong_product: 'Mauvais produit',
  expired: 'Date de produit expirée'
};

const statusConfig = {
  pending: { label: 'En attente', className: 'bg-amber-100 text-amber-700', icon: Clock },
  rejected: { label: 'Refusé', className: 'bg-rose-100 text-rose-700', icon: X },
  approved: { label: 'Approuvé', className: 'bg-blue-100 text-blue-700', icon: Check },
  completed: { label: 'Terminé', className: 'bg-emerald-100 text-emerald-700', icon: Check },
};

export default function AdminReturns() {
  const [user, setUser] = useState(null);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [pendingAction, setPendingAction] = useState(null);
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

  const { data: returns = [], isLoading } = useQuery({
    queryKey: ['all-returns'],
    queryFn: () => base44.entities.Return.list('-created_date'),
    enabled: !!user
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user
  });

  const { data: appSettings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list(),
    enabled: !!user
  });

  const updateReturnMutation = useMutation({
    mutationFn: async ({ id, status, refund, rejection_reason }) => {
      const autoNotify = appSettings[0]?.auto_notify_return_status !== false;
      
      const updateData = { status, refund_amount: refund };
      if (rejection_reason) {
        updateData.rejection_reason = rejection_reason;
      }
      await base44.entities.Return.update(id, updateData);
      
      const returnData = returns.find(r => r.id === id);
      const customerUser = users.find(u => u.email === returnData.customer_email);
      const customerName = customerUser?.first_name || 'Client';
      const orderNumber = returnData.order_id?.slice(-8).toUpperCase();

      // Messages selon le statut
      const statusMessages = {
        rejected: {
          subject: '❌ Demande de retour refusée',
          body: `Bonjour ${customerName},

Votre demande de retour pour la commande #${orderNumber} a été refusée.

${rejection_reason ? `Motif: ${rejection_reason}` : ''}

Pour toute question, n'hésitez pas à nous contacter.

L'équipe AfriGo`,
          smsText: `AfriGo: Votre demande de retour pour la commande #${orderNumber} a été refusée. ${rejection_reason ? `Motif: ${rejection_reason}` : ''}`
        },
        approved: {
          subject: '✅ Demande de retour approuvée',
          body: `Bonjour ${customerName},

Bonne nouvelle ! Votre demande de retour pour la commande #${orderNumber} a été approuvée.

Montant du remboursement: ${refund.toFixed(2)}€
Le livreur passera récupérer les produits prochainement.

L'équipe AfriGo`,
          smsText: `AfriGo: Votre retour pour #${orderNumber} est approuvé. Remboursement: ${refund.toFixed(2)}€. Le livreur passera bientôt.`
        },
        completed: {
          subject: '✨ Retour terminé - Remboursement crédité',
          body: `Bonjour ${customerName},

Votre retour pour la commande #${orderNumber} est terminé.

Votre remboursement de ${refund.toFixed(2)}€ a été crédité sur votre portefeuille AfriGo.

Merci de votre confiance,
L'équipe AfriGo`,
          smsText: `AfriGo: Retour terminé pour #${orderNumber}. Remboursement de ${refund.toFixed(2)}€ crédité.`
        }
      };

      // Envoyer email + SMS si activé
      if (autoNotify && statusMessages[status]) {
        await base44.integrations.Core.SendEmail({
          to: returnData.customer_email,
          subject: statusMessages[status].subject,
          body: statusMessages[status].body
        });

        if (customerUser?.phone) {
          await base44.functions.invoke('sendOrderNotification', {
            orderId: returnData.order_id,
            customerEmail: returnData.customer_email,
            customerName: customerName,
            orderNumber: orderNumber,
            phone: customerUser.phone,
            status: 'custom',
            customMessage: statusMessages[status].smsText
          });
        }
      }
      
      // Créer transaction wallet et créditer pour statut approved
      if (status === 'approved' && refund > 0) {
        await base44.entities.WalletTransaction.create({
          customer_email: returnData.customer_email,
          amount: refund,
          type: 'credit',
          reason: `Remboursement retour #${orderNumber}`,
          admin_email: user.email
        });
        
        const currentBalance = customerUser?.wallet_balance || 0;
        await base44.entities.User.update(customerUser.id, {
          wallet_balance: currentBalance + refund
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-returns'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSelectedReturn(null);
      setRefundAmount('');
      setReasonDialogOpen(false);
      setRejectionReason('');
      setPendingAction(null);
      toast.success('Statut mis à jour');
    }
  });

  const handleStatusChange = (status) => {
    if (status === 'rejected') {
      setPendingAction({ status });
      setReasonDialogOpen(true);
    } else if (status === 'approved') {
      const amount = parseFloat(refundAmount);
      if (!amount || amount <= 0) {
        toast.error('Veuillez saisir un montant de remboursement valide');
        return;
      }
      updateReturnMutation.mutate({ 
        id: selectedReturn.id, 
        status, 
        refund: amount
      });
    } else {
      updateReturnMutation.mutate({ 
        id: selectedReturn.id, 
        status, 
        refund: selectedReturn.refund_amount || 0
      });
    }
  };

  const handleReasonSubmit = () => {
    if (!rejectionReason.trim()) {
      toast.error('Veuillez saisir un motif');
      return;
    }
    updateReturnMutation.mutate({
      id: selectedReturn.id,
      status: pendingAction.status,
      refund: selectedReturn.refund_amount || 0,
      rejection_reason: rejectionReason
    });
  };

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
            <RotateCcw className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Gestion des retours</h1>
            <p className="text-slate-500">{returns.length} demandes de retour</p>
          </div>
        </div>

        <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Commande</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Raison</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returns.map(ret => {
                  const status = statusConfig[ret.status] || statusConfig.pending;
                  return (
                    <TableRow key={ret.id}>
                      <TableCell>
                        <span className="font-mono text-sm">
                          #{ret.order_id?.slice(-8).toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {(() => {
                              const customer = users.find(u => u.email === ret.customer_email);
                              return customer?.first_name && customer?.last_name
                                ? `${customer.first_name} ${customer.last_name}`
                                : ret.customer_email;
                            })()}
                          </p>
                          <p className="text-xs text-slate-500">
                            {(() => {
                              const customer = users.find(u => u.email === ret.customer_email);
                              return customer?.customer_id || '';
                            })()}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{returnReasons[ret.reason] || ret.reason}</TableCell>
                      <TableCell>
                        {format(new Date(ret.created_date), 'dd/MM/yyyy', { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <Badge className={status.className}>{status.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedReturn(ret);
                            setRefundAmount(ret.refund_amount ? ret.refund_amount.toString() : '');
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Return Details Dialog */}
        <Dialog open={!!selectedReturn} onOpenChange={() => setSelectedReturn(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Demande de retour</DialogTitle>
            </DialogHeader>
            
            {selectedReturn && (
              <div className="space-y-4 py-4">
                <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Commande</span>
                    <span className="font-mono">#{selectedReturn.order_id?.slice(-8).toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Client</span>
                    <div className="text-right">
                      <p>
                        {(() => {
                          const customer = users.find(u => u.email === selectedReturn.customer_email);
                          return customer?.first_name && customer?.last_name
                            ? `${customer.first_name} ${customer.last_name}`
                            : selectedReturn.customer_email;
                        })()}
                      </p>
                      <p className="text-sm text-slate-500">
                        {(() => {
                          const customer = users.find(u => u.email === selectedReturn.customer_email);
                          return customer?.customer_id || '';
                        })()}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Raison</span>
                    <span>{returnReasons[selectedReturn.reason]}</span>
                  </div>
                  {selectedReturn.refund_amount && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Remboursement</span>
                      <span className="font-semibold text-emerald-600">
                        {selectedReturn.refund_amount.toFixed(2)}€
                      </span>
                    </div>
                  )}
                </div>

                {selectedReturn.description && (
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-sm text-slate-500 mb-1">Description</p>
                    <p>{selectedReturn.description}</p>
                  </div>
                )}

                {selectedReturn.items?.length > 0 && (
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-sm text-slate-500 mb-2">Articles à retourner</p>
                    {selectedReturn.items.map((item, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span>{item.product_name}</span>
                        <span>x{item.quantity}</span>
                      </div>
                    ))}
                  </div>
                )}

                {selectedReturn.rejection_reason && (
                  <div className="bg-rose-50 rounded-xl p-4 border border-rose-200">
                    <p className="text-sm text-slate-500 mb-1">Motif du rejet / non récupération</p>
                    <p className="text-rose-800">{selectedReturn.rejection_reason}</p>
                  </div>
                )}

                {selectedReturn.status === 'pending' && (
                  <div className="space-y-4 pt-4">
                    <div className="bg-emerald-50 rounded-xl p-4">
                      <Label htmlFor="refund" className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                        <Euro className="w-4 h-4 text-emerald-600" />
                        Montant du remboursement
                      </Label>
                      <Input
                        id="refund"
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="0.00"
                        value={refundAmount}
                        onChange={(e) => setRefundAmount(e.target.value)}
                        className="mt-2 h-12 text-lg"
                        required
                      />
                      <p className="text-xs text-slate-500 mt-2">Le montant sera crédité sur le portefeuille du client</p>
                    </div>
                    
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={() => handleStatusChange('rejected')}
                        className="flex-1 text-rose-600 border-rose-200 hover:bg-rose-50"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Rejeter
                      </Button>
                      <Button
                        onClick={() => handleStatusChange('approved')}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                        disabled={!refundAmount || parseFloat(refundAmount) <= 0}
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Approuver
                      </Button>
                    </div>
                  </div>
                )}

                {selectedReturn.status === 'approved' && (
                  <div className="pt-4">
                    <Button
                      onClick={() => handleStatusChange('completed')}
                      className="w-full bg-emerald-500 hover:bg-emerald-600"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Marquer comme terminé
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Reason Dialog */}
        <Dialog open={reasonDialogOpen} onOpenChange={setReasonDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Motif du refus</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="reason">Veuillez préciser le motif</Label>
                <Input
                  id="reason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Saisissez le motif..."
                  className="mt-2"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setReasonDialogOpen(false);
                    setRejectionReason('');
                    setPendingAction(null);
                  }}
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleReasonSubmit}
                  className="flex-1 bg-rose-500 hover:bg-rose-600"
                  disabled={!rejectionReason.trim()}
                >
                  Confirmer
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}