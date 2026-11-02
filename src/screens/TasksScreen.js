// Recent tasks and where each stands, by what the kernel recorded. The kernel lists
// the latest sessions, about a day's worth, so this is not all of history. Routine
// heartbeats and direct lines sit under their own filter, so they do not bury the
// work you asked for.
import React, { useMemo, useState } from "react";
import { RefreshControl, View } from "react-native";
import { TaskRow } from "../components/Tasks";
import { ACTIVE, isRoutine } from "../harness";
import * as store from "../store";
import { useStore } from "../store";
import { T } from "../theme";
import { Card, Empty, Header, List, Screen, Segmented } from "../ui";

export default function TasksScreen({ nav, onBack }) {
  const state = useStore((s) => s.state);
  const kernel = useStore((s) => s.kernel);
  const control = useStore((s) => s.control);
  const [filter, setFilter] = useState("open");
  const [refreshing, setRefreshing] = useState(false);
  const agents = useMemo(() => store.agentsById(state), [state]);
  const missions = useMemo(() => Object.fromEntries((control.missions || []).map((m) => [m.id, m])), [control.missions]);
  const all = kernel?.sessions || control.workers || [];
  const quiet = (w) => isRoutine(w) || w.direct;
  const groups = {
    open: all.filter((w) => ACTIVE.includes(w.status) && !quiet(w)),
    done: all.filter((w) => !ACTIVE.includes(w.status) && !quiet(w)),
    routine: all.filter(quiet),
  };
  const list = groups[filter];
  const names = { open: "Open", done: "Earlier", routine: "Routine" };
  const empty = { open: "Nothing open. Whatever you hand the agent shows up here while it is worked on.",
                  done: "Nothing earlier in the last day or so.", routine: "No heartbeats or direct lines lately." };

  return (
    <View style={{ flex: 1 }}>
      <Header title="Recent tasks" onBack={onBack} />
      <Screen refreshControl={<RefreshControl refreshing={refreshing} tintColor={T.text3}
        onRefresh={async () => { setRefreshing(true); await store.refresh(); setRefreshing(false); }} />}>
        <Segmented value={filter} onChange={setFilter} style={{ marginBottom: 14 }}
          options={Object.keys(groups).map((k) => ({ value: k, label: names[k], count: groups[k].length }))} />
        {list.length ? (
          <List>
            {list.map((w) => <TaskRow key={w.id} w={w} mission={missions[w.mission]} agents={agents} onPress={() => nav.openTask(w.id)} />)}
          </List>
        ) : <Card><Empty compact text={empty[filter]} /></Card>}
      </Screen>
    </View>
  );
}
