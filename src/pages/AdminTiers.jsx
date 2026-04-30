import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Trophy, Edit, Save, Users, Gem, Medal, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AdminTiers() {
  const [user, setUser] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [tierDialogOpen, setTierDialogOpen] = useState(false);
  const [editingBenefit, setEditingBenefit] = useState(null);
  const [benefitDialogOpen, setBenefitDialogOpen] = useState(false);
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

  const { data: users = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user
  });

  const { data: tierBenefits = [] } = useQuery({
    queryKey: ['tierBenefits'],
    queryFn: () => base44.entities.TierBenefit.list(),
    enabled: !!user
  });

  const updateUserTierMutation = useMutation({
    mutationFn: ({ userId, tier }) => base44.entities.User.update(userId, { customer_tier: tier }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      toast.success('Niveau client mis à jour');
      setTierDialogOpen(false);
      setSelectedUser(null);
    }
  });

  const updateBenefitMutation = useMutation({
    mutationFn: (data) => {
      if (data.id) {
        return base44.entities.TierBenefit.update(data.id, data);
      } else {
        return base44.entities.TierBenefit.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tierBenefits'] });
      toast.success('Avantages mis à jour');
      setBenefitDialogOpen(false);
      setEditingBenefit(null);
    }
  });

  const tierConfig = {
    normal: { label: 'Normal', icon: Medal, color: '#94a3b8' },
    argent: { label: 'Argent', icon: Medal, color: '#C0C0C0' },
    or: { label: 'Or', icon: Medal, color: '#FFD700' },
    diamant: { label: 'Diamant', icon: Gem, color: '#60A5FA' }
  };

  const filteredUsers = users.filter(u => {
    const query = searchQuery.toLowerCase();
    return u.full_name?.toLowerCase().includes(query) ||
           u.email?.toLowerCase().includes(query) ||
           u.customer_id?.toLowerCase().includes(query);
  });

  const tierCounts = users.reduce((acc, u) => {
    const tier = u.customer_tier || 'normal';
    acc[tier] = (acc[tier] || 0) + 1;
    return acc;
  }, {});

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Gestion des niveaux clients</h1>
          <p className="text-slate-500">Attribuez des médailles et gérez les avantages</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {Object.entries(tierConfig).map(([tier, config]) => {
            const Icon = config.icon;
            return (
              <Card key={tier} className="border-0 shadow-sm rounded-2xl">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500 mb-1">{config.label}</p>
                      <p className="text-3xl font-bold text-slate-800">{tierCounts[tier] || 0}</p>
                    </div>
                    <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                      <Icon className="w-6 h-6" style={{ color: config.color }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Benefits Management */}
        <Card className="border-0 shadow-sm rounded-2xl mb-8">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-emerald-500" />
                Messages des avantages
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {['argent', 'or', 'diamant'].map(tier => {
                const benefit = tierBenefits.find(b => b.tier === tier);
                const config = tierConfig[tier];
                const Icon = config.icon;
                
                return (
                  <div key={tier} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Icon className="w-6 h-6" style={{ color: config.color }} />
                      <div>
                        <p className="font-semibold text-slate-800">{config.label}</p>
                        <p className="text-sm text-slate-500 line-clamp-1">
                          {benefit?.description || 'Aucun message défini'}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingBenefit(benefit || { tier, title: `Client ${config.label}`, description: '' });
                        setBenefitDialogOpen(true);
                      }}
                      className="rounded-xl"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Modifier
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Users List */}
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-500" />
              Attribution des niveaux
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <Input
                placeholder="Rechercher par nom ou identifiant..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-12 pl-10 rounded-xl"
              />
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {filteredUsers.map(u => {
                const tier = u.customer_tier || 'normal';
                const config = tierConfig[tier];
                const Icon = config.icon;
                
                return (
                  <motion.div
                    key={u.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-slate-800">{u.full_name || u.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm text-slate-500">{u.customer_id}</p>
                        <Badge className="bg-slate-200 text-slate-700">
                          <Icon className="w-3 h-3 mr-1" style={{ color: config.color }} />
                          {config.label}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedUser(u);
                        setTierDialogOpen(true);
                      }}
                      className="rounded-xl"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Change Tier Dialog */}
        <Dialog open={tierDialogOpen} onOpenChange={setTierDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Modifier le niveau client</DialogTitle>
            </DialogHeader>
            
            {selectedUser && (
              <div className="space-y-4 py-4">
                <div>
                  <p className="text-sm text-slate-600">Client</p>
                  <p className="font-semibold text-slate-800">{selectedUser.full_name || selectedUser.email}</p>
                </div>
                
                <div>
                  <Label>Niveau actuel</Label>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    {Object.entries(tierConfig).map(([tier, config]) => {
                      const Icon = config.icon;
                      const isSelected = (selectedUser.customer_tier || 'normal') === tier;
                      
                      return (
                        <button
                          key={tier}
                          onClick={() => updateUserTierMutation.mutate({ userId: selectedUser.id, tier })}
                          disabled={updateUserTierMutation.isPending}
                          className={`
                            p-4 rounded-xl border-2 transition-all text-center
                            ${isSelected 
                              ? 'border-emerald-500 bg-emerald-50' 
                              : 'border-slate-200 hover:border-slate-300'
                            }
                          `}
                        >
                          <Icon className="w-8 h-8 mx-auto mb-2" style={{ color: config.color }} />
                          <p className="font-semibold text-slate-800">{config.label}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Benefit Dialog */}
        <Dialog open={benefitDialogOpen} onOpenChange={setBenefitDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Modifier les avantages du niveau {editingBenefit && tierConfig[editingBenefit.tier]?.label}</DialogTitle>
            </DialogHeader>
            
            {editingBenefit && (
              <div className="space-y-4 py-4">
                <div>
                  <Label>Titre de la médaille</Label>
                  <Input
                    value={editingBenefit.title || ''}
                    onChange={(e) => setEditingBenefit({ ...editingBenefit, title: e.target.value })}
                    placeholder="Ex: Client Or"
                    className="h-12 rounded-xl mt-1"
                  />
                </div>
                
                <div>
                  <Label>Description des avantages</Label>
                  <Textarea
                    value={editingBenefit.description || ''}
                    onChange={(e) => setEditingBenefit({ ...editingBenefit, description: e.target.value })}
                    placeholder="Décrivez tous les avantages de ce niveau..."
                    className="min-h-[200px] rounded-xl mt-1"
                  />
                </div>
                
                <Button
                  onClick={() => updateBenefitMutation.mutate(editingBenefit)}
                  disabled={updateBenefitMutation.isPending || !editingBenefit.title || !editingBenefit.description}
                  className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 rounded-xl"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Enregistrer
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}