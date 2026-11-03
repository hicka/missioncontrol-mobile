// The agent at a glance, as the Mac's floating bar shows it: the orb, whose light
// says what it is doing, one line for what is happening now, what needs you, each
// open task with its steps so far, and the last thing said. Ask from here, by
// typing or by voice; the reply arrives here as it is written.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View, useWindowDimensions } from "react-native";
import { useIsFocused } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "../components/Icon";
import { KIND } from "../components/Decisions";
import { ProfileDot } from "../components/Mark";
import Orb from "../components/Orb";
import { ReachBanner, useGate } from "../components/Reach";
import { StatePill } from "../components/Tasks";
import { agentName, toolDetail } from "../components/Work";
import { api } from "../api";
import { barStatus, clip, isRoutine, peekSummary, plainTail, taskTitle, workerState } from "../harness";
import * as live from "../live";
import { nav } from "../nav";
import * as store from "../store";
import { useStore } from "../store";
import { T, ago, colorOf, fmtTime } from "../theme";
import { Card, IconButton, Txt, haptic, notify, useWindowTop } from "../ui";

const OPEN = ["working", "waiting", "blocked", "queued", "stalled"];
const AWAY = 3 * 3600;

export default function HomeScreen() {
  const gate = useGate();
  if (gate) return gate;
  return <Home />;
}

