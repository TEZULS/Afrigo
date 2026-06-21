import React from 'react';
import { renderWithProviders, fireEvent, screen, waitFor } from '@/__tests__/test-utils';
import { ReferralSection } from '../ReferralSection';

describe('ReferralSection', () => {
  it("ne rend rien si user est null", () => {
    renderWithProviders(<ReferralSection user={null} />);
    expect(screen.queryByText('Mon code de parrainage')).toBeNull();
    expect(screen.queryByText('Parrainage')).toBeNull();
  });

  it('affiche le code de parrainage utilisateur', async () => {
    renderWithProviders(
      <ReferralSection
        user={{
          id: 'u1',
          email: 'test@afrigo.fr',
          referral_code: 'REFXDSCOQ',
          wallet_balance: 0,
        }}
      />,
    );
    await waitFor(() => expect(screen.getByText('REFXDSCOQ')).toBeTruthy());
  });

  it("affiche 'Mon code de parrainage' et le bouton Partager", async () => {
    renderWithProviders(
      <ReferralSection
        user={{ id: 'u1', email: 't@x.fr', referral_code: 'REFAAA', wallet_balance: 0 }}
      />,
    );
    await waitFor(() => expect(screen.getByText('Mon code de parrainage')).toBeTruthy());
    expect(screen.getByText(/Partager avec mes amis/)).toBeTruthy();
  });

  it('affiche le formulaire pour appliquer un code si non parrainé', async () => {
    renderWithProviders(
      <ReferralSection
        user={{ id: 'u1', email: 't@x.fr', referral_code: 'REF1', referred_by: null }}
      />,
    );
    await waitFor(() =>
      expect(screen.getByText(/Vous avez un code de parrainage/)).toBeTruthy(),
    );
    expect(screen.getByPlaceholderText('REFXXXXXX')).toBeTruthy();
  });

  it('cache le formulaire si déjà parrainé', async () => {
    renderWithProviders(
      <ReferralSection
        user={{
          id: 'u1',
          email: 't@x.fr',
          referral_code: 'REF1',
          referred_by: 'someone@x.fr',
        }}
      />,
    );
    await waitFor(() =>
      expect(screen.getByText('Vous avez été parrainé par un ami')).toBeTruthy(),
    );
    expect(screen.queryByPlaceholderText('REFXXXXXX')).toBeNull();
  });

  it('met le code saisi en majuscules', async () => {
    renderWithProviders(
      <ReferralSection
        user={{ id: 'u1', email: 't@x.fr', referral_code: 'REF1', referred_by: null }}
      />,
    );
    const input = await screen.findByPlaceholderText('REFXXXXXX');
    fireEvent.changeText(input, 'refxdscoq');
    // Le composant force toUpperCase via onChangeText
    expect(input.props.value).toBe('REFXDSCOQ');
  });
});
