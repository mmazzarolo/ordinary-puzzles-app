import React, { FC, useEffect } from "react";
import { View, StyleSheet, Animated, Platform } from "react-native";
import { reaction } from "mobx";
import { observer } from "mobx-react";
import { animations, useColors } from "op-design";
import { useAnimation, useOnMount, hapticFeedback } from "op-utils";
import { useCoreStores } from "op-core";
import { autoSolve } from "op-config";
import { useBoardStores } from "./store";
import { Tile } from "./Tile";
import { PointerAwareView } from "./PointerAwareView";

const isAndroid = Platform.OS === "android";

interface BoardProps {
  availableHorizontalSpace: number;
  availableVerticalSpace: number;
  onClearedAnimEnd?: () => void;
  onClearedAnimStart?: () => void;
}

export const Board: FC<BoardProps> = observer(function ({
  availableHorizontalSpace,
  availableVerticalSpace,
  onClearedAnimEnd = () => undefined,
  onClearedAnimStart = () => undefined,
}) {
  const { board, interactions } = useBoardStores();
  const { puzzle } = useCoreStores();
  const colors = useColors();

  // Animations setup
  const fadeInAnimDuration = 400;
  const fadeOutAnimDuration = 200;
  const successAnimDuration = 200;
  const successAnimDelay = 400;
  const fadeAnim = useAnimation();
  const successAnim = useAnimation();
  const animateSuccess = () => {
    onClearedAnimStart();
    Animated.sequence([
      successAnim.setup({
        duration: successAnimDuration,
        useNativeDriver: false,
      }),
      Animated.delay(successAnimDelay),
      fadeAnim.setup({ duration: fadeOutAnimDuration, toValue: 0 }),
    ]).start(onClearedAnimEnd);
  };

  useOnMount(() => {
    fadeAnim.setup({ duration: fadeInAnimDuration }).start();
  });

  // Auto-solve the puzzle in development mode if needed
  if (autoSolve) {
    useOnMount(() => {
      setTimeout(animateSuccess, 2000);
    });
  }

  // - Trigger an light haptic feedback when a cell is pressed
  // - Trigger the success animation when the board is cleared
  useEffect(() => {
    if (!puzzle.data) {
      throw new Error('Board » missing "puzzle.data"');
    }
    const isContinuing = puzzle.id === board.puzzleId;
    if (!isContinuing) {
      board.initialize(puzzle.id, puzzle.data);
    }
    const disposeHapticReaction = reaction(
      () => interactions.hoveredCell,
      () => hapticFeedback.generate("impactLight")
    );
    const disposeClearedReaction = reaction(
      () => board.cleared,
      (didSucceed) => {
        if (didSucceed) animateSuccess();
      }
    );
    return () => {
      disposeHapticReaction();
      disposeClearedReaction();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle.id]);

  // Don't show the board unless initializes, otherwise the cells might not
  // work correctly
  if (!board.isInitialized) return null;

  // Scale the board given the vertical and horizontal contraints defined
  // in the pros
  const doesBoardFitVertically =
    (availableHorizontalSpace / board.colsCount) * board.rowsCount <
    availableVerticalSpace;
  const tileSize = doesBoardFitVertically
    ? Math.floor(availableHorizontalSpace / board.colsCount)
    : Math.floor(availableVerticalSpace / board.rowsCount);

  // On Android transitioning the opacity of the root view causes a janky
  // animation. As a workaround we place an absolutely positioned layer on top
  // of the UI and transition its opacity instead.
  const androidOpacityStyle = {
    backgroundColor: colors.primary[9],
    opacity: fadeAnim.value.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0],
    }),
  };

  return (
    <PointerAwareView
      onPointerDown={(coords) => interactions.onGridPointerDown(coords)}
      onPointerMove={(coords) => interactions.onGridPointerMove(coords)}
      onPointerUp={(coords) => interactions.onGridPointerUp(coords)}
      onLayout={(e) => interactions.enableInteraction(e)}
      pointerEvents={board.cleared ? "none" : undefined}
      style={styles.root}
    >
      <Animated.View style={!isAndroid && animations.fade(fadeAnim.value)}>
        {board.grid.map((cellsRow, rowIndex) => (
          <View style={[styles.row]} key={rowIndex} pointerEvents="none">
            {cellsRow.map((cell) => (
              <Tile
                key={cell.id}
                cell={cell}
                size={tileSize}
                successAnimValue={successAnim.value}
              />
            ))}
          </View>
        ))}
      </Animated.View>
      {isAndroid && (
        <Animated.View
          style={[styles.androidOpacity, androidOpacityStyle]}
          pointerEvents="none"
        />
      )}
    </PointerAwareView>
  );
});

const styles = StyleSheet.create({
  root: {},
  row: {
    flexDirection: "row",
  },
  androidOpacity: {
    position: "absolute",
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
  },
});
