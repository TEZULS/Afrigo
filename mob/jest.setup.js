/* eslint-env jest, node */
/* global jest */

// Polyfill: certains modules attendent global.window
require('react-native-gesture-handler/jestSetup');

// Worklets doit être mocké avant Reanimated (Reanimated 4 / SDK 55).
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));

// Reanimated mock — recommandé par la doc Reanimated.
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
);

// Modules natifs Expo : on retourne des stubs neutres pour éviter les
// `NativeUnimoduleProxy is not a function` au chargement.
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(async () => true),
  getStringAsync: jest.fn(async () => ''),
}));

jest.mock('expo-linking', () => ({
  parse: jest.fn(() => ({ queryParams: {} })),
  createURL: jest.fn((path) => `afrigo://${path ?? ''}`),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  getInitialURL: jest.fn(async () => null),
  openURL: jest.fn(async () => {}),
}));

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(async () => ({ type: 'cancel' })),
}));

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(async () => false),
  signInAsync: jest.fn(async () => ({ identityToken: 'apple-token' })),
  formatFullName: jest.fn(() => 'Test User'),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  AppleAuthenticationButtonType: { SIGN_IN: 0 },
  AppleAuthenticationButtonStyle: { BLACK: 0 },
  AppleAuthenticationButton: ({ onPress }: { onPress?: () => void }) => {
    const React = require('react');
    const { Pressable, Text } = require('react-native');
    return React.createElement(
      Pressable,
      { onPress, testID: 'apple-sign-in' },
      React.createElement(Text, null, 'Apple Sign In'),
    );
  },
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signIn: jest.fn(async () => ({
      type: 'success',
      data: { idToken: 'google-token' },
    })),
  },
  GoogleSigninButton: ({ onPress }: { onPress?: () => void }) => {
    const React = require('react');
    const { Pressable, Text } = require('react-native');
    return React.createElement(
      Pressable,
      { onPress, testID: 'google-sign-in' },
      React.createElement(Text, null, 'Google Sign In'),
    );
  },
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
  },
}));

jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Image = (props) => React.createElement(View, props);
  return { Image };
});

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  const LinearGradient = ({ children, ...props }) =>
    React.createElement(View, props, children);
  return { LinearGradient };
});

jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted', granted: true })),
  getPermissionsAsync: jest.fn(async () => ({
    status: 'granted',
    granted: true,
    canAskAgain: true,
  })),
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => {}),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExponentPushToken[test]' })),
  getDevicePushTokenAsync: jest.fn(async () => ({ type: 'ios', data: 'apns-test-token' })),
  setBadgeCountAsync: jest.fn(async () => true),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  getPresentedNotificationsAsync: jest.fn(async () => []),
  dismissNotificationAsync: jest.fn(async () => {}),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addPushTokenListener: jest.fn(() => ({ remove: jest.fn() })),
  clearLastNotificationResponseAsync: jest.fn(async () => {}),
  AndroidImportance: { MAX: 5, HIGH: 4, DEFAULT: 3 },
  AndroidNotificationVisibility: { PUBLIC: 1, PRIVATE: 0, SECRET: -1 },
}));

jest.mock('expo-device', () => ({
  isDevice: true,
  deviceName: 'jest',
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// react-native-toast-message : stub
jest.mock('react-native-toast-message', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Toast = (props) => React.createElement(View, props);
  Toast.show = jest.fn();
  Toast.hide = jest.fn();
  return { __esModule: true, default: Toast };
});

// SDK Base44 — stub minimal compatible avec notre façade
jest.mock('@/api/base44Client', () => {
  const makeEntity = () => ({
    list: jest.fn(async () => []),
    filter: jest.fn(async () => []),
    create: jest.fn(async (x) => ({ id: 'mock', ...(x || {}) })),
    update: jest.fn(async () => ({})),
    delete: jest.fn(async () => ({})),
    read: jest.fn(async () => null),
    get: jest.fn(async () => null),
  });
  // On cache une instance d'entité par nom afin que `getBase44().entities.X.create`
  // retourne TOUJOURS le même mock (sinon spy/clear inopérants côté tests).
  const entitiesCache = {};
  const entitiesProxy = new Proxy(
    {},
    {
      get: (_, prop) => {
        const key = String(prop);
        if (!entitiesCache[key]) entitiesCache[key] = makeEntity();
        return entitiesCache[key];
      },
    },
  );
  const fakeClient = {
    entities: entitiesProxy,
    auth: {
      me: jest.fn(async () => null),
      logout: jest.fn(async () => {}),
      loginViaEmailPassword: jest.fn(async () => ({ access_token: 'tok' })),
      register: jest.fn(async () => ({})),
      resetPasswordRequest: jest.fn(async () => ({})),
      updateMe: jest.fn(async () => ({})),
      list: jest.fn(async () => []),
      filter: jest.fn(async () => []),
      update: jest.fn(async () => ({})),
    },
    functions: new Proxy(
      {},
      {
        get: () => jest.fn(async () => ({ data: { success: true } })),
      },
    ),
    integrations: { Core: {} },
  };
  return {
    getBase44: () => fakeClient,
    setBase44Token: jest.fn(async () => {}),
    hydrateBase44: jest.fn(async () => {}),
    tokenStore: {
      peek: jest.fn(() => null),
      clear: jest.fn(async () => {}),
      get: jest.fn(async () => null),
    },
  };
});

// expo-image-picker
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestCameraPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  MediaTypeOptions: { Images: 'Images', All: 'All', Videos: 'Videos' },
}));

