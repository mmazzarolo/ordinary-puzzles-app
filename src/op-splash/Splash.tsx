import { useOnMount } from "op-utils";
import { FC } from "react";

interface SplashProps {
  onHide: () => void;
}

export const Splash: FC<SplashProps> = function ({ onHide }) {
  // @ts-ignore
  document.getElementById("splash").style.display = "none";

  useOnMount(() => {
    onHide();
  });

  return null;
};
