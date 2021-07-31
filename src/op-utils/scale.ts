import {
  PixelRatio,
  Dimensions,
  Platform,
  useWindowDimensions,
} from "react-native";

export type ScalingFunc = (n: number) => number;

const isTablet = () => {
  const pixelDensity = PixelRatio.get();
  const screenDimensions = Dimensions.get("screen");
  const adjustedWidth = screenDimensions.width * pixelDensity;
  const adjustedHeight = screenDimensions.height * pixelDensity;
  if (pixelDensity < 2 && (adjustedWidth >= 1000 || adjustedHeight >= 1000)) {
    return true;
  } else
    return (
      pixelDensity === 2 && (adjustedWidth >= 1920 || adjustedHeight >= 1920)
    );
};

export const useScale = (): ScalingFunc => {
  if (Platform.OS === "android" || Platform.OS === "ios") {
    const windowDimensions = Dimensions.get("window");
    const GUIDELINE_BASE_WIDTH = isTablet() ? 520 : 350;
    return (size: number) =>
      (windowDimensions.width / GUIDELINE_BASE_WIDTH) * size;
  } else {
    /* eslint-disable react-hooks/rules-of-hooks */
    // Yeah, not the cleanest approach here calling a hook conditionally, but
    // we can ensure the order will always be respected because the platform
    // cannot change at runtime.
    const windowDimensions = useWindowDimensions();
    /* eslint-enable react-hooks/rules-of-hooks */
    const GUIDELINE_BASE_WIDTH = 800;
    return (size: number) =>
      (windowDimensions.width / GUIDELINE_BASE_WIDTH) * size;
  }
};

export const scaleTextToFit = (scale: ScalingFunc, text: string) => {
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
