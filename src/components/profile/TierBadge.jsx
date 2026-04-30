import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { motion } from 'framer-motion';

export default function TierBadge({ tier, tierBenefit }) {
  const [open, setOpen] = useState(false);

  const tierConfig = {
    normal: {
      label: 'Normal',
      emoji: '🏅',
      filter: 'grayscale(100%)',
      bgColor: 'bg-slate-100',
      textColor: 'text-slate-700'
    },
    argent: {
      label: 'Argent',
      emoji: '🏅',
      filter: 'grayscale(100%) brightness(1.2)',
      bgColor: 'bg-slate-200',
      textColor: 'text-slate-800'
    },
    or: {
      label: 'Or',
      emoji: '🏅',
      filter: 'none',
      bgColor: 'bg-amber-100',
      textColor: 'text-amber-700'
    },
    diamant: {
      label: 'Diamant',
      emoji: '💎',
      filter: 'none',
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-700'
    }
  };

  const config = tierConfig[tier] || tierConfig.normal;

  if (tier === 'normal') return null;

  return (
    <>
      <motion.button
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="inline-block"
      >
        <Badge 
          className={`${config.bgColor} ${config.textColor} px-4 py-2 text-sm font-semibold rounded-xl cursor-pointer hover:shadow-lg transition-all`}
        >
          <span className="text-lg mr-2" style={{ filter: config.filter }}>{config.emoji}</span>
          {config.label}
        </Badge>
      </motion.button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${config.bgColor}`}>
                <span className="text-3xl" style={{ filter: config.filter }}>{config.emoji}</span>
              </div>
              {tierBenefit?.title || config.label}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-6">
              <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <span className="text-xl" style={{ filter: config.filter }}>{config.emoji}</span>
                Vos avantages exclusifs
              </h3>
              <div className="text-slate-700 whitespace-pre-line leading-relaxed">
                {tierBenefit?.description || 'Aucun avantage spécifique défini pour ce niveau.'}
              </div>
            </div>
            
            <div className="text-center text-sm text-slate-500">
              Continuez vos achats pour maintenir votre statut privilégié !
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}