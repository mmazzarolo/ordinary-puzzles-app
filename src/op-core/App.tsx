import React, { FC, useEffect, useRef, useState } from "react";
import { StatusBar, Platform, UIManager } from "react-native";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { configure } from "mobx";
import { clearStorage, initializeAudio } from "op-utils";
import { simulateFirstLoad } from "op-config";
import { enableImmersiveMode } from "op-native/immersiveMode";
import { registerServiceWorker } from "op-web/registerServiceWorker";
import { Main } from "./Main";
import { useCoreStores } from "./store";

configure({
  enforceActions: "always",
});

void SplashScreen.preventAutoHideAsync();

if (Platform.OS === "android") {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

export const App: FC = function () {
  const { initializeStore } = useCoreStores();
  const didInitializeRef = useRef(false);
  const [appReady, setAppReady] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    "Averta-Bold": require("../../assets/fonts/Averta-Bold.otf"),
    "Averta-Regular": require("../../assets/fonts/Averta-Regular.otf"),
    "Averta-Semibold": require("../../assets/fonts/Averta-Semibold.otf"),
    "Inter-SemiBold": require("../../assets/fonts/Inter-SemiBold.otf"),
  });

  const initializeApp = async () => {
    if (didInitializeRef.current || !fontsLoaded) return;
    didInitializeRef.current = true;
    try {
      if (simulateFirstLoad) {
        await clearStorage();
      }
      await initializeStore();
      void initializeAudio();
      if (Platform.OS === "web" && process.env.NODE_ENV === "production") {
        registerServiceWorker();
      }
    } finally {
      setAppReady(true);
      await SplashScreen.hideAsync();
    }
  };

  useEffect(() => {
    void initializeApp().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontsLoaded]);

  useEffect(() => enableImmersiveMode(), []);

  if (fontError) throw fontError;
  if (!fontsLoaded || !appReady) return null;

  return (
    <>
      <StatusBar hidden />
      <Main />
    </>
  );
};
