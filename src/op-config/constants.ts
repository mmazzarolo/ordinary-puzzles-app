const simulateProduction = false;
const isDevelopment = __DEV__ && !simulateProduction;

export const enableMobxLogging = isDevelopment && true;
export const skipSplashScreen = isDevelopment && true;
export const simulateFirstLoad = isDevelopment && false;
export const autoSolve = isDevelopment && false;
