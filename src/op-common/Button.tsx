import React, { FC } from "react";
import {
  StyleSheet,
  TouchableOpacity,
  StyleProp,
  ViewStyle
} from "react-native";
import { hapticFeedback, scale, playSound } from "op-utils";
import { Text } from "./Text";

export const defaultButtonTextSize = scale(32);

interface ButtonProps {
  disabled?: boolean;
  highlighted?: boolean;
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  textColor?: string;
  textSize?: number;
}

export const Button: FC<ButtonProps> = function({
  children,
  disabled = false,
  highlighted = true,
  label,
  onPress,
  style = {},
  textSize = defaultButtonTextSize
}) {
  const handlePressIn = () => {
    hapticFeedback.generate("impactMedium");
    playSound("buttonPress");
  };
  return (
    <TouchableOpacity
      style={[styles.touchable, style]}
      onPress={onPress}
      onPressIn={handlePressIn}
      disabled={disabled}
    >
      <Text
        weight="semibold"
        secondary={!highlighted}
        style={[
          styles.label,
          highlighted && styles.labelHighlighted,
          { fontSize: textSize }
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
    flexDirection: "row"
  },
  label: {},
  labelHighlighted: {}
});
