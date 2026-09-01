import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, type LayoutChangeEvent, type ScrollView } from 'react-native';

/** Marge conservée au-dessus du champ remonté, pour laisser voir son libellé. */
export const FIELD_SCROLL_MARGIN = 28;

/**
 * Délai avant de scroller quand le clavier est déjà ouvert (passage d'un champ
 * à l'autre) : laisse React appliquer le layout du champ nouvellement focus.
 */
const FOCUS_SCROLL_DELAY = 60;

export interface KeyboardAwareFields {
  /** Hauteur du clavier visible (0 s'il est fermé). */
  keyboardHeight: number;
  /** `onLayout` du conteneur qui englobe tous les champs. */
  onContainerLayout: (e: LayoutChangeEvent) => void;
  /** `onLayout` d'un champ, identifié par une clé stable. */
  onFieldLayout: (key: string) => (e: LayoutChangeEvent) => void;
  /** `onFocus` d'un champ : mémorise le champ actif et le remonte. */
  onFieldFocus: (key: string) => () => void;
  /** Force la remontée du champ actif (utile après un changement de contenu). */
  scrollToFocusedField: () => void;
}

/**
 * Garde le champ en cours de saisie visible au-dessus du clavier.
 *
 * Le point clé est le **moment** du défilement. Scroller depuis le seul
 * `onFocus` ne suffit pas : à cet instant le clavier n'est pas encore déployé,
 * la zone scrollable n'a donc pas encore été agrandie et `scrollTo` est borné à
 * l'ancienne hauteur — le champ reste collé sous le clavier, exactement le
 * symptôme observé sur les derniers champs de l'inscription (Ville, Code
 * postal, Adresse). On rejoue donc le défilement sur `keyboardDidShow` et sur
 * les changements de hauteur du clavier (bascule pavé numérique ↔ alphabétique,
 * barre de suggestions), une fois la géométrie définitive connue.
 */
export function useKeyboardAwareFields(
  scrollRef: React.RefObject<ScrollView | null>,
): KeyboardAwareFields {
  const containerTop = useRef(0);
  const offsets = useRef<Record<string, number>>({});
  const focusedKey = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const scrollToFocusedField = useCallback(() => {
    const key = focusedKey.current;
    if (!key) return;
    const y = offsets.current[key];
    if (y == null) return;
    scrollRef.current?.scrollTo({
      y: Math.max(0, containerTop.current + y - FIELD_SCROLL_MARGIN),
      animated: true,
    });
  }, [scrollRef]);

  const scheduleScroll = useCallback(
    (delay: number) => {
      clearTimer();
      timer.current = setTimeout(() => {
        timer.current = null;
        scrollToFocusedField();
      }, delay);
    },
    [scrollToFocusedField],
  );

  useEffect(() => {
    // `Did*` et non `Will*` : on veut la hauteur définitive du clavier.
    const subs = [
      Keyboard.addListener('keyboardDidShow', (e) => {
        setKeyboardHeight(e.endCoordinates?.height ?? 0);
        scheduleScroll(0);
      }),
      Keyboard.addListener('keyboardDidHide', () => {
        setKeyboardHeight(0);
        focusedKey.current = null;
        clearTimer();
      }),
    ];
    if (Platform.OS === 'ios') {
      // Bascule pavé numérique ↔ alphabétique, barre de suggestions… : la
      // hauteur change sans nouvel événement `keyboardDidShow`.
      subs.push(
        Keyboard.addListener('keyboardDidChangeFrame', (e) => {
          setKeyboardHeight(e.endCoordinates?.height ?? 0);
          scheduleScroll(0);
        }),
      );
    }
    return () => {
      clearTimer();
      subs.forEach((s) => s.remove());
    };
  }, [scheduleScroll]);

  const onContainerLayout = useCallback((e: LayoutChangeEvent) => {
    containerTop.current = e.nativeEvent.layout.y;
  }, []);

  const onFieldLayout = useCallback(
    (key: string) => (e: LayoutChangeEvent) => {
      offsets.current[key] = e.nativeEvent.layout.y;
    },
    [],
  );

  const onFieldFocus = useCallback(
    (key: string) => () => {
      focusedKey.current = key;
      // Clavier déjà ouvert : aucun `keyboardDidShow` ne viendra, on scrolle ici.
      scheduleScroll(FOCUS_SCROLL_DELAY);
    },
    [scheduleScroll],
  );

  return {
    keyboardHeight,
    onContainerLayout,
    onFieldLayout,
    onFieldFocus,
    scrollToFocusedField,
  };
}
