import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/__tests__/test-utils';

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return { ...actual, useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }) };
});

jest.mock('@/api/entities', () => ({
  InternalRegulations: () => ({
    list: jest.fn(async () => [
      { id: 'r_old', title: 'Ancien règlement', content: '# Ancien', version: 1, is_active: false, updated_date: '2026-04-01T10:00:00.000000' },
      { id: 'r_new', title: 'Règlement intérieur AfriGo', content: '# Règlement\n\n## 1. PRÉSENTATION\n\nAfriGo est une plateforme.', version: 2, is_active: false, effective_date: '2026-05-12', updated_date: '2026-05-12T10:00:00.000000' },
    ]),
  }),
  PrivacyPolicy: () => ({
    list: jest.fn(async () => [
      { id: 'p1', content: 'POLITIQUE DE CONFIDENTIALITÉ\n\n1. COLLECTE DES DONNÉES', version: '1.0', is_active: false, updated_date: '2026-04-18T10:00:00.000000' },
    ]),
  }),
}));

import { LegalScreen } from '../LegalScreen';

const wrap = (ui: React.ReactElement) => <NavigationContainer>{ui}</NavigationContainer>;

describe('LegalScreen (Paramètres › Règlement et confidentialité)', () => {
  it('affiche le dernier règlement même s’il n’est plus actif, puis la politique', async () => {
    renderWithProviders(wrap(<LegalScreen />));
    await waitFor(() => expect(screen.getByTestId('legal-doc-regulations')).toBeTruthy());
    // Le texte le plus récent (version 2), sans en-tête ajouté : ni titre, ni version, ni date.
    expect(screen.getByText('1. PRÉSENTATION')).toBeTruthy();
    expect(screen.queryByText('Règlement intérieur AfriGo')).toBeNull();
    expect(screen.queryByText(/Version/)).toBeNull();
    expect(screen.queryByText(/en vigueur/)).toBeNull();

    fireEvent.press(screen.getByTestId('legal-tab-privacy'));
    await waitFor(() => expect(screen.getByTestId('legal-doc-privacy')).toBeTruthy());
    expect(screen.getByText('POLITIQUE DE CONFIDENTIALITÉ')).toBeTruthy();
    expect(screen.getByText('1. COLLECTE DES DONNÉES')).toBeTruthy();
  });
});
