import React, { FC } from "react";
import { StyleSheet, View, Animated } from "react-native";
import { Text, AnimatedLetter } from "op-common";
import { scale } from "op-utils";

interface LogoProps {
  titleAnimValue: Animated.Value;
  dotAnimValue: Animated.Value;
}

export const Logo: FC<LogoProps> = function ({ titleAnimValue, dotAnimValue }) {
  const title1 = "Ordinary";
  const title2 = "Puzzles";
  const titleLength = title1.length + title2.length;
  const charShowAnimDuration = 1 / titleLength;
  const dotAnimStyle = {
    opacity: dotAnimValue,
    transform: [{ scale: dotAnimValue }],
  };
  return (
    <View style={styles.root}>
      <View style={styles.titleRow}>
        {title1.split("").map((char, index) => {
          const delay = charShowAnimDuration * index;
          return (
            <AnimatedLetter
              key={index}
              animValue={titleAnimValue}
              delay={delay}
              style={styles.text}
              value={char}
            />
          );
        })}
      </View>
      <View style={styles.titleRow2}>
        {title2.split("").map((char, index) => {
          const title1AnimDuration = charShowAnimDuration * title1.length;
          const delay = title1AnimDuration + charShowAnimDuration * index;
          return (
            <AnimatedLetter
              key={index}
              animValue={titleAnimValue}
              delay={delay}
              style={styles.text}
              value={char}
            />
          );
        })}
        <Text weight="bold" secondary style={[styles.text, dotAnimStyle]}>
          .
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {},
  titleRow: {
    flexDirection: "row",
  },
  titleRow2: {
    flexDirection: "row",
  },
  text: {
    fontSize: scale(62),
  },
});
