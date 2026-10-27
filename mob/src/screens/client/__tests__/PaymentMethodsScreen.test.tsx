import React from 'react';
import { Alert, type AlertButton } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { act, fireEvent, renderWithProviders, screen, waitFor } from '@/__tests__/test-utils';

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => false }),
    useRoute: () => ({ name: 'PaymentMethods', key: 'pm', params: {} }),
  };
});

/** Profil du client — carte enregistrée ou non selon le test. */
let mockUser: Record<string, unknown> = { email: 'test@x.fr' };
const mockRefreshUser = jest.fn(async () => {});
jest.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, isAuthenticated: true, refreshUser: mockRefreshUser }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

type Result = { ok: true } | { ok: false; message: string };
const mockDeleteSavedCard = jest.fn(async (): Promise<Result> => ({ ok: true }));
const mockSaveCardFromForm = jest.fn(async (_args: unknown): Promise<Result> => ({ ok: true }));
jest.mock('@/services/savedCardActions', () => ({
  deleteSavedCard: () => mockDeleteSavedCard(),
  saveCardFromForm: (args: unknown) => mockSaveCardFromForm(args),
}));

import { PaymentMethodsScreen } from '../PaymentMethodsScreen';

const wrap = (ui: React.ReactElement) => <NavigationContainer>{ui}</NavigationContainer>;

const withSavedCard = (exp_year = 2030) => ({
  email: 'test@x.fr',
  first_name: 'Salma',
  last_name: 'Diallo',
  saved_payment_method_id: 'pm_saved',
  saved_card_info: JSON.stringify({ last4: '4242', brand: 'visa', exp_month: 12, exp_year }),
});

/** Le client remplit le formulaire de carte Stripe (vue simulée dans jest.setup.js). */
const fillCard = () =>
  act(() => {
    screen.getByTestId('payment-methods-card-form').props.onFormComplete({ complete: true });
  });

let alertSpy: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { email: 'test@x.fr' };
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => alertSpy.mockRestore());

/** Appuie sur un bouton de la dernière alerte affichée. */
const pressAlertButton = async (text: string) => {
  const buttons = (alertSpy.mock.calls.at(-1)?.[2] ?? []) as AlertButton[];
  await act(async () => {
    await buttons.find((b) => b.text === text)?.onPress?.();
  });
};

