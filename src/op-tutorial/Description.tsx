import React, { FC } from "react";
import { Animated, ViewProps } from "react-native";
import { Text } from "op-common";
import { animations } from "op-design";
import { useScale, ScalingFunc } from "op-utils";

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
  const scale = useScale();
  const styles = createStyles({ scale });
  return (
    <Animated.View
      style={[styles.root, animations.fadeSlideTop(animValue, scale)]}
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

const createStyles = ({ scale }: { scale: ScalingFunc }): any => ({
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
