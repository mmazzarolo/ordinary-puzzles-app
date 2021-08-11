/* global __ELECTRON__ */
import { AppRegistry } from "react-native";
import { App } from "op-core";
import * as serviceWorkerRegistration from "./serviceWorkerRegistration";

AppRegistry.registerComponent("OrdinaryPuzzles", () => App);

// Load the app only when all the fonts are loaded
Promise.all([
  // @ts-ignore
  document.fonts.load("12px Averta-Bold"),
  // @ts-ignore
  document.fonts.load("12px Averta-Semibold"),
  // @ts-ignore
  document.fonts.load("12px Averta-Regular"),
]).then((f) => {
  AppRegistry.runApplication("OrdinaryPuzzles", {
    rootTag: document.getElementById("root"),
  });
});

// Opt-out of the service-worker in Electron
// @ts-ignore
if (!__ELECTRON__) {
  serviceWorkerRegistration.register();
}
