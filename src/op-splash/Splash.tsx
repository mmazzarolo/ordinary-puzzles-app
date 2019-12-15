import React, { FC, useRef } from "react";
import { StyleSheet, Animated, TouchableWithoutFeedback } from "react-native";
import { Text } from "op-common";
import { useAnimation, useOnMount, scale, delay } from "op-utils";
import { animations, metrics, colors } from "op-design";
import { credits } from "op-config";

const asyncAnimationStart = (anim: Animated.CompositeAnimation) =>
  new Promise(resolve => anim.start(resolve));

interface SplashProps {
  onHide: () => void;
}

export const Splash: FC<SplashProps> = function({ onHide }) {
  const skippingEnabledRef = useRef(true);
  const hasSkippedRef = useRef(false);

  // Animations setup
  const fadeCreditsAnimDuration = 200;
  const fadeCreditsStaggerDuration = 100;
  const backgroundColorAnimDuration = 200;
  // We can use hooks in loops in this case because "credits" is a constant
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const fadeCreditsAnims = credits.map(() => useAnimation());
  const backgroundColorAnim = useAnimation();
  const splashDuration = 2000;
  const showAnim = Animated.stagger(
    fadeCreditsStaggerDuration,
    fadeCreditsAnims.map(anim =>
      anim.setup({ duration: fadeCreditsAnimDuration })
    )
  );

  const hideAnim = Animated.sequence([
    Animated.stagger(
      fadeCreditsStaggerDuration,
      fadeCreditsAnims.map(anim =>
        anim.setup({ duration: fadeCreditsAnimDuration, toValue: 0 })
      )
    ),
    backgroundColorAnim.setup({
      duration: backgroundColorAnimDuration,
      useNativeDriver: false
    })
  ]);

  const animate = async () => {
    await asyncAnimationStart(showAnim);
    await delay(splashDuration);
    skippingEnabledRef.current = false;
    if (!hasSkippedRef.current) {
      await asyncAnimationStart(hideAnim);
      onHide();
    }
  };

  useOnMount(() => {
    animate();
  });

  const rootAnimStyle = {
    backgroundColor: backgroundColorAnim.value.interpolate({
      inputRange: [0, 1],
      outputRange: [colors.splash, colors.primary[9]]
    })
  };

  // If the user touches the screen, end the animation early
  const handlePress = () => {
    if (!skippingEnabledRef.current || hasSkippedRef.current) return;
    hasSkippedRef.current = true;
    hideAnim.start(onHide);
  };

  return (
    <TouchableWithoutFeedback onPress={handlePress}>
      <Animated.View style={[styles.root, rootAnimStyle]}>
        {credits.map((credit, index) => (
          <Text
            key={credit}
            weight="bold"
            style={[
              styles.credit,
              animations.fadeSlideBottom(fadeCreditsAnims[index].value)
            ]}
          >
            {credit}
          </Text>
        ))}
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  root: {
    padding: metrics.screenMargin,
    flex: 1,
    flexDirection: "column",
    justifyContent: "center",
    backgroundColor: colors.splash
  },
  credit: {
    color: "white",
    fontSize: scale(28),
    marginVertical: scale(12)
  }
});
