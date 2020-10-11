import React, { FC } from "react";
import { StyleSheet, Animated, ViewStyle } from "react-native";
import { Text } from "op-common";
import { scale } from "op-utils";
import { animations } from "op-design";
import { Button } from "./Button";

interface ScoreProps {
  animValue: Animated.Value;
  onPress?: () => void;
  score?: string | number;
  style?: ViewStyle;
}

export const Score: FC<ScoreProps> = function ({
  animValue,
  onPress,
  score,
  style,
}) {
  if (!score) return null;
  const buttonHitSlop = {
    top: scale(20),
    bottom: scale(20),
    left: scale(20),
    right: scale(20),
  };
  return (
    <Animated.View style={[styles.root, animations.fade(animValue), style]}>
      <Button
        disabled={!onPress}
        onPress={onPress}
        hitSlop={buttonHitSlop}
        label={String(score)}
        textFamily="secondary"
        textSize={scale(20)}
        style={styles.content}
      >
        <Text weight="semibold" family="secondary" style={styles.star}>
          {" "}
          ★
        </Text>
      </Button>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    alignSelf: "flex-end",
  },
  content: {
    alignItems: "center",
  },
  score: {
    fontSize: scale(20),
  },
  star: {
    fontSize: scale(16),
  },
});

// <TouchableOpacity
// disabled={!onPress}
// onPress={() => null}
// hitSlop={buttonHitSlop}
// style={styles.content}
// >
// </TouchableOpacity>
