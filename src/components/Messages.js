// The pieces a conversation is made of: your messages in a quiet bubble on the
// right, the agent's on the page in its one voice, tool steps folded into one
// line, heartbeats as one beating heart, and approval cards that show what
// will run before anything does.
import React, { useEffect, useRef, useState } from "react";
import { Animated, Image, Linking, Pressable, View } from "react-native";
import Icon from "./Icon";
import { AgentMark } from "./Presence";
import Rich, { Inline } from "./Rich";
import { api, authHeaders, baseUrl, fileUrl } from "../api";
import { Decision } from "./Decisions";
import { workBetween } from "../harness";
import { RADIUS, T, fmtDay, fmtTime } from "../theme";
import { Button, Pill, Pre, Sheet, Txt, haptic, notify } from "../ui";

export const isBeat = (m) => m.kind === "sys" && m.sender === "heartbeat";
// an agent saying it has nothing to say says nothing worth a row
const silent = (m) => (!m.kind || m.kind === "chat" || m.kind === "a2a") && m.sender !== "user" &&
  /^\W*no[_ ]?reply\W*$/i.test(m.text || "") && !(m.meta?.attachments || []).length;

// Rows for a thread, oldest first: day breaks, folded tool runs, heartbeats,
// cards, and where each run of messages from one sender begins. The tasks the
// conversation started on this page sit where they began, each before whatever
// was said after it.
export function rowsFor(msgs, thread, work) {
  const rows = [];
  let prev = null;
  const tasks = msgs.length ? workBetween(work, msgs[0].ts) : [];
  let next = 0;
  const workRow = () => { const t = tasks[next++]; rows.push({ type: "work", id: "w" + t.id, task: t.id }); };
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    while (next < tasks.length && tasks[next].started + 4 < m.ts) workRow();
    if (silent(m)) continue;
    if (!prev || m.ts - prev.ts > 1800) rows.push({ type: "day", id: "d" + m.id, ts: m.ts });
    if (isBeat(m)) {
      const beats = [m], tools = [];
      while (i + 1 < msgs.length && (isBeat(msgs[i + 1]) || msgs[i + 1].kind === "tool")) {
        const n = msgs[++i];
        if (n.kind === "tool") tools.push(n); else beats.push(n);
      }
      rows.push({ type: "beat", id: "h" + m.id, count: beats.length, tools });
      prev = msgs[i]; continue;
    }
    if (m.kind === "tool") {
      const group = [m];
      while (i + 1 < msgs.length && msgs[i + 1].kind === "tool" && msgs[i + 1].sender === m.sender &&
             msgs[i + 1].ts - msgs[i].ts < 1800) group.push(msgs[++i]);
      rows.push({ type: "tools", id: "t" + m.id, items: group });
      prev = group[group.length - 1]; continue;
    }
    if (m.kind === "approval") { rows.push({ type: "approval", id: "a" + m.id, m }); prev = m; continue; }
    // the notice that a command was held carries the hold itself, to decide here
    if (typeof m.meta?.approval === "string") { rows.push({ type: "held", id: "p" + m.id, m }); prev = m; continue; }
    if (m.kind === "improvement") { rows.push({ type: "improvement", id: "i" + m.id, m }); prev = m; continue; }
    if (m.kind === "sys") {
      if (m.sender !== "setup") rows.push({ type: "event", id: "s" + m.id, m });
      prev = m; continue;
    }
    if (m.kind === "a2a" && thread?.kind === "dm") {
      rows.push({ type: "a2a", id: "x" + m.id, m });
      prev = m; continue;
    }
    const first = !prev || prev.sender !== m.sender || prev.kind !== m.kind || m.ts - prev.ts > 300;
    rows.push({ type: "msg", id: "m" + m.id, m, first });
    prev = m;
  }
  while (next < tasks.length) workRow();
  return rows;
}

