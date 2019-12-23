import React, { FC } from "react";
import { TextProps as RNTextProps, StyleSheet, Animated } from "react-native";
import { fonts, useColors } from "op-design";

export type TextFamily = keyof typeof fonts;

export type TextWeight = keyof typeof fonts.primary;

export interface TextProps extends RNTextProps {
  family?: TextFamily;
  weight?: TextWeight;
  secondary?: boolean;
  style?: any; // Because on the missing "Animated" typings for the style
}

export const Text: FC<TextProps> = function({
  children,
  family = "primary",
  weight = "regular",
  secondary = false,
  style
}) {
  const colors = useColors();
  const font = fonts[family][weight];
  const color = secondary ? colors.primary[5] : colors.primary[0];
  return (
    <Animated.Text style={[{ ...font, color }, styles.text, style]}>
      {children}
    </Animated.Text>
  );
};

const styles = StyleSheet.create({
  text: {}
});
