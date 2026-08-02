// Turn "simulateProduction" on to simulate a production environment
const simulateProduction = false;

// Enable MobX logging (trough the mobx-logger lib)
const _enableMobxLogging = true;

// Don't show the splash screen
const _skipSplashScreen = false;

// Clean the local-storage
const _simulateFirstLoad = false;

// Auto-solve the puzzle after 2000 ms
const _autoSolve = false;

// Test builds opt into deterministic completion on every platform: the browser
// suite uses it through "export:web:e2e", the Maestro suite through the "e2e"
// EAS profile. Expo replaces EXPO_PUBLIC_* values at bundle time, so store
// builds keep this disabled because no release profile sets the variable.
const e2eAutoSolve = process.env.EXPO_PUBLIC_E2E_AUTO_SOLVE === "1";

export const e2eAutoSolveDisableStorageKey =
  "__ordinaryPuzzlesE2EDisableAutoSolve";

// Use the Averta font?
const _useAvertaFont = true;

// To be safe, let's make sure we don't user development settings in production
const isDevelopment = __DEV__ && !simulateProduction;
export const enableMobxLogging = isDevelopment && _enableMobxLogging;
export const skipSplashScreen = isDevelopment && _skipSplashScreen;
export const simulateFirstLoad = isDevelopment && _simulateFirstLoad;
export const autoSolve = (isDevelopment && _autoSolve) || e2eAutoSolve;
export const autoSolveDelay = e2eAutoSolve ? 500 : 2_000;
export const useAvertaFont = _useAvertaFont;