function Home() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const focused = useIsFocused();
  const page = useWindowTop();
  const state = useStore((s) => s.state);
  const control = useStore((s) => s.control);
  const kernel = useStore((s) => s.kernel);
  const online = useStore((s) => s.online);
  const status = useStore((s) => s.status);
  const tool = useStore((s) => s.tool);
  const lead = store.lead(state);
  const thread = store.leadThread(state);
  const stream = useStore((s) => (thread ? s.stream[thread] : ""));
  const agents = useMemo(() => store.agentsById(state), [state]);
  const name = lead?.name || "Your agent";
  const inbox = control.inbox || [];
  const sessions = kernel?.sessions || control.workers || [];
  const open = useMemo(() => sessions.filter((w) => OPEN.includes(w.status) && !w.direct && !isRoutine(w))
    .sort((a, b) => (a.status === "working" ? 0 : 1) - (b.status === "working" ? 0 : 1) || (b.updated || 0) - (a.updated || 0)),
  [sessions]);
  const bar = barStatus({ online, lead, stream, inbox, status, tool, workers: open, name });

  const [msgs, setMsgs] = useState([]);
  const [draft, setDraft] = useState("");
  const [kb, setKb] = useState(false);
  const [armed, setArmed] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);
  const last = useRef(bar.mood);
  const disarm = useRef(null);

  // the last few things said, to show the latest exchange
  async function load() {
    if (!thread) return;
    try { setMsgs(((await api.thread(thread)).messages || []).filter((m) => !m.kind || m.kind === "chat").slice(-12)); } catch {}
  }
  useEffect(() => {
    if (!focused) return undefined;
    load();
    const unsub = live.subscribe((ev) => { if (ev.type === "message" && ev.msg?.thread === thread) load(); });
    const t = setInterval(() => { if (!live.connected()) load(); }, 4000);
    return () => { unsub(); clearInterval(t); };
  }, [focused, thread]);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setKb(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKb(false));
    return () => { show.remove(); hide.remove(); clearTimeout(disarm.current); };
  }, []);

  // light passes through the orb when something changes: as on the Mac, a new
  // need, thinking starting, and work coming to rest each send a pulse
  useEffect(() => {
    const was = last.current;
    last.current = bar.mood;
    if (was === bar.mood) return;
    if (bar.mood === "attention") { haptic.warn(); setPulseKey((k) => k + 1); }
    else if (bar.mood === "thinking" && was === "idle") setPulseKey((k) => k + 1);
    else if (bar.mood === "idle" && ["thinking", "streaming", "working", "waiting"].includes(was)) setPulseKey((k) => k + 1);
  }, [bar.mood]);

  const busy = lead && (status[lead.id] || "idle") !== "idle";
  async function send() {
    const text = draft.trim();
    if (!text || !thread) return;
    setDraft("");
    haptic.tap();
    setMsgs((m) => [...m, { id: `local-${Date.now()}`, ts: Date.now() / 1000, sender: "user", kind: "chat", text }]);
    try { await api.send(thread, text); load(); }
    catch (e) { setDraft(text); notify(String(e.message || e), true); }
  }
  async function stop() {
    if (!armed) {
      setArmed(true); haptic.warn();
      disarm.current = setTimeout(() => setArmed(false), 4000);
      return;
    }
    clearTimeout(disarm.current); setArmed(false);
    try {
      const r = await api.stop(lead.id);
      notify(r.stopped ? `Stopped what ${name} was doing.` : `${name} was not doing anything.`);
    } catch (e) { notify(e.message, true); }
  }

  // the latest exchange: what you last said and what came back after it
  const youAt = msgs.map((m) => m.sender).lastIndexOf("user");
  const yours = youAt >= 0 ? msgs[youAt] : null;
  const answer = (youAt >= 0 ? msgs.slice(youAt + 1) : msgs.slice(-1)).filter((m) => m.sender !== "user");
  const reply = answer[answer.length - 1] || (youAt < 0 ? msgs[msgs.length - 1] : null);
  const away = awayLine(msgs, sessions);

  const orbH = Math.round(Math.min(330, width * 0.78));
  const satellites = open.slice(0, 8).map((w) => ({ id: w.id, color: colorOf(agents[w.profile]), resting: w.status !== "working" }));

  return (
    <View ref={page.ref} onLayout={page.onLayout} style={{ flex: 1, backgroundColor: T.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }} keyboardVerticalOffset={page.top}>
        <ScrollView contentInsetAdjustmentBehavior="never" keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: 18 }}>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 4 }}>
            <Txt display size={28} numberOfLines={1} style={{ flex: 1 }}>{name}</Txt>
            <IconButton name="search" color={T.text} label="Search everything" onPress={() => nav.push({ kind: "search" })} />
            <IconButton name="bolt" color={T.text} label="Activity" onPress={() => nav.tab("activity")} />
          </View>

          <Pressable onPress={() => (bar.needs ? nav.tab("inbox") : open[0] ? nav.tab("tasks") : nav.tab("chat", { focus: true }))}
            accessibilityRole="button" accessibilityLabel={`${name}: ${bar.title || "replying"}. ${bar.detail}`}>
            <View style={{ alignItems: "center", marginTop: -8 }}>
              <Orb mood={bar.mood} tasks={satellites} width={width} height={orbH} radius={Math.round(orbH * 0.2)}
                active={focused} pulseKey={pulseKey} />
            </View>
            <View style={{ alignItems: "center", paddingHorizontal: 28, marginTop: -18, minHeight: 64 }}>
              {bar.mood === "streaming" ? (
                <Txt size={16} color={T.text2} numberOfLines={3} style={{ textAlign: "center" }}>{plainTail(bar.detail, 180)}</Txt>
              ) : (
                <>
                  <Txt size={20} weight="600" numberOfLines={2} style={{ textAlign: "center", letterSpacing: -0.3 }}>{bar.title}</Txt>
                  {!!bar.detail && (
                    <Txt size={14.5} color={T.text3} numberOfLines={2} style={{ textAlign: "center", marginTop: 3 }}>
                      {bar.detail}
                    </Txt>
                  )}
                </>
              )}
            </View>
          </Pressable>

          <View style={{ paddingHorizontal: 16, gap: 12, marginTop: 14 }}>
            <ReachBanner />
            {!!away && <Txt size={13.5} color={T.text3} style={{ textAlign: "center" }}>{away}</Txt>}

            {inbox.length > 0 && (
              <Card style={{ borderColor: T.signal }}>
                {inbox.slice(0, 3).map((i, n) => {
                  const k = KIND[i.kind] || { label: i.kind };
                  const code = ["command", "tool"].includes(i.kind);
                  return (
                    <Pressable key={`${i.kind}:${i.id}`} onPress={() => nav.tab("inbox")} accessibilityRole="button"
                      style={({ pressed }) => ({ paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: n ? 1 : 0, borderColor: T.line,
                                                 backgroundColor: pressed ? T.hover : "transparent" })}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: T.signal }} />
                        <Txt size={12.5} weight="600" color={T.signal} numberOfLines={1} style={{ flex: 1 }}>
                          {k.label}{i.agent && i.agent !== "*" ? ` · ${agentName(i.agent, agents)}` : ""}
                        </Txt>
                        <Txt size={12} color={T.text4}>{ago(i.ts)}</Txt>
                      </View>
                      <Txt size={code ? 13.5 : 15} mono={code} weight={code ? "400" : "500"} numberOfLines={2} style={{ marginTop: 5 }}>
                        {String(i.title).split("\n")[0]}
                      </Txt>
                    </Pressable>
                  );
                })}
                {inbox.length > 3 && (
                  <Pressable onPress={() => nav.tab("inbox")} style={{ paddingVertical: 11, alignItems: "center", borderTopWidth: 1, borderColor: T.line }}>
                    <Txt size={13.5} color={T.text3}>{inbox.length - 3} more in the Inbox</Txt>
                  </Pressable>
                )}
              </Card>
            )}

            {open.length > 0 && (
              <Card>
                {open.slice(0, 5).map((w, i) => (
                  <View key={w.id}>
                    {i > 0 && <View style={{ height: 1, backgroundColor: T.line, marginLeft: 46 }} />}
                    <TaskLine w={w} agents={agents} missions={control.missions} executions={control.executions} />
                  </View>
                ))}
                {open.length > 5 && (
                  <Pressable onPress={() => nav.tab("tasks")} style={{ paddingVertical: 11, alignItems: "center", borderTopWidth: 1, borderColor: T.line }}>
                    <Txt size={13.5} color={T.text3}>{open.length - 5} more open</Txt>
                  </Pressable>
                )}
              </Card>
            )}

            {(yours || reply) && (
              <Pressable onPress={() => nav.tab("chat")} accessibilityRole="button" accessibilityHint="Opens the conversation"
                style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
                <Card pad={14}>
                  {!!yours && (
                    <View style={{ alignSelf: "flex-end", maxWidth: "85%", backgroundColor: T.surface2, borderRadius: 14,
                                   paddingHorizontal: 12, paddingVertical: 8, marginBottom: reply ? 10 : 0 }}>
                      <Txt size={14.5} numberOfLines={4}>{yours.text}</Txt>
                    </View>
                  )}
                  {stream ? (
                    <Txt size={14.5} color={T.text2} numberOfLines={6}>{peekSummary(stream, 400)}</Txt>
                  ) : reply ? (
                    <Txt size={14.5} color={T.text2} numberOfLines={7}>{peekSummary(reply.text)}</Txt>
                  ) : (
                    <Txt size={14} color={T.text3}>{busy ? "Thinking…" : "Waiting for an answer…"}</Txt>
                  )}
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10, gap: 4 }}>
                    <Txt size={12.5} color={T.text4} style={{ flex: 1 }}>{reply ? fmtTime(reply.ts) : ""}</Txt>
                    <Txt size={13} color={T.text3}>Conversation</Txt>
                    <Icon name="chev" size={14} color={T.text3} />
                  </View>
                </Card>
              </Pressable>
            )}
          </View>
        </ScrollView>

        <View style={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: kb ? 8 : insets.bottom + 6 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4, backgroundColor: T.surface, borderWidth: 1,
                         borderColor: T.lineStrong, borderRadius: 24, paddingLeft: 16, paddingRight: 5, paddingVertical: 5 }}>
            <TextInput value={draft} onChangeText={setDraft} multiline placeholder="Ask anything, or hand over a task"
              placeholderTextColor={T.text4} keyboardAppearance={T.scheme} selectionColor={T.focus}
              style={{ flex: 1, fontSize: 16, lineHeight: 21, color: T.text, maxHeight: 120, minHeight: 36, paddingTop: 8, paddingBottom: 7 }} />
            {!draft.trim() && <IconButton name="mic" color={T.text2} label="Talk" onPress={() => nav.openVoice()} style={{ width: 36, height: 36, borderRadius: 18 }} />}
            {!draft.trim() && busy ? (
              <Pressable onPress={stop} accessibilityLabel={armed ? `Stop ${name}?` : "Stop"}
                style={{ height: 36, minWidth: 36, paddingHorizontal: armed ? 12 : 0, borderRadius: 18, alignItems: "center", justifyContent: "center",
                         backgroundColor: armed ? T.danger : T.surface3 }}>
                {armed ? <Txt size={13.5} weight="600" color="#ffffff">Stop?</Txt> : <Icon name="stop" size={15} color={T.text} fill />}
              </Pressable>
            ) : (
              <Pressable onPress={send} disabled={!draft.trim()} accessibilityLabel="Send"
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: T.accent, alignItems: "center", justifyContent: "center",
                         opacity: draft.trim() ? 1 : 0.25 }}>
                <Icon name="up" size={18} color={T.accentInk} weight={2.2} />
              </Pressable>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// One open task, as the bar's task strip draws it: who runs it, what it is, its steps
