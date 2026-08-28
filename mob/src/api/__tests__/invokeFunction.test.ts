/**
 * `functions.invoke()` du SDK renvoie la réponse axios complète (le client des
 * fonctions est créé sans intercepteur de réponse) : `invokeFunction` doit
 * rendre le corps JSON, sinon `createPaymentIntent().clientSecret` est
 * `undefined` et tout paiement carte échoue.
 */
const mockInvoke = jest.fn();

jest.mock('@/api/base44Client', () => ({
  getBase44: () => ({ functions: { invoke: mockInvoke } }),
}));

import { invokeFunction } from '../entities';

describe('invokeFunction', () => {
  beforeEach(() => mockInvoke.mockReset());

  it('déballe la réponse axios { data, status, headers, config }', async () => {
    mockInvoke.mockResolvedValue({
      data: { clientSecret: 'pi_123_secret' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
      request: {},
    });
    const res = await invokeFunction<{ clientSecret: string }>('createPaymentIntent', {
      amount: 10,
    });
    expect(res.clientSecret).toBe('pi_123_secret');
    expect(mockInvoke).toHaveBeenCalledWith('createPaymentIntent', { amount: 10 });
  });

  it('laisse passer un corps déjà déballé', async () => {
    mockInvoke.mockResolvedValue({ access_token: 'tok' });
    const res = await invokeFunction<{ access_token: string }>('handleCustomAuth', {});
    expect(res.access_token).toBe('tok');
  });

  it('ne confond pas un corps métier qui contient une clé `data`', async () => {
    mockInvoke.mockResolvedValue({ data: { success: true } });
    const res = await invokeFunction<{ data: { success: boolean } }>('handleCustomAuth', {});
    expect(res.data.success).toBe(true);
  });
});
