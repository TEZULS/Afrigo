import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MapPin, Plus, Edit, Trash2, Save, X, Search, ArrowLeft, Truck, Power } from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AdminDeliveryZones() {
  const [user, setUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const DAYS_OF_WEEK = [
    'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'
  ];

  const [formData, setFormData] = useState({
    name: '',
    cities: '',
    postal_codes: '',
    delivery_fee: 5,
    free_delivery_threshold: 29,
    delivery_time_days: '2 jours',
    delivery_schedule: [],
    min_order_amount: 0,
    is_active: true,
    delivery_discount_percentage: 0,
    discount_valid_from: '',
    discount_valid_until: '',
    discount_for_order_numbers: [],
    discount_for_new_customers: false,
    tier_discounts: {
      normal: 0,
      argent: 0,
      or: 0,
      diamant: 0
    }
  });
  const [selectedOrderNumbers, setSelectedOrderNumbers] = useState([]);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (u.role !== 'admin') navigate('/');
    }).catch(() => navigate('/'));
  }, [navigate]);

  const { data: zones = [] } = useQuery({
    queryKey: ['deliveryZones'],
    queryFn: () => base44.entities.DeliveryZone.list('created_date'),
    enabled: !!user
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.DeliveryZone.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveryZones'] });
      setDialogOpen(false);
      resetForm();
      toast.success('Zone créée');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DeliveryZone.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveryZones'] });
      setDialogOpen(false);
      resetForm();
      toast.success('Zone mise à jour');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.DeliveryZone.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveryZones'] });
      toast.success('Zone supprimée');
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      cities: '',
      postal_codes: '',
      delivery_fee: 5,
      free_delivery_threshold: 29,
      delivery_time_days: '2 jours',
      delivery_schedule: [],
      min_days_before_delivery: 0,
      min_order_amount: 0,
      is_active: true,
      delivery_discount_percentage: 0,
      discount_valid_from: '',
      discount_valid_until: '',
      discount_for_order_numbers: [],
      discount_for_new_customers: false,
      tier_discounts: {
        normal: 0,
        argent: 0,
        or: 0,
        diamant: 0
      }
    });
    setSelectedOrderNumbers([]);
    setEditingZone(null);
  };

  const toggleDay = (day) => {
    const exists = formData.delivery_schedule.find(d => d.day === day);
    if (exists) {
      setFormData({
        ...formData,
        delivery_schedule: formData.delivery_schedule.filter(d => d.day !== day)
      });
    } else {
      setFormData({
        ...formData,
        delivery_schedule: [...formData.delivery_schedule, { day, time_slots: [] }]
      });
    }
  };

  const addTimeSlotToDay = (day) => {
    setFormData({
      ...formData,
      delivery_schedule: formData.delivery_schedule.map(d =>
        d.day === day ? { ...d, time_slots: [...d.time_slots, ''] } : d
      )
    });
  };

  const updateTimeSlotForDay = (day, index, value) => {
    setFormData({
      ...formData,
      delivery_schedule: formData.delivery_schedule.map(d =>
        d.day === day
          ? { ...d, time_slots: d.time_slots.map((t, i) => i === index ? value : t) }
          : d
      )
    });
  };

  const removeTimeSlotFromDay = (day, index) => {
    setFormData({
      ...formData,
      delivery_schedule: formData.delivery_schedule.map(d =>
        d.day === day
          ? { ...d, time_slots: d.time_slots.filter((_, i) => i !== index) }
          : d
      )
    });
  };

  const handleEdit = (zone) => {
    setEditingZone(zone);
    setFormData({
      name: zone.name,
      cities: (zone.cities || []).join(', '),
      postal_codes: (zone.postal_codes || []).join(', '),
      delivery_fee: zone.delivery_fee,
      free_delivery_threshold: zone.free_delivery_threshold,
      delivery_time_days: zone.delivery_time_days || '2 jours',
      delivery_schedule: zone.delivery_schedule || [],
      min_days_before_delivery: zone.min_days_before_delivery ?? 0,
      min_order_amount: zone.min_order_amount || 0,
      is_active: zone.is_active,
      delivery_discount_percentage: zone.delivery_discount_percentage || 0,
      discount_valid_from: zone.discount_valid_from || '',
      discount_valid_until: zone.discount_valid_until || '',
      discount_for_order_numbers: zone.discount_for_order_numbers || [],
      discount_for_new_customers: zone.discount_for_new_customers || false,
      tier_discounts: zone.tier_discounts || {
        normal: 0,
        argent: 0,
        or: 0,
        diamant: 0
      }
    });
    setSelectedOrderNumbers(zone.discount_for_order_numbers || []);
    setDialogOpen(true);
  };

  const toggleOrderNumber = (num) => {
    if (selectedOrderNumbers.includes(num)) {
      setSelectedOrderNumbers(selectedOrderNumbers.filter(n => n !== num));
    } else {
      setSelectedOrderNumbers([...selectedOrderNumbers, num].sort((a, b) => a - b));
    }
  };

  const normalizeCity = (city) => {
    return city
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/gi, '')
      .toLowerCase()
      .trim();
  };

  const handleSubmit = () => {
    const data = {
      ...formData,
      cities: formData.cities.split(',').map(s => s.trim()).filter(Boolean),
      postal_codes: formData.postal_codes.split(',').map(s => s.trim()).filter(Boolean),
      normalized_cities: formData.cities.split(',').map(s => normalizeCity(s)).filter(Boolean),
      delivery_fee: parseFloat(formData.delivery_fee),
      free_delivery_threshold: parseFloat(formData.free_delivery_threshold),
      min_order_amount: parseFloat(formData.min_order_amount),
      delivery_discount_percentage: parseFloat(formData.delivery_discount_percentage),
      discount_for_order_numbers: selectedOrderNumbers,
      tier_discounts: {
        normal: parseFloat(formData.tier_discounts.normal) || 0,
        argent: parseFloat(formData.tier_discounts.argent) || 0,
        or: parseFloat(formData.tier_discounts.or) || 0,
        diamant: parseFloat(formData.tier_discounts.diamant) || 0
      }
    };

    if (editingZone) {
      updateMutation.mutate({ id: editingZone.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredZones = zones.filter(zone => {
    const query = searchQuery.toLowerCase();
    return zone.name?.toLowerCase().includes(query) ||
           zone.cities?.some(city => city.toLowerCase().includes(query)) ||
           zone.postal_codes?.some(code => code.toLowerCase().includes(query));
  });

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Link to={createPageUrl('AdminDashboard')} className="inline-flex items-center text-slate-600 hover:text-emerald-600 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour au tableau de bord
        </Link>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Zones de livraison</h1>
            <p className="text-slate-500 mt-1">Gérez les zones et tarifs de livraison</p>
          </div>
          <Button
            onClick={() => {
              resetForm();
              setDialogOpen(true);
            }}
            className="bg-emerald-500 hover:bg-emerald-600 rounded-xl"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle zone
          </Button>
        </div>

        {zones.length > 0 && (
          <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              placeholder="Rechercher par ville..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-12 pl-12 rounded-xl"
            />
          </div>
          </div>
        )}

        {zones.length === 0 ? (
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="py-12 text-center">
              <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-4">Aucune zone de livraison configurée</p>
              <Button
                onClick={() => setDialogOpen(true)}
                variant="outline"
                className="rounded-xl"
              >
                Créer la première zone
              </Button>
            </CardContent>
          </Card>
        ) : filteredZones.length === 0 ? (
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="py-12 text-center">
              <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Aucune zone trouvée pour "{searchQuery}"</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredZones.map(zone => (
              <Card key={zone.id} className="border-0 shadow-sm rounded-2xl hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-lg font-semibold text-slate-800">{zone.name}</h3>
                        <Badge variant={zone.is_active ? "default" : "secondary"}>
                          {zone.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      
                      <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-slate-500 mb-1">Villes</p>
                          <p className="text-slate-800 font-medium">
                            {zone.cities?.join(', ') || '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 mb-1">Codes postaux</p>
                          <p className="text-slate-800 font-medium">
                            {zone.postal_codes?.join(', ') || '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 mb-1">Frais de livraison</p>
                          <p className="text-slate-800 font-medium">
                            {zone.free_delivery_threshold === 0
                              ? <span className="text-emerald-600 font-semibold">🎁 Livraison toujours gratuite</span>
                              : <>{zone.delivery_fee}€ (gratuit dès {zone.free_delivery_threshold}€)</>
                            }
                          </p>
                        </div>
                        {zone.min_order_amount > 0 && (
                          <div>
                            <p className="text-slate-500 mb-1">Montant minimum</p>
                            <p className="text-slate-800 font-medium">{zone.min_order_amount}€</p>
                          </div>
                        )}
                        <div>
                          <p className="text-slate-500 mb-1">Délai de livraison</p>
                          <p className="text-slate-800 font-medium">{zone.delivery_time_days || '2 jours'}</p>
                        </div>
                        {zone.delivery_schedule?.length > 0 && (
                          <div className="md:col-span-2">
                            <p className="text-slate-500 mb-2">Jours et horaires de livraison</p>
                            <div className="flex flex-wrap gap-2">
                              {zone.delivery_schedule.map((d, i) => (
                                <div key={i} className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 text-sm">
                                  <span className="font-semibold text-emerald-800">{d.day}</span>
                                  {d.time_slots?.length > 0 && (
                                    <span className="text-emerald-600 ml-1">: {d.time_slots.join(', ')}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 ml-4">
                      <Button
                        onClick={() => updateMutation.mutate({ id: zone.id, data: { is_active: !zone.is_active } })}
                        variant={zone.is_active ? "outline" : "default"}
                        size="sm"
                        className={`rounded-xl whitespace-nowrap ${zone.is_active ? 'border-rose-300 text-rose-600 hover:bg-rose-50' : 'bg-emerald-500 hover:bg-emerald-600 text-white'}`}
                      >
                        <Power className="w-4 h-4 mr-1" />
                        {zone.is_active ? 'Désactiver' : 'Activer'}
                      </Button>
                      <Button
                        onClick={() => handleEdit(zone)}
                        variant="outline"
                        size="icon"
                        className="rounded-xl"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={() => {
                          if (confirm('Supprimer cette zone ?')) {
                            deleteMutation.mutate(zone.id);
                          }
                        }}
                        variant="outline"
                        size="icon"
                        className="rounded-xl text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingZone ? 'Modifier la zone' : 'Nouvelle zone de livraison'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label>Nom de la zone *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Paris Centre"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Villes (séparées par des virgules) *</Label>
                <Input
                  value={formData.cities}
                  onChange={(e) => setFormData({...formData, cities: e.target.value})}
                  placeholder="Paris, Lyon, Marseille"
                  className="mt-1"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Exemple: Paris, Lyon, Marseille
                </p>
              </div>

              <div>
                <Label>Codes postaux (séparés par des virgules) *</Label>
                <Input
                  value={formData.postal_codes}
                  onChange={(e) => setFormData({...formData, postal_codes: e.target.value})}
                  placeholder="75001, 75002, 75003"
                  className="mt-1"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Exemple: 75001, 75002, 75003
                </p>
              </div>

              {/* Planning de livraison */}
              <div className="border rounded-xl p-4 space-y-3 bg-slate-50">
                <div className="flex items-center gap-2">
                  <span className="text-base">📅</span>
                  <Label className="font-semibold text-slate-800">Jours et horaires de livraison</Label>
                </div>
                <p className="text-xs text-slate-500">Sélectionnez les jours disponibles et ajoutez les créneaux horaires pour chaque jour.</p>
                <div className="space-y-3">
                  {DAYS_OF_WEEK.map(day => {
                    const dayEntry = formData.delivery_schedule.find(d => d.day === day);
                    const isSelected = !!dayEntry;
                    return (
                      <div key={day} className={`rounded-xl border-2 transition-all ${isSelected ? 'border-emerald-400 bg-white' : 'border-slate-200 bg-white'}`}>
                        <div className="flex items-center justify-between px-4 py-2">
                          <button
                            type="button"
                            onClick={() => toggleDay(day)}
                            className="flex items-center gap-2"
                          >
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isSelected ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'}`}>
                              {isSelected && <span className="text-white text-xs font-bold">✓</span>}
                            </div>
                            <span className={`font-medium text-sm ${isSelected ? 'text-emerald-700' : 'text-slate-600'}`}>{day}</span>
                          </button>
                          {isSelected && (
                            <button
                              type="button"
                              onClick={() => addTimeSlotToDay(day)}
                              className="text-xs text-emerald-600 hover:text-emerald-800 flex items-center gap-1 font-medium"
                            >
                              <Plus className="w-3 h-3" />
                              Ajouter un créneau
                            </button>
                          )}
                        </div>
                        {isSelected && dayEntry.time_slots.length > 0 && (
                          <div className="px-4 pb-3 space-y-2">
                            {dayEntry.time_slots.map((slot, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <Input
                                  type="text"
                                  placeholder="ex: 09:00-12:00"
                                  value={slot}
                                  onChange={(e) => updateTimeSlotForDay(day, idx, e.target.value)}
                                  className="h-8 text-sm rounded-lg"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeTimeSlotFromDay(day, idx)}
                                  className="text-rose-400 hover:text-rose-600 flex-shrink-0"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        {isSelected && dayEntry.time_slots.length === 0 && (
                          <p className="px-4 pb-3 text-xs text-slate-400 italic">Aucun créneau — les clients pourront choisir la journée sans heure précise.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Délai minimum avant livraison */}
              <div className="border rounded-xl p-4 bg-blue-50 space-y-2">
                <Label className="font-semibold text-blue-800 flex items-center gap-2">
                  <span>⏱️</span> Délai minimum avant livraison
                </Label>
                <p className="text-xs text-blue-600">
                  Définissez combien de jours après la commande la livraison peut être effectuée.
                </p>
                <div className="flex items-center gap-3">
                  {[
                    { label: 'Jour même', value: 0 },
                    { label: 'Lendemain', value: 1 },
                    { label: 'Après-demain', value: 2 },
                    { label: '3 jours+', value: 3 },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, min_days_before_delivery: opt.value })}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${
                        Number(formData.min_days_before_delivery) === opt.value
                          ? 'border-blue-500 bg-blue-500 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-emerald-600" />
                  <span className="text-slate-700 font-medium text-sm">Livraison toujours gratuite</span>
                </div>
                <Switch
                  checked={Number(formData.free_delivery_threshold) === 0 && Number(formData.delivery_fee) === 0}
                  onCheckedChange={(checked) => {
                    setFormData({
                      ...formData,
                      free_delivery_threshold: checked ? 0 : 29,
                      delivery_fee: checked ? 0 : formData.delivery_fee
                    });
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Frais de livraison (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.delivery_fee}
                    onChange={(e) => setFormData({...formData, delivery_fee: e.target.value})}
                    className="mt-1"
                    disabled={Number(formData.free_delivery_threshold) === 0 && Number(formData.delivery_fee) === 0}
                  />
                </div>
                <div>
                  <Label>Livraison gratuite dès (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.free_delivery_threshold}
                    onChange={(e) => setFormData({...formData, free_delivery_threshold: e.target.value})}
                    className="mt-1"
                    disabled={Number(formData.free_delivery_threshold) === 0 && Number(formData.delivery_fee) === 0}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    💡 Mettez 0€ pour rendre la livraison toujours gratuite
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Montant minimum de commande (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.min_order_amount}
                    onChange={(e) => setFormData({...formData, min_order_amount: e.target.value})}
                    placeholder="0"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Délai de livraison</Label>
                  <Input
                    type="text"
                    value={formData.delivery_time_days}
                    onChange={(e) => setFormData({...formData, delivery_time_days: e.target.value})}
                    placeholder="2 jours, 24-48h, Sous 2 jours..."
                    className="mt-1"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Ex: 2 jours, 24-48h, Livraison express
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                  className="w-4 h-4"
                />
                <Label>Zone active</Label>
              </div>

              <div className="border-t pt-4 space-y-4">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <span className="text-purple-500">🎁</span>
                  Réductions sur la livraison
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Réduction sur livraison (%)</Label>
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      value={formData.delivery_discount_percentage}
                      onChange={(e) => setFormData({...formData, delivery_discount_percentage: e.target.value})}
                      placeholder="0"
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Valide à partir du</Label>
                    <Input
                      type="date"
                      value={formData.discount_valid_from}
                      onChange={(e) => setFormData({...formData, discount_valid_from: e.target.value})}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Valide jusqu'au</Label>
                    <Input
                      type="date"
                      value={formData.discount_valid_until}
                      onChange={(e) => setFormData({...formData, discount_valid_until: e.target.value})}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
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
                        {num === 1 ? '1ère' : num === 2 ? '2ème' : num === 3 ? '3ème' : `${num}ème`}
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

                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                  <input
                    type="checkbox"
                    checked={formData.discount_for_new_customers}
                    onChange={(e) => setFormData({...formData, discount_for_new_customers: e.target.checked})}
                    className="w-4 h-4"
                    id="new-customers"
                  />
                  <label htmlFor="new-customers" className="text-sm text-blue-900 cursor-pointer">
                    Réduction uniquement pour les nouveaux clients (1ère commande)
                  </label>
                </div>

                <div>
                  <Label className="mb-3 block">Réductions par niveau de client (%)</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-slate-500">Normal</Label>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        value={formData.tier_discounts.normal}
                        onChange={(e) => setFormData({
                          ...formData, 
                          tier_discounts: {...formData.tier_discounts, normal: e.target.value}
                        })}
                        placeholder="0"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Argent</Label>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        value={formData.tier_discounts.argent}
                        onChange={(e) => setFormData({
                          ...formData, 
                          tier_discounts: {...formData.tier_discounts, argent: e.target.value}
                        })}
                        placeholder="0"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Or</Label>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        value={formData.tier_discounts.or}
                        onChange={(e) => setFormData({
                          ...formData, 
                          tier_discounts: {...formData.tier_discounts, or: e.target.value}
                        })}
                        placeholder="0"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Diamant</Label>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        value={formData.tier_discounts.diamant}
                        onChange={(e) => setFormData({
                          ...formData, 
                          tier_discounts: {...formData.tier_discounts, diamant: e.target.value}
                        })}
                        placeholder="0"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleSubmit}
                  disabled={!formData.name || !formData.cities || !formData.postal_codes}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {editingZone ? 'Mettre à jour' : 'Créer'}
                </Button>
                <Button
                  onClick={() => {
                    setDialogOpen(false);
                    resetForm();
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  <X className="w-4 h-4 mr-2" />
                  Annuler
                </Button>
              </div>
            </div>
            </DialogContent>
            </Dialog>
            </div>
            </div>
            );
}