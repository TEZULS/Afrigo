/**
 * Portefeuille client (`User.wallet_balance` + journal `WalletTransaction`).
 *
 * Même mécanique que le web déployé : le solde vit sur l'utilisateur
 * (`auth.updateMe`) et chaque mouvement est tracé dans `WalletTransaction`.
 * Le débit d'une commande n'est effectué qu'au moment où l'argent est
 * réellement engagé : à la création pour un paiement à la livraison ou une
 * commande entièrement couverte par le portefeuille, **après** la confirmation
 * Stripe pour un paiement carte (sinon un paiement refusé laissait le
 * portefeuille débité sans commande).
 */

import { getBase44 } from '@/api/base44Client';
import { WalletTransaction } from '@/api/entities';
import { round2 } from '@/utils/checkoutMath';

interface DebitParams {
  email: string;
  /** Solde connu côté app — utilisé si le rechargement du profil échoue. */
  knownBalance: number;
  amount: number;
  orderId: string;
}

/** Solde frais du serveur, pour ne pas écraser un crédit reçu entre-temps. */
const fetchCurrentBalance = async (fallback: number): Promise<number> => {
  try {
    const me = (await getBase44().auth.me()) as { wallet_balance?: number } | null;
    const fresh = Number(me?.wallet_balance);
    return Number.isFinite(fresh) ? fresh : fallback;
  } catch {
    return fallback;
  }
};

/**
 * Débite le portefeuille pour une commande. Renvoie le nouveau solde, ou
 * `null` si rien n'a été prélevé (montant nul).
 */
export const debitWalletForOrder = async ({
  email,
  knownBalance,
  amount,
  orderId,
}: DebitParams): Promise<number | null> => {
  const debit = round2(amount);
  if (debit <= 0) return null;
  const current = await fetchCurrentBalance(knownBalance);
  const newBalance = Math.max(0, round2(current - debit));
  await getBase44().auth.updateMe({ wallet_balance: newBalance } as Record<string, unknown>);
  await WalletTransaction()
    .create?.({
      customer_email: email,
      amount: debit,
      type: 'debit',
      reason: `Paiement commande #${orderId.slice(-8)}`,
    })
    .catch(() => {
      /* journal indisponible : le solde est déjà à jour */
    });
  return newBalance;
};
