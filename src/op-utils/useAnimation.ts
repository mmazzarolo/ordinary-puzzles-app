import { useCallback, useState } from "react";
import { Animated, Easing } from "react-native";

export const useAnimation = function (initialValue: number = 0) {
  const endValue = initialValue === 0 ? 1 : 0;
  const [value] = useState(() => new Animated.Value(initialValue));

  const setup = useCallback(
    (config: Partial<Animated.TimingAnimationConfig> = {}) =>
      Animated.timing(value, {
        toValue: endValue,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.quad),
        ...config,
      }),
    [endValue, value]
  );

  return {
    value: value,
    setup: setup,
  };
};
