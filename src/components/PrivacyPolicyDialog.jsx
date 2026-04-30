import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ShieldCheck } from 'lucide-react';

// Ce composant peut être contrôlé depuis l'extérieur (open/onClose) pour enchaîner avec d'autres dialogs
// ou fonctionner de manière autonome si open n'est pas fourni
export default function PrivacyPolicyDialog({ user, open: openProp, onClose }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [policy, setPolicy] = useState(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  // Clé unique : email si connecté, sinon "guest"
  const storageKey = user?.email || 'guest';

  // Mode contrôlé vs autonome
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;

  useEffect(() => {
    const checkPolicy = async () => {
      try {
        const policies = await base44.entities.PrivacyPolicy.filter({ is_active: true });
        if (policies.length === 0) { onClose?.(); return; }

        const activePolicy = policies[0];
        setPolicy(activePolicy);

        // Vérifier l'acceptation : via localStorage pour les guests, via profil user pour les connectés
        let needsAcceptance = true;
        if (user) {
          const freshUser = await base44.auth.me();
          const acceptedVersion = freshUser?.privacy_policy_accepted_version;
          needsAcceptance = !acceptedVersion || acceptedVersion !== activePolicy.version;
        } else {
          const guestAcceptances = JSON.parse(localStorage.getItem('privacyPolicyAcceptances') || '{}');
          needsAcceptance = guestAcceptances['guest'] !== activePolicy.version;
        }

        if (!isControlled && needsAcceptance) {
          setInternalOpen(true);
        }
        if (isControlled && !needsAcceptance && openProp) {
          onClose?.();
        }
      } catch (e) {
        console.error('Erreur chargement politique:', e);
      }
    };

    checkPolicy();
  }, [storageKey, openProp]);

  const handleRefuse = () => {
    if (user) {
      base44.auth.logout();
    } else {
      window.location.href = 'about:blank';
    }
  };

  const handleAccept = async () => {
    if (!policy) return;
    setAccepting(true);
    try {
      if (user) {
        await base44.auth.updateMe({
          privacy_policy_accepted_version: policy.version,
          privacy_policy_accepted_at: new Date().toISOString()
        });
      } else {
        // Sauvegarder en localStorage pour les visiteurs
        const guestAcceptances = JSON.parse(localStorage.getItem('privacyPolicyAcceptances') || '{}');
        guestAcceptances['guest'] = policy.version;
        localStorage.setItem('privacyPolicyAcceptances', JSON.stringify(guestAcceptances));
      }
      if (isControlled) {
        onClose?.();
      } else {
        setInternalOpen(false);
      }
    } catch (e) {
      console.error('Erreur acceptation:', e);
    } finally {
      setAccepting(false);
    }
  };

  if (!policy || !open) return null;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-lg max-h-[70vh] flex flex-col p-0"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        hideCloseButton
      >
        <DialogHeader className="px-6 py-4 border-b border-slate-200">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            Politique de confidentialité
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4" style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}>
          <div className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">
            {policy.content}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 space-y-3">
          <div className="flex items-start gap-3">
            <Checkbox
              id="accept-privacy"
              checked={accepted}
              onCheckedChange={setAccepted}
              className="mt-1"
            />
            <label
              htmlFor="accept-privacy"
              className="text-sm text-slate-600 cursor-pointer leading-relaxed"
            >
              J'accepte la politique de confidentialité et consens au traitement de mes données personnelles.
            </label>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleRefuse}
              variant="outline"
              className="flex-1 h-10 text-sm rounded-xl font-semibold border-red-300 text-red-600 hover:bg-red-50"
            >
              Refuser
            </Button>
            <Button
              onClick={handleAccept}
              disabled={!accepted || accepting}
              style={{ backgroundColor: accepted ? '#008000' : '#94a3b8' }}
              className="flex-1 h-10 text-sm text-white font-semibold rounded-xl hover:opacity-90 disabled:cursor-not-allowed"
            >
              {accepting ? 'Enregistrement...' : "J'accepte"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}