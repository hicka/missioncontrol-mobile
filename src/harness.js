// What the harness says is going on, in words the owner can act on. To them
// there is one agent; each task is a Worker, one of its hands. Nothing here
// decides anything: it reads the server's own record of each session, so a
// screen shows what is really happening rather than what anyone said about it.
// No imports, so it can be checked on its own.

// The server marks a task whose Worker stopped without saying it had finished.
export const NOT_CONFIRMED = "[It ended without confirming this is finished.";
// Written into a transcript by the server, not by the Worker.
const NOT_WORDS = /^\s*(\(That report (ended this turn|left the task open[^)]*)\.?\)|no[_ ]?reply)\s*$/i;

export const ACTIVE = ["queued", "working", "waiting", "blocked", "stalled", "failed"];

// A claim the server could not check against what the Worker's tools showed.
const UNVERIFIED = "[unverified:";
// It can sit behind an unverified note, so the whole opening is read, not just the first line.
export const unconfirmedText = (text) => {
  const head = String(text || "").slice(0, 500);
  return head.includes(NOT_CONFIRMED) || head.startsWith(UNVERIFIED);
};
export const notConfirmed = (w) => unconfirmedText(w?.summary);
// The server's marker taken out, leaving what the Worker last said.
export function withoutMarker(text) {
  return String(text || "").replace(/^\[It ended without confirming this is finished\.[^\n]*\n*/m, "").trim();
}
export const isRoutine = (w) => w?.meta?.source === "heartbeat" || /^heartbeat pulse\b/i.test(w?.title || "");

export function taskTitle(w) {
  if (isRoutine(w)) return "Heartbeat";
  const t = String(w?.title || "").replace(/^TASK [0-9a-f]+:\s*/i, "").trim();
  return t || (w?.direct ? "Direct line" : "Task");
}

// A word and a tone for where a Worker stands. Once it is no longer running, its
// status only says that much, so anything more has to come from the record: the
// task's result and, where it is known, its last report. Without that it says
// only "Idle" or "Ended", and never that the work is finished.
export function workerState(w, mission, lastReport) {
  switch (w?.status) {
    case "working": return { key: "working", label: "Working", tone: "good", live: true };
    case "queued": return { key: "queued", label: "Queued", tone: "info" };
    case "waiting": return { key: "waiting", label: "Waiting", tone: "info" };
    case "blocked": return w.question ? { key: "needs", label: "Needs you", tone: "signal" }
      : { key: "blocked", label: "Blocked", tone: "warn" };
    case "stalled": return { key: "stalled", label: "Stalled", tone: "danger" };
    case "failed": return { key: "failed", label: "Failed", tone: "danger" };
    default: break;
  }
  const quiet = { key: "ended", label: w?.status === "idle" ? "Idle" : "Ended", tone: "" };
  // the short list of Workers has no summary, so it cannot tell what became of them
  if (w?.summary === undefined) return quiet;
  const unconfirmed = { key: "unconfirmed", label: "Not confirmed", tone: "warn" };
  const last = lastReport?.status;
  if (notConfirmed(w) || unconfirmedText(lastReport?.summary)) return unconfirmed;
  if (last === "failed" || mission?.status === "failed") return { key: "failed", label: "Failed", tone: "danger" };
  if (/^Stopped by owner/i.test(w.summary) || mission?.status === "cancelled") return { key: "stopped", label: "Stopped", tone: "" };
  if (last === "dropped") return { key: "dropped", label: "Dropped", tone: "" };
  if (last === "handback") return { key: "handback", label: "Handed back", tone: "" };
  // its last word said it was still going, and then it stopped
  if (last === "progress" || last === "waiting") return unconfirmed;
  if (mission?.status === "completed") return { key: "done", label: "Finished", tone: "" };
  return quiet;
}

// Everything the first screen draws, in the order the owner should read it. A
// question from a Worker is left out: it is already in the Inbox items above.
export function groupWorkers(sessions, now = Date.now() / 1000) {
  const groups = { running: [], stuck: [], waiting: [], recent: [] };
  const day = now - 86400;
  for (const w of sessions || []) {
    if (["working", "queued"].includes(w.status)) groups.running.push(w);
    else if (["stalled", "failed"].includes(w.status)) groups.stuck.push(w);
    else if (w.status === "blocked" && w.question) continue;
    else if (["waiting", "blocked"].includes(w.status)) groups.waiting.push(w);
    else if (!isRoutine(w) && !w.direct && (w.updated || 0) >= day) groups.recent.push(w);
  }
  const newest = (a, b) => (b.updated || 0) - (a.updated || 0);
  for (const g of Object.values(groups)) g.sort(newest);
  return groups;
}

// Whose say-so it is working on, for as long as it is working. A finished Worker
// always drops to inferred, which says nothing about who asked for it.
export function authority(w) {
  if (!w || !ACTIVE.includes(w.status)) return null;
  if (w.speculative) return { label: "Acting ahead", note: "It started this itself, and nobody is waiting on it. Outward commands wait for you." };
  if (w.direct) return { label: "Direct line", note: "You are talking to this role directly, with no Router in between." };
  if (w.strength === "explicit") return { label: "You asked", note: "It works on your word until this is finished." };
  if (w.strength === "standing") return { label: "Standing job", note: "Something you set up. Outward commands and your secrets wait for you." };
  return { label: "From an event", note: "Nobody asked for this directly. Outward commands wait for you, and it runs without your keys." };
}

// The Router's own state is not reported apart from other work running under the
// lead's profile, so "Busy" is as much as this can honestly say.
export function presence(kernel, online) {
  if (online === false) return { word: "Out of reach", tone: "danger", busy: false };
  if (!kernel) return { word: "Checking", tone: "", busy: false };
  if (!kernel.router?.alive) return { word: "Stopped", tone: "danger", busy: false };
  if (kernel.paused) return { word: "Paused", tone: "warn", busy: false };
  const busy = (kernel.router.state || "idle") !== "idle";
  return { word: busy ? "Busy" : "Listening", tone: "good", busy };
}

// One plain sentence about what the hands are doing. A task waiting on a background
// job holds no place but may be doing plenty, so "nothing running" has to mean all of it.
export function handsLine(groups, slots) {
  const count = (list, status) => list.filter((w) => w.status === status).length;
  const working = count(groups.running, "working");
  const queued = count(groups.running, "queued");
  const parts = [];
  if (working) {
    const free = slots ? slots.limit - slots.used : null;
    parts.push(`${working === 1 ? "1 task" : `${working} tasks`} working${free === null ? "" : free > 0 ? `, room for ${free} more` : ", no room for more"}`);
  }
  if (queued) parts.push(`${queued} queued`);
  if (groups.waiting.length) parts.push(`${groups.waiting.length} waiting`);
  if (groups.stuck.length) parts.push(`${groups.stuck.length} stuck`);
  return parts.length ? `${parts.join(". ")}.` : "Nothing running.";
}

/* ---------- the bar ---------- */

// One line for what is happening now, and the orb's mood, as the Mac's floating bar
// says it. What needs the owner comes before what is merely going on, and "Ask
// anything" never shows over open work.
export function barStatus({ online, lead, stream, inbox, status, tool, workers, name }) {
  if (online === false) return { mood: "offline", title: "Out of reach", detail: "Your Mac is not answering." };
  if (online === null || online === undefined) return { mood: "offline", title: "Connecting…", detail: "" };
  if (stream) return { mood: "streaming", title: "", detail: stream };
  if (inbox?.length) {
    return { mood: "attention", title: inbox.length === 1 ? "1 thing needs you" : `${inbox.length} things need you`,
             detail: waitingKinds(inbox), needs: true };
  }
  const st = lead ? status?.[lead.id] || "idle" : "idle";
  if (st !== "idle") {
    const t = tool?.[lead.id];
    if (t) return { mood: "working", title: t.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()), detail: `${name} is working` };
    return { mood: "thinking", title: "Thinking…", detail: "" };
  }
  const working = (workers || []).filter((w) => w.status === "working" && !w.direct);
  // a task waiting on a build, a watch or a reply is open work too
  const waiting = (workers || []).filter((w) => ["waiting", "blocked"].includes(w.status) && !w.direct);
  if (working.length) {
    const also = waiting.length ? ` · ${waiting.length} waiting` : "";
    return { mood: "working", title: working.length === 1 ? clip(taskTitle(working[0]), 60) : `${working.length} tasks running`,
             detail: (working.length === 1 ? "Working" : clip(taskTitle(working[0]), 60)) + also };
  }
  if (waiting.length) {
    return { mood: "waiting", title: waiting.length === 1 ? clip(taskTitle(waiting[0]), 60) : `${waiting.length} tasks waiting`,
             detail: waiting.length === 1 ? "Waiting" : clip(taskTitle(waiting[0]), 60) };
  }
  return { mood: "idle", title: "Ask anything", detail: `${name} is listening.` };
}

