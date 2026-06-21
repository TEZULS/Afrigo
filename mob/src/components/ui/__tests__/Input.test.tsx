import React from 'react';
import { renderWithProviders, fireEvent, screen } from '@/__tests__/test-utils';
import { Input } from '../Input';

describe('Input', () => {
  it('affiche le label', () => {
    renderWithProviders(<Input label="Email" />);
    expect(screen.getByText('Email')).toBeTruthy();
  });

  it('appelle onChangeText quand on tape', () => {
    const onChangeText = jest.fn();
    renderWithProviders(<Input placeholder="email" onChangeText={onChangeText} />);
    const field = screen.getByPlaceholderText('email');
    fireEvent.changeText(field, 'hello');
    expect(onChangeText).toHaveBeenCalledWith('hello');
  });

  it('affiche un message d\'erreur', () => {
    renderWithProviders(<Input label="Email" error="Email invalide" />);
    expect(screen.getByText('Email invalide')).toBeTruthy();
  });

  it('affiche un texte d\'aide quand pas d\'erreur', () => {
    renderWithProviders(<Input helperText="Aucun mail ne sera envoyé" />);
    expect(screen.getByText('Aucun mail ne sera envoyé')).toBeTruthy();
  });
});
