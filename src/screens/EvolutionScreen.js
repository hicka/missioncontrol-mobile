// Getting better: your corrections and its repeated mistakes become
// lessons. Each is tried first and kept only if the mistake stops happening;
// one that does not help is retired on its own. Lessons can make an agent
// more careful, never give it more permission.
import React, { useEffect, useState } from "react";
import { Pressable, RefreshControl, View } from "react-native";
import { ProfileDot } from "../components/Mark";
import Icon from "../components/Icon";
import { BarChart, DayTable, Sparkline } from "../components/Charts";
import { codeSpans } from "../components/Rich";
import { agentName } from "../components/Work";
import { api } from "../api";
import * as store from "../store";
import { useStore } from "../store";
import { FONTS, T, ago, pct, plural } from "../theme";
import { Button, Card, Choice, Empty, IconButton, Input, Item, ItemIcon, List, Pill, Pre, Screen, Section,
         Header, Segmented, Title, Toggle, Txt, haptic, notify } from "../ui";

const FILTERS = { live: ["trial", "active"], trial: ["trial"], active: ["active"], held: ["proposed", "suspended"],
                  retired: ["retired"] };
const NAMES = { live: "In use", trial: "On trial", active: "Adopted", held: "Waiting on you", retired: "Retired" };
const SOURCE = { failure: "From repeated failures", correction: "From your correction", "owner-rule": "Your standing rule",
                 owner: "Written by you" };
const CLUSTER = {
  lesson: ["good", "check", "adopted", "Lesson in place"],
  held: ["warn", "flask", "pending", "Lesson waiting on you"],
  owner: ["", "x", "retired", "You retired its lesson"],
  "gave-up": ["danger", "alert", "failed", "Two lessons failed: needs a fix"],
  open: ["warn", "alert", "pending", "No lesson yet"],
};

