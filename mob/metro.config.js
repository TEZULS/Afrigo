const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

config.resolver.alias = {
  '@': path.resolve(projectRoot, 'src'),
};

const metroConfig = withNativeWind(config, { input: './global.css' });

const upstreamResolveRequest = metroConfig.resolver.resolveRequest;

metroConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  if (typeof moduleName === 'string' && moduleName.startsWith('@/')) {
    const rest = moduleName.slice(2);
    if (rest.startsWith('assets/')) {
      const abs = path.resolve(projectRoot, rest);
      if (upstreamResolveRequest) {
        return upstreamResolveRequest(context, abs, platform);
      }
      return context.resolveRequest(context, abs, platform);
    }
    // @/screens/..., @/constants/..., etc. (Babel peut laisser l’alias à Metro.)
    const abs = path.resolve(projectRoot, 'src', rest);
    if (upstreamResolveRequest) {
      return upstreamResolveRequest(context, abs, platform);
    }
    return context.resolveRequest(context, abs, platform);
  }
  if (upstreamResolveRequest) {
    return upstreamResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = metroConfig;
