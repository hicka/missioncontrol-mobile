// Every task the conversations started: those under way, each with its steps as
// they land and a line to change its course, then those that ended lately. A card
// opens the task's full record. Routine heartbeats and direct lines sit under
// their own filter, so they do not bury the work you asked for.
import React, { useMemo, useState } from "react";
import { RefreshControl, View } from "react-native";
import { ReachBanner, useGate } from "../components/Reach";
import { TaskRow } from "../components/Tasks";
import { WorkList } from "../components/WorkCard";
import { groupWorkers, handsLine, isRoutine } from "../harness";
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
  const work = useStore((s) => s.work);
  const [filter, setFilter] = useState("tasks");
  const [refreshing, setRefreshing] = useState(false);
  const agents = useMemo(() => store.agentsById(state), [state]);
  const missions = useMemo(() => Object.fromEntries((control.missions || []).map((m) => [m.id, m])), [control.missions]);
  const all = kernel?.sessions || control.workers || [];
  const groups = useMemo(() => groupWorkers(all), [all]);
  // newest first
  const live = useMemo(() => work.filter((t) => t.live).map((t) => t.id).reverse(), [work]);
  const done = useMemo(() => work.filter((t) => !t.live).map((t) => t.id).reverse(), [work]);

  if (gate) return gate;

  const routine = all.filter((w) => isRoutine(w) || w.direct);

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} tintColor={T.text3}
      onRefresh={async () => { setRefreshing(true); await store.refresh(); setRefreshing(false); }} />}>
      <Title sub={kernel ? handsLine(groups, kernel.slots) : undefined}>Tasks</Title>
      <ReachBanner style={{ marginBottom: 16 }} />
      {routine.length > 0 && (
        <Segmented value={filter} onChange={setFilter}
          options={[{ value: "tasks", label: "Tasks", count: live.length + done.length }, { value: "routine", label: "Routine", count: routine.length }]} />
      )}

      {filter === "tasks" && (
        <>
          {!live.length && !done.length && (
            <Card style={{ marginTop: 16 }}>
              <Empty compact title="No tasks yet" text="Hand something over in Chat and its steps show here as they happen." />
            </Card>
          )}
          {live.length > 0 && (
            <Section title="Under way" count={live.length} style={{ marginTop: 20 }}>
              <WorkList ids={live} />
            </Section>
          )}
          {done.length > 0 && (
            <Section title="Recently finished" count={done.length} style={{ marginTop: 20 }}>
              <WorkList ids={done} />
            </Section>
          )}
        </>
      )}
      {filter === "routine" && (
        <View style={{ marginTop: 16 }}>
          <List>
            {routine.map((w) => <TaskRow key={w.id} w={w} mission={missions[w.mission]} agents={agents} onPress={() => nav.openTask(w.id)} />)}
          </List>
        </View>
      )}

      <Txt size={12.5} color={T.text4} style={{ textAlign: "center", marginTop: 24 }}>
        The phone lists about the last day of work.
      </Txt>
    </Screen>
  );
}
