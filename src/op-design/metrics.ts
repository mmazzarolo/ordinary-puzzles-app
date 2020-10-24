import { Dimensions, Platform } from "react-native";
import { scale } from "op-utils";

export const metrics = {
  screenWidth: Platform.select({
    native: Dimensions.get("screen").width,
    default: Dimensions.get("window").width,
  }),
  screenHeight: Platform.select({
    native: Dimensions.get("screen").height,
    default: Dimensions.get("window").height,
  }),
  screenMargin: scale(16),
};
