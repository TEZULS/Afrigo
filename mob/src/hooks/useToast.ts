import { Alert } from 'react-native';

/**
 * Durée d'affichage d'une notification in-app (ms), fin d'animation comprise.
 */
export const TOAST_VISIBILITY_TIME = 3000;

export type ToastType = 'success' | 'info';

export interface ToastState {
  /** Change à chaque `show` : permet à l'hôte de rejouer l'animation. */
  id: number;
  type: ToastType;
  text1: string;
  text2?: string;
}

type Listener = (state: ToastState | null) => void;

/*
  Store minimaliste plutôt que `react-native-toast-message`.

  La librairie garde le bandeau monté en permanence et ne joue que sur
  l'opacité/translation via `Animated`. Sur la New Architecture, quand
  l'animation de sortie n'est pas rejouée (ressort natif interrompu, geste de
  pan resté « actif »…), la vue reste visible à l'écran alors que l'état interne
  la croit masquée — et plus aucun appel à `hide()` n'y change quoi que ce soit.
  C'est le bug « la notification reste affichée » remonté par les clients.

  Ici l'état fait autorité : quand le minuteur expire, l'état repasse à `null`
  et `ToastHost` retourne `null` — le bandeau est démonté, pas seulement rendu
  transparent. Une notification ne peut donc pas rester collée à l'écran.
*/
let current: ToastState | null = null;
let nextId = 1;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();

const emit = () => {
  for (const listener of listeners) listener(current);
};

const clearTimer = () => {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
};

/** État courant, pour l'hydratation initiale de l'hôte. */
export const getToastState = (): ToastState | null => current;

/** S'abonne aux changements. Retourne la fonction de désabonnement. */
export const subscribeToast = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Masque immédiatement la notification courante (tap, navigation, erreur…). */
export const hideToast = () => {
  clearTimer();
  if (current === null) return;
  current = null;
  emit();
};

const show = (type: ToastType, text1: string, text2?: string) => {
  clearTimer();
  current = { id: nextId++, type, text1, text2 };
  emit();
  // Éphémère par construction : le minuteur ne dépend d'aucun callback
  // d'animation, il ne peut donc pas être « oublié ».
  timer = setTimeout(hideToast, TOAST_VISIBILITY_TIME);
};

/**
 * Les erreurs passent par une alerte système centrée, fermée par un bouton
 * « OK » : un message d'erreur doit être lu et acquitté, et une alerte native
 * s'affiche aussi au-dessus des écrans présentés en `modal`.
 */
const showError = (text1: string, text2?: string) => {
  hideToast();
  Alert.alert(text1, text2, [{ text: 'OK', style: 'default' }], { cancelable: true });
};

export const toast = {
  success: (text1: string, text2?: string) => show('success', text1, text2),
  error: showError,
  info: (text1: string, text2?: string) => show('info', text1, text2),
  hide: hideToast,
};

export const useToast = () => toast;

/** Réinitialisation complète — réservé aux tests. */
export const __resetToastForTests = () => {
  clearTimer();
  current = null;
  listeners.clear();
  nextId = 1;
};
