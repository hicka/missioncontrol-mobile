// A task as the harness knows it: where its Worker stands in a word, what role it
// runs as, how long it has been at it, when it last did anything, and what it is
// doing this moment. The strip under the chat header is the same work, shorter.
import React, { useEffect, useRef } from "react";
import { Animated, Pressable, ScrollView, View } from "react-native";
import Icon from "./Icon";
import { agentName, toolDetail } from "./Work";
import { clip, taskTitle, withoutMarker, workerState } from "../harness";
import { RADIUS, T, ago, span } from "../theme";
import { Card, Pill, Txt, haptic } from "../ui";

const TONE_COLOR = { good: () => T.good, info: () => T.info, signal: () => T.signal, warn: () => T.warn, danger: () => T.danger, "": () => T.text3 };
export const toneColor = (tone) => (TONE_COLOR[tone] || TONE_COLOR[""])();

// A point that pulses while its Worker is really running, and holds still otherwise.
export function StatePoint({ state, size = 9 }) {
  const a = useRef(new Animated.Value(0)).current;
  const live = !!state.live;
  useEffect(() => {
    if (!live) { a.setValue(0); return undefined; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(a, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [live]);
  const color = toneColor(state.tone);
  if (state.key === "done") return <Icon name="check" size={size + 6} color={T.text3} weight={2} />;
  return (
    <View style={{ width: size + 6, height: size + 6, alignItems: "center", justifyContent: "center" }}>
      {live && (
        <Animated.View style={{ position: "absolute", width: size + 6, height: size + 6, borderRadius: (size + 6) / 2, backgroundColor: color,
          opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.32] }),
          transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.15] }) }] }} />
      )}
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

export function StatePill({ state }) {
  return <Pill status={state.key} label={state.label} tone={state.tone} />;
}

// the tool a Worker's task is running right now, if any
export function runningTool(w, executions) {
  if (!w) return null;
  // one-shot Workers and direct lines have no task record, so their tools go by session
  return (executions || []).find((e) => e.status === "running" && e.kind === "tool" &&
    ((w.mission && e.mission === w.mission) || e.detail?.session === w.id)) || null;
}

// What the person asked for, as the checks the task keeps: each done only with how it was confirmed.
export function finishLine(w) {
  const checks = Array.isArray(w?.meta?.finish_line) ? w.meta.finish_line : [];
  const met = (c) => !!(c.done && c.how);
  return { checks, met, done: checks.filter(met).length, next: checks.find((c) => !met(c)) };
}

// The finish line as a bar of its checks, and how far along it is in words.
export function FinishBar({ w, style }) {
  const { checks, met, done, next } = finishLine(w);
  if (!checks.length) return null;
  return (
    <View style={style} accessible accessibilityLabel={`Finish line, ${done} of ${checks.length} checks done`}>
      <View style={{ flexDirection: "row", gap: 3 }}>
        {checks.map((c, i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2,
            backgroundColor: met(c) ? (c.unverified ? T.warn : T.good) : T.surface3 }} />
        ))}
      </View>
      <Txt size={12.5} color={T.text3} numberOfLines={1} style={{ marginTop: 6 }}>
        {done === checks.length ? `All ${checks.length} checks done` : `${done} of ${checks.length} done`}
        {next ? <Txt size={12.5} color={T.text2}>{`  ·  ${next.check}`}</Txt> : null}
      </Txt>
    </View>
  );
}

function lastStepAge(w) {
  return w.progress || w.updated || 0;
}

