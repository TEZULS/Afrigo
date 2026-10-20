import React from 'react';
import { Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/__tests__/test-utils';

const mockReplace = jest.fn();
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({ replace: mockReplace, goBack: jest.fn(), navigate: mockNavigate }),
    useRoute: () => ({ name: 'Returns', key: 'returns', params: { orderId: 'ord_1' } }),
  };
});

jest.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'salma@x.fr' }, isAuthenticated: true }),
}));

const mockRequestCamera = jest.fn(async () => ({ status: 'granted' }));
const mockLaunchCamera = jest.fn();
const mockLaunchLibrary = jest.fn();
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: () => mockRequestCamera(),
  launchCameraAsync: (...a: unknown[]) => mockLaunchCamera(...a),
  launchImageLibraryAsync: (...a: unknown[]) => mockLaunchLibrary(...a),
}));
jest.mock('@/services/fileUpload', () => ({
  uploadAsset: jest.fn(async (p: { uri: string }) => `https://x/${p.uri.split('/').pop()}`),
}));

const mockReturnCreate = jest.fn(async () => ({ id: 'ret_1' }));
let mockExistingReturns: { id: string; order_id: string; status: string }[] = [];
/** Livrée il y a 20 min : dans la fenêtre d'une heure. */
let mockDeliveredDate = new Date(Date.now() - 20 * 60 * 1000).toISOString();
let mockOrderStatus = 'delivered';
/** Réclamation réactivée par l'admin depuis base44. */
let mockReopened = false;
const mockOrderUpdate = jest.fn(async () => ({}));

