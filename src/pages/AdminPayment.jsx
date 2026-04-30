import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CreditCard, CheckCircle2, XCircle, AlertCircle, Key, ExternalLink, Eye, EyeOff } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function AdminPayment() {
  const [user, setUser] = useState(null);
  const [stripeConfigured, setStripeConfigured] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [stripePublishableKey, setStripePublishableKey] = useState('');
  const [stripeSecretKey, setStripeSecretKey] = useState('');
  const [showPublishable, setShowPublishable] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u.role !== 'admin') {
        navigate(createPageUrl('Home'));
      } else {
        setUser(u);
        checkStripeConfiguration();
      }
    }).catch(() => navigate(createPageUrl('Home')));
  }, [navigate]);

  const { data: settings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list(),
    enabled: !!user
  });

  useEffect(() => {
    if (settings[0]) {
      setStripePublishableKey(settings[0].stripe_publishable_key || '');
      setStripeSecretKey(settings[0].stripe_secret_key || '');
    }
  }, [settings]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (data) => {
      if (settings[0]) {
        return base44.entities.AppSettings.update(settings[0].id, data);
      } else {
        return base44.entities.AppSettings.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appSettings'] });
      toast.success('Configuration Stripe enregistrée');
    }
  });

  const handleSaveStripeConfig = () => {
    updateSettingsMutation.mutate({
      stripe_publishable_key: stripePublishableKey,
      stripe_secret_key: stripeSecretKey
    });
  };

  const checkStripeConfiguration = async () => {
    try {
      // Vérifier si les clés Stripe sont configurées en testant une connexion
      const response = await base44.functions.invoke('testStripeConnection', {});
      setStripeConfigured(response.data.configured);
    } catch (error) {
      setStripeConfigured(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      const response = await base44.functions.invoke('testStripeConnection', {});

      if (response.data.configured) {
        toast.success('Connexion Stripe établie avec succès');
        setStripeConfigured(true);
      } else {
        toast.error(response.data.message || 'Stripe non configuré');
      }
    } catch (error) {
      toast.error('Erreur lors du test de connexion');
    } finally {
      setTestingConnection(false);
    }
  };

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link to={createPageUrl('AdminDashboard')} className="inline-flex items-center text-slate-600 hover:text-emerald-600 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour au tableau de bord
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Configuration Stripe</h1>
            <p className="text-slate-500">Connectez votre compte Stripe pour accepter les paiements</p>
          </div>
        </div>

        {/* Statut de la connexion */}
        <Card className="mb-6 border-0 shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Statut de la connexion</span>
              {stripeConfigured ? (
                <Badge className="bg-emerald-100 text-emerald-700 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Connecté
                </Badge>
              ) : (
                <Badge className="bg-rose-100 text-rose-700 flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  Non configuré
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stripeConfigured ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <p className="text-sm text-emerald-700 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  Votre compte Stripe est connecté et prêt à recevoir des paiements
                </p>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm text-amber-700 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Aucune configuration Stripe détectée. Veuillez configurer vos clés API ci-dessous.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Configuration Clés */}
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle>Clés API Stripe</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="stripe-publishable" className="text-base font-semibold text-slate-800">
                Clé publique Stripe (pk_...)
              </Label>
              <p className="text-sm text-slate-500 mb-2">
                Clé publique pour les paiements côté client
              </p>
              <div className="relative">
                <Input
                  id="stripe-publishable"
                  type={showPublishable ? "text" : "password"}
                  value={stripePublishableKey}
                  onChange={(e) => setStripePublishableKey(e.target.value)}
                  placeholder="pk_test_..."
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPublishable(!showPublishable)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPublishable ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="stripe-secret" className="text-base font-semibold text-slate-800">
                Clé secrète Stripe (sk_...)
              </Label>
              <p className="text-sm text-slate-500 mb-2">
                Clé secrète pour les opérations serveur (garder confidentielle)
              </p>
              <div className="relative">
                <Input
                  id="stripe-secret"
                  type={showSecret ? "text" : "password"}
                  value={stripeSecretKey}
                  onChange={(e) => setStripeSecretKey(e.target.value)}
                  placeholder="sk_test_..."
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
              <p className="text-sm text-blue-700 font-medium flex items-center gap-2">
                <Key className="w-4 h-4" />
                Comment obtenir vos clés Stripe
              </p>
              <ol className="text-sm text-blue-600 space-y-1 ml-6 list-decimal">
                <li>Connectez-vous à votre compte Stripe</li>
                <li>Allez dans Développeurs → Clés API</li>
                <li>Copiez votre clé publique (commence par pk_) et clé secrète (commence par sk_)</li>
              </ol>
              <a
                href="https://dashboard.stripe.com/apikeys"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium mt-2"
              >
                <ExternalLink className="w-4 h-4" />
                Ouvrir le tableau de bord Stripe
              </a>
            </div>

            <Button
              onClick={handleSaveStripeConfig}
              disabled={updateSettingsMutation.isPending}
              className="w-full bg-emerald-500 hover:bg-emerald-600"
            >
              {updateSettingsMutation.isPending ? 'Enregistrement...' : 'Enregistrer les clés'}
            </Button>
          </CardContent>
        </Card>

        {/* Configuration Webhooks */}
        <Card className="border-0 shadow-sm rounded-2xl mt-6">
          <CardHeader>
            <CardTitle>Webhooks Stripe</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
              <p className="text-sm text-blue-700 font-medium">
                Configuration du Webhook
              </p>
              <div className="bg-white rounded p-3 text-xs font-mono text-blue-600 overflow-x-auto">
                https://votre-domaine.com/functions/webhookStripe
              </div>
              <p className="text-xs text-blue-600 mt-2">
                Pour configurer le webhook: allez dans Développeurs → Webhooks → Ajouter endpoint
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleTestConnection}
                disabled={testingConnection}
                className="bg-blue-500 hover:bg-blue-600"
              >
                {testingConnection ? 'Test en cours...' : 'Tester la connexion'}
              </Button>
              {stripeConfigured && (
                <Button
                  variant="outline"
                  onClick={checkStripeConfiguration}
                >
                  Vérifier la connexion
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Informations supplémentaires */}
        <Card className="mt-6 border-0 shadow-sm rounded-2xl bg-slate-50">
          <CardHeader>
            <CardTitle className="text-lg">Informations importantes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>• Vos clés API sont stockées de manière sécurisée dans les variables d'environnement</p>
            <p>• Utilisez les clés de test (sk_test_) pendant le développement</p>
            <p>• Passez aux clés de production (sk_live_) une fois prêt</p>
            <p>• Le webhook est nécessaire pour suivre automatiquement les paiements</p>
            <p>• Configurez l'URL du webhook: <code className="bg-white px-2 py-1 rounded text-xs">https://votre-domaine.com/functions/stripeWebhook</code></p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}