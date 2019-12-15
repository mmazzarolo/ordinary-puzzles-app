import { Animated } from "react-native";
import { scale } from "op-utils";

interface Config {
  interpolateStart?: number;
}

const createInterpolationRanges = (
  from: number,
  to: number,
  config?: Config
) => {
  if (config && config.interpolateStart) {
    return {
      inputRange: [0, config.interpolateStart, 1],
      outputRange: [from, from, to]
    };
  }
  return {
    inputRange: [0, 1],
    outputRange: [from, to]
  };
};

const fade = (animValue: Animated.Value, config: Config = {}) => ({
  opacity: animValue.interpolate(createInterpolationRanges(0, 1, config))
});

const slideValue = scale(20);

const slide = (
  animValue: Animated.Value,
  from: "top" | "bottom",
  config: Config = {}
) => ({
  transform: [
    {
      translateY: animValue.interpolate(
        createInterpolationRanges(
          from === "top" ? -slideValue : +slideValue,
          1,
          config
        )
      )
    }
  ]
});

const fadeSlideTop = (animValue: Animated.Value, config: Config = {}) => ({
  ...fade(animValue, config),
  ...slide(animValue, "top", config)
});

const fadeSlideBottom = (animValue: Animated.Value, config: Config = {}) => ({
  ...fade(animValue, config),
  ...slide(animValue, "bottom", config)
});

export const animations = {
  fade,
  slide,
  fadeSlideBottom,
  fadeSlideTop
};
