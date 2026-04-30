import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Mail, ArrowLeft, Save, Plus, Trash2, Edit2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const STATUS_OPTIONS = [
  { value: 'pending', label: 'En attente', color: 'bg-slate-100 text-slate-800' },
  { value: 'confirmed', label: 'Confirmée', color: 'bg-blue-100 text-blue-800' },
  { value: 'preparing', label: 'En préparation', color: 'bg-purple-100 text-purple-800' },
  { value: 'ready', label: 'Prête', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'shipped', label: 'Expédiée', color: 'bg-orange-100 text-orange-800' },
  { value: 'delivered', label: 'Livrée', color: 'bg-green-100 text-green-800' },
  { value: 'cancelled', label: 'Annulée', color: 'bg-red-100 text-red-800' },
  { value: 'failed_delivery', label: 'Échec livraison', color: 'bg-red-100 text-red-800' },
  { value: 'not_delivered', label: 'Non livrée', color: 'bg-rose-100 text-rose-800' }
];

export default function AdminNotificationTemplates() {
  const [user, setUser] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    status: 'pending',
    subject: '',
    email_body: '',
    is_active: true
  });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u?.role !== 'admin') {
        navigate(createPageUrl('Home'));
      } else {
        setUser(u);
      }
    }).catch(() => navigate(createPageUrl('Home')));
  }, [navigate]);

  const { data: templates = [] } = useQuery({
    queryKey: ['notificationTemplates'],
    queryFn: () => base44.entities.NotificationTemplate.list(),
    enabled: !!user
  });

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (editingId) {
        return base44.entities.NotificationTemplate.update(editingId, data);
      }
      return base44.entities.NotificationTemplate.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationTemplates'] });
      toast.success(editingId ? 'Template modifié' : 'Template créé');
      handleCloseDialog();
    },
    onError: () => {
      toast.error('Erreur lors de la sauvegarde');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.NotificationTemplate.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationTemplates'] });
      toast.success('Template supprimé');
    },
    onError: () => {
      toast.error('Erreur lors de la suppression');
    }
  });

  const handleOpenDialog = (template = null) => {
    if (template) {
      setEditingId(template.id);
      setFormData({
        status: template.status,
        subject: template.subject,
        email_body: template.email_body,
        is_active: template.is_active
      });
    } else {
      setEditingId(null);
      setFormData({
        status: 'pending',
        subject: '',
        email_body: '',
        is_active: true
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setFormData({
      status: 'pending',
      subject: '',
      email_body: '',
      is_active: true
    });
  };

  const handleSave = () => {
    if (!formData.subject.trim()) {
      toast.error('Veuillez entrer un objet');
      return;
    }
    if (!formData.email_body.trim()) {
      toast.error('Veuillez entrer le contenu du message');
      return;
    }
    saveMutation.mutate(formData);
  };

  const getStatusLabel = (status) => {
    return STATUS_OPTIONS.find(s => s.value === status)?.label || status;
  };

  const getStatusColor = (status) => {
    return STATUS_OPTIONS.find(s => s.value === status)?.color || 'bg-gray-100 text-gray-800';
  };

  const groupedTemplates = STATUS_OPTIONS.map(option => ({
    ...option,
    template: templates.find(t => t.status === option.value)
  }));

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Link to={createPageUrl('AdminDashboard')} className="inline-flex items-center text-slate-600 hover:text-blue-600 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour au tableau de bord
        </Link>

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Mail className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Templates de notification</h1>
              <p className="text-slate-500 mt-1">Personnalisez les messages envoyés aux clients par statut</p>
            </div>
          </div>

          <Button onClick={() => handleOpenDialog()} className="bg-blue-600 hover:bg-blue-700 rounded-xl">
            <Plus className="w-4 h-4 mr-2" />
            Nouveau template
          </Button>
        </div>

        {/* Infos Variables */}
        <Card className="border-0 shadow-sm rounded-2xl mb-6 bg-blue-50 border-l-4 border-blue-500">
          <CardContent className="p-6">
            <p className="text-sm font-semibold text-blue-900 mb-2">Variables disponibles:</p>
            <div className="grid md:grid-cols-4 gap-4 text-xs text-blue-800">
              <div><code className="bg-blue-100 px-2 py-1 rounded">{"{{customer_name}}"}</code> - Nom du client</div>
              <div><code className="bg-blue-100 px-2 py-1 rounded">{"{{order_id}}"}</code> - ID de commande</div>
              <div><code className="bg-blue-100 px-2 py-1 rounded">{"{{order_number}}"}</code> - Numéro de commande</div>
              <div><code className="bg-blue-100 px-2 py-1 rounded">{"{{delivery_address}}"}</code> - Adresse livraison</div>
            </div>
          </CardContent>
        </Card>

        {/* Templates Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {groupedTemplates.map(option => {
            const template = option.template;
            return (
              <Card key={option.value} className="border-0 shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className={`${option.color} py-4`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge className={option.color}>
                        {option.label}
                      </Badge>
                    </div>
                    {template && (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(template)}
                          className="h-8 w-8"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(template.id)}
                          className="h-8 w-8 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-6">
                  {template ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-700">Actif</span>
                        <Switch
                          checked={template.is_active}
                          onCheckedChange={(checked) => {
                            saveMutation.mutate({
                              ...template,
                              is_active: checked
                            });
                          }}
                        />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 mb-1">Objet:</p>
                        <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg break-words">
                          {template.subject}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 mb-1">Message:</p>
                        <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                          {template.email_body}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-slate-500 text-sm mb-4">Aucun template pour ce statut</p>
                      <Button
                        onClick={() => {
                          setFormData({
                            status: option.value,
                            subject: '',
                            email_body: '',
                            is_active: true
                          });
                          setEditingId(null);
                          setDialogOpen(true);
                        }}
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                      >
                        <Plus className="w-3 h-3 mr-2" />
                        Créer un template
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Modifier le template' : 'Créer un template'}
            </DialogTitle>
            <DialogDescription>
              Rédigez le message qui sera envoyé aux clients
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-2 block">
                Statut
              </label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({...formData, status: value})}
                disabled={!!editingId}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700 mb-2 block">
                Objet de l'email
              </label>
              <Input
                value={formData.subject}
                onChange={(e) => setFormData({...formData, subject: e.target.value})}
                placeholder="Ex: Votre commande #{order_number} a été expédiée"
                className="rounded-xl"
              />
              <p className="text-xs text-slate-500 mt-1">
                Utilisez les variables disponibles ci-dessus
              </p>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700 mb-2 block">
                Contenu du message
              </label>
              <Textarea
                value={formData.email_body}
                onChange={(e) => setFormData({...formData, email_body: e.target.value})}
                placeholder="Ex: Bonjour {customer_name},

Votre commande a été expédiée!

Numéro: {order_number}
Adresse: {delivery_address}

Merci d'avoir commandé chez nous!"
                className="rounded-xl h-40"
              />
              <p className="text-xs text-slate-500 mt-1">
                Les sauts de ligne seront conservés dans le message
              </p>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <label className="text-sm font-semibold text-slate-700">
                Activer ce template
              </label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end mt-6">
            <Button
              variant="outline"
              onClick={handleCloseDialog}
              className="rounded-xl"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 rounded-xl"
            >
              <Save className="w-4 h-4 mr-2" />
              {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}