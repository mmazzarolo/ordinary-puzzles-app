import { Platform } from "react-native";
import { e2eAutoSolveDisableStorageKey } from "./constants";

// The browser suite turns auto-solve off per test through local storage. A
// native suite reaches neither local storage nor a launch URL reliably: Maestro
// falls back to a plain app launch when a deep link is slow, and that fallback
// drops the URL. Test builds therefore expose a control on the home screen and
// the suite taps it, which is deterministic.
//
// Only builds with auto-solve on render that control, so release builds keep no
// trace of it.
let autoSolveDisabledByControl = false;

export const disableAutoSolve = () => {
  autoSolveDisabledByControl = true;
};

export const isAutoSolveDisabled = () => {
  if (Platform.OS !== "web") return autoSolveDisabledByControl;
  return window.localStorage.getItem(e2eAutoSolveDisableStorageKey) === "1";
};
