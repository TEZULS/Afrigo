import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, TrendingUp, TrendingDown, Wallet, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AdminWalletHistory() {
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    base44.auth.me()
      .then(u => {
        if (u.role !== 'admin') {
          window.location.href = createPageUrl('Home');
        } else {
          setUser(u);
        }
      })
      .catch(() => {
        window.location.href = createPageUrl('Home');
      });
  }, []);

  const { data: transactions = [] } = useQuery({
    queryKey: ['walletTransactions'],
    queryFn: () => base44.entities.WalletTransaction.list('-created_date'),
    enabled: !!user
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user
  });

  // Calculer le solde actuel de chaque client
  const clientBalances = users.map(u => {
    const userTransactions = transactions.filter(t => t.customer_email === u.email);
    const balance = userTransactions.reduce((sum, t) => {
      return t.type === 'credit' ? sum + t.amount : sum - t.amount;
    }, 0);
    return {
      ...u,
      balance: u.wallet_balance || 0,
      transactions: userTransactions
    };
  }).sort((a, b) => b.balance - a.balance);

  // Stats globales
  const totalCredits = transactions
    .filter(t => t.type === 'credit')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalDebits = transactions
    .filter(t => t.type === 'debit')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalBalance = users.reduce((sum, u) => sum + (u.wallet_balance || 0), 0);

  // Filtrer les transactions
  const filteredTransactions = transactions.filter(t =>
    t.customer_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.reason?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.admin_email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filterByType = (type) => {
    if (type === 'all') return filteredTransactions;
    return filteredTransactions.filter(t => t.type === type);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Link to={createPageUrl('AdminDashboard')} className="inline-flex items-center text-slate-600 hover:text-emerald-600 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour au tableau de bord
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            Suivi des portefeuilles clients
          </h1>
          <p className="text-slate-600">
            Consultez les soldes et l'historique des transactions
          </p>
        </div>

        {/* Stats globales */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 mb-1">Solde total</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {totalBalance.toFixed(2)}€
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 mb-1">Total crédits</p>
                  <p className="text-2xl font-bold text-green-600">
                    +{totalCredits.toFixed(2)}€
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                  <TrendingDown className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 mb-1">Total débits</p>
                  <p className="text-2xl font-bold text-red-600">
                    -{totalDebits.toFixed(2)}€
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Liste des clients et leurs soldes */}
          <div className="lg:col-span-1">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Soldes clients</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
                {clientBalances.map(client => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-slate-800 text-sm">
                        {client.full_name}
                      </p>
                      <p className="text-xs text-slate-500">{client.email}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold text-lg ${
                        client.balance > 0 
                          ? 'text-purple-600' 
                          : 'text-slate-400'
                      }`}>
                        {client.balance.toFixed(2)}€
                      </p>
                      <p className="text-xs text-slate-500">
                        {client.transactions.length} transaction(s)
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Historique des transactions */}
          <div className="lg:col-span-2">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Historique des transactions</CardTitle>
                <div className="relative mt-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher par client, motif..."
                    className="pl-10 rounded-xl"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="all">
                  <TabsList className="grid w-full grid-cols-3 mb-6">
                    <TabsTrigger value="all">
                      Toutes ({filteredTransactions.length})
                    </TabsTrigger>
                    <TabsTrigger value="credit">
                      Crédits ({filterByType('credit').length})
                    </TabsTrigger>
                    <TabsTrigger value="debit">
                      Débits ({filterByType('debit').length})
                    </TabsTrigger>
                  </TabsList>

                  {['all', 'credit', 'debit'].map(type => (
                    <TabsContent key={type} value={type}>
                      <div className="space-y-3 max-h-[500px] overflow-y-auto">
                        {filterByType(type).length === 0 ? (
                          <div className="text-center py-12">
                            <Wallet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                            <p className="text-slate-500">Aucune transaction</p>
                          </div>
                        ) : (
                          filterByType(type).map(transaction => {
                            const client = users.find(u => u.email === transaction.customer_email);
                            return (
                              <motion.div
                                key={transaction.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-slate-50 rounded-lg p-4 hover:bg-slate-100 transition-colors"
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <p className="font-medium text-slate-800">
                                        {client?.full_name || transaction.customer_email}
                                      </p>
                                      <Badge className={
                                        transaction.type === 'credit'
                                          ? 'bg-green-100 text-green-800'
                                          : 'bg-red-100 text-red-800'
                                      }>
                                        {transaction.type === 'credit' ? (
                                          <TrendingUp className="w-3 h-3 mr-1" />
                                        ) : (
                                          <TrendingDown className="w-3 h-3 mr-1" />
                                        )}
                                        {transaction.type === 'credit' ? 'Crédit' : 'Débit'}
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-slate-600">
                                      {transaction.reason}
                                    </p>
                                    {transaction.admin_email && (
                                      <p className="text-xs text-slate-500 mt-1">
                                        Par: {transaction.admin_email}
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <p className={`text-xl font-bold ${
                                      transaction.type === 'credit'
                                        ? 'text-green-600'
                                        : 'text-red-600'
                                    }`}>
                                      {transaction.type === 'credit' ? '+' : '-'}
                                      {transaction.amount.toFixed(2)}€
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {format(new Date(transaction.created_date), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                                    </p>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })
                        )}
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}