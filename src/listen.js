// On-device speech recognition (iOS), through expo-speech-recognition.
// The native module only exists in an installed build, not in Expo Go, so
// everything here degrades to "unavailable" instead of crashing.
let mod = null;
let loadError = "";
try {
  mod = require("expo-speech-recognition");
  if (!mod?.ExpoSpeechRecognitionModule) { mod = null; loadError = "module loaded without its native part"; }
} catch (e) {
  mod = null;
  loadError = String(e?.message || e);
}

export const available = !!mod;
export const unavailableReason = available ? "" :
  "speech recognition is unavailable: " + loadError +
  " (it needs the installed build; expo go cannot run it)";

// A conversation records and plays at once: the agent's voice comes out of
// the loudspeaker (or headphones) while the microphone keeps listening, so
// the owner can talk over it.
export const DUPLEX = {
  category: "playAndRecord",
  categoryOptions: ["defaultToSpeaker", "allowBluetooth"],
  mode: "default",
};

export function useSpeechEvent(name, handler) {
  if (mod) mod.useSpeechRecognitionEvent(name, handler);
}

export async function requestPermission() {
  if (!mod) return false;
  const r = await mod.ExpoSpeechRecognitionModule.requestPermissionsAsync();
  return !!r.granted;
}

// recognition on the phone itself answers sooner than a round trip to Apple
export function onDevice() {
  try { return !!mod?.ExpoSpeechRecognitionModule.supportsOnDeviceRecognition(); } catch { return false; }
}

export function setCategory(options) {
  try { mod?.ExpoSpeechRecognitionModule.setCategoryIOS(options); } catch {}
}

export function start(options = {}) {
  mod.ExpoSpeechRecognitionModule.start({ lang: "en-US", interimResults: true, continuous: false, ...options });
}

export function stop() {
  try { mod?.ExpoSpeechRecognitionModule.stop(); } catch {}
}

export function abort() {
  try { mod?.ExpoSpeechRecognitionModule.abort(); } catch {}
}