// Notifications app fermée (expo-background-fetch + expo-task-manager).
jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
  isTaskRegisteredAsync: jest.fn(async () => false),
}));
jest.mock('expo-background-fetch', () => ({
  getStatusAsync: jest.fn(async () => 3),
  registerTaskAsync: jest.fn(async () => {}),
  unregisterTaskAsync: jest.fn(async () => {}),
  BackgroundFetchStatus: { Denied: 1, Restricted: 2, Available: 3 },
  BackgroundFetchResult: { NoData: 1, NewData: 2, Failed: 3 },
}));

// Jeton natif : en test, on passe par le mock d'expo-notifications ci-dessus.
jest.mock('@/services/devicePushToken', () => ({
  fetchDevicePushToken: () => require('expo-notifications').getDevicePushTokenAsync(),
}));

// expo-location
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(async () => ({
    coords: { latitude: 0, longitude: 0 },
  })),
}));

// Expo updates
jest.mock('expo-updates', () => ({
  checkForUpdateAsync: jest.fn(async () => ({ isAvailable: false })),
  fetchUpdateAsync: jest.fn(async () => ({})),
  reloadAsync: jest.fn(async () => {}),
  isEnabled: false,
}));

// react-native-maps : View wrapper
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockMap = (props) => React.createElement(View, props, props.children);
  const MockMarker = (props) => React.createElement(View, props, props.children);
  return {
    __esModule: true,
    default: MockMap,
    Marker: MockMarker,
    Polyline: MockMarker,
    PROVIDER_GOOGLE: 'google',
  };
});

// Stripe stub
jest.mock('@stripe/stripe-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    StripeProvider: ({ children }) => React.createElement(View, null, children),
    useStripe: () => ({
      initPaymentSheet: jest.fn(async () => ({ error: null })),
      presentPaymentSheet: jest.fn(async () => ({ error: null })),
    }),
    usePaymentSheet: () => ({
      initPaymentSheet: jest.fn(async () => ({ error: null })),
      presentPaymentSheet: jest.fn(async () => ({ error: null })),
    }),
  };
});

// QR code
jest.mock('react-native-qrcode-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { __esModule: true, default: (props) => React.createElement(View, props) };
});

// SVG : stub Proxy pour exposer chaque sous-composant comme une View
jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Stub = (props) => React.createElement(View, props, props.children);
  return new Proxy(
    { __esModule: true, default: Stub },
    {
      get: (target, prop) =>
        prop in target ? target[prop] : Stub,
    },
  );
});

// Lucide icons — chaque icône doit être un composant React valide en test
jest.mock('lucide-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Icon = (props) => React.createElement(View, { ...props, accessibilityRole: 'image' });
  return new Proxy(
    { __esModule: true, default: Icon },
    {
      get: (target, prop) => (prop in target ? target[prop] : Icon),
    },
  );
});

// FlashList
jest.mock('@shopify/flash-list', () => {
  const React = require('react');
  const { FlatList } = require('react-native');
  return {
    FlashList: React.forwardRef((props, ref) => React.createElement(FlatList, { ref, ...props })),
  };
});

// Bottom sheet (rendu synchrone pour les tests)
jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { View, ScrollView, FlatList } = require('react-native');
  const BottomSheet = React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({
      snapToIndex: jest.fn(),
      close: jest.fn(),
      expand: jest.fn(),
    }));
    return React.createElement(View, props, props.children);
  });
  return {
    __esModule: true,
    default: BottomSheet,
    BottomSheetBackdrop: (p) => React.createElement(View, p),
    BottomSheetView: (p) => React.createElement(View, p, p.children),
    BottomSheetScrollView: ScrollView,
    BottomSheetFlatList: FlatList,
    BottomSheetFooter: ({ children }) => React.createElement(View, null, children),
  };
});

// NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => () => {}),
  fetch: jest.fn(async () => ({ isConnected: true })),
  useNetInfo: () => ({ isConnected: true }),
}));

// React Navigation safe-area : insets neutres
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const insets = { top: 0, bottom: 0, left: 0, right: 0 };
  const frame = { x: 0, y: 0, width: 360, height: 720 };
  return {
    SafeAreaProvider: ({ children }) => React.createElement(View, null, children),
    SafeAreaView: ({ children, ...props }) => React.createElement(View, props, children),
    SafeAreaInsetsContext: { Consumer: ({ children }) => children(insets) },
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
  };
});

// react-native-screens (placeholder simple pour éviter les natifs côté test)
jest.mock('react-native-screens', () => {
  const ActualScreens = jest.requireActual('react-native-screens');
  return {
    ...ActualScreens,
    enableScreens: jest.fn(),
  };
});

// Silencer les warning de console qui rendent les logs de test illisibles.
const ORIG_ERROR = console.error;
console.error = (...args) => {
  const first = args[0];
  if (typeof first === 'string' && /(act\(\.\.\.\)|not wrapped in act)/.test(first)) {
    return;
  }
  ORIG_ERROR(...args);
};
