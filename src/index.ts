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

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://cra.link/PWA
serviceWorkerRegistration.register();
