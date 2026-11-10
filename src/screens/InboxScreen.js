// What needs you: a question from a task, a held command, a job asking to start,
// a proposed change, a sign-in, a lesson. The newest is open and can be answered
// here; the rest wait in a list under it, each one a tap from being the open one.
import React, { useEffect, useMemo, useState } from "react";
import { RefreshControl, View } from "react-native";
import { LeadMark } from "../components/Presence";
import { Decision, DecisionRow } from "../components/Decisions";
import { ReachBanner, useGate } from "../components/Reach";
import { groupWorkers } from "../harness";
import { nav } from "../nav";
import * as store from "../store";
import { useStore } from "../store";
import { T } from "../theme";
import { Button, Card, Empty, List, Screen, Section, Title } from "../ui";

// A new question from the same task is a new thing to answer, with no old draft in its box.
const keyOf = (i) => `${i.kind}:${i.id}${i.kind === "question" ? `:${i.title}` : ""}`;

export default function InboxScreen() {
  const gate = useGate();
  const state = useStore((s) => s.state);
  const control = useStore((s) => s.control);
  const kernel = useStore((s) => s.kernel);
  const loaded = useStore((s) => s.loaded);
  const online = useStore((s) => s.online);
  const [refreshing, setRefreshing] = useState(false);
  const [opened, setOpened] = useState(null);
  const inbox = control.inbox || [];
  // What is open stays open until it is dealt with: the list is newest first, and a new
  // arrival must not swap the card under a finger or throw away what is being typed.
  const keys = inbox.map(keyOf).join("\n");
  useEffect(() => {
    setOpened((cur) => (cur && inbox.some((i) => keyOf(i) === cur) ? cur : inbox[0] ? keyOf(inbox[0]) : null));
  }, [keys]);
  const agents = useMemo(() => store.agentsById(state), [state]);
  const groups = useMemo(() => groupWorkers(kernel?.sessions || control.workers), [kernel?.sessions, control.workers]);

  if (gate) return gate;

  const name = store.lead(state)?.name || "Your agent";
  const whole = inbox.find((i) => keyOf(i) === opened) || inbox[0];
  const shut = inbox.filter((i) => i !== whole);
  const working = groups.running.length;

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} tintColor={T.text3}
      onRefresh={async () => { setRefreshing(true); await store.refresh(); setRefreshing(false); }} />}>
      <Title sub={inbox.length ? (inbox.length === 1 ? "One thing is waiting on you." : `${inbox.length} things are waiting on you.`)
        : "Whatever needs your say comes here first."}>Inbox</Title>
      <ReachBanner style={{ marginBottom: 16 }} />

      {whole && <Decision key={keyOf(whole)} i={whole} agents={agents} nav={nav} />}
      {shut.length > 0 && (
        <Section title="Also waiting" count={shut.length} style={{ marginTop: 22 }}>
          <List>
            {shut.map((i) => <DecisionRow key={keyOf(i)} i={i} agents={agents} onPress={() => setOpened(keyOf(i))} />)}
          </List>
        </Section>
      )}

      {!inbox.length && loaded && online !== false && (
        <Card>
          <Empty compact art={<LeadMark size={64} />} title="Nothing needs you"
            text={working ? `${name} has ${working === 1 ? "a task" : `${working} tasks`} going and will ask here if it needs you.`
              : `${name} is listening, and will ask here if it needs you.`}>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <Button label={`Talk to ${name}`} small onPress={() => nav.tab("chat", { focus: true })} />
              {working > 0 && <Button label="See tasks" small kind="ghost" onPress={() => nav.tab("tasks")} />}
            </View>
          </Empty>
        </Card>
      )}
    </Screen>
  );
}
