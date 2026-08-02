import { useEffect } from "react";

type EffectCallback = () => void | (() => void);

export function useOnMount(onMount: EffectCallback) {
  // TODO: re-think this
  useEffect(onMount, []); // oxlint-disable-line
}
