import React, { FC } from "react";
import { StatusBar, Platform, UIManager } from "react-native";
import RNBootSplash from "react-native-bootsplash";
// @ts-ignore
import { Immersive } from "react-native-immersive";
import { configure } from "mobx";
import { enableLogging } from "mobx-logger";
import { useOnMount, clearStorage, initializeAudio } from "op-utils";
import { AppearanceProvider } from "react-native-appearance";
import { simulateFirstLoad, enableMobxLogging } from "op-config";
import { Main } from "./Main";
import { useCoreStores } from "./store";

configure({
  enforceActions: "always"
});

if (enableMobxLogging) {
  enableLogging({});
}

if (Platform.OS === "android") {
  Immersive.on();
  Immersive.setImmersive(true);
  Immersive.addImmersiveListener(() => Immersive.on());
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

export const App: FC = function() {
  const { initializeStore } = useCoreStores();
  const initializeApp = async () => {
    if (simulateFirstLoad) {
      await clearStorage();
    }
    await initializeStore();
    initializeAudio();
    RNBootSplash.hide();
  };
  useOnMount(() => {
    initializeApp();
  });
  return (
    <>
      <StatusBar hidden />
      <AppearanceProvider>
        <Main />
      </AppearanceProvider>
    </>
  );
};
