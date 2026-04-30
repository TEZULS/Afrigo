import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Tag, Plus, Pencil, Trash2, Search, 
  ArrowLeft, Percent, Calendar, Users, ShoppingBag
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';

export default function AdminPromoCodes() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCode, setEditingCode] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    code: '',
    discount_percentage: '',
    min_order_amount: 0,
    max_uses_per_customer: 1,
    applicable_order_numbers: [],
    is_active: true,
    valid_from: '',
    valid_until: ''
  });
  const [selectedOrderNumbers, setSelectedOrderNumbers] = useState([]);

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u.role !== 'admin') {
        navigate(createPageUrl('Home'));
      } else {
        setUser(u);
      }
    }).catch(() => navigate(createPageUrl('Home')))
    .finally(() => setLoading(false));
  }, [navigate]);

  const { data: codes = [], isLoading } = useQuery({
    queryKey: ['discountCodes'],
    queryFn: () => base44.entities.DiscountCode.list('-created_date'),
    enabled: !!user
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['discountCodeSettings'],
    queryFn: () => base44.entities.DiscountCodeSettings.list(),
    enabled: !!user
  });

  const currentSettings = settings[0] || { system_enabled: true };

  const { data: usages = [] } = useQuery({
    queryKey: ['discountCodeUsages'],
    queryFn: () => base44.entities.DiscountCodeUsage.list(),
    enabled: !!user
  });

  const createCodeMutation = useMutation({
    mutationFn: (data) => base44.entities.DiscountCode.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discountCodes'] });
      setDialogOpen(false);
      resetForm();
      toast.success('Code promo créé');
    }
  });

  const updateCodeMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DiscountCode.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discountCodes'] });
      setDialogOpen(false);
      resetForm();
      toast.success('Code promo mis à jour');
    }
  });

  const deleteCodeMutation = useMutation({
    mutationFn: (id) => base44.entities.DiscountCode.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discountCodes'] });
      toast.success('Code promo supprimé');
    }
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (enabled) => {
      if (settings.length > 0) {
        return base44.entities.DiscountCodeSettings.update(settings[0].id, { system_enabled: enabled });
      } else {
        return base44.entities.DiscountCodeSettings.create({ system_enabled: enabled });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discountCodeSettings'] });
      toast.success('Paramètres mis à jour');
    }
  });

  const resetForm = () => {
    setFormData({
      code: '',
      discount_percentage: '',
      min_order_amount: 0,
      max_uses_per_customer: 1,
      applicable_order_numbers: [],
      is_active: true,
      valid_from: '',
      valid_until: ''
    });
    setSelectedOrderNumbers([]);
    setEditingCode(null);
  };

  const handleEdit = (code) => {
    setEditingCode(code);
    setFormData({
      code: code.code || '',
      discount_percentage: code.discount_percentage?.toString() || '',
      min_order_amount: code.min_order_amount || 0,
      max_uses_per_customer: code.max_uses_per_customer || 1,
      applicable_order_numbers: code.applicable_order_numbers || [],
      is_active: code.is_active !== false,
      valid_from: code.valid_from || '',
      valid_until: code.valid_until || ''
    });
    setSelectedOrderNumbers(code.applicable_order_numbers || []);
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    const codeData = {
      ...formData,
      discount_percentage: parseFloat(formData.discount_percentage),
      min_order_amount: parseFloat(formData.min_order_amount) || 0,
      max_uses_per_customer: parseInt(formData.max_uses_per_customer) || 1,
      applicable_order_numbers: selectedOrderNumbers,
      code: formData.code.toUpperCase()
    };

    if (editingCode) {
      updateCodeMutation.mutate({ id: editingCode.id, data: codeData });
    } else {
      createCodeMutation.mutate(codeData);
    }
  };

  const toggleOrderNumber = (num) => {
    if (selectedOrderNumbers.includes(num)) {
      setSelectedOrderNumbers(selectedOrderNumbers.filter(n => n !== num));
    } else {
      setSelectedOrderNumbers([...selectedOrderNumbers, num].sort((a, b) => a - b));
    }
  };

  const getUsageCount = (code) => {
    return usages.filter(u => u.code === code.code).length;
  };

  const filteredCodes = codes.filter(c => 
    c.code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Link to={createPageUrl('AdminDashboard')} className="inline-flex items-center text-slate-600 hover:text-emerald-600 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour au tableau de bord
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Tag className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Codes Promo</h1>
              <p className="text-slate-500">{codes.length} code{codes.length > 1 ? 's' : ''}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border">
              <Label className="text-sm">Système activé</Label>
              <Switch
                checked={currentSettings.system_enabled}
                onCheckedChange={(checked) => updateSettingsMutation.mutate(checked)}
              />
            </div>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button className="bg-purple-500 hover:bg-purple-600 rounded-xl">
                  <Plus className="w-4 h-4 mr-2" />
                  Nouveau code
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingCode ? 'Modifier le code promo' : 'Nouveau code promo'}
                  </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label>Code promo *</Label>
                      <Input
                        value={formData.code}
                        onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                        placeholder="PROMO2025"
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label>Réduction (%) *</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={formData.discount_percentage}
                        onChange={(e) => setFormData({...formData, discount_percentage: e.target.value})}
                        placeholder="10"
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label>Commande minimale (€)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.min_order_amount}
                        onChange={(e) => setFormData({...formData, min_order_amount: e.target.value})}
                        className="mt-1"
                      />
                    </div>

                    <div className="col-span-2">
                      <Label>Utilisations max par client</Label>
                      <Input
                        type="number"
                        min="1"
                        value={formData.max_uses_per_customer}
                        onChange={(e) => setFormData({...formData, max_uses_per_customer: e.target.value})}
                        className="mt-1"
                      />
                      <p className="text-xs text-slate-500 mt-1">Nombre de fois qu'un client peut utiliser ce code</p>
                    </div>

                    <div className="col-span-2">
                      <Label>Applicable sur les commandes</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {[1, 2, 3, 4, 5].map(num => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => toggleOrderNumber(num)}
                            className={`px-4 py-2 rounded-lg border-2 transition-all ${
                              selectedOrderNumbers.includes(num)
                                ? 'border-purple-500 bg-purple-50 text-purple-700'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            {num === 1 ? '1ère' : num === 2 ? '2ème' : num === 3 ? '3ème' : `${num}ème`} commande
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        {selectedOrderNumbers.length === 0 
                          ? 'Si aucune sélection, applicable sur toutes les commandes' 
                          : `Applicable uniquement sur la ${selectedOrderNumbers.map(n => n === 1 ? '1ère' : n === 2 ? '2ème' : n === 3 ? '3ème' : `${n}ème`).join(', ')} commande`
                        }
                      </p>
                    </div>

                    <div>
                      <Label>Valide à partir du</Label>
                      <Input
                        type="date"
                        value={formData.valid_from}
                        onChange={(e) => setFormData({...formData, valid_from: e.target.value})}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label>Valide jusqu'au</Label>
                      <Input
                        type="date"
                        value={formData.valid_until}
                        onChange={(e) => setFormData({...formData, valid_until: e.target.value})}
                        className="mt-1"
                      />
                    </div>

                    <div className="col-span-2 flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <Label>Code actif</Label>
                      <Switch
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDialogOpen(false);
                        resetForm();
                      }}
                      className="flex-1"
                    >
                      Annuler
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={!formData.code || !formData.discount_percentage}
                      className="flex-1 bg-purple-500 hover:bg-purple-600"
                    >
                      {editingCode ? 'Mettre à jour' : 'Créer le code'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="border-0 shadow-sm rounded-2xl">
          <CardHeader>
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Rechercher un code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 rounded-xl"
              />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Réduction</TableHead>
                  <TableHead>Min. commande</TableHead>
                  <TableHead>Max. usages/client</TableHead>
                  <TableHead>Applicable sur</TableHead>
                  <TableHead>Utilisations</TableHead>
                  <TableHead>Validité</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCodes.map(code => (
                  <TableRow key={code.id}>
                    <TableCell>
                      <Badge className="bg-purple-100 text-purple-700 font-mono text-sm">
                        {code.code}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-purple-600">
                        -{code.discount_percentage}%
                      </span>
                    </TableCell>
                    <TableCell>
                      {code.min_order_amount > 0 ? `${code.min_order_amount}€` : '-'}
                    </TableCell>
                    <TableCell>
                      {code.max_uses_per_customer}x
                    </TableCell>
                    <TableCell>
                      {code.applicable_order_numbers?.length > 0 ? (
                        <span className="text-sm">
                          {code.applicable_order_numbers.map(n => 
                            n === 1 ? '1ère' : n === 2 ? '2ème' : n === 3 ? '3ème' : `${n}ème`
                          ).join(', ')}
                        </span>
                      ) : (
                        <span className="text-slate-400">Toutes</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {getUsageCount(code)} utilisation{getUsageCount(code) > 1 ? 's' : ''}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-slate-500">
                        {code.valid_from && <div>Du {new Date(code.valid_from).toLocaleDateString('fr-FR')}</div>}
                        {code.valid_until && <div>Au {new Date(code.valid_until).toLocaleDateString('fr-FR')}</div>}
                        {!code.valid_from && !code.valid_until && '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      {code.is_active ? (
                        <Badge className="bg-emerald-100 text-emerald-700">Actif</Badge>
                      ) : (
                        <Badge variant="secondary">Inactif</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(code)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteCodeMutation.mutate(code.id)}
                          className="text-rose-500 hover:text-rose-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}