import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

type HapticFeedbackType = "impactLight" | "impactMedium";

export const hapticFeedback = {
  generate: (type: HapticFeedbackType = "impactLight") => {
    if (Platform.OS === "android") {
      return Haptics.performAndroidHapticsAsync(
        type === "impactMedium"
          ? Haptics.AndroidHaptics.Virtual_Key
          : Number(Platform.Version) >= 34
            ? Haptics.AndroidHaptics.Segment_Frequent_Tick
            : Haptics.AndroidHaptics.Clock_Tick,
      );
    }
    if (Platform.OS !== "ios") return undefined;
    const style =
      type === "impactMedium"
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light;
    return Haptics.impactAsync(style);
  },
};
