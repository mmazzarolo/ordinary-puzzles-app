import { Audio } from "expo-av";
import { Platform } from "react-native";

const soundEffects = {
  buttonPress: {
    asset: require("../../assets/audio/buttonpress.wav"),
    audio: null as Audio.SoundObject | null,
  },
};

type SoundEffectId = keyof typeof soundEffects;

export async function initializeAudio() {
  if (Platform.OS === "android") return;
  try {
    const soundEffectIds = Object.keys(soundEffects) as SoundEffectId[];
    return Promise.all(
      soundEffectIds.map(async function (id) {
        const soundEffect = soundEffects[id];
        soundEffect.audio = await Audio.Sound.createAsync(soundEffect.asset);
      })
    );
  } catch (error) {
    console.error("Failed to preload sound", error);
  }
}

export const playSound = async (id: SoundEffectId) => {
  if (Platform.OS === "android") return;
  const soundEffect = soundEffects[id];
  // We must use "replay" instead of "play" here so that the track can be played
  // multiple times.
  soundEffect.audio.sound.replayAsync();
};