jest.mock('@/api/entities', () => ({
  Order: () => ({
    get: jest.fn(async () => ({
      id: 'ord_1',
      status: mockOrderStatus,
      delivered_date: mockDeliveredDate,
      return_request_reopened: mockReopened,
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
    update: mockOrderUpdate,
  }),
  Product: () => ({ get: jest.fn(async (id: string) => ({ id, image_url: `https://img/${id}.png` })) }),
  Return: () => ({ create: mockReturnCreate, filter: jest.fn(async () => mockExistingReturns) }),
}));

import { ReturnsScreen } from '../ReturnsScreen';
import { clearReturnDraft } from '@/utils/returnDraft';

const wrap = (ui: React.ReactElement) => <NavigationContainer>{ui}</NavigationContainer>;

const sendButton = () => screen.getByRole('button', { name: /Envoyer la demande/ });
const isDisabled = () => sendButton().props.accessibilityState?.disabled === true;

/** Simule une prise de vue : chaque appel ajoute une photo et attend son affichage. */
const takePhoto = async (name: string) => {
  const before = screen.queryAllByLabelText(/Supprimer la photo/).length;
  mockLaunchCamera.mockResolvedValueOnce({
    canceled: false,
    assets: [{ uri: `file:///cam/${name}`, fileName: name, mimeType: 'image/jpeg' }],
  });
  fireEvent.press(screen.getByTestId('return-take-photo'));
  await waitFor(() => expect(screen.getByLabelText(`Supprimer la photo ${before + 1}`)).toBeTruthy());
};

beforeEach(() => {
  jest.clearAllMocks();
  clearReturnDraft();
  mockExistingReturns = [];
  mockDeliveredDate = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  mockOrderStatus = 'delivered';
  mockRequestCamera.mockResolvedValue({ status: 'granted' });
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

  it('exige produit, raison, description et 2 photos en direct — pas de choix échange / remboursement', async () => {
    renderWithProviders(wrap(<ReturnsScreen />));
    await waitFor(() => expect(screen.getByTestId('return-item-0')).toBeTruthy());
    expect(isDisabled()).toBe(true);
    expect(screen.getByText(/sélectionnez au moins un produit/)).toBeTruthy();

    fireEvent.press(screen.getByTestId('return-item-0'));
    await waitFor(() => expect(screen.getByTestId('return-qty-0')).toHaveTextContent('2'));
    fireEvent.press(screen.getByText('Date expirée'));
    fireEvent.changeText(screen.getByTestId('return-description'), 'Produit périmé à réception');
    expect(isDisabled()).toBe(true);
    expect(screen.getByText(/prenez encore 2 photos/)).toBeTruthy();

    await takePhoto('a.jpg');
    expect(screen.getByText(/prenez encore 1 photo/)).toBeTruthy();
    await takePhoto('b.jpg');
    expect(screen.queryByText(/prenez encore/)).toBeNull();
    // C'est l'admin qui choisit échange ou remboursement : rien à cocher ici.
    expect(screen.queryByTestId('return-resolution-refund')).toBeNull();
    expect(screen.queryByTestId('return-resolution-exchange')).toBeNull();
    await waitFor(() => expect(isDisabled()).toBe(false));
    // Les photos viennent de l'appareil photo, jamais de la galerie.
    expect(mockLaunchCamera).toHaveBeenCalledTimes(2);
    expect(mockLaunchLibrary).not.toHaveBeenCalled();
  });

  it('envoie la réclamation au format base44, sans résolution (choisie par l’admin)', async () => {
    renderWithProviders(wrap(<ReturnsScreen />));
    await waitFor(() => expect(screen.getByTestId('return-item-0')).toBeTruthy());

    fireEvent.press(screen.getByTestId('return-item-0'));
    await waitFor(() => expect(screen.getByTestId('return-qty-0')).toHaveTextContent('2'));
    fireEvent.press(screen.getByLabelText('Retirer un exemplaire'));
    expect(screen.getByTestId('return-qty-0')).toHaveTextContent('1');
    fireEvent.press(screen.getByText('Date expirée'));
    fireEvent.changeText(screen.getByTestId('return-description'), 'Produit périmé à réception');
    await takePhoto('a.jpg');
    await takePhoto('b.jpg');
    await waitFor(() => expect(isDisabled()).toBe(false));

    fireEvent.press(sendButton());
    await waitFor(() => expect(mockReturnCreate).toHaveBeenCalled());
    const payload = (mockReturnCreate.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(payload).toEqual({
      order_id: 'ord_1',
      customer_email: 'salma@x.fr',
      items: [{ product_name: 'Crabe Madagascar 1Kg', quantity: 1, total_price: 15.39 }],
      reason: 'expired',
      description: 'Produit périmé à réception',
      photos: ['https://x/a.jpg', 'https://x/b.jpg'],
      refund_amount: 15.39,
      status: 'pending',
    });
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('ReturnDetails', { id: 'ret_1' }));
  });

  it('si base44 exige encore une résolution, renvoie la réclamation avec une valeur d’attente', async () => {
    mockReturnCreate.mockRejectedValueOnce(new Error('resolution_type is required'));
    renderWithProviders(wrap(<ReturnsScreen />));
    await waitFor(() => expect(screen.getByTestId('return-item-1')).toBeTruthy());
    fireEvent.press(screen.getByTestId('return-item-1'));
    fireEvent.press(screen.getByText('Mauvais produit'));
    fireEvent.changeText(screen.getByTestId('return-description'), 'Ce n’est pas le bon lot');
    await takePhoto('a.jpg');
    await takePhoto('b.jpg');
    await waitFor(() => expect(isDisabled()).toBe(false));

    fireEvent.press(sendButton());
    await waitFor(() => expect(mockReturnCreate).toHaveBeenCalledTimes(2));
    const first = (mockReturnCreate.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    const retry = (mockReturnCreate.mock.calls[1] as unknown as [Record<string, unknown>])[0];
    expect(first.resolution_type).toBeUndefined();
    expect(retry.resolution_type).toBe('exchange');
    expect(retry.reason).toBe('wrong_product');
  });

  it('une photo supprimée ne compte plus', async () => {
    renderWithProviders(wrap(<ReturnsScreen />));
    await waitFor(() => expect(screen.getByTestId('return-item-0')).toBeTruthy());
    await takePhoto('a.jpg');
    await takePhoto('b.jpg');
    expect(screen.getByText(/Photos du produit \* \(2\/2 minimum\)/)).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Supprimer la photo 1'));
    await waitFor(() => expect(screen.getByText(/Photos du produit \* \(1\/2 minimum\)/)).toBeTruthy());
  });

  it('explique comment autoriser l’appareil photo quand la permission est refusée', async () => {
    mockRequestCamera.mockResolvedValueOnce({ status: 'denied' });
    renderWithProviders(wrap(<ReturnsScreen />));
    await waitFor(() => expect(screen.getByTestId('return-take-photo')).toBeTruthy());
    fireEvent.press(screen.getByTestId('return-take-photo'));
    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Appareil photo requis',
        expect.stringMatching(/prises en direct/),
        expect.any(Array),
      ),
    );
    expect(mockLaunchCamera).not.toHaveBeenCalled();
  });

  it('refuse le formulaire une fois l’heure passée après la livraison', async () => {
    mockDeliveredDate = new Date(Date.now() - 90 * 60 * 1000).toISOString();
    renderWithProviders(wrap(<ReturnsScreen />));
    await waitFor(() => expect(screen.getByText('Délai dépassé')).toBeTruthy());
    expect(screen.getByText(/délai de 1 h après la livraison/)).toBeTruthy();
    expect(screen.queryByTestId('return-item-0')).toBeNull();
  });

  it('reste accessible après une demande refusée, mais plus après une demande approuvée', async () => {
    mockExistingReturns = [{ id: 'r1', order_id: 'ord_1', status: 'rejected' }];
    const first = renderWithProviders(wrap(<ReturnsScreen />));
    await waitFor(() => expect(screen.getByTestId('return-item-0')).toBeTruthy());
    first.unmount();

    mockExistingReturns = [{ id: 'r2', order_id: 'ord_1', status: 'approved' }];
    renderWithProviders(wrap(<ReturnsScreen />));
    await waitFor(() => expect(screen.getByText('Demande déjà traitée')).toBeTruthy());
    expect(screen.queryByTestId('return-item-0')).toBeNull();
  });
});
