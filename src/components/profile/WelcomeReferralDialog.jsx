import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Gift, Sparkles, AlertCircle, ThumbsUp } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';

export default function WelcomeReferralDialog({ user, open, onClose }) {
  const [referralInput, setReferralInput] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const queryClient = useQueryClient();

  // Vérifier si un code de parrainage est dans l'URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode) {
      setReferralInput(refCode.toUpperCase());
    }
  }, []);

  const { data: referralSettings = [] } = useQuery({
    queryKey: ['referral-settings'],
    queryFn: () => base44.entities.ReferralSettings.list()
  });

  const settings = referralSettings.length > 0 ? referralSettings[0] : {
    referrer_bonus: 10,
    referred_bonus: 5,
    is_active: true
  };

  const applyReferralMutation = useMutation({
    mutationFn: async (code) => {
      if (!settings.is_active) {
        throw new Error('Le programme de parrainage est temporairement indisponible');
      }

      const promoCodes = await base44.entities.PromoCode.filter({ code: code.toUpperCase() });
      if (promoCodes.length === 0) {
        throw new Error('Code invalide');
      }
      
      const promoCode = promoCodes[0];
      
      if (promoCode.owner_email === user.email) {
        throw new Error('Vous ne pouvez pas utiliser votre propre code');
      }

      // Vérifier la limite de parrainages du parrain
      const allUsers = await base44.entities.User.list();
      const referredByReferrer = allUsers.filter(u => u.referred_by === promoCode.owner_email);
      if (referredByReferrer.length >= (settings.max_referrals_per_user || 2)) {
        throw new Error('Ce code a atteint sa limite d\'utilisations');
      }
      
      await base44.auth.updateMe({ 
        referred_by: promoCode.owner_email,
        wallet_balance: (user.wallet_balance || 0) + settings.referred_bonus
      });
      
      const referrer = await base44.entities.User.filter({ email: promoCode.owner_email });
      if (referrer.length > 0) {
        await base44.entities.User.update(referrer[0].id, {
          wallet_balance: (referrer[0].wallet_balance || 0) + settings.referrer_bonus
        });
        
        await base44.entities.WalletTransaction.create({
          customer_email: user.email,
          amount: settings.referred_bonus,
          type: 'credit',
          reason: 'Bonus de bienvenue (parrainage)',
          admin_email: 'system'
        });
        
        await base44.entities.WalletTransaction.create({
          customer_email: promoCode.owner_email,
          amount: settings.referrer_bonus,
          type: 'credit',
          reason: `Bonus parrainage - ${user.email}`,
          admin_email: 'system'
        });
      }
      
      await base44.entities.PromoCode.update(promoCode.id, {
        usage_count: (promoCode.usage_count || 0) + 1,
        referral_bonus_credited: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      setShowSuccess(true);
      toast.success(`Code appliqué ! ${settings.referred_bonus}€ ajoutés à votre portefeuille 🎉`);
      setTimeout(() => {
        onClose();
        setShowSuccess(false);
      }, 2000);
    },
    onError: (error) => {
      setErrorMessage(error.message || 'Le code est invalide');
      toast.error(error.message || 'Le code est invalide');
      setTimeout(() => setErrorMessage(''), 4000);
    }
  });

  const handleApply = () => {
    if (referralInput.trim()) {
      setErrorMessage('');
      applyReferralMutation.mutate(referralInput.trim());
    }
  };

  const handleSkip = () => {
    // Marquer comme vu pour ne plus afficher le popup
    base44.auth.updateMe({ has_seen_referral_dialog: true });
    onClose();
  };

  // Ne pas afficher le dialog si le système de parrainage est désactivé
  if (!settings.is_active) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Gift className="w-8 h-8 text-white" />
          </div>
          <DialogTitle className="text-center text-2xl">Bienvenue sur AfriGo !</DialogTitle>
          <DialogDescription className="text-center">
            Avez-vous un code de parrainage ?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="bg-emerald-50 rounded-xl p-4 text-center">
            <Sparkles className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-emerald-900">
              Entrez le code d'un ami et recevez <span className="font-bold">{settings.referred_bonus}€</span> sur votre portefeuille
            </p>
            <p className="text-xs text-emerald-700 mt-2">
              💰 Ce crédit sera utilisable uniquement pour vos achats sur AfriGo
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-800">
              Chaque client peut parrainer jusqu'à <strong>{settings.max_referrals_per_user || 2} personnes</strong> maximum
            </p>
          </div>

          <div className="space-y-2">
            <Label>Code de parrainage (optionnel)</Label>
            <Input
              value={referralInput}
              onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
              placeholder="REFXXXXXX"
              className="h-12 rounded-xl font-mono text-center text-lg"
            />
            {errorMessage && (
              <div className="bg-rose-50 border border-rose-300 rounded-lg p-3 text-center animate-in fade-in duration-300">
                <p className="text-sm font-medium text-rose-700">{errorMessage}</p>
              </div>
            )}
          </div>

          {showSuccess ? (
            <div className="bg-emerald-50 border-2 border-emerald-500 rounded-xl p-6 text-center animate-in fade-in zoom-in duration-300">
              <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <ThumbsUp className="w-8 h-8 text-white" />
              </div>
              <p className="text-lg font-bold text-emerald-700">Code validé !</p>
              <p className="text-sm text-emerald-600 mt-1">{settings.referred_bonus}€ ajoutés à votre portefeuille</p>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button
                onClick={handleSkip}
                variant="outline"
                className="flex-1 h-12 rounded-xl"
              >
                Passer
              </Button>
              <Button
                onClick={handleApply}
                disabled={!referralInput.trim() || applyReferralMutation.isPending}
                className="flex-1 h-12 bg-emerald-500 hover:bg-emerald-600 rounded-xl"
              >
                {applyReferralMutation.isPending ? 'Vérification...' : 'Appliquer'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}