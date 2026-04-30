import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Gift, Copy, Check, Users, AlertCircle, Share2, ThumbsUp } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';

export default function ReferralSection({ user }) {
  const [copied, setCopied] = useState(false);
  const [referralInput, setReferralInput] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const queryClient = useQueryClient();

  const { data: referralSettings = [] } = useQuery({
    queryKey: ['referral-settings'],
    queryFn: () => base44.entities.ReferralSettings.list()
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.list()
  });

  const settings = referralSettings.length > 0 ? referralSettings[0] : {
    referrer_bonus: 10,
    referred_bonus: 5,
    max_referrals_per_user: 2,
    is_active: true
  };

  const myReferralsCount = allUsers.filter(u => u.referred_by === user?.email).length;
  const remainingReferrals = (settings.max_referrals_per_user || 2) - myReferralsCount;

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
      const referredByReferrer = allUsers.filter(u => u.referred_by === promoCode.owner_email);
      if (referredByReferrer.length >= settings.max_referrals_per_user) {
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
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      setShowSuccess(true);
      toast.success(`Code appliqué ! ${settings.referred_bonus}€ ajoutés à votre portefeuille`);
      setTimeout(() => {
        setShowSuccess(false);
        setReferralInput('');
      }, 3000);
    },
    onError: (error) => {
      setErrorMessage(error.message || 'Le code est invalide');
      toast.error(error.message || 'Le code est invalide');
      setTimeout(() => setErrorMessage(''), 4000);
    }
  });

  const handleCopy = () => {
    if (user?.referral_code) {
      navigator.clipboard.writeText(user.referral_code);
      setCopied(true);
      toast.success('Code copié !');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleApplyCode = () => {
    if (referralInput.trim()) {
      setErrorMessage('');
      applyReferralMutation.mutate(referralInput.trim());
    }
  };

  const handleShare = () => {
    const appUrl = window.location.origin;
    const shareUrl = `${appUrl}?ref=${user.referral_code}`;
    const shareText = `Rejoins-moi sur AfriGo et reçois ${settings.referred_bonus}€ de bonus ! Utilise mon code: ${user.referral_code}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'AfriGo - Code de parrainage',
        text: shareText,
        url: shareUrl
      }).catch(() => {
        navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        toast.success('Lien de partage copié !');
      });
    } else {
      navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      toast.success('Lien de partage copié !');
    }
  };

  if (!user) return null;
  if (!settings.is_active) return null;

  return (
    <Card className="border-0 shadow-sm rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="w-5 h-5 text-emerald-500" />
          Parrainage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Mon code de parrainage */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              <h3 className="font-semibold text-slate-800">Mon code de parrainage</h3>
            </div>
            <Badge className="bg-emerald-600 text-white text-base font-bold px-4 py-1">
              {myReferralsCount}/{settings.max_referrals_per_user || 2}
            </Badge>
          </div>
          <p className="text-sm text-slate-600 mb-2">
            Partagez votre code et gagnez <strong>{settings.referrer_bonus}€</strong> pour chaque ami inscrit. Votre ami reçoit <strong>{settings.referred_bonus}€</strong> !
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mb-4">
            <p className="text-xs text-amber-800 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Vous pouvez parrainer jusqu'à <strong>{settings.max_referrals_per_user || 2} personnes</strong> maximum
            </p>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            💰 Les bonus sont crédités sur votre portefeuille et utilisables uniquement pour vos achats
          </p>
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={user.referral_code || ''}
                readOnly
                className="bg-white font-mono text-lg font-bold text-center"
              />
              <Button
                onClick={handleCopy}
                variant="outline"
                className="shrink-0"
                disabled={remainingReferrals <= 0}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <Button
              onClick={handleShare}
              className="w-full bg-emerald-500 hover:bg-emerald-600"
              disabled={remainingReferrals <= 0}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Partager avec mes amis
            </Button>
          </div>
          {remainingReferrals <= 0 && (
            <p className="text-xs text-rose-600 mt-2 text-center">
              Limite de parrainages atteinte
            </p>
          )}
        </div>

        {/* Utiliser un code de parrainage */}
        {(!user.referred_by || user.referred_by === 'skipped') && (
          <div className="border-t pt-6">
            {showSuccess ? (
              <div className="bg-emerald-50 border-2 border-emerald-500 rounded-xl p-6 text-center animate-in fade-in zoom-in duration-300">
                <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <ThumbsUp className="w-8 h-8 text-white" />
                </div>
                <p className="text-lg font-bold text-emerald-700">Code validé !</p>
                <p className="text-sm text-emerald-600 mt-1">{settings.referred_bonus}€ ajoutés à votre portefeuille</p>
              </div>
            ) : (
              <>
                <Label className="text-slate-700 mb-2 block">Vous avez un code de parrainage ?</Label>
                <p className="text-sm text-slate-500 mb-3">
                  Entrez le code d'un ami et recevez <strong>{settings.referred_bonus}€</strong> sur votre portefeuille (utilisable uniquement pour vos achats)
                </p>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={referralInput}
                      onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                      placeholder="REFXXXXXX"
                      className="font-mono"
                    />
                    <Button
                      onClick={handleApplyCode}
                      disabled={!referralInput.trim() || applyReferralMutation.isPending}
                      className="bg-emerald-500 hover:bg-emerald-600"
                    >
                      Appliquer
                    </Button>
                  </div>
                  {errorMessage && (
                    <div className="bg-rose-50 border border-rose-300 rounded-lg p-3 text-center animate-in fade-in duration-300">
                      <p className="text-sm font-medium text-rose-700">{errorMessage}</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {user.referred_by && user.referred_by !== 'skipped' && (
          <div className="bg-blue-50 rounded-xl p-4 text-center">
            <Check className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <p className="text-sm text-blue-800 font-medium">
              Vous avez été parrainé par un ami
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}