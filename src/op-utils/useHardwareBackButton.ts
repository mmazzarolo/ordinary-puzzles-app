import { useRef } from "react";
import { NativeEventSubscription, BackHandler } from "react-native";
import { useOnMount } from "./useOnMount";

export function useHardwareBackButton(onBackButtonPress: () => void) {
  const backHandlerRef = useRef<NativeEventSubscription>();
  useOnMount(() => {
    backHandlerRef.current = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        onBackButtonPress();
        return true;
      }
    );
    return () => {
      if (backHandlerRef.current) {
        backHandlerRef.current.remove();
      }
    };
  });
}
