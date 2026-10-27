import React from 'react';
import { Linking } from 'react-native';
import { handleURLCallback } from '@stripe/stripe-react-native';
import { renderWithProviders } from '@/__tests__/test-utils';
import { StripeReturnUrlHandler } from '../StripeReturnUrlHandler';

describe('StripeReturnUrlHandler — retour de la page de validation de la banque (iPhone)', () => {
  it('rend le lien `afrigo://safepay/…` à Stripe, et cesse d’écouter une fois retiré', () => {
    const remove = jest.fn();
    let onUrl: (event: { url: string }) => void = () => {};
    const spy = jest.spyOn(Linking, 'addEventListener').mockImplementation((_type, handler) => {
      onUrl = handler as typeof onUrl;
      return { remove } as unknown as ReturnType<typeof Linking.addEventListener>;
    });

    const { unmount } = renderWithProviders(<StripeReturnUrlHandler />);
    onUrl({ url: 'afrigo://safepay/redirect_complete' });
    expect(handleURLCallback).toHaveBeenCalledWith('afrigo://safepay/redirect_complete');

    unmount();
    expect(remove).toHaveBeenCalled();
    spy.mockRestore();
  });
});
