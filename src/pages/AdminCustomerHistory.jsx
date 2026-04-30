import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { User, Search, Printer, ChevronDown, ChevronUp, TrendingUp, ArrowLeft, CreditCard, Wallet, Banknote, Trash2, Tag } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import OrderStatusBadge from '@/components/orders/OrderStatusBadge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AdminCustomerHistory() {
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCustomers, setExpandedCustomers] = useState({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const getStatusLabel = (status) => {
    const statusMap = {
      'pending': 'En attente',
      'confirmed': 'Confirmée',
      'preparing': 'En préparation',
      'shipped': 'Expédiée',
      'delivered': 'Livrée',
      'cancelled': 'Annulée'
    };
    return statusMap[status] || status;
  };

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u.role !== 'admin') {
        navigate('/');
      } else {
        setUser(u);
      }
    }).catch(() => navigate('/'));
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

  const { data: walletTransactions = [] } = useQuery({
    queryKey: ['walletTransactions'],
    queryFn: () => base44.entities.WalletTransaction.list('-created_date'),
    enabled: !!user
  });

  // Grouper les commandes par client
  const customersWithOrders = users.map(customer => {
    const customerOrders = allOrders.filter(o => o.customer_email === customer.email);
    const totalSpent = customerOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const customerTransactions = walletTransactions.filter(t => t.customer_email === customer.email);
    
    // Calculer les stats par moyen de paiement
    const paymentStats = {
      card: customerOrders.filter(o => o.payment_method === 'card').reduce((sum, o) => sum + (o.total_amount || 0), 0),
      delivery: customerOrders.filter(o => o.payment_method === 'delivery').reduce((sum, o) => sum + (o.total_amount || 0), 0),
      wallet: customerOrders.reduce((sum, o) => sum + (o.wallet_amount_used || 0), 0)
    };
    
    return {
      ...customer,
      orders: customerOrders,
      totalSpent,
      ordersCount: customerOrders.length,
      paymentStats,
      transactions: customerTransactions
    };
  }).filter(c => c.ordersCount > 0);

  const filteredCustomers = customersWithOrders.filter(c => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const fullName = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();
    return fullName.includes(query) || 
           c.email?.toLowerCase().includes(query) ||
           c.customer_id?.toLowerCase().includes(query);
  });

  const toggleCustomer = (email) => {
    setExpandedCustomers(prev => ({
      ...prev,
      [email]: !prev[email]
    }));
  };

  const handlePrintCustomerHistory = (customer) => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Historique - ${customer.first_name} ${customer.last_name}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .header { text-align: center; margin-bottom: 30px; }
            .header h1 { color: #FF8C00; margin: 0; font-size: 32px; }
            .section { margin-bottom: 20px; background: #f8f9fa; padding: 15px; border-radius: 8px; }
            .section h3 { margin-top: 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background: #f1f5f9; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #ddd; }
            td { padding: 10px; border-bottom: 1px solid #eee; }
            .total { font-weight: bold; font-size: 18px; padding: 15px; background: #10b981; color: white; margin-top: 20px; text-align: right; border-radius: 8px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>AfriGo</h1>
            <h2>Historique Client</h2>
            <p>Généré le ${format(new Date(), 'dd MMMM yyyy à HH:mm', { locale: fr })}</p>
          </div>
          
          <div class="section">
            <h3>Informations Client</h3>
            <p><strong>Nom:</strong> ${customer.first_name} ${customer.last_name}</p>
            <p><strong>ID Client:</strong> ${customer.customer_id || '-'}</p>
            <p><strong>Email:</strong> ${customer.email}</p>
            <p><strong>Téléphone:</strong> ${customer.phone || '-'}</p>
            <p><strong>Adresse:</strong> ${customer.address || '-'}, ${customer.postal_code || ''} ${customer.city || ''}</p>
          </div>
          
          <div class="section">
            <h3>Résumé</h3>
            <p><strong>Nombre total de commandes:</strong> ${customer.ordersCount}</p>
            <p><strong>Montant total dépensé:</strong> ${customer.totalSpent.toFixed(2)}€</p>
            <p><strong>Panier moyen:</strong> ${(customer.totalSpent / customer.ordersCount).toFixed(2)}€</p>
          </div>
          
          <div class="section">
            <h3>Moyens de paiement utilisés</h3>
            <p><strong>💳 Carte bancaire:</strong> ${customer.paymentStats.card.toFixed(2)}€</p>
            <p><strong>💵 Paiement à la livraison:</strong> ${customer.paymentStats.delivery.toFixed(2)}€</p>
            <p><strong>💰 Portefeuille:</strong> ${customer.paymentStats.wallet.toFixed(2)}€</p>
          </div>
          
          <h3>Historique des commandes</h3>
          <table>
            <thead>
              <tr>
                <th>Numéro</th>
                <th>Date</th>
                <th>Montant</th>
                <th>Paiement</th>
                <th>Statut</th>
                <th>Articles</th>
              </tr>
            </thead>
            <tbody>
              ${customer.orders.map(order => `
                <tr>
                  <td>#${order.id.slice(-8).toUpperCase()}</td>
                  <td>${format(parseISO(order.created_date), 'dd/MM/yyyy HH:mm', { locale: fr })}</td>
                  <td><strong>${order.total_amount?.toFixed(2)}€</strong>${order.wallet_amount_used > 0 ? `<br><small style="color: #9333ea;">-${order.wallet_amount_used.toFixed(2)}€ portefeuille</small>` : ''}</td>
                  <td>${order.payment_method === 'card' ? '💳 Carte' : '💵 Livraison'}${order.wallet_amount_used > 0 ? '<br>💰 +Portefeuille' : ''}</td>
                  <td>${getStatusLabel(order.status)}</td>
                  <td>${order.items?.length || 0} article(s)</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="total">
            TOTAL DÉPENSÉ: ${customer.totalSpent.toFixed(2)}€
          </div>
          
          <div style="margin-top: 30px; padding: 15px; background: #f8f9fa; border-radius: 8px; text-align: center;">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(window.location.origin)}" alt="QR Code" style="width: 120px; height: 120px; margin: 0 auto;" />
            <p style="margin-top: 10px; font-size: 14px; color: #666;">📱 Scannez ici et passez vos commandes sur l'appli</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handlePrintOrder = (order, customer) => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bordereau - ${order.id.slice(-8).toUpperCase()}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .header { text-align: center; margin-bottom: 30px; }
            .header h1 { color: #FF8C00; margin: 0; font-size: 32px; }
            .header h2 { margin: 10px 0; }
            .section { margin-bottom: 20px; background: #f8f9fa; padding: 15px; border-radius: 8px; }
            .section h3 { margin-top: 0; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            .items { margin-top: 20px; }
            .item { display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #ddd; }
            .total { font-weight: bold; font-size: 18px; padding: 15px; background: #f8f9fa; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>AfriGo</h1>
            <h2>Bordereau de commande #${order.id.slice(-8).toUpperCase()}</h2>
            <p>Date: ${format(parseISO(order.created_date), 'dd MMMM yyyy à HH:mm', { locale: fr })}</p>
          </div>
          
          <div class="grid">
            <div class="section">
              <h3>Client</h3>
              <p><strong>${customer.first_name} ${customer.last_name}</strong></p>
              ${customer.customer_id ? `<p>${customer.customer_id}</p>` : ''}
            </div>
            
            <div class="section">
              <h3>Adresse de livraison</h3>
              <p>${order.delivery_address}</p>
              <p>${order.delivery_postal_code} ${order.delivery_city}</p>
            </div>
          </div>
          
          <div class="items">
            <h3>Articles commandés</h3>
            ${order.items?.map(item => `
              <div class="item">
                <div>
                  <strong>${item.product_name}</strong><br>
                  ${item.selected_variants && Object.keys(item.selected_variants).length > 0 ? `
                    <div style="margin: 5px 0;">
                      ${Object.entries(item.selected_variants).map(([key, variant]) => 
                        `<span style="background: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-right: 4px;">${variant.type}: ${variant.value}</span>`
                      ).join('')}
                    </div>
                  ` : ''}
                  <small>${item.quantity} x ${item.unit_price?.toFixed(2)}€</small>
                </div>
                <div><strong>${item.total_price?.toFixed(2)}€</strong></div>
              </div>
            `).join('')}
            <div class="total">
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span>Total</span>
                <span>${order.total_amount?.toFixed(2)}€</span>
              </div>
              ${order.wallet_amount_used > 0 ? `
                <div style="display: flex; justify-content: space-between; color: #9333ea; font-size: 14px; margin-bottom: 10px;">
                  <span>💳 Portefeuille utilisé</span>
                  <span>-${order.wallet_amount_used.toFixed(2)}€</span>
                </div>
              ` : ''}
              <div style="display: flex; justify-content: space-between; padding-top: 10px; border-top: 2px solid #ddd;">
                <span style="font-size: 18px;">Montant restant à régler</span>
                <span style="color: #10b981; font-size: 20px;">${(order.amount_to_pay || order.total_amount).toFixed(2)}€</span>
              </div>
              <div style="margin-top: 15px; padding: 10px; background: ${order.payment_method === 'delivery' ? '#fef3c7' : '#dbeafe'}; border-radius: 8px;">
                <strong style="font-size: 14px;">Mode de paiement:</strong>
                <div style="font-size: 16px; font-weight: bold; margin-top: 5px; color: ${order.payment_method === 'delivery' ? '#d97706' : '#2563eb'};">
                  ${order.payment_method === 'delivery' ? '💵 PAIEMENT À LA LIVRAISON' : '💳 Payé par carte bancaire'}
                </div>
              </div>
            </div>
          </div>
          
          <div style="margin-top: 30px; padding: 15px; background: #f8f9fa; border-radius: 8px; text-align: center;">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(window.location.origin)}" alt="QR Code" style="width: 120px; height: 120px; margin: 0 auto;" />
            <p style="margin-top: 10px; font-size: 14px; color: #666;">📱 Scannez ici et passez vos commandes sur l'appli</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const deleteCustomerOrdersMutation = useMutation({
    mutationFn: async (customerEmail) => {
      const customerOrders = allOrders.filter(o => o.customer_email === customerEmail);
      const deletePromises = customerOrders.map(order => 
        base44.entities.Order.delete(order.id)
      );
      return Promise.all(deletePromises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-orders'] });
      setDeleteDialogOpen(false);
      setCustomerToDelete(null);
      toast.success('Toutes les commandes du client ont été supprimées');
    },
    onError: () => {
      toast.error('Erreur lors de la suppression des commandes');
    }
  });

  const handleDeleteCustomerOrders = (customer) => {
    setCustomerToDelete(customer);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (customerToDelete) {
      deleteCustomerOrdersMutation.mutate(customerToDelete.email);
    }
  };

  const deleteRefundMutation = useMutation({
    mutationFn: async ({ transactionId, customerEmail, amount }) => {
      // Supprimer la transaction
      await base44.entities.WalletTransaction.delete(transactionId);
      
      // Débiter le montant du portefeuille du client
      const customer = users.find(u => u.email === customerEmail);
      if (customer) {
        const newBalance = (customer.wallet_balance || 0) - amount;
        await base44.entities.User.update(customer.id, {
          wallet_balance: Math.max(0, newBalance)
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['walletTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Remboursement supprimé et portefeuille mis à jour');
    },
    onError: () => {
      toast.error('Erreur lors de la suppression');
    }
  });

  const handlePrintAllHistory = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Historique complet - Tous les clients</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .header { text-align: center; margin-bottom: 30px; }
            .header h1 { color: #FF8C00; margin: 0; font-size: 32px; }
            .customer-block { page-break-inside: avoid; margin-bottom: 40px; border: 2px solid #e2e8f0; border-radius: 8px; padding: 20px; }
            .customer-header { background: #f1f5f9; padding: 15px; border-radius: 6px; margin-bottom: 15px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background: #f8f9fa; padding: 10px; text-align: left; font-weight: 600; border-bottom: 2px solid #ddd; font-size: 12px; }
            td { padding: 8px; border-bottom: 1px solid #eee; font-size: 12px; }
            .total { font-weight: bold; padding: 10px; background: #10b981; color: white; text-align: right; border-radius: 6px; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>AfriGo</h1>
            <h2>Historique Complet de Tous les Clients</h2>
            <p>Généré le ${format(new Date(), 'dd MMMM yyyy à HH:mm', { locale: fr })}</p>
            <p><strong>Total clients: ${filteredCustomers.length}</strong></p>
            <p><strong>Total commandes: ${filteredCustomers.reduce((sum, c) => sum + c.ordersCount, 0)}</strong></p>
            <p><strong>Chiffre d'affaires total: ${filteredCustomers.reduce((sum, c) => sum + c.totalSpent, 0).toFixed(2)}€</strong></p>
          </div>
          
          ${filteredCustomers.map(customer => `
            <div class="customer-block">
              <div class="customer-header">
                <h3 style="margin: 0 0 10px 0;">${customer.first_name} ${customer.last_name}</h3>
                <p style="margin: 5px 0;"><strong>ID:</strong> ${customer.customer_id || '-'} | <strong>Email:</strong> ${customer.email}</p>
                <p style="margin: 5px 0;"><strong>Total dépensé:</strong> ${customer.totalSpent.toFixed(2)}€ | <strong>Commandes:</strong> ${customer.ordersCount} | <strong>Panier moyen:</strong> ${(customer.totalSpent / customer.ordersCount).toFixed(2)}€</p>
              </div>
              
              <table>
                <thead>
                  <tr>
                    <th>N° Commande</th>
                    <th>Date</th>
                    <th>Articles</th>
                    <th>Montant</th>
                    <th>Paiement</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  ${customer.orders.map(order => `
                    <tr>
                      <td>#${order.id.slice(-8).toUpperCase()}</td>
                      <td>${format(parseISO(order.created_date), 'dd/MM/yyyy HH:mm', { locale: fr })}</td>
                      <td>${order.items?.length || 0}</td>
                      <td><strong>${order.total_amount?.toFixed(2)}€</strong>${order.wallet_amount_used > 0 ? `<br><small style="color: #9333ea;">-${order.wallet_amount_used.toFixed(2)}€ portefeuille</small>` : ''}</td>
                      <td style="font-size: 11px;">${order.payment_method === 'card' ? '💳 Carte' : '💵 Livraison'}${order.wallet_amount_used > 0 ? '<br>💰 +Portefeuille' : ''}</td>
                      <td>${getStatusLabel(order.status)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              
              <div class="total">
                TOTAL CLIENT: ${customer.totalSpent.toFixed(2)}€
              </div>
            </div>
          `).join('')}
          
          <div style="margin-top: 30px; padding: 15px; background: #f8f9fa; border-radius: 8px; text-align: center;">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(window.location.origin)}" alt="QR Code" style="width: 120px; height: 120px; margin: 0 auto;" />
            <p style="margin-top: 10px; font-size: 14px; color: #666;">📱 Scannez ici et passez vos commandes sur l'appli</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

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
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <User className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Historique Clients</h1>
              <p className="text-slate-500">{filteredCustomers.length} clients • {filteredCustomers.reduce((sum, c) => sum + c.ordersCount, 0)} commandes</p>
            </div>
          </div>

          <Button
            onClick={handlePrintAllHistory}
            className="bg-emerald-500 hover:bg-emerald-600 rounded-xl"
          >
            <Printer className="w-4 h-4 mr-2" />
            Imprimer tout
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <Input
            type="text"
            placeholder="Rechercher un client par nom, email ou ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-12 pl-12 rounded-xl"
          />
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Chiffre d'affaires total</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {filteredCustomers.reduce((sum, c) => sum + c.totalSpent, 0).toFixed(2)}€
                  </p>
                </div>
                <TrendingUp className="w-10 h-10 text-emerald-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="p-6">
              <div>
                <p className="text-sm text-slate-500 mb-1">Panier moyen</p>
                <p className="text-2xl font-bold text-slate-800">
                  {filteredCustomers.length > 0 
                    ? (filteredCustomers.reduce((sum, c) => sum + c.totalSpent, 0) / 
                       filteredCustomers.reduce((sum, c) => sum + c.ordersCount, 0)).toFixed(2)
                    : '0.00'}€
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="p-6">
              <div>
                <p className="text-sm text-slate-500 mb-1">Total commandes</p>
                <p className="text-2xl font-bold text-slate-800">
                  {filteredCustomers.reduce((sum, c) => sum + c.ordersCount, 0)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Customers List */}
        <div className="space-y-4">
          {filteredCustomers.map(customer => (
            <Card key={customer.email} className="border-0 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader 
                className="cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => toggleCustomer(customer.email)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                      <User className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        {customer.first_name} {customer.last_name}
                      </CardTitle>
                      <p className="text-sm text-slate-500">
                        {customer.customer_id || customer.email} • {customer.ordersCount} commande(s)
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                     <div className="mb-2">
                       <p className="text-2xl font-bold text-emerald-600">
                         {customer.totalSpent.toFixed(2)}€
                       </p>
                       <p className="text-xs text-slate-500">
                         Panier moyen: {(customer.totalSpent / customer.ordersCount).toFixed(2)}€
                       </p>
                     </div>
                     <div className="flex gap-2 text-xs">
                       {customer.paymentStats.card > 0 && (
                         <div className="bg-blue-50 px-2 py-1 rounded">
                           <CreditCard className="w-3 h-3 inline mr-1 text-blue-600" />
                           {customer.paymentStats.card.toFixed(0)}€
                         </div>
                       )}
                       {customer.paymentStats.delivery > 0 && (
                         <div className="bg-amber-50 px-2 py-1 rounded">
                           <Banknote className="w-3 h-3 inline mr-1 text-amber-600" />
                           {customer.paymentStats.delivery.toFixed(0)}€
                         </div>
                       )}
                       {customer.paymentStats.wallet > 0 && (
                         <div className="bg-purple-50 px-2 py-1 rounded">
                           <Wallet className="w-3 h-3 inline mr-1 text-purple-600" />
                           {customer.paymentStats.wallet.toFixed(0)}€
                         </div>
                       )}
                     </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePrintCustomerHistory(customer);
                      }}
                      title="Imprimer l'historique"
                    >
                      <Printer className="w-4 h-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCustomerOrders(customer);
                      }}
                      className="text-rose-500 hover:text-rose-600"
                      title="Supprimer toutes les commandes"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    
                    {expandedCustomers[customer.email] ? (
                      <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                </div>
              </CardHeader>

              {expandedCustomers[customer.email] && (
                <CardContent className="border-t">
                  {/* Transactions Wallet - Remboursements */}
                  {customer.transactions.filter(t => t.type === 'credit' && t.reason?.includes('Remboursement')).length > 0 && (
                    <div className="mb-6">
                      <h4 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                        <Wallet className="w-4 h-4" />
                        Remboursements effectués
                      </h4>
                      <div className="space-y-2">
                        {customer.transactions
                          .filter(t => t.type === 'credit' && t.reason?.includes('Remboursement'))
                          .map(transaction => (
                            <div
                              key={transaction.id}
                              className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-lg"
                            >
                              <div className="flex-1">
                                <p className="font-medium text-slate-800">{transaction.reason}</p>
                                <p className="text-sm text-slate-500">
                                  {format(parseISO(transaction.created_date), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                                </p>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-lg font-bold text-emerald-600">
                                  +{transaction.amount.toFixed(2)}€
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    if (confirm(`Supprimer ce remboursement de ${transaction.amount.toFixed(2)}€ ?\n\nLe montant sera débité du portefeuille du client.`)) {
                                      deleteRefundMutation.mutate({
                                        transactionId: transaction.id,
                                        customerEmail: customer.email,
                                        amount: transaction.amount
                                      });
                                    }
                                  }}
                                  className="text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Commande</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Articles</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Code promo</TableHead>
                        <TableHead>Paiement</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customer.orders.map(order => (
                        <TableRow key={order.id}>
                          <TableCell>
                            <span className="font-mono text-sm">
                              #{order.id.slice(-8).toUpperCase()}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {format(parseISO(order.created_date), 'dd/MM/yyyy', { locale: fr })}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {format(parseISO(order.created_date), 'HH:mm', { locale: fr })}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {order.items?.length || 0} article(s)
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              <span className="font-semibold">
                                {order.total_amount?.toFixed(2)}€
                              </span>
                              {order.wallet_amount_used > 0 && (
                                <p className="text-xs text-purple-600">
                                  -{order.wallet_amount_used.toFixed(2)}€ portefeuille
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {order.promo_code ? (
                              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                {order.promo_code}
                              </Badge>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {order.payment_method === 'card' ? (
                                <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                                  <CreditCard className="w-3 h-3 mr-1" />
                                  Carte
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                                  <Banknote className="w-3 h-3 mr-1" />
                                  Livraison
                                </Badge>
                              )}
                              {order.wallet_amount_used > 0 && (
                                <Badge variant="outline" className="text-purple-600 border-purple-200 bg-purple-50">
                                  <Wallet className="w-3 h-3 mr-1" />
                                  {order.wallet_amount_used.toFixed(0)}€
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <OrderStatusBadge status={order.status} />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handlePrintOrder(order, customer)}
                            >
                              <Printer className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              )}
            </Card>
          ))}
        </div>

        {filteredCustomers.length === 0 && (
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="py-12 text-center">
              <User className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Aucun client trouvé</p>
            </CardContent>
          </Card>
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Supprimer toutes les commandes ?</DialogTitle>
              <DialogDescription>
                Êtes-vous sûr de vouloir supprimer toutes les commandes de{' '}
                <strong>
                  {customerToDelete?.first_name} {customerToDelete?.last_name}
                </strong>{' '}
                ({customerToDelete?.ordersCount} commande{customerToDelete?.ordersCount > 1 ? 's' : ''}) ?<br />
                Cette action est irréversible.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-3 justify-end mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setCustomerToDelete(null);
                }}
                className="rounded-xl"
              >
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={deleteCustomerOrdersMutation.isPending}
                className="rounded-xl"
              >
                {deleteCustomerOrdersMutation.isPending ? 'Suppression...' : 'Confirmer la suppression'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}