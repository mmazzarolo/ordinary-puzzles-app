import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from "expo-audio";
import { Platform } from "react-native";
import buttonPressSource from "../../assets/audio/buttonpress.wav";

type SoundEffectId = keyof typeof soundEffects;

const soundEffects = {
  buttonPress: {
    player: undefined as AudioPlayer | undefined,
    source: buttonPressSource,
    volume: 0.4,
  },
};

let initializationPromise: Promise<void> | undefined;

const getSoundEffectIds = () => Object.keys(soundEffects) as SoundEffectId[];

const createPlayer = (id: SoundEffectId) => {
  const soundEffect = soundEffects[id];
  const player = createAudioPlayer(soundEffect.source, {
    keepAudioSessionActive: false,
    updateInterval: 1_000,
  });
  player.volume = soundEffect.volume;
  soundEffect.player = player;
  return player;
};

export const initializeAudio = async () => {
  if (Platform.OS !== "ios") return;
  initializationPromise =
    initializationPromise ||
    (async () => {
      try {
        await setAudioModeAsync({
          allowsRecording: false,
          interruptionMode: "mixWithOthers",
          playsInSilentMode: false,
          shouldPlayInBackground: false,
          shouldRouteThroughEarpiece: false,
        });
        getSoundEffectIds().forEach((id) => createPlayer(id));
      } catch (error) {
        console.error("Failed to initialize audio", error);
      }
    })();

  return initializationPromise;
};

export const playSound = async (id: SoundEffectId) => {
  if (Platform.OS !== "ios") return;
  const soundEffect = soundEffects[id];
  try {
    const player = soundEffect.player || createPlayer(id);
    player.volume = soundEffect.volume;
    await player.seekTo(0);
    player.play();
  } catch (error) {
    console.error(`Failed to play sound "${id}"`, error);
  }
  return undefined;
};
