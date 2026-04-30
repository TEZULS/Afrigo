import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar, Clock, Plus, Trash2, Edit, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { useNavigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AdminDeliverySlots() {
  const [user, setUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState(null);
  const [formData, setFormData] = useState({
    date: '',
    time_slots: [{ time_slot: '', max_orders: 10 }],
    is_available: true
  });
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u.role !== 'admin') {
        navigate(createPageUrl('Home'));
      } else {
        setUser(u);
      }
    }).catch(() => navigate(createPageUrl('Home')));
  }, [navigate]);

  const { data: slots = [] } = useQuery({
    queryKey: ['deliverySlots'],
    queryFn: () => base44.entities.DeliverySlot.list('-date'),
    enabled: !!user
  });

  const createSlotMutation = useMutation({
    mutationFn: async (data) => {
      // Créer plusieurs créneaux en une fois
      const promises = data.time_slots.map(slot => 
        base44.entities.DeliverySlot.create({
          date: data.date,
          time_slot: slot.time_slot,
          max_orders: slot.max_orders,
          is_available: data.is_available,
          current_orders: 0
        })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliverySlots'] });
      setDialogOpen(false);
      setEditingSlot(null);
      setFormData({ date: '', time_slots: [{ time_slot: '', max_orders: 10 }], is_available: true });
      toast.success('Créneaux créés avec succès');
    }
  });

  const updateSlotMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DeliverySlot.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliverySlots'] });
      setDialogOpen(false);
      setEditingSlot(null);
      setFormData({ date: '', time_slots: [{ time_slot: '', max_orders: 10 }], is_available: true });
      toast.success('Créneau modifié avec succès');
    }
  });

  const deleteSlotMutation = useMutation({
    mutationFn: (id) => base44.entities.DeliverySlot.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliverySlots'] });
      toast.success('Créneau supprimé');
    }
  });

  const handleSubmit = () => {
    if (!formData.date) {
      toast.error('Veuillez sélectionner une date');
      return;
    }

    if (editingSlot) {
      // Mode édition: un seul créneau
      if (!formData.time_slots[0]?.time_slot) {
        toast.error('Veuillez remplir le créneau horaire');
        return;
      }
      updateSlotMutation.mutate({
        id: editingSlot.id,
        data: {
          date: formData.date,
          time_slot: formData.time_slots[0].time_slot,
          max_orders: formData.time_slots[0].max_orders,
          is_available: formData.is_available
        }
      });
    } else {
      // Mode création: plusieurs créneaux
      const validSlots = formData.time_slots.filter(slot => slot.time_slot.trim() !== '');
      if (validSlots.length === 0) {
        toast.error('Veuillez ajouter au moins un créneau horaire');
        return;
      }
      createSlotMutation.mutate({ ...formData, time_slots: validSlots });
    }
  };

  const handleEdit = (slot) => {
    setEditingSlot(slot);
    setFormData({
      date: slot.date,
      time_slots: [{ time_slot: slot.time_slot, max_orders: slot.max_orders }],
      is_available: slot.is_available
    });
    setDialogOpen(true);
  };

  const addTimeSlot = () => {
    setFormData({
      ...formData,
      time_slots: [...formData.time_slots, { time_slot: '', max_orders: 10 }]
    });
  };

  const removeTimeSlot = (index) => {
    const newSlots = formData.time_slots.filter((_, i) => i !== index);
    setFormData({ ...formData, time_slots: newSlots });
  };

  const updateTimeSlot = (index, field, value) => {
    const newSlots = [...formData.time_slots];
    newSlots[index] = { ...newSlots[index], [field]: value };
    setFormData({ ...formData, time_slots: newSlots });
  };

  const handleDelete = (id) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce créneau ?')) {
      deleteSlotMutation.mutate(id);
    }
  };

  const toggleAvailability = (slot) => {
    updateSlotMutation.mutate({
      id: slot.id,
      data: { ...slot, is_available: !slot.is_available }
    });
  };

  const toggleAllSlotsMutation = useMutation({
    mutationFn: async (makeAvailable) => {
      const promises = slots.map(slot => 
        base44.entities.DeliverySlot.update(slot.id, { ...slot, is_available: makeAvailable })
      );
      return Promise.all(promises);
    },
    onSuccess: (_, makeAvailable) => {
      queryClient.invalidateQueries({ queryKey: ['deliverySlots'] });
      toast.success(makeAvailable ? 'Tous les créneaux activés' : 'Tous les créneaux désactivés');
    }
  });

  // Paramètre global : créneaux activés ou non
  const { data: appSettings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list(),
    enabled: !!user
  });
  const currentSettings = appSettings[0];
  const deliverySlotsEnabled = currentSettings?.delivery_slots_enabled ?? false;

  const toggleDeliverySlotsMutation = useMutation({
    mutationFn: (enabled) => {
      if (currentSettings) {
        return base44.entities.AppSettings.update(currentSettings.id, { delivery_slots_enabled: enabled });
      } else {
        return base44.entities.AppSettings.create({ is_available: true, delivery_slots_enabled: enabled });
      }
    },
    onSuccess: (_, enabled) => {
      queryClient.invalidateQueries({ queryKey: ['appSettings'] });
      toast.success(enabled ? 'Créneaux horaires activés' : 'Créneaux horaires désactivés');
    }
  });

  const allSlotsActive = slots.every(slot => slot.is_available);
  const someSlotsActive = slots.some(slot => slot.is_available);

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Link to={createPageUrl('AdminDashboard')} className="inline-flex items-center text-slate-600 hover:text-emerald-600 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour au tableau de bord
        </Link>
        {/* Toggle global */}
        <Card className="border-0 shadow-sm rounded-2xl mb-6">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-800">Système de créneaux horaires</p>
                <p className="text-sm text-slate-500 mt-0.5">
                  {deliverySlotsEnabled
                    ? 'Les clients doivent choisir un créneau lors de la commande'
                    : 'Les clients ne voient pas les créneaux horaires'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-medium ${deliverySlotsEnabled ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {deliverySlotsEnabled ? 'Activé' : 'Désactivé'}
                </span>
                <Switch
                  checked={deliverySlotsEnabled}
                  onCheckedChange={(v) => toggleDeliverySlotsMutation.mutate(v)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Créneaux de livraison</h1>
            <p className="text-slate-500">Gérez les dates et horaires de livraison disponibles</p>
          </div>
          <div className="flex gap-2">
            {slots.length > 0 && (
              <Button
                onClick={() => toggleAllSlotsMutation.mutate(!allSlotsActive)}
                variant="outline"
                className="rounded-xl"
              >
                {allSlotsActive ? 'Désactiver tout' : 'Activer tout'}
              </Button>
            )}
            <Button
              onClick={() => {
                setEditingSlot(null);
                setFormData({ date: '', time_slots: [{ time_slot: '', max_orders: 10 }], is_available: true });
                setDialogOpen(true);
              }}
              className="bg-emerald-500 hover:bg-emerald-600 rounded-xl"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nouveau créneau
            </Button>
          </div>
        </div>

        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Horaire</TableHead>
                  <TableHead>Commandes</TableHead>
                  <TableHead>Disponibilité</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slots.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                      Aucun créneau de livraison configuré
                    </TableCell>
                  </TableRow>
                ) : (
                  slots.map((slot) => (
                    <TableRow key={slot.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <span className="font-medium">
                            {format(new Date(slot.date), 'dd MMMM yyyy', { locale: fr })}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-slate-400" />
                          <span>{slot.time_slot}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={slot.current_orders >= slot.max_orders ? 'destructive' : 'secondary'}>
                          {slot.current_orders || 0} / {slot.max_orders}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={slot.is_available}
                          onCheckedChange={() => toggleAvailability(slot)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleEdit(slot)}
                            className="rounded-xl"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleDelete(slot.id)}
                            className="rounded-xl text-rose-500 hover:text-rose-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingSlot ? 'Modifier le créneau' : 'Nouveau créneau de livraison'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="date">Date de livraison</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Créneaux horaires</Label>
                  {!editingSlot && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addTimeSlot}
                      className="rounded-xl"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Ajouter
                    </Button>
                  )}
                </div>

                {formData.time_slots.map((slot, index) => (
                  <div key={index} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Input
                        type="text"
                        placeholder="ex: 09:00-12:00"
                        value={slot.time_slot}
                        onChange={(e) => updateTimeSlot(index, 'time_slot', e.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="w-32">
                      <Input
                        type="number"
                        min="1"
                        placeholder="Max"
                        value={slot.max_orders}
                        onChange={(e) => updateTimeSlot(index, 'max_orders', parseInt(e.target.value))}
                        className="rounded-xl"
                      />
                    </div>
                    {!editingSlot && formData.time_slots.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => removeTimeSlot(index)}
                        className="rounded-xl text-rose-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="is_available">Créneaux disponibles</Label>
                <Switch
                  id="is_available"
                  checked={formData.is_available}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_available: checked })}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  className="flex-1 rounded-xl"
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleSubmit}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 rounded-xl"
                >
                  {editingSlot ? 'Modifier' : 'Créer'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}