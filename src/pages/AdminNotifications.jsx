import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Save, Volume2, ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { Slider } from "@/components/ui/slider";

export default function AdminNotifications() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (u?.role !== 'admin') navigate(createPageUrl('Home'));
    }).catch(() => navigate(createPageUrl('Home')));
  }, [navigate]);

  const { data: settings = [] } = useQuery({
    queryKey: ['notificationSettings', user?.email],
    queryFn: () => base44.entities.NotificationSettings.filter({ admin_email: user?.email }),
    enabled: !!user?.email
  });

  const [formData, setFormData] = useState({
    enabled: true,
    use_single_sound: false,
    global_sound: 'default',
    new_order: true,
    new_order_sound: 'success',
    order_cancelled: true,
    order_cancelled_sound: 'warning',
    order_confirmed: false,
    order_confirmed_sound: 'chime',
    order_delivered: false,
    order_delivered_sound: 'success',
    deliverer_notification: true,
    deliverer_notification_sound: 'urgent',
    continuous_bell_enabled: false,
    continuous_bell_interval: 30,
    new_return: true,
    new_return_sound: 'alert',
    new_message: true,
    new_message_sound: 'ding',
    new_refund: true,
    new_refund_sound: 'urgent',
    new_user: true,
    new_user_sound: 'chime',
    new_review: true,
    new_review_sound: 'soft',
    low_stock: true,
    low_stock_sound: 'warning',
    out_of_stock: true,
    out_of_stock_sound: 'urgent',
    high_value_order: true,
    high_value_order_sound: 'ascending',
    loyalty_milestone: false,
    loyalty_milestone_sound: 'success',
    referral_success: false,
    referral_success_sound: 'chime',
    volume: 70
  });

  useEffect(() => {
    if (settings.length > 0) {
      setFormData(settings[0]);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (settings.length > 0) {
        return base44.entities.NotificationSettings.update(settings[0].id, data);
      }
      return base44.entities.NotificationSettings.create({
        ...data,
        admin_email: user.email
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationSettings'] });
      toast.success('Paramètres sauvegardés');
    }
  });

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  const playTestSound = (soundType) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const volume = formData.volume / 100;
      
      const playNote = (freq, startTime, duration, type = 'sine') => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(volume * 0.3, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      
      const now = audioContext.currentTime;
      
      const melodies = {
        default: [
          { freq: 659, time: 0, duration: 0.15 },
          { freq: 784, time: 0.15, duration: 0.15 },
          { freq: 880, time: 0.3, duration: 0.2 }
        ],
        chime: [
          { freq: 1046, time: 0, duration: 0.2 },
          { freq: 1318, time: 0.1, duration: 0.2 },
          { freq: 1568, time: 0.2, duration: 0.3 }
        ],
        bell: [
          { freq: 523, time: 0, duration: 0.3 },
          { freq: 659, time: 0.15, duration: 0.25 },
          { freq: 784, time: 0.3, duration: 0.4 }
        ],
        alert: [
          { freq: 880, time: 0, duration: 0.1 },
          { freq: 698, time: 0.12, duration: 0.1 },
          { freq: 880, time: 0.24, duration: 0.1 },
          { freq: 698, time: 0.36, duration: 0.1 }
        ],
        beep: [
          { freq: 440, time: 0, duration: 0.1 },
          { freq: 440, time: 0.15, duration: 0.1 }
        ],
        ding: [
          { freq: 1568, time: 0, duration: 0.08 },
          { freq: 2093, time: 0.08, duration: 0.12 }
        ],
        'double-beep': [
          { freq: 932, time: 0, duration: 0.1 },
          { freq: 932, time: 0.15, duration: 0.1 }
        ],
        'triple-beep': [
          { freq: 880, time: 0, duration: 0.08 },
          { freq: 880, time: 0.12, duration: 0.08 },
          { freq: 880, time: 0.24, duration: 0.08 }
        ],
        urgent: [
          { freq: 1046, time: 0, duration: 0.1 },
          { freq: 880, time: 0.1, duration: 0.1 },
          { freq: 1046, time: 0.2, duration: 0.1 },
          { freq: 880, time: 0.3, duration: 0.1 },
          { freq: 1046, time: 0.4, duration: 0.15 }
        ],
        soft: [
          { freq: 523, time: 0, duration: 0.25 },
          { freq: 659, time: 0.25, duration: 0.25 },
          { freq: 523, time: 0.5, duration: 0.3 }
        ],
        ascending: [
          { freq: 523, time: 0, duration: 0.15 },
          { freq: 659, time: 0.15, duration: 0.15 },
          { freq: 784, time: 0.3, duration: 0.15 },
          { freq: 1046, time: 0.45, duration: 0.2 }
        ],
        descending: [
          { freq: 1046, time: 0, duration: 0.15 },
          { freq: 784, time: 0.15, duration: 0.15 },
          { freq: 659, time: 0.3, duration: 0.15 },
          { freq: 523, time: 0.45, duration: 0.2 }
        ],
        success: [
          { freq: 523, time: 0, duration: 0.1 },
          { freq: 659, time: 0.1, duration: 0.1 },
          { freq: 784, time: 0.2, duration: 0.1 },
          { freq: 1046, time: 0.3, duration: 0.25 }
        ],
        warning: [
          { freq: 698, time: 0, duration: 0.15 },
          { freq: 622, time: 0.15, duration: 0.15 },
          { freq: 698, time: 0.3, duration: 0.2 }
        ]
      };
      
      const melody = melodies[soundType] || melodies.default;
      melody.forEach(note => {
        playNote(note.freq, now + note.time, note.duration);
      });
      
      toast.success('Son testé avec succès !');
    } catch (err) {
      console.error('Erreur lecture audio:', err);
      toast.error('Impossible de lire le son');
    }
  };

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link to={createPageUrl('AdminDashboard')} className="inline-flex items-center text-slate-600 hover:text-blue-600 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour au tableau de bord
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <Bell className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Notifications</h1>
            <p className="text-slate-500 mt-1">Gérez vos alertes et sons de notification</p>
          </div>
        </div>

        <Card className="border-0 shadow-lg rounded-2xl mb-6">
          <CardHeader>
            <CardTitle>Paramètres de notification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Activation globale */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div>
                <Label className="text-base font-semibold">Activer les notifications</Label>
                <p className="text-sm text-slate-500 mt-1">Recevoir des alertes pour les événements importants</p>
              </div>
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => setFormData({...formData, enabled: e.target.checked})}
                className="w-5 h-5"
              />
            </div>

            {/* Mode sonnerie unique */}
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-200">
              <div>
                <Label className="text-base font-semibold">Une seule sonnerie pour tout</Label>
                <p className="text-sm text-slate-500 mt-1">Utiliser la même sonnerie pour toutes les notifications</p>
              </div>
              <input
                type="checkbox"
                checked={formData.use_single_sound}
                onChange={(e) => setFormData({...formData, use_single_sound: e.target.checked})}
                className="w-5 h-5"
                disabled={!formData.enabled}
              />
            </div>

            {/* Sonnerie globale */}
            {formData.use_single_sound && (
              <div className="space-y-3 p-4 bg-blue-50 rounded-xl border border-blue-200">
                <Label className="text-base font-semibold">Sonnerie pour toutes les notifications</Label>
                <div className="flex gap-3">
                  <Select
                    value={formData.global_sound}
                    onValueChange={(value) => setFormData({...formData, global_sound: value})}
                    disabled={!formData.enabled}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">🔔 Défaut</SelectItem>
                      <SelectItem value="chime">🎵 Carillon</SelectItem>
                      <SelectItem value="bell">🔔 Cloche</SelectItem>
                      <SelectItem value="alert">⚠️ Alerte</SelectItem>
                      <SelectItem value="beep">📢 Bip</SelectItem>
                      <SelectItem value="ding">✨ Ding</SelectItem>
                      <SelectItem value="double-beep">📣 Double Bip</SelectItem>
                      <SelectItem value="triple-beep">🔊 Triple Bip</SelectItem>
                      <SelectItem value="urgent">🚨 Urgent</SelectItem>
                      <SelectItem value="soft">🎶 Doux</SelectItem>
                      <SelectItem value="ascending">📈 Montant</SelectItem>
                      <SelectItem value="descending">📉 Descendant</SelectItem>
                      <SelectItem value="success">✅ Succès</SelectItem>
                      <SelectItem value="warning">⚠️ Avertissement</SelectItem>
                      <SelectItem value="none">🔇 Aucun</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => playTestSound(formData.global_sound)}
                    variant="outline"
                    disabled={!formData.enabled || formData.global_sound === 'none'}
                  >
                    <Volume2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Types de notifications */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Types d'événements à notifier</Label>
              
              <div className="space-y-2">
                {/* Section Commandes */}
                <div className="mt-4">
                  <p className="text-xs font-semibold text-slate-500 mb-2 px-3">COMMANDES</p>
                  <div className="space-y-2">
                    <div className="p-3 border rounded-xl hover:bg-slate-50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <Label>Nouvelle commande</Label>
                        </div>
                        <input
                          type="checkbox"
                          checked={formData.new_order}
                          onChange={(e) => setFormData({...formData, new_order: e.target.checked})}
                          className="w-4 h-4"
                          disabled={!formData.enabled}
                        />
                      </div>
                      {!formData.use_single_sound && (
                        <div className="flex gap-2">
                          <Select
                            value={formData.new_order_sound}
                            onValueChange={(value) => setFormData({...formData, new_order_sound: value})}
                            disabled={!formData.enabled || !formData.new_order}
                          >
                            <SelectTrigger className="h-8 text-xs flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">🔔 Défaut</SelectItem>
                              <SelectItem value="chime">🎵 Carillon</SelectItem>
                              <SelectItem value="bell">🔔 Cloche</SelectItem>
                              <SelectItem value="alert">⚠️ Alerte</SelectItem>
                              <SelectItem value="beep">📢 Bip</SelectItem>
                              <SelectItem value="ding">✨ Ding</SelectItem>
                              <SelectItem value="double-beep">📣 Double Bip</SelectItem>
                              <SelectItem value="triple-beep">🔊 Triple Bip</SelectItem>
                              <SelectItem value="urgent">🚨 Urgent</SelectItem>
                              <SelectItem value="soft">🎶 Doux</SelectItem>
                              <SelectItem value="ascending">📈 Montant</SelectItem>
                              <SelectItem value="descending">📉 Descendant</SelectItem>
                              <SelectItem value="success">✅ Succès</SelectItem>
                              <SelectItem value="warning">⚠️ Avertissement</SelectItem>
                              <SelectItem value="none">🔇 Aucun</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            onClick={() => playTestSound(formData.new_order_sound)}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled={!formData.enabled || !formData.new_order || formData.new_order_sound === 'none'}
                          >
                            <Volume2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="p-3 border rounded-xl hover:bg-slate-50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                          <Label>Commande annulée</Label>
                        </div>
                        <input
                          type="checkbox"
                          checked={formData.order_cancelled}
                          onChange={(e) => setFormData({...formData, order_cancelled: e.target.checked})}
                          className="w-4 h-4"
                          disabled={!formData.enabled}
                        />
                      </div>
                      {!formData.use_single_sound && (
                        <div className="flex gap-2">
                          <Select
                            value={formData.order_cancelled_sound}
                            onValueChange={(value) => setFormData({...formData, order_cancelled_sound: value})}
                            disabled={!formData.enabled || !formData.order_cancelled}
                          >
                            <SelectTrigger className="h-8 text-xs flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">🔔 Défaut</SelectItem>
                              <SelectItem value="chime">🎵 Carillon</SelectItem>
                              <SelectItem value="bell">🔔 Cloche</SelectItem>
                              <SelectItem value="alert">⚠️ Alerte</SelectItem>
                              <SelectItem value="beep">📢 Bip</SelectItem>
                              <SelectItem value="ding">✨ Ding</SelectItem>
                              <SelectItem value="double-beep">📣 Double Bip</SelectItem>
                              <SelectItem value="triple-beep">🔊 Triple Bip</SelectItem>
                              <SelectItem value="urgent">🚨 Urgent</SelectItem>
                              <SelectItem value="soft">🎶 Doux</SelectItem>
                              <SelectItem value="ascending">📈 Montant</SelectItem>
                              <SelectItem value="descending">📉 Descendant</SelectItem>
                              <SelectItem value="success">✅ Succès</SelectItem>
                              <SelectItem value="warning">⚠️ Avertissement</SelectItem>
                              <SelectItem value="none">🔇 Aucun</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            onClick={() => playTestSound(formData.order_cancelled_sound)}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled={!formData.enabled || !formData.order_cancelled || formData.order_cancelled_sound === 'none'}
                          >
                            <Volume2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="p-3 border rounded-xl hover:bg-slate-50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                          <Label>Commande confirmée</Label>
                        </div>
                        <input
                          type="checkbox"
                          checked={formData.order_confirmed}
                          onChange={(e) => setFormData({...formData, order_confirmed: e.target.checked})}
                          className="w-4 h-4"
                          disabled={!formData.enabled}
                        />
                      </div>
                      {!formData.use_single_sound && (
                        <div className="flex gap-2">
                          <Select
                            value={formData.order_confirmed_sound}
                            onValueChange={(value) => setFormData({...formData, order_confirmed_sound: value})}
                            disabled={!formData.enabled || !formData.order_confirmed}
                          >
                            <SelectTrigger className="h-8 text-xs flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">🔔 Défaut</SelectItem>
                              <SelectItem value="chime">🎵 Carillon</SelectItem>
                              <SelectItem value="bell">🔔 Cloche</SelectItem>
                              <SelectItem value="alert">⚠️ Alerte</SelectItem>
                              <SelectItem value="beep">📢 Bip</SelectItem>
                              <SelectItem value="ding">✨ Ding</SelectItem>
                              <SelectItem value="double-beep">📣 Double Bip</SelectItem>
                              <SelectItem value="triple-beep">🔊 Triple Bip</SelectItem>
                              <SelectItem value="urgent">🚨 Urgent</SelectItem>
                              <SelectItem value="soft">🎶 Doux</SelectItem>
                              <SelectItem value="ascending">📈 Montant</SelectItem>
                              <SelectItem value="descending">📉 Descendant</SelectItem>
                              <SelectItem value="success">✅ Succès</SelectItem>
                              <SelectItem value="warning">⚠️ Avertissement</SelectItem>
                              <SelectItem value="none">🔇 Aucun</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            onClick={() => playTestSound(formData.order_confirmed_sound)}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled={!formData.enabled || !formData.order_confirmed || formData.order_confirmed_sound === 'none'}
                          >
                            <Volume2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="p-3 border rounded-xl hover:bg-slate-50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                          <Label>Commande livrée</Label>
                        </div>
                        <input
                          type="checkbox"
                          checked={formData.order_delivered}
                          onChange={(e) => setFormData({...formData, order_delivered: e.target.checked})}
                          className="w-4 h-4"
                          disabled={!formData.enabled}
                        />
                      </div>
                      {!formData.use_single_sound && (
                        <div className="flex gap-2">
                          <Select
                            value={formData.order_delivered_sound}
                            onValueChange={(value) => setFormData({...formData, order_delivered_sound: value})}
                            disabled={!formData.enabled || !formData.order_delivered}
                          >
                            <SelectTrigger className="h-8 text-xs flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">🔔 Défaut</SelectItem>
                              <SelectItem value="chime">🎵 Carillon</SelectItem>
                              <SelectItem value="bell">🔔 Cloche</SelectItem>
                              <SelectItem value="alert">⚠️ Alerte</SelectItem>
                              <SelectItem value="beep">📢 Bip</SelectItem>
                              <SelectItem value="ding">✨ Ding</SelectItem>
                              <SelectItem value="double-beep">📣 Double Bip</SelectItem>
                              <SelectItem value="triple-beep">🔊 Triple Bip</SelectItem>
                              <SelectItem value="urgent">🚨 Urgent</SelectItem>
                              <SelectItem value="soft">🎶 Doux</SelectItem>
                              <SelectItem value="ascending">📈 Montant</SelectItem>
                              <SelectItem value="descending">📉 Descendant</SelectItem>
                              <SelectItem value="success">✅ Succès</SelectItem>
                              <SelectItem value="warning">⚠️ Avertissement</SelectItem>
                              <SelectItem value="none">🔇 Aucun</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            onClick={() => playTestSound(formData.order_delivered_sound)}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled={!formData.enabled || !formData.order_delivered || formData.order_delivered_sound === 'none'}
                          >
                            <Volume2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="p-3 border rounded-xl hover:bg-slate-50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                          <Label>Commande à valeur élevée (&gt;100€)</Label>
                        </div>
                        <input
                          type="checkbox"
                          checked={formData.high_value_order}
                          onChange={(e) => setFormData({...formData, high_value_order: e.target.checked})}
                          className="w-4 h-4"
                          disabled={!formData.enabled}
                        />
                      </div>
                      {!formData.use_single_sound && (
                        <div className="flex gap-2">
                          <Select
                            value={formData.high_value_order_sound}
                            onValueChange={(value) => setFormData({...formData, high_value_order_sound: value})}
                            disabled={!formData.enabled || !formData.high_value_order}
                          >
                            <SelectTrigger className="h-8 text-xs flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">🔔 Défaut</SelectItem>
                              <SelectItem value="chime">🎵 Carillon</SelectItem>
                              <SelectItem value="bell">🔔 Cloche</SelectItem>
                              <SelectItem value="alert">⚠️ Alerte</SelectItem>
                              <SelectItem value="beep">📢 Bip</SelectItem>
                              <SelectItem value="ding">✨ Ding</SelectItem>
                              <SelectItem value="double-beep">📣 Double Bip</SelectItem>
                              <SelectItem value="triple-beep">🔊 Triple Bip</SelectItem>
                              <SelectItem value="urgent">🚨 Urgent</SelectItem>
                              <SelectItem value="soft">🎶 Doux</SelectItem>
                              <SelectItem value="ascending">📈 Montant</SelectItem>
                              <SelectItem value="descending">📉 Descendant</SelectItem>
                              <SelectItem value="success">✅ Succès</SelectItem>
                              <SelectItem value="warning">⚠️ Avertissement</SelectItem>
                              <SelectItem value="none">🔇 Aucun</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            onClick={() => playTestSound(formData.high_value_order_sound)}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled={!formData.enabled || !formData.high_value_order || formData.high_value_order_sound === 'none'}
                          >
                            <Volume2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="p-3 border rounded-xl hover:bg-slate-50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                          <Label>Notification aux livreurs</Label>
                        </div>
                        <input
                          type="checkbox"
                          checked={formData.deliverer_notification}
                          onChange={(e) => setFormData({...formData, deliverer_notification: e.target.checked})}
                          className="w-4 h-4"
                          disabled={!formData.enabled}
                        />
                      </div>
                      {!formData.use_single_sound && (
                        <div className="flex gap-2">
                          <Select
                            value={formData.deliverer_notification_sound}
                            onValueChange={(value) => setFormData({...formData, deliverer_notification_sound: value})}
                            disabled={!formData.enabled || !formData.deliverer_notification}
                          >
                            <SelectTrigger className="h-8 text-xs flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">🔔 Défaut</SelectItem>
                              <SelectItem value="chime">🎵 Carillon</SelectItem>
                              <SelectItem value="bell">🔔 Cloche</SelectItem>
                              <SelectItem value="alert">⚠️ Alerte</SelectItem>
                              <SelectItem value="beep">📢 Bip</SelectItem>
                              <SelectItem value="ding">✨ Ding</SelectItem>
                              <SelectItem value="double-beep">📣 Double Bip</SelectItem>
                              <SelectItem value="triple-beep">🔊 Triple Bip</SelectItem>
                              <SelectItem value="urgent">🚨 Urgent</SelectItem>
                              <SelectItem value="soft">🎶 Doux</SelectItem>
                              <SelectItem value="ascending">📈 Montant</SelectItem>
                              <SelectItem value="descending">📉 Descendant</SelectItem>
                              <SelectItem value="success">✅ Succès</SelectItem>
                              <SelectItem value="warning">⚠️ Avertissement</SelectItem>
                              <SelectItem value="none">🔇 Aucun</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            onClick={() => playTestSound(formData.deliverer_notification_sound)}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled={!formData.enabled || !formData.deliverer_notification || formData.deliverer_notification_sound === 'none'}
                          >
                            <Volume2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="p-3 border rounded-xl hover:bg-slate-50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-red-500"></div>
                          <Label>Sonnerie en permanence</Label>
                        </div>
                        <input
                          type="checkbox"
                          checked={formData.continuous_bell_enabled}
                          onChange={(e) => setFormData({...formData, continuous_bell_enabled: e.target.checked})}
                          className="w-4 h-4"
                          disabled={!formData.enabled}
                        />
                      </div>
                      {formData.continuous_bell_enabled && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Délai entre les sonneries (secondes)</Label>
                            <span className="text-xs font-semibold text-slate-600">{formData.continuous_bell_interval}s</span>
                          </div>
                          <Slider
                            value={[formData.continuous_bell_interval]}
                            onValueChange={([value]) => setFormData({...formData, continuous_bell_interval: value})}
                            min={5}
                            max={300}
                            step={5}
                            disabled={!formData.enabled || !formData.continuous_bell_enabled}
                            className="w-full"
                          />
                          <Button
                            onClick={() => playTestSound('chime')}
                            variant="ghost"
                            size="sm"
                            className="w-full h-8 text-xs"
                            disabled={!formData.enabled || !formData.continuous_bell_enabled}
                          >
                            <Volume2 className="w-3 h-3 mr-1" />
                            Tester la sonnerie
                          </Button>
                        </div>
                      )}
                    </div>
                    </div>
                    </div>

                {/* Section Clients */}
                <div className="mt-4">
                  <p className="text-xs font-semibold text-slate-500 mb-2 px-3">CLIENTS</p>
                  <div className="space-y-2">
                    <div className="p-3 border rounded-xl hover:bg-slate-50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                          <Label>Nouvel utilisateur inscrit</Label>
                        </div>
                        <input
                          type="checkbox"
                          checked={formData.new_user}
                          onChange={(e) => setFormData({...formData, new_user: e.target.checked})}
                          className="w-4 h-4"
                          disabled={!formData.enabled}
                        />
                      </div>
                      {!formData.use_single_sound && (
                        <div className="flex gap-2">
                          <Select
                            value={formData.new_user_sound}
                            onValueChange={(value) => setFormData({...formData, new_user_sound: value})}
                            disabled={!formData.enabled || !formData.new_user}
                          >
                            <SelectTrigger className="h-8 text-xs flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">🔔 Défaut</SelectItem>
                              <SelectItem value="chime">🎵 Carillon</SelectItem>
                              <SelectItem value="bell">🔔 Cloche</SelectItem>
                              <SelectItem value="alert">⚠️ Alerte</SelectItem>
                              <SelectItem value="beep">📢 Bip</SelectItem>
                              <SelectItem value="ding">✨ Ding</SelectItem>
                              <SelectItem value="double-beep">📣 Double Bip</SelectItem>
                              <SelectItem value="triple-beep">🔊 Triple Bip</SelectItem>
                              <SelectItem value="urgent">🚨 Urgent</SelectItem>
                              <SelectItem value="soft">🎶 Doux</SelectItem>
                              <SelectItem value="ascending">📈 Montant</SelectItem>
                              <SelectItem value="descending">📉 Descendant</SelectItem>
                              <SelectItem value="success">✅ Succès</SelectItem>
                              <SelectItem value="warning">⚠️ Avertissement</SelectItem>
                              <SelectItem value="none">🔇 Aucun</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            onClick={() => playTestSound(formData.new_user_sound)}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled={!formData.enabled || !formData.new_user || formData.new_user_sound === 'none'}
                          >
                            <Volume2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="p-3 border rounded-xl hover:bg-slate-50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
                          <Label>Nouveau message client</Label>
                        </div>
                        <input
                          type="checkbox"
                          checked={formData.new_message}
                          onChange={(e) => setFormData({...formData, new_message: e.target.checked})}
                          className="w-4 h-4"
                          disabled={!formData.enabled}
                        />
                      </div>
                      {!formData.use_single_sound && (
                        <div className="flex gap-2">
                          <Select
                            value={formData.new_message_sound}
                            onValueChange={(value) => setFormData({...formData, new_message_sound: value})}
                            disabled={!formData.enabled || !formData.new_message}
                          >
                            <SelectTrigger className="h-8 text-xs flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">🔔 Défaut</SelectItem>
                              <SelectItem value="chime">🎵 Carillon</SelectItem>
                              <SelectItem value="bell">🔔 Cloche</SelectItem>
                              <SelectItem value="alert">⚠️ Alerte</SelectItem>
                              <SelectItem value="beep">📢 Bip</SelectItem>
                              <SelectItem value="ding">✨ Ding</SelectItem>
                              <SelectItem value="double-beep">📣 Double Bip</SelectItem>
                              <SelectItem value="triple-beep">🔊 Triple Bip</SelectItem>
                              <SelectItem value="urgent">🚨 Urgent</SelectItem>
                              <SelectItem value="soft">🎶 Doux</SelectItem>
                              <SelectItem value="ascending">📈 Montant</SelectItem>
                              <SelectItem value="descending">📉 Descendant</SelectItem>
                              <SelectItem value="success">✅ Succès</SelectItem>
                              <SelectItem value="warning">⚠️ Avertissement</SelectItem>
                              <SelectItem value="none">🔇 Aucun</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            onClick={() => playTestSound(formData.new_message_sound)}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled={!formData.enabled || !formData.new_message || formData.new_message_sound === 'none'}
                          >
                            <Volume2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="p-3 border rounded-xl hover:bg-slate-50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                          <Label>Nouvel avis client</Label>
                        </div>
                        <input
                          type="checkbox"
                          checked={formData.new_review}
                          onChange={(e) => setFormData({...formData, new_review: e.target.checked})}
                          className="w-4 h-4"
                          disabled={!formData.enabled}
                        />
                      </div>
                      {!formData.use_single_sound && (
                        <div className="flex gap-2">
                          <Select
                            value={formData.new_review_sound}
                            onValueChange={(value) => setFormData({...formData, new_review_sound: value})}
                            disabled={!formData.enabled || !formData.new_review}
                          >
                            <SelectTrigger className="h-8 text-xs flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">🔔 Défaut</SelectItem>
                              <SelectItem value="chime">🎵 Carillon</SelectItem>
                              <SelectItem value="bell">🔔 Cloche</SelectItem>
                              <SelectItem value="alert">⚠️ Alerte</SelectItem>
                              <SelectItem value="beep">📢 Bip</SelectItem>
                              <SelectItem value="ding">✨ Ding</SelectItem>
                              <SelectItem value="double-beep">📣 Double Bip</SelectItem>
                              <SelectItem value="triple-beep">🔊 Triple Bip</SelectItem>
                              <SelectItem value="urgent">🚨 Urgent</SelectItem>
                              <SelectItem value="soft">🎶 Doux</SelectItem>
                              <SelectItem value="ascending">📈 Montant</SelectItem>
                              <SelectItem value="descending">📉 Descendant</SelectItem>
                              <SelectItem value="success">✅ Succès</SelectItem>
                              <SelectItem value="warning">⚠️ Avertissement</SelectItem>
                              <SelectItem value="none">🔇 Aucun</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            onClick={() => playTestSound(formData.new_review_sound)}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled={!formData.enabled || !formData.new_review || formData.new_review_sound === 'none'}
                          >
                            <Volume2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section Produits */}
                <div className="mt-4">
                  <p className="text-xs font-semibold text-slate-500 mb-2 px-3">PRODUITS</p>
                  <div className="space-y-2">
                    <div className="p-3 border rounded-xl hover:bg-slate-50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                          <Label>Stock faible (≤5)</Label>
                        </div>
                        <input
                          type="checkbox"
                          checked={formData.low_stock}
                          onChange={(e) => setFormData({...formData, low_stock: e.target.checked})}
                          className="w-4 h-4"
                          disabled={!formData.enabled}
                        />
                      </div>
                      {!formData.use_single_sound && (
                        <div className="flex gap-2">
                          <Select
                            value={formData.low_stock_sound}
                            onValueChange={(value) => setFormData({...formData, low_stock_sound: value})}
                            disabled={!formData.enabled || !formData.low_stock}
                          >
                            <SelectTrigger className="h-8 text-xs flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">🔔 Défaut</SelectItem>
                              <SelectItem value="chime">🎵 Carillon</SelectItem>
                              <SelectItem value="bell">🔔 Cloche</SelectItem>
                              <SelectItem value="alert">⚠️ Alerte</SelectItem>
                              <SelectItem value="beep">📢 Bip</SelectItem>
                              <SelectItem value="ding">✨ Ding</SelectItem>
                              <SelectItem value="double-beep">📣 Double Bip</SelectItem>
                              <SelectItem value="triple-beep">🔊 Triple Bip</SelectItem>
                              <SelectItem value="urgent">🚨 Urgent</SelectItem>
                              <SelectItem value="soft">🎶 Doux</SelectItem>
                              <SelectItem value="ascending">📈 Montant</SelectItem>
                              <SelectItem value="descending">📉 Descendant</SelectItem>
                              <SelectItem value="success">✅ Succès</SelectItem>
                              <SelectItem value="warning">⚠️ Avertissement</SelectItem>
                              <SelectItem value="none">🔇 Aucun</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            onClick={() => playTestSound(formData.low_stock_sound)}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled={!formData.enabled || !formData.low_stock || formData.low_stock_sound === 'none'}
                          >
                            <Volume2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="p-3 border rounded-xl hover:bg-slate-50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-red-500"></div>
                          <Label>Produit en rupture de stock</Label>
                        </div>
                        <input
                          type="checkbox"
                          checked={formData.out_of_stock}
                          onChange={(e) => setFormData({...formData, out_of_stock: e.target.checked})}
                          className="w-4 h-4"
                          disabled={!formData.enabled}
                        />
                      </div>
                      {!formData.use_single_sound && (
                        <div className="flex gap-2">
                          <Select
                            value={formData.out_of_stock_sound}
                            onValueChange={(value) => setFormData({...formData, out_of_stock_sound: value})}
                            disabled={!formData.enabled || !formData.out_of_stock}
                          >
                            <SelectTrigger className="h-8 text-xs flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">🔔 Défaut</SelectItem>
                              <SelectItem value="chime">🎵 Carillon</SelectItem>
                              <SelectItem value="bell">🔔 Cloche</SelectItem>
                              <SelectItem value="alert">⚠️ Alerte</SelectItem>
                              <SelectItem value="beep">📢 Bip</SelectItem>
                              <SelectItem value="ding">✨ Ding</SelectItem>
                              <SelectItem value="double-beep">📣 Double Bip</SelectItem>
                              <SelectItem value="triple-beep">🔊 Triple Bip</SelectItem>
                              <SelectItem value="urgent">🚨 Urgent</SelectItem>
                              <SelectItem value="soft">🎶 Doux</SelectItem>
                              <SelectItem value="ascending">📈 Montant</SelectItem>
                              <SelectItem value="descending">📉 Descendant</SelectItem>
                              <SelectItem value="success">✅ Succès</SelectItem>
                              <SelectItem value="warning">⚠️ Avertissement</SelectItem>
                              <SelectItem value="none">🔇 Aucun</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            onClick={() => playTestSound(formData.out_of_stock_sound)}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled={!formData.enabled || !formData.out_of_stock || formData.out_of_stock_sound === 'none'}
                          >
                            <Volume2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section Retours & Remboursements */}
                <div className="mt-4">
                  <p className="text-xs font-semibold text-slate-500 mb-2 px-3">RETOURS & REMBOURSEMENTS</p>
                  <div className="space-y-2">
                    <div className="p-3 border rounded-xl hover:bg-slate-50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-pink-500"></div>
                          <Label>Nouvelle demande de retour</Label>
                        </div>
                        <input
                          type="checkbox"
                          checked={formData.new_return}
                          onChange={(e) => setFormData({...formData, new_return: e.target.checked})}
                          className="w-4 h-4"
                          disabled={!formData.enabled}
                        />
                      </div>
                      {!formData.use_single_sound && (
                        <div className="flex gap-2">
                          <Select
                            value={formData.new_return_sound}
                            onValueChange={(value) => setFormData({...formData, new_return_sound: value})}
                            disabled={!formData.enabled || !formData.new_return}
                          >
                            <SelectTrigger className="h-8 text-xs flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">🔔 Défaut</SelectItem>
                              <SelectItem value="chime">🎵 Carillon</SelectItem>
                              <SelectItem value="bell">🔔 Cloche</SelectItem>
                              <SelectItem value="alert">⚠️ Alerte</SelectItem>
                              <SelectItem value="beep">📢 Bip</SelectItem>
                              <SelectItem value="ding">✨ Ding</SelectItem>
                              <SelectItem value="double-beep">📣 Double Bip</SelectItem>
                              <SelectItem value="triple-beep">🔊 Triple Bip</SelectItem>
                              <SelectItem value="urgent">🚨 Urgent</SelectItem>
                              <SelectItem value="soft">🎶 Doux</SelectItem>
                              <SelectItem value="ascending">📈 Montant</SelectItem>
                              <SelectItem value="descending">📉 Descendant</SelectItem>
                              <SelectItem value="success">✅ Succès</SelectItem>
                              <SelectItem value="warning">⚠️ Avertissement</SelectItem>
                              <SelectItem value="none">🔇 Aucun</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            onClick={() => playTestSound(formData.new_return_sound)}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled={!formData.enabled || !formData.new_return || formData.new_return_sound === 'none'}
                          >
                            <Volume2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="p-3 border rounded-xl hover:bg-slate-50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                          <Label>Demande de remboursement</Label>
                        </div>
                        <input
                          type="checkbox"
                          checked={formData.new_refund}
                          onChange={(e) => setFormData({...formData, new_refund: e.target.checked})}
                          className="w-4 h-4"
                          disabled={!formData.enabled}
                        />
                      </div>
                      {!formData.use_single_sound && (
                        <div className="flex gap-2">
                          <Select
                            value={formData.new_refund_sound}
                            onValueChange={(value) => setFormData({...formData, new_refund_sound: value})}
                            disabled={!formData.enabled || !formData.new_refund}
                          >
                            <SelectTrigger className="h-8 text-xs flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">🔔 Défaut</SelectItem>
                              <SelectItem value="chime">🎵 Carillon</SelectItem>
                              <SelectItem value="bell">🔔 Cloche</SelectItem>
                              <SelectItem value="alert">⚠️ Alerte</SelectItem>
                              <SelectItem value="beep">📢 Bip</SelectItem>
                              <SelectItem value="ding">✨ Ding</SelectItem>
                              <SelectItem value="double-beep">📣 Double Bip</SelectItem>
                              <SelectItem value="triple-beep">🔊 Triple Bip</SelectItem>
                              <SelectItem value="urgent">🚨 Urgent</SelectItem>
                              <SelectItem value="soft">🎶 Doux</SelectItem>
                              <SelectItem value="ascending">📈 Montant</SelectItem>
                              <SelectItem value="descending">📉 Descendant</SelectItem>
                              <SelectItem value="success">✅ Succès</SelectItem>
                              <SelectItem value="warning">⚠️ Avertissement</SelectItem>
                              <SelectItem value="none">🔇 Aucun</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            onClick={() => playTestSound(formData.new_refund_sound)}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled={!formData.enabled || !formData.new_refund || formData.new_refund_sound === 'none'}
                          >
                            <Volume2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section Fidélité */}
                <div className="mt-4">
                  <p className="text-xs font-semibold text-slate-500 mb-2 px-3">FIDÉLITÉ & PARRAINAGE</p>
                  <div className="space-y-2">
                    <div className="p-3 border rounded-xl hover:bg-slate-50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                          <Label>Client atteint un nouveau niveau</Label>
                        </div>
                        <input
                          type="checkbox"
                          checked={formData.loyalty_milestone}
                          onChange={(e) => setFormData({...formData, loyalty_milestone: e.target.checked})}
                          className="w-4 h-4"
                          disabled={!formData.enabled}
                        />
                      </div>
                      {!formData.use_single_sound && (
                        <div className="flex gap-2">
                          <Select
                            value={formData.loyalty_milestone_sound}
                            onValueChange={(value) => setFormData({...formData, loyalty_milestone_sound: value})}
                            disabled={!formData.enabled || !formData.loyalty_milestone}
                          >
                            <SelectTrigger className="h-8 text-xs flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">🔔 Défaut</SelectItem>
                              <SelectItem value="chime">🎵 Carillon</SelectItem>
                              <SelectItem value="bell">🔔 Cloche</SelectItem>
                              <SelectItem value="alert">⚠️ Alerte</SelectItem>
                              <SelectItem value="beep">📢 Bip</SelectItem>
                              <SelectItem value="ding">✨ Ding</SelectItem>
                              <SelectItem value="double-beep">📣 Double Bip</SelectItem>
                              <SelectItem value="triple-beep">🔊 Triple Bip</SelectItem>
                              <SelectItem value="urgent">🚨 Urgent</SelectItem>
                              <SelectItem value="soft">🎶 Doux</SelectItem>
                              <SelectItem value="ascending">📈 Montant</SelectItem>
                              <SelectItem value="descending">📉 Descendant</SelectItem>
                              <SelectItem value="success">✅ Succès</SelectItem>
                              <SelectItem value="warning">⚠️ Avertissement</SelectItem>
                              <SelectItem value="none">🔇 Aucun</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            onClick={() => playTestSound(formData.loyalty_milestone_sound)}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled={!formData.enabled || !formData.loyalty_milestone || formData.loyalty_milestone_sound === 'none'}
                          >
                            <Volume2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="p-3 border rounded-xl hover:bg-slate-50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-teal-500"></div>
                          <Label>Parrainage réussi</Label>
                        </div>
                        <input
                          type="checkbox"
                          checked={formData.referral_success}
                          onChange={(e) => setFormData({...formData, referral_success: e.target.checked})}
                          className="w-4 h-4"
                          disabled={!formData.enabled}
                        />
                      </div>
                      {!formData.use_single_sound && (
                        <div className="flex gap-2">
                          <Select
                            value={formData.referral_success_sound}
                            onValueChange={(value) => setFormData({...formData, referral_success_sound: value})}
                            disabled={!formData.enabled || !formData.referral_success}
                          >
                            <SelectTrigger className="h-8 text-xs flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">🔔 Défaut</SelectItem>
                              <SelectItem value="chime">🎵 Carillon</SelectItem>
                              <SelectItem value="bell">🔔 Cloche</SelectItem>
                              <SelectItem value="alert">⚠️ Alerte</SelectItem>
                              <SelectItem value="beep">📢 Bip</SelectItem>
                              <SelectItem value="ding">✨ Ding</SelectItem>
                              <SelectItem value="double-beep">📣 Double Bip</SelectItem>
                              <SelectItem value="triple-beep">🔊 Triple Bip</SelectItem>
                              <SelectItem value="urgent">🚨 Urgent</SelectItem>
                              <SelectItem value="soft">🎶 Doux</SelectItem>
                              <SelectItem value="ascending">📈 Montant</SelectItem>
                              <SelectItem value="descending">📉 Descendant</SelectItem>
                              <SelectItem value="success">✅ Succès</SelectItem>
                              <SelectItem value="warning">⚠️ Avertissement</SelectItem>
                              <SelectItem value="none">🔇 Aucun</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            onClick={() => playTestSound(formData.referral_success_sound)}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled={!formData.enabled || !formData.referral_success || formData.referral_success_sound === 'none'}
                          >
                            <Volume2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>



            {/* Volume */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Volume</Label>
                <span className="text-sm text-slate-500">{formData.volume}%</span>
              </div>
              <Slider
                value={[formData.volume]}
                onValueChange={([value]) => setFormData({...formData, volume: value})}
                max={100}
                step={5}
                disabled={!formData.enabled || formData.sound === 'none'}
                className="w-full"
              />
            </div>

            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 rounded-xl"
            >
              <Save className="w-4 h-4 mr-2" />
              {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer les paramètres'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}