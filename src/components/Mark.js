// The agent, drawn. One disc, because there is one agent, ringed by its places
// for work: a place is a small point while it is free and a bright dot while a
// task holds it, and the ring turns slowly while anything is running. The ring
// itself goes orange when something is waiting on the owner. It is also a gauge,
// so it shows the real count rather than a mood.
import React, { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { T, colorOf, luminance } from "../theme";
import { Txt } from "../ui";

let calm = false;
try { AccessibilityInfo.isReduceMotionEnabled().then((on) => { calm = !!on; }).catch(() => {}); } catch {}

export default function Mark({ size = 40, slots = 6, used = 0, attention = 0, busy = false, color, label }) {
  const spin = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(0)).current;
  const turning = used > 0 && !calm;
  const breathing = busy && !calm;

  useEffect(() => {
    if (!turning) return undefined;
    spin.setValue(0);
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 26000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [turning]);

  useEffect(() => {
    if (!breathing) { breath.setValue(0); return undefined; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(breath, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(breath, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [breathing]);

  const c = size / 2;
  const ring = size * 0.42;
  const count = Math.max(1, slots || 6);
  const lit = Math.min(used, count);
  const points = Array.from({ length: count }, (_, i) => {
    const a = (-90 + (i * 360) / count) * (Math.PI / 180);
    return { x: c + ring * Math.cos(a), y: c + ring * Math.sin(a), tone: i < lit ? T.good : null };
  });
  const disc = size * 0.42;

  return (
    <View accessibilityLabel={label} accessible={!!label} style={{ width: size, height: size }}>
      <Animated.View style={{ position: "absolute", width: size, height: size, transform: [
        { rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }}>
        <Svg width={size} height={size}>
          <Circle cx={c} cy={c} r={ring} stroke={attention ? T.signal : T.lineStrong} strokeWidth={Math.max(1, size * (attention ? 0.024 : 0.014))} fill="none" />
          {points.map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={p.tone ? Math.max(2, size * 0.055) : Math.max(1.1, size * 0.024)}
              fill={p.tone || T.text4} />
          ))}
        </Svg>
      </Animated.View>
      <Animated.View style={{ position: "absolute", left: c - disc / 2, top: c - disc / 2, width: disc, height: disc,
        borderRadius: disc / 2, backgroundColor: color || T.text,
        opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 0.72] }),
        transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 0.88] }) }] }} />
    </View>
  );
}

// A profile on the roster: what a task is running as. Quiet on purpose, since
// the owner talks to one agent and these are only its roles.
export function ProfileDot({ agent, size = 26 }) {
  const c = colorOf(agent);
  const ink = luminance(c) > 0.45 ? "#111214" : "#ffffff";
  const name = String(agent?.name || agent?.id || "?");
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c, alignItems: "center", justifyContent: "center" }}>
      <Txt size={size * 0.46} weight="700" color={ink} style={{ lineHeight: size * 0.62 }}>{name[0].toUpperCase()}</Txt>
    </View>
  );
}
