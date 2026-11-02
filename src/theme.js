// Mission Control on the phone: one agent and its hands. A cool graphite page,
// one ink, and colour that only ever means something: orange is what needs the
// owner, green is work going on, and the rest is status. Status always travels
// with a word, never colour alone.
//
// T is one object every screen reads while it renders. Switching theme swaps
// its values in place and the app re-renders from the root, so no screen has
// to subscribe to anything to follow the theme.
import { Platform } from "react-native";

const DARK = {
  scheme: "dark",
  bg: "#0a0b0d", side: "#08090a", surface: "#131519", surface2: "#1a1d22", surface3: "#25292f",
  select: "#1c1f24", hover: "#15181c",
  line: "rgba(255,255,255,0.08)", lineStrong: "rgba(255,255,255,0.15)",
  text: "#f4f5f7", text2: "#b8bcc5", text3: "#8a8f99", text4: "#5f646e",
  accent: "#f4f5f7", accentInk: "#0a0b0d", focus: "#7fb2ff",
  signal: "#ff6a2b", signalSoft: "rgba(255,106,43,0.15)", signalInk: "#190903",
  good: "#3ddc97", goodSoft: "rgba(61,220,151,0.13)",
  warn: "#f5b83d", warnSoft: "rgba(245,184,61,0.14)",
  danger: "#f25f6b", dangerSoft: "rgba(242,95,107,0.14)",
  info: "#6fa8ff", infoSoft: "rgba(111,168,255,0.14)",
  series1: "#3987e5", series2: "#d95926", grid: "#25282d", axis: "#363a40",
  botDark: "#ececee", botDarkEyes: "#141416",
  scrim: "rgba(0,0,0,0.55)", shadow: "#000000",
};

const LIGHT = {
  scheme: "light",
  bg: "#f5f4f0", side: "#eeede8", surface: "#ffffff", surface2: "#efeee9", surface3: "#e4e3dd",
  select: "#e4e3dd", hover: "#ebeae5",
  line: "rgba(17,18,20,0.09)", lineStrong: "rgba(17,18,20,0.17)",
  text: "#121316", text2: "#464952", text3: "#6c6f78", text4: "#a0a2a9",
  accent: "#121316", accentInk: "#ffffff", focus: "#2b6ef2",
  signal: "#d9480f", signalSoft: "rgba(217,72,15,0.1)", signalInk: "#ffffff",
  good: "#0c7a4d", goodSoft: "rgba(12,122,77,0.1)",
  warn: "#a86500", warnSoft: "rgba(242,160,30,0.16)",
  danger: "#c9303e", dangerSoft: "rgba(201,48,62,0.1)",
  info: "#2b6ef2", infoSoft: "rgba(43,110,242,0.1)",
  series1: "#2a78d6", series2: "#eb6834", grid: "#e6e5e0", axis: "#c9c8c1",
  botDark: "#1d1d1f", botDarkEyes: "#f4f4f5",
  scrim: "rgba(20,20,24,0.28)", shadow: "#14141e",
};

// The settings screens were written against the console palette; these
// names keep them reading the new one.
function legacy(p) {
  return { ...p, border: p.line, dim: p.text3, faint: p.text4,
           amber: p.warn, green: p.good, red: p.danger };
}

export const PALETTES = { dark: legacy(DARK), light: legacy(LIGHT) };
export const T = { ...PALETTES.dark };

export function applyScheme(name) {
  Object.assign(T, PALETTES[name === "light" ? "light" : "dark"]);
}

// The system face for everything, heavier and tighter for big headings; a
// monospace for commands and code.
export const FONTS = {
  mono: Platform.select({ ios: "Menlo", android: "monospace", default: "ui-monospace, Menlo, monospace" }),
};
export const MONO = FONTS.mono;

export const RADIUS = { sm: 9, md: 12, lg: 18, xl: 24 };

// the status colour that goes with each agent state
export const STATE_COLORS = {
  get idle() { return T.text4; },
  get thinking() { return T.warn; },
  get doing() { return T.good; },
};

export function colorOf(agent) {
  return /^#[0-9a-f]{6}$/i.test(agent?.color || "") ? agent.color : "#8e8e93";
}

export function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// An agent's colour where it has to stand on the page by itself: a near-black
// one would vanish on the dark theme, so it takes the theme's ink instead.
export function accentFor(agent) {
  const c = colorOf(agent);
  return luminance(c) < 0.05 ? T.botDark : c;
}

// a hex colour at some opacity, for soft tints of an agent's colour
export function alpha(hex, a) {
  if (!/^#[0-9a-f]{6}$/i.test(hex || "")) return hex;
  return hex + Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, "0");
}

export function mixHex(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return "#" + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

// Times read the way the desktop writes them: "3:04 PM", "Yesterday", "Oct 12".
const when = (t) => new Date(t < 1e12 ? t * 1000 : t);
const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const daysAgo = (t) => Math.round((startOf(new Date()) - startOf(when(t))) / 86400000);

export function fmtTime(t) {
  if (!t) return "";
  return when(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
export function fmtDay(t) {
  const diff = daysAgo(t);
  return diff === 0 ? "Today" : diff === 1 ? "Yesterday"
    : when(t).toLocaleDateString([], { month: "short", day: "numeric" });
}
export function listTime(t) {
  if (!t) return "";
  const diff = daysAgo(t);
  if (diff === 0) return fmtTime(t);
  if (diff === 1) return "Yesterday";
  return when(t).toLocaleDateString([], { month: "short", day: "numeric" });
}
export function ago(t) {
  if (!t) return "";
  const s = Math.max(0, Date.now() / 1000 - t);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}
// how long something has been going: "45s", "12m", "2h 5m", "3d"
export function span(seconds) {
  const s = Math.max(0, seconds || 0);
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) { const m = Math.round((s % 3600) / 60); return `${Math.floor(s / 3600)}h${m ? ` ${m}m` : ""}`; }
  return `${Math.round(s / 86400)}d`;
}
export const pct = (x) => (x === null || x === undefined) ? "—" : `${Math.round(x * 100)}%`;
export const plural = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`;
