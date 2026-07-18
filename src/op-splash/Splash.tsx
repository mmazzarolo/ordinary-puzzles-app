import { FC } from "react";
import { useOnMount } from "op-utils";

interface SplashProps {
  onHide: () => void;
}

export const Splash: FC<SplashProps> = function ({ onHide }) {
  useOnMount(() => {
    onHide();
  });

  return null;
};
