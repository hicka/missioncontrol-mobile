// The orb from the Mac's floating bar, drawn by the same shader: a living plasma
// sphere whose colours and energy say what the agent is doing, one small light in
// orbit for each open task, dimmed while it waits, and a slow heartbeat when
// something needs the owner. It only moves while it is on screen.
import React, { useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, AppState, View } from "react-native";
import { Canvas, Fill, Shader, Skia } from "@shopify/react-native-skia";
import { useDerivedValue, useFrameCallback, useSharedValue, withTiming } from "react-native-reanimated";
import Mark from "./Mark";

const SKSL = `
uniform float2 center;
uniform float2 size;
uniform float radius;
uniform float time;
uniform float rim;
uniform float orbit;
uniform float energy;
uniform float pulse;
uniform float3 colorA;
uniform float3 colorB;
uniform float3 colorC;
uniform float satCount;
uniform float4 sats[8];
uniform float4 satTint[8];

float hash(float2 p) {
  p = fract(p * float2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + float2(1, 0)), f.x), mix(hash(i + float2(0, 1)), hash(i + float2(1, 1)), f.x), f.y);
}

float3 palette(float x) {
  x = fract(x) * 3.0;
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  if (x < 1.0) return mix(colorA, colorB, f);
  if (x < 2.0) return mix(colorB, colorC, f);
  return mix(colorC, colorA, f);
}

half4 main(float2 p) {
  const float tau = 6.28318530718;
  const float c = 0.9135;
  const float s = -0.4067;
  float2 toOrb = p - center;
  float orbDistance = length(toOrb);
  float edgeFade = smoothstep(0.0, 28.0, min(min(p.x, p.y), min(size.x - p.x, size.y - p.y)));
  float3 color = float3(0.0);
  float alpha = 0.0;

  float angle = atan(toOrb.y, toOrb.x);
  float wobble = (noise(float2(angle * 1.6 + time * 1.3, time * 0.9)) - 0.5) * 2.0;
  float shaped = radius * (1.0 + wobble * (0.012 + energy * 0.022 + pulse * 0.09) + pulse * 0.06);
  float halo = exp(-max(orbDistance - shaped, 0.0) / (2.6 + radius * 0.34)) * edgeFade;
  color += palette(angle / tau + rim) * halo * (0.14 + 0.6 * energy + 0.45 * pulse);
  alpha = max(alpha, halo * 0.3);

  float inside = smoothstep(shaped + 0.6, shaped - 0.6, orbDistance);
  if (inside > 0.0) {
    float2 n = toOrb / shaped;
    float z = sqrt(max(0.0, 1.0 - dot(n, n)));
    float3 normal = float3(n, z);
    float2 sphere = n / (1.0 + z) * 1.15;
    float clock = time * 0.9 + rim;
    float2 warp = float2(noise(sphere * 1.6 + clock), noise(sphere * 1.6 - clock + 3.1));
    float plasma = noise(sphere * 1.7 + warp * 1.5 + clock * 0.3);
    float3 tint = palette(plasma * 1.25 + rim * 0.5 + n.x * 0.12);
    float core = smoothstep(0.15, 0.85, plasma) * (0.85 + energy * 0.9 + pulse * 0.8);
    float3 ball = tint * (0.32 + core) * (0.6 + 0.55 * z);
    float3 light = normalize(float3(-0.35, -0.55, 0.8));
    ball += float3(1.0) * pow(max(dot(normal, light), 0.0), 14.0) * 0.5;
    ball += tint * pow(1.0 - z, 3.0) * (0.75 + energy * 0.8);
    color = mix(color, ball, inside);
    alpha = max(alpha, inside);
  }

  // the faint track the tasks run along, tilted like a ring, hidden behind the orb
  if (satCount > 0.5) {
    float2 tilted = float2(c * toOrb.x + s * toOrb.y, -s * toOrb.x + c * toOrb.y);
    float track = length(tilted / float2(radius * 1.8, radius * 0.62));
    if (tilted.y >= 0.0 || orbDistance > shaped) {
      float t = smoothstep(0.075, 0.0, abs(track - 1.0)) * 0.28 * edgeFade;
      color += palette(angle / tau + rim) * t;
      alpha = max(alpha, t * 0.5);
    }
  }

  // one small light for each open task, in orbit
  for (int i = 0; i < 8; i++) {
    if (float(i) >= satCount) break;
    float4 sat = sats[i];
    float a = sat.x + orbit * sat.y;
    float2 e = float2(cos(a) * radius * 1.8, sin(a) * radius * 0.62);
    float2 pos = center + float2(c * e.x - s * e.y, s * e.x + c * e.y);
    float d = length(p - pos);
    float behind = (e.y < 0.0 && length(pos - center) < shaped) ? 0.12 : 1.0;
    float glow = exp(-d * d / (2.0 * sat.z * sat.z)) * sat.w * behind;
    color += satTint[i].rgb * glow * 1.6 + float3(1.0) * glow * glow * glow * 0.9;
    alpha = max(alpha, min(glow * 1.3, 1.0));
  }

  color += (hash(p + fract(time)) - 0.5) / 170.0 * alpha;
  color = max(color, float3(0.0));
  alpha = clamp(max(alpha, max(color.r, max(color.g, color.b))), 0.0, 1.0);
  return half4(half3(min(color, float3(alpha))), half(alpha));
}
`;

// a shader that does not compile on some device draws the plain mark rather than taking the app down
let effect = null;
try { effect = Skia.RuntimeEffect.Make(SKSL); } catch {}

