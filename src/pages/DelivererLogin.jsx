import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Truck, LogIn, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';

export default function DelivererLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Pas de vérification de session - chaque livreur doit se connecter avec ses identifiants

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!username || !password) {
      toast.error('Veuillez remplir tous les champs');
      setError('Tous les champs sont requis');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Vérifier les credentials
      const deliverers = await base44.entities.Deliverer.filter({ username });
      
      if (deliverers.length === 0) {
        toast.error('❌ Identifiant incorrect. Vérifiez votre identifiant.');
        setError('Identifiant introuvable');
        setLoading(false);
        return;
      }

      const deliverer = deliverers[0];

      if (deliverer.password !== password) {
        toast.error('❌ Mot de passe incorrect. Réessayez.');
        setError('Mot de passe erroné');
        setLoading(false);
        return;
      }

      if (!deliverer.is_active) {
        toast.error('Votre compte est désactivé. Contactez l\'administrateur.');
        setLoading(false);
        return;
      }

      // Générer un token d'accès permanent si pas déjà existant
      let accessToken = deliverer.access_token;
      if (!accessToken) {
        accessToken = `${deliverer.id}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        await base44.entities.Deliverer.update(deliverer.id, { access_token: accessToken });
      }

      toast.success(`Bienvenue ${deliverer.full_name}`);
      // Rediriger avec le token dans l'URL
      window.location.href = createPageUrl('DelivererDashboard') + `?token=${accessToken}`;
    } catch (error) {
      toast.error('Erreur de connexion');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-2xl rounded-3xl">
        <CardHeader className="text-center pb-2">
          <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Truck className="w-10 h-10 text-blue-600" />
          </div>
          <CardTitle className="text-3xl font-bold text-slate-800">
            Connexion Livreur
          </CardTitle>
          <p className="text-slate-500 mt-2">
            Entrez vos identifiants pour accéder à votre espace
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl">
                <p className="text-sm font-medium text-red-800 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  {error}
                </p>
              </div>
            )}
            <div>
              <Label htmlFor="username" className="text-base font-semibold">
                Identifiant
              </Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Votre identifiant"
                className="h-12 rounded-xl mt-2 text-lg"
                autoComplete="username"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-base font-semibold">
                Mot de passe
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Votre mot de passe"
                  className="h-12 rounded-xl mt-2 text-lg pr-12"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 mt-1"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-blue-600 hover:bg-blue-700 rounded-xl text-lg font-semibold shadow-lg"
            >
              {loading ? (
                'Connexion en cours...'
              ) : (
                <>
                  <LogIn className="w-5 h-5 mr-2" />
                  Se connecter
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800">
                <p className="font-medium mb-1">Besoin d'aide ?</p>
                <p>Contactez l'administrateur si vous avez oublié vos identifiants.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}