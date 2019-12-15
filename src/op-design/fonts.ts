import { Platform } from "react-native";

export const fonts = {
  primary: {
    regular: { fontFamily: "Averta-Regular" },
    semibold: { fontFamily: "Averta-Semibold" },
    bold: { fontFamily: "Averta-Bold" }
  },
  secondary: {
    semibold: {
      fontFamily: Platform.OS === "android" ? "Inter-SemiBold" : undefined,
      fontWeight: "600"
    },
    bold: {},
    regular: {}
  }
};
