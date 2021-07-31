import React, { FC } from "react";
import { Animated } from "react-native";
import { animations } from "op-design";
import { useScale, ScalingFunc } from "op-utils";
import { defaultButtonTextSize } from "./Button";

interface BottomNavProps {
  animValue: Animated.Value;
}

export const BottomNav: FC<BottomNavProps> = function ({
  animValue,
  children,
}) {
  const scale = useScale();
  const styles = createStyles({ scale });
  return (
    <Animated.View
      style={[styles.root, animations.fadeSlideBottom(animValue, scale)]}
    >
      {children}
    </Animated.View>
  );
};

const marginTop = 10;
const marginBottom = 14;

const createStyles = ({ scale }: { scale: ScalingFunc }): any => ({
  root: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: scale(marginTop),
    marginBottom: scale(marginBottom),
  },
});

export const getBottomNavHeight = (scale: ScalingFunc): any =>
  scale(marginTop) + scale(marginBottom) + scale(defaultButtonTextSize);
