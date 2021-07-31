import React, { FC } from "react";
import { Animated } from "react-native";
import { Text, TextProps } from "op-common";
import { animations } from "op-design";
import { useScale } from "op-utils";

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
  const scale = useScale();
  const charAnimatedStyle = animations.fadeSlideBottom(animValue, scale, {
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
