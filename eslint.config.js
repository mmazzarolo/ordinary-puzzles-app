const { defineConfig, globalIgnores } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  globalIgnores([
    "android/**",
    "ios/**",
    "build/**",
    "node_modules/**",
    "expo-template/**",
    "src/index.native.ts",
    "src/index.web.ts",
    "src/service-worker.ts",
    "src/serviceWorkerRegistration.ts",
  ]),
  expoConfig,
]);