describe('PaymentMethodsScreen — sans carte', () => {
  it('affiche le titre, la carte vide et « Ajouter »', () => {
    renderWithProviders(wrap(<PaymentMethodsScreen />));
    expect(screen.getAllByText('Moyens de paiement').length).toBeGreaterThan(0);
    expect(screen.getByText('Gérez votre carte bancaire enregistrée')).toBeTruthy();
    expect(screen.getByText('Ma carte enregistrée')).toBeTruthy();
    expect(screen.getByText('Aucune carte enregistrée')).toBeTruthy();
    expect(screen.getByText('Ajouter une carte')).toBeTruthy();
    expect(screen.getByText('Ajouter')).toBeTruthy();
    expect(screen.queryByTestId('payment-methods-delete')).toBeNull();
  });

  it('« Ajouter » : formulaire Stripe, « Enregistrer » une fois la carte complète', async () => {
    renderWithProviders(wrap(<PaymentMethodsScreen />));
    fireEvent.press(screen.getByTestId('payment-methods-add'));
    expect(screen.getByTestId('payment-methods-card-form')).toBeTruthy();
    expect(screen.getByTestId('payment-methods-save').props.accessibilityState?.disabled).toBe(true);

    fillCard();
    fireEvent.press(screen.getByTestId('payment-methods-save'));

    await waitFor(() => expect(mockSaveCardFromForm).toHaveBeenCalledWith({
      customer: { email: 'test@x.fr', name: undefined },
      replacesSavedCard: false,
    }));
    await waitFor(() => expect(screen.queryByTestId('payment-methods-card-form')).toBeNull());
    expect(mockRefreshUser).toHaveBeenCalled();
  });

  it('carte refusée : message, le formulaire reste ouvert', async () => {
    mockSaveCardFromForm.mockResolvedValueOnce({ ok: false, message: 'Le numéro de carte saisi est incorrect.' });
    renderWithProviders(wrap(<PaymentMethodsScreen />));
    fireEvent.press(screen.getByTestId('payment-methods-add'));
    fillCard();
    fireEvent.press(screen.getByTestId('payment-methods-save'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(
      'Carte non enregistrée',
      'Le numéro de carte saisi est incorrect.',
      expect.anything(),
      expect.anything(),
    ));
    expect(screen.getByTestId('payment-methods-card-form')).toBeTruthy();
    expect(mockRefreshUser).not.toHaveBeenCalled();
  });

  it('« Annuler » referme le formulaire', () => {
    renderWithProviders(wrap(<PaymentMethodsScreen />));
    fireEvent.press(screen.getByTestId('payment-methods-add'));
    fireEvent.press(screen.getByTestId('payment-methods-cancel'));
    expect(screen.queryByTestId('payment-methods-card-form')).toBeNull();
  });
});

describe('PaymentMethodsScreen — carte enregistrée', () => {
  it('affiche la carte, son expiration et « Supprimer »', () => {
    mockUser = withSavedCard();
    renderWithProviders(wrap(<PaymentMethodsScreen />));
    expect(screen.getByTestId('payment-methods-saved-card')).toHaveTextContent(/Visa •••• 4242/);
    expect(screen.getByText('Expire 12/2030')).toBeTruthy();
    expect(screen.getByTestId('payment-methods-delete')).toHaveTextContent('Supprimer');
    expect(screen.queryByText('Aucune carte enregistrée')).toBeNull();
    expect(screen.getByText('Changer de carte')).toBeTruthy();
  });

  it('carte expirée : signalée', () => {
    mockUser = withSavedCard(2020);
    renderWithProviders(wrap(<PaymentMethodsScreen />));
    expect(screen.getByText('Expirée depuis 12/2020')).toBeTruthy();
  });

  it('« Supprimer » demande confirmation, puis supprime la carte', async () => {
    mockUser = withSavedCard();
    renderWithProviders(wrap(<PaymentMethodsScreen />));
    fireEvent.press(screen.getByTestId('payment-methods-delete'));

    expect(alertSpy.mock.calls[0]?.[0]).toBe('Supprimer ma carte');
    expect(alertSpy.mock.calls[0]?.[1]).toMatch(/Visa •••• 4242/);
    expect(mockDeleteSavedCard).not.toHaveBeenCalled();

    await pressAlertButton('Supprimer');
    expect(mockDeleteSavedCard).toHaveBeenCalledTimes(1);
    expect(mockRefreshUser).toHaveBeenCalled();
  });

  it('« Annuler » dans la confirmation : la carte reste', async () => {
    mockUser = withSavedCard();
    renderWithProviders(wrap(<PaymentMethodsScreen />));
    fireEvent.press(screen.getByTestId('payment-methods-delete'));
    await pressAlertButton('Annuler');
    expect(mockDeleteSavedCard).not.toHaveBeenCalled();
  });

  it('suppression en échec : message clair', async () => {
    mockUser = withSavedCard();
    mockDeleteSavedCard.mockResolvedValueOnce({
      ok: false,
      message: 'Votre carte n’a pas pu être supprimée. Réessayez dans un instant.',
    });
    renderWithProviders(wrap(<PaymentMethodsScreen />));
    fireEvent.press(screen.getByTestId('payment-methods-delete'));
    await pressAlertButton('Supprimer');
    expect(alertSpy).toHaveBeenLastCalledWith(
      'Suppression impossible',
      'Votre carte n’a pas pu être supprimée. Réessayez dans un instant.',
      expect.anything(),
      expect.anything(),
    );
    expect(mockRefreshUser).not.toHaveBeenCalled();
  });

  it('« Changer de carte » : la nouvelle remplace l’ancienne', async () => {
    mockUser = withSavedCard();
    renderWithProviders(wrap(<PaymentMethodsScreen />));
    fireEvent.press(screen.getByTestId('payment-methods-add'));
    expect(screen.getByText('Elle remplacera votre Visa •••• 4242.')).toBeTruthy();
    fillCard();
    fireEvent.press(screen.getByTestId('payment-methods-save'));
    await waitFor(() => expect(mockSaveCardFromForm).toHaveBeenCalledWith({
      customer: { email: 'test@x.fr', name: 'Salma Diallo' },
      replacesSavedCard: true,
    }));
  });
});
