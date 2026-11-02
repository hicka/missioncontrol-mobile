// One picture of the harness for every screen: the agent, what each of its
// tasks is doing, what waits on the owner, and what has reached it. Everything
// is a projection of server state; live events only decide when to look again,
// and a quiet poll keeps ages and counts honest when the socket is down.
import { useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { api } from "./api";
import * as live from "./live";

const EMPTY_CONTROL = { agents: {}, missions: [], executions: [], watches: [], skills: [], activity: [],
                        counts: {}, inbox: [], evolution: {}, jobs: [], workers: [] };

let S = {
  state: null,            // /api/state: user, agents (roster order), threads
  control: EMPTY_CONTROL, // /api/control
  kernel: null,           // /api/kernel: the Router, its Workers, events, rules, findings
  kernelError: "",        // why it could not be read
  loaded: false,
  seen: 0,                // when the server last answered, for saying how old the picture is
  online: null,           // null until the first answer
  error: "",
  status: {},             // agent id -> idle | thinking | doing
  tool: {},               // agent id -> the tool it is running
  unread: {},             // thread id -> true
  typing: {},             // "agent|thread" -> true
  stream: {},             // thread id -> the reply as it is being written
  evolution: 0,           // bumps when lessons or the scorecard change
  current: null,          // the thread on screen, which is never unread
};
const listeners = new Set();
const set = (patch) => { S = { ...S, ...patch }; for (const fn of listeners) fn(); };
const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export function useStore(select) {
  return useSyncExternalStore(subscribe, () => select(S));
}
export const get = () => S;

export const agentsById = (state) => Object.fromEntries((state?.agents || []).map((a) => [a.id, a]));
export const lead = (state) => (state?.agents || [])[0] || null;
export const leadThread = (state) => { const a = lead(state); return a ? `dm:${a.id}` : null; };

/* ---------- loading ---------- */
let busyState = null, againState = false;
export async function refreshState() {
  if (busyState) { againState = true; return busyState; }
  busyState = (async () => {
    try {
      const state = await api.state();
      // whether the server is really answering is for the fuller call to say: this one alone can succeed
      set({ state, seen: Date.now() / 1000, ...(S.online === null ? { online: true } : null) });
      return true;
    } catch (e) {
      set({ online: false, error: String(e.message || e) });
      return false;
    } finally {
      busyState = null;
      if (againState) { againState = false; soon("state", refreshState, 250); }
    }
  })();
  return busyState;
}

let busyControl = null, againControl = false;
export async function refreshControl() {
  if (busyControl) { againControl = true; return busyControl; }
  busyControl = (async () => {
    try {
      const control = { ...EMPTY_CONTROL, ...(await api.control()) };
      const status = {}, tool = {};
      for (const [aid, v] of Object.entries(control.agents || {})) {
        status[aid] = v.state || "idle";
        if (v.tool) tool[aid] = v.tool;
      }
      set({ control, status, tool, loaded: true, online: true, error: "", seen: Date.now() / 1000 });
      return true;
    } catch (e) {
      set({ online: false, error: String(e.message || e) });
      return false;
    } finally {
      busyControl = null;
      if (againControl) { againControl = false; soon("control", refreshControl, 450); }
    }
  })();
  return busyControl;
}

let busyKernel = null, againKernel = false;
export async function refreshKernel() {
  if (busyKernel) { againKernel = true; return busyKernel; }
  busyKernel = (async () => {
    try {
      set({ kernel: await api.kernel(), kernelError: "" });
      return true;
    } catch (e) {
      set({ kernelError: String(e.message || e) });
      return false;
    } finally {
      busyKernel = null;
      if (againKernel) { againKernel = false; soon("kernel", refreshKernel, 700); }
    }
  })();
  return busyKernel;
}

export const refresh = () => Promise.all([refreshState(), refreshControl(), refreshKernel()]).then(([a, b]) => a && b);

const timers = {};
function soon(key, fn, ms) {
  clearTimeout(timers[key]);
  timers[key] = setTimeout(fn, ms);
}

/* ---------- live events ---------- */
const CONTROL_EVENTS = new Set(["mission_updated", "watch_updated", "memory_updated", "skills_updated",
  "agent_added", "agent_updated", "agent_removed", "cron_updated", "approvals_updated",
  "improvements_updated", "browser_auth_updated", "evolution_updated", "session_updated"]);
const KERNEL_EVENTS = new Set(["session_updated", "mission_updated", "kernel_updated", "trigger", "watchdog", "approvals_updated", "runtime_updated"]);

function setStream(thread, text) {
  const stream = { ...S.stream };
  if (text) stream[thread] = text; else delete stream[thread];
  set({ stream });
}

function onEvent(ev) {
  if (ev.type === "link") {
    // whatever was being written, its end may have gone by while the socket was down
    set({ typing: {}, stream: {} });
    if (ev.on) refresh();
    return;
  }
  if (ev.type === "message") {
    const m = ev.msg || {};
    const threads = S.state?.threads || [];
    const unread = { ...S.unread };
    if (m.thread && !m.thread.startsWith("a2a:")) {
      if (m.thread !== S.current && m.sender !== "user" && threads.some((t) => t.id === m.thread)) unread[m.thread] = true;
    } else if (m.kind === "a2a") {
      const here = S.current && (S.current === `dm:${m.sender}` || S.current === `dm:${m.meta?.to}`);
      if (!here) unread[`dm:${m.sender}`] = true;
    }
    // the preview updates at once; the rest of the roster follows shortly
    const next = threads.map((t) => (t.id === m.thread || (m.kind === "a2a" &&
      (t.id === `dm:${m.sender}` || t.id === `dm:${m.meta?.to}`))) ? { ...t, last: m } : t);
    set({ unread, state: S.state ? { ...S.state, threads: next } : S.state });
    // what was being written has arrived
    if (m.sender !== "user") {
      if (S.stream[m.thread]) setStream(m.thread);
      const key = `${m.sender}|${m.thread}`;
      if (S.typing[key]) set({ typing: { ...S.typing, [key]: false } });
    }
    return;
  }
  if (ev.type === "stream") {
    if (!ev.thread) return;
    if (ev.reset) setStream(ev.thread);
    else if (ev.text) setStream(ev.thread, (S.stream[ev.thread] || "") + ev.text);
    return;
  }
  if (ev.type === "typing") {
    set({ typing: { ...S.typing, [`${ev.agent}|${ev.thread}`]: !!ev.on } });
    if (!ev.on && S.stream[ev.thread]) setStream(ev.thread);
    return;
  }
  if (ev.type === "agent_state") {
    const status = { ...S.status, [ev.agent]: ev.state };
    const tool = { ...S.tool };
    if (ev.state === "idle") delete tool[ev.agent];
    const agents = { ...(S.control.agents || {}) };
    agents[ev.agent] = { ...(agents[ev.agent] || {}), state: ev.state };
    set({ status, tool, control: { ...S.control, agents } });
    return;
  }
  if (ev.type === "execution") {
    const e = ev.execution;
    if (!e) return;
    const list = [...(S.control.executions || [])];
    const i = list.findIndex((x) => x.id === e.id);
    if (i >= 0) list[i] = e; else list.unshift(e);
    const tool = { ...S.tool };
    if (e.kind === "tool") {
      if (e.status === "running") tool[e.agent] = e.name;
      else if (tool[e.agent] === e.name) delete tool[e.agent];
    }
    set({ tool, control: { ...S.control, executions: list.slice(0, 120) } });
    return;
  }
  if (ev.type === "user") {
    if (S.state) set({ state: { ...S.state, user: ev.user } });
    return;
  }
  if (KERNEL_EVENTS.has(ev.type)) soon("kernel", refreshKernel, 700);
  if (CONTROL_EVENTS.has(ev.type)) {
    soon("control", refreshControl, 450);
    if (ev.type.startsWith("agent_")) soon("state", refreshState, 300);
    if (ev.type === "evolution_updated") set({ evolution: S.evolution + 1 });
  }
}

export function setCurrent(threadId) {
  const unread = { ...S.unread };
  if (threadId) delete unread[threadId];
  set({ current: threadId, unread });
}

export function forget() {
  set({ state: null, control: EMPTY_CONTROL, kernel: null, kernelError: "", loaded: false, online: null, seen: 0, status: {}, tool: {},
        unread: {}, stream: {}, typing: {} });
}

/* ---------- lifecycle ---------- */
let started = false;
export function start() {
  if (started) return;
  started = true;
  live.subscribe(onEvent);
  let tick = 0;
  setInterval(() => {
    if (AppState.currentState !== "active" || !S.state) return;
    tick += 1;
    // the socket carries changes, so this only keeps ages honest; without it, look
    // more often. Each look is a few hundred kilobytes, which adds up on a phone plan.
    if (tick % (live.connected() ? 12 : 3) === 0) refresh();
  }, 5000);
  AppState.addEventListener("change", (s) => { if (s === "active" && S.state) refresh(); });
}
