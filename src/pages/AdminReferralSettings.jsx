import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Users, Save } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';

export default function AdminReferralSettings() {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState({
    referrer_bonus: 10,
    referred_bonus: 5,
    max_referrals_per_user: 2,
    is_active: true,
    start_date: '',
    end_date: ''
  });
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

  const { data: referralSettings = [] } = useQuery({
    queryKey: ['referral-settings'],
    queryFn: () => base44.entities.ReferralSettings.list(),
    enabled: !!user
  });

  useEffect(() => {
    if (referralSettings.length > 0) {
      setSettings(referralSettings[0]);
    }
  }, [referralSettings]);

  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      if (referralSettings.length > 0) {
        return base44.entities.ReferralSettings.update(referralSettings[0].id, settings);
      } else {
        return base44.entities.ReferralSettings.create(settings);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referral-settings'] });
      toast.success('Paramètres de parrainage enregistrés');
      navigate(-1);
    }
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
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Paramètres de parrainage</h1>
            <p className="text-slate-500">Configuration du système de parrainage</p>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardHeader>
              <CardTitle>Activation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Système de parrainage</p>
                  <p className="text-sm text-slate-500">Activer ou désactiver le programme</p>
                </div>
                <Switch
                  checked={settings.is_active}
                  onCheckedChange={(checked) => setSettings({ ...settings, is_active: checked })}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm rounded-2xl">
            <CardHeader>
              <CardTitle>Récompenses</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="referrer_bonus">Bonus pour le parrain (€)</Label>
                <Input
                  id="referrer_bonus"
                  type="number"
                  step="0.01"
                  value={settings.referrer_bonus}
                  onChange={(e) => setSettings({ ...settings, referrer_bonus: parseFloat(e.target.value) || 0 })}
                  className="mt-2"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Montant crédité sur le portefeuille du parrain
                </p>
              </div>

              <div>
                <Label htmlFor="referred_bonus">Bonus pour le filleul (€)</Label>
                <Input
                  id="referred_bonus"
                  type="number"
                  step="0.01"
                  value={settings.referred_bonus}
                  onChange={(e) => setSettings({ ...settings, referred_bonus: parseFloat(e.target.value) || 0 })}
                  className="mt-2"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Montant crédité sur le portefeuille du filleul
                </p>
              </div>

              <div>
                <Label htmlFor="max_referrals">Nombre maximum de parrainages par utilisateur</Label>
                <Input
                  id="max_referrals"
                  type="number"
                  min="1"
                  value={settings.max_referrals_per_user}
                  onChange={(e) => setSettings({ ...settings, max_referrals_per_user: parseInt(e.target.value) || 2 })}
                  className="mt-2"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Limite de parrainages autorisés par client
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm rounded-2xl">
            <CardHeader>
              <CardTitle>Période de campagne (optionnel)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="start_date">Date de début</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={settings.start_date || ''}
                  onChange={(e) => setSettings({ ...settings, start_date: e.target.value })}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="end_date">Date de fin</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={settings.end_date || ''}
                  onChange={(e) => setSettings({ ...settings, end_date: e.target.value })}
                  className="mt-2"
                />
              </div>
            </CardContent>
          </Card>

          <Button
            onClick={() => saveSettingsMutation.mutate()}
            className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 rounded-xl"
          >
            <Save className="w-4 h-4 mr-2" />
            Enregistrer les paramètres
          </Button>
        </div>
      </div>
    </div>
  );
}