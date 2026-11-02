// The harness itself: everything that reached the agent and what became of it,
// the rules it decides by, and what the Watchdog has done. Most events need no
// decision, and this is where you can see that: what went straight to a task,
// what was left alone, and why.
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, View } from "react-native";
import Icon from "../components/Icon";
import { api } from "../api";
import { EVENT_GROUPS, clip, dispositionOf, presence, sourceIcon, sourceLabel, verdictLabel } from "../harness";
import * as store from "../store";
import { useStore } from "../store";
import { T, ago } from "../theme";
import { Button, Card, Choice, Empty, Input, Item, ItemIcon, List, Pill, Pre, Screen, Section, Segmented, Sheet, Stat, Title, Toggle, Txt, haptic, notify } from "../ui";

const ADMISSION = [{ value: "explicit", label: "Only when asked" }, { value: "candidate", label: "Read and judge" }, { value: "ignore", label: "Ignore" }];
// the owner's own channels are always explicit, and cannot be changed
const LOCKED = new Set(["gui", "imessage", "telegram", "whatsapp", "email"]);
const PAGES = [{ value: "events", label: "Events" }, { value: "rules", label: "Rules" }, { value: "watchdog", label: "Watchdog" }];

export default function ActivityScreen({ nav, saved }) {
  const state = useStore((s) => s.state);
  const kernel = useStore((s) => s.kernel);
  const online = useStore((s) => s.online);
  const kernelError = useStore((s) => s.kernelError);
  const [page, setPage] = useState("events");
  const [filter, setFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [event, setEvent] = useState(null);

  useEffect(() => { if (saved.url) store.refreshKernel(); }, [saved.url]);

  const events = kernel?.events || [];
  const shown = useMemo(() => events.filter(EVENT_GROUPS[filter].test).slice(0, 60), [events, filter]);

  if (!saved.url || !state || !kernel) {
    return (
      <Screen>
        <Title>Activity</Title>
        <Card>
          <Empty compact title={saved.url && kernelError ? "Could not read this" : undefined}
            text={!saved.url ? "Connect this phone to see what reaches the agent." : kernelError || "Loading…"}>
            {!!saved.url && !!kernelError && <Button label="Try again" small onPress={() => store.refreshKernel()} />}
          </Empty>
        </Card>
      </Screen>
    );
  }

  const name = kernel.router?.name || "the agent";
  const p = presence(kernel, online);
  const counts = kernel.events_24h || {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const quiet = (counts.ignored || 0) + (counts.logged || 0);
  const pending = kernel.router?.pending || 0;

  async function togglePause() {
    if (!kernel.paused && !armed) { setArmed(true); haptic.warn(); setTimeout(() => setArmed(false), 4000); return; }
    setArmed(false); setBusy(true);
    try { await api.pause(!kernel.paused); haptic.done(); await store.refreshKernel(); }
    catch (e) { notify(e.message, true); }
    setBusy(false);
  }

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} tintColor={T.text3}
      onRefresh={async () => { setRefreshing(true); await store.refresh(); setRefreshing(false); }} />}>
      <Title sub={`Everything that reached ${name}, and what became of it.`} right={
        <Button small label={kernel.paused ? "Carry on" : armed ? "Pause all work?" : "Pause"} kind={kernel.paused ? "primary" : armed ? "danger-primary" : "default"}
          icon={kernel.paused ? "play" : undefined} busy={busy} onPress={togglePause} />}>
        Activity
      </Title>

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Stat value={p.word} tone={p.tone} label="Router" note={pending ? `${pending} waiting to be read` : "nothing waiting"} />
          <Stat value={`${kernel.slots?.used ?? 0} of ${kernel.slots?.limit ?? 0}`} label="places in use" note="one per working task" onPress={() => nav.push({ kind: "tasks" })} />
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Stat value={total} label="events, 24 hours" note={total ? `${quiet} needed nothing` : " "} />
          <Stat value={counts.passed || 0} label="straight to a task" note="no decision spent" />
        </View>
      </View>

      {(kernel.outbox || []).map((o, i) => (
        <Card key={i} pad={14} style={{ marginTop: 12, borderColor: T.warn }}>
          <Txt size={14} weight="600" color={T.warn}>A message to {sourceLabel(o.channel)} has not gone out</Txt>
          <Txt size={13.5} color={T.text2} style={{ marginTop: 2 }}>{o.attempts} tries{o.error ? ` · ${o.error}` : ""}</Txt>
        </Card>
      ))}

      <Segmented value={page} onChange={setPage} options={PAGES} style={{ marginTop: 18 }} />

      {page === "events" && (
        <View style={{ marginTop: 12 }}>
          <Segmented value={filter} onChange={setFilter}
            options={Object.keys(EVENT_GROUPS).map((k) => ({ value: k, label: EVENT_GROUPS[k].label, count: events.filter(EVENT_GROUPS[k].test).length }))} />
          <View style={{ marginTop: 12 }}>
            {shown.length ? (
              <List>{shown.map((e) => <EventRow key={e.id} e={e} onPress={() => setEvent(e)} />)}</List>
            ) : <Card><Empty compact text="Nothing here yet." /></Card>}
          </View>
        </View>
      )}
      {page === "rules" && <Rules kernel={kernel} />}
      {page === "watchdog" && <Watchdog kernel={kernel} nav={nav} />}

      {!!event && <EventSheet e={event} onClose={() => setEvent(null)} />}
    </Screen>
  );
}