export function DaySep({ ts }) {
  return (
    <Txt size={12} color={T.text4} style={{ alignSelf: "center", marginTop: 22, marginBottom: 6 }}>
      <Txt size={12} weight="500" color={T.text3}>{fmtDay(ts)}</Txt>{"  "}{fmtTime(ts)}
    </Txt>
  );
}

// Only someone other than the voice of this conversation needs naming.
function Head({ agent, name, ts }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
      <AgentMark agent={agent} id={name} size={22} />
      <Txt size={13.5} weight="600">{agent?.name || name}</Txt>
      {!!ts && <Txt size={12} color={T.text4}>{fmtTime(ts)}</Txt>}
    </View>
  );
}

export function MessageRow({ m, first, agents, hit, voice, onTask }) {
  const out = m.sender === "user";
  const atts = m.meta?.attachments || [];
  const body = (
    <>
      {atts.map((a, i) => <Attachment key={i} a={a} />)}
      {!!m.text && <Rich text={m.text} size={16} />}
    </>
  );
  if (out) {
    return (
      <View style={{ alignItems: "flex-end", marginTop: first ? 18 : 4 }}>
        <View style={{ maxWidth: "84%", backgroundColor: T.surface2, borderWidth: 1, borderColor: hit ? T.warn : T.line,
                       borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomLeftRadius: 18,
                       borderBottomRightRadius: 6, paddingHorizontal: 14, paddingVertical: 9 }}>
          {body}
        </View>
      </View>
    );
  }
  return (
    <View style={{ marginTop: first ? 16 : 4, borderRadius: 10, borderWidth: hit ? 2 : 0, borderColor: T.warn,
                   padding: hit ? 6 : 0 }}>
      {first && m.sender !== voice && <Head agent={agents[m.sender]} name={m.sender} ts={m.ts} />}
      {body}
      {!!m.meta?.mission && !!onTask && (
        <Pressable onPress={() => onTask(m.meta.mission)} hitSlop={6} accessibilityRole="button"
          style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 3, marginTop: 5 }}>
          <Txt size={13} color={T.text3}>See the task</Txt>
          <Icon name="chev" size={13} color={T.text3} />
        </Pressable>
      )}
    </View>
  );
}

export function A2ARow({ m, thread, agents, hit }) {
  const me = thread.agent;
  const other = m.sender === me ? m.meta?.to : m.sender;
  const oa = agents[other] || { id: other, name: other, color: "#8e8e93" };
  return (
    <View style={{ marginTop: 18, borderRadius: 10, borderWidth: hit ? 2 : 0, borderColor: T.warn, padding: hit ? 6 : 0 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 4 }}>
        <Txt size={12.5} color={T.text3}>{m.sender === me ? "Messaged" : "From"}</Txt>
        <AgentMark agent={oa} size={20} />
        <Txt size={12.5} color={T.text3}>{oa.name}</Txt>
        <Txt size={12} color={T.text4}>{fmtTime(m.ts)}</Txt>
      </View>
      <Rich text={m.text} size={16} />
    </View>
  );
}

