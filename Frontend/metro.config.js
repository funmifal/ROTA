// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure font assets (.ttf, .otf) are included in assetExts
if (!config.resolver.assetExts.includes('ttf')) {
  config.resolver.assetExts.push('ttf');
}
if (!config.resolver.assetExts.includes('otf')) {
  config.resolver.assetExts.push('otf');
}

module.exports = config;
