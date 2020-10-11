import React, { FC } from "react";
import { StyleSheet, Animated } from "react-native";
import { metrics, animations } from "op-design";
import { Text } from "op-common";
import { observer } from "mobx-react-lite";
import { scale } from "op-utils";

interface HeaderProps {
  fadeAnimValue: Animated.Value;
  name: string;
  prefix: string;
  fontSize?: number;
}

export const Header: FC<HeaderProps> = observer(function ({
  fadeAnimValue,
  name,
  prefix,
  fontSize = scale(34),
}) {
  const textStyle = {
    fontSize,
  };
  return (
    <Animated.View
      style={[styles.root, animations.fadeSlideTop(fadeAnimValue)]}
    >
      <Animated.View style={styles.identifier}>
        <Text weight="bold" secondary style={[styles.text, textStyle]}>
          {prefix}{" "}
        </Text>
        <Text weight="bold" style={[styles.text, textStyle]}>
          {name}
        </Text>
      </Animated.View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  root: {
    flexDirection: "column",
    marginTop: metrics.screenMargin,
    marginBottom: metrics.screenMargin / 2,
    zIndex: 200,
  },
  identifier: {
    flexDirection: "row",
  },
  text: {
    fontSize: scale(34),
  },
});

export const headerHeight =
  styles.root.marginBottom + styles.root.marginTop + styles.text.fontSize;
