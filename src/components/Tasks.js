// A task's Worker as the harness knows it: where it stands in a word, for the
// task's own page and the list of routine work.
import React, { useEffect, useRef } from "react";
import { Animated, Pressable, View } from "react-native";
import Icon from "./Icon";
import { agentName } from "./Work";
import { taskTitle, workerState } from "../harness";
import { T, ago } from "../theme";
import { Pill, Txt } from "../ui";

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
