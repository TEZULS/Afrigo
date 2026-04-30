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

export default function AdminInternalRegulations() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regulation, setRegulation] = useState(null);
  const [title, setTitle] = useState('Règlement intérieur');
  const [content, setContent] = useState('');
  const [version, setVersion] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u.role !== 'admin') {
        navigate(createPageUrl('Home'));
      } else {
        setUser(u);
        loadRegulation();
      }
    }).catch(() => navigate(createPageUrl('Home')))
    .finally(() => setLoading(false));
  }, [navigate]);

  const loadRegulation = async () => {
    try {
      const regulations = await base44.entities.InternalRegulations.list();
      const active = regulations.filter(r => r.is_active).sort((a, b) => b.version - a.version)[0];
      if (active) {
        setRegulation(active);
        setTitle(active.title || 'Règlement intérieur');
        setContent(active.content || '');
        setVersion(active.version || 1);
      } else {
        setTitle('Règlement intérieur AfriGo');
        setContent(`# Règlement Intérieur AfriGo

## 1. PRÉSENTATION DE LA PLATEFORME

AfriGo est une plateforme de commerce en ligne proposant des produits alimentaires et cosmétiques à destination de sa clientèle. En accédant à l'application et en passant commande, vous acceptez sans réserve le présent règlement intérieur.

---

## 2. CONDITIONS D'ACCÈS ET D'INSCRIPTION

- L'accès à la plateforme est réservé aux personnes majeures (18 ans et plus).
- Chaque utilisateur ne peut posséder qu'un seul compte. Tout compte dupliqué pourra être supprimé sans préavis.
- L'utilisateur s'engage à fournir des informations exactes, complètes et à jour lors de son inscription.
- Toute usurpation d'identité ou fourniture de fausses informations entraînera la suspension immédiate du compte.
- L'utilisateur est responsable de la confidentialité de ses identifiants de connexion.

---

## 3. PASSATION DE COMMANDES

- Les commandes sont passées exclusivement via l'application AfriGo.
- Une commande est considérée comme définitive après confirmation du paiement.
- AfriGo se réserve le droit d'annuler toute commande en cas de stock insuffisant, d'erreur de prix manifeste ou de suspicion de fraude.
- Le client sera informé dans les meilleurs délais en cas d'annulation et remboursé intégralement si le paiement a déjà été effectué.
- Toute tentative de fraude (faux retours, contestations abusives) entraînera la suspension définitive du compte.

---

## 4. PAIEMENT

- Les paiements s'effectuent par carte bancaire via notre prestataire sécurisé Stripe, ou à la livraison selon les options disponibles.
- Les prix affichés sont en euros (€) et incluent toutes les taxes applicables.
- AfriGo ne stocke aucune donnée bancaire sur ses serveurs. Toutes les transactions sont sécurisées par chiffrement SSL.
- En cas de litige concernant un paiement, le client doit contacter le service client dans un délai de 7 jours.

---

## 5. LIVRAISON

- Les délais de livraison indiqués sont donnés à titre indicatif et peuvent varier selon les conditions météorologiques, la disponibilité des livreurs ou tout événement imprévisible.
- Le client doit s'assurer d'être accessible à l'adresse de livraison renseignée au moment de la commande.
- En cas d'absence lors de la livraison, le client sera contacté. Un nouvel essai pourra être planifié sous réserve de disponibilité.
- AfriGo décline toute responsabilité en cas d'adresse incorrecte fournie par le client.

---

## 6. RETOURS ET REMBOURSEMENTS

- Les demandes de retour doivent être effectuées dans le délai indiqué après réception de la commande (voir paramètres de l'application).
- Seuls les produits défectueux, abîmés ou ne correspondant pas à la commande sont éligibles au retour.
- Les retours abusifs ou répétés non justifiés pourront entraîner des restrictions sur le compte.
- Le remboursement sera effectué sur le portefeuille AfriGo ou par le moyen de paiement initial, selon la décision de l'administration.

---

## 7. PROGRAMME DE FIDÉLITÉ ET PARRAINAGE

- Les points de fidélité sont crédités après validation de la livraison. Ils ne peuvent pas être échangés contre de l'argent liquide.
- Les avantages liés aux niveaux (Argent, Or, Diamant) sont accordés selon les conditions en vigueur et peuvent être modifiés par AfriGo à tout moment.
- Le programme de parrainage est réservé aux clients en règle avec la plateforme. Tout abus (faux comptes, auto-parrainage) entraînera l'annulation des bonus et la suspension du compte.
- AfriGo se réserve le droit de modifier ou de suspendre le programme de fidélité à tout moment.

---

## 8. COMPORTEMENT DE L'UTILISATEUR

L'utilisateur s'engage à :

- Utiliser la plateforme de manière loyale et de bonne foi.
- Ne pas tenter de perturber le fonctionnement technique de l'application.
- Ne pas utiliser de robots, scripts ou tout autre moyen automatisé pour passer des commandes.
- Respecter le personnel d'AfriGo et les livreurs dans toute communication.
- Ne pas publier de contenus illicites, diffamatoires ou offensants dans les messages ou avis.

Tout manquement à ces règles pourra entraîner la suspension ou suppression définitive du compte, sans préavis et sans remboursement des éventuels avantages accumulés.

---

## 9. PORTEFEUILLE ÉLECTRONIQUE

- Le solde du portefeuille AfriGo est non remboursable en espèces.
- Les crédits ajoutés par l'administration (gestes commerciaux, remboursements) sont valables selon les conditions indiquées.
- Le portefeuille ne peut pas être transféré d'un compte à un autre.

---

## 10. PROPRIÉTÉ INTELLECTUELLE

- L'ensemble du contenu de l'application AfriGo (logo, textes, images, interface) est protégé par les droits de propriété intellectuelle.
- Toute reproduction, distribution ou utilisation non autorisée est strictement interdite et pourra faire l'objet de poursuites.

---

## 11. RESPONSABILITÉ

- AfriGo s'engage à mettre tout en œuvre pour assurer la disponibilité et la fiabilité de la plateforme, sans pouvoir garantir un service ininterrompu.
- AfriGo ne saurait être tenu responsable des dommages indirects résultant de l'utilisation de la plateforme.
- La responsabilité d'AfriGo est limitée au montant de la commande concernée.

---

## 12. MODIFICATION DU RÈGLEMENT

AfriGo se réserve le droit de modifier le présent règlement à tout moment. Les utilisateurs seront informés de toute modification et devront accepter la nouvelle version pour continuer à utiliser la plateforme.

---

## 13. DROIT APPLICABLE ET LITIGES

- Le présent règlement est soumis au droit français.
- En cas de litige, une solution amiable sera recherchée en priorité via le service client.
- À défaut d'accord amiable, les tribunaux compétents seront ceux du ressort du siège social d'AfriGo.

---

*En utilisant l'application AfriGo, vous reconnaissez avoir lu, compris et accepté l'intégralité du présent règlement intérieur.*`);
        setVersion(1);
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
      if (regulation) {
        await base44.entities.InternalRegulations.update(regulation.id, {
          title,
          content,
          version,
          is_active: true,
          effective_date: new Date().toISOString().split('T')[0]
        });
        setRegulation({ ...regulation, title, content, version });
      } else {
        const created = await base44.entities.InternalRegulations.create({
          title,
          content,
          version,
          is_active: true,
          effective_date: new Date().toISOString().split('T')[0]
        });
        setRegulation(created);
      }
      toast.success('Règlement intérieur sauvegardé ! Les utilisateurs devront l\'accepter à leur prochaine connexion.');
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
          <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Règlement intérieur</h1>
            <p className="text-slate-500">Les utilisateurs devront accepter à chaque nouvelle version</p>
          </div>
        </div>

        <Card className="border-0 shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Modifier le règlement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label>Titre</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titre du règlement intérieur"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Version</Label>
              <Input
                type="number"
                value={version}
                onChange={(e) => setVersion(Number(e.target.value))}
                placeholder="ex: 1, 2, 3"
                className="mt-1 w-32"
                min={1}
              />
              <p className="text-xs text-slate-500 mt-1">
                Changer la version forcera tous les utilisateurs à relire et accepter le nouveau règlement.
              </p>
            </div>

            <div>
              <Label>Contenu du règlement (Markdown supporté)</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="mt-1 min-h-[400px] font-mono text-sm"
                placeholder="Rédigez votre règlement intérieur..."
              />
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-800 font-medium">⚠️ Important</p>
              <p className="text-sm text-amber-700 mt-1">
                Si vous modifiez la version, tous les utilisateurs connectés devront accepter le nouveau règlement lors de leur prochaine visite.
              </p>
            </div>

            <Button
              onClick={handleSave}
              disabled={saving || !content.trim()}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-6 text-base font-semibold"
            >
              <Save className="w-5 h-5 mr-2" />
              {saving ? 'Sauvegarde...' : 'Sauvegarder le règlement'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}