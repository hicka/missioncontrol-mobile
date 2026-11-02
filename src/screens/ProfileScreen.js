// One role on the roster: what runs as it now, what is scheduled for it, what
// it finished this week, and what it has learned. Writing to it is a direct
// line, which reaches it without the Router; it is how you step in by name.
import React, { useEffect, useRef, useState } from "react";
import { Pressable, RefreshControl, View } from "react-native";
import { ProfileDot } from "../components/Mark";
import Icon from "../components/Icon";
import { codeSpans } from "../components/Rich";
import { TaskSheet, toolDetail } from "../components/Work";
import { api } from "../api";
import { useStore } from "../store";
import { FONTS, T, ago, pct, plural } from "../theme";
import { Button, Card, Empty, Header, Screen, Txt, notify } from "../ui";

export default function ProfileScreen({ agentId, nav, onBack }) {
  const state = useStore((s) => s.state);
  const st = useStore((s) => s.status[agentId] || "idle");
  const execs = useStore((s) => s.control.executions);
  const [p, setP] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [armed, setArmed] = useState(false);
  const disarm = useRef(null);
  const timer = useRef(null);
  const agent = (state?.agents || []).find((a) => a.id === agentId) || p?.agent || { id: agentId };

  async function load() {
    try { setP(await api.profile(agentId)); setError(""); }
    catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, [agentId]);
  // follow the agent while it works, without asking on every tool call
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(load, 700);
    return () => clearTimeout(timer.current);
  }, [st, (execs || []).filter((e) => e.agent === agentId).length]);

  // this ends everything running as this role, so it asks twice
  async function stop() {
    if (!armed) {
      setArmed(true);
      clearTimeout(disarm.current);
      disarm.current = setTimeout(() => setArmed(false), 4000);
      return;
    }
    clearTimeout(disarm.current);
    setArmed(false);
    try {
      const r = await api.stop(agentId);
      notify(r.stopped ? `Stopped everything running as ${agent.name || agentId}.` : "Nothing was running.");
      load();
    } catch (e) { notify(e.message, true); }
  }

  const last = (state?.threads || []).find((t) => t.id === `dm:${agentId}`)?.last?.ts;
  const s = p?.stats || {};
  const activity = st === "thinking" ? "Thinking…" : st === "doing" ? "Working…" : "Idle";

  return (
    <View style={{ flex: 1 }}>
      <Header onBack={onBack} />
      <Screen refreshControl={<RefreshControl refreshing={refreshing} tintColor={T.text3}
        onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        <View style={{ alignItems: "center", gap: 8, paddingTop: 10, paddingBottom: 20, borderBottomWidth: 1, borderColor: T.line }}>
          <View style={{ padding: 8 }}><ProfileDot agent={agent} size={56} /></View>
          <Txt size={20} weight="600">{agent.name || agentId}</Txt>
          <Txt size={14} color={T.text3} style={{ textAlign: "center", marginHorizontal: 20 }}>{p?.agent?.role || "A role tasks can run as"}</Txt>
          {!!p?.agent?.model && (
            <Txt size={12} color={T.text3} style={{ fontFamily: FONTS.mono, backgroundColor: T.surface2, borderRadius: 6,
              paddingHorizontal: 8, paddingVertical: 2, overflow: "hidden" }}>
              {p.agent.model}{p.agent.own_model ? "" : " · default model"}
            </Txt>
          )}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <Button label="Direct line" kind="primary" icon="chat" small onPress={() => nav.openThread(`dm:${agentId}`)} />
            <Button label="Edit" icon="edit" small onPress={() => nav.push({ kind: "config", section: "agents", editId: agentId })} />
            {st !== "idle" && <Button label={armed ? "Stop all of it?" : "Stop"} icon="stop" kind={armed ? "danger-primary" : "danger"} small onPress={stop} />}
          </View>
        </View>

        <View style={{ flexDirection: "row", paddingVertical: 16, borderBottomWidth: 1, borderColor: T.line }}>
          {[[s.clean_rate === null || s.clean_rate === undefined ? "—" : pct(s.clean_rate), "clean runs"],
            [String(s.runs ?? 0), "runs this week"], [String(s.corrections ?? 0), "corrections"]].map(([v, k]) => (
            <View key={k} style={{ flex: 1, alignItems: "center" }}>
              <Txt size={19} weight="600" style={{ fontVariant: ["tabular-nums"] }}>{v}</Txt>
              <Txt size={12} color={T.text3}>{k}</Txt>
            </View>
          ))}
        </View>

        {!p && !error && <Txt color={T.text3} style={{ marginTop: 20 }}>Loading…</Txt>}
        {!!error && !p && <Empty title="Could not load the profile" text={error} />}
        {!!p && (
          <>
            <Part title="Now">
              {p.now.map((e) => <Row key={e.id} icon="bolt" title={`Running ${e.name.replace(/_/g, " ")}`} sub={toolDetail(e)}
                onPress={() => setSheet({ execution: e.id })} />)}
              {!!p.queued && <Row icon="inbox" title={`${plural(p.queued, "message")} waiting in its queue`} />}
              {!p.now.length && !p.queued && <None text={activity} />}
            </Part>
            <Part title="Active" count={p.active.length}>
              {p.active.map((m) => <Row key={m.id} icon="tasks" title={m.objective} sub={`${m.status} · ${ago(m.updated)}`}
                onPress={() => setSheet({ task: m.id })} />)}
              {!p.active.length && <None text="No open tasks" />}
            </Part>
            <Part title="Scheduled" count={p.scheduled.jobs.length + p.scheduled.watches.length}>
              {p.scheduled.jobs.map((j) => <Row key={"j" + j.id} icon="clock" title={j.name} sub={`${j.schedule} · ${j.status}`}
                onPress={() => nav.push({ kind: "schedule" })} />)}
              {p.scheduled.watches.map((w) => <Row key={"w" + w.id} icon="refresh" title={w.name}
                sub={`watch · ${w.checks}/${w.max_checks} checks`} onPress={() => nav.push({ kind: "schedule" })} />)}
              {!p.scheduled.jobs.length && !p.scheduled.watches.length && <None text="Nothing scheduled" />}
            </Part>
            <Part title="Done this week" count={p.done.length}>
              {p.done.map((m) => <Row key={m.id} icon={m.status === "completed" ? "check" : "alert"} title={m.objective}
                sub={`${m.status} · ${ago(m.updated)}`} onPress={() => setSheet({ task: m.id })} />)}
              {!p.done.length && <None text="Nothing finished yet this week" />}
            </Part>
            <Part title="Lessons" count={p.lessons.length}>
              {p.lessons.slice(0, 10).map((l) => <Row key={l.id} icon={l.status === "active" ? "check" : "flask"} title={codeSpans(l.text, 14)}
                sub={`${l.agent === "*" ? "everywhere" : "its own"} · ${l.status === "active" ? "adopted" : "on trial"}`}
                onPress={() => nav.push({ kind: "evolution" })} />)}
              {!p.lessons.length && <None text="No lessons yet" />}
            </Part>
          </>
        )}
      </Screen>
      {!!sheet && <TaskSheet taskId={sheet.task} executionId={sheet.execution} nav={nav} onClose={() => setSheet(null)} />}
    </View>
  );
}

function Part({ title, count, children }) {
  return (
    <View style={{ paddingTop: 20 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
        <Txt size={13} weight="600" color={T.text3}>{title}</Txt>
        {!!count && <Txt size={13} color={T.text3}>{count}</Txt>}
      </View>
      <Card>{children}</Card>
    </View>
  );
}

function Row({ icon, title, sub, onPress }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress}
      style={({ pressed }) => ({ flexDirection: "row", gap: 10, paddingHorizontal: 14, paddingVertical: 11,
        borderTopWidth: 1, borderColor: T.line, marginTop: -1, backgroundColor: pressed ? T.hover : "transparent" })}>
      <View style={{ marginTop: 2 }}><Icon name={icon} size={16} color={T.text3} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt size={14} color={T.text2} numberOfLines={3}>{title}</Txt>
        {!!sub && <Txt size={12.5} color={T.text4} style={{ marginTop: 1 }} numberOfLines={1}>{sub}</Txt>}
      </View>
    </Pressable>
  );
}

function None({ text }) {
  return <Txt size={13.5} color={T.text4} style={{ paddingHorizontal: 14, paddingVertical: 11 }}>{text}</Txt>;
}
