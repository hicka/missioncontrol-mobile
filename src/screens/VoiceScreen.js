import React, { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../api";
import Mark from "../components/Mark";
import * as listen from "../listen";
import * as live from "../live";
import { cutInAt, norm } from "../cutin";
import { beginConversation, createPlayer, endConversation, synth } from "../voice";
import { T } from "../theme";
import { Button, Header, Toggle, Txt, haptic } from "../ui";

const PHASE = {
  idle: "Tap to talk",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking · talk over it to cut in",
};

// this long without a new word, and what you said is sent; sooner when the
// recogniser has already heard the sentence end
const ENDPOINT_MS = 750;
const ENDPOINT_DONE_MS = 500;

// A spoken conversation with the agent. What you say is recognised on the
// phone and sent the moment you pause; the reply is read aloud, clip by clip
// if the server streams it; and the microphone stays open the whole time, so
// you can talk over the agent and it stops to listen.
export default function VoiceScreen({ thread, agents, onBack }) {
  const insets = useSafeAreaInsets();
  const agent = thread.agent ? agents[thread.agent] : null;
  const name = agent?.name || thread.agent || "the agent";

  const [phase, setPhase] = useState("idle");
  const [partial, setPartial] = useState("");
  const [lines, setLines] = useState([]);
  const [handsFree, setHandsFree] = useState(true);
  const [cutIn, setCutIn] = useState(true);
  const [error, setError] = useState(listen.available ? "" : listen.unavailableReason);

  const alive = useRef(true);
  const phaseRef = useRef("idle");
  const handsFreeRef = useRef(true);
  const cutInRef = useRef(true);
  const words = useRef([]);          // this recognition session's words, as heard
  const from = useRef(0);            // where the owner's current utterance starts in them
  const speakFrom = useRef(0);       // where the words were when the agent began speaking
  const utterance = useRef("");
  const endpoint = useRef(null);
  const session = useRef({ running: false, starting: false, again: false, restarts: [] });
  const said = useRef(new Set());    // the agent's words while it speaks: the echo to ignore
  const latest = useRef(null);       // the voice turn heard last
  const answered = useRef(false);    // a reply to the newest message has come and gone
  const streamed = useRef(false);    // this server speaks replies as they stream
  const lastId = useRef(0);
  const scroller = useRef(null);
  const player = useRef(null);
  if (!player.current) {
    player.current = createPlayer({ onPlay: () => onPlay(), onIdle: () => onIdle() });
  }

  useEffect(() => { handsFreeRef.current = handsFree; }, [handsFree]);
  useEffect(() => { cutInRef.current = cutIn; }, [cutIn]);

  function setP(p) { phaseRef.current = p; setPhase(p); }

  /* ---------- the microphone ---------- */

  const onDevice = useRef(listen.onDevice());
  const recognition = () => ({
    continuous: true,
    interimResults: true,
    addsPunctuation: true,
    requiresOnDeviceRecognition: onDevice.current,
    contextualStrings: Object.values(agents).map((a) => a.name).filter(Boolean).slice(0, 40),
    iosCategory: listen.DUPLEX,
  });

  // a fresh session, so what comes next is not mixed with what went before
  function startSession() {
    if (!listen.available || !alive.current) return;
    const s = session.current;
    if (s.running || s.starting) { s.again = true; listen.abort(); return; }
    // a session that keeps dying straight away is not worth restarting forever
    const now = Date.now();
    s.restarts = s.restarts.filter((t) => now - t < 6000).concat(now);
    if (s.restarts.length > 4) { setError("The microphone keeps stopping. Tap to try again."); setP("idle"); return; }
    words.current = [];
    from.current = 0;
    speakFrom.current = 0;
    s.starting = true;
    try { listen.start(recognition()); } catch (e) { s.starting = false; setError(String(e.message || e)); setP("idle"); }
  }

  function stopSession() {
    session.current.again = false;
    listen.abort();
  }

  listen.useSpeechEvent("start", () => {
    session.current.starting = false;
    session.current.running = true;
  });
  listen.useSpeechEvent("end", () => {
    const s = session.current;
    s.running = false;
    s.starting = false;
    if (s.again) { s.again = false; startSession(); return; }
    // ended on its own (a time limit, a hiccup): keep the conversation going
    if (alive.current && phaseRef.current !== "idle") startSession();
  });
  listen.useSpeechEvent("error", (e) => {
    if (["aborted", "no-speech", "speech-timeout"].includes(e.error)) return;
    // the phone could not recognise on its own: Apple's servers can (the
    // session restarts by itself when it ends)
    if (onDevice.current) { onDevice.current = false; return; }
    setError(e.message || String(e.error));
  });

  listen.useSpeechEvent("result", (e) => {
    const text = e.results?.[0]?.transcript || "";
    const raw = text.split(/\s+/).filter(Boolean);
    words.current = raw;
    const heard = raw.map(norm);
    const p = phaseRef.current;

    if (p === "speaking") {
      if (!cutInRef.current) return;
      const at = cutInAt(heard.slice(speakFrom.current), said.current);
      if (at < 0) return;   // only the agent's own voice coming back
      interrupt(speakFrom.current + at);
    } else if (p === "thinking") {
      // nothing is playing, so this is the owner adding to what they asked
      if (heard.length - from.current < 2) return;
      interrupt(from.current);
    } else if (p !== "listening") {
      return;
    }
    utterance.current = raw.slice(from.current).join(" ");
    setPartial(utterance.current);
    clearTimeout(endpoint.current);
    endpoint.current = setTimeout(commit, /[.?!]$/.test(utterance.current) ? ENDPOINT_DONE_MS : ENDPOINT_MS);
    if (e.isFinal) commit();
  });

  function listenNow() {
    clearTimeout(endpoint.current);
    from.current = words.current.length;   // anything heard before now is not this utterance
    utterance.current = "";
    setPartial("");
    setError("");
    setP("listening");
    startSession();
  }

  // the owner spoke over the agent (or tapped): it goes quiet and listens
  function interrupt(at) {
    haptic.tap();
    const turn = latest.current;
    if (turn) setLines((l) => l.map((x) => (x.turn === turn ? { ...x, cut: true } : x)));
    player.current.cut();
    api.voiceStop(thread.id, turn ? player.current.heard(turn) : 0).catch(() => {});
    said.current = new Set();
    from.current = at;
    setP("listening");
  }

  function commit() {
    clearTimeout(endpoint.current);
    const text = utterance.current.trim();
    if (!text || phaseRef.current !== "listening" || !alive.current) return;
    utterance.current = "";
    from.current = words.current.length;   // late results of these words are not a follow-up
    setPartial("");
    setLines((l) => [...l, { who: "user", text }]);
    answered.current = false;
    setP("thinking");
    startSession();   // the mic stays open for a follow-up, or to cut in
    api.send(thread.id, text, undefined, true).catch((e) => {
      setError(String(e.message || e));
      if (alive.current) listenNow();
    });
    if (!live.connected()) poll();
  }

  /* ---------- the agent's voice ---------- */

  function onPlay() {
    const p = phaseRef.current;
    if (p === "thinking" || (p === "listening" && !utterance.current.trim())) {
      speakFrom.current = words.current.length;
      setP("speaking");
    }
  }

  // nothing left to play and nothing more coming
  function onIdle() {
    const p = phaseRef.current;
    if (!alive.current || !(p === "speaking" || (p === "thinking" && answered.current))) return;
    said.current = new Set();
    if (handsFreeRef.current) listenNow();
    else { stopSession(); setP("idle"); }
  }

  function agentLine(turn, who, text, silent) {
    setLines((l) => {
      const i = l.findIndex((x) => x.turn && x.turn === turn);
      if (i < 0) return [...l, { who, turn, text, silent }];
      const next = [...l];
      next[i] = { ...next[i], text: `${next[i].text} ${text}` };
      return next;
    });
  }

  function onLive(ev) {
    const th = ev.thread || ev.msg?.thread;
    if (th !== thread.id || !alive.current) return;
    if (ev.type === "voice_start") {
      streamed.current = true;
      latest.current = ev.turn;
      player.current.begin(ev.turn);
    } else if (ev.type === "voice") {
      latest.current = ev.turn;
      agentLine(ev.turn, ev.agent, ev.text);
      for (const w of ev.text.split(/\s+/)) said.current.add(norm(w));
      player.current.add({ turn: ev.turn, seq: ev.seq, url: ev.url, text: ev.text });
    } else if (ev.type === "voice_end") {
      answered.current = true;
      player.current.end(ev.turn);
    } else if (ev.type === "message") {
      bubble(ev.msg);
    }
  }

  // a chat bubble from the agent: already heard if it was streamed; shown if it
  // was marked as text; otherwise (a teammate's relay, an older server) spoken
  // the ordinary way
  async function bubble(m) {
    if (!m || m.sender === "user" || (m.kind && m.kind !== "chat")) return;
    if (m.id) lastId.current = Math.max(lastId.current, m.id);
    if (m.meta?.spoken) return;
    if (m.meta?.silent) { setLines((l) => [...l, { who: m.sender, text: m.text, silent: true }]); return; }
    const turn = `m${m.id}`;
    latest.current = turn;
    player.current.begin(turn);
    setLines((l) => [...l, { who: m.sender, turn, text: m.text }]);
    for (const w of m.text.split(/\s+/)) said.current.add(norm(w));
    const url = await synth(m.text).catch(() => null);
    player.current.add({ turn, seq: 0, url, text: m.text });
    player.current.end(turn);
    answered.current = true;
    if (!url) onIdle();
  }

  // without the live socket, look for the reply instead
  async function poll() {
    for (let i = 0; i < 120 && alive.current && !live.connected(); i++) {
      await new Promise((r) => setTimeout(r, 1500));
      try {
        const d = await api.thread(thread.id);
        for (const m of d.messages || []) if (m.id > lastId.current) bubble(m);
      } catch {}
      if (answered.current) return;
    }
  }

  /* ---------- lifecycle ---------- */

  useEffect(() => {
    const unsubscribe = live.subscribe(onLive);
    (async () => {
      try {
        const d = await api.thread(thread.id);
        const m = d.messages || [];
        lastId.current = m.length ? m[m.length - 1].id : 0;
      } catch {}
      if (!listen.available) return;
      if (!(await listen.requestPermission())) {
        setError("Microphone or speech recognition permission was denied");
        return;
      }
      await beginConversation();
      if (alive.current) listenNow();
    })();
    return () => {
      alive.current = false;
      unsubscribe();
      clearTimeout(endpoint.current);
      listen.abort();
      player.current.close();
      endConversation();
    };
  }, []);

  // one big target: talk, send now, or cut in
  function tap() {
    const p = phaseRef.current;
    if (p === "idle") listenNow();
    else if (p === "listening") { if (utterance.current.trim()) commit(); }
    else interrupt(words.current.length);
  }

  async function stopAll() {
    clearTimeout(endpoint.current);
    if (phaseRef.current === "speaking" || phaseRef.current === "thinking") {
      const turn = latest.current;
      api.voiceStop(thread.id, turn ? player.current.heard(turn) : 0).catch(() => {});
    }
    player.current.cut();
    stopSession();
    utterance.current = "";
    setPartial("");
    setP("idle");
  }

  const phaseColor = phase === "listening" ? T.info : phase === "thinking" ? T.warn : phase === "speaking" ? T.good : T.text3;
  return (
    <View style={{ flex: 1 }}>
      <Header title={name} sub="Voice" onBack={onBack} />
      <ScrollView ref={scroller} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 14 }}
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}>
        {lines.length === 0 && !partial && (
          <Txt size={14} color={T.text3} style={{ textAlign: "center", marginTop: 20, marginHorizontal: 20 }}>
            Talk to {name}. It answers out loud, and you can talk over it any time to cut in.
            The voice is under More › Voice.
          </Txt>
        )}
        {lines.map((l, i) => l.who === "user" ? (
          <View key={i} style={{ alignItems: "flex-end", marginTop: 12 }}>
            <View style={{ maxWidth: "84%", backgroundColor: T.surface2, borderWidth: 1, borderColor: T.line,
                           borderRadius: 18, borderBottomRightRadius: 6, paddingHorizontal: 14, paddingVertical: 9 }}>
              <Txt size={16}>{l.text}</Txt>
            </View>
          </View>
        ) : (
          <View key={i} style={{ marginTop: 14 }}>
            <Txt size={13} weight="600" color={T.text2}>
              {agents[l.who]?.name || l.who}
              {l.silent ? <Txt size={12.5} color={T.text4}>  · sent as text</Txt> : null}
              {l.cut ? <Txt size={12.5} color={T.text4}>  · cut off</Txt> : null}
            </Txt>
            <Txt size={16} color={l.silent ? T.text3 : T.text} style={{ marginTop: 2 }}>{l.text}</Txt>
          </View>
        ))}
        {!!partial && (
          <View style={{ alignItems: "flex-end", marginTop: 12 }}>
            <View style={{ maxWidth: "84%", borderWidth: 1, borderStyle: "dashed", borderColor: T.lineStrong,
                           borderRadius: 18, borderBottomRightRadius: 6, paddingHorizontal: 14, paddingVertical: 9 }}>
              <Txt size={16} color={T.text3}>{partial}</Txt>
            </View>
          </View>
        )}
      </ScrollView>
      <View style={{ alignItems: "center", paddingTop: 18, paddingBottom: Math.max(insets.bottom, 14) + 6,
                     borderTopWidth: 1, borderColor: T.line, paddingHorizontal: 20 }}>
        <Pressable onPress={tap} disabled={!listen.available} accessibilityRole="button"
          accessibilityLabel={phase === "speaking" ? "Cut in" : phase === "listening" ? "Send now" : "Talk"}
          style={{ padding: 18 }}>
          <Mark size={112} busy={phase !== "idle"} color={error ? T.danger : phase === "idle" ? T.text : phaseColor} />
        </Pressable>
        <Txt size={14} weight="500" color={phaseColor} style={{ marginTop: 4 }}>{PHASE[phase]}</Txt>
        {!!error && <Txt size={13} color={T.danger} style={{ marginTop: 8, textAlign: "center" }}>{error}</Txt>}
        <Toggle label="Hands-free" sub="Listen again when the reply ends" value={handsFree} onChange={setHandsFree}
          style={{ alignSelf: "stretch", marginTop: 16 }} />
        <Toggle label="Talk over it to cut in" sub="Stops the agent when you start talking" value={cutIn} onChange={setCutIn}
          style={{ alignSelf: "stretch", marginTop: 8 }} />
        <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
          {phase === "idle"
            ? <Button label="Talk" icon="mic" kind="primary" disabled={!listen.available} onPress={listenNow} />
            : <Button label="Stop" icon="stop" kind="danger" onPress={stopAll} />}
        </View>
      </View>
    </View>
  );
}
