jest.mock('@react-navigation/native', () => {
  const ref = { isReady: jest.fn(() => false), navigate: jest.fn() };
  return { createNavigationContainerRef: () => ref, __ref: ref };
});

import {
  flushPendingNavigation,
  markOpenedFromPush,
  navigateWhenReady,
  openedFromPushRecently,
} from '../navigationRef';

const mockRef = jest.requireMock('@react-navigation/native').__ref as {
  isReady: jest.Mock;
  navigate: jest.Mock;
};

describe('navigationRef', () => {
  beforeEach(() => jest.clearAllMocks());

  it('garde la navigation demandée avant que le conteneur soit prêt, puis l’exécute', () => {
    mockRef.isReady.mockReturnValue(false);
    expect(navigateWhenReady('OrderDetails', { id: 'o1' })).toBe(false);
    expect(mockRef.navigate).not.toHaveBeenCalled();

    mockRef.isReady.mockReturnValue(true);
    flushPendingNavigation();
    expect(mockRef.navigate).toHaveBeenCalledWith('OrderDetails', { id: 'o1' });

    flushPendingNavigation();
    expect(mockRef.navigate).toHaveBeenCalledTimes(1);
  });

  it('navigue tout de suite quand le conteneur est prêt', () => {
    mockRef.isReady.mockReturnValue(true);
    expect(navigateWhenReady('ClientTabs', { screen: 'CartTab' })).toBe(true);
    expect(mockRef.navigate).toHaveBeenCalledWith('ClientTabs', { screen: 'CartTab' });
  });

  it('retient l’ouverture par une notification quelques secondes', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(10_000);
    markOpenedFromPush();
    expect(openedFromPushRecently()).toBe(true);
    now.mockReturnValue(16_000);
    expect(openedFromPushRecently()).toBe(false);
    now.mockRestore();
  });
});
