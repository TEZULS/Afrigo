module.exports = function (api) {
  api.cache(true);
  const isTest = process.env.NODE_ENV === 'test';
  /*
    Pas de NativeWind ici (ni `jsxImportSource: 'nativewind'`, ni le preset
    `nativewind/babel`). L'app n'utilise aucun `className` et le runtime JSX
    de NativeWind 4.1 enveloppait chaque composant natif (View, Text,
    ScrollView, Pressable…) dans un wrapper qui **perd la `ref`** avec React
    Native 0.83 (composants fonction recevant `ref` en prop) : sur l'appareil,
    `FlatList/SectionList.scrollTo*`, `ScrollView.scrollTo` et tout
    `ref.measure()` étaient silencieusement inopérants (flèche « retour en
    haut », remontée du champ actif au-dessus du clavier…), alors que Jest —
    sans NativeWind — passait.
  */
  const presets = ['babel-preset-expo'];
  const plugins = [
    [
      'module-resolver',
      {
        root: ['./'],
        alias: {
          '@/api': './src/api',
          '@/components': './src/components',
          '@/screens': './src/screens',
          '@/hooks': './src/hooks',
          '@/lib': './src/lib',
          '@/theme': './src/theme',
          '@/navigation': './src/navigation',
          '@/services': './src/services',
          '@/stores': './src/stores',
          '@/utils': './src/utils',
          '@/types': './src/types',
          '@/config': './src/config',
          '@/assets': './assets',
          '@': './src',
        },
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
      },
    ],
  ];
  if (!isTest) plugins.push('react-native-worklets/plugin');
  return { presets, plugins };
};
