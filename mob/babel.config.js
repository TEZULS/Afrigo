module.exports = function (api) {
  api.cache(true);
  const isTest = process.env.NODE_ENV === 'test';
  const presets = isTest
    ? ['babel-preset-expo']
    : [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'];
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