// a note from the system itself; long ones fold to three lines until tapped
export function EventLine({ m }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable onPress={() => setOpen(!open)} style={{ alignSelf: "center", maxWidth: "92%", marginTop: 12 }}>
      <Txt size={12.5} color={T.text3} numberOfLines={open ? undefined : 3} style={{ textAlign: "center" }}>
        <Txt size={12.5} weight="500" color={T.text2}>{m.sender}  </Txt>
        {String(m.text || "").replace(/`/g, "")}
      </Txt>
    </Pressable>
  );
}

// Claude Code runs are worth watching, so a group with one is open; so is a
// group holding the step a search landed on
export function ToolGroup({ items, inset = 0, hit }) {
  const [open, setOpen] = useState(items.some((g) => g.meta?.tool === "claude" || g.id === hit));
  const n = items.length;
  return (
    <View style={{ marginTop: 8, marginLeft: inset }}>
      <Pressable onPress={() => setOpen(!open)} hitSlop={6} accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => ({ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6,
          height: 28, paddingHorizontal: 11, borderRadius: 99, borderWidth: 1,
          borderColor: pressed ? T.lineStrong : T.line })}>
        <Icon name="bolt" size={13} color={T.text3} />
        <Txt size={12.5} color={T.text3}>{n} step{n === 1 ? "" : "s"}</Txt>
        <View style={{ transform: [{ rotate: open ? "90deg" : "0deg" }] }}>
          <Icon name="chev" size={13} color={T.text3} />
        </View>
      </Pressable>
      {open && (
        <View style={{ marginTop: 8, borderLeftWidth: 2, borderColor: T.lineStrong, paddingLeft: 12, paddingVertical: 2, gap: 2 }}>
          {items.map((g) => (
            <Txt key={g.id} mono selectable size={12} color={g.id === hit ? T.text : T.text3}
              style={{ lineHeight: 19, backgroundColor: g.id === hit ? T.warnSoft : "transparent" }}>
              {((g.meta?.tool === "terminal" ? "$ " : "") + String(g.text || "")).slice(0, 400)}
            </Txt>
          ))}
        </View>
      )}
    </View>
  );
}

export function HeartbeatRow({ count, tools, hit }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const beat = Animated.loop(Animated.sequence([
      Animated.timing(scale, { toValue: 1.18, duration: 180, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1.12, duration: 180, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(1080),
    ]));
    beat.start();
    return () => beat.stop();
  }, []);
  return (
    <View style={{ marginTop: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "center" }}>
        <Animated.View style={{ transform: [{ scale }], opacity: 0.8 }}>
          <Icon name="heart" size={13} color={T.danger} />
        </Animated.View>
        <Txt size={12} color={T.text4}>
          {count} heartbeat{count === 1 ? "" : "s"}{tools.length ? ` · ${tools.length} step${tools.length === 1 ? "" : "s"}` : ""}
        </Txt>
      </View>
      {tools.length > 0 && <ToolGroup items={tools} inset={0} hit={hit} />}
    </View>
  );
}

// The agent thinking, or the reply as it is being written.
export function TypingRow({ text }) {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current,
                useRef(new Animated.Value(0)).current];
  useEffect(() => {
    const loops = dots.map((d, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 180),
      Animated.timing(d, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(d, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.delay(520 - i * 180),
    ])));
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, []);
  return (
    <View style={{ marginTop: 16 }}>
      {!!text && <Rich text={text} size={16} />}
      <View style={{ flexDirection: "row", gap: 4, paddingVertical: 8 }}>
        {dots.map((d, i) => (
          <Animated.View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: T.text3,
            opacity: d.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
            transform: [{ translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) }] }} />
        ))}
      </View>
    </View>
  );
}

function Card({ children }) {
  return (
    <View style={{ marginTop: 14, padding: 14, borderRadius: RADIUS.lg, backgroundColor: T.surface,
                   borderWidth: 1, borderColor: T.lineStrong }}>
      {children}
    </View>
  );
}

// A scheduled job asking to start. It runs exactly as shown, so the whole
// task and the shell check it runs before every fire are both on the card.
// A held command, where the conversation mentions it: while it waits, the same card as
// the Inbox, whole and answerable; once answered, what became of it.
export function HeldCard({ m, inbox, agents, nav }) {
  const id = m.meta.approval;
  const waiting = (inbox || []).find((i) => (i.kind === "command" || i.kind === "tool") && i.id === id);
  const [rec, setRec] = useState(null);
  useEffect(() => {
    if (waiting) return;
    api.get(`/api/approvals/${encodeURIComponent(id)}`).then(setRec).catch(() => {});
  }, [id, !!waiting]);
  if (waiting) return <View style={{ marginVertical: 4 }}><Decision i={waiting} agents={agents} nav={nav} /></View>;
  const status = rec?.status || "";
  const word = { approved: "Ran", done: "Ran", denied: "Declined", expired: "Expired", pending: "Waiting" }[status] || "Answered";
  return (
    <Card pad={14} style={{ marginVertical: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Icon name="shield" size={15} color={T.text3} />
        <Txt size={12.5} weight="500" color={T.text3} style={{ flex: 1 }}>
          Command held for you{rec?.agent ? ` · ${agents[rec.agent]?.name || rec.agent}` : ""}
        </Txt>
        {!!rec && <Pill status={status === "denied" ? "cancelled" : status === "pending" ? "waiting" : "done"} label={word} />}
      </View>
      <Pre>{rec?.command || m.text}</Pre>
    </Card>
  );
}

export function ApprovalCard({ m, jobs, agents, onChanged }) {
  const [busy, setBusy] = useState("");
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  const jid = m.meta?.job_id;
  const job = (jobs || []).find((j) => j.id === jid);
  const status = job ? job.status : "removed";
  async function act(action) {
    // a job with a shell check runs that check on the Mac, so it asks twice, as in the Inbox
    if (action === "approve" && job?.monitor_cmd && !armed) { setArmed(true); haptic.warn(); return; }
    setArmed(false);
    setBusy(action);
    try { await api.cronAction(jid, action); haptic.done(); onChanged && onChanged(); }
    catch (e) { notify(e.message, true); }
    setBusy("");
  }
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
        <Icon name="clock" size={15} color={T.warn} />
        <Txt size={12.5} weight="500" color={T.text3}>Scheduled job wants your approval</Txt>
      </View>
      <Txt size={15} weight="600" style={{ marginTop: 6 }}>{m.meta?.name || ""}</Txt>
      <Txt size={12.5} color={T.text3} style={{ marginTop: 2 }}>
        {agents[m.meta?.agent]?.name || m.meta?.agent} · {m.meta?.schedule || ""}
      </Txt>
      <Txt size={14} color={T.text2} selectable style={{ marginTop: 8 }}>{m.meta?.task || ""}</Txt>
      {!!job?.monitor_cmd && (
        <>
          <Txt size={12.5} color={T.text3} style={{ marginTop: 10 }}>Before every run it executes this check in your shell:</Txt>
          <Pre>{job.monitor_cmd}</Pre>
        </>
      )}
      {status === "pending" ? (
        <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
          <Button label="Reject" kind="danger" small busy={busy === "delete"} onPress={() => act("delete")} />
          <Button label={armed ? "Tap again to approve" : "Approve"} kind={armed ? "danger-primary" : "primary"} small
            busy={busy === "approve"} onPress={() => act("approve")} />
        </View>
      ) : (
        <View style={{ marginTop: 10 }}>
          <Pill status={status === "removed" ? "cancelled" : status} label={status === "removed" ? "Rejected" : undefined} />
        </View>
      )}
    </Card>
  );
}

// A change an agent proposes to Mission Control itself: read the diff before
// deciding; approving applies it and restarts, and a change that does not
// come back up is rolled back on its own.
export function ImprovementCard({ m, improvements, agents, onChanged }) {
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [diff, setDiff] = useState(null);
  useEffect(() => {
    if (!confirm) return undefined;
    const t = setTimeout(() => setConfirm(false), 4000);
    return () => clearTimeout(t);
  }, [confirm]);
  const iid = m.meta?.improvement_id;
  const rec = (improvements || []).find((x) => x.id === iid);
  const status = rec ? rec.status : "removed";
  const files = (m.meta?.files || []).slice(0, 8);
  async function act(action) {
    if (action === "approve" && !confirm) { setConfirm(true); return; }
    setBusy(action);
    try {
      await api.improvement(iid, action);
      if (action === "approve") notify("Applying the change and restarting. If it does not come back, it rolls back by itself.");
      onChanged && onChanged();
    } catch (e) { notify(e.message, true); }
    setBusy(""); setConfirm(false);
  }
  async function showDiff() {
    try { const d = await api.diff(iid); setDiff(d); } catch (e) { notify(e.message, true); }
  }
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
        <Icon name="branch" size={15} color={T.warn} />
        <Txt size={12.5} weight="500" color={T.text3}>A change to Mission Control wants your approval</Txt>
      </View>
      <Txt size={15} weight="600" style={{ marginTop: 6 }}>{m.meta?.title || ""}</Txt>
      <Txt size={12.5} color={T.text3} style={{ marginTop: 2 }}>
        {agents[m.meta?.agent]?.name || m.meta?.agent} · {files.length} file{files.length === 1 ? "" : "s"} ·
        +{m.meta?.added || 0}/-{m.meta?.removed || 0} · tests green
      </Txt>
      <View style={{ marginTop: 8 }}><Rich text={m.meta?.rationale || ""} size={14} color={T.text2} /></View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
        {files.map((f) => (
          <Txt key={f} mono size={11.5} color={T.text2} style={{ backgroundColor: T.surface2, borderRadius: 6,
            paddingHorizontal: 6, paddingVertical: 1, overflow: "hidden" }}>{f}</Txt>
        ))}
      </View>
      {status === "pending" ? (
        <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end", marginTop: 12, flexWrap: "wrap" }}>
          <Button label="View diff" kind="ghost" small onPress={showDiff} />
          <Button label="Reject" kind="danger" small busy={busy === "reject"} onPress={() => act("reject")} />
          <Button label={confirm ? "Approve and restart?" : "Approve & restart"} kind={confirm ? "danger-primary" : "primary"}
            small busy={busy === "approve"} onPress={() => act("approve")} />
        </View>
      ) : (
        <View style={{ marginTop: 10 }}><Pill status={status === "applied" ? "completed" : status === "removed" ? "cancelled" : status}
          label={status === "removed" ? "Removed" : status[0].toUpperCase() + status.slice(1)} /></View>
      )}
      {!!diff && (
        <Sheet visible onClose={() => setDiff(null)} title={diff.title || "Proposed change"}>
          <DiffView text={diff.diff || "(empty)"} />
        </Sheet>
      )}
    </Card>
  );
}

export function DiffView({ text }) {
  const lines = String(text).split("\n").slice(0, 4000);
  return (
    <View style={{ backgroundColor: T.surface2, borderRadius: 10, borderWidth: 1, borderColor: T.line, padding: 10 }}>
      {lines.map((l, i) => {
        const add = l.startsWith("+") && !l.startsWith("+++"), del = l.startsWith("-") && !l.startsWith("---");
        const head = l.startsWith("@@") || l.startsWith("diff ");
        return (
          <Txt key={i} mono selectable size={11.5} style={{ lineHeight: 17,
            color: add ? T.good : del ? T.danger : head ? T.info : T.text2,
            backgroundColor: add ? T.goodSoft : del ? T.dangerSoft : "transparent" }}>{l || " "}</Txt>
        );
      })}
    </View>
  );
}

export function Attachment({ a }) {
  const open = () => Linking.openURL(fileUrl(a.url)).catch(() => {});
  const name = String(a.name || "file").replace(/^[0-9a-f]{8}-/, "");
  if (a.kind === "image") {
    return (
      <Pressable onPress={open} style={{ marginVertical: 4, alignSelf: "flex-start" }} accessibilityLabel={`Image ${name}`}>
        <Image source={{ uri: baseUrl() + a.url, headers: authHeaders() }} resizeMode="cover"
          style={{ width: 240, height: 170, borderRadius: 12, borderWidth: 1, borderColor: T.line,
                   backgroundColor: T.surface }} />
      </Pressable>
    );
  }
  return (
    <Pressable onPress={open} style={({ pressed }) => ({ alignSelf: "flex-start", flexDirection: "row", alignItems: "center",
      gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: T.line,
      backgroundColor: pressed ? T.surface2 : T.surface, marginVertical: 4, maxWidth: "100%" })}>
      <Icon name="clip" size={15} color={T.text2} />
      <Txt size={13.5} numberOfLines={1} style={{ flexShrink: 1 }}>{name}</Txt>
    </Pressable>
  );
}

export { Inline };
