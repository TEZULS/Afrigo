import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { setBase44Token } from '@/api/base44Client';
import { AuthProvider, useAuth } from '@/lib/AuthContext';

const mockOrder: string[] = [];
const mockUnregister = jest.fn(async () => {
  mockOrder.push('unregisterPushToken');
});

jest.mock('@/services/pushNotifications', () => ({
  unregisterPushToken: () => mockUnregister(),
}));

const Consumer = () => {
  const { logout } = useAuth();
  return <Text onPress={() => void logout()}>Se déconnecter</Text>;
};

describe('AuthContext — déconnexion', () => {
  beforeEach(() => {
    mockOrder.length = 0;
    jest.clearAllMocks();
    (setBase44Token as jest.Mock).mockImplementation(async (token: string | null) => {
      mockOrder.push(`setBase44Token(${token})`);
    });
  });

  it('retire les jetons push du profil avant de couper la session', async () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    fireEvent.press(screen.getByText('Se déconnecter'));

    await waitFor(() => expect(mockOrder).toContain('setBase44Token(null)'));
    expect(mockOrder.indexOf('unregisterPushToken')).toBeGreaterThanOrEqual(0);
    expect(mockOrder.indexOf('unregisterPushToken')).toBeLessThan(mockOrder.indexOf('setBase44Token(null)'));
  });

  it('se déconnecte quand même si le retrait des jetons échoue', async () => {
    mockUnregister.mockRejectedValueOnce(new Error('Network request failed'));
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    fireEvent.press(screen.getByText('Se déconnecter'));
    await waitFor(() => expect(mockOrder).toContain('setBase44Token(null)'));
  });
});
