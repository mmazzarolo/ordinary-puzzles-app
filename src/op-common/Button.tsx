import React, { FC } from "react";
import {
  StyleSheet,
  TouchableOpacity,
  StyleProp,
  TouchableOpacityProps,
  ViewStyle,
} from "react-native";
import { hapticFeedback, scale, playSound } from "op-utils";
import { Text, TextFamily, TextWeight } from "./Text";

export const defaultButtonTextSize = scale(32);

interface ButtonProps extends TouchableOpacityProps {
  highlighted?: boolean;
  label: string;
  textColor?: string;
  textFamily?: TextFamily;
  textSize?: number;
  textWeight?: TextWeight;
}

export const Button: FC<ButtonProps> = function ({
  children,
  highlighted = true,
  label,
  style = {},
  textFamily,
  textSize = defaultButtonTextSize,
  textWeight = "semibold",
  ...otherProps
}) {
  const handlePressIn = () => {
    hapticFeedback.generate("impactMedium");
    playSound("buttonPress");
  };
  return (
    <TouchableOpacity
      style={[styles.touchable, style]}
      onPressIn={handlePressIn}
      {...otherProps}
    >
      <Text
        secondary={!highlighted}
        family={textFamily}
        weight={textWeight}
        style={[
          styles.label,
          highlighted && styles.labelHighlighted,
          { fontSize: textSize },
        ]}
      >
        {label.toLowerCase()}
      </Text>
      {children}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  touchable: {
    flexDirection: "row",
  },
  label: {},
  labelHighlighted: {},
});
