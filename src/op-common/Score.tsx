import React, { FC } from "react";
import { StyleSheet, Animated, ViewStyle } from "react-native";
import { Text } from "op-common";
import { scale } from "op-utils";
import { animations } from "op-design";

interface ScoreProps {
  animValue: Animated.Value;
  score?: string | number;
  style?: ViewStyle;
}

export const Score: FC<ScoreProps> = function({ animValue, score, style }) {
  if (!score) return null;
  return (
    <Animated.View style={[styles.root, animations.fade(animValue), style]}>
      <Text weight="semibold" family="secondary" style={styles.score}>
        {String(score)}
      </Text>
      <Text weight="semibold" family="secondary" style={styles.star}>
        {" "}
        ★
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    flexDirection: "row",
    alignSelf: "flex-end",
    alignItems: "center"
  },
  score: {
    fontSize: scale(20)
  },
  star: {
    fontSize: scale(16)
  }
});
