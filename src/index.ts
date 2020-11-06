import { AppRegistry } from "react-native";
import { App } from "op-core";

AppRegistry.registerComponent("OrdinaryPuzzles", () => App);

// @ts-ignore
document.fonts.ready.then(() => {
  // Load the app only when all the fonts are loaded
  AppRegistry.runApplication("OrdinaryPuzzles", {
    rootTag: document.getElementById("root"),
  });
});
