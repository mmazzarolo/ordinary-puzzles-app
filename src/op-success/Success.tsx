import { useKeepAwake } from "expo-keep-awake";
import { observer } from "mobx-react";
import { BottomNav, Button, Header, Score, Text } from "op-common";
import { useCoreStores } from "op-core";
import { metrics, animations } from "op-design";
import { useAnimation, useOnMount, useScale, scaleTextToFit, ScalingFunc } from "op-utils";
import React, { FC, useRef } from "react";
import { View, Animated, Platform, ViewStyle } from "react-native";

export const Success: FC = observer(function () {
  useKeepAwake();

  const scale = useScale();
  const styles = createStyles({ scale });
  const { puzzle, router } = useCoreStores();
  const interactionsDisabledRef = useRef(false);

  // Routing setup
  const startNewGame = () => router.changeRoute("intro");
  const navigateToHome = () => router.changeRoute("home");

  // Animations setup
  // https://github.com/facebook/react-native/issues/27146
  const maxOpacity = Platform.OS === "android" ? 0.99 : 1;
  const fadeInterfaceInAnimDuration = 400;
  const fadeInterfaceInStaggerDuration = 200;
  const fadeRootOutDuration = 200;
  const fadeTitleAnim = useAnimation();
  const fadeSubtilteAnim = useAnimation();
  const fadeBottomNavAnim = useAnimation();
  const fadeScoreAnim = useAnimation();
  const fadeRootAnim = useAnimation(maxOpacity);
  const fadeInterfaceIn = () =>
    Animated.stagger(fadeInterfaceInStaggerDuration, [
      fadeTitleAnim.setup({ duration: fadeInterfaceInAnimDuration }),
      fadeSubtilteAnim.setup({ duration: fadeInterfaceInAnimDuration }),
      fadeBottomNavAnim.setup({ duration: fadeInterfaceInAnimDuration }),
      fadeScoreAnim.setup({ duration: fadeInterfaceInAnimDuration }),
    ]);
  const fadeRootOut = () => fadeRootAnim.setup({ duration: fadeRootOutDuration });

  useOnMount(() => {
    fadeInterfaceIn().start();
  });

  // Callback handlers
  const handleMenuPress = () => {
    if (interactionsDisabledRef.current) return;
    interactionsDisabledRef.current = true;
    fadeRootOut().start(() => {
      navigateToHome();
    });
  };
  const handleNewPuzzlePress = () => {
    if (interactionsDisabledRef.current) return;
    interactionsDisabledRef.current = true;
    fadeRootOut().start(startNewGame);
  };

  const fitFontSize = scaleTextToFit(scale, `${puzzle.prefix} ${puzzle.name}`);

  const scoreStyle: ViewStyle = {
    top: metrics.screenMargin,
  };

  return (
    <Animated.View style={[styles.root, animations.fade(fadeRootAnim.value)]}>
      {puzzle.increasesScore && (
        <Score score={`+${puzzle.score}`} animValue={fadeScoreAnim.value} style={scoreStyle} />
      )}
      <View style={styles.middle}>
        <Header
          prefix={puzzle.prefix}
          name={puzzle.name}
          fadeAnimValue={fadeTitleAnim.value}
          fontSize={fitFontSize}
        />
        <Text
          weight="semibold"
          style={[styles.textCompleted, animations.fade(fadeSubtilteAnim.value)]}
        >
          Completed
        </Text>
      </View>
      <BottomNav animValue={fadeBottomNavAnim.value}>
        <Button label="Menu" onPress={handleMenuPress} />
        <Button label="New Puzzle" onPress={handleNewPuzzlePress} />
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
    justifyContent: "center",
  },
  textCompleted: {
    fontSize: scale(36),
  },
  textScoreValue: {
    fontSize: scale(32),
  },
  completedWrapper: {
    flexDirection: "row",
  },
});
