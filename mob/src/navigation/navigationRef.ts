/**
 * Référence globale au NavigationContainer.
 *
 * Nécessaire pour naviguer depuis un contexte hors composant : ici, l'appui sur
 * une notification push reçue app fermée ou en arrière-plan.
 */
import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/** Navigue si le conteneur est monté, sinon ne fait rien (au lieu de crasher). */
export const navigateWhenReady = <T extends keyof RootStackParamList>(
  name: T,
  params?: RootStackParamList[T],
) => {
  if (!navigationRef.isReady()) return false;
  // @ts-expect-error — signature variadique de navigate() selon le param du screen
  navigationRef.navigate(name, params);
  return true;
};
