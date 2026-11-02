// The first thing you see: the agent, whether it is listening, what needs you,
// and what its hands are on right now. All of it comes from the kernel's own
// record, not from anything the agent said, so this is where to look when you
// want to know if something is really being done.
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, View } from "react-native";
import Icon from "../components/Icon";
import Mark from "../components/Mark";
import { Decision, DecisionRow } from "../components/Decisions";
import { TaskCard, TaskRow, askBarStyle, runningTool, toneColor } from "../components/Tasks";
import { groupWorkers, handsLine, presence } from "../harness";
import * as store from "../store";
import { useStore } from "../store";
import { T, ago, pct, plural } from "../theme";
import { Button, Card, Empty, IconButton, List, Screen, Section, Stat, Txt } from "../ui";

// A new question from the same task is a new thing to answer, with no old draft in its box.
const keyOf = (i) => `${i.kind}:${i.id}${i.kind === "question" ? `:${i.title}` : ""}`;

export default function NowScreen({ nav, saved }) {
  const state = useStore((s) => s.state);
  const control = useStore((s) => s.control);
  const kernel = useStore((s) => s.kernel);
  const status = useStore((s) => s.status);
  const online = useStore((s) => s.online);
  const error = useStore((s) => s.error);
  const seen = useStore((s) => s.seen);
  const [refreshing, setRefreshing] = useState(false);
  const [opened, setOpened] = useState(null);   // which of what needs you is showing whole
  const loaded = useStore((s) => s.loaded);
  const inbox = control.inbox || [];
  // What is open stays open until it is dealt with: the list is newest first, and a new
  // arrival must not swap the card under a finger or throw away what is being typed.
  const keys = inbox.map(keyOf).join("\n");
  useEffect(() => {
    setOpened((cur) => (cur && inbox.some((i) => keyOf(i) === cur) ? cur : inbox[0] ? keyOf(inbox[0]) : null));
  }, [keys]);

  const agents = useMemo(() => store.agentsById(state), [state]);
  const missions = useMemo(() => Object.fromEntries((control.missions || []).map((m) => [m.id, m])), [control.missions]);
  const sessions = kernel?.sessions || control.workers;
  const groups = useMemo(() => groupWorkers(sessions), [sessions]);

  if (!saved.url) {
    return (
      <Screen contentStyle={{ paddingTop: 72, alignItems: "center" }}>
        <Mark size={104} used={0} />
        <Txt display size={32} style={{ textAlign: "center", marginTop: 26 }}>One agent, in your pocket</Txt>
        <Txt size={15} color={T.text3} style={{ textAlign: "center", marginTop: 10, marginHorizontal: 12 }}>
          Connect this phone to the Mission Control running on your Mac. See what it is doing, decide what it asks, and step in.
        </Txt>
        <View style={{ marginTop: 26 }}>
          <Button label="Connect this phone" kind="primary" icon="link" onPress={() => nav.openConfig("connection")} />
        </View>
      </Screen>
    );
  }

  if (!state) {
    return (
      <Screen>
        <Empty art={<Mark size={72} />} title={online === false ? "Can't reach Mission Control" : "Connecting…"}
          text={online === false ? `${error || "No answer"} from ${saved.url}. Check the Mac is awake and on the same network, or on Tailscale.` : saved.url}>
          {online === false && (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <Button label="Try again" kind="primary" onPress={() => store.refresh()} />
              <Button label="Connection" onPress={() => nav.openConfig("connection")} />
            </View>
          )}
        </Empty>
      </Screen>
    );
  }

  async function pull() {
    setRefreshing(true);
    await store.refresh();
    setRefreshing(false);
  }

  const agent = store.lead(state);
  const name = agent?.name || "Your agent";
  const p = presence(kernel, online);
  const limit = kernel?.slots?.limit || 6;
  const used = kernel?.slots?.used ?? groups.running.filter((w) => w.status === "working").length;
  const hands = kernel ? handsLine(groups, kernel.slots) : "";
  const whole = inbox.find((i) => keyOf(i) === opened) || inbox[0];
  const shut = inbox.filter((i) => i !== whole);
  const counts = kernel?.events_24h || {};
  const events = Object.values(counts).reduce((a, b) => a + b, 0);
  const quiet = (counts.ignored || 0) + (counts.logged || 0);
  const clean = control.evolution?.week?.clean_rate;
  // only once it has actually looked: an empty list before that says nothing
  const nothing = loaded && !!kernel && !inbox.length && !groups.running.length && !groups.waiting.length && !groups.stuck.length;
  const openWorker = (w) => nav.openTask(w.id);

  return (
    <View style={{ flex: 1 }}>
      <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pull} tintColor={T.text3} />}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingTop: 6 }}>
          <Mark size={70} slots={limit} used={used} attention={inbox.length} busy={p.busy}
            label={`${name}: ${p.word}. ${hands}`} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt display size={30} numberOfLines={1}>{name}</Txt>
            <Txt size={14} color={T.text2} style={{ marginTop: 2 }}>
              <Txt size={14} weight="600" color={toneColor(p.tone)}>{p.word}. </Txt>{hands}
            </Txt>
          </View>
        </View>

        {online === false && (
          <Card pad={14} style={{ marginTop: 16, borderColor: T.danger }}>
            <Txt size={14} weight="600" color={T.danger}>Your Mac is out of reach</Txt>
            <Txt size={13.5} color={T.text2} style={{ marginTop: 2 }}>
              This is what it looked like {seen ? ago(seen) : "earlier"}. {error}
            </Txt>
            <View style={{ flexDirection: "row", marginTop: 10 }}>
              <Button label="Try again" small onPress={() => store.refresh()} />
            </View>
          </Card>
        )}
        {online !== false && kernel && !kernel.router?.alive && (
          <Card pad={14} style={{ marginTop: 16, borderColor: T.danger }}>
            <Txt size={14} weight="600" color={T.danger}>The Router is not running</Txt>
            <Txt size={13.5} color={T.text2} style={{ marginTop: 2 }}>Nothing new is being read. Restarting Mission Control brings it back.</Txt>
          </Card>
        )}
        {online !== false && !!kernel?.paused && (
          <Card pad={14} style={{ marginTop: 16, borderColor: T.warn }}>
            <Txt size={14} weight="600" color={T.warn}>Paused</Txt>
            <Txt size={13.5} color={T.text2} style={{ marginTop: 2 }}>Events are still recorded, but no new work starts until you carry on.</Txt>
            <View style={{ flexDirection: "row", marginTop: 10 }}>
              <Button label="Open Activity" small onPress={() => nav.tab("activity")} />
            </View>
          </Card>
        )}

        {inbox.length > 0 && (
          <Section title="Inbox" count={inbox.length === 1 ? "1 needs you" : `${inbox.length} need you`}>
            <Decision key={keyOf(whole)} i={whole} agents={agents} nav={nav} />
            {shut.length > 0 && (
              <List style={{ marginTop: 10 }}>
                {shut.map((i) => <DecisionRow key={keyOf(i)} i={i} agents={agents} onPress={() => setOpened(keyOf(i))} />)}
              </List>
            )}
          </Section>
        )}

        {groups.running.length > 0 && (
          <Section title="Working now" count={groups.running.length}>
            <View style={{ gap: 10 }}>
              {groups.running.map((w) => (
                <TaskCard key={w.id} w={w} mission={missions[w.mission]} agents={agents}
                  tool={runningTool(w, control.executions)} onPress={() => openWorker(w)} />
              ))}
            </View>
          </Section>
        )}

        {groups.stuck.length > 0 && (
          <Section title="Stuck" count={groups.stuck.length}>
            <View style={{ gap: 10 }}>
              {groups.stuck.map((w) => (
                <TaskCard key={w.id} w={w} mission={missions[w.mission]} agents={agents} onPress={() => openWorker(w)} />
              ))}
            </View>
          </Section>
        )}

        {groups.waiting.length > 0 && (
          <Section title="Waiting" count={groups.waiting.length}>
            <View style={{ gap: 10 }}>
              {groups.waiting.map((w) => (
                <TaskCard key={w.id} w={w} mission={missions[w.mission]} agents={agents}
                  tool={runningTool(w, control.executions)} onPress={() => openWorker(w)} />
              ))}
            </View>
          </Section>
        )}

        {nothing && online !== false && (
          <Card style={{ marginTop: 24 }}>
            <Empty compact title="All quiet" text={`Nothing running and nothing needs you. ${name} is still listening.`} />
          </Card>
        )}

        <Section title="Last 24 hours" action="Activity" onAction={() => nav.tab("activity")}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Stat value={events} label="events" onPress={() => nav.tab("activity")} />
            <Stat value={quiet} label="left alone" onPress={() => nav.tab("activity")} />
            <Stat value={pct(clean)} label="clean runs" onPress={() => nav.push({ kind: "evolution" })} />
          </View>
        </Section>

        {groups.recent.length > 0 && (
          <Section title="Last 24 hours of tasks" action="All recent" onAction={() => nav.push({ kind: "tasks" })}>
            <List>
              {groups.recent.slice(0, 6).map((w) => (
                <TaskRow key={w.id} w={w} mission={missions[w.mission]} agents={agents} onPress={() => openWorker(w)} />
              ))}
            </List>
          </Section>
        )}
        {!groups.recent.length && (
          <Pressable onPress={() => nav.push({ kind: "tasks" })} style={{ alignSelf: "center", marginTop: 22 }}>
            <Txt size={13.5} color={T.text3}>Recent tasks</Txt>
          </Pressable>
        )}
      </Screen>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 6 }}>
        <Pressable onPress={() => nav.tab("chat", { focus: true })} accessibilityRole="button"
          accessibilityLabel={`Tell ${name} what you need`} style={({ pressed }) => [askBarStyle(), { opacity: pressed ? 0.75 : 1 }]}>
          <Txt size={15} color={T.text3} numberOfLines={1}>Tell {name} what you need</Txt>
        </Pressable>
        <IconButton name="mic" color={T.text} label="Talk" onPress={() => nav.openVoice()}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: T.surface, borderWidth: 1, borderColor: T.lineStrong }} />
      </View>
    </View>
  );
}
