import React, { FC } from "react";
import { StyleSheet, Animated } from "react-native";
import { animations } from "op-design";
import { scale } from "op-utils";
import { defaultButtonTextSize } from "./Button";

interface BottomNavProps {
  animValue: Animated.Value;
}

export const BottomNav: FC<BottomNavProps> = function({ animValue, children }) {
  return (
    <Animated.View style={[styles.root, animations.fadeSlideBottom(animValue)]}>
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: scale(10),
    marginBottom: scale(14)
  }
});

export const bottomNavHeight =
  styles.root.marginTop + styles.root.marginBottom + defaultButtonTextSize;
