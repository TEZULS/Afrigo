/** @type {import('@expo/config').ExpoConfig} */
const appJson = require('./app.json');

const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
const googleUrlScheme = googleIosClientId
  ? googleIosClientId.split('.').reverse().join('.')
  : 'com.googleusercontent.apps.placeholder';

const basePlugins = appJson.expo.plugins ?? [];
const plugins = [
  ...basePlugins.filter(
    (p) =>
      p !== 'expo-apple-authentication' &&
      !(Array.isArray(p) && p[0] === '@react-native-google-signin/google-signin'),
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
    },
    plugins,
  },
};
