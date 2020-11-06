import { Platform } from "react-native";
import { useAvertaFont } from "op-config";

// Font used across the entire app (menu, title, messages, buttons).
// In production it's the "Averta" font.
// I'm not distributing the Averta font on GitHub.
// If you want to contribute, you can toggle off the "useAvertaFont" config
// variable.
const primaryFont = {
  regular: {
    fontFamily: useAvertaFont ? "Averta-Regular" : undefined,
    fontWeight: "400",
  },
  semibold: {
    fontFamily: useAvertaFont ? "Averta-Semibold" : undefined,
    fontWeight: "500",
  },
  bold: {
    fontFamily: useAvertaFont ? "Averta-Bold" : undefined,
    fontWeight: Platform.select({
      native: "600",
      default: "500", // On the web this alligns the Safari and Chrome rendering
    }),
  },
};

// Font used for numbers (just for semibold).
// It's the open-source "Inter" font on Android, "San-Francisco" on iOS.
const secondaryFont = {
  semibold: {
    fontFamily: Platform.OS === "android" ? "Inter-SemiBold" : undefined,
    fontWeight: "600",
  },
  bold: {},
  regular: {},
};

export const fonts = {
  primary: primaryFont,
  secondary: secondaryFont,
};
