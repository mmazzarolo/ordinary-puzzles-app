import ReactNativeSound from "op-native/react-native-sound";
import { Platform } from "react-native";

type SoundEffectId = keyof typeof soundEffects;

const soundEffects = {
  buttonPress: {
    path: "buttonpress.wav",
    sound: null as any,
    volume: Platform.select({ ios: 0.4, android: 0.5 }),
  },
};

// Makes sure we can play audio effects without breaking other backgound app's
// playback
ReactNativeSound.setCategory("Ambient", true);

const preloadSound = async (id: SoundEffectId) => {
  if (Platform.OS === "android") return;
  const soundEffect = soundEffects[id];
  return new Promise((resolve, reject) => {
    const sound: any = new ReactNativeSound(
      soundEffect.path,
      ReactNativeSound.MAIN_BUNDLE,
      (error) => {
        if (error) {
          console.error(`Failed to preload ${soundEffect.path}`, error);
          return reject(error);
        } else {
          soundEffect.sound = sound;
          resolve(sound);
        }
      }
    );
  });
};

export const initializeAudio = async () => {
  if (Platform.OS === "android") return;
  // Preload sound effects
  try {
    const soundEffectIds = Object.keys(soundEffects) as SoundEffectId[];
    Promise.all(soundEffectIds.map((id) => preloadSound(id)));
  } catch (error) {
    console.error("Failed to preload sound", error);
  }
};

export const playSound = async (id: SoundEffectId) => {
  if (Platform.OS === "android") return;
  const soundEffect = soundEffects[id];
  return new Promise((resolve, reject) => {
    if (soundEffect.sound && soundEffect.sound.play) {
      soundEffect.sound
        .setVolume(soundEffect.volume)
        .play((success: boolean) =>
          success
            ? resolve()
            : reject("Playback failed due to audio decoding errors")
        );
    }
  });
};
