// What voice.js used from expo-av, which Expo no longer ships, on top of expo-audio: a
// sound made from a url or an asset, its status while it plays, and stopping and
// freeing it. Only the calls voice.js makes are here.
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";

export const InterruptionModeIOS = { DoNotMix: "doNotMix", MixWithOthers: "mixWithOthers", DuckOthers: "duckOthers" };

function soundOf(player) {
  let sub = null;
  return {
    setOnPlaybackStatusUpdate(fn) {
      sub?.remove();
      sub = fn ? player.addListener("playbackStatusUpdate", (st) => fn(st)) : null;
    },
    async playAsync() { player.play(); },
    async stopAsync() { player.pause(); },
    async unloadAsync() {
      sub?.remove();
      sub = null;
      try { player.remove(); } catch {}
    },
  };
}

export const Audio = {
  async setAudioModeAsync({ allowsRecordingIOS, playsInSilentModeIOS, interruptionModeIOS }) {
    await setAudioModeAsync({
      allowsRecording: !!allowsRecordingIOS, playsInSilentMode: !!playsInSilentModeIOS,
      ...(interruptionModeIOS ? { interruptionMode: interruptionModeIOS } : null),
    });
  },
  Sound: {
    async createAsync(source, { shouldPlay = false, volume, progressUpdateIntervalMillis } = {}) {
      const player = createAudioPlayer(source, progressUpdateIntervalMillis ? { updateInterval: progressUpdateIntervalMillis } : undefined);
      if (volume !== undefined) player.volume = volume;
      if (shouldPlay) player.play();
      return { sound: soundOf(player) };
    },
  },
};
