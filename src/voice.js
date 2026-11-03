// Speaking. speak() reads a chat reply aloud: the server synthesises it with
// the team voice and hands back a cached audio url, and utterances play one
// after another. A conversation (the voice screen) instead plays a voice
// turn's clips back to back as they arrive, while the microphone stays open.
import { Audio, InterruptionModeIOS } from "./sound";
import { api, fileUrl } from "./api";
import * as listen from "./listen";

let current = null;
let queue = Promise.resolve();
let generation = 0;
let mode = null;            // "playback" | "conversation"
let conversation = false;   // the voice screen owns the audio

async function setMode(next) {
  if (mode === next) return;
  mode = next;
  try {
    await Audio.setAudioModeAsync(next === "conversation"
      ? { allowsRecordingIOS: true, playsInSilentModeIOS: true, interruptionModeIOS: InterruptionModeIOS.DoNotMix }
      : { allowsRecordingIOS: false, playsInSilentModeIOS: true });
  } catch {}
}

export async function synth(text) {
  const d = await api.post("/api/tts", { text });
  return d.ok ? d.url : null;
}

export function playUrl(url) {
  return new Promise(async (resolve) => {
    let sound = null;
    const done = async () => {
      if (sound) { try { await sound.unloadAsync(); } catch {} }
      if (current === sound) current = null;
      resolve();
    };
    try {
      await setMode("playback");
      const created = await Audio.Sound.createAsync({ uri: fileUrl(url) }, { shouldPlay: true });
      sound = created.sound;
      current = sound;
      sound.setOnPlaybackStatusUpdate((st) => {
        if (!st.isLoaded) { if (st.error) done(); return; }
        if (st.didJustFinish) done();
      });
    } catch {
      done();
    }
  });
}

// resolves once this utterance has finished playing (or was skipped);
// a conversation speaks for itself, so chat replies stay quiet meanwhile
export function speak(text) {
  if (conversation) return Promise.resolve();
  const g = generation;
  const job = queue.then(async () => {
    if (g !== generation) return;
    const url = await synth(text).catch(() => null);
    if (url && g === generation) await playUrl(url);
  });
  queue = job.catch(() => {});
  return job;
}

export async function stopSpeaking() {
  generation += 1;
  queue = Promise.resolve();
  if (current) {
    try { await current.stopAsync(); await current.unloadAsync(); } catch {}
    current = null;
  }
}

/* ---------- conversation ---------- */

// The audio session a conversation needs, set in an order that sticks: the
// player claims its session by playing a moment of silence first, then the
// session is pointed at the loudspeaker. The player only reconfigures the
// session when its own settings change, so the loudspeaker holds.
export async function beginConversation() {
  conversation = true;
  await stopSpeaking();
  await setMode("conversation");
  try {
    const { sound } = await Audio.Sound.createAsync(require("../assets/silence.wav"), { shouldPlay: true, volume: 0 });
    setTimeout(() => sound.unloadAsync().catch(() => {}), 400);
  } catch {}
  listen.setCategory(listen.DUPLEX);
}

export async function endConversation() {
  conversation = false;
  await setMode("playback");
}

// Plays voice turns clip by clip. Each turn's clips play in order; a turn
// plays out before the next one starts; the next clip loads while the current
// one plays, so sentences follow each other without a gap. cut() silences
// everything at once (the owner talked over it).
export function createPlayer({ onPlay, onIdle } = {}) {
  const order = [];            // turns, in the order they began
  const open = new Set();      // turns that may still send clips
  const dropped = new Set();   // turns the owner cut off
  const expected = {};         // turn -> next seq to play
  const played = {};           // turn -> clips started
  const loads = new Map();     // clip key -> Promise<Sound | null>
  let queue = [];
  let current = null;
  let busy = false;
  let closed = false;
  let first = true;

  const key = (c) => `${c.turn}#${c.seq}`;
  const known = (turn) => { if (!order.includes(turn)) order.push(turn); };

  function load(c) {
    if (!c.url) return Promise.resolve(null);
    if (!loads.has(key(c))) {
      loads.set(key(c), Audio.Sound.createAsync({ uri: fileUrl(c.url) }, { shouldPlay: false, progressUpdateIntervalMillis: 250 })
        .then((r) => r.sound).catch(() => null));
    }
    return loads.get(key(c));
  }

  function head() {
    return order.find((t) => !dropped.has(t) && (open.has(t) || queue.some((c) => c.turn === t)));
  }

  function preload() {
    const t = head();
    if (!t) return;
    const want = expected[t] || 0;
    for (const c of queue) if (c.turn === t && c.seq <= want + 1) load(c);
  }

  async function next() {
    if (busy || closed) return;
    const turn = head();
    if (!turn) { onIdle?.(); return; }
    const want = expected[turn] || 0;
    const i = queue.findIndex((c) => c.turn === turn && c.seq === want);
    if (i < 0) return;   // its next clip is still being made
    const clip = queue.splice(i, 1)[0];
    expected[turn] = want + 1;
    busy = true;
    const sound = await load(clip);
    loads.delete(key(clip));
    if (!sound || dropped.has(turn) || closed) {
      if (sound) sound.unloadAsync().catch(() => {});
      busy = false;
      return next();
    }
    played[turn] = (played[turn] || 0) + 1;
    await new Promise((resolve) => {
      current = { sound, done: resolve };
      sound.setOnPlaybackStatusUpdate((st) => {
        if ((st.isLoaded && st.didJustFinish) || (!st.isLoaded && st.error)) resolve();
      });
      sound.playAsync().then(() => {
        if (first) { first = false; listen.setCategory(listen.DUPLEX); }
        onPlay?.(clip);
        preload();
      }).catch(resolve);
    });
    sound.unloadAsync().catch(() => {});
    current = null;
    busy = false;
    next();
  }

  return {
    begin(turn) { known(turn); if (!dropped.has(turn)) open.add(turn); },
    add(clip) {
      if (closed || dropped.has(clip.turn)) return;
      known(clip.turn);
      if (clip.seq < (expected[clip.turn] || 0)) return;
      queue.push(clip);
      preload();
      next();
    },
    end(turn) {
      open.delete(turn);
      if (!busy) next();
    },
    heard(turn) { return played[turn] || 0; },
    // the owner talked over it: every turn heard so far goes quiet now
    async cut() {
      for (const t of order) dropped.add(t);
      open.clear();
      queue = [];
      const c = current;
      current = null;
      if (c) { try { await c.sound.stopAsync(); } catch {} c.done(); }
      for (const p of loads.values()) p.then((s) => s && s.unloadAsync().catch(() => {}));
      loads.clear();
    },
    async close() {
      await this.cut();
      closed = true;
    },
  };
}
