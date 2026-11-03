// The conversation with the agent, or a direct line to one of its roles. Live
// events drive it; polling is only the safety net for when the socket is down.
// Opened from a search result, it shows the past around that message and does
// not let new messages graft themselves onto it until you jump back to the
// latest. Under the header, whatever its hands are on, one tap away.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import Icon from "../components/Icon";
import Mark, { ProfileDot } from "../components/Mark";
import { A2ARow, ApprovalCard, DaySep, EventLine, HeartbeatRow, HeldCard, ImprovementCard, MessageRow, ToolGroup,
         TypingRow, rowsFor } from "../components/Messages";
import { HandsStrip, toneColor } from "../components/Tasks";
import { groupWorkers, presence } from "../harness";
import { api } from "../api";
import * as live from "../live";
import * as store from "../store";
import { useStore } from "../store";
import { speak, stopSpeaking } from "../voice";
import { T } from "../theme";
import { Button, Empty, HeaderButtons, IconButton, Txt, haptic, notify } from "../ui";

// inTab: the agent's own conversation, drawn in its tab above the tab bar, with its hands above it
export default function ChatScreen({ threadId, atId, nav, onVoice, active = true, focusKey, inTab = false }) {
  const insets = useSafeAreaInsets();
  const state = useStore((s) => s.state);
  const status = useStore((s) => s.status);
  const tool = useStore((s) => s.tool);
  const online = useStore((s) => s.online);
  const typing = useStore((s) => s.typing);
  const stream = useStore((s) => s.stream[threadId]);
  const jobs = useStore((s) => s.control.jobs);
  const roles = useStore((s) => s.control.agents);
  const kernel = useStore((s) => s.kernel);
  const workers = useStore((s) => s.control.workers);
  const inbox = useStore((s) => s.control.inbox);
  const inboxCount = (inbox || []).length;
  const agents = useMemo(() => store.agentsById(state), [state]);
  const thread = (state?.threads || []).find((t) => t.id === threadId) ||
    { id: threadId, kind: threadId.startsWith("dm:") ? "dm" : "group", agent: threadId.startsWith("dm:") ? threadId.slice(3) : null,
      name: threadId.startsWith("dm:") ? (agents[threadId.slice(3)]?.name || threadId.slice(3)) : "Team" };
  const agent = thread.agent ? agents[thread.agent] : null;
  const role = thread.agent ? roles?.[thread.agent]?.role || "" : "";
  // the agent itself, rather than a direct line to one of its roles
  const isLead = threadId === store.leadThread(state);

  const [msgs, setMsgs] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [older, setOlder] = useState(false);
  const [atLatest, setAtLatest] = useState(!atId);
  const [hit, setHit] = useState(atId || null);
  const [improvements, setImprovements] = useState([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState([]);
  const [menu, setMenu] = useState(false);
  const [kb, setKb] = useState(false);
  const [top, setTop] = useState(0);   // where the page starts on screen, under the header
  const [composerH, setComposerH] = useState(64);
  const box = useRef(null);
  const speakReplies = useRef(false);
  const lastSpoken = useRef(null);
  const latestRef = useRef(!atId);
  latestRef.current = atLatest;
  const loadedRef = useRef(false);
  const activeRef = useRef(active);
  activeRef.current = active;
  const input = useRef(null);
  const disarm = useRef(null);
  const [armedStop, setArmedStop] = useState(false);

  // the newest page; older messages already loaded above it are kept
  async function refresh() {
    if (!latestRef.current) return;
    try {
      const d = await api.thread(threadId);
      const page = d.messages || [];
      setMsgs((cur) => {
        if (!page.length) return cur.length ? cur : page;
        const first = page[0];
        const before = cur.filter((m) => m.ts < first.ts || (m.ts === first.ts && m.id < first.id));
        const next = [...before, ...page];
        const a = cur[cur.length - 1], b = next[next.length - 1];
        const same = cur.length === next.length && a && b && a.id === b.id && a.text === b.text;
        return same ? cur : next;
      });
      if (!loadedRef.current) setHasMore(!!d.has_more);
      loadedRef.current = true;
      setLoaded(true);
      speakNew(page);
    } catch {}
  }

  // spoken replies: only what arrives after the chat was opened
  function speakNew(page) {
    const newest = page.length ? page[page.length - 1].id : 0;
    if (lastSpoken.current === null) { lastSpoken.current = newest; return; }
    if (!speakReplies.current) return;
    for (const m of page) {
      if (m.id > lastSpoken.current && m.sender !== "user" && (!m.kind || m.kind === "chat")) {
        lastSpoken.current = m.id;
        if (!m.meta?.silent) speak(m.text);
      }
    }
  }

  async function loadAt(id) {
    try {
      const d = await api.get(`/api/thread/${encodeURIComponent(threadId)}?at_id=${id}`);
      setMsgs(d.messages || []);
      setHasMore(!!d.has_more);
      loadedRef.current = true;
      setLoaded(true);
    } catch (e) { notify(e.message, true); }
  }

  async function loadOlder() {
    if (older || !hasMore || !msgs.length) return;
    setOlder(true);
    try {
      const d = await api.thread(threadId, msgs[0]);
      setMsgs((cur) => [...(d.messages || []).filter((m) => !cur.some((c) => c.id === m.id)), ...cur]);
      setHasMore(!!d.has_more);
    } catch {}
    setOlder(false);
  }

  function toLatest() {
    setHit(null);
    setAtLatest(true);
    latestRef.current = true;
    setMsgs([]);
    loadedRef.current = false;
    setLoaded(false);
    refresh();
  }

  // The thread on screen is never unread, and a hidden tab does not count as on screen.
  // When this goes, whatever it covered is on screen again.
  useEffect(() => {
    if (!active) { stopSpeaking(); return undefined; }
    const before = store.get().current;
    store.setCurrent(threadId);
    refresh();
    return () => { if (store.get().current === threadId) store.setCurrent(before); };
  }, [active, threadId]);

  // sent here from the bar on Now, to write something
  useEffect(() => { if (focusKey) input.current?.focus(); }, [focusKey]);

  useEffect(() => {
    if (atId) loadAt(atId); else refresh();
    api.get("/api/settings/voice").then((s) => { speakReplies.current = !!s.speak_replies; }).catch(() => {});
    const unsub = live.subscribe((ev) => {
      if (ev.type === "message") {
        const m = ev.msg || {};
        const mine = m.thread === threadId ||
          (thread.kind === "dm" && m.kind === "a2a" && (m.sender === thread.agent || m.meta?.to === thread.agent));
        if (!mine || !latestRef.current) return;
        setMsgs((cur) => {
          const i = cur.findIndex((x) => x.id === m.id);
          if (i >= 0) { const next = [...cur]; next[i] = m; return next; }
          return [...cur, m];
        });
        if (activeRef.current) speakNew([m]);
      } else if (ev.type === "improvements_updated") {
        loadImprovements();
      } else if (ev.type === "link" && ev.on) {
        refresh();
      }
    });
    let tick = 0;
    const t = setInterval(() => {
      tick += 1;
      if (activeRef.current && (!live.connected() || tick % 6 === 0)) refresh();
    }, 2500);
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setKb(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKb(false));
    return () => {
      clearInterval(t); clearTimeout(disarm.current); unsub(); stopSpeaking(); show.remove(); hide.remove();
    };
  }, [threadId]);

  const hasImprovement = msgs.some((m) => m.kind === "improvement");
  async function loadImprovements() {
    try { setImprovements((await api.improvements()).improvements || []); } catch {}
  }
  useEffect(() => { if (hasImprovement) loadImprovements(); }, [hasImprovement]);

  /* ---------- sending ---------- */
  async function attach(file) {
    setMenu(false);
    const entry = { key: Date.now() + file.name, name: file.name, uploading: true };
    setPending((p) => [...p, entry]);
    try {
      const r = await api.upload(file);
      setPending((p) => p.map((e) => (e.key === entry.key ? { ...e, uploading: false, attachment: r.attachment } : e)));
    } catch (e) {
      setPending((p) => p.filter((x) => x.key !== entry.key));
      notify(String(e.message || e), true);
    }
  }
  async function pickPhoto() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (r.canceled || !r.assets?.length) return;
    const a = r.assets[0];
    attach({ uri: a.uri, name: a.fileName || "photo.jpg", mime: a.mimeType || "image/jpeg" });
  }
  async function pickFile() {
    const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (r.canceled || !r.assets?.length) return;
    const a = r.assets[0];
    attach({ uri: a.uri, name: a.name || "file", mime: a.mimeType });
  }

  const uploading = pending.some((e) => e.uploading);
  const ready = pending.filter((e) => e.attachment).map((e) => e.attachment);
  const canSend = !!(draft.trim() || ready.length) && !uploading;

  async function send() {
    if (!canSend) return;
    const text = draft.trim();
    setDraft(""); setPending([]);
    haptic.tap();
    if (!atLatest) toLatest();
    try { await api.send(threadId, text, ready); refresh(); }
    catch (e) { setDraft(text); notify(String(e.message || e), true); }
  }

  // Stop ends everything running as this role, not only what this chat started, so it asks twice.
  async function stop() {
    if (!armedStop) {
      setArmedStop(true);
      haptic.warn();
      disarm.current = setTimeout(() => setArmedStop(false), 4000);
      return;
    }
    clearTimeout(disarm.current);
    setArmedStop(false);
    const who = agent?.name || thread.agent;
    try {
      const r = await api.stop(thread.agent);
      notify(r.stopped ? `Stopped everything running as ${who}.` : `Nothing was running as ${who}.`);
    } catch (e) { notify(e.message, true); }
  }

  /* ---------- drawing ---------- */
  const st = thread.agent ? status[thread.agent] || "idle" : "idle";
  const busyMembers = thread.kind === "group" ? (thread.members || []).filter((a) => (status[a] || "idle") !== "idle") : [];
  const sub = thread.kind === "group"
    ? (busyMembers.length ? `${busyMembers.length} working…` : `${(thread.members || []).length} agents`)
    : st === "thinking" ? "Thinking…"
    : st === "doing" ? (tool[thread.agent] ? `Working · ${tool[thread.agent].replace(/_/g, " ")}` : "Working…")
    : role;
  const subColor = st === "thinking" ? T.warn : st === "doing" || busyMembers.length ? T.good : T.text3;

  const typingAgent = Object.entries(typing).find(([k, on]) => {
    if (!on) return false;
    const [aid, tid] = k.split("|");
    return tid === threadId || (thread.kind === "dm" && thread.agent === aid && tid.startsWith("a2a:"));
  })?.[0]?.split("|")[0];
  const writing = !!typingAgent || !!stream;

  const rows = useMemo(() => rowsFor(msgs, thread), [msgs, thread.kind]);
  const data = useMemo(() => [
    ...(writing && atLatest ? [{ type: "typing", id: "typing" }] : []),
    ...[...rows].reverse(),
  ], [rows, writing, atLatest]);
  const hands = useMemo(() => {
    const g = groupWorkers(kernel?.sessions || workers);
    return [...g.stuck, ...g.running, ...g.waiting];
  }, [kernel?.sessions, workers]);

  const onChanged = () => store.refreshControl();
  function renderRow({ item: r }) {
    switch (r.type) {
      case "day": return <DaySep ts={r.ts} />;
      case "beat": return <HeartbeatRow count={r.count} tools={r.tools} hit={hit} />;
      case "tools": return <ToolGroup items={r.items} hit={hit} />;
      case "approval": return <ApprovalCard m={r.m} jobs={jobs} agents={agents} onChanged={onChanged} />;
      case "held": return <HeldCard m={r.m} inbox={inbox} agents={agents} nav={nav} />;
      case "improvement":
        return <ImprovementCard m={r.m} improvements={improvements} agents={agents}
          onChanged={() => { loadImprovements(); onChanged(); }} />;
      case "event": return <EventLine m={r.m} />;
      case "a2a": return <A2ARow m={r.m} thread={thread} agents={agents} hit={hit === r.m.id} />;
      case "typing": return <TypingRow text={stream} />;
      default: return <MessageRow m={r.m} first={r.first} agents={agents} hit={hit === r.m.id} voice={thread.agent}
        onTask={nav.openMission} />;
    }
  }

  const p = presence(kernel, online);
  const used = kernel?.slots?.used ?? hands.filter((w) => w.status === "working").length;
  const head = isLead ? <Mark size={30} slots={kernel?.slots?.limit || 6} used={used} attention={inboxCount} busy={writing || p.busy} />
    : <ProfileDot agent={agent || { id: thread.agent }} size={28} />;
  const line = isLead ? (writing ? "Writing…" : p.word) : sub === role ? "Direct line" : sub;
  const lineColor = isLead ? (writing ? T.good : toneColor(p.tone)) : subColor;
  const composerBottom = kb ? 8 : inTab ? insets.bottom + 6 : Math.max(insets.bottom, 10);

  const title = () => (
    <Pressable onPress={() => thread.agent && nav.openProfile(thread.agent)} disabled={!thread.agent || isLead}
      accessibilityHint={thread.agent && !isLead ? "Opens the profile" : undefined}
      style={{ flexDirection: "row", alignItems: "center", gap: 9, maxWidth: 250 }}>
      {head}
      <View style={{ minWidth: 0, flexShrink: 1 }}>
        <Txt size={16} weight="600" numberOfLines={1} style={{ lineHeight: 20 }}>{thread.name}</Txt>
        {!!line && <Txt size={12} color={lineColor} numberOfLines={1} style={{ lineHeight: 15 }}>{line}</Txt>}
      </View>
    </Pressable>
  );
  const right = () => (
    <HeaderButtons>
      {!isLead && thread.agent && st !== "idle" && (armedStop
        ? <Button label={`Stop all ${agent?.name || thread.agent} work?`} small kind="danger-primary" onPress={stop} />
        : <IconButton name="stop" color={T.danger} onPress={stop} label="Stop" />)}
      {isLead && <IconButton name="search" color={T.text} onPress={() => nav.push({ kind: "search" })} label="Search everything" />}
      {thread.agent && !isLead && <IconButton name="more" color={T.text} onPress={() => nav.openProfile(thread.agent)} label="Profile" />}
    </HeaderButtons>
  );

  return (
    <View ref={box} style={{ flex: 1, backgroundColor: T.bg }}
      onLayout={() => box.current?.measureInWindow((_x, y) => setTop(y || 0))}>
      <Stack.Screen options={{ title: thread.name || "", headerTitle: title, headerRight: right }} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}
        keyboardVerticalOffset={top}>
        {inTab && <HandsStrip workers={hands} needs={inboxCount} onTask={(w) => nav.openTask(w.id)} onNeeds={() => nav.tab("inbox")} />}

        {loaded && !msgs.length ? (
          <View style={{ flex: 1, justifyContent: "center" }}>
            <Empty art={isLead ? <Mark size={72} /> : <ProfileDot agent={agent || { id: thread.agent }} size={56} />}
              title={agent ? agent.name : thread.name}
              text={isLead ? "Ask anything, or hand over a task. It starts the work and tells you when there is something to know."
                : "This reaches the role directly, with no Router in between. It is how you step in by name."} />
          </View>
        ) : (
          <FlatList
            inverted
            contentInsetAdjustmentBehavior="never"
            data={data}
            keyExtractor={(r) => r.id}
            renderItem={renderRow}
            // inverted, so paddingTop is the visual bottom: room for the "Jump to latest" pill
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: atLatest ? 14 : 64, paddingBottom: 10 }}
            maintainVisibleContentPosition={atLatest ? { minIndexForVisible: 0, autoscrollToTopThreshold: 120 } : undefined}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            onEndReached={loadOlder}
            onEndReachedThreshold={0.4}
            ListFooterComponent={hasMore ? (
              <Txt size={12.5} color={T.text3} style={{ alignSelf: "center", paddingVertical: 12 }}>
                {older ? "Loading earlier messages…" : "Earlier messages"}
              </Txt>
            ) : null}
          />
        )}

        {!atLatest && (
          <View style={{ position: "absolute", alignSelf: "center", bottom: composerH + 12 }}>
            <Button label="Jump to latest" icon="down" small onPress={toLatest}
              style={{ backgroundColor: T.surface, borderColor: T.lineStrong, borderWidth: 1 }} />
          </View>
        )}

        <View onLayout={(e) => setComposerH(e.nativeEvent.layout.height)}
          style={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: composerBottom }}>
          {menu && (
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
              <Button label="Photo" icon="image" small onPress={pickPhoto} />
              <Button label="File" icon="file" small onPress={pickFile} />
            </View>
          )}
          <View style={{ backgroundColor: T.surface, borderWidth: 1, borderColor: T.lineStrong, borderRadius: 22,
                         paddingLeft: 6, paddingRight: 6, paddingVertical: 5 }}>
            {pending.length > 0 && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 6, paddingTop: 4, paddingBottom: 2 }}>
                {pending.map((e) => (
                  <View key={e.key} style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 28, paddingLeft: 10,
                    paddingRight: e.uploading ? 10 : 4, borderRadius: 8, backgroundColor: T.surface2, borderWidth: 1,
                    borderColor: T.line, opacity: e.uploading ? 0.6 : 1, maxWidth: "100%" }}>
                    <Icon name="clip" size={13} color={T.text2} />
                    <Txt size={12.5} color={T.text2} numberOfLines={1} style={{ flexShrink: 1 }}>
                      {e.uploading ? `Uploading ${e.name}` : e.name}
                    </Txt>
                    {!e.uploading && (
                      <Pressable hitSlop={8} onPress={() => setPending((p) => p.filter((x) => x.key !== e.key))}
                        accessibilityLabel={`Remove ${e.name}`}>
                        <Icon name="x" size={14} color={T.text3} />
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
            )}
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2 }}>
              <IconButton name={menu ? "x" : "plus"} onPress={() => setMenu(!menu)} label="Attach" active={menu} />
              <TextInput ref={input} value={draft} onChangeText={setDraft} multiline
                placeholder={`Message ${agent?.name || thread.name || "the agent"}`}
                placeholderTextColor={T.text4} keyboardAppearance={T.scheme} selectionColor={T.focus}
                style={{ flex: 1, fontSize: 16, lineHeight: 21, color: T.text, maxHeight: 130, minHeight: 38,
                         paddingTop: 9, paddingBottom: 8, paddingHorizontal: 4 }} />
              {!canSend && !uploading && !!onVoice ? (
                <IconButton name="mic" color={T.text2} onPress={onVoice} label="Talk" style={{ width: 34, height: 34, margin: 2 }} />
              ) : (
                <Pressable onPress={send} disabled={!canSend} accessibilityLabel="Send"
                  style={{ width: 34, height: 34, borderRadius: 17, margin: 2, backgroundColor: T.accent, alignItems: "center",
                           justifyContent: "center", opacity: canSend ? 1 : 0.25 }}>
                  <Icon name="up" size={18} color={T.accentInk} weight={2.2} />
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
