import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

export const hapticFeedback = {
  generate: (type?: string) => {
    if (Platform.OS !== "ios") return undefined;
    const style =
      type === "impactMedium"
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light;
    return Haptics.impactAsync(style);
  },
};
