import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';

export default function WelcomeMessageDialog({ message, open, onClose, isGuest }) {
  useEffect(() => {
    if (open && message) {
      const dismissedMessages = JSON.parse(localStorage.getItem('dismissedWelcomeMessages') || '[]');
      if (!dismissedMessages.includes(message.id)) {
        localStorage.setItem('hasSeenWelcomeMessage', 'true');
      }
    }
  }, [open, message]);

  const handleClose = () => {
    if (message) {
      const dismissedMessages = JSON.parse(localStorage.getItem('dismissedWelcomeMessages') || '[]');
      if (!dismissedMessages.includes(message.id)) {
        dismissedMessages.push(message.id);
        localStorage.setItem('dismissedWelcomeMessages', JSON.stringify(dismissedMessages));
      }
    }
    onClose();
  };

  if (!message) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-orange-500" />
            </div>
            {message.title || 'Bienvenue'}
          </DialogTitle>
        </DialogHeader>
        
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="py-4"
        >
          <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
            {message.message}
          </p>
        </motion.div>

        <div className="flex gap-3">
          <Button
            onClick={handleClose}
            className="flex-1 h-12 bg-emerald-500 hover:bg-emerald-600 rounded-xl"
          >
            {isGuest ? (message.button_text_guest || "S'inscrire/Se connecter") : (message.button_text_registered || "J'ai compris")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}