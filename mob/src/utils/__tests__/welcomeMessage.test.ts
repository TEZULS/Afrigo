import { selectWelcomeMessage, welcomeButtonLabel } from '../welcomeMessage';

const base = {
  id: 'w1',
  title: 'Bienvenue',
  message: 'Hello',
  is_active: true,
  target_audience: 'all',
  display_frequency: 'once',
};
const none = { dismissedIds: [], daily: {}, shownThisSession: [] };

describe('selectWelcomeMessage', () => {
  it('premier message actif ciblé', () => {
    expect(selectWelcomeMessage([base], null, none)?.id).toBe('w1');
    expect(selectWelcomeMessage([{ ...base, is_active: false }], null, none)).toBeNull();
    expect(selectWelcomeMessage([], null, none)).toBeNull();
  });

  it('cible invités / inscrits / spécifiques', () => {
    expect(selectWelcomeMessage([{ ...base, target_audience: 'guests' }], null, none)).not.toBeNull();
    expect(selectWelcomeMessage([{ ...base, target_audience: 'guests' }], 'a@x.fr', none)).toBeNull();
    expect(selectWelcomeMessage([{ ...base, target_audience: 'registered' }], null, none)).toBeNull();
    expect(selectWelcomeMessage([{ ...base, target_audience: 'registered' }], 'a@x.fr', none)).not.toBeNull();
    expect(
      selectWelcomeMessage([{ ...base, target_audience: 'specific', specific_users: ['a@x.fr'] }], 'b@x.fr', none),
    ).toBeNull();
    expect(
      selectWelcomeMessage([{ ...base, target_audience: 'specific', specific_users: ['a@x.fr'] }], 'a@x.fr', none),
    ).not.toBeNull();
  });

  it('fréquences : once / daily / every_login', () => {
    expect(selectWelcomeMessage([base], null, { ...none, dismissedIds: ['w1'] })).toBeNull();
    const daily = { ...base, display_frequency: 'daily' };
    const now = new Date('2026-09-18T10:00:00Z');
    expect(selectWelcomeMessage([daily], null, { ...none, daily: { w1: now.toDateString() } }, now)).toBeNull();
    expect(selectWelcomeMessage([daily], null, { ...none, daily: { w1: 'Wed Sep 17 2025' } }, now)).not.toBeNull();
    const every = { ...base, display_frequency: 'every_login' };
    expect(selectWelcomeMessage([every], null, { ...none, dismissedIds: ['w1'] })).not.toBeNull();
    expect(selectWelcomeMessage([every], null, { ...none, shownThisSession: ['w1'] })).toBeNull();
  });

  it('libellé du bouton selon le profil', () => {
    expect(welcomeButtonLabel(base, null)).toBe("S'inscrire/Se connecter");
    expect(welcomeButtonLabel(base, 'a@x.fr')).toBe("J'ai compris");
    expect(welcomeButtonLabel({ ...base, button_text_guest: 'OK', button_text_registered: 'Compris' }, null)).toBe('OK');
    expect(welcomeButtonLabel({ ...base, button_text_registered: 'Compris' }, 'a@x.fr')).toBe('Compris');
  });
});
