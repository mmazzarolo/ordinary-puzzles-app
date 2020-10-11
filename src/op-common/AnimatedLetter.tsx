import React, { FC } from "react";
import { Animated } from "react-native";
import { Text, TextProps } from "op-common";
import { animations } from "op-design";

interface AnimatedLetterProps extends TextProps {
  animValue: Animated.Value;
  delay: number;
  value: string;
  secondary?: boolean;
}

export const AnimatedLetter: FC<AnimatedLetterProps> = function ({
  animValue,
  delay,
  style,
  value,
  secondary,
}) {
  const charAnimatedStyle = animations.fadeSlideBottom(animValue, {
    interpolateStart: delay,
  });
  return (
    <Text
      weight="bold"
      secondary={secondary}
      style={[style, charAnimatedStyle]}
    >
      {value}
    </Text>
  );
};
