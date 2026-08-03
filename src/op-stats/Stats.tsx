import React, { FC, useRef } from "react";
import { Animated } from "react-native";
import { observer } from "mobx-react-lite";
import { useCoreStores } from "op-core";
import { BottomNav, Button, Text, getBottomNavHeight } from "op-common";
import { metrics, animations } from "op-design";
import {
  useAnimation,
  useOnMount,
  useScale,
  useHardwareBackButton,
  ScalingFunc,
} from "op-utils";

export const Stats: FC = observer(function () {
  const scale = useScale();
  const styles = createStyles({ scale });
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
    <Animated.View style={styles.root} testID="screen-stats">
      <Animated.View
        style={[styles.middle, animations.fade(fadeRootAnim.value)]}
      >
        <Text weight="bold" style={styles.title}>
          Statistics
        </Text>
        <Text weight="semibold" style={styles.progress} testID="stats-small">
          small: {stats.completedPuzzles["small"].length}
        </Text>
        <Text weight="semibold" style={styles.progress} testID="stats-medium">
          medium: {stats.completedPuzzles["medium"].length}
        </Text>
        <Text weight="semibold" style={styles.progress} testID="stats-large">
          large: {stats.completedPuzzles["large"].length}
        </Text>
        <Text
          weight="semibold"
          style={styles.progress}
          testID="stats-extraordinary"
        >
          extraordinary: {stats.completedPuzzles["extraordinary"].length}
        </Text>
        <Text weight="bold" style={styles.score} testID="stats-score">
          score: {stats.score}
        </Text>
      </Animated.View>
      <BottomNav animValue={fadeRootAnim.value}>
        <Button label="Menu" onPress={handleMenuPress} />
      </BottomNav>
    </Animated.View>
  );
});

const createStyles = ({ scale }: { scale: ScalingFunc }): any => ({
  root: {
    flex: 1,
    marginHorizontal: metrics.screenMargin,
  },
  middle: {
    flex: 1,
    marginTop: getBottomNavHeight(scale),
    justifyContent: "center",
  },
  title: {
    fontSize: scale(48),
  },
  score: {
    fontSize: scale(36),
    marginTop: scale(36),
  },
  progress: {
    fontSize: scale(36),
    marginTop: scale(14),
  },
});
