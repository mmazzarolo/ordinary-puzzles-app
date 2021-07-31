import React, { FC } from "react";
import { Animated } from "react-native";
import { Button, Text } from "op-common";
import { PuzzleMode } from "op-core";
import { animations, useColors } from "op-design";
import { useScale, ScalingFunc } from "op-utils";

export interface MenuItem {
  label: string;
  value: PuzzleMode | "continue";
  highlighted?: boolean;
  starred?: boolean;
  onPress: (value: PuzzleMode | "continue") => void;
}

interface MenuProps {
  animValue: Animated.Value;
  disabled?: boolean;
  items: MenuItem[];
}

export const Menu: FC<MenuProps> = function ({ animValue, disabled, items }) {
  const scale = useScale();
  const styles = createStyles({ scale });
  const colors = useColors();
  const starStyle = {
    color: colors.primary[5],
  };
  return (
    <Animated.View style={[styles.root, animations.fade(animValue)]}>
      {items.map((item) => (
        <Button
          key={item.value}
          disabled={disabled}
          highlighted={item.highlighted}
          style={styles.button}
          textSize={styles.text.fontSize}
          onPress={() => item.onPress(item.value)}
          label={item.value}
        >
          {item.starred && (
            <Text weight="bold" style={[styles.text, starStyle]}>
              *
            </Text>
          )}
        </Button>
      ))}
    </Animated.View>
  );
};

const createStyles = ({ scale }: { scale: ScalingFunc }): any => ({
  root: {},
  button: {
    marginBottom: scale(2),
    alignSelf: "flex-start",
  },
  text: {
    fontSize: scale(42),
  },
});
