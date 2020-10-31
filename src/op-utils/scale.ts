import { PixelRatio, Dimensions, Platform } from "react-native";

const isTablet = () => {
  let pixelDensity = PixelRatio.get();
  const adjustedWidth = Dimensions.get("screen").width * pixelDensity;
  const adjustedHeight = Dimensions.get("screen").height * pixelDensity;
  if (pixelDensity < 2 && (adjustedWidth >= 1000 || adjustedHeight >= 1000)) {
    return true;
  } else
    return (
      pixelDensity === 2 && (adjustedWidth >= 1920 || adjustedHeight >= 1920)
    );
};

export const scale = (size: number) => {
  if (Platform.OS === "android" || Platform.OS === "ios") {
    const GUIDELINE_BASE_WIDTH = isTablet() ? 520 : 350;
    return (Dimensions.get("window").width / GUIDELINE_BASE_WIDTH) * size;
  }
  return size;
};

export const scaleTextToFit = (text: string) => {
  const weight = text
    .split("")
    .map((char) => {
      if (["i", "l", "j", "f", "r", "t"].indexOf(char) >= 0) {
        return 0.7;
      } else if (["m", "w"].indexOf(char) >= 0) {
        return 2;
      } else {
        return 1;
      }
    })
    .reduce((a, b) => a + b, 0);
  if (weight <= 12) {
    return scale(48);
  } else {
    return scale(48 - (weight - 12) * 2.5);
  }
};
