// The Evolution page's charts, drawn the way the desktop draws them: one
// measure per chart on its own axis, thin bars with rounded tops anchored to
// the baseline, a recessive grid, and the value of any day one tap away.
// Each is laid out at the width it is shown at, so labels never stretch.
import React, { useState } from "react";
import { Platform, Pressable, View } from "react-native";
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import { T } from "../theme";
import { Txt } from "../ui";

export function Sparkline({ values, width = 120, height = 32 }) {
  const pts = values.map((v, i) => [i, v]).filter(([, v]) => v !== null && v !== undefined);
  if (pts.length < 2) return <View style={{ width, height }} />;
  const n = values.length - 1 || 1;
  const lo = Math.min(...pts.map((p) => p[1])), hi = Math.max(...pts.map((p) => p[1]));
  const span = hi - lo || 1;
  const xy = pts.map(([i, v]) => [4 + (i / n) * (width - 10), height - 5 - ((v - lo) / span) * (height - 10)]);
  const d = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const [lx, ly] = xy[xy.length - 1];
  return (
    <Svg width={width} height={height}>
      <Path d={d} fill="none" stroke={T.text4} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={lx} cy={ly} r={4} fill={T.text} stroke={T.surface} strokeWidth={2} />
    </Svg>
  );
}

const FONT = Platform.OS === "web" ? "-apple-system, system-ui, sans-serif" : undefined;
const dayLabel = (d, long) => new Date(d.day + "T12:00:00").toLocaleDateString([], long
  ? { weekday: "short", month: "short", day: "numeric" } : { month: "short", day: "numeric" });

export function BarChart({ days, field, title, color, rate = false, detail }) {
  const [width, setWidth] = useState(0);
  const [pick, setPick] = useState(null);
  const H = 120, L = 34, B = 20, TOP = 8;
  const vals = days.map((d) => d[field]);
  const max = rate ? 1 : Math.max(2, ...vals.filter((v) => v !== null && v !== undefined));
  const nice = rate ? 1 : Math.ceil(max / 2) * 2;
  const W = width;
  const band = days.length ? (W - L) / days.length : 0;
  const bw = Math.min(10, band * 0.62);
  const y = (v) => TOP + (H - B - TOP) * (1 - v / nice);
  const fmt = (v) => v === null || v === undefined ? "No runs" : rate ? `${Math.round(v * 100)}%` : String(v);

  const picked = pick !== null ? days[pick] : null;
  return (
    <View style={{ marginTop: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", minHeight: 20 }}>
        <Txt size={13} color={T.text3} style={{ flex: 1 }}>{title}</Txt>
        {picked && (
          <Txt size={13} color={T.text2}>
            <Txt size={13} weight="600">{fmt(picked[field])}</Txt>
            {"  "}{dayLabel(picked, true)}{detail && detail(picked) ? ` · ${detail(picked)}` : ""}
          </Txt>
        )}
      </View>
      <View onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))} style={{ height: H, marginTop: 4 }}>
        {W > 0 && days.length > 0 && (
          <Svg width={W} height={H}>
            <G>
              {[0, 0.5, 1].map((f) => {
                const v = nice * f, yy = y(v);
                return (
                  <G key={f}>
                    <Line x1={L} x2={W} y1={yy} y2={yy} stroke={T.grid} strokeWidth={1} />
                    <SvgText x={L - 6} y={yy + 3.5} fontSize={10.5} fill={T.text3} fontFamily={FONT} textAnchor="end">
                      {rate ? `${Math.round(v * 100)}%` : String(Math.round(v))}
                    </SvgText>
                  </G>
                );
              })}
              <Line x1={L} x2={W} y1={H - B} y2={H - B} stroke={T.axis} strokeWidth={1} />
            </G>
            {days.map((d, i) => {
              const v = d[field], x = L + i * band + (band - bw) / 2;
              const on = pick === i;
              if (v === null || v === undefined || H - B - y(v) < 0.5) {
                return <Rect key={i} x={x} y={H - B - 2} width={bw} height={2} rx={1} fill={on ? T.text3 : T.grid} />;
              }
              const top = y(v), hgt = H - B - top, r = Math.min(4, bw / 2, hgt);
              const p = `M${x} ${H - B}V${top + r}Q${x} ${top} ${x + r} ${top}H${x + bw - r}` +
                `Q${x + bw} ${top} ${x + bw} ${top + r}V${H - B}Z`;
              return <Path key={i} d={p} fill={color} opacity={pick === null || on ? 1 : 0.45} />;
            })}
            {[0, Math.floor(days.length / 2), days.length - 1].map((i, n) => (
              <SvgText key={n} x={L + i * band + band / 2} y={H - 5} fontSize={10.5} fill={T.text3} fontFamily={FONT}
                textAnchor={["start", "middle", "end"][n]}>{dayLabel(days[i])}</SvgText>
            ))}
          </Svg>
        )}
        {/* bars are thin; the whole day's column answers a tap */}
        {W > 0 && (
          <View style={{ position: "absolute", left: L, top: 0, right: 0, height: H - B + 6, flexDirection: "row" }}>
            {days.map((d, i) => (
              <Pressable key={i} style={{ flex: 1 }} onPress={() => setPick(pick === i ? null : i)}
                accessibilityLabel={`${title}, ${dayLabel(d, true)}: ${fmt(d[field])}`} />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

export function DayTable({ days }) {
  const cols = [["Day", 1.15], ["Runs", 0.7], ["Clean", 0.8], ["Failed", 0.8], ["Corrections", 1.1]];
  const row = (cells, head, key) => (
    <View key={key} style={{ flexDirection: "row", paddingVertical: 7, borderBottomWidth: 1, borderColor: T.line }}>
      {cells.map((c, i) => (
        <Txt key={i} size={13} weight={head ? "500" : "400"} color={head ? T.text3 : T.text2}
          style={{ flex: cols[i][1], fontVariant: ["tabular-nums"] }}>{c}</Txt>
      ))}
    </View>
  );
  return (
    <View style={{ marginTop: 10 }}>
      {row(cols.map((c) => c[0]), true, "h")}
      {[...days].reverse().map((d) => row([
        dayLabel(d), String(d.runs ?? 0), d.clean_rate === null || d.clean_rate === undefined ? "—" : `${Math.round(d.clean_rate * 100)}%`,
        d.error_rate === null || d.error_rate === undefined ? "—" : `${(d.error_rate * 100).toFixed(1)}%`,
        String(d.corrections ?? 0)], false, d.day))}
    </View>
  );
}
