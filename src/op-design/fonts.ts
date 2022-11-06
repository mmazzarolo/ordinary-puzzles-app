import { supportsAvertaFont } from "op-config";
import { Platform } from "react-native";

export const fontAssets = {
  "Averta-Regular": require("../../assets/fonts/Averta-Regular.otf"),
  "Averta-Semibold": require("../../assets/fonts/Averta-Semibold.otf"),
  "Averta-Bold": require("../../assets/fonts/Averta-Bold.otf"),
};

if (Platform.OS === "android") {
  fontAssets["Inter-SemiBold"] = require("../../assets/fonts/Inter-SemiBold.otf");
}

// Font used across the entire app (menu, title, messages, buttons).
// In production it's the "Averta" font.
// I'm not distributing the Averta font on GitHub.
// If you want to contribute, you can toggle off the "supportsAvertaFont" config
// variable.
const primaryFont = {
  regular: {
    fontFamily: supportsAvertaFont ? "Averta-Regular" : undefined,
    fontWeight: "400",
  },
  semibold: {
    fontFamily: supportsAvertaFont ? "Averta-Semibold" : undefined,
    fontWeight: "500",
  },
  bold: {
    fontFamily: supportsAvertaFont ? "Averta-Bold" : undefined,
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
