import React from 'react';
import { Platform } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';

const mockReset = jest.fn();
jest.mock('@/navigation/navigationRef', () => ({
  resetWhenReady: (...a: unknown[]) => mockReset(...a),
}));

let mockAuth: { isAuthenticated: boolean; user: { email: string } | null } = {
  isAuthenticated: true,
  user: { email: 'Salma@x.fr' },
};
jest.mock('@/lib/AuthContext', () => ({ useAuth: () => mockAuth }));

import { ReturnDraftRestorer } from '../ReturnDraftRestorer';
import { clearReturnDraft, saveReturnDraft } from '@/utils/returnDraft';

const draft = (over: { cameraOpenedAt?: number } = {}) => ({
  orderId: 'ord_1',
  email: 'salma@x.fr',
  selected: { '0': 1 },
  reasonCode: 'expired',
  description: 'Périmé',
  photos: [],
  ...over,
});

const settle = () => new Promise((r) => setTimeout(r, 20));

describe('ReturnDraftRestorer — retour à la réclamation après une fermeture par Android', () => {
  const realOS = Platform.OS;
  beforeEach(() => {
    jest.clearAllMocks();
    clearReturnDraft();
    Platform.OS = 'android';
    mockAuth = { isAuthenticated: true, user: { email: 'Salma@x.fr' } };
  });
  afterEach(() => {
    Platform.OS = realOS;
  });

  it('appareil photo ouvert juste avant le redémarrage : réclamation rouverte, par-dessus sa commande', async () => {
    saveReturnDraft(draft({ cameraOpenedAt: Date.now() - 60_000 }));
    render(<ReturnDraftRestorer />);
    await waitFor(() => expect(mockReset).toHaveBeenCalledTimes(1));
    expect(mockReset).toHaveBeenCalledWith({
      index: 2,
      routes: [
        { name: 'ClientTabs', params: { screen: 'OrdersTab' } },
        { name: 'OrderDetails', params: { id: 'ord_1' } },
        { name: 'Returns', params: { orderId: 'ord_1' } },
      ],
    });
  });

  it('brouillon sans appareil photo ouvert, ou trop ancien : démarrage normal', async () => {
    saveReturnDraft(draft());
    const first = render(<ReturnDraftRestorer />);
    await settle();
    first.unmount();
    saveReturnDraft(draft({ cameraOpenedAt: Date.now() - 20 * 60_000 }));
    render(<ReturnDraftRestorer />);
    await settle();
    expect(mockReset).not.toHaveBeenCalled();
  });

  it('iPhone (appareil photo dans l’app), autre compte ou déconnecté : rien', async () => {
    saveReturnDraft(draft({ cameraOpenedAt: Date.now() }));
    Platform.OS = 'ios';
    const ios = render(<ReturnDraftRestorer />);
    await settle();
    ios.unmount();

    Platform.OS = 'android';
    mockAuth = { isAuthenticated: true, user: { email: 'autre@x.fr' } };
    const other = render(<ReturnDraftRestorer />);
    await settle();
    other.unmount();

    mockAuth = { isAuthenticated: false, user: null };
    render(<ReturnDraftRestorer />);
    await settle();
    expect(mockReset).not.toHaveBeenCalled();
  });
});
