// One task, as the harness sees it: where it stands, on whose say-so, what it
// last reported, and every step it took, newest first. This is the place to step
// in: what you write here goes straight to this task, without the Router.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "../components/Icon";
import { AgentMark } from "../components/Presence";
import Rich from "../components/Rich";
import { StatePill, finishLine, runningTool, toneColor } from "../components/Tasks";
import { RESUMABLE, agentName, toolDetail } from "../components/Work";
import { api } from "../api";
import { authority, stepsOf, taskTitle, unconfirmedText, withoutMarker, workerState } from "../harness";
import * as live from "../live";
import * as store from "../store";
import { useStore } from "../store";
import { T, ago, fmtTime, span } from "../theme";
import { Button, Card, Empty, Header, IconButton, Item, List, Pill, Pre, Section, Txt, haptic, notify, useWindowTop } from "../ui";

const REPORT_TONE = { ready: "good", progress: "", waiting: "info", blocked: "signal", failed: "danger", dropped: "", handback: "info" };
const STEPS_SHOWN = 30;

export default function TaskScreen({ workerId, nav, onBack }) {
  const insets = useSafeAreaInsets();
  const page = useWindowTop();
  const state = useStore((s) => s.state);
  const control = useStore((s) => s.control);
  const agents = useMemo(() => store.agentsById(state), [state]);
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [armed, setArmed] = useState("");
  const [busy, setBusy] = useState("");
  const [allSteps, setAllSteps] = useState(false);
  const disarm = useRef(null);
  const timer = useRef(null);
  const mission = useRef(null);
  const working = useRef(false);

  async function load() {
    try {
      const got = await api.session(workerId);
      mission.current = got.session?.mission;
      working.current = got.session?.status === "working";
      setD(got);
      setError("");
    } catch (e) { setError(e.message); }
  }

  useEffect(() => {
    load();
    const soon = () => { clearTimeout(timer.current); timer.current = setTimeout(load, 900); };
    const unsub = live.subscribe((ev) => {
      if (ev.type === "session_updated" && ev.session === workerId) soon();
      else if (ev.type === "execution" && ((ev.execution?.mission && ev.execution.mission === mission.current) ||
               ev.execution?.detail?.session === workerId)) soon();
      else if (ev.type === "link" && ev.on) soon();
    });
    // the socket carries changes; this keeps ages honest, and covers it being down
    const poll = setInterval(() => { if (!live.connected() || working.current) load(); }, 8000);
    return () => { unsub(); clearInterval(poll); clearTimeout(timer.current); clearTimeout(disarm.current); };
  }, [workerId]);

  const w = d?.session;
  const steps = useMemo(() => [...stepsOf(d?.transcript)].reverse(), [d?.transcript]);

  if (!w) {
    return (
      <View style={{ flex: 1 }}>
        <Header title="Task" onBack={onBack} />
        <Empty title={error ? "Could not load this task" : "Loading…"} text={error}>
          {!!error && <Button label="Try again" onPress={load} />}
        </Empty>
      </View>
    );
  }

  const m = (control.missions || []).find((x) => x.id === w.mission);
  const st = workerState(w, m, (d.reports || [])[0]);
  const open = w.status !== "ended";
  const stopped = ["idle", "ended"].includes(w.status);
  const asking = w.status === "blocked" && !!w.question;
  const now = Date.now() / 1000;
  const tool = runningTool(w, control.executions);
  const auth = authority(w);
  const lastStep = w.progress || w.updated;

  function twice(key) {
    if (armed === key) { setArmed(""); return true; }
    setArmed(key);
    haptic.warn();
    clearTimeout(disarm.current);
    disarm.current = setTimeout(() => setArmed(""), 4000);
    return false;
  }

  async function act(action) {
    if (!twice(action)) return;
    setBusy(action);
    try {
      await api.worker(w.id, action);
      haptic.done();
      notify(action === "stop" ? "Stopped."
        : store.get().kernel?.paused ? "It restarts when you carry on from Activity."
        : "Restarted. It checks the real state before repeating anything.");
      await load();
      store.refreshKernel();
      store.refreshControl();
    } catch (e) { notify(e.message, true); }
    setBusy("");
  }

  async function resume() {
    setBusy("resume");
    try {
      await api.command(`/resume ${m.id}`);
      haptic.done();
      notify("Resumed.");
      await load();
      store.refreshKernel();
      store.refreshControl();
    } catch (e) { notify(e.message, true); }
    setBusy("");
  }

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    haptic.tap();
    try {
      await api.stepIn(w.id, body);
      setText("");
      notify("Sent. It reads this at its next step.");
      await load();
      store.refreshKernel();
      store.refreshControl();
    } catch (e) { notify(e.message, true); }
    setSending(false);
  }

  const summary = withoutMarker(w.summary);
  const line = finishLine(w);
  const checks = line.checks;
  const shown = allSteps ? steps : steps.slice(0, STEPS_SHOWN);

  return (
    <View ref={page.ref} onLayout={page.onLayout} style={{ flex: 1, backgroundColor: T.bg }}>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}
      keyboardVerticalOffset={page.top}>
      <Header title="Task" sub={agentName(w.profile, agents)} onBack={onBack} right={open ? (
        <View style={{ flexDirection: "row", gap: 4, marginRight: 4 }}>
          <Button label={armed === "restart" ? "Restart?" : "Restart"} small kind="ghost" busy={busy === "restart"} onPress={() => act("restart")} />
          <Button label={armed === "stop" ? "Stop it?" : "Stop"} small kind={armed === "stop" ? "danger-primary" : "danger"}
            busy={busy === "stop"} onPress={() => act("stop")} />
        </View>
      ) : null} />
      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior="never"
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={T.text3}
          onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 28 }}>
        <Txt display size={24}>{taskTitle(w)}</Txt>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 12 }}>
          <StatePill state={st} />
          {!!auth && <Pill status="auth" label={auth.label} tone="" />}
        </View>
        <Txt size={13.5} color={T.text3} style={{ marginTop: 10 }}>
          Started {ago(w.created)} · last step {ago(lastStep)}
          {w.recoveries ? ` · restarted ${w.recoveries} time${w.recoveries === 1 ? "" : "s"}` : ""}
        </Txt>
        {!!auth && <Txt size={13.5} color={T.text3} style={{ marginTop: 2 }}>{auth.note}</Txt>}

        {stopped && st.key === "unconfirmed" && (
          <Card pad={14} style={{ marginTop: 16, borderColor: T.warn }}>
            <Txt size={14} weight="600" color={T.warn}>It stopped without saying it had finished</Txt>
            <Txt size={13.5} color={T.text2} style={{ marginTop: 2 }}>
              Nothing is running for this task now. Read its last report below, then {open ? "restart it" : "hand it over again"} if the work is not done.
            </Txt>
          </Card>
        )}

        {stopped && !!m && RESUMABLE.includes(m.status) && (
          <Button label="Resume this task" small busy={busy === "resume"} onPress={resume} style={{ alignSelf: "flex-start", marginTop: 14 }} />
        )}

        {!!tool && (
          <Card pad={14} style={{ marginTop: 16 }}>
            <Txt size={13} color={T.text3}>Running now, for {span(now - (tool.ts || now))}</Txt>
            <Txt mono size={12.5} color={T.text} style={{ marginTop: 4 }} numberOfLines={4}>
              {tool.name === "terminal" ? "$ " : `${tool.name.replace(/_/g, " ")}  `}{toolDetail(tool)}
            </Txt>
          </Card>
        )}

        {asking && (
          <Card pad={14} style={{ marginTop: 16, borderColor: T.signal }}>
            <Txt size={13} weight="600" color={T.signal}>It is waiting for your answer</Txt>
            <Txt size={15} selectable style={{ marginTop: 4 }}>{w.question}</Txt>
          </Card>
        )}

        {checks.length > 0 && (
          <Section title="Finish line" count={`${line.done} of ${checks.length}`}>
            <List>
              {checks.map((c, i) => {
                const met = line.met(c);
                return (
                  <Item key={i} title={c.check} lines={0}
                    left={<Icon name={met ? "check" : "circle"} size={18} color={met ? (c.unverified ? T.warn : T.good) : T.text4} weight={met ? 2.2 : 1.7} />}
                    sub={met ? (c.unverified ? `${c.how}. Its tools did not show this.` : c.how) : c.done ? "Said done, without how it was confirmed." : undefined} />
                );
              })}
            </List>
            <Txt size={12.5} color={T.text3} style={{ marginTop: 8 }}>
              What you asked for, as checks. It can only report ready once every one is done and shown.
            </Txt>
          </Section>
        )}

        {!!summary && (
          <Section title="Where it stands">
            <Rich text={summary} size={14.5} color={T.text2} />
          </Section>
        )}

        {(d.reports || []).length > 0 && (
          <Section title="Reports" count={d.reports.length}>
            <List>
              {d.reports.slice(0, 8).map((r) => <ReportRow key={r.id} r={r} />)}
            </List>
          </Section>
        )}

        {(d.jobs || []).length > 0 && (
          <Section title="Background jobs" count={d.jobs.length}>
            <List>
              {d.jobs.slice(0, 8).map((j) => (
                <Item key={j.id} left={<Icon name="term" size={16} color={T.text3} />} title={j.label || j.tool} titleMono lines={2}
                  sub={`${j.tool} · ${ago(j.started)}`} right={<Pill status={j.status} />} />
              ))}
            </List>
          </Section>
        )}

        {(d.subscriptions || []).length > 0 && (
          <Section title="Following">
            <Txt size={13.5} color={T.text3} selectable>{d.subscriptions.map((t) => t.thread).join("\n")}</Txt>
          </Section>
        )}

        <Section title="Steps" count={steps.length || ""}>
          {steps.length ? (
            <View>
              {shown.map((s, i) => <Step key={s.key || i} s={s} last={i === shown.length - 1} />)}
              {steps.length > STEPS_SHOWN && !allSteps && (
                <Button label={`Show ${steps.length - STEPS_SHOWN} earlier`} small kind="ghost"
                  onPress={() => setAllSteps(true)} style={{ alignSelf: "flex-start", marginTop: 6 }} />
              )}
            </View>
          ) : <Card><Empty compact text="Nothing yet." /></Card>}
        </Section>

        {!!w.brief && (
          <Section title="The Router's note">
            <Pre style={{ marginTop: 0 }}>{w.brief}</Pre>
          </Section>
        )}

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 24 }}>
          <AgentMark agent={agents[w.profile]} id={w.profile} size={26} />
          <Pressable onPress={() => nav.openProfile(w.profile)} style={{ flexShrink: 1 }}>
            <Txt size={13} color={T.text3} numberOfLines={1}>Runs as {agentName(w.profile, agents)}</Txt>
          </Pressable>
          <View style={{ flex: 1 }} />
          <Txt mono size={11.5} color={T.text4}>{w.id}</Txt>
        </View>
      </ScrollView>

      {open && (
        <View style={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 10),
                       borderTopWidth: 1, borderColor: T.line, backgroundColor: T.bg }}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2, backgroundColor: T.surface, borderWidth: 1,
                         borderColor: asking ? T.signal : T.lineStrong, borderRadius: 22, paddingLeft: 12, paddingRight: 5, paddingVertical: 5 }}>
            <TextInput value={text} onChangeText={setText} multiline
              placeholder={asking ? "Your answer" : "Step in: tell this task something"}
              placeholderTextColor={T.text4} keyboardAppearance={T.scheme} selectionColor={T.focus}
              style={{ flex: 1, fontSize: 16, lineHeight: 21, color: T.text, maxHeight: 130, minHeight: 34, paddingTop: 7, paddingBottom: 6 }} />
            <Pressable onPress={send} disabled={!text.trim() || sending} accessibilityLabel="Send"
              style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: T.accent, alignItems: "center",
                       justifyContent: "center", opacity: text.trim() && !sending ? 1 : 0.25 }}>
              <Icon name="up" size={18} color={T.accentInk} weight={2.2} />
            </Pressable>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
    </View>
  );
}

