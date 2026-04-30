import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Package, Clock, CheckCircle, XCircle, Settings, UserCheck, Search } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';

export default function AdminProductRequests() {
  const [user, setUser] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [response, setResponse] = useState({ admin_response: '', estimated_price: '' });
  const queryClient = useQueryClient();

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

  const { data: requests = [] } = useQuery({
    queryKey: ['productRequests'],
    queryFn: () => base44.entities.ProductRequest.list('-created_date'),
    enabled: !!user
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['productRequestSettings'],
    queryFn: () => base44.entities.ProductRequestSettings.list(),
    enabled: !!user
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user
  });

  const config = settings[0] || { is_enabled: true, allowed_customers: [], allowed_tiers: [], message: 'Vous ne trouvez pas un produit ? Demandez-le nous !' };

  const updateRequestMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ProductRequest.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productRequests'] });
      setDialogOpen(false);
      setSelectedRequest(null);
      setResponse({ admin_response: '', estimated_price: '' });
      toast.success('Demande mise à jour');
    }
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (data) => {
      if (settings.length > 0) {
        return base44.entities.ProductRequestSettings.update(settings[0].id, data);
      } else {
        return base44.entities.ProductRequestSettings.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productRequestSettings'] });
      toast.success('Paramètres mis à jour');
    }
  });

  const handleStatusChange = (request, status) => {
    setSelectedRequest(request);
    setResponse({ admin_response: request.admin_response || '', estimated_price: request.estimated_price || '' });
    setDialogOpen(true);
  };

  const handleSubmitResponse = () => {
    if (!selectedRequest) return;

    updateRequestMutation.mutate({
      id: selectedRequest.id,
      data: {
        ...response,
        status: selectedRequest.status === 'pending' ? 'approved' : selectedRequest.status
      }
    });
  };

  const handleQuickStatus = (request, status) => {
    updateRequestMutation.mutate({
      id: request.id,
      data: { status }
    });
  };

  const toggleSystem = () => {
    updateSettingsMutation.mutate({ ...config, is_enabled: !config.is_enabled });
  };

  const toggleCustomerAccess = (email) => {
    const allowed = config.allowed_customers || [];
    const updated = allowed.includes(email)
      ? allowed.filter(e => e !== email)
      : [...allowed, email];
    updateSettingsMutation.mutate({ ...config, allowed_customers: updated });
  };

  const statusConfig = {
    pending: { label: 'En attente', icon: Clock, color: 'bg-amber-100 text-amber-800' },
    approved: { label: 'Approuvée', icon: CheckCircle, color: 'bg-green-100 text-green-800' },
    rejected: { label: 'Refusée', icon: XCircle, color: 'bg-red-100 text-red-800' },
    completed: { label: 'Terminée', icon: CheckCircle, color: 'bg-blue-100 text-blue-800' }
  };

  const filteredRequests = requests.filter(r =>
    r.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Demandes de produits</h1>
            <p className="text-slate-600">{requests.length} demande(s) au total</p>
          </div>
          <Button onClick={() => setSettingsOpen(true)} variant="outline">
            <Settings className="w-4 h-4 mr-2" />
            Paramètres
          </Button>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          {Object.entries(statusConfig).map(([status, config]) => {
            const count = requests.filter(r => r.status === status).length;
            return (
              <Card key={status}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${config.color.replace('text-', 'bg-').replace('800', '100')}`}>
                      <config.icon className={`w-6 h-6 ${config.color}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-800">{count}</p>
                      <p className="text-sm text-slate-600">{config.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par produit, client ou n° commande..."
              className="pl-10 rounded-xl"
            />
          </div>
        </div>

        {/* Liste des demandes */}
        <div className="space-y-4">
          {filteredRequests.map(request => {
            const Status = statusConfig[request.status];
            return (
              <Card key={request.id}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    {request.image_url && (
                      <img 
                        src={request.image_url} 
                        alt={request.product_name}
                        className="w-24 h-24 object-cover rounded-lg"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-slate-800 text-lg">{request.product_name}</h3>
                          <p className="text-sm text-slate-500">Par {request.customer_name}</p>
                        </div>
                        <Badge className={Status.color}>
                          <Status.icon className="w-3 h-3 mr-1" />
                          {Status.label}
                        </Badge>
                      </div>
                      <p className="text-slate-600 mb-2">{request.description}</p>
                      <p className="text-sm text-slate-500 mb-4">Quantité: {request.quantity}</p>
                      
                      {request.admin_response && (
                        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm font-medium text-blue-800 mb-1">Votre réponse:</p>
                          <p className="text-sm text-blue-700">{request.admin_response}</p>
                          {request.estimated_price && (
                            <p className="text-sm font-semibold text-blue-800 mt-1">
                              Prix estimé: {request.estimated_price}€
                            </p>
                          )}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleStatusChange(request, 'approved')}
                          size="sm"
                          variant="outline"
                          className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Répondre
                        </Button>
                        {request.status === 'pending' && (
                          <Button
                            onClick={() => handleQuickStatus(request, 'rejected')}
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-200 hover:bg-red-50"
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Refuser
                          </Button>
                        )}
                        {request.status === 'approved' && (
                          <Button
                            onClick={() => handleQuickStatus(request, 'completed')}
                            size="sm"
                            variant="outline"
                            className="text-blue-600 border-blue-200 hover:bg-blue-50"
                          >
                            Marquer terminée
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Dialog Réponse */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Répondre à la demande</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Réponse au client</label>
                <Textarea
                  value={response.admin_response}
                  onChange={(e) => setResponse({ ...response, admin_response: e.target.value })}
                  placeholder="Votre message au client..."
                  className="rounded-xl min-h-[100px]"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Prix estimé (€)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={response.estimated_price}
                  onChange={(e) => setResponse({ ...response, estimated_price: e.target.value })}
                  placeholder="Ex: 15.99"
                  className="rounded-xl"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={() => setDialogOpen(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleSubmitResponse}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                >
                  Envoyer
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog Paramètres */}
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Paramètres des demandes de produits</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-800 mb-1">Activer le système</h3>
                      <p className="text-sm text-slate-600">Autoriser les clients à faire des demandes</p>
                    </div>
                    <Switch
                      checked={config.is_enabled}
                      onCheckedChange={toggleSystem}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Message affiché aux clients</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={config.message}
                    onChange={(e) => updateSettingsMutation.mutate({ ...config, message: e.target.value })}
                    className="rounded-xl"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <UserCheck className="w-5 h-5" />
                    Niveaux de clients autorisés
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 mb-4">
                    Sélectionnez les niveaux autorisés à faire des demandes (vide = tous)
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {['normal', 'argent', 'or', 'diamant'].map(tier => (
                      <div key={tier} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <span className="font-medium text-slate-800 capitalize">{tier}</span>
                        <Switch
                          checked={config.allowed_tiers?.length === 0 || config.allowed_tiers?.includes(tier)}
                          onCheckedChange={() => {
                            const allowed = config.allowed_tiers || [];
                            const updated = allowed.includes(tier)
                              ? allowed.filter(t => t !== tier)
                              : [...allowed, tier];
                            updateSettingsMutation.mutate({ ...config, allowed_tiers: updated });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <UserCheck className="w-5 h-5" />
                    Clients spécifiques autorisés
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 mb-4">
                    {config.allowed_customers?.length === 0 
                      ? 'Aucune restriction par client spécifique'
                      : `${config.allowed_customers?.length} client(s) spécifique(s) autorisé(s)`
                    }
                  </p>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {users.map(u => (
                      <div key={u.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <p className="font-medium text-slate-800">{u.full_name}</p>
                          <p className="text-sm text-slate-500">{u.email}</p>
                        </div>
                        <Switch
                          checked={config.allowed_customers?.length === 0 || config.allowed_customers?.includes(u.email)}
                          onCheckedChange={() => toggleCustomerAccess(u.email)}
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}