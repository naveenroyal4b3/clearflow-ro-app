// The app shares the GST and Supabase data code with the web app in ../src.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.watchFolders = [...(config.watchFolders || []), path.resolve(__dirname, '../src')];
// Files in ../src resolve packages (such as Babel's runtime helpers) from this app's node_modules.
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
module.exports = config;
