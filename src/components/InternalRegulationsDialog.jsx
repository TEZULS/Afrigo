import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import ReactMarkdown from 'react-markdown';

export default function InternalRegulationsDialog({ user, open, onClose }) {
  const [accepted, setAccepted] = useState(false);

  const { data: regulations = [] } = useQuery({
    queryKey: ['internalRegulations'],
    queryFn: () => base44.entities.InternalRegulations.list(),
    select: (data) => data.filter(r => r.is_active).sort((a, b) => b.version - a.version),
  });

  const activeRegulation = regulations[0];

  useEffect(() => {
    setAccepted(false);
  }, [activeRegulation?.id]);

  // Clé unique : email si connecté, sinon "guest"
  const storageKey = user?.email || 'guest';

  // Si pas de règlement actif ou déjà accepté, appeler onClose pour passer à l'étape suivante
  useEffect(() => {
    if (!open) return;
    if (regulations.length === 0) return; // Pas encore chargé
    
    if (!activeRegulation) {
      onClose();
      return;
    }

    const userAcceptances = JSON.parse(localStorage.getItem('regulationsAcceptances') || '{}');
    const userAcceptance = userAcceptances[storageKey];
    const hasAcceptedThisVersion =
      userAcceptance?.regulationVersion === activeRegulation.version &&
      userAcceptance?.regulationId === activeRegulation.id;

    if (hasAcceptedThisVersion) {
      onClose();
    }
  }, [open, activeRegulation, regulations.length, storageKey]);

  const handleAccept = () => {
    if (!activeRegulation) return;
    const userAcceptances = JSON.parse(localStorage.getItem('regulationsAcceptances') || '{}');
    userAcceptances[storageKey] = {
      regulationVersion: activeRegulation.version,
      regulationId: activeRegulation.id,
      acceptedAt: new Date().toISOString(),
    };
    localStorage.setItem('regulationsAcceptances', JSON.stringify(userAcceptances));
    onClose();
  };

  const handleRefuse = () => {
    if (user) {
      base44.auth.logout();
    } else {
      window.location.href = 'about:blank';
    }
  };

  // Déterminer si on doit afficher le dialog
  const userAcceptances = JSON.parse(localStorage.getItem('regulationsAcceptances') || '{}');
  const userAcceptance = userAcceptances[storageKey];
  const hasAcceptedThisVersion =
    activeRegulation &&
    userAcceptance?.regulationVersion === activeRegulation.version &&
    userAcceptance?.regulationId === activeRegulation.id;

  const shouldShow = open && activeRegulation && !hasAcceptedThisVersion;

  return (
    <Dialog open={shouldShow} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-lg max-h-[70vh] flex flex-col p-0"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        hideCloseButton
      >
        <DialogHeader className="px-6 py-4 border-b border-slate-200">
          <DialogTitle className="text-lg font-bold">
            {activeRegulation?.title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4" style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}>
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown>{activeRegulation?.content}</ReactMarkdown>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-slate-200 space-y-3">
          <div className="flex items-start gap-3">
            <Checkbox
              id="accept-regulations"
              checked={accepted}
              onCheckedChange={setAccepted}
              className="mt-1"
            />
            <label
              htmlFor="accept-regulations"
              className="text-sm text-slate-600 cursor-pointer leading-relaxed"
            >
              J'accepte les conditions du règlement intérieur et je comprends que je dois les respecter pour utiliser cette plateforme.
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
             disabled={!accepted}
             style={{ backgroundColor: accepted ? '#008000' : '#94a3b8' }}
             className="flex-1 h-10 text-sm text-white rounded-xl font-semibold hover:opacity-90 disabled:cursor-not-allowed"
            >
             J'accepte
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}