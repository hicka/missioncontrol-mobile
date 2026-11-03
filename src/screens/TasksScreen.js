// The agent's hands: every task it has open, how far along the finish line each
// is, and what it finished in about the last day. All of it is the kernel's own
// record. Routine heartbeats and direct lines sit under their own filter, so
// they do not bury the work you asked for.
import React, { useMemo, useState } from "react";
import { RefreshControl, View } from "react-native";
import { ReachBanner, useGate } from "../components/Reach";
import { TaskCard, TaskRow, runningTool } from "../components/Tasks";
import { ACTIVE, groupWorkers, handsLine, isRoutine } from "../harness";
import { nav } from "../nav";
import * as store from "../store";
import { useStore } from "../store";
import { T } from "../theme";
import { Card, Empty, List, Screen, Section, Segmented, Title, Txt } from "../ui";

export default function TasksScreen() {
  const gate = useGate();
  const state = useStore((s) => s.state);
  const kernel = useStore((s) => s.kernel);
  const control = useStore((s) => s.control);
  const [filter, setFilter] = useState("open");
  const [refreshing, setRefreshing] = useState(false);
  const agents = useMemo(() => store.agentsById(state), [state]);
  const missions = useMemo(() => Object.fromEntries((control.missions || []).map((m) => [m.id, m])), [control.missions]);
  const all = kernel?.sessions || control.workers || [];
  const groups = useMemo(() => groupWorkers(all), [all]);

  if (gate) return gate;

  const quiet = (w) => isRoutine(w) || w.direct;
  const earlier = all.filter((w) => !ACTIVE.includes(w.status) && !quiet(w));
  const routine = all.filter(quiet);
  const open = [...groups.running, ...groups.stuck, ...groups.waiting];
  const counts = { open: open.length, earlier: earlier.length, routine: routine.length };
  const card = (w) => (
    <TaskCard key={w.id} w={w} mission={missions[w.mission]} agents={agents}
      tool={runningTool(w, control.executions)} onPress={() => nav.openTask(w.id)} />
  );
  const rows = (list) => (
    <List>
      {list.map((w) => <TaskRow key={w.id} w={w} mission={missions[w.mission]} agents={agents} onPress={() => nav.openTask(w.id)} />)}
    </List>
  );

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} tintColor={T.text3}
      onRefresh={async () => { setRefreshing(true); await store.refresh(); setRefreshing(false); }} />}>
      <Title sub={kernel ? handsLine(groups, kernel.slots) : undefined}>Tasks</Title>
      <ReachBanner style={{ marginBottom: 16 }} />
      <Segmented value={filter} onChange={setFilter}
        options={[{ value: "open", label: "Open", count: counts.open }, { value: "earlier", label: "Earlier", count: counts.earlier },
                  { value: "routine", label: "Routine", count: counts.routine }]} />

      {filter === "open" && (open.length ? (
        <>
          {groups.running.length > 0 && <Section title="Working now" count={groups.running.length} style={{ marginTop: 20 }}>
            <View style={{ gap: 10 }}>{groups.running.map(card)}</View>
          </Section>}
          {groups.stuck.length > 0 && <Section title="Stuck" count={groups.stuck.length} style={{ marginTop: 20 }}>
            <View style={{ gap: 10 }}>{groups.stuck.map(card)}</View>
          </Section>}
          {groups.waiting.length > 0 && <Section title="Waiting" count={groups.waiting.length} style={{ marginTop: 20 }}>
            <View style={{ gap: 10 }}>{groups.waiting.map(card)}</View>
          </Section>}
        </>
      ) : (
        <Card style={{ marginTop: 16 }}>
          <Empty compact title="Nothing open" text="Whatever you hand the agent shows up here while it is worked on, with how far along it is." />
        </Card>
      ))}
      {filter === "earlier" && <View style={{ marginTop: 16 }}>
        {earlier.length ? rows(earlier) : <Card><Empty compact text="Nothing earlier in the last day or so." /></Card>}
      </View>}
      {filter === "routine" && <View style={{ marginTop: 16 }}>
        {routine.length ? rows(routine) : <Card><Empty compact text="No heartbeats or direct lines lately." /></Card>}
      </View>}

      <Txt size={12.5} color={T.text4} style={{ textAlign: "center", marginTop: 24 }}>
        The phone lists about the last day of work.
      </Txt>
    </Screen>
  );
}
