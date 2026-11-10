// A profile, as a body of its own colour that moves the way the profile is. At rest
// it breathes. Thinking, something circles it. Working, light runs round its rim.
// Fixing, its edge roughens and the light turns amber. Waiting, it dims and slows.
// When it needs you, rings go out from it. Finished, it holds a tick for a moment;
// when it could not finish, it sags and fades. Out of reach, it is a grey outline.
// No face and no letter: how it is shows in how it moves.
//
// Drawn with plain vector shapes and moved by transforms the system animates by
// itself, so a list of them costs nothing on the JavaScript side while they move.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, View } from "react-native";
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Stop } from "react-native-svg";
import { MOOD_WORDS } from "../harness";
import * as store from "../store";
import { useStore } from "../store";

const AMBER = "#ffa833";

// What a state does with the shape: how far the edge moves from a circle, a rougher
// ripple on top, light on the rim, a body in orbit, rings going out, amber accents,
// colour drained, an outline with nothing in it, a tick, and how fast it all goes.
const SHAPES = {
  idle: { wobble: 0.045, speed: 1 },
  thinking: { wobble: 0.08, moon: true, speed: 1.5 },
  working: { wobble: 0.06, arc: true, speed: 1 },
  fixing: { wobble: 0.1, jag: 1, arc: true, warm: true, speed: 3 },
  waiting: { wobble: 0.025, dim: 0.45, speed: 0.45 },
  needsYou: { wobble: 0.075, ripple: true, warm: true, speed: 1 },
  happy: { wobble: 0.03, tick: true, speed: 1 },
  sad: { wobble: 0.015, dim: 0.75, sag: true, speed: 0.45 },
  offline: { wobble: 0, dim: 1, hollow: true, speed: 0 },
};
// how long one turn of whatever the state adds takes: the rim light, the orbit, the rings, the lift
const TURN = { working: 1000, fixing: 670, thinking: 2730, needsYou: 1330, happy: 750 };

/* ---------- reduced motion ---------- */
let calm = false;
const calmListeners = new Set();
function setCalm(on) { calm = !!on; for (const fn of calmListeners) fn(calm); }
try {
  AccessibilityInfo.isReduceMotionEnabled().then(setCalm).catch(() => {});
  AccessibilityInfo.addEventListener("reduceMotionChanged", setCalm);
} catch {}

export function useCalm() {
  const [on, setOn] = useState(calm);
  useEffect(() => {
    calmListeners.add(setOn);
    setOn(calm);
    return () => { calmListeners.delete(setOn); };
  }, []);
  return on;
}

/* ---------- colour ---------- */
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hex = (parts) => "#" + parts.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");

// A profile's colour, with one that would vanish on the page kept visible: near
// black or near white reads as no colour at all, so it takes slate.
export function presenceColor(color) {
  if (!/^#[0-9a-f]{6}$/i.test(color || "")) return "#738099";
  const [r, g, b] = rgb(color);
  if (Math.max(r, g, b) < 51 || Math.min(r, g, b) > 230) return "#808cad";
  return color;
}

function drained(color, dim) {
  if (!dim) return color;
  const [r, g, b] = rgb(color);
  const grey = 0.3 * r + 0.59 * g + 0.11 * b;
  const k = dim * 0.8;
  return hex([r + (grey - r) * k, g + (grey - g) * k, b + (grey - b) * k]);
}

/* ---------- shapes ---------- */
// The body's outline: a circle whose edge rises and falls a few times round.
function blob(c, radius, wobble, jag, phase) {
  const n = 60;
  let d = "";
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI;
    const ripple = Math.sin(a * 3 + phase) * 0.6 + Math.sin(a * 5 - phase * 1.3) * 0.4 + jag * Math.sin(a * 11 + phase * 2.1) * 0.45;
    const r = radius * (1 + wobble * ripple);
    d += `${i ? "L" : "M"}${(c + Math.cos(a) * r).toFixed(2)} ${(c + Math.sin(a) * r).toFixed(2)}`;
  }
  return d + "Z";
}

function arc(c, r, from, to) {
  const p = (a) => `${(c + Math.cos(a) * r).toFixed(2)} ${(c + Math.sin(a) * r).toFixed(2)}`;
  return `M${p(from)}A${r.toFixed(2)} ${r.toFixed(2)} 0 ${to - from > Math.PI ? 1 : 0} 1 ${p(to)}`;
}

// One turn in steps, for what cannot be said as a rotation: a path round an ellipse.
const STEPS = 32;
const ALONG = Array.from({ length: STEPS + 1 }, (_, i) => i / STEPS);
const round = (fn) => ALONG.map((t) => fn(t * 2 * Math.PI));

