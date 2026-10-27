import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { act, renderWithProviders } from '@/__tests__/test-utils';

const mockReset = jest.fn();
let mockRootRoute = 'ClientTabs';
let mockCurrentRoute = 'Checkout';
let mockOpenedFromPush = false;
jest.mock('@/navigation/navigationRef', () => ({
  openedFromPushRecently: () => mockOpenedFromPush,
  navigationRef: {
    isReady: () => true,
    getRootState: () => ({ index: 0, routes: [{ name: mockRootRoute }] }),
    getCurrentRoute: () => ({ name: mockCurrentRoute }),
    reset: (state: unknown) => mockReset(state),
  },
}));

/** Paiement par carte en cours (validation de la banque possible hors de l'app). */
let mockCardPaymentInProgress = false;
jest.mock('@/services/cardPayment', () => ({
  isCardPaymentInProgress: () => mockCardPaymentInProgress,
}));

import { RESUME_REFRESH_AFTER_MS, ResumeRefresh, shouldResetOnResume } from '../ResumeRefresh';

let emit: (state: AppStateStatus) => void = () => {};
let now = 1_000_000;

beforeEach(() => {
  jest.clearAllMocks();
  mockRootRoute = 'ClientTabs';
  mockCurrentRoute = 'Checkout';
  mockOpenedFromPush = false;
  mockCardPaymentInProgress = false;
  now = 1_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    emit = handler as (state: AppStateStatus) => void;
    return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
});
afterEach(() => jest.restoreAllMocks());

/** L'app passe en arrière-plan puis revient après `minutes`. */
const leaveFor = (minutes: number) => {
  act(() => emit('background'));
  now += minutes * 60 * 1000;
  act(() => emit('active'));
};

describe('ResumeRefresh', () => {
  it('après 5 min ailleurs, ramène le client sur l’accueil', () => {
    renderWithProviders(<ResumeRefresh />);
    leaveFor(6);
    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'ClientTabs', params: { screen: 'HomeTab' } }],
    });
  });

  it('ouverte par une notification : reste sur l’écran qu’elle ouvre', () => {
    renderWithProviders(<ResumeRefresh />);
    mockOpenedFromPush = true;
    leaveFor(30);
    expect(mockReset).not.toHaveBeenCalled();
  });

  it('une absence courte ne change rien', () => {
    renderWithProviders(<ResumeRefresh />);
    leaveFor(2);
    expect(mockReset).not.toHaveBeenCalled();
  });

  it('n’interrompt ni un paiement par carte, ni l’espace livreur', () => {
    renderWithProviders(<ResumeRefresh />);
    // Validation 3-D Secure dans l'app de la banque, depuis la page de validation.
    mockCardPaymentInProgress = true;
    leaveFor(10);
    mockCardPaymentInProgress = false;
    mockCurrentRoute = 'DelivererDashboard';
    mockRootRoute = 'DelivererStack';
    leaveFor(10);
    expect(mockReset).not.toHaveBeenCalled();
  });
});

describe('ResumeRefresh — mesure depuis la dernière activité', () => {
  it('iOS : l’événement « arrière-plan » traité seulement au retour ne masque plus l’absence', () => {
    renderWithProviders(<ResumeRefresh />);
    // L'app a été suspendue aussitôt : rien n'est traité pendant 6 minutes…
    now += 6 * 60 * 1000;
    // … puis, au retour, « background » et « active » arrivent coup sur coup.
    act(() => emit('background'));
    act(() => emit('active'));
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it('le battement rattrapé au réveil suffit, même sans événement', () => {
    jest.useFakeTimers({ doNotFake: ['Date'] });
    // Dans le mock de React Native, `currentState` est une fonction ; dans l'app, une chaîne.
    const original = AppState.currentState;
    (AppState as { currentState: unknown }).currentState = 'active';
    try {
      renderWithProviders(<ResumeRefresh />);
      now += 6 * 60 * 1000;
      act(() => {
        jest.advanceTimersByTime(10_000);
      });
      expect(mockReset).toHaveBeenCalledTimes(1);
      // Les battements suivants ne relancent rien.
      act(() => {
        jest.advanceTimersByTime(30_000);
      });
      expect(mockReset).toHaveBeenCalledTimes(1);
    } finally {
      (AppState as { currentState: unknown }).currentState = original;
      jest.useRealTimers();
    }
  });
});

describe('shouldResetOnResume', () => {
  it('seuil de 5 minutes', () => {
    expect(shouldResetOnResume(RESUME_REFRESH_AFTER_MS, 'ClientTabs', 'HomeTab')).toBe(true);
    expect(shouldResetOnResume(RESUME_REFRESH_AFTER_MS - 1, 'ClientTabs', 'HomeTab')).toBe(false);
    expect(shouldResetOnResume(RESUME_REFRESH_AFTER_MS, 'AdminDrawer', 'AdminDashboard')).toBe(false);
    expect(shouldResetOnResume(RESUME_REFRESH_AFTER_MS, 'Login', 'Login')).toBe(false);
  });
});
