import React, { useRef } from 'react';
import { Keyboard, ScrollView, TextInput, View } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { FIELD_SCROLL_MARGIN, useKeyboardAwareFields } from '@/hooks/useKeyboardAwareFields';

const layout = (y: number) => ({ nativeEvent: { layout: { x: 0, y, width: 300, height: 44 } } });

const scrollTo = jest.fn();

/** Écouteurs clavier capturés : `Keyboard.emit` n'existe plus sur RN 0.83. */
let keyboardListeners: Record<string, ((e: unknown) => void)[]> = {};
const emitKeyboard = (event: string, payload: unknown) => {
  for (const cb of keyboardListeners[event] ?? []) cb(payload);
};

/** Formulaire minimal : conteneur à y=200, champs à y=0 et y=420. */
const Form: React.FC = () => {
  const scrollRef = useRef<ScrollView>(null);
  const { onContainerLayout, onFieldLayout, onFieldFocus, keyboardHeight } =
    useKeyboardAwareFields(scrollRef);

  return (
    <ScrollView ref={scrollRef} testID="scroll">
      <View testID={`kb-${keyboardHeight}`} />
      <View onLayout={onContainerLayout} testID="fields">
        <View onLayout={onFieldLayout('email')} testID="email-row">
          <TextInput testID="email" onFocus={onFieldFocus('email')} />
        </View>
        <View onLayout={onFieldLayout('address')} testID="address-row">
          <TextInput testID="address" onFocus={onFieldFocus('address')} />
        </View>
      </View>
    </ScrollView>
  );
};

describe('useKeyboardAwareFields', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    scrollTo.mockClear();
    keyboardListeners = {};

    jest.spyOn(Keyboard, 'addListener').mockImplementation(((
      event: string,
      cb: (e: unknown) => void,
    ) => {
      (keyboardListeners[event] ??= []).push(cb);
      return {
        remove: () => {
          keyboardListeners[event] = (keyboardListeners[event] ?? []).filter((f) => f !== cb);
        },
      };
    }) as never);

    jest
      .spyOn(ScrollView.prototype, 'scrollTo')
      .mockImplementation(((...args: unknown[]) => scrollTo(...args)) as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  const mountForm = () => {
    render(<Form />);
    fireEvent(screen.getByTestId('fields'), 'layout', layout(200));
    fireEvent(screen.getByTestId('email-row'), 'layout', layout(0));
    fireEvent(screen.getByTestId('address-row'), 'layout', layout(420));
  };

  const showKeyboard = (height = 336) => {
    act(() => {
      emitKeyboard('keyboardDidShow', { endCoordinates: { height } });
      jest.runOnlyPendingTimers();
    });
  };

  it('remonte le champ focus une fois le clavier réellement déployé', () => {
    mountForm();

    /*
      Au seul `onFocus`, le clavier n'est pas encore ouvert : la zone
      scrollable n'a pas sa hauteur définitive et `scrollTo` est borné — c'est
      le cas qui laissait le dernier champ caché derrière le clavier.
      Le défilement doit donc être rejoué sur `keyboardDidShow`.
    */
    fireEvent(screen.getByTestId('address'), 'focus');
    showKeyboard();

    expect(scrollTo).toHaveBeenLastCalledWith({
      y: 200 + 420 - FIELD_SCROLL_MARGIN,
      animated: true,
    });
  });

  it('expose la hauteur du clavier pour réserver la place en bas du formulaire', () => {
    mountForm();

    showKeyboard(336);
    expect(screen.getByTestId('kb-336')).toBeTruthy();

    act(() => {
      emitKeyboard('keyboardDidHide', {});
      jest.runOnlyPendingTimers();
    });
    expect(screen.getByTestId('kb-0')).toBeTruthy();
  });

  it('suit un changement de hauteur du clavier (pavé numérique ↔ alphabétique)', () => {
    mountForm();

    fireEvent(screen.getByTestId('address'), 'focus');
    showKeyboard(336);
    scrollTo.mockClear();

    act(() => {
      emitKeyboard('keyboardDidChangeFrame', { endCoordinates: { height: 216 } });
      jest.runOnlyPendingTimers();
    });

    expect(screen.getByTestId('kb-216')).toBeTruthy();
    expect(scrollTo).toHaveBeenLastCalledWith({
      y: 200 + 420 - FIELD_SCROLL_MARGIN,
      animated: true,
    });
  });

  it('suit le passage d’un champ à l’autre quand le clavier est déjà ouvert', () => {
    mountForm();

    fireEvent(screen.getByTestId('address'), 'focus');
    showKeyboard();
    scrollTo.mockClear();

    fireEvent(screen.getByTestId('email'), 'focus');
    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(scrollTo).toHaveBeenLastCalledWith({ y: 200 - FIELD_SCROLL_MARGIN, animated: true });
  });

  it('ne scrolle pas vers un champ dont la position est inconnue', () => {
    render(<Form />);
    fireEvent(screen.getByTestId('address'), 'focus');
    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('borne le défilement à zéro pour les premiers champs', () => {
    render(<Form />);
    fireEvent(screen.getByTestId('fields'), 'layout', layout(0));
    fireEvent(screen.getByTestId('email-row'), 'layout', layout(0));

    fireEvent(screen.getByTestId('email'), 'focus');
    showKeyboard();

    expect(scrollTo).toHaveBeenLastCalledWith({ y: 0, animated: true });
  });

  it('oublie le champ actif à la fermeture du clavier', () => {
    mountForm();

    fireEvent(screen.getByTestId('address'), 'focus');
    showKeyboard();

    act(() => {
      emitKeyboard('keyboardDidHide', {});
      jest.runOnlyPendingTimers();
    });
    scrollTo.mockClear();

    // Un événement clavier isolé ne doit plus déplacer le formulaire.
    showKeyboard();
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
