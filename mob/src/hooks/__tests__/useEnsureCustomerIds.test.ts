import { renderHook, act } from '@testing-library/react-native';

let mockUser: Record<string, unknown> | null = null;
const mockRefreshUser = jest.fn(async () => {});
jest.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, refreshUser: mockRefreshUser }),
}));

const mockUpdateMe = jest.fn(async (_patch: Record<string, unknown>) => ({}));
jest.mock('@/api/base44Client', () => ({
  getBase44: () => ({ auth: { updateMe: (p: Record<string, unknown>) => mockUpdateMe(p) } }),
}));

const mockPromoCreate = jest.fn(async (_data: Record<string, unknown>) => ({ id: 'promo_1' }));
jest.mock('@/api/entities', () => ({
  PromoCode: () => ({ create: (d: Record<string, unknown>) => mockPromoCreate(d) }),
}));

import {
  generateCustomerId,
  generateReferralCode,
  useEnsureCustomerIds,
} from '../useEnsureCustomerIds';

/** Laisse passer le délai de génération puis les promesses en attente. */
const runGeneration = async () => {
  await act(async () => {
    jest.advanceTimersByTime(2000);
  });
  await act(async () => {});
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});
afterEach(() => jest.useRealTimers());

describe('useEnsureCustomerIds', () => {
  it('attribue un identifiant CL + 6 chiffres et un code de parrainage à un nouveau client', async () => {
    mockUser = { email: 'sali@x.fr' };
    renderHook(() => useEnsureCustomerIds());
    expect(mockUpdateMe).not.toHaveBeenCalled();

    await runGeneration();

    expect(mockUpdateMe).toHaveBeenCalledTimes(1);
    const patch = mockUpdateMe.mock.calls[0]![0];
    expect(patch.customer_id).toMatch(/^CL\d{6}$/);
    expect(patch.referral_code).toMatch(/^REF[A-Z0-9]{1,6}$/);
    expect(mockPromoCreate).toHaveBeenCalledWith({
      code: patch.referral_code,
      owner_email: 'sali@x.fr',
      discount_type: 'percentage',
      discount_value: 10,
    });
    expect(mockRefreshUser).toHaveBeenCalled();
  });

  it('ne complète que ce qui manque', async () => {
    mockUser = { email: 'sali@x.fr', referral_code: 'REFABC123' };
    renderHook(() => useEnsureCustomerIds());
    await runGeneration();
    expect(Object.keys(mockUpdateMe.mock.calls[0]![0])).toEqual(['customer_id']);
    expect(mockPromoCreate).not.toHaveBeenCalled();
  });

  it('ne touche à rien quand le client a déjà ses identifiants, ou sans compte', async () => {
    mockUser = { email: 'salma@x.fr', customer_id: 'CL350226', referral_code: 'REFXYZ' };
    renderHook(() => useEnsureCustomerIds());
    await runGeneration();
    mockUser = null;
    renderHook(() => useEnsureCustomerIds());
    await runGeneration();
    expect(mockUpdateMe).not.toHaveBeenCalled();
  });

  it('accueil et profil ouverts ensemble : une seule génération', async () => {
    mockUser = { email: 'sali@x.fr' };
    let release: () => void = () => {};
    mockUpdateMe.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve({});
        }),
    );
    renderHook(() => useEnsureCustomerIds());
    renderHook(() => useEnsureCustomerIds());
    await runGeneration();
    expect(mockUpdateMe).toHaveBeenCalledTimes(1);
    await act(async () => release());
  });
});

describe('formats', () => {
  it('suivent ceux du site', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateCustomerId()).toMatch(/^CL[1-9]\d{5}$/);
      expect(generateReferralCode()).toMatch(/^REF[A-Z0-9]{1,6}$/);
    }
  });
});