// A Worker holding a place, in full: the first screen's main subject.
export function TaskCard({ w, mission, agents, tool, onPress }) {
  const state = workerState(w, mission);
  const now = Date.now() / 1000;
  const quiet = w.status === "working" && lastStepAge(w) && now - lastStepAge(w) > 900;
  const facts = [agentName(w.profile, agents), span(now - (w.created || now))];
  return (
    <Pressable onPress={() => { haptic.tap(); onPress && onPress(); }} accessibilityRole="button"
      style={({ pressed }) => ({ opacity: pressed ? 0.78 : 1 })}>
      <Card pad={14}>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
          <View style={{ marginTop: 3 }}><StatePoint state={state} /></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt size={15.5} weight="600" numberOfLines={2}>{taskTitle(w)}</Txt>
            <Txt size={13} color={T.text3} numberOfLines={1} style={{ marginTop: 2 }}>{facts.join(" · ")}</Txt>
          </View>
          <StatePill state={state} />
        </View>
        {tool ? (
          <View style={{ marginTop: 10, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9, backgroundColor: T.surface2 }}>
            <Txt mono size={12} color={T.text2} numberOfLines={1}>
              {tool.name === "terminal" ? "$ " : `${tool.name.replace(/_/g, " ")}  `}{toolDetail(tool)}
            </Txt>
          </View>
        ) : !!w.summary && (
          <Txt size={13.5} color={T.text2} numberOfLines={2} style={{ marginTop: 9 }}>{clip(withoutMarker(w.summary), 180)}</Txt>
        )}
        <FinishBar w={w} style={{ marginTop: 11 }} />
        {quiet && (
          <Txt size={12.5} color={T.warn} style={{ marginTop: 8 }}>
            No step for {span(now - lastStepAge(w))}
          </Txt>
        )}
      </Card>
    </Pressable>
  );
}

// A row for a list of finished work.
export function TaskRow({ w, mission, agents, onPress }) {
  const state = workerState(w, mission);
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => ({ flexDirection: "row", gap: 11, paddingHorizontal: 14, paddingVertical: 12,
                                 alignItems: "flex-start", backgroundColor: pressed ? T.hover : "transparent" })}>
      <View style={{ marginTop: 2 }}><StatePoint state={state} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt size={14.5} weight="500" numberOfLines={2}>{taskTitle(w)}</Txt>
        <Txt size={12.5} color={T.text3} numberOfLines={1} style={{ marginTop: 1 }}>{agentName(w.profile, agents)} · {ago(w.updated)}</Txt>
      </View>
      {state.key !== "done" && <StatePill state={state} />}
    </Pressable>
  );
}

// What the agent's hands are on, under the chat header: one tap from the
// conversation to the work it started.
export function HandsStrip({ workers, needs, onTask, onNeeds }) {
  if (!workers.length && !needs) return null;
  const now = Date.now() / 1000;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"
      style={{ flexGrow: 0, borderBottomWidth: 1, borderColor: T.line }}
      contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 7 }}>
      {!!needs && (
        <Pressable onPress={onNeeds} accessibilityLabel={`${needs} waiting on you`}
          style={({ pressed }) => ({ height: 30, paddingHorizontal: 12, borderRadius: 99, flexDirection: "row",
            alignItems: "center", gap: 6, backgroundColor: T.signal, opacity: pressed ? 0.8 : 1 })}>
          <Txt size={12.5} weight="600" color={T.signalInk} style={{ lineHeight: 16 }}>{needs} {needs === 1 ? "needs" : "need"} you</Txt>
        </Pressable>
      )}
      {workers.map((w) => {
        const state = workerState(w);
        return (
          <Pressable key={w.id} onPress={() => onTask(w)} accessibilityLabel={`${taskTitle(w)}, ${state.label}`}
            style={({ pressed }) => ({ height: 30, maxWidth: 230, paddingLeft: 7, paddingRight: 11, borderRadius: 99, flexDirection: "row",
              alignItems: "center", gap: 3, backgroundColor: pressed ? T.surface2 : T.surface, borderWidth: 1, borderColor: T.line })}>
            <StatePoint state={state} size={7} />
            <Txt size={12.5} color={T.text2} numberOfLines={1} style={{ flexShrink: 1, lineHeight: 16 }}>{taskTitle(w)}</Txt>
            <Txt size={12} color={T.text4} style={{ lineHeight: 16, marginLeft: 3 }}>{span(now - (w.created || now))}</Txt>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export const askBarStyle = () => ({ flex: 1, height: 44, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: T.lineStrong,
                                    backgroundColor: T.surface, justifyContent: "center", paddingHorizontal: 16 });
