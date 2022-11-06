import * as Font from "expo-font";
import { configure } from "mobx";
import { enableLogging } from "mobx-logger";
import { simulateFirstLoad, enableMobxLogging } from "op-config";
import { fontAssets } from "op-design";
import { useOnMount, clearStorage, initializeAudio } from "op-utils";
import { initializeImmersiveMode, useStickyImmersiveReset } from "op-utils/androidImmersiveMode";
import React, { FC } from "react";
import { Platform, UIManager } from "react-native";
import { Main } from "./Main";
import { useCoreStores } from "./store";

configure({
  enforceActions: "always",
});

if (enableMobxLogging) {
  enableLogging({});
}

if (Platform.OS === "android") {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

initializeImmersiveMode();

export const App: FC = function () {
  const { initializeStore } = useCoreStores();
  const [areFontsLoaded] = Font.useFonts(fontAssets);
  useStickyImmersiveReset();
  const initializeApp = async () => {
    if (simulateFirstLoad) {
      await clearStorage();
    }
    await initializeStore();
    initializeAudio();
  };
  useOnMount(() => {
    initializeApp();
  });
  return (
    <>
      <Main areFontsLoaded={areFontsLoaded} />
    </>
  );
};
