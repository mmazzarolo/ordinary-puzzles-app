import ReactNativeHaptic from "react-native-haptic";
import { Platform } from "react-native";

export const hapticFeedback = {
  generate: Platform.OS === "ios" ? ReactNativeHaptic.generate : () => undefined
};
