import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wallet, Search, Plus, Minus, ArrowLeft, HelpCircle, History, Trash2, Eye, Printer, CreditCard } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function AdminWallet() {
  const [user, setUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [transactionType, setTransactionType] = useState('credit');
  const [deleteAllUsersDialogOpen, setDeleteAllUsersDialogOpen] = useState(false);
  const [deleteAllTransactionsDialogOpen, setDeleteAllTransactionsDialogOpen] = useState(false);
  const [selectedRefundDetails, setSelectedRefundDetails] = useState(null);
  const [refundDetailsDialogOpen, setRefundDetailsDialogOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [transactionSearchQuery, setTransactionSearchQuery] = useState('');
  const [selectedTransactionDetails, setSelectedTransactionDetails] = useState(null);
  const [transactionDetailsDialogOpen, setTransactionDetailsDialogOpen] = useState(false);
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

  const { data: adminPermissions = [] } = useQuery({
    queryKey: ['adminPermissions'],
    queryFn: () => base44.entities.AdminPermissions.list(),
    enabled: !!user
  });

  const currentUserPermissions = adminPermissions.find(p => p.admin_email === user?.email);
  const isSuperAdmin = currentUserPermissions?.is_super_admin || false;
  const canModify = currentUserPermissions?.can_modify || false;

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => base44.entities.WalletTransaction.list('-created_date', 50),
    enabled: !!user
  });

  const { data: refunds = [] } = useQuery({
    queryKey: ['refunds'],
    queryFn: () => base44.entities.Refund.filter({ status: 'pending' }),
    enabled: !!user
  });

  const { data: completedRefunds = [] } = useQuery({
    queryKey: ['completedRefunds'],
    queryFn: () => base44.entities.Refund.filter({ status: 'completed' }),
    enabled: !!user
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: () => base44.entities.Order.list(),
    enabled: !!user && (refunds.length > 0 || completedRefunds.length > 0)
  });

  const addFundsMutation = useMutation({
    mutationFn: async ({ userId, amount, reason, type }) => {
      const targetUser = users.find(u => u.id === userId);
      const currentBalance = targetUser.wallet_balance || 0;
      const newBalance = type === 'credit' 
        ? currentBalance + parseFloat(amount)
        : currentBalance - parseFloat(amount);

      await base44.entities.User.update(userId, {
        wallet_balance: Math.max(0, newBalance)
      });

      await base44.entities.WalletTransaction.create({
        customer_email: targetUser.email,
        amount: parseFloat(amount),
        type: type,
        reason: reason,
        admin_email: user.email
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setDialogOpen(false);
      setSelectedUser(null);
      setAmount('');
      setReason('');
      toast.success('Transaction effectuée');
    }
  });

  const deleteOrderMutation = useMutation({
    mutationFn: (orderId) => base44.entities.Order.delete(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['refunds'] });
      toast.success('Commande supprimée');
    }
  });

  const deleteAllUsersMutation = useMutation({
    mutationFn: async () => {
      for (const user of users) {
        if (user.role !== 'admin') {
          await base44.entities.User.delete(user.id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeleteAllUsersDialogOpen(false);
      toast.success('Tous les clients ont été supprimés');
    }
  });

  const deleteAllTransactionsMutation = useMutation({
    mutationFn: async () => {
      for (const transaction of transactions) {
        await base44.entities.WalletTransaction.delete(transaction.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setDeleteAllTransactionsDialogOpen(false);
      toast.success('Toutes les transactions ont été supprimées');
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId) => base44.entities.User.delete(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Client supprimé');
    }
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: (transactionId) => base44.entities.WalletTransaction.delete(transactionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Transaction supprimée');
    }
  });

  const processRefundMutation = useMutation({
    mutationFn: async ({ refundId, action, notes, refundMethod, amount }) => {
      const refund = refunds.find(r => r.id === refundId);
      
      if (action === 'approve') {
        // Toujours créditer le portefeuille avec le montant spécifié
        const targetUser = users.find(u => u.email === refund.customer_email);
        const currentBalance = targetUser.wallet_balance || 0;
        await base44.entities.User.update(targetUser.id, {
          wallet_balance: currentBalance + amount
        });

        // Créer transaction avec détails de la méthode
        const refundReason = refund.refund_method === 'wallet'
          ? `💰 Remboursement portefeuille (sans frais) - Commande #${refund.order_id.slice(-8)}`
          : `💳 Remboursement carte bancaire - Commande #${refund.order_id.slice(-8)}`;
        
        await base44.entities.WalletTransaction.create({
          customer_email: refund.customer_email,
          amount: amount,
          type: 'credit',
          reason: refundReason,
          admin_email: user.email
        });

        // Mettre à jour le statut avec le montant
        await base44.entities.Refund.update(refundId, {
          status: 'completed',
          amount: amount,
          admin_notes: notes || `Remboursement de ${amount.toFixed(2)}€ crédité au portefeuille`
        });
      } else {
        await base44.entities.Refund.update(refundId, {
          status: 'rejected',
          admin_notes: notes
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refunds'] });
      queryClient.invalidateQueries({ queryKey: ['completedRefunds'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setRefundAmount('');
      toast.success('Demande de remboursement traitée avec succès');
    },
    onError: (error) => {
      toast.error('Erreur lors du traitement: ' + error.message);
    }
  });

  const handleOpenDialog = (targetUser, type) => {
    if (!isSuperAdmin && !canModify) {
      toast.error('Vous n\'avez pas l\'autorisation de modifier les portefeuilles');
      return;
    }
    if (type === 'credit' && !isSuperAdmin) {
      toast.error('Seul le super administrateur peut créditer les comptes');
      return;
    }
    setSelectedUser(targetUser);
    setTransactionType(type);
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!selectedUser || !amount || parseFloat(amount) <= 0) {
      toast.error('Montant invalide');
      return;
    }

    addFundsMutation.mutate({
      userId: selectedUser.id,
      amount: amount,
      reason: reason,
      type: transactionType
    });
  };

  const filteredUsers = users.filter(u =>
    u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.customer_id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTransactions = transactions.filter(t => {
    if (!transactionSearchQuery) return true;
    const query = transactionSearchQuery.toLowerCase();
    const customer = users.find(u => u.email === t.customer_email);
    return t.customer_email?.toLowerCase().includes(query) ||
           customer?.full_name?.toLowerCase().includes(query) ||
           customer?.first_name?.toLowerCase().includes(query) ||
           customer?.last_name?.toLowerCase().includes(query) ||
           customer?.customer_id?.toLowerCase().includes(query);
  });

  const handleViewRefundDetails = (refund) => {
    const customer = users.find(u => u.email === refund.customer_email);
    const order = orders.find(o => o.id === refund.order_id);
    setSelectedRefundDetails({ refund, customer, order });
    setRefundDetailsDialogOpen(true);
  };

  const handleViewTransactionDetails = (transaction) => {
    const customer = users.find(u => u.email === transaction.customer_email);
    setSelectedTransactionDetails({ transaction, customer });
    setTransactionDetailsDialogOpen(true);
  };

  const handlePrintTransaction = (transaction) => {
    const customer = users.find(u => u.email === transaction.customer_email);
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bordereau Transaction - ${transaction.id.slice(-8).toUpperCase()}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #3b82f6; padding-bottom: 20px; }
            .header h1 { color: #FF8C00; margin: 0; font-size: 32px; }
            .section { margin-bottom: 25px; background: #f8f9fa; padding: 20px; border-radius: 12px; border: 2px solid #e2e8f0; }
            .section h3 { margin: 0 0 15px 0; color: #1e293b; font-size: 18px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; }
            .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
            .info-row:last-child { border-bottom: none; }
            .label { font-weight: 600; color: #64748b; }
            .value { color: #1e293b; font-weight: 500; }
            .amount-box { background: linear-gradient(135deg, ${transaction.type === 'credit' ? '#10b981' : '#ef4444'} 0%, ${transaction.type === 'credit' ? '#059669' : '#dc2626'} 100%); color: white; padding: 25px; border-radius: 12px; text-align: center; margin: 20px 0; }
            .amount-box .label { color: rgba(255,255,255,0.9); font-size: 14px; margin-bottom: 8px; }
            .amount-box .amount { font-size: 48px; font-weight: bold; }
            .status-badge { display: inline-block; padding: 8px 16px; border-radius: 8px; font-weight: 600; font-size: 14px; }
            .status-credit { background: #dcfce7; color: #166534; }
            .status-debit { background: #fee2e2; color: #991b1b; }
            .footer { margin-top: 40px; text-align: center; padding-top: 20px; border-top: 2px solid #e2e8f0; color: #64748b; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>AfriGo</h1>
            <h2 style="margin: 10px 0; color: #3b82f6;">Bordereau de Transaction</h2>
            <p style="color: #64748b; margin: 5px 0;">Numéro: #${transaction.id.slice(-8).toUpperCase()}</p>
            <p style="color: #64748b; margin: 5px 0;">Date d'émission: ${format(new Date(), 'dd MMMM yyyy à HH:mm', { locale: fr })}</p>
          </div>

          <div class="section">
            <h3>📋 Type de transaction</h3>
            <div style="text-align: center; margin-top: 15px;">
              <span class="status-badge ${transaction.type === 'credit' ? 'status-credit' : 'status-debit'}">
                ${transaction.type === 'credit' ? '✅ CRÉDIT' : '❌ DÉBIT'}
              </span>
            </div>
          </div>

          <div class="section">
            <h3>👤 Informations Client</h3>
            <div class="info-row">
              <span class="label">Nom complet:</span>
              <span class="value">${customer?.first_name || ''} ${customer?.last_name || ''}</span>
            </div>
            <div class="info-row">
              <span class="label">Identifiant client:</span>
              <span class="value">${customer?.customer_id || 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="label">Email:</span>
              <span class="value">${customer?.email || transaction.customer_email}</span>
            </div>
            <div class="info-row">
              <span class="label">Téléphone:</span>
              <span class="value">${customer?.phone || 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="label">Adresse:</span>
              <span class="value">${customer?.address || 'N/A'}, ${customer?.postal_code || ''} ${customer?.city || ''}</span>
            </div>
          </div>

          <div class="amount-box">
            <div class="label">💰 MONTANT DE LA TRANSACTION</div>
            <div class="amount">${transaction.type === 'credit' ? '+' : '-'}${transaction.amount.toFixed(2)}€</div>
          </div>

          <div class="section">
            <h3>📝 Raison de la transaction</h3>
            <p style="margin: 10px 0; line-height: 1.6; color: #475569;">
              ${transaction.reason || 'Aucune raison spécifiée'}
            </p>
          </div>

          ${transaction.admin_email ? `
            <div class="section">
              <h3>👨‍💼 Traité par</h3>
              <div class="info-row">
                <span class="label">Administrateur:</span>
                <span class="value">${transaction.admin_email}</span>
              </div>
            </div>
          ` : ''}

          <div class="section">
            <h3>⏱️ Date et heure</h3>
            <div class="info-row">
              <span class="label">Date de transaction:</span>
              <span class="value">${format(parseISO(transaction.created_date), 'dd MMMM yyyy à HH:mm', { locale: fr })}</span>
            </div>
          </div>

          <div class="footer">
            <p><strong>AfriGo</strong> - Gestion des portefeuilles</p>
            <p>Ce document est un bordereau officiel de transaction</p>
            <p>Généré le ${format(new Date(), 'dd MMMM yyyy à HH:mm', { locale: fr })}</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handlePrintRefundReceipt = (refund) => {
    const customer = users.find(u => u.email === refund.customer_email);
    const order = orders.find(o => o.id === refund.order_id);
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bordereau Remboursement - ${refund.id.slice(-8).toUpperCase()}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #9333ea; padding-bottom: 20px; }
            .header h1 { color: #FF8C00; margin: 0; font-size: 32px; }
            .section { margin-bottom: 25px; background: #f8f9fa; padding: 20px; border-radius: 12px; border: 2px solid #e2e8f0; }
            .section h3 { margin: 0 0 15px 0; color: #1e293b; font-size: 18px; border-bottom: 2px solid #9333ea; padding-bottom: 8px; }
            .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
            .info-row:last-child { border-bottom: none; }
            .label { font-weight: 600; color: #64748b; }
            .value { color: #1e293b; font-weight: 500; }
            .amount-box { background: linear-gradient(135deg, #9333ea 0%, #7c3aed 100%); color: white; padding: 25px; border-radius: 12px; text-align: center; margin: 20px 0; }
            .amount-box .label { color: rgba(255,255,255,0.9); font-size: 14px; margin-bottom: 8px; }
            .amount-box .amount { font-size: 48px; font-weight: bold; }
            .status-badge { display: inline-block; padding: 8px 16px; border-radius: 8px; font-weight: 600; font-size: 14px; }
            .status-completed { background: #dcfce7; color: #166534; }
            .status-pending { background: #fef3c7; color: #854d0e; }
            .method-box { background: ${refund.refund_method === 'wallet' ? '#dcfce7' : '#dbeafe'}; border: 2px solid ${refund.refund_method === 'wallet' ? '#86efac' : '#93c5fd'}; padding: 20px; border-radius: 12px; margin: 15px 0; }
            .footer { margin-top: 40px; text-align: center; padding-top: 20px; border-top: 2px solid #e2e8f0; color: #64748b; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>AfriGo</h1>
            <h2 style="margin: 10px 0; color: #9333ea;">Bordereau de Remboursement</h2>
            <p style="color: #64748b; margin: 5px 0;">Numéro: #${refund.id.slice(-8).toUpperCase()}</p>
            <p style="color: #64748b; margin: 5px 0;">Date d'émission: ${format(new Date(), 'dd MMMM yyyy à HH:mm', { locale: fr })}</p>
          </div>

          <div class="section">
            <h3>📋 Statut du remboursement</h3>
            <div style="text-align: center; margin-top: 15px;">
              <span class="status-badge ${refund.status === 'completed' ? 'status-completed' : 'status-pending'}">
                ${refund.status === 'completed' ? '✅ REMBOURSEMENT EFFECTUÉ' : 
                  refund.status === 'approved' ? '⏳ APPROUVÉ - EN COURS' :
                  refund.status === 'rejected' ? '❌ REFUSÉ' : '⏳ EN ATTENTE'}
              </span>
            </div>
          </div>

          <div class="section">
            <h3>👤 Informations Client</h3>
            <div class="info-row">
              <span class="label">Nom complet:</span>
              <span class="value">${customer?.first_name || ''} ${customer?.last_name || ''}</span>
            </div>
            <div class="info-row">
              <span class="label">Identifiant client:</span>
              <span class="value">${customer?.customer_id || 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="label">Email:</span>
              <span class="value">${customer?.email || refund.customer_email}</span>
            </div>
            <div class="info-row">
              <span class="label">Téléphone:</span>
              <span class="value">${customer?.phone || 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="label">Adresse:</span>
              <span class="value">${customer?.address || 'N/A'}, ${customer?.postal_code || ''} ${customer?.city || ''}</span>
            </div>
          </div>

          <div class="section">
            <h3>📦 Commande concernée</h3>
            <div class="info-row">
              <span class="label">Numéro de commande:</span>
              <span class="value">#${refund.order_id.slice(-8).toUpperCase()}</span>
            </div>
            <div class="info-row">
              <span class="label">Date de commande:</span>
              <span class="value">${order ? format(parseISO(order.created_date), 'dd MMMM yyyy à HH:mm', { locale: fr }) : 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="label">Montant commande:</span>
              <span class="value">${order?.total_amount?.toFixed(2) || '0.00'}€</span>
            </div>
          </div>

          <div class="amount-box">
            <div class="label">💰 MONTANT REMBOURSÉ</div>
            <div class="amount">${refund.amount.toFixed(2)}€</div>
          </div>

          <div class="method-box">
            <h3 style="margin: 0 0 15px 0; color: ${refund.refund_method === 'wallet' ? '#166534' : '#1e40af'};">
              ${refund.refund_method === 'wallet' ? '💰 Remboursement via Portefeuille' : '💳 Remboursement via Carte Bancaire'}
            </h3>
            <div class="info-row">
              <span class="label">Méthode sélectionnée:</span>
              <span class="value">${refund.refund_method === 'wallet' ? 'Portefeuille' : 'Carte bancaire'}</span>
            </div>
            <div class="info-row">
              <span class="label">Mode de crédit:</span>
              <span class="value">Crédit au portefeuille client</span>
            </div>
            <div class="info-row">
              <span class="label">Frais appliqués:</span>
              <span class="value">${refund.refund_method === 'wallet' ? 'Aucun (0%)' : '5% de frais'}</span>
            </div>
            ${refund.refund_method !== 'wallet' ? `
              <div class="info-row">
                <span class="label">Montant original:</span>
                <span class="value">${(refund.amount / 0.95).toFixed(2)}€</span>
              </div>
              <div class="info-row">
                <span class="label">Frais déduits:</span>
                <span class="value" style="color: #dc2626;">-${((refund.amount / 0.95) * 0.05).toFixed(2)}€</span>
              </div>
            ` : ''}
          </div>

          <div class="section">
            <h3>📝 Motif du remboursement</h3>
            <p style="margin: 10px 0; line-height: 1.6; color: #475569;">
              ${refund.cancellation_reason || 'Aucun motif spécifié'}
            </p>
          </div>

          ${refund.admin_notes ? `
            <div class="section">
              <h3>💬 Notes administrateur</h3>
              <p style="margin: 10px 0; line-height: 1.6; color: #475569; font-style: italic;">
                ${refund.admin_notes}
              </p>
            </div>
          ` : ''}

          <div class="section">
            <h3>⏱️ Chronologie</h3>
            <div class="info-row">
              <span class="label">Date de demande:</span>
              <span class="value">${format(parseISO(refund.created_date), 'dd MMMM yyyy à HH:mm', { locale: fr })}</span>
            </div>
            ${refund.status !== 'pending' ? `
              <div class="info-row">
                <span class="label">Date de traitement:</span>
                <span class="value">${format(parseISO(refund.updated_date), 'dd MMMM yyyy à HH:mm', { locale: fr })}</span>
              </div>
            ` : ''}
            ${refund.status === 'completed' ? `
              <div class="info-row">
                <span class="label">Traité par:</span>
                <span class="value">${user.email}</span>
              </div>
            ` : ''}
          </div>

          <div class="footer">
            <p><strong>AfriGo</strong> - Gestion des remboursements</p>
            <p>Ce document est un bordereau officiel de remboursement</p>
            <p>Généré le ${format(new Date(), 'dd MMMM yyyy à HH:mm', { locale: fr })}</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const deleteCompletedRefundMutation = useMutation({
    mutationFn: async ({ refundId, customerEmail, amount }) => {
      // Supprimer le remboursement
      await base44.entities.Refund.delete(refundId);
      
      // Débiter le portefeuille du client
      const customer = users.find(u => u.email === customerEmail);
      if (customer) {
        const newBalance = (customer.wallet_balance || 0) - amount;
        await base44.entities.User.update(customer.id, {
          wallet_balance: Math.max(0, newBalance)
        });
      }
      
      // Trouver et supprimer la transaction associée
      const transaction = transactions.find(t => 
        t.customer_email === customerEmail &&
        t.amount === amount &&
        t.type === 'credit' &&
        t.reason?.includes('Remboursement')
      );
      if (transaction) {
        await base44.entities.WalletTransaction.delete(transaction.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refunds'] });
      queryClient.invalidateQueries({ queryKey: ['completedRefunds'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Remboursement supprimé et portefeuille mis à jour');
    },
    onError: () => {
      toast.error('Erreur lors de la suppression');
    }
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
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Wallet className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Gestion des portefeuilles</h1>
              <p className="text-slate-500">{users.length} clients</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteAllUsersDialogOpen(true)}
              className="gap-2 text-rose-600 border-rose-200 hover:bg-rose-50"
            >
              <Trash2 className="w-4 h-4" />
              Supprimer tous les clients
            </Button>
            <Button
              variant="outline"
              onClick={() => setDeleteAllTransactionsDialogOpen(true)}
              className="gap-2 text-orange-600 border-orange-200 hover:bg-orange-50"
            >
              <Trash2 className="w-4 h-4" />
              Supprimer toutes les transactions
            </Button>
            <Link to={createPageUrl('AdminWalletHistory')}>
              <Button variant="outline" className="gap-2">
                <History className="w-4 h-4" />
                Historique complet
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Solde total</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {users.reduce((sum, u) => sum + (u.wallet_balance || 0), 0).toFixed(2)}€
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Remboursements en attente</p>
                  <p className="text-2xl font-bold text-amber-600">
                    {refunds.length}
                  </p>
                </div>
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                  <HelpCircle className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Demandes de remboursement en attente */}
        {refunds.length > 0 && (
          <Card className="border-0 shadow-sm rounded-2xl mb-6 border-2 border-amber-200 bg-amber-50/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-900">
                <HelpCircle className="w-5 h-5" />
                Demandes de remboursement en attente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {refunds.map(refund => {
                  const order = orders.find(o => o.id === refund.order_id);
                  const customer = users.find(u => u.email === refund.customer_email);
                  
                  return (
                    <div key={refund.id} className="p-4 bg-white rounded-xl border-2 border-amber-200">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-slate-800">
                            {customer?.full_name || refund.customer_email}
                          </p>
                          <p className="text-sm text-slate-500">
                            Commande #{refund.order_id.slice(-8).toUpperCase()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-amber-700">
                            {refund.amount.toFixed(2)}€
                          </p>
                          <p className="text-xs text-slate-500">
                            {refund.refund_method === 'wallet' ? 'Vers portefeuille' : 'Vers carte'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="space-y-2 mb-3">
                        <div className="p-3 bg-slate-50 rounded-lg">
                          <p className="text-sm font-medium text-slate-700 mb-1">Motif d'annulation:</p>
                          <p className="text-sm text-slate-600">{refund.cancellation_reason}</p>
                        </div>
                        <div className={`p-3 rounded-lg border-2 ${
                          refund.refund_method === 'wallet' 
                            ? 'bg-emerald-50 border-emerald-200' 
                            : 'bg-amber-50 border-amber-200'
                        }`}>
                          <p className="text-sm font-medium mb-1">
                            {refund.refund_method === 'wallet' ? '💰 Remboursement portefeuille' : '💳 Remboursement carte bancaire'}
                          </p>
                          <p className="text-xs">
                            {refund.refund_method === 'wallet' 
                              ? '✅ Montant total sera crédité au portefeuille (sans frais)' 
                              : '⚠️ Frais de 5% déjà déduits - Sera crédité au portefeuille'
                            }
                          </p>
                        </div>
                        <div className="p-3 bg-blue-50 border-2 border-blue-200 rounded-lg">
                          <Label htmlFor={`refund-amount-${refund.id}`} className="text-sm font-medium text-blue-900 mb-2 block">
                            💰 Montant à rembourser (€)
                          </Label>
                          <Input
                            id={`refund-amount-${refund.id}`}
                            type="number"
                            step="0.01"
                            min="0.01"
                            placeholder="0.00"
                            value={refundAmount}
                            onChange={(e) => setRefundAmount(e.target.value)}
                            className="h-12 text-lg font-semibold"
                            required
                          />
                          <p className="text-xs text-blue-700 mt-2">
                            ⚠️ Saisissez le montant exact à créditer au portefeuille du client
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewRefundDetails(refund)}
                          className="text-purple-600 border-purple-200 hover:bg-purple-50"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Voir détails
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePrintRefundReceipt(refund)}
                          className="text-blue-600 border-blue-200 hover:bg-blue-50"
                        >
                          <Printer className="w-4 h-4 mr-1" />
                          Imprimer
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (confirm('Supprimer cette commande ? Cette action est irréversible.')) {
                              deleteOrderMutation.mutate(refund.order_id);
                            }
                          }}
                          className="text-slate-600 border-slate-200 hover:bg-slate-50"
                          disabled={deleteOrderMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Supprimer commande
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (confirm('Rejeter cette demande de remboursement ?')) {
                              const notes = prompt('Raison du rejet (optionnel):');
                              processRefundMutation.mutate({
                                refundId: refund.id,
                                action: 'reject',
                                notes: notes || 'Demande rejetée',
                                refundMethod: refund.refund_method
                              });
                            }
                          }}
                          className="flex-1 text-rose-600 border-rose-200 hover:bg-rose-50"
                          disabled={processRefundMutation.isPending}
                        >
                          Rejeter
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            const amount = parseFloat(refundAmount);
                            if (!amount || amount <= 0) {
                              toast.error('Veuillez saisir un montant valide');
                              return;
                            }
                            
                            const confirmMsg = `Approuver et créditer ${amount.toFixed(2)}€ au portefeuille du client ?`;
                            
                            if (confirm(confirmMsg)) {
                              processRefundMutation.mutate({
                                refundId: refund.id,
                                action: 'approve',
                                amount: amount,
                                notes: `Remboursement de ${amount.toFixed(2)}€ crédité au portefeuille`,
                                refundMethod: refund.refund_method
                              });
                            }
                          }}
                          className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                          disabled={processRefundMutation.isPending || !refundAmount || parseFloat(refundAmount) <= 0}
                        >
                          Approuver & Créditer portefeuille
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}



        {/* Barre de recherche clients */}
        <div className="relative w-full max-w-sm mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Rechercher par nom ou identifiant client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 rounded-xl h-12"
          />
        </div>

        <Card className="border-0 shadow-sm rounded-2xl mb-6">
          <CardHeader>
            <CardTitle>Portefeuilles clients</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Solde</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map(u => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {(u.first_name || u.last_name) 
                            ? `${u.first_name || ''} ${u.last_name || ''}`.trim() 
                            : u.full_name || 'N/A'}
                        </p>
                        {u.customer_id && (
                          <p className="text-xs text-slate-500">{u.customer_id}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{u.email}</TableCell>
                    <TableCell className="text-right">
                      <span className="font-semibold text-purple-600">
                        {(u.wallet_balance || 0).toFixed(2)}€
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenDialog(u, 'credit')}
                          disabled={!isSuperAdmin}
                          className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={!isSuperAdmin ? 'Réservé au super administrateur' : ''}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Créditer
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenDialog(u, 'debit')}
                          disabled={!isSuperAdmin && !canModify}
                          className="text-rose-600 border-rose-200 hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={!isSuperAdmin && !canModify ? 'Vous n\'avez pas l\'autorisation de modifier' : ''}
                        >
                          <Minus className="w-4 h-4 mr-1" />
                          Débiter
                        </Button>
                        {u.role !== 'admin' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (confirm(`Supprimer le client ${u.full_name || u.email} ?`)) {
                                deleteUserMutation.mutate(u.id);
                              }
                            }}
                            disabled={deleteUserMutation.isPending}
                            className="text-slate-600 border-slate-200 hover:bg-slate-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Dernières transactions et remboursements */}
        <Card className="border-0 shadow-sm rounded-2xl mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-blue-600" />
                Dernières transactions et remboursements
              </CardTitle>
            </div>
            <div className="relative w-full max-w-sm mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Rechercher par nom, identifiant ou email..."
                value={transactionSearchQuery}
                onChange={(e) => setTransactionSearchQuery(e.target.value)}
                className="pl-10 rounded-xl"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {/* Transactions normales */}
              {filteredTransactions.slice(0, 20).map(t => {
                const customer = users.find(u => u.email === t.customer_email);
                
                return (
                  <div key={`t-${t.id}`} className="p-3 bg-white rounded-lg border border-slate-200 hover:border-blue-300 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${t.type === 'credit' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          <div>
                            <p className="font-medium text-sm text-slate-800">
                              {customer?.full_name || customer?.email || t.customer_email}
                            </p>
                            <p className="text-xs text-slate-500">
                              {customer?.customer_id} • {format(parseISO(t.created_date), 'dd/MM/yyyy HH:mm', { locale: fr })}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-slate-600 mt-2 ml-5">{t.reason}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className={`text-lg font-bold ${t.type === 'credit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {t.type === 'credit' ? '+' : '-'}{t.amount.toFixed(2)}€
                          </p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            t.type === 'credit' 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : 'bg-rose-100 text-rose-700'
                          }`}>
                            {t.type === 'credit' ? 'Crédit' : 'Débit'}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleViewTransactionDetails(t)}
                          className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handlePrintTransaction(t)}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm('Supprimer cette transaction ?')) {
                              deleteTransactionMutation.mutate(t.id);
                            }
                          }}
                          disabled={deleteTransactionMutation.isPending}
                          className="text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Remboursements effectués */}
              {completedRefunds.slice(0, 10).map(refund => {
                const customer = users.find(u => u.email === refund.customer_email);
                
                return (
                  <div key={`r-${refund.id}`} className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-200 hover:border-emerald-300 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          <div>
                            <p className="font-medium text-sm text-slate-800">
                              {customer?.full_name || refund.customer_email}
                            </p>
                            <p className="text-xs text-slate-500">
                              {customer?.customer_id} • Cmd #{refund.order_id.slice(-8).toUpperCase()} • {format(parseISO(refund.updated_date), 'dd/MM/yyyy HH:mm', { locale: fr })}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-emerald-700 mt-2 ml-5 font-medium">
                          ✅ Remboursement {refund.refund_method === 'wallet' ? '💰 Portefeuille' : '💳 Carte'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="text-lg font-bold text-emerald-600">
                            +{refund.amount.toFixed(2)}€
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleViewRefundDetails(refund)}
                          className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handlePrintRefundReceipt(refund)}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Supprimer ce remboursement de ${refund.amount.toFixed(2)}€ ?\n\nLe montant sera débité du portefeuille du client.`)) {
                              deleteCompletedRefundMutation.mutate({
                                refundId: refund.id,
                                customerEmail: customer.email,
                                amount: refund.amount
                              });
                            }
                          }}
                          className="text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                          disabled={deleteCompletedRefundMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {transactionType === 'credit' ? 'Créditer' : 'Débiter'} le portefeuille
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Client</Label>
                <Input
                  value={selectedUser?.full_name || selectedUser?.email || ''}
                  disabled
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Solde actuel</Label>
                <Input
                  value={`${(selectedUser?.wallet_balance || 0).toFixed(2)}€`}
                  disabled
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Montant (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Raison</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Raison de la transaction..."
                  className="mt-1"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!amount || parseFloat(amount) <= 0}
                  className={`flex-1 ${
                    transactionType === 'credit' 
                      ? 'bg-emerald-500 hover:bg-emerald-600' 
                      : 'bg-rose-500 hover:bg-rose-600'
                  }`}
                >
                  Confirmer
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete All Users Dialog */}
        <Dialog open={deleteAllUsersDialogOpen} onOpenChange={setDeleteAllUsersDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Supprimer tous les clients ?</DialogTitle>
              <DialogDescription>
                ⚠️ Attention : Cette action supprimera définitivement TOUS les clients (sauf les admins).
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg">
                <p className="text-sm text-rose-800 font-medium mb-2">
                  Cette action est irréversible et supprimera :
                </p>
                <ul className="text-sm text-rose-700 space-y-1 ml-4 list-disc">
                  <li>{users.filter(u => u.role !== 'admin').length} clients au total</li>
                  <li>Tous les profils clients</li>
                  <li>Toutes les données associées</li>
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteAllUsersDialogOpen(false)}
              >
                Annuler
              </Button>
              <Button
                onClick={() => deleteAllUsersMutation.mutate()}
                disabled={deleteAllUsersMutation.isPending}
                className="bg-rose-600 hover:bg-rose-700"
              >
                {deleteAllUsersMutation.isPending ? 'Suppression...' : 'Tout supprimer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete All Transactions Dialog */}
        <Dialog open={deleteAllTransactionsDialogOpen} onOpenChange={setDeleteAllTransactionsDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Supprimer toutes les transactions ?</DialogTitle>
              <DialogDescription>
                ⚠️ Attention : Cette action supprimera définitivement TOUTES les transactions de portefeuille.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm text-orange-800 font-medium mb-2">
                  Cette action est irréversible et supprimera :
                </p>
                <ul className="text-sm text-orange-700 space-y-1 ml-4 list-disc">
                  <li>{transactions.length} transactions au total</li>
                  <li>Tout l'historique des crédits et débits</li>
                  <li>Les traces de toutes les opérations</li>
                </ul>
                <p className="text-xs text-orange-600 mt-3 italic">
                  Note : Les soldes des portefeuilles ne seront pas affectés
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteAllTransactionsDialogOpen(false)}
              >
                Annuler
              </Button>
              <Button
                onClick={() => deleteAllTransactionsMutation.mutate()}
                disabled={deleteAllTransactionsMutation.isPending}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {deleteAllTransactionsMutation.isPending ? 'Suppression...' : 'Tout supprimer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de détails du remboursement */}
        <Dialog open={refundDetailsDialogOpen} onOpenChange={setRefundDetailsDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            {selectedRefundDetails && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-purple-700">
                    <Wallet className="w-6 h-6" />
                    Bordereau de Remboursement #{selectedRefundDetails.refund.id.slice(-8).toUpperCase()}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                  {/* Statut */}
                  <div className="p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl border-2 border-purple-200">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-purple-900">Statut du remboursement</span>
                      <span className={`px-4 py-2 rounded-lg font-semibold ${
                        selectedRefundDetails.refund.status === 'completed' ? 'bg-green-100 text-green-800' :
                        selectedRefundDetails.refund.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                        selectedRefundDetails.refund.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {selectedRefundDetails.refund.status === 'completed' ? '✅ Remboursé' :
                         selectedRefundDetails.refund.status === 'approved' ? '⏳ Approuvé' :
                         selectedRefundDetails.refund.status === 'rejected' ? '❌ Refusé' :
                         '⏳ En attente'}
                      </span>
                    </div>
                  </div>

                  {/* Informations client */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Eye className="w-4 h-4 text-blue-600" />
                      </div>
                      Informations Client
                    </h3>
                    <div className="p-4 bg-slate-50 rounded-xl space-y-3">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Nom complet:</span>
                        <span className="font-semibold">
                          {selectedRefundDetails.customer?.first_name || ''} {selectedRefundDetails.customer?.last_name || ''}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Identifiant client:</span>
                        <span className="font-mono font-semibold">{selectedRefundDetails.customer?.customer_id || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Email:</span>
                        <span className="font-medium">{selectedRefundDetails.customer?.email || selectedRefundDetails.refund.customer_email}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Téléphone:</span>
                        <span className="font-medium">{selectedRefundDetails.customer?.phone || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Adresse:</span>
                        <span className="font-medium text-right">
                          {selectedRefundDetails.customer?.address || 'N/A'}<br/>
                          {selectedRefundDetails.customer?.postal_code} {selectedRefundDetails.customer?.city}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Commande concernée */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                      <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                        <CreditCard className="w-4 h-4 text-orange-600" />
                      </div>
                      Commande Concernée
                    </h3>
                    <div className="p-4 bg-slate-50 rounded-xl space-y-3">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Numéro:</span>
                        <span className="font-mono font-semibold">#{selectedRefundDetails.refund.order_id.slice(-8).toUpperCase()}</span>
                      </div>
                      {selectedRefundDetails.order && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Date de commande:</span>
                            <span className="font-medium">
                              {format(parseISO(selectedRefundDetails.order.created_date), 'dd MMM yyyy à HH:mm', { locale: fr })}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Montant commande:</span>
                            <span className="font-semibold">{selectedRefundDetails.order.total_amount?.toFixed(2)}€</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Montant du remboursement */}
                  <div className="p-6 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl text-white">
                    <p className="text-purple-100 mb-2">Montant remboursé</p>
                    <p className="text-5xl font-bold">{selectedRefundDetails.refund.amount.toFixed(2)}€</p>
                  </div>

                  {/* Méthode de remboursement */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                      <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                        <Wallet className="w-4 h-4 text-emerald-600" />
                      </div>
                      Méthode de Remboursement
                    </h3>
                    <div className={`p-4 rounded-xl border-2 ${
                      selectedRefundDetails.refund.refund_method === 'wallet'
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-blue-50 border-blue-200'
                    }`}>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          {selectedRefundDetails.refund.refund_method === 'wallet' ? (
                            <>
                              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                                <Wallet className="w-6 h-6 text-emerald-600" />
                              </div>
                              <div>
                                <p className="font-semibold text-emerald-900">Portefeuille</p>
                                <p className="text-sm text-emerald-700">Crédité directement sur le solde du client</p>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                <CreditCard className="w-6 h-6 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-semibold text-blue-900">Carte bancaire</p>
                                <p className="text-sm text-blue-700">Crédité sur le portefeuille (frais appliqués)</p>
                              </div>
                            </>
                          )}
                        </div>
                        <div className="bg-white/50 p-3 rounded-lg space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Mode de crédit:</span>
                            <span className="font-semibold">Portefeuille client</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Frais appliqués:</span>
                            <span className="font-semibold">
                              {selectedRefundDetails.refund.refund_method === 'wallet' ? 'Aucun (0%)' : '5%'}
                            </span>
                          </div>
                          {selectedRefundDetails.refund.refund_method !== 'wallet' && (
                            <>
                              <div className="flex justify-between text-slate-600">
                                <span>Montant original:</span>
                                <span>{(selectedRefundDetails.refund.amount / 0.95).toFixed(2)}€</span>
                              </div>
                              <div className="flex justify-between text-red-600">
                                <span>Frais déduits:</span>
                                <span>-{((selectedRefundDetails.refund.amount / 0.95) * 0.05).toFixed(2)}€</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Motif */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-slate-800">Motif du remboursement</h3>
                    <div className="p-4 bg-slate-50 rounded-xl">
                      <p className="text-slate-700">{selectedRefundDetails.refund.cancellation_reason || 'Aucun motif spécifié'}</p>
                    </div>
                  </div>

                  {/* Notes admin */}
                  {selectedRefundDetails.refund.admin_notes && (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-slate-800">Notes administrateur</h3>
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                        <p className="text-blue-900 italic">{selectedRefundDetails.refund.admin_notes}</p>
                      </div>
                    </div>
                  )}

                  {/* Chronologie */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-slate-800">Chronologie</h3>
                    <div className="p-4 bg-slate-50 rounded-xl space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Date de demande:</span>
                        <span className="font-medium">
                          {format(parseISO(selectedRefundDetails.refund.created_date), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                        </span>
                      </div>
                      {selectedRefundDetails.refund.status !== 'pending' && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Date de traitement:</span>
                          <span className="font-medium">
                            {format(parseISO(selectedRefundDetails.refund.updated_date), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <DialogFooter className="gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handlePrintRefundReceipt(selectedRefundDetails.refund)}
                    className="gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    Imprimer le bordereau
                  </Button>
                  <Button
                    onClick={() => setRefundDetailsDialogOpen(false)}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    Fermer
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog de détails de transaction */}
        <Dialog open={transactionDetailsDialogOpen} onOpenChange={setTransactionDetailsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            {selectedTransactionDetails && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-blue-700">
                    <Wallet className="w-6 h-6" />
                    Bordereau de Transaction #{selectedTransactionDetails.transaction.id.slice(-8).toUpperCase()}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                  {/* Statut */}
                  <div className={`p-4 rounded-xl border-2 ${
                    selectedTransactionDetails.transaction.type === 'credit'
                      ? 'bg-gradient-to-r from-emerald-50 to-emerald-100 border-emerald-200'
                      : 'bg-gradient-to-r from-rose-50 to-rose-100 border-rose-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">Type de transaction</span>
                      <span className={`px-4 py-2 rounded-lg font-semibold ${
                        selectedTransactionDetails.transaction.type === 'credit'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {selectedTransactionDetails.transaction.type === 'credit' ? '✅ CRÉDIT' : '❌ DÉBIT'}
                      </span>
                    </div>
                  </div>

                  {/* Informations client */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Eye className="w-4 h-4 text-blue-600" />
                      </div>
                      Informations Client
                    </h3>
                    <div className="p-4 bg-slate-50 rounded-xl space-y-3">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Nom complet:</span>
                        <span className="font-semibold">
                          {selectedTransactionDetails.customer?.first_name || ''} {selectedTransactionDetails.customer?.last_name || ''}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Identifiant client:</span>
                        <span className="font-mono font-semibold">{selectedTransactionDetails.customer?.customer_id || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Email:</span>
                        <span className="font-medium">{selectedTransactionDetails.customer?.email || selectedTransactionDetails.transaction.customer_email}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Téléphone:</span>
                        <span className="font-medium">{selectedTransactionDetails.customer?.phone || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Montant */}
                  <div className={`p-6 rounded-xl text-white ${
                    selectedTransactionDetails.transaction.type === 'credit'
                      ? 'bg-gradient-to-br from-emerald-500 to-emerald-600'
                      : 'bg-gradient-to-br from-rose-500 to-rose-600'
                  }`}>
                    <p className="opacity-90 mb-2">Montant de la transaction</p>
                    <p className="text-5xl font-bold">
                      {selectedTransactionDetails.transaction.type === 'credit' ? '+' : '-'}
                      {selectedTransactionDetails.transaction.amount.toFixed(2)}€
                    </p>
                  </div>

                  {/* Raison */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-slate-800">Raison de la transaction</h3>
                    <div className="p-4 bg-slate-50 rounded-xl">
                      <p className="text-slate-700">{selectedTransactionDetails.transaction.reason || 'Aucune raison spécifiée'}</p>
                    </div>
                  </div>

                  {/* Admin */}
                  {selectedTransactionDetails.transaction.admin_email && (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-slate-800">Traité par</h3>
                      <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
                        <p className="text-purple-900 font-medium">{selectedTransactionDetails.transaction.admin_email}</p>
                      </div>
                    </div>
                  )}

                  {/* Date */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-slate-800">Date et heure</h3>
                    <div className="p-4 bg-slate-50 rounded-xl">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Date de transaction:</span>
                        <span className="font-medium">
                          {format(parseISO(selectedTransactionDetails.transaction.created_date), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <DialogFooter className="gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handlePrintTransaction(selectedTransactionDetails.transaction)}
                    className="gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    Imprimer le bordereau
                  </Button>
                  <Button
                    onClick={() => setTransactionDetailsDialogOpen(false)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Fermer
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}