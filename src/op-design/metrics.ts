import { Dimensions } from "react-native";
import { scale } from "op-utils";

export const metrics = {
  screenWidth: Dimensions.get("screen").width,
  screenHeight: Dimensions.get("screen").height,
  screenMargin: scale(16)
};
