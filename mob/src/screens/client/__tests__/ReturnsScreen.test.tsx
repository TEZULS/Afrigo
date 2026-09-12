import React from 'react';
import { Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/__tests__/test-utils';

const mockReplace = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({ replace: mockReplace, goBack: jest.fn(), navigate: jest.fn() }),
    useRoute: () => ({ name: 'Returns', key: 'returns', params: { orderId: 'ord_1' } }),
  };
});

jest.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'salma@x.fr' }, isAuthenticated: true }),
}));

jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('@/services/fileUpload', () => ({ uploadAsset: jest.fn(async () => 'https://x/photo.jpg') }));

const mockReturnCreate = jest.fn(async () => ({ id: 'ret_1' }));

jest.mock('@/api/entities', () => ({
  Order: () => ({
    get: jest.fn(async () => ({
      id: 'ord_1',
      items: [
        { product_id: 'p1', product_name: 'Crabe Madagascar 1Kg', quantity: 2, unit_price: 15.39 },
        {
          product_id: 'p2',
          product_name: 'Adja',
          quantity: 1,
          unit_price: 4.25,
          selected_variants: { single: { type: 'lot', value: 'Lot de 3' } },
        },
      ],
    })),
  }),
  Product: () => ({ get: jest.fn(async (id: string) => ({ id, image_url: `https://img/${id}.png` })) }),
  Return: () => ({ create: mockReturnCreate }),
}));

import { ReturnsScreen } from '../ReturnsScreen';

const wrap = (ui: React.ReactElement) => <NavigationContainer>{ui}</NavigationContainer>;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
    buttons?.find((b) => b.text === 'Envoyer')?.onPress?.();
  });
});

describe('ReturnsScreen', () => {
  it('affiche les produits de la commande (nom, variante, prix, quantité)', async () => {
    renderWithProviders(wrap(<ReturnsScreen />));
    await waitFor(() => expect(screen.getByText('Crabe Madagascar 1Kg')).toBeTruthy());
    expect(screen.getByText('Adja')).toBeTruthy();
    expect(screen.getByText('Lot de 3')).toBeTruthy();
    expect(screen.getByText(/15,39 €.*2 commandés/)).toBeTruthy();
  });

  it('sélection d’un produit, quantité ajustable, envoi avec les noms', async () => {
    renderWithProviders(wrap(<ReturnsScreen />));
    await waitFor(() => expect(screen.getByTestId('return-item-0')).toBeTruthy());

    const send = () => screen.getByRole('button', { name: /Envoyer la demande/ });
    expect(send().props.accessibilityState?.disabled).toBe(true);

    // Cocher le crabe : quantité commandée (2) proposée par défaut, puis réduite à 1.
    fireEvent.press(screen.getByTestId('return-item-0'));
    await waitFor(() => expect(screen.getByTestId('return-qty-0')).toHaveTextContent('2'));
    fireEvent.press(screen.getByLabelText('Retirer un exemplaire'));
    expect(screen.getByTestId('return-qty-0')).toHaveTextContent('1');
    expect(screen.getByText(/1 article sélectionné · 15,39 €/)).toBeTruthy();

    fireEvent.press(screen.getByText('Date expirée'));
    expect(send().props.accessibilityState?.disabled).toBeFalsy();
    fireEvent.press(send());

    await waitFor(() => expect(mockReturnCreate).toHaveBeenCalled());
    const payload = (mockReturnCreate.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(payload.order_id).toBe('ord_1');
    expect(payload.customer_email).toBe('salma@x.fr');
    expect(payload.reason).toBe('expired');
    expect(payload.refund_amount).toBe(15.39);
    expect(payload.items).toEqual([
      { product_id: 'p1', product_name: 'Crabe Madagascar 1Kg', quantity: 1, unit_price: 15.39 },
    ]);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('ReturnDetails', { id: 'ret_1' }));
  });

  it('décocher retire le produit de la demande', async () => {
    renderWithProviders(wrap(<ReturnsScreen />));
    await waitFor(() => expect(screen.getByTestId('return-item-1')).toBeTruthy());
    fireEvent.press(screen.getByTestId('return-item-1'));
    await waitFor(() => expect(screen.getByTestId('return-qty-1')).toHaveTextContent('1'));
    fireEvent.press(screen.getByTestId('return-item-1'));
    await waitFor(() => expect(screen.queryByTestId('return-qty-1')).toBeNull());
  });
});
