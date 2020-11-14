import React, { FC } from "react";
import {
  StyleSheet,
  Animated,
  ViewStyle,
  Image,
  useColorScheme,
  Platform,
} from "react-native";
import { animations } from "op-design";
import { scale } from "op-utils";
import { Button } from "op-common";
import logoBorderDark from "./logo-border-dark.png";
import logoBorderLight from "./logo-border-light.png";

interface AboutProps {
  animValue: Animated.Value;
  style?: ViewStyle;
}

export const About: FC<AboutProps> = function ({ animValue, style }) {
  const colorScheme = useColorScheme();
  const imageSrc = colorScheme === "dark" ? logoBorderDark : logoBorderLight;

  const buttonHitSlop = {
    top: scale(20),
    bottom: scale(20),
    left: scale(20),
    right: scale(20),
  };

  const handlePress = () => {
    if (Platform.OS !== "web") {
      console.error("Tried to open about link from a non-web platform");
      return;
    }
    // @ts-ignore
    window.open("https://ordinarypuzzles.com", "_blank");
  };

  return (
    <Animated.View style={[styles.root, animations.fade(animValue), style]}>
      <Button
        onPress={handlePress}
        hitSlop={buttonHitSlop}
        label="about"
        textFamily="secondary"
        textWeight="semibold"
        textSize={scale(20)}
      >
        <Image source={{ uri: imageSrc }} style={styles.image} />
      </Button>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: {
    opacity: 0.9,
    flexDirection: "row",
  },
  button: {},
  image: {
    width: 22,
    height: 22,
    marginLeft: 4,
  },
});
