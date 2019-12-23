import React, { FC, useRef } from "react";
import { StyleSheet, Animated } from "react-native";
import { observer } from "mobx-react";
import { useCoreStores } from "op-core";
import { BottomNav, Button, Text, bottomNavHeight } from "op-common";
import { metrics, animations } from "op-design";
import {
  useAnimation,
  useOnMount,
  scale,
  useHardwareBackButton
} from "op-utils";

export const Stats: FC = observer(function() {
  const { stats, router } = useCoreStores();
  const interactionsDisabledRef = useRef(false);

  // Routing setup
  const navigateToHome = () => router.changeRoute("home");
  useHardwareBackButton(navigateToHome);

  // Animations setup
  const fadeRootInAnimDuration = 400;
  const fadeRootOutAnimDuration = 200;
  const fadeRootAnim = useAnimation(0);
  const fadeRootIn = () =>
    fadeRootAnim.setup({ duration: fadeRootInAnimDuration });
  const fadeRootOut = () =>
    fadeRootAnim.setup({ duration: fadeRootOutAnimDuration, toValue: 0 });

  useOnMount(() => {
    fadeRootIn().start();
  });

  // Callback handlers
  const handleMenuPress = () => {
    if (interactionsDisabledRef.current) return;
    interactionsDisabledRef.current = true;
    fadeRootOut().start(() => {
      navigateToHome();
    });
  };

  return (
    <Animated.View style={styles.root}>
      <Animated.View
        style={[styles.middle, animations.fade(fadeRootAnim.value)]}
      >
        <Text weight="bold" style={styles.title}>
          Statistics
        </Text>
        <Text weight="semibold" style={styles.progress}>
          small: {stats.completedPuzzles["small"].length}/99
        </Text>
        <Text weight="semibold" style={styles.progress}>
          medium: {stats.completedPuzzles["medium"].length}/99
        </Text>
        <Text weight="semibold" style={styles.progress}>
          large: {stats.completedPuzzles["large"].length}/99
        </Text>
        <Text weight="bold" style={styles.score}>
          score: {stats.score}
        </Text>
      </Animated.View>
      <BottomNav animValue={fadeRootAnim.value}>
        <Button label="Menu" onPress={handleMenuPress} />
      </BottomNav>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  root: {
    height: "100%",
    marginHorizontal: metrics.screenMargin
  },
  middle: {
    flex: 1,
    marginTop: bottomNavHeight,
    justifyContent: "center"
  },
  title: {
    fontSize: scale(48)
  },
  score: {
    fontSize: scale(36),
    marginTop: scale(36)
  },
  progress: {
    fontSize: scale(36),
    marginTop: scale(14)
  }
});
