import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Download, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    // Vérifier si l'app est déjà installée
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches ||
                        window.navigator.standalone ||
                        localStorage.getItem('pwa-dismissed');

    if (isInstalled) {
      return;
    }

    // Écouter l'événement beforeinstallprompt
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setShowInstallBanner(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
    localStorage.setItem('pwa-dismissed', 'true');
  };

  if (!showInstallBanner) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg"
      >
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Download className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm md:text-base">
                  Téléchargez l'appli AfriGo
                </p>
                <p className="text-xs text-emerald-100">
                  Accédez rapidement à vos commandes
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleInstall}
                size="sm"
                className="bg-white text-emerald-600 hover:bg-emerald-50 rounded-xl font-semibold shadow-none"
              >
                <Download className="w-4 h-4 mr-2" />
                Télécharger l'appli
              </Button>
              <Button
                onClick={handleDismiss}
                size="icon"
                variant="ghost"
                className="text-white hover:bg-white/20 rounded-xl h-8 w-8"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}