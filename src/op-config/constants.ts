// Turn "simulateProduction" on to simulate a production environment
const simulateProduction = false;

// Enable MobX logging (trough the mobx-logger lib)
const _enableMobxLogging = true;

// Don't show the splash screen
const _skipSplashScreen = true;

// Clean the local-storage
const _simulateFirstLoad = false;

// Auto-solve the puzzle after 2000 ms
const _autoSolve = false;

// Use the Averta font?
const _useAvertaFont = true;

// To be safe, let's make sure we don't user development settings in production
const isDevelopment = __DEV__ && !simulateProduction;
export const enableMobxLogging = isDevelopment && _enableMobxLogging;
export const skipSplashScreen = isDevelopment && _skipSplashScreen;
export const simulateFirstLoad = isDevelopment && _simulateFirstLoad;
export const autoSolve = isDevelopment && _autoSolve;
export const useAvertaFont = !isDevelopment || _useAvertaFont;
