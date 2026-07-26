import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { hapticFeedback } from "./hapticFeedback";

jest.mock("expo-haptics", () => ({
  AndroidHaptics: {
    Clock_Tick: "clock-tick",
    Segment_Frequent_Tick: "segment-frequent-tick",
    Virtual_Key: "virtual-key",
  },
  ImpactFeedbackStyle: {
    Light: "light",
    Medium: "medium",
  },
  impactAsync: jest.fn().mockResolvedValue(undefined),
  performAndroidHapticsAsync: jest.fn().mockResolvedValue(undefined),
}));

const setPlatform = (os: typeof Platform.OS) => {
  Object.defineProperty(Platform, "OS", {
    configurable: true,
    value: os,
  });
};

const setPlatformVersion = (version: typeof Platform.Version) => {
  Object.defineProperty(Platform, "Version", {
    configurable: true,
    value: version,
  });
};

describe("haptic feedback", () => {
  const initialPlatform = Platform.OS;
  const initialPlatformVersion = Platform.Version;

  afterAll(() => {
    setPlatform(initialPlatform);
    setPlatformVersion(initialPlatformVersion);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses a subtle virtual-key effect for Android buttons", async () => {
    setPlatform("android");

    await hapticFeedback.generate("impactMedium");

    expect(Haptics.performAndroidHapticsAsync).toHaveBeenCalledWith(
      Haptics.AndroidHaptics.Virtual_Key,
    );
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it("uses a very soft repeated effect for Android 14+ board movement", async () => {
    setPlatform("android");
    setPlatformVersion(34);

    await hapticFeedback.generate("impactLight");

    expect(Haptics.performAndroidHapticsAsync).toHaveBeenCalledWith(
      Haptics.AndroidHaptics.Segment_Frequent_Tick,
    );
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it("uses a compatible soft effect for older Android board movement", async () => {
    setPlatform("android");
    setPlatformVersion(33);

    await hapticFeedback.generate("impactLight");

    expect(Haptics.performAndroidHapticsAsync).toHaveBeenCalledWith(
      Haptics.AndroidHaptics.Clock_Tick,
    );
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it("preserves the existing iOS impact styles", async () => {
    setPlatform("ios");

    await hapticFeedback.generate("impactMedium");
    await hapticFeedback.generate("impactLight");

    expect(Haptics.impactAsync).toHaveBeenNthCalledWith(
      1,
      Haptics.ImpactFeedbackStyle.Medium,
    );
    expect(Haptics.impactAsync).toHaveBeenNthCalledWith(
      2,
      Haptics.ImpactFeedbackStyle.Light,
    );
    expect(Haptics.performAndroidHapticsAsync).not.toHaveBeenCalled();
  });

  it("does nothing on web", () => {
    setPlatform("web");

    expect(hapticFeedback.generate()).toBeUndefined();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(Haptics.performAndroidHapticsAsync).not.toHaveBeenCalled();
  });
});
