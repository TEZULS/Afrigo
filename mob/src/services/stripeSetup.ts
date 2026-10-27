/**
 * Stripe dans l'app (2026-10-27).
 *
 * La clé publique est celle que l'admin saisit sur base44 (page « Paiement »,
 * `AppSettings.stripe_publishable_key`), comme sur le site : elle va toujours
 * avec la clé secrète qu'utilise `createPaymentIntent` (test ou réel). Avant,
 * l'app ne lisait que `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` du fichier `.env`
 * local, absent des builds EAS : sur les versions des stores, le paiement par
 * carte échouait d'office et la commande était annulée. Cette variable ne sert
 * plus que de secours (build de développement).
 */
import { initStripe } from '@stripe/stripe-react-native';
import { AppSettings } from '@/api/entities';
import { env } from '@/config/env';

/** Vraie clé publique Stripe (les valeurs d'exemple font planter le SDK natif sur Android). */
export const isStripePublishableKey = (key: unknown): key is string =>
  typeof key === 'string' && /^pk_(test|live)_[A-Za-z0-9]{20,}$/.test(key.trim());

/** Clé à utiliser : celle de l'admin, sinon celle du build, sinon aucune. */
export const pickStripePublishableKey = (
  adminKey: unknown,
  buildKey: string = env.stripe.publishableKey,
): string | null => {
  if (isStripePublishableKey(adminKey)) return adminKey.trim();
  return isStripePublishableKey(buildKey) ? buildKey.trim() : null;
};

let initializedKey: string | null = null;

/**
 * Prépare Stripe juste avant un paiement, avec la clé lue à l'instant (l'admin
 * peut passer du mode test au mode réel). `false` si aucune clé n'est configurée.
 */
export const ensureStripeReady = async (): Promise<boolean> => {
  let adminKey: unknown;
  try {
    const settings = (await AppSettings().list?.()) as { stripe_publishable_key?: unknown }[] | undefined;
    adminKey = settings?.[0]?.stripe_publishable_key;
  } catch {
    adminKey = undefined;
  }
  const key = pickStripePublishableKey(adminKey);
  if (!key) return false;
  if (key !== initializedKey) {
    await initStripe({
      publishableKey: key,
      merchantIdentifier: env.stripe.merchantId,
      urlScheme: 'afrigo',
    });
    initializedKey = key;
  }
  return true;
};

/** Tests uniquement : oublie la clé déjà chargée. */
export const resetStripeSetupForTests = () => {
  initializedKey = null;
};
