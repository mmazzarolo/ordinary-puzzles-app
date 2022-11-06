import { impactAsync, ImpactFeedbackStyle } from "expo-haptics";
import { Platform } from "react-native";

export const ImpactFeedbackType = ImpactFeedbackStyle;

export const hapticFeedback = {
  generate: Platform.OS === "ios" ? impactAsync : () => undefined,
};
