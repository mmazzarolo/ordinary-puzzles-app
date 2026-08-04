import React, { FC, useRef } from "react";
import {
  View,
  Animated,
  Platform,
  Dimensions,
  useWindowDimensions,
} from "react-native";
import { observer } from "mobx-react-lite";
import KeepAwake from "op-native/react-native-keep-awake";
import { Board, useBoardStores } from "op-board";
import { useCoreStores } from "op-core";
import {
  BottomNav,
  getBottomNavHeight,
  Button,
  Header,
  getHeaderHeight,
} from "op-common";
import { metrics, animations } from "op-design";
import {
  useAnimation,
  useOnMount,
  useHardwareBackButton,
  useScale,
  ScalingFunc,
} from "op-utils";
import { clamp } from "lodash";

export const Game: FC = observer(function () {
  const { puzzle, router } = useCoreStores();
  const { board } = useBoardStores();
  const interactionsDisabledRef = useRef(false);

  const scale = useScale();
  const styles = createStyles({ scale });

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
    return stopRewind;
  });

  // Callback handlers
  const handleMenuPress = () => {
    if (interactionsDisabledRef.current) return;
    interactionsDisabledRef.current = true;
    fadeRootOut().start(navigateToHome);
  };
  // Undo: a tap reverts one committed change; holding rewinds step by step
  // until release or the board start. The old one-tap destructive reset is
  // gone — a full rewind is just a held undo, visible and abortable.
  const rewindIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopRewind = () => {
    if (rewindIntervalRef.current !== null) {
      clearInterval(rewindIntervalRef.current);
      rewindIntervalRef.current = null;
    }
  };
  const handleUndoPress = () => {
    if (interactionsDisabledRef.current) return;
    board.undoLast();
  };
  const handleUndoLongPress = () => {
    if (interactionsDisabledRef.current) return;
    stopRewind();
    rewindIntervalRef.current = setInterval(() => {
      if (board.canUndo) {
        board.undoLast();
      } else {
        stopRewind();
      }
    }, 120);
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
    getBottomNavHeight(scale) -
    getHeaderHeight(scale) -
    metrics.screenMargin * 4; // Additional vertical padding

  return (
    <Animated.View
      style={[styles.root, animations.fade(fadeRootAnim.value)]}
      testID="screen-game"
    >
      <KeepAwake />
      <Header
        prefix={puzzle.prefix}
        name={puzzle.name}
        fadeAnimValue={fadeInterfaceAnim.value}
        testID="puzzle-name"
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
        <Button
          label="Undo"
          onPress={handleUndoPress}
          onLongPress={handleUndoLongPress}
          onPressOut={stopRewind}
          delayLongPress={350}
        />
      </BottomNav>
    </Animated.View>
  );
});

const createStyles = ({ scale }: { scale: ScalingFunc }): any => ({
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