const BLUE = [0.25, 0.55, 1], VIOLET = [0.62, 0.36, 1], PINK = [1, 0.32, 0.62];
// How each mood looks, exactly as on the Mac. Colour and energy glide from one to the next.
export const MOODS = {
  offline: [[0.34, 0.34, 0.38], [0.42, 0.42, 0.46], [0.28, 0.28, 0.32], 0.03],
  idle: [[0.34, 0.44, 0.82], [0.52, 0.38, 0.86], [0.3, 0.58, 0.82], 0.1],
  thinking: [BLUE, VIOLET, PINK, 0.62],
  streaming: [VIOLET, PINK, [1, 0.58, 0.28], 0.74],
  working: [BLUE, [0.2, 0.85, 0.92], [0.3, 0.95, 0.68], 0.5],
  waiting: [[0.3, 0.5, 0.88], [0.26, 0.62, 0.78], [0.36, 0.7, 0.66], 0.2],
  attention: [[0.98, 0.7, 0.25], [1, 0.45, 0.2], [1, 0.85, 0.42], 0.42],
  listening: [BLUE, VIOLET, PINK, 0.55],
};

function tintOf(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return [0.6, 0.6, 0.66, 1];
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
}

const RESTING = 0.38;
const EMPTY = [0, 0, 0, 0];

// mood: one of MOODS. tasks: [{id, color, resting}], up to eight. active: whether it is on screen.
export default function Orb({ mood = "idle", tasks = [], width, height, radius = 62, active = true, pulseKey = 0 }) {
  const [calm, setCalm] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((on) => setCalm(!!on)).catch(() => {});
    const a = AccessibilityInfo.addEventListener("reduceMotionChanged", (on) => setCalm(!!on));
    const b = AppState.addEventListener("change", (s) => setForeground(s === "active"));
    return () => { a.remove(); b.remove(); };
  }, []);

  const look = MOODS[mood] || MOODS.idle;
  const colorA = useSharedValue(look[0]);
  const colorB = useSharedValue(look[1]);
  const colorC = useSharedValue(look[2]);
  const target = useSharedValue(look[3]);
  const energy = useSharedValue(look[3]);
  const time = useSharedValue(0);
  const rim = useSharedValue(0);
  const orbit = useSharedValue(0);
  const pulse = useSharedValue(0);
  const beat = useSharedValue(0);
  const heart = useSharedValue(mood === "attention" ? 1 : 0);

  useEffect(() => {
    const glide = { duration: 650 };
    colorA.value = withTiming(look[0], glide);
    colorB.value = withTiming(look[1], glide);
    colorC.value = withTiming(look[2], glide);
    target.value = look[3];
    heart.value = mood === "attention" ? 1 : 0;
  }, [mood]);

  // something happened: a reply landed, a task finished, something needs you
  useEffect(() => { if (pulseKey) pulse.value = 1; }, [pulseKey]);

  const frame = useFrameCallback((info) => {
    "worklet";
    const dt = Math.min((info.timeSincePreviousFrame || 16) / 1000, 1 / 15);
    beat.value += dt;
    // waiting on the owner has a slow heartbeat rather than a constant glow
    const heartbeat = heart.value ? 0.16 * Math.pow(Math.max(0, Math.sin(beat.value * 2.1)), 6) : 0;
    energy.value += (target.value + heartbeat - energy.value) * Math.min(1, dt * 3);
    pulse.value *= Math.max(0, 1 - dt * 3.2);
    time.value += dt * (0.32 + energy.value);
    rim.value += dt * (0.025 + energy.value * 0.2 + pulse.value * 0.2);
    orbit.value += dt;
  }, false);

  const moving = active && foreground && !calm;
  useEffect(() => { frame.setActive(moving); }, [moving]);

  const sats = useMemo(() => {
    const list = tasks.slice(0, 8);
    return {
      count: list.length,
      sats: Array.from({ length: 8 }, (_, i) => (list[i]
        ? [i * 1.05, (1.1 + i * 0.13) * (list[i].resting ? 0.3 : 1), 4.2, list[i].resting ? RESTING : 1] : EMPTY)),
      tints: Array.from({ length: 8 }, (_, i) => (list[i] ? tintOf(list[i].color) : EMPTY)),
    };
  }, [tasks.map((t) => `${t.id}:${t.resting ? 1 : 0}:${t.color}`).join(",")]);

  const cx = width / 2, cy = height / 2;
  const uniforms = useDerivedValue(() => ({
    center: [cx, cy], size: [width, height], radius,
    time: time.value, rim: rim.value, orbit: orbit.value, energy: energy.value, pulse: pulse.value,
    colorA: colorA.value, colorB: colorB.value, colorC: colorC.value,
    satCount: sats.count, sats: sats.sats, satTint: sats.tints,
  }), [cx, cy, width, height, radius, sats]);

  if (!width || !height) return <View style={{ width, height }} />;
  if (!effect) {
    return (
      <View style={{ width, height, alignItems: "center", justifyContent: "center" }}>
        <Mark size={radius * 2.4} slots={Math.max(6, tasks.length)} used={tasks.filter((t) => !t.resting).length}
          attention={mood === "attention" ? 1 : 0} busy={["thinking", "streaming", "working"].includes(mood)} />
      </View>
    );
  }
  return (
    <Canvas style={{ width, height }} pointerEvents="none">
      <Fill>
        <Shader source={effect} uniforms={uniforms} />
      </Fill>
    </Canvas>
  );
}
