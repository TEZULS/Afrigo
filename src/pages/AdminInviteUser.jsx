import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Mail, Shield, User as UserIcon, CheckCircle2, AlertCircle } from 'lucide-react';

export default function AdminInviteUser() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleInvite = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    setError('');

    try {
      const response = await base44.functions.invoke('sendCustomInvitation', {
        email,
        role
      });

      if (response.data.success) {
        setSuccess(response.data.message);
        setEmail('');
        setRole('user');
      } else {
        setError(response.data.error || 'Erreur lors de l\'invitation');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de l\'invitation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
            <UserPlus className="w-8 h-8" style={{ color: '#FF8C00' }} />
            Inviter un utilisateur
          </h1>
          <p className="text-slate-600 mt-2">
            Envoyez une invitation personnalisée en français avec le nom AfriGo
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Nouvelle invitation</CardTitle>
            <CardDescription>
              L'utilisateur recevra un email de Base44 pour créer son compte, suivi d'un email de bienvenue AfriGo personnalisé en français.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Adresse email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="utilisateur@exemple.com"
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role" className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Rôle
                </Label>
                <Select value={role} onValueChange={setRole} disabled={loading}>
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">
                      <div className="flex items-center gap-2">
                        <UserIcon className="w-4 h-4" />
                        Client
                      </div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Administrateur
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-slate-500">
                  {role === 'admin' 
                    ? 'L\'utilisateur aura accès au panneau d\'administration'
                    : 'L\'utilisateur sera un client standard'}
                </p>
              </div>

              {success && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-green-800 font-medium">Invitation envoyée !</p>
                    <p className="text-green-700 text-sm mt-1">{success}</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-800 font-medium">Erreur</p>
                    <p className="text-red-700 text-sm mt-1">{error}</p>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || !email}
                className="w-full"
                style={{ backgroundColor: '#FF8C00' }}
              >
                {loading ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Envoyer l'invitation
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t">
              <h4 className="font-semibold text-slate-800 mb-3">📧 Emails envoyés :</h4>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="text-slate-400">1.</span>
                  <span><strong>Email Base44</strong> - Lien pour créer le compte et se connecter</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate-400">2.</span>
                  <span><strong>Email AfriGo personnalisé</strong> - Message de bienvenue en français avec présentation de la plateforme</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}