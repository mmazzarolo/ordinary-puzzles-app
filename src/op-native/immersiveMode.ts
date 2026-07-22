import { NavigationBar, addVisibilityListener } from "expo-navigation-bar";
import { Platform } from "react-native";

const hideNavigationBar = () => {
  NavigationBar.setHidden(true);
};

export const enableImmersiveMode = () => {
  if (Platform.OS !== "android") {
    return undefined;
  }

  hideNavigationBar();
  const subscription = addVisibilityListener(({ visibility }) => {
    if (visibility === "visible") {
      hideNavigationBar();
    }
  });

  return () => {
    subscription.remove();
  };
};
