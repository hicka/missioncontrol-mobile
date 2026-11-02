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
