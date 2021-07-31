import React, { FC } from "react";
import { Animated } from "react-native";
import { metrics, animations } from "op-design";
import { Text } from "op-common";
import { observer } from "mobx-react-lite";
import { useScale, ScalingFunc } from "op-utils";

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
  fontSize,
}) {
  const scale = useScale();
  const styles = createStyles({ scale });
  const textStyle = {
    fontSize: fontSize || scale(34),
  };
  return (
    <Animated.View
      style={[styles.root, animations.fadeSlideTop(fadeAnimValue, scale)]}
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

const fontSize = 34;

const createStyles = ({ scale }: { scale: ScalingFunc }): any => ({
  root: {
    flexDirection: "column",
    marginTop: scale(metrics.screenMargin),
    marginBottom: scale(metrics.screenMargin) / 2,
    zIndex: 200,
  },
  identifier: {
    flexDirection: "row",
  },
  text: {
    fontSize: scale(fontSize),
  },
});

export const getHeaderHeight = (scale: ScalingFunc) =>
  scale(metrics.screenMargin) +
  scale(metrics.screenMargin) / 2 +
  scale(fontSize);
