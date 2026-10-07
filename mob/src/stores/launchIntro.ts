import { create } from 'zustand';

/**
 * Animation d'ouverture (panier + « AfriGo ») : tant qu'elle joue, les
 * fenêtres modales (accord légal, message de bienvenue) attendent — une
 * `Modal` native s'afficherait sinon par-dessus l'animation.
 *
 * `done` vaut `true` par défaut : seul `App.tsx` déclare une animation en
 * cours au démarrage (les écrans testés isolément ne l'attendent donc pas).
 */
interface LaunchIntroState {
  done: boolean;
  start: () => void;
  finish: () => void;
}

export const useLaunchIntro = create<LaunchIntroState>((set) => ({
  done: true,
  start: () => set({ done: false }),
  finish: () => set({ done: true }),
}));
