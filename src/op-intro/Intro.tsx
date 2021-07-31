import React, { FC, useRef } from "react";
import { StyleSheet, Animated, TouchableWithoutFeedback } from "react-native";
import { animations, metrics } from "op-design";
import { AnimatedLetter } from "op-common";
import {
  useAnimation,
  scaleTextToFit,
  delay,
  useOnMount,
  useScale,
} from "op-utils";
import { useCoreStores } from "op-core";

const asyncAnimationStart = (anim: Animated.CompositeAnimation) =>
  new Promise((resolve) => anim.start(resolve));

export const Intro: FC = function () {
  const { puzzle, router } = useCoreStores();
  const skippingEnabledRef = useRef(true);
  const hasSkippedRef = useRef(false);

  const scale = useScale();

  // Routing setup
  const handleComplete = () => router.changeRoute("game");

  // Animation setup
  const showAnimDuration = 400;
  const animDelay = 1000;
  const hideAnimDuration = 400;
  const showAnim = useAnimation();
  const hideAnim = useAnimation(1);
  const animate = async () => {
    await asyncAnimationStart(showAnim.setup({ duration: showAnimDuration }));
    await delay(animDelay);
    skippingEnabledRef.current = false;
    if (!hasSkippedRef.current) {
      await asyncAnimationStart(hideAnim.setup({ duration: hideAnimDuration }));
      handleComplete();
    }
  };
  useOnMount(() => {
    animate();
  });

  // If the user touches the screen, end the animation early
  const handlePress = () => {
    if (!skippingEnabledRef.current || hasSkippedRef.current) return;
    hasSkippedRef.current = true;
    hideAnim.setup({ duration: hideAnimDuration }).start(handleComplete);
  };

  // Split the title into multiple charaters to animate them asynchronously
  const fitFontSize = scaleTextToFit(scale, `${puzzle.prefix} ${puzzle.name}`);
  const digitList = puzzle.prefix.split("");
  const letterList = puzzle.name.split("");
  const chars = digitList
    .map((digit) => ({ type: "digit", value: digit }))
    .concat({ type: "space", value: " " })
    .concat(letterList.map((letter) => ({ type: "letter", value: letter })));

  return (
    <TouchableWithoutFeedback onPress={handlePress}>
      <Animated.View
        style={[styles.root, animations.fadeSlideTop(hideAnim.value, scale)]}
      >
        {chars.map((char, index) => {
          const delay = (1 / chars.length) * index;
          return (
            <AnimatedLetter
              key={index}
              animValue={showAnim.value}
              delay={delay}
              secondary={char.type === "digit"}
              value={char.value}
              style={[styles.letter, { fontSize: fitFontSize }]}
            />
          );
        })}
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  root: {
    marginHorizontal: metrics.screenMargin,
    flex: 1,
    alignItems: "center",
    flexDirection: "row",
  },
  letter: {},
});
