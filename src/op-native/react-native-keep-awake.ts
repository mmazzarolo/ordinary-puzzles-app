import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useEffect, useId } from "react";
import { Platform } from "react-native";

export default function KeepAwake() {
  const tag = useId();

  useEffect(() => {
    if (Platform.OS === "web") return undefined;
    const activation = activateKeepAwakeAsync(tag).then(
      () => true,
      () => false,
    );

    return () => {
      // Activation is asynchronous on the web. Waiting for it before releasing
      // avoids both an early-deactivation error and a leaked wake lock when a
      // short-lived screen unmounts before activation finishes.
      void activation
        .then((didActivate) =>
          didActivate ? deactivateKeepAwake(tag) : undefined,
        )
        .catch(() => undefined);
    };
  }, [tag]);

  return null;
}
