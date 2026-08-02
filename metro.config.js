// Metro configuration.
//
// This extends Expo's defaults. Expo does merge a bare config object over them,
// so the previous plain object worked, but it read like a React Native CLI file
// and hid what the project actually changes. Start from getDefaultConfig and
// state the difference.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Expo turns experimentalImportSupport on by default. This project turns it
// off, because the Hermes bundle measures smaller that way:
//
//   experimentalImportSupport: false -> 1,961,770 bytes
//   experimentalImportSupport: true  -> 2,029,905 bytes  (+68 KB, +3.5%)
//
// Measured on SDK 57 with "expo export --platform android". SDK 56 showed the
// same gap (+3.2%), so it is not a one-release accident. Build time is the same
// either way.
//
// Measure again at the next SDK upgrade. Expo keeps the flag on by default, and
// the setting that wins today may not keep winning.
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: false,
  },
});

module.exports = config;
