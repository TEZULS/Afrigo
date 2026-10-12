/** @type {import('@expo/config').ExpoConfig} */
const fs = require('fs');
const path = require('path');
const appJson = require('./app.json');

/**
 * Push Android : sans configuration Firebase, aucun jeton push n'est délivré
 * sur Android. Déposer le google-services.json du projet Firebase AfriGo à côté
 * de app.json suffit : il est alors pris en compte automatiquement au build.
 */
const googleServicesFile = fs.existsSync(path.join(__dirname, 'google-services.json'))
  ? './google-services.json'
  : undefined;

const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
const googleUrlScheme = googleIosClientId
  ? googleIosClientId.split('.').reverse().join('.')
  : 'com.googleusercontent.apps.placeholder';

/**
 * Environnement APNs : « production » pour les builds TestFlight / App Store
 * (push envoyées par Apple en Production), « development » pour le build dev.
 */
const apsEnvironment = process.env.EAS_BUILD_PROFILE === 'development' ? 'development' : 'production';

const basePlugins = appJson.expo.plugins ?? [];
const plugins = [
  ...basePlugins
    .filter(
      (p) =>
        p !== 'expo-apple-authentication' &&
        !(Array.isArray(p) && p[0] === '@react-native-google-signin/google-signin'),
    )
    .map((p) =>
      Array.isArray(p) && p[0] === 'expo-notifications'
        ? ['expo-notifications', { ...p[1], mode: apsEnvironment }]
        : p,
    ),
  'expo-apple-authentication',
  ['@react-native-google-signin/google-signin', { iosUrlScheme: googleUrlScheme }],
];

module.exports = {
  expo: {
    ...appJson.expo,
    ios: {
      ...appJson.expo.ios,
      usesAppleSignIn: true,
      entitlements: {
        ...(appJson.expo.ios?.entitlements ?? {}),
        'aps-environment': apsEnvironment,
      },
    },
    android: {
      ...appJson.expo.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
    plugins,
  },
};