// so far as a row of marks, and the one running now named beside them.
function TaskLine({ w, agents, missions, executions }) {
  const mission = (missions || []).find((m) => m.id === w.mission);
  const st = workerState(w, mission);
  const steps = (executions || []).filter((e) => e.kind === "tool" && ((w.mission && e.mission === w.mission) || e.detail?.session === w.id))
    .sort((a, b) => (a.ts || 0) - (b.ts || 0));
  const now = [...steps].reverse().find((e) => e.status === "running");
  const failed = steps.filter((e) => e.status === "failed").length;
  return (
    <Pressable onPress={() => nav.openTask(w.id)} accessibilityRole="button"
      style={({ pressed }) => ({ flexDirection: "row", gap: 12, paddingHorizontal: 14, paddingVertical: 12,
                                 backgroundColor: pressed ? T.hover : "transparent" })}>
      <View style={{ marginTop: 1 }}><ProfileDot agent={agents[w.profile] || { id: w.profile }} size={22} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Txt size={14.5} weight="500" numberOfLines={1} style={{ flex: 1 }}>{taskTitle(w)}</Txt>
          <StatePill state={st} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}
          accessible accessibilityLabel={steps.length ? `${steps.length} steps${failed ? `, ${failed} failed` : ""}` : "No steps yet"}>
          {steps.length > 0 && (
            <View style={{ flexDirection: "row", gap: 2 }}>
              {steps.slice(-18).map((e) => (
                <View key={e.id} style={{ width: 5, height: 5, borderRadius: 1.5,
                  backgroundColor: e.status === "failed" ? T.danger : e.status === "running" ? T.text : T.text4 }} />
              ))}
            </View>
          )}
          <Txt size={12} mono={!!now} color={T.text3} numberOfLines={1} style={{ flex: 1 }}>
            {now ? clip(`${now.name.replace(/_/g, " ")} · ${toolDetail(now)}`, 60)
              : `${agentName(w.profile, agents)} · ${ago(w.updated)}`}
          </Txt>
        </View>
      </View>
    </Pressable>
  );
}

// After a long absence, what finished meanwhile, in one line. It goes once the owner says something.
function awayLine(msgs, sessions) {
  const said = [...msgs].reverse().find((m) => m.sender === "user");
  if (!said || Date.now() / 1000 - said.ts < AWAY) return "";
  const done = sessions.filter((w) => !OPEN.includes(w.status) && !w.direct && !isRoutine(w) && (w.updated || 0) > said.ts);
  if (!done.length) return "";
  return done.length === 1 ? `While you were away: ${clip(taskTitle(done[0]), 50)} ended.` : `While you were away: ${done.length} tasks ended.`;
}
