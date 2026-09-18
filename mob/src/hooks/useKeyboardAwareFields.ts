import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, type LayoutChangeEvent, type ScrollView } from 'react-native';

/** Marge conservée au-dessus du champ remonté, pour laisser voir son libellé. */
export const FIELD_SCROLL_MARGIN = 28;

/**
 * Délai avant de scroller quand le clavier est déjà ouvert (passage d'un champ
 * à l'autre) : laisse React appliquer le layout du champ nouvellement focus.
 */
const FOCUS_SCROLL_DELAY = 60;

/**
 * Rejeu tardif du défilement après `keyboardDidShow` : sur l'appareil, la
 * réserve `paddingBottom` posée depuis `keyboardWillShow` peut n'être
 * appliquée par le moteur de layout natif que quelques dizaines de ms plus
 * tard ; un `scrollTo` lancé trop tôt est alors borné à l'ancienne hauteur
 * de contenu et le champ reste sous le clavier.
 */
const LATE_SCROLL_DELAY = 180;

export interface KeyboardAwareFields {
  /** Hauteur du clavier visible (0 s'il est fermé). */
  keyboardHeight: number;
  /** `onLayout` du conteneur qui englobe tous les champs. */
  onContainerLayout: (e: LayoutChangeEvent) => void;
  /** `onLayout` d'un champ, identifié par une clé stable. */
  onFieldLayout: (key: string) => (e: LayoutChangeEvent) => void;
  /** `onFocus` d'un champ : mémorise le champ actif et le remonte. */
  onFieldFocus: (key: string) => () => void;
  /**
   * `onContentSizeChange` du ScrollView : rejoue le défilement dès que le
   * contenu a grandi (réserve clavier appliquée, suggestions affichées…).
   */
  onContentSizeChange: (w: number, h: number) => void;
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
 * postal, Adresse).
 *
 * Séquence retenue :
 * 1. iOS `keyboardWillShow` (avant l'animation, hauteur finale connue) →
 *    on publie `keyboardHeight` pour que le formulaire pose sa réserve en bas
 *    pendant que le clavier monte (~250 ms) ;
 * 2. `keyboardDidShow` → défilement, puis un second défilement différé au cas
 *    où le layout natif n'aurait pas encore intégré la réserve ;
 * 3. `onContentSizeChange` → dès que le contenu grandit avec un champ actif,
 *    on rejoue le défilement — c'est la garantie finale, indépendante de tout
 *    délai ;
 * 4. changements de hauteur (pavé numérique ↔ alphabétique, barre de
 *    suggestions) → idem.
 */
export function useKeyboardAwareFields(
  scrollRef: React.RefObject<ScrollView | null>,
): KeyboardAwareFields {
  const containerTop = useRef(0);
  const offsets = useRef<Record<string, number>>({});
  const focusedKey = useRef<string | null>(null);
  const keyboardVisible = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lastContentHeight = useRef(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const clearTimers = () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
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

  /** Programme un ou plusieurs défilements (les précédents sont annulés). */
  const scheduleScroll = useCallback(
    (...delays: number[]) => {
      clearTimers();
      timers.current = delays.map((delay) =>
        setTimeout(() => {
          scrollToFocusedField();
        }, delay),
      );
    },
    [scrollToFocusedField],
  );

  useEffect(() => {
    const subs = [
      Keyboard.addListener('keyboardDidShow', (e) => {
        keyboardVisible.current = true;
        setKeyboardHeight(e.endCoordinates?.height ?? 0);
        scheduleScroll(0, LATE_SCROLL_DELAY);
      }),
      Keyboard.addListener('keyboardDidHide', () => {
        keyboardVisible.current = false;
        setKeyboardHeight(0);
        focusedKey.current = null;
        clearTimers();
      }),
    ];
    if (Platform.OS === 'ios') {
      subs.push(
        // Hauteur finale connue avant l'animation : la réserve en bas du
        // formulaire est posée pendant que le clavier monte.
        Keyboard.addListener('keyboardWillShow', (e) => {
          setKeyboardHeight(e.endCoordinates?.height ?? 0);
        }),
        // Bascule pavé numérique ↔ alphabétique, barre de suggestions… : la
        // hauteur change sans nouvel événement `keyboardDidShow`.
        Keyboard.addListener('keyboardDidChangeFrame', (e) => {
          setKeyboardHeight(e.endCoordinates?.height ?? 0);
          scheduleScroll(0, LATE_SCROLL_DELAY);
        }),
      );
    }
    return () => {
      clearTimers();
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

  const onContentSizeChange = useCallback(
    (_w: number, h: number) => {
      const grew = h > lastContentHeight.current;
      lastContentHeight.current = h;
      // Le contenu vient de grandir (réserve clavier, suggestions d'adresse…)
      // alors qu'un champ est actif sous un clavier ouvert : la borne de
      // `scrollTo` a changé, on rejoue le défilement immédiatement.
      if (grew && keyboardVisible.current && focusedKey.current) scrollToFocusedField();
    },
    [scrollToFocusedField],
  );

  return {
    keyboardHeight,
    onContainerLayout,
    onFieldLayout,
    onFieldFocus,
    onContentSizeChange,
    scrollToFocusedField,
  };
}
