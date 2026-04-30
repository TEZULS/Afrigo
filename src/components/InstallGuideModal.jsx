import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Share, Plus, X, Download } from 'lucide-react';

export default function InstallGuideModal({ open, onClose, isIOS, isAndroid }) {
  if (isIOS) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-[90vw] sm:max-w-md max-h-[80vh] overflow-hidden p-0 gap-0">
          <div className="overflow-y-auto max-h-[80vh] px-4 py-3">
            <DialogHeader className="mb-2">
              <DialogTitle className="text-center text-base sm:text-lg">
                📱 Installer AfriGo sur iPhone
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-2">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-2">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                    1
                  </div>
                  <p className="font-semibold text-xs">Appuyez sur Partager</p>
                </div>
                <div className="bg-white rounded p-1.5 flex items-center justify-center gap-2 border border-orange-200">
                  <Share className="w-6 h-6 text-blue-500" />
                  <p className="text-[9px] text-slate-600">En bas de Safari</p>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-2">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                    2
                  </div>
                  <p className="font-semibold text-xs">Sur l'écran d'accueil</p>
                </div>
                <div className="bg-white rounded p-1.5 flex items-center justify-center gap-2 border border-green-200">
                  <Plus className="w-6 h-6 text-slate-700" />
                  <p className="text-[9px] text-slate-600">Add to Home Screen</p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                    3
                  </div>
                  <p className="font-semibold text-xs">Confirmez</p>
                </div>
                <div className="bg-white rounded p-1.5 text-center border border-blue-200">
                  <p className="text-[9px] text-slate-600">Appuyez sur "Ajouter"</p>
                </div>
              </div>

              <div className="text-center bg-gradient-to-r from-orange-100 to-green-100 rounded-lg p-1.5">
                <p className="text-[9px] font-medium text-slate-700">
                  ✨ L'app apparaîtra sur votre écran !
                </p>
              </div>
            </div>

            <Button
              onClick={onClose}
              className="w-full h-9 rounded-lg text-xs mt-3 mb-1"
              style={{ backgroundColor: '#008000' }}
            >
              J'ai compris !
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (isAndroid) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl">
              📱 Installer AfriGo sur Android
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                  1
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-lg mb-2">Appuyez sur le menu (⋮)</p>
                  <div className="bg-white rounded-xl p-4 text-center border-2 border-orange-300">
                    <p className="text-4xl mb-2">⋮</p>
                    <p className="text-sm text-slate-600">
                      (En haut à droite de Chrome)
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                  2
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-lg mb-2">Sélectionnez "Installer l'application"</p>
                  <div className="bg-white rounded-xl p-4 flex items-center justify-center border-2 border-green-300">
                    <Download className="w-12 h-12 text-green-600" />
                    <p className="ml-3 text-sm text-slate-600">
                      Install app
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center bg-gradient-to-r from-orange-100 to-green-100 rounded-2xl p-4">
              <p className="text-sm font-medium text-slate-700">
                ✨ L'application s'installera automatiquement sur votre téléphone !
              </p>
            </div>
          </div>

          <Button
            onClick={onClose}
            className="w-full h-12 rounded-xl text-lg"
            style={{ backgroundColor: '#008000' }}
          >
            J'ai compris !
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  // Desktop
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">
            💻 Installer AfriGo sur PC
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                1
              </div>
              <div className="flex-1">
                <p className="font-semibold text-lg mb-2">Ouvrez le menu du navigateur</p>
                <div className="bg-white rounded-xl p-4 text-center border-2 border-orange-300">
                  <p className="text-sm text-slate-600">
                    Cliquez sur les trois points (⋮) en haut à droite
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                2
              </div>
              <div className="flex-1">
                <p className="font-semibold text-lg mb-2">Cliquez sur "Installer AfriGo"</p>
                <div className="bg-white rounded-xl p-4 flex items-center justify-center border-2 border-green-300">
                  <Download className="w-12 h-12 text-green-600" />
                  <p className="ml-3 text-sm text-slate-600">
                    Installer l'application
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center bg-gradient-to-r from-orange-100 to-green-100 rounded-2xl p-4">
            <p className="text-sm font-medium text-slate-700">
              ✨ AfriGo s'ouvrira comme une application native sur votre ordinateur !
            </p>
          </div>
        </div>

        <Button
          onClick={onClose}
          className="w-full h-12 rounded-xl text-lg"
          style={{ backgroundColor: '#008000' }}
        >
          J'ai compris !
        </Button>
      </DialogContent>
    </Dialog>
  );
}