const KIND_WORDS = { question: ["a question", "questions"], command: ["a held command", "held commands"],
  tool: ["a held tool call", "held tool calls"], job: ["a job to start", "jobs to start"],
  proposal: ["a proposed change", "proposed changes"], signin: ["a sign-in", "sign-ins"], lesson: ["a lesson", "lessons"] };

// "A held command and a question": what kinds of thing are waiting, in words.
export function waitingKinds(inbox) {
  const counts = {};
  for (const i of inbox || []) counts[i.kind] = (counts[i.kind] || 0) + 1;
  const parts = Object.entries(counts).map(([k, n]) => {
    const w = KIND_WORDS[k] || [`a ${k}`, `${k}s`];
    return n === 1 ? w[0] : `${n} ${w[1]}`;
  });
  const text = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0] || "";
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}

// The end of a reply still being written, in a couple of lines, with no markdown showing through.
export function plainTail(text, n = 160) {
  const line = oneLine(String(text || "").split("\n").filter((l) => !l.trim().startsWith("```"))
    .map((l) => l.replace(/^\s*[-*] /, "")).join(" · ")).replace(/\*\*|`|^#+ /g, "");
  return line.length > n ? "…" + line.slice(-n) : line;
}

// A reply's opening lines, kept as lines, for reading at a glance. Code stays in the chat.
export function peekSummary(text, n = 420) {
  const lines = [];
  let fenced = false;
  for (const raw of String(text || "").split("\n")) {
    const t = raw.trim();
    if (t.startsWith("```")) { fenced = !fenced; continue; }
    if (fenced || !t || /^\|?\s*-{3,}/.test(t)) continue;
    lines.push((t.startsWith("- ") || t.startsWith("* ") ? "• " + t.slice(2) : t).replace(/\*\*|`/g, "").replace(/^#+ /, ""));
  }
  return lines.join("\n").slice(0, n);
}

/* ---------- activity ---------- */

export const EVENT_GROUPS = {
  all: { label: "All", test: () => true },
  acted: { label: "Acted on", test: (e) => ["routed", "passed", "answered"].includes(e.disposition) },
  quiet: { label: "Left alone", test: (e) => ["ignored", "read", "logged", "refused"].includes(e.disposition) },
  waiting: { label: "Waiting", test: (e) => ["new", "queued"].includes(e.disposition) },
};

// "read" on the owner's own message means it was read and no reply went out.
export const dispositionOf = (e) => (e.from_owner && e.disposition === "read"
  ? { label: "No reply", tone: "warn" } : DISPOSITION[e.disposition] || { label: e.disposition, tone: "" });

export const DISPOSITION = {
  routed: { label: "Decided", tone: "good" },
  passed: { label: "To a task", tone: "good" },
  answered: { label: "Answered", tone: "good" },
  read: { label: "Read", tone: "" },
  ignored: { label: "Ignored", tone: "" },
  logged: { label: "Logged", tone: "" },
  refused: { label: "Refused", tone: "danger" },
  new: { label: "Waiting", tone: "info" },
  queued: { label: "Waiting", tone: "info" },
};

const SOURCES = { gui: "This app", imessage: "iMessage", telegram: "Telegram", whatsapp: "WhatsApp", email: "Email",
  github: "GitHub", hook: "Webhook", cron: "Schedule", heartbeat: "Heartbeat", brief: "Daily brief", watch: "Watch",
  fleet: "Another machine", worker: "A task", approval: "An approval", whatsapp_link: "Your WhatsApp" };
const SOURCE_ICONS = { github: "branch", hook: "bolt", cron: "clock", heartbeat: "clock", brief: "clock", watch: "clock",
  imessage: "chat", telegram: "chat", whatsapp: "chat", email: "chat", gui: "chat", worker: "tasks", fleet: "globe",
  approval: "shield", whatsapp_link: "chat" };

export const sourceOf = (s) => String(s || "").split(":")[0];
export const sourceLabel = (s) => SOURCES[sourceOf(s)] || sourceOf(s) || "Unknown";
export const sourceIcon = (s) => SOURCE_ICONS[sourceOf(s)] || "bolt";
export const oneLine = (s) => String(s || "").replace(/\s+/g, " ").trim();
export const clip = (s, n) => { const t = oneLine(s); return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t; };

export const VERDICTS = { stranded: "Went quiet with something owed", drifted: "Drifted from its task", looping: "Going in circles",
  not_running: "Should be running and is not", stalled: "Stalled" };
export const verdictLabel = (v) => VERDICTS[v] || String(v || "").replace(/_/g, " ");

/* ---------- a Worker's transcript ---------- */

function resultText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((c) => (c.type === "text" ? c.text : `[${c.type}]`)).join("\n");
  return content === undefined || content === null ? "" : JSON.stringify(content);
}

export function callLine(name, input) {
  const a = input || {};
  if (name === "terminal") return `$ ${oneLine(a.command)}`;
  const main = a.command || a.url || a.query || a.path || a.action || a.text || a.name || a.summary || "";
  return oneLine(main || JSON.stringify(a));
}

// What a message says once the time stamp and the state of the world the server
// adds to every batch are taken off.
function heardText(text) {
  return String(text || "").replace(/^\s*\[[A-Z][a-z]{2} \d{1,2}:\d{2}\]\s*/, "")
    .split(/\n?\s*CURRENT STATE \(as of/)[0].trim();
}

// The transcript as steps, oldest first: each tool call with its result, reports
// on their own, what it said, and what reached it.
export function stepsOf(rows) {
  const steps = [];
  const calls = {};
  for (const row of rows || []) {
    const blocks = Array.isArray(row.content) ? row.content : [{ type: "text", text: row.content }];
    for (const b of blocks) {
      if (b.type === "tool_use") {
        if (b.name === "report") {
          steps.push({ kind: "report", key: b.id, ts: row.ts, status: b.input?.status || "",
                       text: b.input?.summary || "", question: b.input?.question || "" });
          continue;
        }
        const step = { kind: "call", key: b.id, ts: row.ts, name: b.name, line: callLine(b.name, b.input), result: null, error: false };
        calls[b.id] = step;
        steps.push(step);
      } else if (b.type === "tool_result") {
        const step = calls[b.tool_use_id];
        if (step) { step.result = resultText(b.content); step.error = !!b.is_error; }
      } else if (b.type === "text") {
        const text = String(b.text || "");
        if (!text.trim() || NOT_WORDS.test(text)) continue;
        if (row.role === "assistant") steps.push({ kind: "said", key: `s${row.id}`, ts: row.ts, text });
        else {
          const heard = heardText(text);
          if (heard) steps.push({ kind: "heard", key: `h${row.id}`, ts: row.ts, text: heard });
        }
      }
    }
  }
  return steps;
}

/* ---------- where a tapped notification goes ---------- */

export function routeForPush(thread, leadThread) {
  const id = String(thread || "");
  if (id.startsWith("task:")) return { to: "task", mission: id.slice(5) };
  if (!id || id === "group:team" || id === leadThread) return { to: "chat" };
  if (id.startsWith("dm:")) return { to: "direct", thread: id };
  return { to: "now" };
}

/* ---------- work as it is done ---------- */

// One step of a task: a tool call, in the words the agent gave it. Read from the
// server's list of steps or from a live execution record, which share most of a shape.
export function workStep(row) {
  const ts = Number(row?.ts) || 0;
  const seconds = typeof row?.seconds === "number" ? row.seconds : Math.max(0, (Number(row?.updated) || ts) - ts);
  return { id: String(row?.id ?? ""), label: String(row?.label || ""), status: String(row?.status || ""),
           tool: String(row?.tool || row?.name || ""), ts, seconds };
}

// A task a conversation started, as the server's /api/work describes it.
export function workTask(row) {
  const checks = Array.isArray(row?.checks) ? row.checks : [];
  const waiting = row?.waiting_on || {};
  return {
    id: String(row?.id ?? ""), thread: String(row?.thread || ""), session: String(row?.session || ""),
    title: String(row?.title || "Task"), agent: String(row?.agent || ""), agentName: String(row?.agent_name || row?.agent || ""),
    phase: String(row?.phase || "done"), outcome: String(row?.outcome || ""),
    waitingKind: String(waiting.kind || ""), waitingText: String(waiting.text || ""), approval: waiting.approval || null,
    started: Number(row?.started) || 0, updated: Number(row?.updated) || 0,
    steps: (Array.isArray(row?.steps) ? row.steps : []).map(workStep),
    checksTotal: checks.length, checksDone: checks.filter((c) => c && c.done && c.how).length,
    summary: String(row?.summary || ""), live: !!row?.live,
  };
}

// The same picture from a server that has no /api/work yet: its sessions, and the
// tool calls it listed for each, under the tool's own name.
const SESSION_PHASE = { queued: "queued", waiting: "waiting", stalled: "waiting", blocked: "needs_you" };
export function workFromSessions(sessions, executions, agents) {
  const out = [];
  for (const w of sessions || []) {
    if (!w.mission || w.direct || w.speculative || isRoutine(w)) continue;
    const steps = (executions || []).filter((e) => e.kind === "tool" && e.mission === w.mission)
      .sort((a, b) => (a.ts || 0) - (b.ts || 0))
      .map((e) => workStep({ ...e, label: e.label || plainStep(e) }));
    const live = ["queued", "working", "waiting", "stalled", "blocked"].includes(w.status);
    const running = steps.length && steps[steps.length - 1].status === "running";
    const phase = w.status === "working" ? (running ? "working" : "thinking") : SESSION_PHASE[w.status] || "done";
    out.push(workTask({
      id: w.mission, session: w.id, thread: w.conversation || "", title: taskTitle(w), agent: w.profile,
      agent_name: agents?.[w.profile]?.name || w.profile, phase,
      outcome: phase === "done" ? (w.status === "failed" ? "failed" : "finished") : "",
      waiting_on: w.status === "blocked" ? { kind: "you", text: w.question || "It has a question for you." }
        : w.status === "stalled" ? { kind: "provider", text: "The model provider is not answering" } : null,
      started: w.created, updated: w.updated, steps, checks: w.meta?.finish_line, summary: w.summary, live,
    }));
  }
  return out.sort((a, b) => a.started - b.started);
}

// A tool call in a line, from what it was given: its own note, else the command or question, else its name.
function plainStep(e) {
  let args = e?.detail?.arguments;
  if (typeof args === "string") { try { args = JSON.parse(args); } catch { args = {}; } }
  const said = clip(args?.note || args?.command || args?.task || args?.query || args?.url || "", 90);
  const name = String(e?.name || "").replace(/_/g, " ");
  return said || (name ? name[0].toUpperCase() + name.slice(1) : "A step");
}

// What a task is doing this moment, as a person would say it.
export function phaseLine(task) {
  const last = task.steps[task.steps.length - 1];
  switch (task.phase) {
    case "thinking": return "Thinking";
    case "working": return last && last.status === "running" && last.label ? last.label : "Working";
    case "fixing": return last ? `Fixing · ${last.label}` : "Fixing";
    case "queued": return "Waiting for a free place";
    case "needs_you": return "Needs you";
    case "waiting":
      switch (task.waitingKind) {
        case "job": return `Running · ${task.waitingText}`;
        case "watch": return `Watching · ${task.waitingText}`;
        case "thread": return `Waiting on ${task.waitingText}`;
        case "provider": return task.waitingText || "Waiting";
        default: return "Waiting";
      }
    default:
      return task.outcome === "failed" ? "Could not finish" : task.outcome === "stopped" ? "Stopped" : "Finished";
  }
}

export const shortSpan = (seconds) => (seconds < 90 ? `${Math.round(seconds)}s` : `${Math.round(seconds / 60)}m`);
export const took = (task) => shortSpan(Math.max(0, task.updated - task.started));

// A step arriving over the socket, folded into its task: the step is added or
// replaced, and the phase follows it until the server's own reading comes in.
// Returns the same task when the record is not a step the owner follows.
export function stepInto(task, record, now = Date.now() / 1000) {
  if (!record || record.quiet || !record.label) return task;
  const step = workStep(record);
  const steps = [...task.steps];
  const i = steps.findIndex((s) => s.id === step.id);
  if (i >= 0) steps[i] = step; else steps.push(step);
  let phase = task.phase;
  if (step.status === "running") {
    const before = steps.slice(0, -1).filter((s) => s.tool !== "report").pop();
    phase = before && before.status === "failed" ? "fixing" : "working";
  } else if (phase === "working" || phase === "fixing") {
    phase = "thinking";
  }
  return { ...task, steps, phase, updated: now };
}

// How a profile is, which its presence shows: what its tasks are doing, then what
// it is doing itself, then how its last task ended, for a moment.
export const MOODS = ["idle", "thinking", "working", "fixing", "waiting", "needsYou", "happy", "sad", "offline"];
export const MOOD_WORDS = { idle: "At rest", thinking: "Thinking", working: "Working", fixing: "Fixing something",
  waiting: "Waiting", needsYou: "Needs you", happy: "Finished", sad: "Could not finish", offline: "Not connected" };
const ENDED_SHOWS = 8;

export function mood({ agent, work, status, online, ended, now = Date.now() / 1000 }) {
  if (online === false) return "offline";
  const tasks = (work || []).filter((t) => t.live && t.agent === agent);
  const any = (...phases) => tasks.some((t) => phases.includes(t.phase));
  if (any("needs_you")) return "needsYou";
  if (any("fixing")) return "fixing";
  if (any("working")) return "working";
  if (any("thinking")) return "thinking";
  const st = status?.[agent] || "idle";
  if (st === "thinking") return "thinking";
  if (st === "doing") return "working";
  if (any("waiting", "queued")) return "waiting";
  const last = ended?.[agent];
  if (last && now - last.at < ENDED_SHOWS) return last.ok ? "happy" : "sad";
  return "idle";
}

// What a profile is on right now, in words; its role when it is on nothing.
export function doing({ agent, work, status, tool, role }) {
  const task = (work || []).find((t) => t.live && t.agent === agent);
  if (task) return phaseLine(task);
  const st = status?.[agent] || "idle";
  if (st === "thinking") return "Thinking";
  if (st === "doing") {
    const t = tool?.[agent];
    return t ? t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Working";
  }
  return role || "";
}

// The lead's own line: thinking, or who it is waiting on.
export function leadLine({ lead, work, status, online }) {
  if (!lead) return "";
  if (online === false) return "Reconnecting…";
  const st = status?.[lead.id] || "idle";
  if (st === "thinking") return "Thinking…";
  if (st === "doing") return "Working…";
  const live = (work || []).filter((t) => t.live);
  const needs = live.find((t) => t.phase === "needs_you");
  if (needs) return `${needs.agentName} needs you`;
  const names = [...new Set(live.map((t) => t.agentName))].sort();
  if (names.length) return `Waiting on ${names.slice(0, 2).join(" and ")}${names.length > 2 ? " and others" : ""}`;
  return "Ready";
}

// "Atlas has a question": what one thing waiting on the owner is, in a line.
export function needLine(item, who) {
  switch (item?.kind) {
    case "question": return `${who} has a question`;
    case "command": case "tool": return `${who} needs your OK`;
    case "job": return `${who} wants to schedule a job`;
    case "proposal": return `${who} proposes a change`;
    case "signin": return "A sign-in is needed";
    case "lesson": return `${who} learned something`;
    default: return `${who} is waiting on you`;
  }
}

export function greeting(name, hour = new Date().getHours()) {
  const part = hour < 5 ? "Working late" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const first = String(name || "").trim().split(/\s+/)[0] || "";
  return first && first !== "You" ? `${part}, ${first}` : part;
}

// Where each task belongs among a thread's messages: the tasks that began on this
// page of the conversation, each before the first message that came after it began.
export function workBetween(tasks, firstTs) {
  return (tasks || []).filter((t) => t.started >= (firstTs || 0) - 5).sort((a, b) => a.started - b.started);
}
