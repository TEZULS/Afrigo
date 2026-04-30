import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ShieldCheck, Save } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

export default function AdminPrivacyPolicy() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [policy, setPolicy] = useState(null);
  const [content, setContent] = useState('');
  const [version, setVersion] = useState('1.0');
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u.role !== 'admin') {
        navigate(createPageUrl('Home'));
      } else {
        setUser(u);
        loadPolicy();
      }
    }).catch(() => navigate(createPageUrl('Home')))
    .finally(() => setLoading(false));
  }, [navigate]);

  const loadPolicy = async () => {
    try {
      const policies = await base44.entities.PrivacyPolicy.list();
      if (policies.length > 0) {
        const p = policies[0];
        setPolicy(p);
        setContent(p.content || '');
        setVersion(p.version || '1.0');
      } else {
        // Créer une politique par défaut
        setContent(`POLITIQUE DE CONFIDENTIALITÉ

1. COLLECTE DES DONNÉES
Nous collectons les informations que vous nous fournissez lors de votre inscription et de vos commandes (nom, prénom, adresse email, adresse de livraison).

2. UTILISATION DES DONNÉES
Vos données personnelles sont utilisées pour :
- Traiter vos commandes et livraisons
- Vous envoyer des notifications relatives à vos commandes
- Améliorer nos services

3. PROTECTION DES DONNÉES
Vos données sont stockées de manière sécurisée et ne sont jamais partagées avec des tiers sans votre consentement.

4. VOS DROITS
Conformément au RGPD, vous disposez d'un droit d'accès, de rectification et de suppression de vos données. Pour exercer ces droits, contactez-nous.

5. CONTACT
Pour toute question concernant vos données personnelles, contactez notre service client.`);
      }
    } catch (e) {
      console.error('Erreur chargement:', e);
    }
  };

  const handleSave = async () => {
    if (!content.trim()) {
      toast.error('Le contenu ne peut pas être vide');
      return;
    }
    setSaving(true);
    try {
      if (policy) {
        await base44.entities.PrivacyPolicy.update(policy.id, {
          content,
          version,
          is_active: true
        });
        setPolicy({ ...policy, content, version });
      } else {
        const created = await base44.entities.PrivacyPolicy.create({
          content,
          version,
          is_active: true
        });
        setPolicy(created);
      }
      toast.success('Politique de confidentialité sauvegardée ! Les utilisateurs devront l\'accepter à leur prochaine connexion.');
    } catch (e) {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link to={createPageUrl('AdminSettings')} className="inline-flex items-center text-slate-600 hover:text-emerald-600 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour aux paramètres
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Politique de confidentialité</h1>
            <p className="text-slate-500">Les utilisateurs devront accepter à chaque nouvelle version</p>
          </div>
        </div>

        <Card className="border-0 shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Modifier la politique</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label>Version</Label>
              <Input
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="ex: 1.0, 1.1, 2.0"
                className="mt-1 w-32"
              />
              <p className="text-xs text-slate-500 mt-1">
                Changer la version forcera tous les utilisateurs à relire et accepter la nouvelle politique.
              </p>
            </div>

            <div>
              <Label>Contenu de la politique</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="mt-1 min-h-[400px] font-mono text-sm"
                placeholder="Rédigez votre politique de confidentialité..."
              />
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-800 font-medium">⚠️ Important</p>
              <p className="text-sm text-amber-700 mt-1">
                Si vous modifiez la version, tous les utilisateurs connectés devront accepter la nouvelle politique lors de leur prochaine visite.
              </p>
            </div>

            <Button
              onClick={handleSave}
              disabled={saving || !content.trim()}
              className="w-full bg-emerald-500 hover:bg-emerald-600 rounded-xl py-6 text-base font-semibold"
            >
              <Save className="w-5 h-5 mr-2" />
              {saving ? 'Sauvegarde...' : 'Sauvegarder la politique'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}