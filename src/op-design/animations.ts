import { Animated } from "react-native";

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
      outputRange: [from, from, to],
    };
  }
  return {
    inputRange: [0, 1],
    outputRange: [from, to],
  };
};

const fade = (animValue: Animated.Value, config: Config = {}) => ({
  opacity: animValue.interpolate(createInterpolationRanges(0, 1, config)),
});

const slide = (
  animValue: Animated.Value,
  from: "top" | "bottom",
  config: Config = {},
  scale: (n: number) => number
) => ({
  transform: [
    {
      translateY: animValue.interpolate(
        createInterpolationRanges(
          from === "top" ? -scale(20) : +scale(20),
          1,
          config
        )
      ),
    },
  ],
});

const fadeSlideTop = (
  animValue: Animated.Value,
  scale: (n: number) => number,
  config: Config = {}
) => ({
  ...fade(animValue, config),
  ...slide(animValue, "top", config, scale),
});

const fadeSlideBottom = (
  animValue: Animated.Value,
  scale: (n: number) => number,
  config: Config = {}
) => ({
  ...fade(animValue, config),
  ...slide(animValue, "bottom", config, scale),
});

export const animations = {
  fade,
  slide,
  fadeSlideBottom,
  fadeSlideTop,
};
