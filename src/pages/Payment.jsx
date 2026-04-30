import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CreditCard, Trash2, ArrowLeft, ShieldCheck, Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from '@stripe/react-stripe-js';

const cardElementOptions = {
  style: {
    base: { fontSize: '16px', color: '#1e293b', '::placeholder': { color: '#94a3b8' } },
  },
};

function NewCardForm({ onSaved, onCancel }) {
  const stripe = useStripe();
  const elements = useElements();
  const [cardholderName, setCardholderName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    if (!stripe || !elements || !cardholderName) return;
    setSaving(true);
    setError(null);

    const cardNumberElement = elements.getElement(CardNumberElement);

    const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardNumberElement,
      billing_details: { name: cardholderName },
    });

    if (pmError) {
      setError(pmError.message);
      setSaving(false);
      return;
    }

    await base44.functions.invoke('saveCard', { paymentMethodId: paymentMethod.id });
    toast.success('Nouvelle carte enregistrée avec succès');
    onSaved();
  };

  return (
    <div className="space-y-4 border border-slate-200 rounded-xl p-4 bg-slate-50">
      <div>
        <Label>Numéro de carte</Label>
        <div className="mt-1 p-3 border border-slate-200 rounded-xl bg-white">
          <CardNumberElement options={cardElementOptions} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Date d'expiration</Label>
          <div className="mt-1 p-3 border border-slate-200 rounded-xl bg-white">
            <CardExpiryElement options={cardElementOptions} />
          </div>
        </div>
        <div>
          <Label>CVV</Label>
          <div className="mt-1 p-3 border border-slate-200 rounded-xl bg-white">
            <CardCvcElement options={cardElementOptions} />
          </div>
        </div>
      </div>
      <div>
        <Label>Nom sur la carte</Label>
        <Input
          type="text"
          placeholder="Prénom Nom"
          value={cardholderName}
          onChange={(e) => setCardholderName(e.target.value.toUpperCase())}
          className="h-12 rounded-xl mt-1"
        />
      </div>
      {error && (
        <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">{error}</p>
      )}
      <div className="flex gap-3">
        <Button
          onClick={handleSave}
          disabled={saving || !cardholderName}
          className="flex-1 bg-emerald-500 hover:bg-emerald-600 rounded-xl"
        >
          {saving ? 'Enregistrement...' : 'Enregistrer cette carte'}
        </Button>
        <Button variant="outline" onClick={onCancel} className="rounded-xl">
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export default function Payment() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showNewCardForm, setShowNewCardForm] = useState(false);

  const { data: appSettings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const stripePublishableKey = appSettings[0]?.stripe_publishable_key;
  const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

  useEffect(() => {
    base44.auth.me()
      .then(setUser)
      .catch(() => base44.auth.redirectToLogin())
      .finally(() => setLoading(false));
  }, []);

  const savedCardInfo = user?.saved_card_info ? JSON.parse(user.saved_card_info) : null;
  const hasSavedCard = !!user?.saved_payment_method_id && !!savedCardInfo;

  const handleRemoveCard = async () => {
    setDeleting(true);
    await base44.functions.invoke('deleteCard', {});
    const updatedUser = await base44.auth.me();
    setUser(updatedUser);
    setDeleting(false);
    toast.success('Carte supprimée');
  };

  const handleCardSaved = async () => {
    const updatedUser = await base44.auth.me();
    setUser(updatedUser);
    setShowNewCardForm(false);
  };

  const brandLabel = (brand) => {
    const labels = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', discover: 'Discover' };
    return labels[brand?.toLowerCase()] || brand || 'Carte';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link to={createPageUrl('Home')} className="inline-flex items-center text-slate-600 hover:text-emerald-600 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Link>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="text-center mb-2">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CreditCard className="w-8 h-8 sm:w-10 sm:h-10 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Moyens de paiement</h1>
            <p className="text-slate-500">Gérez votre carte bancaire enregistrée</p>
          </div>

          {/* Carte enregistrée */}
          <Card className="border-0 shadow-lg rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-slate-600" />
                Ma carte enregistrée
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!hasSavedCard ? (
                <div className="text-center py-8">
                  <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium mb-2">Aucune carte enregistrée</p>
                  <p className="text-sm text-slate-400 max-w-xs mx-auto">
                    Enregistrez une carte ci-dessous ou cochez l'option lors de votre prochaine commande.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm">
                        <CreditCard className="w-6 h-6 text-slate-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 capitalize">
                          {brandLabel(savedCardInfo.brand)} •••• {savedCardInfo.last4}
                        </p>
                        <p className="text-sm text-slate-500">
                          Expire {String(savedCardInfo.exp_month).padStart(2, '0')}/{savedCardInfo.exp_year}
                        </p>
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium mt-1">
                          <ShieldCheck className="w-3 h-3" />
                          Carte par défaut
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleRemoveCard}
                      disabled={deleting}
                      className="text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                    >
                      {deleting ? (
                        <div className="w-4 h-4 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <p className="text-sm text-blue-700">
                      💡 Cette carte sera utilisée automatiquement lors de vos prochains paiements. Vous pouvez la remplacer par une autre carte ci-dessous.
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Ajouter / remplacer une carte */}
          {stripePublishableKey && (
            <Card className="border-0 shadow-lg rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Plus className="w-5 h-5 text-slate-600" />
                    {hasSavedCard ? 'Utiliser une autre carte' : 'Ajouter une carte'}
                  </div>
                  {!showNewCardForm && (
                    <Button
                      size="sm"
                      onClick={() => setShowNewCardForm(true)}
                      className="bg-emerald-500 hover:bg-emerald-600 rounded-xl"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      {hasSavedCard ? 'Changer de carte' : 'Ajouter'}
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AnimatePresence>
                  {showNewCardForm ? (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      {hasSavedCard && (
                        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                          ⚠️ En ajoutant une nouvelle carte, elle remplacera la carte actuellement enregistrée.
                        </p>
                      )}
                      <Elements stripe={stripePromise}>
                        <NewCardForm
                          onSaved={handleCardSaved}
                          onCancel={() => setShowNewCardForm(false)}
                        />
                      </Elements>
                    </motion.div>
                  ) : (
                    <p className="text-sm text-slate-400 text-center py-4">
                      {hasSavedCard
                        ? 'Cliquez sur "Changer de carte" pour enregistrer une nouvelle carte bancaire.'
                        : 'Cliquez sur "Ajouter" pour enregistrer une carte bancaire.'}
                    </p>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>
    </div>
  );
}