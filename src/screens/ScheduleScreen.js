// Recurring jobs run only after you approve them. Watches follow something
// already in flight and stop themselves when it resolves.
import React, { useState } from "react";
import { RefreshControl, View } from "react-native";
import { ProfileDot } from "../components/Mark";
import { agentName } from "../components/Work";
import { api } from "../api";
import * as store from "../store";
import { useStore } from "../store";
import { T } from "../theme";
import { Button, Card, Empty, Header, List, Pill, Pre, Progress, Screen, Section, Title, Txt, haptic, notify } from "../ui";

function nextRun(ts) {
  if (!ts) return "not scheduled";
  return new Date(ts * 1000).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" });
}

export default function ScheduleScreen({ nav, onBack }) {
  const state = useStore((s) => s.state);
  const jobs = useStore((s) => s.control.jobs || []);
  const allWatches = useStore((s) => s.control.watches || []);
  const [busy, setBusy] = useState("");
  const [armed, setArmed] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const agents = store.agentsById(state);

  async function act(key, fn) {
    setBusy(key);
    try { await fn(); haptic.done(); await store.refreshControl(); }
    catch (e) { notify(e.message, true); }
    setBusy(""); setArmed("");
  }
  // deleting a job or stopping a watch cannot be undone, so it asks twice
  const twice = (key, fn) => (armed === key ? act(key, fn) : setArmed(key));

  const watches = [...allWatches].sort((a, b) => (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1) || b.ts - a.ts)
    .slice(0, 24);

  return (
    <View style={{ flex: 1 }}>
      <Header onBack={onBack} />
      <Screen refreshControl={<RefreshControl refreshing={refreshing} tintColor={T.text3}
        onRefresh={async () => { setRefreshing(true); await store.refreshControl(); setRefreshing(false); }} />}>
        <Title sub="Recurring jobs run only after you approve them. Watches follow something already in flight and stop themselves when it resolves.">
          Schedule
        </Title>
        <Button label="Heartbeat and daily brief" icon="settings" small onPress={() => nav.openConfig("heartbeat")}
          style={{ alignSelf: "flex-start" }} />

        <Section title="Scheduled jobs" count={jobs.length || ""}>
          {jobs.length ? (
            <List>
              {jobs.map((j) => (
                <View key={j.id} style={{ flexDirection: "row", gap: 12, padding: 16 }}>
                  <ProfileDot agent={agents[j.agent] || { id: j.agent }} size={26} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                      <Txt size={15} weight="500" style={{ flex: 1 }}>{j.name}</Txt>
                      <Pill status={j.status} />
                    </View>
                    <Txt size={13} color={T.text3} style={{ marginTop: 2 }}>
                      {agentName(j.agent, agents)} · {j.schedule} · next {nextRun(j.next_run)}
                      {j.max_runs ? ` · ${j.runs || 0}/${j.max_runs} runs` : ""}
                    </Txt>
                    <Txt size={13.5} color={T.text2} selectable numberOfLines={j.status === "pending" ? undefined : 3}
                      style={{ marginTop: 6 }}>{j.task}</Txt>
                    {!!j.monitor_cmd && (
                      <>
                        <Txt size={13} color={T.text3} style={{ marginTop: 8 }}>Check before each run:</Txt>
                        <Pre>{j.monitor_cmd}</Pre>
                      </>
                    )}
                    {!!j.note && <Txt size={13} color={T.text3} style={{ marginTop: 6 }}>Notes: {j.note}</Txt>}
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                      {j.status === "pending" && <Button label="Approve" kind="primary" small busy={busy === `a${j.id}`}
                        onPress={() => act(`a${j.id}`, () => api.cronAction(j.id, "approve"))} />}
                      {j.status === "active" && <Button label="Pause" small busy={busy === `p${j.id}`}
                        onPress={() => act(`p${j.id}`, () => api.cronAction(j.id, "pause"))} />}
                      {j.status === "paused" && <Button label="Resume" small busy={busy === `r${j.id}`}
                        onPress={() => act(`r${j.id}`, () => api.cronAction(j.id, "resume"))} />}
                      <Button label={armed === `d${j.id}` ? "Delete it?" : "Delete"} kind={armed === `d${j.id}` ? "confirm" : "ghost"}
                        small busy={busy === `d${j.id}`} onPress={() => twice(`d${j.id}`, () => api.cronAction(j.id, "delete"))} />
                    </View>
                  </View>
                </View>
              ))}
            </List>
          ) : (
            <Card><Empty compact text="No scheduled jobs. Ask an agent to check something every morning, and approve it here." /></Card>
          )}
        </Section>

        <Section title="Watches" count={watches.filter((w) => w.status === "active").length || ""}>
          {watches.length ? (
            <List>
              {watches.map((w) => (
                <View key={w.id} style={{ flexDirection: "row", gap: 12, padding: 16 }}>
                  <ProfileDot agent={agents[w.agent] || { id: w.agent }} size={26} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                      <Txt size={15} weight="500" style={{ flex: 1 }}>{w.name}</Txt>
                      <Pill status={w.status} />
                    </View>
                    <Txt size={13} color={T.text3} style={{ marginTop: 2 }}>
                      {agentName(w.agent, agents)} · {w.checks}/{w.max_checks} checks · every {w.interval}s
                      {w.goal ? ` · waiting for: ${w.goal}` : ""}
                    </Txt>
                    <Progress value={w.checks / Math.max(1, w.max_checks)} />
                    {!!w.last_out && <Pre lines={8}>{String(w.last_out).slice(0, 1200)}</Pre>}
                    {w.status === "active" && (
                      <View style={{ marginTop: 10, flexDirection: "row" }}>
                        <Button label={armed === `w${w.id}` ? "Stop watching?" : "Stop watching"}
                          kind={armed === `w${w.id}` ? "confirm" : "ghost"} small busy={busy === `w${w.id}`}
                          onPress={() => twice(`w${w.id}`, () => api.cancelWatch(w.id))} />
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </List>
          ) : (
            <Card><Empty compact text="No watches. A task arms one to follow a CI run, a deploy or a status page." /></Card>
          )}
        </Section>
      </Screen>
    </View>
  );
}
