import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '@/lib/AuthContext';
import { resetWhenReady } from '@/navigation/navigationRef';
import { hydrateKvFromDisk } from '@/services/storage';
import { returnDraftAwaitingCamera } from '@/utils/returnDraft';

/**
 * Android ferme parfois AfriGo pendant la prise de vue (l'appareil photo est
 * une autre application, gourmande en mémoire) : l'app redémarrait alors sur
 * l'accueil et la réclamation en cours « disparaissait ». Si l'appareil photo
 * venait d'être ouvert depuis le formulaire, on y retourne (commande →
 * réclamation) ; l'écran reprend le brouillon et la photo prise.
 */
export const ReturnDraftRestorer: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const checked = useRef(false);

  useEffect(() => {
    const email = user?.email;
    if (Platform.OS !== 'android' || checked.current || !isAuthenticated || !email) return;
    checked.current = true;
    void (async () => {
      await hydrateKvFromDisk();
      const draft = returnDraftAwaitingCamera(email);
      if (!draft) return;
      resetWhenReady({
        index: 2,
        routes: [
          { name: 'ClientTabs', params: { screen: 'OrdersTab' } },
          { name: 'OrderDetails', params: { id: draft.orderId } },
          { name: 'Returns', params: { orderId: draft.orderId } },
        ],
      });
    })();
  }, [isAuthenticated, user?.email]);

  return null;
};
