import React, { useEffect, useState } from "react";
import { api } from "../../api";
import { playUrl } from "../../voice";
import { Choice, Dim, Key, Keys, Note, Rule, Shell, Toggle } from "../../ui";

const SPEEDS = [0.85, 0.95, 1, 1.1].map((s) => ({ value: s, label: `${s}×` }));
const SAMPLE = "Mission Control online. Standing by.";
const PROVIDER = { auto: "Automatic", minimax: "MiniMax", openai: "OpenAI", local: "The Mac's voice" };

export default function VoiceSettingsScreen({ onBack }) {
  const [provider, setProvider] = useState("auto");
  const [providers, setProviders] = useState({});
  const [voice, setVoice] = useState("");
  const [speed, setSpeed] = useState(0.95);
  const [speakReplies, setSpeakReplies] = useState(false);
  const [voices, setVoices] = useState([]);
  const [note, setNote] = useState(null);
  const [busy, setBusy] = useState("");

  async function load() {
    try {
      const s = await api.get("/api/settings/voice");
      setProvider(s.provider); setVoice(s.voice); setSpeed(s.speed);
      setSpeakReplies(!!s.speak_replies); setProviders(s.providers || {});
    } catch (e) { setNote({ kind: "err", text: String(e.message || e) }); }
    try { setVoices((await api.get("/api/settings/voice/voices")).voices || []); } catch {}
  }
  useEffect(() => { load(); }, []);

  async function save() {
    setBusy("save"); setNote({ kind: "busy", text: "Saving" });
    try {
      const d = await api.put("/api/settings/voice", { provider, voice, speed, speak_replies: speakReplies });
      if (d.ok) { setNote({ kind: "ok", text: "Saved" }); setVoices((await api.get("/api/settings/voice/voices")).voices || []); }
      else setNote({ kind: "err", text: d.error || "Failed" });
    } catch (e) { setNote({ kind: "err", text: String(e.message || e) }); }
    setBusy("");
  }

  async function preview() {
    setBusy("preview"); setNote({ kind: "busy", text: "Synthesising a sample" });
    try {
      await api.put("/api/settings/voice", { provider, voice, speed });
      const d = await api.post("/api/tts", { text: SAMPLE, voice });
      if (!d.ok) { setNote({ kind: "err", text: d.error || "Failed" }); }
      else { setNote(null); await playUrl(d.url); }
    } catch (e) { setNote({ kind: "err", text: String(e.message || e) }); }
    setBusy("");
  }

  const provOpts = [{ value: "auto", label: PROVIDER.auto }]
    .concat(["minimax", "openai", "local"].filter((p) => providers[p]).map((p) => ({ value: p, label: PROVIDER[p] })));

  return (
    <Shell title="Voice" onBack={onBack}>
      <Dim size={14}>
        One voice everywhere: voice conversations on this phone, spoken replies, and voice notes on iMessage
        or Telegram. Licensed studio voices only.
      </Dim>
      <Rule label="Provider" />
      <Choice options={provOpts} value={provider} onChange={setProvider} />
      <Dim size={13.5} style={{ marginTop: 10 }}>
        {provider === "local" ? "The Mac's built-in voice. No key needed."
          : "Automatic uses MiniMax when its key is set, then OpenAI, then the Mac's voice."}
      </Dim>
      <Rule label={`Voice · ${voices.length}`} />
      {voices.length === 0
        ? <Dim size={14}>No voices listed for this provider.</Dim>
        : <Choice options={voices.map((v) => ({ value: v.id, label: v.name }))}
            value={voice} onChange={setVoice} style={{ marginTop: 0 }} />}
      <Choice label="Speed" options={SPEEDS} value={speed} onChange={setSpeed} />
      <Rule label="In chat" />
      <Toggle label="Speak new replies" sub="While a chat is open on this phone" value={speakReplies}
        onChange={setSpeakReplies} style={{ marginTop: 0 }} />
      <Keys>
        <Key label="Preview" kind="ghost" busy={busy === "preview"} onPress={preview} />
        <Key label="Save" busy={busy === "save"} onPress={save} />
      </Keys>
      <Note note={note} />
    </Shell>
  );
}
