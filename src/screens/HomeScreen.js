// How things stand: the lead and what it is waiting on, what needs you, the work
// under way with each step as it lands, and the team, each profile drawn as it is
// right now. Asking starts in the conversation, one tap from the top.
import React, { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "../components/Icon";
import { AgentMark } from "../components/Presence";
import { ReachBanner, useGate } from "../components/Reach";
import { agentName } from "../components/Work";
import { Living, WorkList } from "../components/WorkCard";
import { clip, greeting, needLine } from "../harness";
import { nav } from "../nav";
import * as store from "../store";
import { useStore } from "../store";
import { T } from "../theme";
import { Card, IconButton, Section, Txt, haptic } from "../ui";

export default function HomeScreen() {
  const gate = useGate();
  if (gate) return gate;
  return <Home />;
}

function Home() {
  const insets = useSafeAreaInsets();
  const state = useStore((s) => s.state);
  const inbox = useStore((s) => s.control.inbox) || [];
  const work = useStore((s) => s.work);
  const [refreshing, setRefreshing] = useState(false);
  const lead = store.lead(state);
  const agents = useMemo(() => store.agentsById(state), [state]);
  const live = useMemo(() => work.filter((t) => t.live).map((t) => t.id), [work]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.bg }} contentInsetAdjustmentBehavior="never" keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets
      contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: insets.bottom + 28, paddingHorizontal: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={T.text3} progressViewOffset={insets.top}
        onRefresh={async () => { setRefreshing(true); await store.refresh(); setRefreshing(false); }} />}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginRight: -8 }}>
        <Txt display size={28} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ flex: 1 }}>
          {greeting(state?.user?.name)}
        </Txt>
        <IconButton name="search" color={T.text} label="Search everything" onPress={() => nav.push({ kind: "search" })} />
        <IconButton name="bolt" color={T.text} label="Activity" onPress={() => nav.tab("activity")} />
      </View>

      {!!lead && <LeadRow lead={lead} busy={live.length > 0} />}
      <ReachBanner style={{ marginTop: 14 }} />

      {inbox.length > 0 && (
        <Section title="Needs you" count={inbox.length} style={{ marginTop: 24 }}>
          <Card>
            {inbox.slice(0, 3).map((item, n) => (
              <Pressable key={`${item.kind}:${item.id}`} onPress={() => nav.tab("inbox")} accessibilityRole="button"
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12,
                  borderTopWidth: n ? 1 : 0, borderColor: T.line, backgroundColor: pressed ? T.hover : "transparent" })}>
                <AgentMark id={item.agent && item.agent !== "*" ? item.agent : lead?.id} size={34} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt size={14.5} weight="500" numberOfLines={1}>
                    {needLine(item, item.agent && item.agent !== "*" ? agentName(item.agent, agents) : lead?.name || "Someone")}
                  </Txt>
                  <Txt size={13} color={T.text3} numberOfLines={2}>{clip(String(item.title || "").split("\n")[0], 90)}</Txt>
                </View>
                <Icon name="chev" size={15} color={T.text4} />
              </Pressable>
            ))}
            {inbox.length > 3 && (
              <Pressable onPress={() => nav.tab("inbox")} style={{ paddingVertical: 11, alignItems: "center", borderTopWidth: 1, borderColor: T.line }}>
                <Txt size={13.5} color={T.text3}>{inbox.length - 3} more in the Inbox</Txt>
              </Pressable>
            )}
          </Card>
        </Section>
      )}

      {live.length > 0 && (
        <Section title="Under way" count={live.length} style={{ marginTop: 24 }}>
          <WorkList ids={live} />
        </Section>
      )}

      <Section title="Team" style={{ marginTop: 24 }}>
        <Card>
          {(state?.agents || []).map((agent, n) => (
            <View key={agent.id} style={{ borderTopWidth: n ? 1 : 0, borderColor: T.line }}>
              <TeamRow agent={agent} lead={agent.id === lead?.id} />
            </View>
          ))}
        </Card>
      </Section>
    </ScrollView>
  );
}

// The one the owner talks to: how it is, what it is waiting on, and the way in to ask.
function LeadRow({ lead, busy }) {
  const line = useStore(store.leadLineOf);
  const thinking = useStore((s) => (s.status[lead.id] || "idle") !== "idle");
  return (
    <Pressable onPress={() => { haptic.tap(); nav.tab("chat", { focus: true }); }} accessibilityRole="button"
      accessibilityLabel={`${lead.name}: ${line}. Ask anything, or hand over a task`}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 16, marginTop: 14, opacity: pressed ? 0.8 : 1 })}>
      <AgentMark agent={lead} size={76} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt size={22} weight="700" numberOfLines={1} style={{ letterSpacing: -0.3 }}>{lead.name}</Txt>
        {busy || thinking ? <Living size={15} color={T.text2}>{line}</Living>
          : <Txt size={15} color={T.text3} numberOfLines={1}>{line}</Txt>}
        <Txt size={13.5} weight="500" color={T.focus} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={{ marginTop: 5 }}>
          Ask anything, or hand over a task
        </Txt>
      </View>
    </Pressable>
  );
}

function TeamRow({ agent, lead }) {
  const mood = useStore((s) => store.moodOf(s, agent.id));
  const doing = useStore((s) => store.doingOf(s, agent.id));
  return (
    <Pressable onPress={() => (lead ? nav.tab("chat") : nav.openThread(`dm:${agent.id}`))} accessibilityRole="button"
      accessibilityLabel={`${agent.name}${doing ? `, ${doing}` : ""}`}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 11,
        backgroundColor: pressed ? T.hover : "transparent" })}>
      <AgentMark agent={agent} size={40} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt size={15.5} weight="500" numberOfLines={1}>{agent.name}</Txt>
        {!doing ? null : mood !== "idle" && mood !== "offline" ? <Living color={T.text2}>{doing}</Living>
          : <Txt size={13} color={T.text3} numberOfLines={1}>{doing}</Txt>}
      </View>
      <Icon name="chev" size={15} color={T.text4} />
    </Pressable>
  );
}