export default function EvolutionScreen({ saved, onBack }) {
  const state = useStore((s) => s.state);
  const version = useStore((s) => s.evolution);
  const [e, setE] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("live");
  const [table, setTable] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const agents = store.agentsById(state);

  async function load() {
    try { setE(await api.evolution()); setError(""); }
    catch (err) { setError(err.message); }
  }
  useEffect(() => { if (saved.url) load(); }, [version, saved.url]);

  if (!saved.url || (!e && !error)) {
    return (
      <View style={{ flex: 1 }}>
        <Header onBack={onBack} />
        <Screen>
          <Title>Getting better</Title>
          <Card><Empty compact text={saved.url ? "Loading…" : "Connect this phone to see how the agent is learning."} /></Card>
        </Screen>
      </View>
    );
  }
  if (!e) {
    return (
      <View style={{ flex: 1 }}>
        <Header onBack={onBack} />
        <Screen>
          <Title>Getting better</Title>
          <Card><Empty title="Could not load" text={error}><Button label="Try again" onPress={load} /></Empty></Card>
        </Screen>
      </View>
    );
  }

  const card = e.scorecard || {}, w = card.week || {}, p = card.previous_week || {};
  const days = card.days || [];
  const last14 = days.slice(-14);
  const counts = e.counts || {};
  const diffPts = (a, b) => (a === null || a === undefined || b === null || b === undefined) ? null : Math.round((a - b) * 100);
  const diffN = (a, b) => (b === null || b === undefined || (p.runs === 0 && p.tool_calls === 0)) ? null : a - b;
  const measured = days.some((d) => d.clean_rate !== null && d.clean_rate !== undefined);

  async function setEnabled(on) {
    try {
      await api.evolutionSettings({ enabled: on });
      notify(on ? "Learning is on." : "Learning is paused. Lessons already learned stay in use.");
      load();
    } catch (err) { notify(err.message, true); }
  }
  async function review() {
    setReviewing(true);
    try { await api.review(); notify("Review started. This page updates when it finishes."); }
    catch (err) { notify(err.message, true); }
    setTimeout(() => setReviewing(false), 4000);
  }

  const lessons = e.lessons || [];
  const shown = lessons.filter((l) => FILTERS[filter].includes(l.status));
  const r = e.last_review, rep = r?.report || {};

  return (
    <View style={{ flex: 1 }}>
    <Header onBack={onBack} />
    <Screen refreshControl={<RefreshControl refreshing={refreshing} tintColor={T.text3}
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <Title sub="Your corrections and its repeated mistakes become lessons. Each is tried first and kept only if the mistake stops happening. Lessons can make an agent more careful, never give it more permission.">
        Getting better
      </Title>
      <Card pad={14} style={{ gap: 4 }}>
        <Toggle label="Learning" sub={e.enabled ? "Reviews every night and learns from corrections" : "Paused. Lessons already learned stay in use."}
          value={e.enabled} onChange={setEnabled} style={{ marginTop: 0 }} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 }}>
          <Button label="Run review now" icon="refresh" small busy={reviewing} onPress={review} />
          <Txt size={12.5} color={T.text3} style={{ flex: 1 }}>
            {e.calls_today}/{e.daily_calls} learning calls today · next after {(e.settings || {}).review_at || "03:30"}
          </Txt>
        </View>
      </Card>

      <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
        <Kpi label="Clean runs" value={w.clean_rate === null || w.clean_rate === undefined ? null : `${Math.round(w.clean_rate * 100)}`}
          unit="%" delta={w.runs ? diffPts(w.clean_rate, p.clean_rate) : false} deltaUnit=" pts" goodWhenUp
          spark={last14.map((d) => d.clean_rate)} />
        <Kpi label="Your corrections" value={`${w.corrections ?? 0}`} delta={diffN(w.corrections ?? 0, p.corrections)}
          spark={last14.map((d) => d.corrections)} />
      </View>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
        <Kpi label="Tool error rate" value={w.error_rate === null || w.error_rate === undefined ? "—" : (w.error_rate * 100).toFixed(1)}
          unit={w.error_rate === null || w.error_rate === undefined ? "" : "%"} delta={diffPts(w.error_rate, p.error_rate)}
          deltaUnit=" pts" spark={last14.map((d) => d.error_rate)} />
        <Kpi label="Lessons in use" value={`${counts.active || 0}`} delta={false}
          foot={`${plural(counts.trial || 0, "lesson")} on trial · ${counts.retired || 0} retired`} />
      </View>

      <Card pad={16} style={{ marginTop: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline" }}>
          <Txt size={15} weight="600" style={{ flex: 1 }}>Daily, last 30 days</Txt>
          <Pressable onPress={() => setTable(!table)} hitSlop={8}>
            <Txt size={13} color={T.text3}>{table ? "Show charts" : "View as table"}</Txt>
          </Pressable>
        </View>
        <Txt size={12.5} color={T.text3} style={{ marginTop: 3 }}>
          Clean runs finished, were not corrected and did not flail. Tap a day for its numbers.
        </Txt>
        {table ? <DayTable days={days} /> : (
          <>
            {measured ? (
              <BarChart days={days} field="clean_rate" title="Clean runs" color={T.series1} rate
                detail={(d) => (d.runs ? `${d.clean} of ${d.runs} runs` : "")} />
            ) : (
              <Txt size={13} color={T.text3} style={{ marginTop: 14 }}>
                Clean runs are counted from today, as each run finishes. The two charts below already have history.
              </Txt>
            )}
            <BarChart days={days} field="error_rate" title="Tool calls that failed" color={T.series2} rate
              detail={(d) => (d.tool_calls ? `${d.tool_errors} of ${d.tool_calls} calls` : "")} />
            <BarChart days={days} field="corrections" title="Your corrections" color={T.series2} />
          </>
        )}
      </Card>

      <Section title="Lessons">
        <Segmented value={filter} onChange={setFilter} style={{ marginBottom: 10 }}
          options={Object.keys(FILTERS).map((k) => ({ value: k, label: NAMES[k],
            count: lessons.filter((l) => FILTERS[k].includes(l.status)).length }))} />
        <Card>
          {shown.length ? shown.map((l, i) => (
            <View key={l.id}>{i > 0 && <View style={{ height: 1, backgroundColor: T.line }} />}
              <Lesson l={l} agents={agents} onChanged={load} /></View>
          )) : (
            <Empty compact text={filter === "live" ? "No lessons yet. They come from your corrections and from failures that keep repeating." : "Nothing here."} />
          )}
          <AddLesson agents={state?.agents || []} onAdded={load} />
        </Card>
      </Section>

      <Section title="Mistakes that keep repeating" count="last 14 days">
        <List>
          {(e.clusters || []).length ? e.clusters.map((c, i) => {
            const st = CLUSTER[c.state] || CLUSTER.open;
            return (
              <Item key={i} left={<ItemIcon name={st[1]} tone={st[0]} />}
                title={<Txt mono size={12.5} color={T.text2}>{c.signature}</Txt>}
                sub={`${c.count} times · ${Object.keys(c.agents || {}).map((a) => agentName(a, agents)).join(", ")} · last ${ago(c.last)}`}>
                <View style={{ marginTop: 8 }}><Pill status={st[2]} label={st[3]} /></View>
              </Item>
            );
          }) : <Empty compact text="No failure has repeated three times in two weeks." />}
        </List>
      </Section>

      <Section title="Last review" count={r ? new Date(r.ts * 1000).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" }) : "not run yet"}>
        <Card pad={16} style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
          {r ? (
            <>
              <Txt size={13.5} color={T.text2}><Txt size={13.5} weight="600">{(rep.adopted || []).length}</Txt> adopted</Txt>
              <Txt size={13.5} color={T.text2}><Txt size={13.5} weight="600">{(rep.retired || []).length}</Txt> retired</Txt>
              <Txt size={13.5} color={T.text2}><Txt size={13.5} weight="600">{(rep.learned || []).length}</Txt> learned from failures</Txt>
              <Txt size={13.5} color={rep.regression ? T.warn : T.text2}>
                {rep.regression ? `Regression guard fired: ${pct(rep.regression.baseline)} → ${pct(rep.regression.rate)}` : "Regression guard held"}
              </Txt>
            </>
          ) : <Txt size={13.5} color={T.text2}>The first review runs a few minutes after the app starts, then every night.</Txt>}
        </Card>
        <Changelog rep={rep} />
      </Section>
    </Screen>
    </View>
  );
}

function Kpi({ label, value, unit, delta, deltaUnit = "", goodWhenUp = false, spark, foot }) {
  const [width, setWidth] = useState(0);
  let d = delta === false ? null : { text: "vs previous 7 days: no data yet", tone: null };
  if (typeof delta === "number" && !Number.isNaN(delta)) {
    const good = delta === 0 ? null : (delta > 0) === goodWhenUp;
    const sign = delta > 0 ? "+" : delta < 0 ? "−" : "±";
    d = { text: `${sign}${Math.abs(delta)}${deltaUnit} vs last week`, tone: good };
  }
  return (
    <Card pad={14} style={{ flex: 1 }}>
      <Txt size={13} color={T.text3}>{label}</Txt>
      {value === null ? <Txt size={16} weight="500" color={T.text3} style={{ marginTop: 10, marginBottom: 4 }}>Measuring…</Txt> : (
        <Txt size={28} weight="600" style={{ marginTop: 4, letterSpacing: -0.5, lineHeight: 33 }}>
          {value}{!!unit && <Txt size={14} weight="500" color={T.text3}> {unit}</Txt>}
        </Txt>
      )}
      {d && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
          {d.tone !== null && <Icon name={d.tone ? "check" : "alert"} size={13} color={d.tone ? T.good : T.danger} />}
          <Txt size={12} color={d.tone === null ? T.text3 : d.tone ? T.good : T.danger} style={{ flex: 1 }}>{d.text}</Txt>
        </View>
      )}
      {!!foot && <Txt size={12} color={T.text3} style={{ marginTop: 4 }}>{foot}</Txt>}
      {!!spark && (
        <View onLayout={(ev) => setWidth(Math.round(ev.nativeEvent.layout.width))} style={{ height: 30, marginTop: 10 }}>
          {width > 0 && <Sparkline values={spark} width={width} height={30} />}
        </View>
      )}
    </Card>
  );
}

function Lesson({ l, agents, onChanged }) {
  const [why, setWhy] = useState(false);
  const [busy, setBusy] = useState("");
  async function update(fields, key) {
    setBusy(key);
    try { await api.updateLesson(l.id, fields); haptic.done(); onChanged(); store.refreshControl(); }
    catch (err) { notify(err.message, true); }
    setBusy("");
  }
  const ownerRule = ["owner", "owner-rule"].includes(l.source);
  const status = { trial: ["trial", "On trial"], active: ["adopted", "Adopted"], retired: ["retired", "Retired"],
                   suspended: ["suspended", "Suspended"], proposed: ["pending", "Waiting for your OK"] }[l.status] || [l.status];
  const ev = l.evidence || {};
  const evidence = (ev.corrections || []).length ? ev.corrections.join("\n\n")
    : (ev.samples || []).length ? ev.samples.map((s) => `${s.agent}: ${s.call}\n  → ${s.error}${s.then_worked ? `\n  then worked: ${s.then_worked}` : ""}`).join("\n\n")
    : "";
  const dim = l.status === "retired" || l.status === "suspended";
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Txt size={15} color={dim ? T.text3 : T.text} style={{ flex: 1 }}>
          <Txt size={11.5} color={T.text4} style={{ fontFamily: FONTS.mono }}>L{l.id}  </Txt>{codeSpans(l.text, 15)}
        </Txt>
        <IconButton name="pin" size={17} active={!!l.pinned} label={l.pinned ? "Unpin" : "Pin: always shown first"}
          onPress={() => update({ pinned: !l.pinned }, "pin")} style={{ width: 32, height: 32, marginTop: -4 }} />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          {l.agent === "*" ? <Icon name="users" size={15} color={T.text2} /> : <ProfileDot agent={agents[l.agent] || { id: l.agent }} size={16} />}
          <Txt size={12.5} color={T.text2}>{l.agent === "*" ? "Everywhere" : agentName(l.agent, agents)}</Txt>
        </View>
        <Pill status={status[0]} label={status[1]} />
        <Txt size={12.5} color={T.text3}>{SOURCE[l.source] || l.source}</Txt>
        <Txt size={12.5} color={T.text3}>{ago(l.ts)}</Txt>
        {!!l.recurrences && <Txt size={12.5} color={T.warn}>recurred {l.recurrences}×</Txt>}
      </View>
      {!!l.note && <Txt size={12.5} color={T.text3} style={{ marginTop: 6 }}>{l.note}</Txt>}
      {!!evidence && (
        <View style={{ marginTop: 6 }}>
          <Pressable onPress={() => setWhy(!why)} hitSlop={6} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <View style={{ transform: [{ rotate: why ? "90deg" : "0deg" }] }}><Icon name="chev" size={13} color={T.text3} /></View>
            <Txt size={12.5} color={T.text3}>Why this lesson exists</Txt>
          </Pressable>
          {why && <Pre>{evidence}</Pre>}
        </View>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
        {l.status === "trial" && <Button label="Adopt" small busy={busy === "a"} onPress={() => update({ status: "active" }, "a")} />}
        {l.status === "proposed" && <Button label="Use it" kind="primary" small busy={busy === "u"} onPress={() => update({ status: "active" }, "u")} />}
        {["retired", "suspended"].includes(l.status) && (
          <Button label="Restore" small busy={busy === "r"} onPress={() => update({ status: ownerRule ? "active" : "trial" }, "r")} />
        )}
        {l.status !== "retired" && <Button label="Retire" kind="danger" small busy={busy === "x"} onPress={() => update({ status: "retired" }, "x")} />}
      </View>
    </View>
  );
}

function AddLesson({ agents, onAdded }) {
  const [text, setText] = useState("");
  const [scope, setScope] = useState("*");
  const [busy, setBusy] = useState(false);
  async function add() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await api.addLesson(scope, text.trim());
      setText("");
      notify("Lesson added. Agents read it from their next turn.");
      onAdded();
    } catch (err) { notify(err.message, true); }
    setBusy(false);
  }
  return (
    <View style={{ borderTopWidth: 1, borderColor: T.line, padding: 14 }}>
      <Input value={text} onChangeText={setText} maxLength={280} multiline autoCapitalize="sentences"
        placeholder="Teach it something yourself, e.g. 'the shop's code lives in ~/code/shop'"
        inputStyle={{ minHeight: 64, textAlignVertical: "top" }} />
      <Choice options={[{ value: "*", label: "Everywhere" }, ...agents.map((a) => ({ value: a.id, label: a.name }))]}
        value={scope} onChange={setScope} style={{ marginTop: 10 }} />
      <Button label="Add lesson" kind="primary" small busy={busy} disabled={!text.trim()} onPress={add}
        style={{ marginTop: 12, alignSelf: "flex-start" }} />
    </View>
  );
}

// what the night changed, in words: the daily record of it getting better
function Changelog({ rep }) {
  const rows = [
    ...(rep.adopted || []).map((x) => ["check", "good", "Adopted", x.text]),
    ...(rep.learned || []).map((x) => ["spark", "info", "Learned", x.text]),
    ...(rep.retired || []).map((x) => ["x", "", "Retired, it did not help", x.text]),
    ...((rep.regression || {}).suspended || []).map((x) => ["alert", "warn", "Suspended", x.text]),
    ...(rep.attention || []).map((x) => ["alert", "warn", "Needs you", `${x.text} (${x.why})`]),
  ];
  if (!rows.length) return null;
  return (
    <List style={{ marginTop: 10 }}>
      {rows.map(([ic, tone, label, text], i) => (
        <Item key={i} left={<ItemIcon name={ic} tone={tone} />} title={<Txt size={12.5} color={T.text3}>{label}</Txt>}
          sub={<Txt size={14.5} style={{ marginTop: 2 }}>{codeSpans(text, 14.5)}</Txt>} />
      ))}
    </List>
  );
}
