import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Settings, LogIn, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Vérifier si session admin existe
    const session = localStorage.getItem('admin_session');
    if (session) {
      const parsed = JSON.parse(session);
      if (parsed.expires > Date.now()) {
        navigate(createPageUrl('AdminDashboard'));
      } else {
        localStorage.removeItem('admin_session');
      }
    }
  }, [navigate]);

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
      // Vérifier les credentials admin
      const admins = await base44.entities.AdminPermissions.filter({ username });
      
      if (admins.length === 0) {
        toast.error('❌ Identifiant incorrect. Vérifiez votre identifiant.');
        setError('Identifiant introuvable');
        setLoading(false);
        return;
      }

      const admin = admins[0];

      if (!admin.password || admin.password !== password) {
        toast.error('❌ Mot de passe incorrect. Réessayez.');
        setError('Mot de passe erroné');
        setLoading(false);
        return;
      }

      // Créer une session admin (valable 8 heures)
      const session = {
        email: admin.admin_email,
        username: admin.username,
        permissions: admin.permissions,
        is_super_admin: admin.is_super_admin,
        can_modify: admin.can_modify,
        expires: Date.now() + (8 * 60 * 60 * 1000)
      };
      
      localStorage.setItem('admin_session', JSON.stringify(session));
      
      toast.success(`Bienvenue ${admin.username}`);
      navigate(createPageUrl('AdminDashboard'));
    } catch (error) {
      toast.error('Erreur de connexion');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-2xl rounded-3xl">
        <CardHeader className="text-center pb-2">
          <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Settings className="w-10 h-10 text-emerald-600" />
          </div>
          <CardTitle className="text-3xl font-bold text-slate-800">
            Connexion Admin
          </CardTitle>
          <p className="text-slate-500 mt-2">
            Entrez vos identifiants administrateur
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
              className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-lg font-semibold shadow-lg"
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

          <div className="mt-6 space-y-3">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-emerald-800">
                  <p className="font-medium mb-1">Aide</p>
                  <p>Contactez le super-admin si vous avez oublié vos identifiants.</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Super administrateur ?</p>
                  <p>Le super admin se connecte via la page de connexion standard de l'application.</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}