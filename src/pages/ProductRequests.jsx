import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Upload, Package, Clock, CheckCircle, XCircle, AlertCircle, Camera, Image } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function ProductRequests() {
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    product_name: '',
    description: '',
    quantity: 1,
    image_url: ''
  });
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {
      base44.auth.redirectToLogin();
    });
  }, []);

  const { data: settings = [] } = useQuery({
    queryKey: ['productRequestSettings'],
    queryFn: () => base44.entities.ProductRequestSettings.list(),
    enabled: !!user
  });

  const { data: myRequests = [] } = useQuery({
    queryKey: ['myProductRequests', user?.email],
    queryFn: () => base44.entities.ProductRequest.filter({ customer_email: user?.email }),
    enabled: !!user?.email
  });

  // Créer automatiquement la configuration si elle n'existe pas
  useEffect(() => {
    if (user && settings.length === 0) {
      base44.entities.ProductRequestSettings.create({
        is_enabled: true,
        allowed_customers: [],
        allowed_tiers: [],
        message: 'Vous ne trouvez pas un produit ? Demandez-le nous !'
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['productRequestSettings'] });
      }).catch(() => {});
    }
  }, [user, settings]);

  const config = settings[0] || { is_enabled: true, allowed_customers: [], allowed_tiers: [], message: 'Vous ne trouvez pas un produit ? Demandez-le nous !' };

  // Vérifier si l'utilisateur a accès
  const userTier = user?.customer_tier || 'normal';
  const hasAccess = config.is_enabled && (
    (config.allowed_customers?.length === 0 || config.allowed_customers?.includes(user?.email)) &&
    (config.allowed_tiers?.length === 0 || config.allowed_tiers?.includes(userTier))
  );

  const createRequestMutation = useMutation({
    mutationFn: (data) => base44.entities.ProductRequest.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myProductRequests'] });
      setFormData({ product_name: '', description: '', quantity: 1, image_url: '' });
      toast.success('Demande envoyée avec succès !');
    }
  });

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData(prev => ({ ...prev, image_url: file_url }));
      toast.success('Image ajoutée');
    } catch (error) {
      toast.error('Erreur lors de l\'upload');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.product_name || !formData.description) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    createRequestMutation.mutate({
      ...formData,
      customer_email: user.email,
      customer_name: user.full_name || user.email
    });
  };

  const statusConfig = {
    pending: { label: 'En attente', icon: Clock, color: 'bg-amber-100 text-amber-800' },
    approved: { label: 'Approuvée', icon: CheckCircle, color: 'bg-green-100 text-green-800' },
    rejected: { label: 'Refusée', icon: XCircle, color: 'bg-red-100 text-red-800' },
    completed: { label: 'Terminée', icon: CheckCircle, color: 'bg-blue-100 text-blue-800' }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">
              Service temporairement indisponible
            </h2>
            <p className="text-slate-600">
              Les demandes de produits personnalisés ne sont pas disponibles pour le moment.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-800 mb-2">Demander un produit</h1>
            <p className="text-slate-600">{config.message}</p>
          </div>

          {/* Formulaire de demande */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-500" />
                Nouvelle demande
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Nom du produit *</label>
                  <Input
                    value={formData.product_name}
                    onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                    placeholder="Ex: Bananes plantain bio"
                    className="rounded-xl"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Description détaillée *</label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Décrivez le produit que vous recherchez..."
                    className="rounded-xl min-h-[100px]"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Quantité souhaitée *</label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                    className="rounded-xl"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Photo du produit (optionnel)</label>
                  <div className="flex gap-3 items-center flex-wrap">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="image-upload-gallery"
                    />
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="image-upload-camera"
                    />
                    <label htmlFor="image-upload-gallery">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={uploading}
                        asChild
                      >
                        <span className="cursor-pointer">
                          <Image className="w-4 h-4 mr-2" />
                          {uploading ? 'Upload...' : 'Galerie'}
                        </span>
                      </Button>
                    </label>
                    <label htmlFor="image-upload-camera">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={uploading}
                        asChild
                      >
                        <span className="cursor-pointer">
                          <Camera className="w-4 h-4 mr-2" />
                          Prendre une photo
                        </span>
                      </Button>
                    </label>
                    {formData.image_url && (
                      <img 
                        src={formData.image_url} 
                        alt="Aperçu" 
                        className="h-12 w-12 object-cover rounded-lg"
                      />
                    )}
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={createRequestMutation.isPending}
                  className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 rounded-xl"
                >
                  {createRequestMutation.isPending ? 'Envoi...' : 'Envoyer la demande'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Mes demandes */}
          <div>
            <h2 className="text-2xl font-bold text-slate-800 mb-4">Mes demandes</h2>
            {myRequests.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">Aucune demande pour le moment</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {myRequests.map(request => {
                  const Status = statusConfig[request.status];
                  return (
                    <Card key={request.id}>
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          {request.image_url && (
                            <img 
                              src={request.image_url} 
                              alt={request.product_name}
                              className="w-20 h-20 object-cover rounded-lg"
                            />
                          )}
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-2">
                              <h3 className="font-semibold text-slate-800">{request.product_name}</h3>
                              <Badge className={Status.color}>
                                <Status.icon className="w-3 h-3 mr-1" />
                                {Status.label}
                              </Badge>
                            </div>
                            <p className="text-sm text-slate-600 mb-2">{request.description}</p>
                            <p className="text-sm text-slate-500">Quantité: {request.quantity}</p>
                            
                            {request.admin_response && (
                              <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                                <p className="text-sm font-medium text-blue-800 mb-1">Réponse de l'administrateur:</p>
                                <p className="text-sm text-blue-700">{request.admin_response}</p>
                                {request.estimated_price && (
                                  <p className="text-sm font-semibold text-blue-800 mt-2">
                                    Prix estimé: {request.estimated_price}€
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}