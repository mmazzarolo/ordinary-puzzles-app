import React, { FC, useRef } from "react";
import {
  View,
  StyleSheet,
  Animated,
  Platform,
  Dimensions,
  useWindowDimensions,
} from "react-native";
import { observer } from "mobx-react";
import KeepAwake from "op-native/react-native-keep-awake";
import { Board } from "op-board";
import { useCoreStores } from "op-core";
import { useBoardStores } from "op-board";
import {
  BottomNav,
  bottomNavHeight,
  Button,
  Header,
  headerHeight,
} from "op-common";
import { metrics, animations } from "op-design";
import { useAnimation, useOnMount, useHardwareBackButton } from "op-utils";
import { clamp } from "lodash";

export const Game: FC = observer(function () {
  const { puzzle, router } = useCoreStores();
  const { board } = useBoardStores();
  const interactionsDisabledRef = useRef(false);

  // Screen width/height setup
  const windowDimensions = useWindowDimensions();
  const screenWidth = Platform.select({
    native: Dimensions.get("screen").width,
    default: clamp(windowDimensions.width, metrics.webBoardMaxLayoutWidth),
  });
  const screenHeight = Platform.select({
    native: Dimensions.get("screen").height,
    default: windowDimensions.height,
  });

  // Routing setup
  const navigateToHome = () => router.changeRoute("home");
  const navigateToSuccess = () => router.changeRoute("success");
  useHardwareBackButton(navigateToHome);

  // Animations setup
  // https://github.com/facebook/react-native/issues/27146
  const maxOpacity = Platform.OS === "android" ? 0.99 : 1;
  const fadeInterfaceInAnimDuration = 400;
  const fadeInterfaceOutAnimDuration = 200;
  const fadeRootOutDuration = 200;
  const fadeInterfaceAnim = useAnimation();
  const fadeRootAnim = useAnimation(maxOpacity);
  const fadeInterfaceIn = () =>
    fadeInterfaceAnim.setup({ duration: fadeInterfaceInAnimDuration });
  const fadeInterfaceOut = () =>
    fadeInterfaceAnim.setup({
      duration: fadeInterfaceOutAnimDuration,
      toValue: 0,
    });
  const fadeRootOut = () =>
    fadeRootAnim.setup({ duration: fadeRootOutDuration });

  useOnMount(() => {
    fadeInterfaceIn().start();
  });

  // Callback handlers
  const handleMenuPress = () => {
    if (interactionsDisabledRef.current) return;
    interactionsDisabledRef.current = true;
    fadeRootOut().start(navigateToHome);
  };
  const handleResetPress = () => {
    if (interactionsDisabledRef.current) return;
    board.reset();
  };
  const handleBoardClearedAnimStart = () => {
    interactionsDisabledRef.current = true;
    puzzle.onPuzzleCompleted();
  };
  const handleBoardClearedAnimEnd = () => {
    board.destroy();
    fadeInterfaceOut().start(navigateToSuccess);
  };

  // Calculate the available space for the board
  const availableHorizontalSpace = screenWidth - metrics.screenMargin * 2;
  const availableVerticalSpace =
    screenHeight -
    metrics.screenMargin * 2 -
    bottomNavHeight -
    headerHeight -
    metrics.screenMargin * 4; // Additional vertical padding

  return (
    <Animated.View style={[styles.root, animations.fade(fadeRootAnim.value)]}>
      <KeepAwake />
      <Header
        prefix={puzzle.prefix}
        name={puzzle.name}
        fadeAnimValue={fadeInterfaceAnim.value}
      />
      <View style={styles.boardWrapper}>
        {puzzle.data && (
          <Board
            onClearedAnimStart={handleBoardClearedAnimStart}
            onClearedAnimEnd={handleBoardClearedAnimEnd}
            availableHorizontalSpace={availableHorizontalSpace}
            availableVerticalSpace={availableVerticalSpace}
          />
        )}
      </View>
      <BottomNav animValue={fadeInterfaceAnim.value}>
        <Button label="Menu" onPress={handleMenuPress} />
        <Button label="Reset" onPress={handleResetPress} />
      </BottomNav>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  root: {
    marginHorizontal: metrics.screenMargin,
    flex: 1,
  },
  boardWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