function hash(text) {
  let n = 0;
  for (const ch of String(text || "")) n = (n * 31 + ch.codePointAt(0)) % 9973;
  return n;
}

const fill = { position: "absolute", left: 0, top: 0 };

export default function Presence({ color, mood = "idle", size = 40, seed = 0, label, style }) {
  const still = useCalm();
  const shape = SHAPES[mood] || SHAPES.idle;
  const base = presenceColor(color);
  const body = drained(base, shape.dim);
  const accent = shape.warm ? AMBER : base;
  const c = size / 2;
  const radius = size * 0.315;
  const phase = (seed % 97) * 0.41;

  const turn = useRef(new Animated.Value(0)).current;     // the edge, slowly going round
  const breath = useRef(new Animated.Value(0)).current;   // in and out
  const fx = useRef(new Animated.Value(0)).current;       // one turn of what the state adds
  const shown = useRef(new Animated.Value(1)).current;    // what the state adds, arriving

  const moving = !still && !shape.hollow;
  useEffect(() => {
    if (!moving) { turn.setValue(0); breath.setValue(0); return undefined; }
    const slow = shape.speed < 1;
    const loops = [
      Animated.loop(Animated.timing(turn, { toValue: 1, duration: 16000 / shape.speed, easing: Easing.linear, useNativeDriver: true })),
      Animated.loop(Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: slow ? 3500 : 1950, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: slow ? 3500 : 1950, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])),
    ];
    // so a row of them does not move in step
    const wait = setTimeout(() => loops.forEach((l) => l.start()), seed % 700);
    return () => { clearTimeout(wait); loops.forEach((l) => l.stop()); };
  }, [moving, shape.speed, seed]);

  const period = TURN[mood];
  useEffect(() => {
    if (still || !period) { fx.setValue(0); return undefined; }
    fx.setValue(0);
    const loop = Animated.loop(Animated.timing(fx, { toValue: 1, duration: period, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [still, period]);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (still) { shown.setValue(1); return; }
    shown.setValue(0);
    Animated.timing(shown, { toValue: 1, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [mood, still]);

  const paths = useMemo(() => ({
    a: blob(c, radius, shape.wobble, shape.jag || 0, phase),
    b: blob(c, radius, shape.wobble, shape.jag || 0, phase + 2.4),
  }), [c, radius, shape.wobble, shape.jag, phase]);

  const spin = (from, to) => turn.interpolate({ inputRange: [0, 1], outputRange: [`${from}deg`, `${to}deg`] });
  const swell = shape.dim ? 0.07 : 0.036;
  const lift = shape.tick && !still ? fx.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -size * 0.05, 0] }) : 0;
  const stroke = Math.max(1.5, size * 0.055);

  // the orbit: an ellipse, nearer and larger below the body, further and fainter above it
  const orbit = radius + size * 0.1;
  const moonR = size * 0.062;
  const moon = (near) => {
    const angle = still ? 0.9 : null;
    const at = (fn) => (angle === null ? fx.interpolate({ inputRange: ALONG, outputRange: round(fn) }) : fn(angle));
    return (
      <Animated.View pointerEvents="none" style={[fill, {
        left: c - moonR, top: c - moonR, width: moonR * 2, height: moonR * 2, borderRadius: moonR,
        backgroundColor: shape.warm ? AMBER : "#ffffff",
        opacity: Animated.multiply(shown, at((a) => (Math.sin(a) > 0 === near ? (near ? 0.95 : 0.5) : 0))),
        transform: [{ translateX: at((a) => Math.cos(a) * orbit) }, { translateY: at((a) => Math.sin(a) * orbit * 0.42) },
                    { scale: near ? 1 : 0.72 }],
      }]} />
    );
  };

  const ring = (offset) => {
    // two rings half a turn apart, each growing from the body's edge and fading as it goes
    const along = still ? null : fx.interpolate({ inputRange: offset ? [0, 0.5, 0.5001, 1] : [0, 1], outputRange: offset ? [0.5, 1, 0, 0.5] : [0, 1] });
    const fixed = 0.3 + 0.5 * offset;
    return (
      <Animated.View pointerEvents="none" style={[fill, {
        width: size, height: size, borderRadius: c, borderWidth: Math.max(1, size * 0.035), borderColor: AMBER,
        opacity: Animated.multiply(shown, along ? along.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }) : 0.7 * (1 - fixed)),
        transform: [{ scale: along ? along.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) : 0.6 + 0.4 * fixed }],
      }]} />
    );
  };

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label ? `${label}, ${MOOD_WORDS[mood] || ""}` : MOOD_WORDS[mood]}
      style={[{ width: size, height: size, opacity: 1 - (shape.dim || 0) * 0.4 }, style]}>
      {shape.ripple && ring(0)}
      {shape.ripple && ring(0.5)}
      {shape.moon && !still && moon(false)}

      {shape.hollow ? (
        <Svg width={size} height={size} style={fill}>
          <Circle cx={c} cy={c} r={radius} fill="none" stroke={body} strokeOpacity={0.75} strokeWidth={Math.max(1, size * 0.05)}
            strokeDasharray={[size * 0.08, size * 0.07]} strokeLinecap="round" />
        </Svg>
      ) : (
        <Animated.View style={[fill, { width: size, height: size, transform: [
          { translateY: shape.sag ? size * 0.02 : lift },
          { scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1 - swell / 2, 1 + swell / 2] }) },
          { scaleY: shape.sag ? 0.94 : 1 }] }]}>
          <Svg width={size} height={size} style={fill}>
            <Defs>
              <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
                <Stop offset="0.55" stopColor={body} stopOpacity={0.38 * (1 - (shape.dim || 0) * 0.7)} />
                <Stop offset="1" stopColor={body} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={c} cy={c} r={size * 0.5} fill="url(#glow)" />
          </Svg>
          <Animated.View style={[fill, { width: size, height: size, transform: [{ rotate: spin(0, 360) }] }]}>
            <Svg width={size} height={size}><Path d={paths.a} fill={body} /></Svg>
          </Animated.View>
          <Animated.View style={[fill, { width: size, height: size, transform: [{ rotate: spin(0, -720) }] }]}>
            <Svg width={size} height={size}><Path d={paths.b} fill={body} /></Svg>
          </Animated.View>
          <Svg width={size} height={size} style={fill}>
            <Defs>
              {/* light on its upper left, as on anything round */}
              <RadialGradient id="light" cx="36%" cy="32%" r="78%" fx="36%" fy="32%">
                <Stop offset="0" stopColor="#ffffff" stopOpacity={0.4 * (1 - (shape.dim || 0) * 0.6)} />
                <Stop offset="0.6" stopColor="#ffffff" stopOpacity={0.05} />
                <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
              </RadialGradient>
              <RadialGradient id="shine" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#ffffff" stopOpacity={0.42 * (1 - (shape.dim || 0) * 0.6)} />
                <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={c} cy={c} r={radius * (1 - shape.wobble)} fill="url(#light)" />
            <Ellipse cx={c - radius * 0.3} cy={c - radius * 0.42} rx={radius * 0.4} ry={radius * 0.27} fill="url(#shine)" />
          </Svg>
        </Animated.View>
      )}

      {shape.arc && (
        <Animated.View pointerEvents="none" style={[fill, { width: size, height: size, opacity: shown,
          transform: [{ rotate: still ? "34deg" : fx.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }]}>
          <Svg width={size} height={size}>
            <Path d={arc(c, radius + size * 0.085, 0, 1.9)} stroke={accent} strokeOpacity={0.95} strokeWidth={stroke} strokeLinecap="round" fill="none" />
            <Path d={arc(c, radius + size * 0.085, 3.3, 4.2)} stroke={accent} strokeOpacity={0.4} strokeWidth={stroke} strokeLinecap="round" fill="none" />
          </Svg>
        </Animated.View>
      )}
      {shape.moon && moon(true)}
      {shape.tick && (
        <Animated.View pointerEvents="none" style={[fill, { width: size, height: size, opacity: shown, transform: [{ translateY: lift }] }]}>
          <Svg width={size} height={size}>
            <Path d={`M${c - radius * 0.38} ${c + radius * 0.04}L${c - radius * 0.1} ${c + radius * 0.32}L${c + radius * 0.42} ${c - radius * 0.3}`}
              stroke="#ffffff" strokeOpacity={0.95} strokeWidth={Math.max(1.5, size * 0.07)} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

// A profile's presence: its colour, moving the way the profile is right now. Give
// the profile, or only its id; `mood` overrides what the work says, for a screen
// that knows better (a call in progress, a profile being edited).
export function AgentMark({ id, agent, size = 40, mood, style }) {
  const known = useStore((s) => (id ? (s.state?.agents || []).find((a) => a.id === id) || null : null));
  const who = agent || known || (id ? { id } : null);
  const aid = who?.id || "";
  const live = useStore((s) => (aid ? store.moodOf(s, aid) : s.online === false ? "offline" : "idle"));
  return <Presence color={who?.color} mood={mood || live} size={size} seed={hash(aid || who?.name)} label={who?.name} style={style} />;
}

// The lead profile: the one the owner talks to.
export function LeadMark({ size = 40, mood, style }) {
  const lead = useStore((s) => store.lead(s.state));
  return <AgentMark agent={lead} size={size} mood={mood} style={style} />;
}
