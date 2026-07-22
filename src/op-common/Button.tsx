import React, { FC } from "react";
import { TouchableOpacity, TouchableOpacityProps } from "react-native";
import { hapticFeedback, playSound, ScalingFunc, useScale } from "op-utils";
import { Text, TextFamily, TextWeight } from "./Text";

export const defaultButtonTextSize = 32;

interface ButtonProps extends TouchableOpacityProps {
  highlighted?: boolean;
  label: string;
  textColor?: string;
  textFamily?: TextFamily;
  textSize?: number;
  textWeight?: TextWeight;
}

export const Button: FC<ButtonProps> = function ({
  accessibilityLabel,
  accessibilityRole,
  children,
  highlighted = true,
  label,
  style = {},
  textFamily,
  textColor,
  textSize,
  textWeight = "semibold",
  testID,
  ...otherProps
}) {
  const scale = useScale();
  const styles = createStyles({ scale });
  const handlePressIn = () => {
    hapticFeedback.generate("impactMedium");
    playSound("buttonPress");
  };
  const normalizedLabel = label.toLowerCase();
  return (
    <TouchableOpacity
      accessibilityLabel={accessibilityLabel ?? normalizedLabel}
      accessibilityRole={accessibilityRole ?? "button"}
      style={[styles.touchable, style]}
      testID={testID ?? `button-${normalizedLabel.replaceAll(" ", "-")}`}
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
          textColor && { color: textColor },
          { fontSize: textSize || scale(defaultButtonTextSize) },
        ]}
      >
        {normalizedLabel}
      </Text>
      {children}
    </TouchableOpacity>
  );
};

const createStyles = ({ scale }: { scale: ScalingFunc }): any => ({
  touchable: {
    flexDirection: "row",
  },
  label: {},
  labelHighlighted: {},
});
