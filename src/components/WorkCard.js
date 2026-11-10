// Work as it is being done: who has it, what they are on, and each step as it
// lands. Open while it is under way, with a line to change its course; finished,
// it folds to a line that opens again.
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, LayoutAnimation, Platform, Pressable, TextInput, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import Icon from "./Icon";
import { AgentMark, useCalm } from "./Presence";
import { api } from "../api";
import { clip, phaseLine, shortSpan, took } from "../harness";
import { nav } from "../nav";
import * as store from "../store";
import { useStore } from "../store";
import { RADIUS, T, plural } from "../theme";
import { Txt, haptic, notify } from "../ui";

const SHOWN = 4;

const ease = () => { if (Platform.OS === "ios") LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); };

function tint(task) {
  if (task.phase === "needs_you" || task.phase === "fixing") return T.warn;
  if (task.phase === "done") return task.outcome === "finished" ? T.good : task.outcome === "failed" ? T.danger : T.text3;
  return T.text2;
}

// A small turning arc.
export function Spinner({ size = 13, color }) {
  const still = useCalm();
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (still) return undefined;
    const loop = Animated.loop(Animated.timing(a, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [still]);
  const r = size / 2 - 1.2;
  const p = (t) => `${size / 2 + Math.cos(t) * r} ${size / 2 + Math.sin(t) * r}`;
  return (
    <Animated.View accessibilityElementsHidden importantForAccessibility="no"
      style={{ width: size, height: size, transform: [{ rotate: a.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }}>
      <Svg width={size} height={size}>
        <Path d={`M${p(0.5)}A${r} ${r} 0 1 1 ${p(4.5)}`} stroke={color || T.text2} strokeWidth={1.8} strokeLinecap="round" fill="none" />
      </Svg>
    </Animated.View>
  );
}

// Words that breathe a little, for something still under way.
export function Living({ children, color, size = 13, style, lines = 1 }) {
  const still = useCalm();
  const a = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (still) { a.setValue(1); return undefined; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 0.5, duration: 950, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(a, { toValue: 1, duration: 950, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [still]);
  return (
    <Animated.View style={[{ opacity: a }, style]}>
      <Txt size={size} color={color || T.text2} numberOfLines={lines}>{children}</Txt>
    </Animated.View>
  );
}

// How long it has been at it, counted by the second.
function Elapsed({ since }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.floor(Date.now() / 1000 - since));
  const text = s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
    : `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return <Txt size={12.5} color={T.text4} style={{ fontVariant: ["tabular-nums"] }}>{text}</Txt>;
}

function StepMark({ status }) {
  if (status === "running") return <Spinner />;
  if (status === "completed") return <Icon name="check" size={14} color={T.good} weight={2.2} />;
  if (status === "failed") return <Icon name="x" size={13} color={T.danger} weight={2.4} />;
  return <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: T.text4 }} />;
}

const STEP_WORDS = { running: "under way", completed: "done", failed: "failed" };

// `inList`: drawn as a row of a list, which has its own card behind it.
export default function WorkCard({ id, inList = false, style }) {
  const task = useStore((s) => s.work.find((t) => t.id === id) || null);
  const [opened, setOpened] = useState(null);
  const [allSteps, setAllSteps] = useState(false);
  const [steer, setSteer] = useState("");
  const [steered, setSteered] = useState("");
  const [sending, setSending] = useState(false);
  if (!task) return null;

  const open = opened === null ? task.live : opened;
  const line = phaseLine(task);
  const hidden = allSteps ? 0 : Math.max(0, task.steps.length - SHOWN);
  const visible = task.steps.slice(hidden);
  const needs = task.phase === "needs_you";

  async function send() {
    const text = steer.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await api.stepIn(task.session, text);
      haptic.done();
      setSteered(text); setSteer("");
      store.refreshWork(); store.refreshControl();
    } catch (e) { notify(String(e.message || e), true); }
    setSending(false);
  }

  return (
    <View style={[inList ? { paddingHorizontal: 14, paddingVertical: 12 }
      : { padding: 14, borderRadius: RADIUS.lg, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line }, style]}>
      <Pressable onPress={() => { haptic.pick(); ease(); setOpened(!open); }} accessibilityRole="button"
        accessibilityState={{ expanded: open }} accessibilityLabel={`${task.agentName}, ${task.title}, ${line}`}
        style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <AgentMark id={task.agent} size={40} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt size={12} weight="500" color={T.text3} numberOfLines={1}>{task.agentName}</Txt>
          <Txt size={15} weight="600" numberOfLines={2} style={{ lineHeight: 20 }}>{task.title}</Txt>
          {task.live ? (
            needs ? <Txt size={13} color={T.warn} numberOfLines={1}>{task.agentName} needs you</Txt>
              : <Living color={tint(task)}>{line}</Living>
          ) : (
            <Txt size={13} color={T.text3} numberOfLines={1}>
              <Txt size={13} color={tint(task)}>{line}</Txt>{` · ${plural(task.steps.length, "step")} · ${took(task)}`}
            </Txt>
          )}
        </View>
        {task.live && <Elapsed since={task.started} />}
        <View style={{ transform: [{ rotate: open ? "90deg" : "0deg" }] }}><Icon name="chev" size={14} color={T.text4} weight={2.2} /></View>
      </Pressable>

      {open && (
        <View>
          {(visible.length > 0 || hidden > 0) && (
            <View style={{ marginTop: 10 }}>
              {hidden > 0 && (
                <Pressable onPress={() => { ease(); setAllSteps(true); }} hitSlop={6} accessibilityRole="button" style={{ paddingVertical: 5 }}>
                  <Txt size={13} color={T.text4}>… {plural(hidden, "earlier step")}</Txt>
                </Pressable>
              )}
              {visible.map((step) => (
                <View key={step.id} accessible accessibilityLabel={`${step.label}, ${STEP_WORDS[step.status] || step.status}`}
                  style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 5 }}>
                  <View style={{ width: 16, height: 16, alignItems: "center", justifyContent: "center" }}><StepMark status={step.status} /></View>
                  <Txt size={14} color={step.status === "running" ? T.text : T.text2} numberOfLines={1} style={{ flex: 1 }}>{step.label}</Txt>
                  {step.status !== "running" && step.seconds >= 1 && (
                    <Txt size={12} color={T.text4} style={{ fontVariant: ["tabular-nums"] }}>{shortSpan(step.seconds)}</Txt>
                  )}
                </View>
              ))}
            </View>
          )}

          {needs && !!task.waitingText && <Txt size={14.5} style={{ marginTop: 10 }}>{task.waitingText}</Txt>}

          {task.checksTotal > 0 && (
            <View accessible accessibilityLabel={`${task.checksDone} of ${task.checksTotal} confirmed`}
              style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10 }}>
              {Array.from({ length: task.checksTotal }, (_, i) => (
                <View key={i} style={{ width: 20, height: 3.5, borderRadius: 2, backgroundColor: i < task.checksDone ? T.good : T.surface3 }} />
              ))}
              <Txt size={12} color={T.text4} style={{ marginLeft: 3 }}>{task.checksDone} of {task.checksTotal} confirmed</Txt>
            </View>
          )}

          {task.live && !!task.session && (
            <View style={{ marginTop: 10, borderTopWidth: 1, borderColor: T.line, paddingTop: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 36 }}>
                <TextInput value={steer} onChangeText={setSteer} onSubmitEditing={send} returnKeyType="send" editable={!sending}
                  placeholder={needs ? `Answer ${task.agentName}` : `Tell ${task.agentName} to change course`}
                  placeholderTextColor={T.text4} keyboardAppearance={T.scheme} selectionColor={T.focus}
                  style={{ flex: 1, fontSize: 14.5, color: T.text, paddingVertical: 6 }} />
                {sending ? <Spinner /> : !!steer.trim() && (
                  <Pressable onPress={send} hitSlop={8} accessibilityLabel="Send to the task"
                    style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: T.accent, alignItems: "center", justifyContent: "center" }}>
                    <Icon name="up" size={15} color={T.accentInk} weight={2.2} />
                  </Pressable>
                )}
              </View>
              {!!steered && (
                <Txt size={12} color={T.text4} style={{ marginTop: 2 }}>
                  Sent. {task.agentName} reads it at its next step: “{clip(steered, 60)}”
                </Txt>
              )}
            </View>
          )}

          {!!task.session && (
            <Pressable onPress={() => nav.openTask(task.session)} hitSlop={6} accessibilityRole="button"
              accessibilityLabel={`Open task: ${task.title}`}
              style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 3, marginTop: 8 }}>
              <Txt size={13} color={T.text3}>Open task</Txt>
              <Icon name="chev" size={13} color={T.text3} />
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

// Several of them as the rows of one list.
export function WorkList({ ids }) {
  return (
    <View style={{ borderRadius: RADIUS.lg, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, overflow: "hidden" }}>
      {ids.map((id, i) => (
        <View key={id} style={{ borderTopWidth: i ? 1 : 0, borderColor: T.line }}>
          <WorkCard id={id} inList />
        </View>
      ))}
    </View>
  );
}
