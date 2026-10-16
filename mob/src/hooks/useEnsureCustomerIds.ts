import { useEffect } from 'react';
import { getBase44 } from '@/api/base44Client';
import { PromoCode } from '@/api/entities';
import { useAuth } from '@/lib/AuthContext';

/**
 * Identifiant client (`CL` + 6 chiffres) et code de parrainage (`REF` + 6
 * caractères) : rien ne les crée à l'inscription, c'est le site qui les
 * attribue à la première visite de l'accueil ou du profil. L'app fait
 * désormais pareil — sans cela, un client inscrit depuis l'app voyait « … »
 * à la place de son identifiant.
 *
 * Même logique que le composant du site (bundle publié, 2026-09-25) : après
 * 2 s, on complète ce qui manque via `auth.updateMe`, et un nouveau code de
 * parrainage crée le `PromoCode` associé (-10 %).
 */

/** Délai avant génération (celui du site) : laisse l'inscription finir d'écrire le profil. */
const GENERATION_DELAY_MS = 2000;

/** Génération en cours par compte : l'accueil et le profil montés ensemble ne créent pas deux codes. */
const inFlight = new Set<string>();

export const generateCustomerId = (): string =>
  `CL${Math.floor(100000 + Math.random() * 900000)}`;

export const generateReferralCode = (): string =>
  `REF${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

export const useEnsureCustomerIds = (): void => {
  const { user, refreshUser } = useAuth();
  const email = user?.email;
  const hasCustomerId = Boolean(user?.customer_id);
  const hasReferralCode = Boolean(user?.['referral_code']);

  useEffect(() => {
    if (!email || (hasCustomerId && hasReferralCode) || inFlight.has(email)) return;
    const timer = setTimeout(async () => {
      if (inFlight.has(email)) return;
      inFlight.add(email);
      try {
        const patch: { customer_id?: string; referral_code?: string } = {};
        if (!hasCustomerId) patch.customer_id = generateCustomerId();
        if (!hasReferralCode) patch.referral_code = generateReferralCode();
        await getBase44().auth.updateMe(patch as Record<string, unknown>);
        if (patch.referral_code) {
          await PromoCode()
            .create?.({
              code: patch.referral_code,
              owner_email: email,
              discount_type: 'percentage',
              discount_value: 10,
            })
            ?.catch(() => {});
        }
        await refreshUser();
      } catch {
        // Réessai à la prochaine ouverture de l'accueil ou du profil.
      } finally {
        inFlight.delete(email);
      }
    }, GENERATION_DELAY_MS);
    return () => clearTimeout(timer);
  }, [email, hasCustomerId, hasReferralCode, refreshUser]);
};
