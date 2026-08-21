const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const existingBlockList = config.resolver.blockList
  ? Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : [config.resolver.blockList]
  : [];

config.resolver.blockList = [
  ...existingBlockList,
  /node_modules[\\/]expo-modules-core[\\/]expo-module-gradle-plugin[\\/]bin[\\/].*/,
];

module.exports = config;
