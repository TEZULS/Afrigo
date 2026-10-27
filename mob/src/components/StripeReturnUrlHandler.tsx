import { useEffect } from 'react';
import { Linking, Platform } from 'react-native';
import { handleURLCallback } from '@stripe/stripe-react-native';

/**
 * iPhone : certaines banques font valider le paiement (3-D Secure) sur une
 * page web, qui renvoie vers `afrigo://safepay/…` une fois validée. Ce lien
 * est rendu à Stripe, qui ferme la page et termine le paiement ; sans lui,
 * le client devait fermer la page lui-même. Les autres liens ne sont pas
 * concernés (la navigation les traite comme avant).
 */
export const StripeReturnUrlHandler: React.FC = () => {
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const sub = Linking.addEventListener('url', ({ url }) => {
      handleURLCallback(url).catch(() => false);
    });
    return () => sub.remove();
  }, []);
  return null;
};
