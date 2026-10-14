// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Ensure font assets (.ttf, .otf) are included in assetExts
if (!config.resolver.assetExts.includes('ttf')) {
  config.resolver.assetExts.push('ttf');
}
if (!config.resolver.assetExts.includes('otf')) {
  config.resolver.assetExts.push('otf');
}

// Add mjs and cjs to source extensions for modern packages
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

// TanStack Query v5 exports configuration for React Native Metro bundler
config.resolver.unstable_conditionNames = [
  '@tanstack/custom-condition',
  'react-native',
  'import',
  'require',
];

// Resolve TanStack React Query to its native TypeScript source files
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@tanstack/react-query') {
    return {
      filePath: path.resolve(__dirname, 'node_modules/@tanstack/react-query/src/index.ts'),
      type: 'sourceFile',
    };
  }
  if (moduleName === '@tanstack/query-core') {
    return {
      filePath: path.resolve(__dirname, 'node_modules/@tanstack/query-core/src/index.ts'),
      type: 'sourceFile',
    };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
