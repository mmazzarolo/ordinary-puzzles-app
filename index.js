import { AppRegistry } from "react-native";
import { App } from "./src/op-core";
import { name as appName } from "./app.json";

AppRegistry.registerComponent(appName, () => App);
