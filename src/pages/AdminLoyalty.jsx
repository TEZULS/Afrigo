import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Star, Save, TrendingUp, Award, ArrowLeft, Plus, Minus, Users, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AdminLoyalty() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (u.role !== 'admin') navigate('/');
    }).catch(() => navigate('/'));
  }, [navigate]);

  const [adjustEmail, setAdjustEmail] = useState('');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustType, setAdjustType] = useState('credit');
  const [adjustAll, setAdjustAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [inlineAmount, setInlineAmount] = useState('');

  const { data: settings = [] } = useQuery({
    queryKey: ['loyaltySettings'],
    queryFn: () => base44.entities.LoyaltySettings.list(),
    enabled: !!user
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user
  });

  const { data: allPoints = [], refetch: refetchPoints } = useQuery({
    queryKey: ['allLoyaltyPoints'],
    queryFn: () => base44.entities.LoyaltyPoints.list(),
    enabled: !!user
  });

  // Calcul du total de points par client
  const pointsByClient = React.useMemo(() => {
    const map = {};
    allPoints.forEach(p => {
      if (!map[p.customer_email]) map[p.customer_email] = 0;
      map[p.customer_email] += p.points;
    });
    return map;
  }, [allPoints]);

  // Liste clients avec leurs points
  const clientsWithPoints = React.useMemo(() => {
    return allUsers
      .filter(u => u.role !== 'admin')
      .map(u => ({ ...u, totalPoints: pointsByClient[u.email] || 0 }))
      .filter(u => !searchQuery || u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || u.email?.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => b.totalPoints - a.totalPoints);
  }, [allUsers, pointsByClient, searchQuery]);

  const [formData, setFormData] = useState({
    points_per_euro: 1,
    min_purchase_amount: 10,
    points_validity_duration: 1,
    points_validity_unit: 'months',
    points_to_euro_rate: 100,
    euro_per_point: 0.01,
    is_active: true,
    auto_calculate_points: true
  });

  useEffect(() => {
    if (settings.length > 0) {
      setFormData(settings[0]);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (settings.length > 0) {
        return base44.entities.LoyaltySettings.update(settings[0].id, data);
      }
      return base44.entities.LoyaltySettings.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loyaltySettings'] });
      toast.success('Paramètres sauvegardés');
      navigate(-1);
    }
  });

  const handleSave = () => {
    saveMutation.mutate({
      ...formData,
      points_per_euro: parseFloat(formData.points_per_euro),
      min_purchase_amount: parseFloat(formData.min_purchase_amount),
      points_validity_duration: parseInt(formData.points_validity_duration),
      points_to_euro_rate: parseFloat(formData.points_to_euro_rate),
      euro_per_point: parseFloat(formData.euro_per_point)
    });
  };

  const doAdjust = async ({ email, pts, type }) => {
    if (!pts || pts <= 0) throw new Error('Montant invalide');
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 12);
    const expStr = expiresAt.toISOString().split('T')[0];
    await base44.entities.LoyaltyPoints.create({
      customer_email: email,
      points: type === 'credit' ? pts : -pts,
      transaction_type: type === 'credit' ? 'earned' : 'converted',
      expires_at: expStr,
      order_id: `admin-adjustment-${Date.now()}`
    });
  };

  const adjustPointsMutation = useMutation({
    mutationFn: async () => {
      const pts = parseInt(adjustAmount);
      const targets = adjustAll ? allUsers.filter(u => u.role !== 'admin').map(u => u.email) : [adjustEmail.trim()];
      if (!adjustAll && !adjustEmail.trim()) throw new Error('Email requis');
      for (const email of targets) {
        await doAdjust({ email, pts, type: adjustType });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allLoyaltyPoints'] });
      toast.success(adjustAll ? 'Points ajustés pour tous les utilisateurs' : 'Points ajustés avec succès');
      setAdjustEmail('');
      setAdjustAmount('');
    },
    onError: (e) => toast.error(e.message)
  });

  const inlineAdjustMutation = useMutation({
    mutationFn: async ({ email, type }) => {
      const pts = parseInt(inlineAmount);
      await doAdjust({ email, pts, type });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allLoyaltyPoints'] });
      toast.success('Points mis à jour');
      setSelectedClient(null);
      setInlineAmount('');
    },
    onError: (e) => toast.error(e.message)
  });

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link to={createPageUrl('AdminDashboard')} className="inline-flex items-center text-slate-600 hover:text-emerald-600 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour au tableau de bord
        </Link>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
            <Star className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Programme de fidélité</h1>
            <p className="text-slate-500 mt-1">Gérez le système de points de fidélité</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Statut</p>
                  <Badge variant={formData.is_active ? "default" : "secondary"} className="text-base">
                    {formData.is_active ? 'Actif' : 'Inactif'}
                  </Badge>
                </div>
                <Award className="w-10 h-10 text-emerald-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Taux de gain</p>
                  <p className="text-2xl font-bold text-slate-800">{formData.points_per_euro} pt/€</p>
                </div>
                <TrendingUp className="w-10 h-10 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Conversion</p>
                  <p className="text-2xl font-bold text-slate-800">{formData.points_to_euro_rate} pts = 1€</p>
                </div>
                <Star className="w-10 h-10 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-lg rounded-2xl">
          <CardHeader>
            <CardTitle>Paramètres de fidélisation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                  className="w-4 h-4"
                />
                <Label>Activer le programme de fidélité</Label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.auto_calculate_points}
                  onChange={(e) => setFormData({...formData, auto_calculate_points: e.target.checked})}
                  className="w-4 h-4"
                />
                <Label>Calcul automatique des points sur la période</Label>
              </div>
              <p className="text-xs text-slate-500 ml-6">
                Les points sont calculés automatiquement sur l'ensemble des achats pendant la période de validité
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Points par euro dépensé</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.points_per_euro}
                  onChange={(e) => setFormData({...formData, points_per_euro: e.target.value})}
                  className="mt-1"
                />
                <p className="text-xs text-slate-500 mt-1">Ex: 1 point par euro</p>
              </div>

              <div>
                <Label>Montant minimum d'achat (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.min_purchase_amount}
                  onChange={(e) => setFormData({...formData, min_purchase_amount: e.target.value})}
                  className="mt-1"
                />
                <p className="text-xs text-slate-500 mt-1">Montant minimum pour gagner des points</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Durée de validité des points</Label>
                <Input
                  type="number"
                  value={formData.points_validity_duration}
                  onChange={(e) => setFormData({...formData, points_validity_duration: e.target.value})}
                  className="mt-1"
                />
                <p className="text-xs text-slate-500 mt-1">Nombre d'unités avant expiration</p>
              </div>

              <div>
                <Label>Unité de temps</Label>
                <select
                  value={formData.points_validity_unit}
                  onChange={(e) => setFormData({...formData, points_validity_unit: e.target.value})}
                  className="mt-1 w-full h-9 rounded-md border border-slate-200 px-3"
                >
                  <option value="days">Jours</option>
                  <option value="weeks">Semaines</option>
                  <option value="months">Mois</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">Période de validité des points</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">

              <div>
                <Label>Taux de conversion (points par 1€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.points_to_euro_rate}
                  onChange={(e) => setFormData({...formData, points_to_euro_rate: e.target.value})}
                  className="mt-1"
                />
                <p className="text-xs text-slate-500 mt-1">Ex: 100 points = 1€ (modifiable au centime)</p>
              </div>
            </div>

            <div>
              <Label>Montant gagné par point (€)</Label>
              <Input
                type="number"
                step="0.001"
                value={formData.euro_per_point}
                onChange={(e) => setFormData({...formData, euro_per_point: e.target.value})}
                className="mt-1"
                placeholder="0.01"
              />
              <p className="text-xs text-slate-500 mt-1">Euros gagnés pour chaque point récolté</p>
            </div>

            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 rounded-xl"
            >
              <Save className="w-4 h-4 mr-2" />
              {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer les paramètres'}
            </Button>
          </CardContent>
        </Card>

        {/* Tableau des points clients */}
        <Card className="border-0 shadow-lg rounded-2xl mt-6">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                Points de fidélité par client
              </CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Rechercher un client..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 w-56"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Client</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Email</th>
                    <th className="text-center px-4 py-3 font-medium text-slate-600">Points</th>
                    <th className="text-center px-4 py-3 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clientsWithPoints.map(client => (
                    <tr key={client.id} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">
                        {(client.first_name || client.last_name)
                          ? `${client.first_name || ''} ${client.last_name || ''}`.trim()
                          : client.full_name || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{client.email}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold text-base ${client.totalPoints > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                          {client.totalPoints} pts
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {selectedClient?.id === client.id ? (
                          <div className="flex items-center gap-2 justify-center">
                            <Input
                              type="number"
                              min="1"
                              placeholder="Points"
                              value={inlineAmount}
                              onChange={e => setInlineAmount(e.target.value)}
                              className="w-24 h-8"
                            />
                            <Button
                              size="sm"
                              className="h-8 bg-emerald-500 hover:bg-emerald-600 px-2"
                              onClick={() => inlineAdjustMutation.mutate({ email: client.email, type: 'credit' })}
                              disabled={inlineAdjustMutation.isPending}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              className="h-8 bg-rose-500 hover:bg-rose-600 px-2"
                              onClick={() => inlineAdjustMutation.mutate({ email: client.email, type: 'debit' })}
                              disabled={inlineAdjustMutation.isPending}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => { setSelectedClient(null); setInlineAmount(''); }}>✕</Button>
                          </div>
                        ) : (
                          <div className="flex justify-center">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs"
                              onClick={() => setSelectedClient(client)}
                            >
                              Modifier
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {clientsWithPoints.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-400">Aucun client trouvé</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Ajustement global */}
        <Card className="border-0 shadow-lg rounded-2xl mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              Ajustement groupé
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="adjustAll"
                checked={adjustAll}
                onChange={(e) => setAdjustAll(e.target.checked)}
                className="w-4 h-4"
              />
              <Label htmlFor="adjustAll" className="cursor-pointer">Appliquer à <strong>tous</strong> les utilisateurs</Label>
            </div>

            {!adjustAll && (
              <div>
                <Label>Email du client</Label>
                <Input
                  value={adjustEmail}
                  onChange={(e) => setAdjustEmail(e.target.value)}
                  placeholder="client@exemple.com"
                  className="mt-1"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nombre de points</Label>
                <Input
                  type="number"
                  min="1"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="Ex: 50"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Action</Label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value)}
                  className="mt-1 w-full h-9 rounded-md border border-slate-200 px-3"
                >
                  <option value="credit">➕ Ajouter des points</option>
                  <option value="debit">➖ Retirer des points</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => adjustPointsMutation.mutate()}
                disabled={adjustPointsMutation.isPending}
                className={`flex-1 h-11 rounded-xl ${adjustType === 'credit' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-rose-500 hover:bg-rose-600'}`}
              >
                {adjustType === 'credit' ? <Plus className="w-4 h-4 mr-2" /> : <Minus className="w-4 h-4 mr-2" />}
                {adjustPointsMutation.isPending ? 'En cours...' : (adjustAll ? `${adjustType === 'credit' ? 'Ajouter' : 'Retirer'} à tous` : `${adjustType === 'credit' ? 'Ajouter' : 'Retirer'} les points`)}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}