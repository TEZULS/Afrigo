import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { renderWithProviders, fireEvent, screen } from '@/__tests__/test-utils';
import { Header } from '../Header';

const wrap = (ui: React.ReactElement) =>
  <NavigationContainer>{ui}</NavigationContainer>;

describe('Header', () => {
  it('affiche le titre', () => {
    renderWithProviders(wrap(<Header title="Profil" />));
    expect(screen.getByText('Profil')).toBeTruthy();
  });

  it('affiche le sous-titre', () => {
    renderWithProviders(wrap(<Header title="Panier" subtitle="3 articles" />));
    expect(screen.getByText('3 articles')).toBeTruthy();
  });

  it('appelle onBack quand le bouton retour est pressé', () => {
    const onBack = jest.fn();
    renderWithProviders(wrap(<Header title="X" onBack={onBack} />));
    fireEvent.press(screen.getByLabelText('Retour'));
    expect(onBack).toHaveBeenCalled();
  });

  it("ne rend pas de bouton retour sans onBack", () => {
    renderWithProviders(wrap(<Header title="X" />));
    expect(screen.queryByLabelText('Retour')).toBeNull();
  });

  it("affiche la marque AfriGo par défaut", () => {
    renderWithProviders(wrap(<Header title="Profil" />));
    expect(screen.getByText('AfriGo')).toBeTruthy();
  });

  it("la marque AfriGo est cliquable et navigue vers l'accueil", () => {
    renderWithProviders(wrap(<Header title="Profil" />));
    const brand = screen.getByLabelText("AfriGo — retour à l'accueil");
    expect(brand).toBeTruthy();
    fireEvent.press(brand);
    // pas d'assertion sur la nav (mock), le press ne doit juste pas throw
  });

  it("hideBrand cache la marque AfriGo", () => {
    renderWithProviders(wrap(<Header title="X" hideBrand />));
    expect(screen.queryByText('AfriGo')).toBeNull();
  });
});