function ReportRow({ r }) {
  const [open, setOpen] = useState(false);
  // filed for it by the server when it would not say: it did not report this itself
  const unconfirmed = unconfirmedText(r.summary);
  const text = withoutMarker(r.summary);
  return (
    <Pressable onPress={() => setOpen(!open)} style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Pill status={r.status} label={unconfirmed ? "Not confirmed" : r.status[0].toUpperCase() + r.status.slice(1)}
          tone={unconfirmed ? "warn" : REPORT_TONE[r.status] ?? ""} />
        <View style={{ flex: 1 }} />
        <Txt size={12.5} color={T.text3}>{ago(r.ts)}</Txt>
      </View>
      {open ? <View style={{ marginTop: 8 }}><Rich text={text} size={14} color={T.text2} /></View>
        : <Txt size={14} color={T.text2} numberOfLines={3} style={{ marginTop: 8 }}>{text}</Txt>}
      {!!r.question && <Txt size={14} color={T.signal} style={{ marginTop: 6 }}>Asks: {r.question}</Txt>}
    </Pressable>
  );
}

// One step on the line: a tool call opens to its result, and a failed one says so.
function Step({ s, last }) {
  const [open, setOpen] = useState(false);
  const color = s.kind === "report" ? toneColor(REPORT_TONE[s.status] ?? "") : s.error ? T.danger : s.kind === "said" ? T.text2 : T.text4;
  const canOpen = s.kind === "call" ? !!s.result : String(s.text || "").length > 200;
  const label = s.kind === "report" ? `Reported ${s.status}` : s.kind === "said" ? "Said" : s.kind === "heard" ? "Received" : s.name.replace(/_/g, " ");
  return (
    <Pressable onPress={() => canOpen && setOpen(!open)} disabled={!canOpen} style={{ flexDirection: "row", gap: 11 }}>
      <View style={{ width: 9, alignItems: "center" }}>
        <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: color, marginTop: 5 }} />
        {!last && <View style={{ flex: 1, width: 1, backgroundColor: T.lineStrong, marginTop: 3 }} />}
      </View>
      <View style={{ flex: 1, minWidth: 0, paddingBottom: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
          <Txt size={13} weight="600" color={s.error ? T.danger : T.text2} style={{ flexShrink: 1 }} numberOfLines={1}>{label}</Txt>
          <Txt size={12} color={T.text4}>{fmtTime(s.ts)}</Txt>
        </View>
        {s.kind === "call" ? (
          <>
            <Txt mono selectable size={12} color={T.text3} numberOfLines={open ? undefined : 3} style={{ marginTop: 2, lineHeight: 18 }}>{s.line}</Txt>
            {open && <Pre style={{ marginTop: 6 }}>{String(s.result).slice(0, 6000)}</Pre>}
          </>
        ) : (
          <Txt size={13.5} color={s.kind === "heard" ? T.text3 : T.text2} selectable numberOfLines={open ? undefined : 4} style={{ marginTop: 2 }}>
            {s.text}{s.question ? `\nAsks: ${s.question}` : ""}
          </Txt>
        )}
      </View>
    </Pressable>
  );
}
