import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { navigationRef, openedFromPushRecently } from '@/navigation/navigationRef';
import { useMenuDrawer } from '@/stores/menuDrawer';
import { isCardPaymentInProgress } from '@/services/cardPayment';

/** Absence (app hors premier plan) à partir de laquelle on repart de l'accueil. */
export const RESUME_REFRESH_AFTER_MS = 5 * 60 * 1000;
/** Battement de l'app au premier plan : mesure la dernière activité réelle. */
const HEARTBEAT_MS = 10_000;

/** Écran jamais quitté d'office : la connexion. */
const PROTECTED_ROUTES = new Set(['Login']);
/** Espaces admin et livreur : non concernés. */
const NON_CLIENT_ROOTS = new Set(['AdminLogin', 'AdminDrawer', 'DelivererStack']);

/**
 * Faut-il repartir de l'accueil au retour dans l'app ? Jamais pendant un
 * paiement par carte : la banque peut le faire valider dans son app.
 */
export const shouldResetOnResume = (
  awayMs: number,
  rootRoute: string | undefined,
  currentRoute: string | undefined,
): boolean =>
  awayMs >= RESUME_REFRESH_AFTER_MS &&
  !NON_CLIENT_ROOTS.has(rootRoute ?? '') &&
  !PROTECTED_ROUTES.has(currentRoute ?? '') &&
  !isCardPaymentInProgress();

/**
 * Retour dans l'app après au moins 5 minutes passées ailleurs : l'app se
 * rafraîchit et ramène le client sur l'accueil, et non là où il était
 * (demandes des 2026-09-28 et 2026-09-30). Les données sont relues ; un
 * paiement ou une connexion en cours ne sont jamais interrompus.
 *
 * L'absence se mesure depuis le **dernier battement** de l'app au premier
 * plan, pas depuis l'événement « arrière-plan » : iOS suspend l'app presque
 * aussitôt et cet événement peut n'être traité qu'au retour — l'absence
 * mesurée tombait alors à zéro et l'app restait sur l'écran quitté.
 */
export const ResumeRefresh: React.FC = () => {
  const queryClient = useQueryClient();
  const lastActiveAt = useRef(Date.now());

  /** Appelé dès que l'app est (de nouveau) au premier plan. */
  const onForeground = useCallback(() => {
    const now = Date.now();
    const awayMs = now - lastActiveAt.current;
    lastActiveAt.current = now;
    if (!navigationRef.isReady()) return;

    const root = navigationRef.getRootState();
    const rootRoute = root?.routes?.[root.index ?? 0]?.name;
    const currentRoute = navigationRef.getCurrentRoute()?.name;
    if (!shouldResetOnResume(awayMs, rootRoute, currentRoute)) return;
    // Ouverte en appuyant sur une notification : on reste sur l'écran qu'elle ouvre.
    if (openedFromPushRecently()) {
      void queryClient.invalidateQueries();
      return;
    }

    useMenuDrawer.getState().close();
    navigationRef.reset({
      index: 0,
      routes: [{ name: 'ClientTabs', params: { screen: 'HomeTab' } }],
    });
    void queryClient.invalidateQueries();
  }, [queryClient]);

  useEffect(() => {
    // Battement : uniquement au premier plan. Un minuteur rattrapé au réveil
    // voit lui aussi le trou, d'où le même contrôle.
    const beat = setInterval(() => {
      if (AppState.currentState === 'active') onForeground();
    }, HEARTBEAT_MS);
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') onForeground();
    });
    return () => {
      clearInterval(beat);
      sub.remove();
    };
  }, [onForeground]);

  return null;
};
