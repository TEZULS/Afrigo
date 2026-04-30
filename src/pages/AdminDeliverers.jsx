import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Truck, Plus, Edit, Trash2, Search, Phone, Mail, MapPin, ArrowLeft, Copy, Link2, Eye, EyeOff, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { useNavigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import DelivererIdGenerator from '@/components/deliverers/DelivererIdGenerator';

export default function AdminDeliverers() {
  const [user, setUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    address: '',
    postal_code: '',
    city: '',
    phone: '',
    birth_date: '',
    username: '',
    password: '',
    assigned_zones: [],
    is_active: true
  });

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (u?.role !== 'admin') {
        navigate(createPageUrl('Home'));
      }
    });
  }, [navigate]);

  const { data: deliverers = [] } = useQuery({
    queryKey: ['deliverers'],
    queryFn: () => base44.entities.Deliverer.list('-created_date')
  });

  const { data: zones = [] } = useQuery({
    queryKey: ['deliveryZones'],
    queryFn: () => base44.entities.DeliveryZone.list()
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Générer un identifiant court unique
      const allDeliverers = await base44.entities.Deliverer.list();
      const existingIds = allDeliverers
        .map(d => d.deliverer_id)
        .filter(id => id && id.startsWith('LIV'))
        .map(id => parseInt(id.replace('LIV', '')) || 0);
      
      const nextNumber = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
      const deliverer_id = `LIV${String(nextNumber).padStart(3, '0')}`;
      
      const deliverer = await base44.entities.Deliverer.create({
        ...data,
        deliverer_id
      });
      // Inviter l'utilisateur avec le rôle user
      await base44.users.inviteUser(data.email, 'user');
      return deliverer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliverers'] });
      toast.success('Livreur ajouté avec succès');
      resetForm();
    },
    onError: (error) => {
      console.error('Erreur création livreur:', error);
      toast.error('Erreur lors de l\'ajout du livreur');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Deliverer.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliverers'] });
      toast.success('Livreur mis à jour');
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Deliverer.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliverers'] });
      toast.success('Livreur supprimé');
    }
  });

  const resetForm = () => {
    setFormData({
      email: '',
      full_name: '',
      address: '',
      postal_code: '',
      city: '',
      phone: '',
      birth_date: '',
      username: '',
      password: '',
      assigned_zones: [],
      is_active: true
    });
    setEditing(null);
    setDialogOpen(false);
  };

  const handleEdit = (deliverer) => {
    setEditing(deliverer);
    setFormData({
      email: deliverer.email,
      full_name: deliverer.full_name,
      address: deliverer.address || '',
      postal_code: deliverer.postal_code || '',
      city: deliverer.city || '',
      phone: deliverer.phone,
      birth_date: deliverer.birth_date || '',
      username: deliverer.username || '',
      password: deliverer.password || '',
      assigned_zones: deliverer.assigned_zones || [],
      is_active: deliverer.is_active ?? true
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const toggleZone = (zoneId) => {
    const current = formData.assigned_zones || [];
    if (current.includes(zoneId)) {
      setFormData({ ...formData, assigned_zones: current.filter(z => z !== zoneId) });
    } else {
      setFormData({ ...formData, assigned_zones: [...current, zoneId] });
    }
  };

  const filteredDeliverers = deliverers.filter(d =>
    d.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <DelivererIdGenerator 
        deliverers={deliverers} 
        onIdGenerated={() => queryClient.invalidateQueries({ queryKey: ['deliverers'] })} 
      />
      <div className="max-w-7xl mx-auto">
        <Link to={createPageUrl('AdminDashboard')} className="inline-flex items-center text-slate-600 hover:text-blue-600 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour au tableau de bord
        </Link>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Truck className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Gestion des livreurs</h1>
              <p className="text-slate-500">Gérez vos livreurs et leurs zones</p>
            </div>
          </div>
          <Button
            onClick={() => {
              resetForm();
              setDialogOpen(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 rounded-xl"
          >
            <Plus className="w-4 h-4 mr-2" />
            Ajouter un livreur
          </Button>
        </div>

        {/* Lien de connexion */}
        <Card className="border-0 shadow-lg rounded-2xl bg-gradient-to-br from-blue-50 to-white mb-6">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Truck className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-800 mb-1">Lien de connexion Livreurs</h3>
                <p className="text-sm text-slate-600 mb-3">Partagez ce lien avec vos livreurs</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-white border rounded-lg text-xs text-blue-600 overflow-x-auto">
                    {window.location.origin + createPageUrl('DelivererLogin')}
                  </code>
                  <Button
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.origin + createPageUrl('DelivererLogin'));
                      toast.success('Lien copié !');
                    }}
                    className="bg-blue-600 hover:bg-blue-700 rounded-lg flex-shrink-0"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg rounded-2xl mb-6">
          <CardHeader>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Rechercher par nom ou email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 rounded-xl"
              />
            </div>
          </CardHeader>
          <CardContent>
            {filteredDeliverers.length === 0 ? (
              <div className="text-center py-12">
                <Truck className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">
                  {searchQuery ? 'Aucun livreur trouvé' : 'Aucun livreur pour le moment'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredDeliverers.map(deliverer => (
                  <div
                    key={deliverer.id}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-xl"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-slate-800">{deliverer.full_name}</h3>
                        {deliverer.deliverer_id && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            ID: {deliverer.deliverer_id}
                          </Badge>
                        )}
                        {deliverer.username && (
                          <Badge className="bg-indigo-100 text-indigo-700">
                            🔑 {deliverer.username}
                          </Badge>
                        )}
                        <Badge className={deliverer.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}>
                          {deliverer.is_active ? 'Actif' : 'Inactif'}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                        <span className="flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          {deliverer.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="w-4 h-4" />
                          {deliverer.phone}
                        </span>
                        {deliverer.birth_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {format(new Date(deliverer.birth_date), 'dd/MM/yyyy', { locale: fr })}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {deliverer.assigned_zones?.length || 0} zone(s)
                        </span>
                      </div>
                      {deliverer.address && (
                        <div className="text-sm text-slate-500 mt-1">
                          📍 {deliverer.address}, {deliverer.postal_code} {deliverer.city}
                        </div>
                      )}
                      {deliverer.assigned_zones?.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {deliverer.assigned_zones.map(zoneId => {
                            const zone = zones.find(z => z.id === zoneId);
                            return zone ? (
                              <Badge key={zoneId} variant="outline" className="text-xs">
                                {zone.name}
                              </Badge>
                            ) : null;
                          })}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(deliverer)}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm('Supprimer ce livreur ?')) {
                            deleteMutation.mutate(deliverer.id);
                          }
                        }}
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Modifier le livreur' : 'Ajouter un livreur'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={!!editing}
                placeholder="livreur@exemple.com"
                className="mt-1"
              />
              {!editing && (
                <p className="text-xs text-slate-500 mt-1">
                  Une invitation sera envoyée à cette adresse
                </p>
              )}
            </div>
            <div>
              <Label>Nom complet *</Label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Jean Dupont"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Adresse *</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="10 rue de la Paix"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Code postal *</Label>
                <Input
                  value={formData.postal_code}
                  onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                  placeholder="75001"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Ville *</Label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Paris"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>Téléphone *</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="06 12 34 56 78"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Date de naissance *</Label>
              <Input
                type="date"
                value={formData.birth_date}
                onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                className="mt-1"
              />
            </div>
            
            <div className="border-t pt-4">
              <h4 className="font-semibold text-slate-700 mb-3">Identifiants de connexion</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Identifiant * (pour la connexion)</Label>
                  <Input
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="livreur01"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Mot de passe * (défini par vous)</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Mot de passe sécurisé"
                      className="mt-1 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 mt-0.5"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <Label>Zones assignées</Label>
              <div className="space-y-2 mt-2 max-h-60 overflow-y-auto border rounded-xl p-3">
                {zones.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">
                    Aucune zone disponible
                  </p>
                ) : (
                  zones.map(zone => (
                    <div key={zone.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={formData.assigned_zones?.includes(zone.id)}
                        onCheckedChange={() => toggleZone(zone.id)}
                        id={`zone-${zone.id}`}
                      />
                      <label
                        htmlFor={`zone-${zone.id}`}
                        className="flex-1 text-sm cursor-pointer"
                      >
                        {zone.name} ({zone.postal_codes?.join(', ')})
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                id="is-active"
              />
              <label htmlFor="is-active" className="text-sm cursor-pointer">
                Livreur actif
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.email || !formData.full_name || !formData.address || !formData.postal_code || !formData.city || !formData.phone || !formData.birth_date || !formData.username || !formData.password || createMutation.isPending || updateMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {editing ? 'Mettre à jour' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}