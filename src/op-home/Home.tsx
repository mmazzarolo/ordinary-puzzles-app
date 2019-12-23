import React, { FC, useState } from "react";
import { View, StyleSheet, Animated, Platform, ViewStyle } from "react-native";
import { observer } from "mobx-react";
import { useCoreStores, PuzzleMode } from "op-core";
import { useBoardStores } from "op-board";
import { metrics, animations } from "op-design";
import { useAnimation, useOnMount } from "op-utils";
import { Score } from "op-common";
import { Logo } from "./Logo";
import { Menu, MenuItem } from "./Menu";

export const Home: FC = observer(function() {
  // Initialization
  const { router, stats } = useCoreStores();
  const { board } = useBoardStores();

  // Animations setup
  // https://github.com/facebook/react-native/issues/27146
  const maxOpacity = Platform.OS === "android" ? 0.99 : 1;
  const animateInSequence = !router.hasLoadedHomeOnce;
  const titleAnimDuration = 600;
  const menuAnimDuration = 600;
  const dotAnimDuration = 200;
  const rootFadeInAnimDuration = 200;
  const rootFadeOutAnimDuration = 200;
  const [isMenuDisabled, setIsMenuDisabled] = useState(true);
  const titleAnim = useAnimation(animateInSequence ? 0 : 1);
  const menuAnim = useAnimation(animateInSequence ? 0 : 1);
  const dotAnim = useAnimation(animateInSequence ? 0 : 1);
  const rootFadeAnim = useAnimation(animateInSequence ? maxOpacity : 0);
  useOnMount(() => {
    if (router.hasLoadedHomeOnce) {
      rootFadeAnim.setup({ duration: rootFadeInAnimDuration }).start(() => {
        setIsMenuDisabled(false);
      });
    } else {
      Animated.sequence([
        titleAnim.setup({ duration: titleAnimDuration }),
        dotAnim.setup({ duration: dotAnimDuration })
      ]).start(() => {
        setIsMenuDisabled(false);
        menuAnim.setup({ duration: menuAnimDuration }).start();
      });
    }
  });

  // Menu items setup
  const canContinue = board.isInitialized;
  const handleItemPress = (value: PuzzleMode | "continue") => {
    if (isMenuDisabled) return;
    setIsMenuDisabled(true);
    rootFadeAnim
      .setup({ duration: rootFadeOutAnimDuration, toValue: 0 })
      .start(() => {
        if (value === "tutorial") {
          router.changeRoute(value);
        } else {
          router.changeRoute("intro", value);
        }
      });
  };
  const menuItems: MenuItem[] = [
    {
      label: "tutorial",
      value: "tutorial",
      onPress: handleItemPress,
      highlighted: !canContinue,
      starred: !stats.tutorialCompleted && !canContinue
    },
    {
      label: "small",
      value: "small",
      onPress: handleItemPress,
      highlighted: !canContinue
    },
    {
      label: "medium",
      value: "medium",
      onPress: handleItemPress,
      highlighted: !canContinue
    },
    {
      label: "large",
      value: "large",
      onPress: handleItemPress,
      highlighted: !canContinue
    }
  ];
  if (canContinue) {
    menuItems.unshift({
      label: "continue",
      value: "continue",
      onPress: handleItemPress,
      highlighted: true
    });
  }

  // Score setup
  const scoreStyle: ViewStyle = {
    top: -metrics.screenMargin
  };
  const handleScorePress = () => {
    if (isMenuDisabled) return;
    setIsMenuDisabled(true);
    rootFadeAnim
      .setup({ duration: rootFadeOutAnimDuration, toValue: 0 })
      .start(() => {
        router.changeRoute("stats");
      });
  };

  return (
    <Animated.View style={[styles.root, animations.fade(rootFadeAnim.value)]}>
      <View style={styles.top}>
        <Logo titleAnimValue={titleAnim.value} dotAnimValue={dotAnim.value} />
      </View>
      <View style={styles.bottom}>
        <Menu
          animValue={menuAnim.value}
          disabled={isMenuDisabled}
          items={menuItems}
        />
      </View>
      <Score
        animValue={menuAnim.value}
        onPress={isMenuDisabled ? undefined : handleScorePress}
        score={stats.score}
        style={scoreStyle}
      />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    marginVertical: metrics.screenMargin * 2,
    marginHorizontal: metrics.screenMargin
  },
  top: {
    flex: 1,
    justifyContent: "center"
  },
  bottom: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "flex-end"
  }
});
