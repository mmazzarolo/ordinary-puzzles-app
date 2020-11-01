import React, { FC } from "react";
import { StyleSheet, Animated } from "react-native";
import { animations } from "op-design";
import { scale } from "op-utils";
import { defaultButtonTextSize } from "./Button";

interface BottomNavProps {
  animValue: Animated.Value;
}

export const BottomNav: FC<BottomNavProps> = function ({
  animValue,
  children,
}) {
  return (
    <Animated.View style={[styles.root, animations.fadeSlideBottom(animValue)]}>
      {children}
    </Animated.View>
  );
};

const marginTop = scale(10);
const marginBottom = scale(14);

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop,
    marginBottom,
  },
});

export const bottomNavHeight = marginTop + marginBottom + defaultButtonTextSize;
