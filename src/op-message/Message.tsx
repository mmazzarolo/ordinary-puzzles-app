import React, { FC } from "react";
import { View, StyleSheet, Animated } from "react-native";
import { Text, Button, BottomNav } from "op-common";
import {
  useAnimation,
  useOnMount,
  scale,
  useHardwareBackButton,
} from "op-utils";
import { animations } from "op-design";
import { useCoreStores } from "op-core";

export const Message: FC = function () {
  const { router, puzzle, stats } = useCoreStores();

  // Routing setup
  const navigateToHome = () => router.changeRoute("home");
  useHardwareBackButton(navigateToHome);

  // Animations setup
  const fadeInTitleAnimDuration = 200;
  const fadeInMessageAnimDuration = 200;
  const fadeInBottomAnimDuration = 200;
  const fadeInStaggerDuration = 200;
  const fadeOutAnimDuration = 200;
  const fadeTitleAnim = useAnimation();
  const fadeMessageAnim = useAnimation();
  const fadeBottomAnim = useAnimation();

  const fadeIn = () =>
    Animated.stagger(fadeInStaggerDuration, [
      fadeTitleAnim.setup({ duration: fadeInTitleAnimDuration }),
      fadeMessageAnim.setup({ duration: fadeInMessageAnimDuration }),
      fadeBottomAnim.setup({ duration: fadeInBottomAnimDuration }),
    ]);

  const fadeOut = () =>
    Animated.parallel([
      fadeTitleAnim.setup({ duration: fadeOutAnimDuration, toValue: 0 }),
      fadeMessageAnim.setup({ duration: fadeOutAnimDuration, toValue: 0 }),
      fadeBottomAnim.setup({ duration: fadeOutAnimDuration, toValue: 0 }),
    ]);

  useOnMount(() => {
    fadeIn().start();
  });

  // Callback handlers
  const handleButtonPress = () => {
    fadeOut().start(() => {
      stats.updateCompletedPuzzles("tutorial", 0);
      navigateToHome();
    });
  };

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <Text
          weight="bold"
          style={[
            styles.title,
            animations.fadeSlideBottom(fadeTitleAnim.value),
          ]}
        >
          {puzzle.tutorialTitle}
        </Text>
        <Text
          weight="regular"
          style={[
            styles.message,
            animations.fadeSlideBottom(fadeMessageAnim.value),
          ]}
        >
          {puzzle.tutorialMessage}
        </Text>
      </View>
      <BottomNav animValue={fadeBottomAnim.value}>
        <Button onPress={handleButtonPress} label="menu" />
      </BottomNav>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    margin: scale(20),
    flex: 1,
  },
  top: {
    flexDirection: "column",
    flex: 1,
    justifyContent: "center",
  },
  title: {
    fontSize: scale(42),
  },
  message: {
    fontSize: scale(26),
  },
});
