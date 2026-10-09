/**
 * Référence globale au NavigationContainer.
 *
 * Nécessaire pour naviguer depuis un contexte hors composant : ici, l'appui sur
 * une notification push reçue app fermée ou en arrière-plan.
 */
import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/** Navigation demandée avant que le conteneur soit prêt (démarrage à froid). */
let pending: (() => void) | null = null;

const go = <T extends keyof RootStackParamList>(name: T, params?: RootStackParamList[T]) => {
  // @ts-expect-error — signature variadique de navigate() selon le param du screen
  navigationRef.navigate(name, params);
};

/**
 * Navigue si le conteneur est monté ; sinon garde la demande (la dernière) et
 * l'exécute dès qu'il l'est (`flushPendingNavigation`, appelé par `onReady`).
 * Au démarrage à froid, le conteneur n'apparaît qu'après le chargement des
 * réglages et du profil : un appui sur une notification était alors perdu.
 */
export const navigateWhenReady = <T extends keyof RootStackParamList>(
  name: T,
  params?: RootStackParamList[T],
) => {
  if (!navigationRef.isReady()) {
    pending = () => go(name, params);
    return false;
  }
  go(name, params);
  return true;
};

/** Comme `navigateWhenReady`, en remplaçant toute la pile d'écrans. */
export const resetWhenReady = (state: Parameters<typeof navigationRef.reset>[0]) => {
  if (!navigationRef.isReady()) {
    pending = () => navigationRef.reset(state);
    return false;
  }
  navigationRef.reset(state);
  return true;
};

/** À appeler dans `NavigationContainer.onReady`. */
export const flushPendingNavigation = () => {
  const run = pending;
  pending = null;
  run?.();
};

/** Dernier appui sur une notification (voir ResumeRefresh). */
let lastPushOpenAt = 0;

export const markOpenedFromPush = () => {
  lastPushOpenAt = Date.now();
};

/**
 * L'app vient-elle d'être ouverte par une notification ? Le retour automatique
 * à l'accueil après 5 min d'absence ne doit pas écraser l'écran qu'elle ouvre.
 */
export const openedFromPushRecently = (withinMs = 5000) => Date.now() - lastPushOpenAt < withinMs;
