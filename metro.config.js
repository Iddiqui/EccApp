const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    // Android build output folders ko Metro ignore karega.
    // (Gradle build ke waqt ye folders bante aur delete hote hain, isse Metro crash ho jata tha.)
    blockList: [
      /.*[\\/]node_modules[\\/].*[\\/]android[\\/]build[\\/].*/,
      /.*[\\/]android[\\/]app[\\/]build[\\/].*/,
      /.*[\\/]android[\\/]\.cxx[\\/].*/,
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);