function EventRow({ e, onPress }) {
  const d = dispositionOf(e);
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => ({ flexDirection: "row", gap: 11, paddingHorizontal: 14, paddingVertical: 11,
                                 backgroundColor: pressed ? T.hover : "transparent" })}>
      <View style={{ marginTop: 1 }}><ItemIcon name={sourceIcon(e.source)} size={26} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt size={14} numberOfLines={2} color={e.from_owner ? T.text : T.text2}>{clip(e.text, 130)}</Txt>
        <Txt size={12.5} color={T.text3} numberOfLines={1} style={{ marginTop: 1 }}>
          {e.from_owner ? "You" : sourceLabel(e.source)} · {ago(e.ts)}
        </Txt>
      </View>
      <Pill status={e.disposition} label={d.label} tone={d.tone} />
    </Pressable>
  );
}

function EventSheet({ e, onClose }) {
  const [full, setFull] = useState(null);
  useEffect(() => {
    let on = true;
    api.recall(e.id).then((r) => { if (on) setFull(r.text); }).catch(() => {});
    return () => { on = false; };
  }, [e.id]);
  const d = dispositionOf(e);
  return (
    <Sheet visible onClose={onClose} title={sourceLabel(e.source)}>
      <Pill status={e.disposition} label={d.label} tone={d.tone} />
      <Txt size={13} color={T.text3} style={{ marginTop: 10 }}>
        {e.from_owner ? "You" : e.actor || sourceLabel(e.source)} · {ago(e.ts)} · {e.admission}
      </Txt>
      {!!e.detail && <Txt size={14} color={T.text2} style={{ marginTop: 10 }}>{e.detail}</Txt>}
      <Pre style={{ marginTop: 14 }}>{full || e.text}</Pre>
      <Txt mono size={11.5} color={T.text4} selectable style={{ marginTop: 12 }}>{e.thread}</Txt>
    </Sheet>
  );
}

// The rules for what it acts on unprompted, and how each source is treated. Text
// from outside can never change these.
function Rules({ kernel }) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  async function call(body) {
    let ok = false;
    try {
      const r = await api.policy(body);
      ok = r.ok !== false;
      if (!ok) notify(r.result || "That did not work.", true);
      await store.refreshKernel();
    } catch (e) { notify(e.message, true); }
    return ok;
  }
  async function add() {
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    if (await call({ action: "add", text })) setDraft("");
    setBusy(false);
  }
  const policies = kernel.policies || [];
  const sources = Object.entries(kernel.sources || {}).filter(([s]) => !LOCKED.has(s)).sort();
  return (
    <View>
      <Txt size={13.5} color={T.text3} style={{ marginTop: 14 }}>
        It always answers you. Everything else it reads against these rules, and otherwise stays quiet.
      </Txt>
      <View style={{ marginTop: 12 }}>
        {policies.length ? (
          <List>
            {policies.map((p) => (
              <View key={p.id} style={{ paddingHorizontal: 14, paddingVertical: 4 }}>
                <Toggle label={p.text} sub={p.author === "system" ? "Starting rule" : "Your rule"} value={!!p.enabled}
                  onChange={(on) => call({ action: on ? "enable" : "disable", id: p.id })} style={{ marginTop: 8 }} />
                <Button label="Remove" small kind="ghost" onPress={() => call({ action: "remove", id: p.id })}
                  style={{ alignSelf: "flex-start", marginLeft: -12 }} />
              </View>
            ))}
          </List>
        ) : <Card><Empty compact text="No rules, so it only acts on what you ask." /></Card>}
      </View>
      <Input value={draft} onChangeText={setDraft} multiline autoCapitalize="sentences"
        placeholder="Add a rule in plain words" style={{ marginTop: 12 }} inputStyle={{ minHeight: 64 }} />
      <Button label="Add rule" small disabled={!draft.trim()} busy={busy} onPress={add} style={{ alignSelf: "flex-start", marginTop: 8 }} />

      <Section title="Where events come from">
        <Txt size={13.5} color={T.text3}>
          Anyone who can write to a source you read and judge can suggest work to something that has your files.
        </Txt>
        {sources.map(([s, v]) => (
          <Choice key={s} label={sourceLabel(s)} options={ADMISSION} value={v}
            onChange={(admission) => call({ action: "source", source: s, admission })} />
        ))}
      </Section>
    </View>
  );
}

function Watchdog({ kernel, nav }) {
  const findings = kernel.findings || [];
  return (
    <View style={{ marginTop: 14 }}>
      <Txt size={13.5} color={T.text3} style={{ marginBottom: 12 }}>
        It checks on a schedule that every task is really getting somewhere, and steps in when one is not. Ask it anything with /watchdog in the chat.
      </Txt>
      {findings.length ? (
        <List>
          {findings.slice(0, 20).map((f) => {
            const worker = String(f.session || "").startsWith("w_");
            return (
              <Item key={f.id} onPress={worker ? () => nav.openTask(f.session) : undefined}
                left={<ItemIcon name="shield" size={26} />} title={verdictLabel(f.verdict)}
                sub={`${f.action || "noted"} · ${ago(f.ts)}${f.reason ? ` · ${f.reason}` : ""}`}
                chevron={worker} lines={2} />
            );
          })}
        </List>
      ) : <Card><Empty compact text="Nothing has needed stepping in." /></Card>}
    </View>
  );
}
