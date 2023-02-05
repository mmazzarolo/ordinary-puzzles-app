import { observer } from "mobx-react";
import { useBoardStores } from "op-board";
import { Score } from "op-common";
import { useCoreStores, PuzzleMode } from "op-core";
import { metrics, animations } from "op-design";
import { useScale, useAnimation, useOnMount, ScalingFunc } from "op-utils";
import React, { FC, useState } from "react";
import { View, Animated, Platform, ViewStyle } from "react-native";
import { About } from "./About";
import { Logo } from "./Logo";
import { Menu, MenuItem } from "./Menu";

export const Home: FC = observer(function () {
  const scale = useScale();
  const styles = createStyles({ scale });

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
        dotAnim.setup({ duration: dotAnimDuration }),
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
    rootFadeAnim.setup({ duration: rootFadeOutAnimDuration, toValue: 0 }).start(() => {
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
      starred: !stats.tutorialCompleted && !canContinue,
    },
    {
      label: "small",
      value: "small",
      onPress: handleItemPress,
      highlighted: !canContinue,
    },
    {
      label: "medium",
      value: "medium",
      onPress: handleItemPress,
      highlighted: !canContinue,
    },
    {
      label: "large",
      value: "large",
      onPress: handleItemPress,
      highlighted: !canContinue,
    },
  ];
  if (canContinue) {
    menuItems.unshift({
      label: "continue",
      value: "continue",
      onPress: handleItemPress,
      highlighted: true,
    });
  }

  // Score setup
  const scoreStyle: ViewStyle = {
    top: metrics.screenMargin,
    right: metrics.screenMargin,
  };
  const handleScorePress = () => {
    if (isMenuDisabled) return;
    setIsMenuDisabled(true);
    rootFadeAnim.setup({ duration: rootFadeOutAnimDuration, toValue: 0 }).start(() => {
      router.changeRoute("stats");
    });
  };

  return (
    <Animated.View style={[styles.root, animations.fade(rootFadeAnim.value)]}>
      <View style={styles.top}>
        <Logo titleAnimValue={titleAnim.value} dotAnimValue={dotAnim.value} />
      </View>
      <View style={styles.bottom}>
        <Menu animValue={menuAnim.value} disabled={isMenuDisabled} items={menuItems} />
      </View>
      <Score
        animValue={menuAnim.value}
        onPress={isMenuDisabled ? undefined : handleScorePress}
        score={stats.score}
        style={scoreStyle}
      />
      {Platform.OS === "web" && <About animValue={menuAnim.value} style={styles.about} />}
    </Animated.View>
  );
});

const createStyles = ({ scale }: { scale: ScalingFunc }): any => ({
  root: {
    flex: 1,
    paddingVertical: metrics.screenMargin * 2,
    paddingHorizontal: metrics.screenMargin,
  },
  top: {
    flex: 1,
    justifyContent: "center",
  },
  bottom: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "flex-end",
  },
  about: {
    position: "absolute",
    alignItems: "flex-end",
    bottom: metrics.screenMargin * 2 + scale(5),
    right: metrics.screenMargin,
  },
});
