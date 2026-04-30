import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function UpdatePrompt() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleUpdate = (registration) => {
      if (registration.waiting) {
        setWaitingWorker(registration.waiting);
        setShowUpdate(true);
      }
    };

    navigator.serviceWorker.ready.then((registration) => {
      // Déjà un worker en attente
      if (registration.waiting) {
        setWaitingWorker(registration.waiting);
        setShowUpdate(true);
      }

      // Écouter les nouvelles mises à jour
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingWorker(newWorker);
            setShowUpdate(true);
          }
        });
      });
    });

    // Vérifier périodiquement s'il y a une mise à jour
    const interval = setInterval(() => {
      navigator.serviceWorker.ready.then((reg) => reg.update());
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const handleUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
    window.location.reload();
  };

  return (
    <AnimatePresence>
      {showUpdate && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm"
        >
          <div className="bg-white border border-orange-200 rounded-2xl shadow-xl p-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-800 text-sm">Nouvelle version disponible</p>
              <p className="text-xs text-slate-500">Mettez à jour pour profiter des dernières améliorations</p>
            </div>
            <Button
              onClick={handleUpdate}
              size="sm"
              className="shrink-0 rounded-xl"
              style={{ backgroundColor: '#FF8C00' }}
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Mettre à jour
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}