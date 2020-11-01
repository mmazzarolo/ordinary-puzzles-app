import React, { FC } from "react";
import { Animated, StyleSheet, ViewProps } from "react-native";
import { Text } from "op-common";
import { animations } from "op-design";
import { scale } from "op-utils";

interface DescriptionProps extends ViewProps {
  animValue: Animated.Value;
  title: string;
  message: string;
}

export const Description: FC<DescriptionProps> = function ({
  animValue,
  title,
  message,
  ...otherProps
}) {
  return (
    <Animated.View
      style={[styles.root, animations.fadeSlideTop(animValue)]}
      {...otherProps}
    >
      <Text weight="bold" style={styles.title}>
        {title}
      </Text>
      <Text weight="regular" style={styles.message}>
        {message}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: {
    marginTop: scale(32),
  },
  title: {
    fontSize: scale(24),
    marginBottom: scale(4),
  },
  message: {
    fontSize: scale(22),
  },
});
