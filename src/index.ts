import { AppRegistry } from "react-native";
import { App } from "op-core";

AppRegistry.registerComponent("OrdinaryPuzzles", () => App);
AppRegistry.runApplication("OrdinaryPuzzles", {
  rootTag: document.getElementById("root"),
});
