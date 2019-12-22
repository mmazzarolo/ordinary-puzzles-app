import React, { FC, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  LayoutChangeEvent,
  LayoutRectangle
} from "react-native";
import { observer } from "mobx-react";
import KeepAwake from "react-native-keep-awake";
import { Board } from "op-board";
import { useBoardStores } from "op-board";
import { useCoreStores } from "op-core";
import { metrics } from "op-design";
import { BottomNav, Button, bottomNavHeight } from "op-common";
import { useAnimation, useOnMount, useHardwareBackButton } from "op-utils";
import { Description } from "./Description";

export const Tutorial: FC = observer(function() {
  const { board } = useBoardStores();
  const { puzzle, router } = useCoreStores();

  // Routing setup
  const navigateToHome = () => router.changeRoute("home");
  const goToNextTutorial = () => puzzle.nextPuzzle();
  useHardwareBackButton(navigateToHome);

  // Disable interactions while animating
  const isUnmountingRef = useRef(false);

  // Fade UI animation
  const fadeInterfaceInAnimDuration = 200;
  const fadeInterfaceOutAnimDuration = 200;
  const fadeInterfaceAnim = useAnimation();
  useOnMount(() => {
    fadeInterfaceAnim.setup({ duration: fadeInterfaceInAnimDuration }).start();
    return () => {
      board.destroy();
    };
  });

  // Wait for every HUD pieces to be mounted so that we can measure their height
  // and make sure we can fit the board
  const [
    descriptionLayout,
    setDescriptionLayout
  ] = useState<LayoutRectangle | null>(null);
  const handleDescriptionLayout = (event: LayoutChangeEvent) => {
    if (descriptionLayout?.height !== event.nativeEvent.layout.height) {
      setDescriptionLayout(event.nativeEvent.layout);
    }
  };
  const availableHorizontalSpace =
    metrics.screenWidth - metrics.screenMargin * 2;
  const availableVerticalSpace = descriptionLayout
    ? metrics.screenHeight -
      descriptionLayout.height -
      bottomNavHeight -
      metrics.screenMargin * 8 // Additional vertical padding
    : undefined;

  // Callback handlers
  const handleMenuPress = () => {
    if (!isUnmountingRef.current) {
      navigateToHome();
    }
  };
  const handleBoardClearedAnimStart = () => {
    isUnmountingRef.current = true;
    fadeInterfaceAnim
      .setup({ duration: fadeInterfaceOutAnimDuration, toValue: 0 })
      .start();
  };
  const handleBoardClearedAnimEnd = () => {
    goToNextTutorial();
  };

  return (
    <View style={styles.root}>
      <KeepAwake />
      <Description
        title={puzzle.tutorialTitle}
        message={puzzle.tutorialMessage}
        animValue={fadeInterfaceAnim.value}
        onLayout={handleDescriptionLayout}
      />
      <View style={styles.boardWrapper}>
        {puzzle.data && availableVerticalSpace && (
          <Board
            key={puzzle.id}
            availableHorizontalSpace={availableHorizontalSpace}
            availableVerticalSpace={availableVerticalSpace}
            onClearedAnimStart={handleBoardClearedAnimStart}
            onClearedAnimEnd={handleBoardClearedAnimEnd}
          />
        )}
      </View>
      {board.isInitialized && (
        <BottomNav animValue={fadeInterfaceAnim.value}>
          <Button label="menu" onPress={handleMenuPress} />
        </BottomNav>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    height: "100%",
    marginHorizontal: metrics.screenMargin
  },
  boardWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  }
});
