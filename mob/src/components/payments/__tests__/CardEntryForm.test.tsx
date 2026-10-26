import React from 'react';
import { act, renderWithProviders, screen } from '@/__tests__/test-utils';
import { CardEntryForm, cardFormHeight } from '../CardEntryForm';

describe('CardEntryForm — formulaire de carte Stripe dans la page', () => {
  it('iOS : place pour numéro, date + CVC, pays, code postal et erreur ; grandit avec le texte', () => {
    expect(cardFormHeight(1)).toBe(196);
    expect(cardFormHeight(0.85)).toBe(196);
    expect(cardFormHeight(1.5)).toBe(294);
  });

  it('ne remonte que l’état « complet » de la carte', () => {
    const onCompleteChange = jest.fn();
    renderWithProviders(<CardEntryForm testID="card" onCompleteChange={onCompleteChange} />);
    const form = screen.getByTestId('card');
    // Taille du texte de l'appareil (×2 dans le simulateur de tests de React Native).
    expect(form.props.style).toMatchObject({ width: '100%', height: cardFormHeight() });
    act(() => form.props.onFormComplete({ complete: true, last4: '4242' }));
    act(() => form.props.onFormComplete({ complete: false, last4: '' }));
    expect(onCompleteChange.mock.calls).toEqual([[true], [false]]);
  });

  it('retiré de l’écran : la saisie est perdue, la carte n’est plus complète', () => {
    const onCompleteChange = jest.fn();
    const { unmount } = renderWithProviders(<CardEntryForm testID="card" onCompleteChange={onCompleteChange} />);
    act(() => screen.getByTestId('card').props.onFormComplete({ complete: true }));
    unmount();
    expect(onCompleteChange).toHaveBeenLastCalledWith(false);
  });
});
