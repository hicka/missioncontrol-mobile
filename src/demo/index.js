// Sample data, for looking around without a Mac: Atlas and its hands on a working
// morning at a small shop. Everything is read from a fixed record captured from a
// real server, moved forward in time so it always reads as just now. Nothing can
// be changed: anything that would act says so instead of pretending.
import fixture from "./fixture.json";

export const DEMO_URL = "demo";
export const SAMPLE = "This is sample data, so nothing ran. Connect your own Mac in Settings to do this.";

let data = null;

// every time stamp in the record moves forward by how long ago it was captured
function shifted() {
  const by = Date.now() / 1000 - fixture.captured;
  const walk = (v) => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    if (typeof v === "number" && v > 1.6e9 && v < 2.2e9) return v + by;
    return v;
  };
  return walk(fixture);
}

function record() {
  if (!data) {
    data = shifted();
    data["/api/work"] = work(data);
  }
  return data;
}

// The record was captured before the server described work step by step, so each of
// the sample team's tasks gets its steps here, in the shape /api/work gives them.
const STEPS = {
  "Fix the checkout rounding bug": [["Read the report from the shop", "completed", 6], ["Find where the total is worked out", "completed", 19],
    ["Run the checkout tests", "failed", 11], ["Round once, at the order total", "completed", 24], ["Run the checkout tests again", "running", 0]],
  "Run the full test suite": [["Run the unit tests", "completed", 192], ["Run the end-to-end tests on staging", "running", 0]],
  "Draft the 2.4 release notes": [["List every change since 2.3", "completed", 38], ["Group the changes by area", "completed", 21],
    ["Asked a question", "completed", 1, "report"]],
  "Watch the staging deploy": [["Start the deploy to staging", "completed", 14]],
  "Ship the invoice fix": [["Check three invoices on staging", "completed", 47], ["Merge the pull request", "completed", 9],
    ["Wait for the deploy to go green", "completed", 164]],
  "Update the onboarding guide": [["Read the current guide", "completed", 12], ["Rewrite the first-run section", "completed", 88]],
};
const PHASE = { working: "working", queued: "queued", waiting: "waiting", stalled: "waiting", blocked: "needs_you" };

function work(d) {
  const agents = d["/api/state"]?.agents || [];
  const lead = agents[0]?.id || "lead";
  const now = Date.now() / 1000;
  const tasks = (d["/api/kernel"]?.sessions || []).filter((w) => w.mission && !w.direct).map((w) => {
    const phase = PHASE[w.status] || "done";
    const live = phase !== "done";
    const rows = STEPS[w.title] || [];
    // the steps of a task under way end now; those of a finished one ended when it did
    let at = (live ? now : w.updated) - rows.reduce((n, r) => n + r[2] + 4, 0) - (live ? 6 : 0);
    const steps = rows.map(([label, status, seconds, tool], i) => {
      const step = { id: `${w.id}-${i}`, ts: at, agent: w.profile, tool: tool || "terminal", label, status, seconds };
      at += seconds + 4;
      return step;
    });
    return {
      id: w.mission, session: w.id, thread: `dm:${lead}`, title: w.title, agent: w.profile,
      agent_name: agents.find((a) => a.id === w.profile)?.name || w.profile, others: [],
      phase, outcome: live ? "" : "finished", status: w.status,
      waiting_on: w.status === "blocked" ? { kind: "you", text: w.question || "It has a question for you." }
        : w.status === "waiting" ? { kind: "watch", text: "the staging deploy" } : null,
      started: w.created, updated: live ? now - 2 : w.updated, live, summary: "",
      checks: w.meta?.finish_line || [], steps,
    };
  });
  return { tasks: tasks.sort((a, b) => a.started - b.started) };
}

const THREAD = "/api/thread/";

function lookup(path) {
  const d = record();
  const [bare, query = ""] = path.split("?");
  const key = decodeURIComponent(bare);
  if (key.startsWith(THREAD)) {
    // an older page: the sample conversation is all on one
    if (query.includes("before_ts")) return { messages: [], has_more: false };
    return d[key] || { messages: [], has_more: false };
  }
  if (key === "/api/memory" || key === "/api/search") return d[`${key}?${key === "/api/memory" ? "q=" : "q=checkout"}`] || {};
  return d[key];
}

// the agent answers, once, that it is not really there
function reply(thread, text) {
  const d = record();
  const t = d[THREAD + thread] || (d[THREAD + thread] = { messages: [], has_more: false });
  const next = () => Math.max(0, ...t.messages.map((m) => m.id)) + 1;
  const now = Date.now() / 1000;
  t.messages = [...t.messages, { id: next(), ts: now, thread, sender: "user", kind: "chat", text, meta: {} }];
  const agent = thread.startsWith("dm:") ? thread.slice(3) : "chief";
  setTimeout(() => {
    t.messages = [...t.messages, { id: next(), ts: Date.now() / 1000, thread, sender: agent, kind: "chat", meta: {},
      text: "This is sample data, so I can't act on that. Connect this phone to the Mission Control on your Mac, in Settings, and I'll get on with it." }];
  }, 1400);
}

export async function answer(method, path, body) {
  await new Promise((r) => setTimeout(r, 120));
  if (method === "GET") {
    const found = lookup(path);
    if (found === undefined) return {};
    return JSON.parse(JSON.stringify(found));
  }
  if (path === "/api/send" && body?.thread && (body.text || "").trim()) {
    reply(body.thread, body.text.trim());
    return { ok: true };
  }
  return { ok: false, error: SAMPLE };
}

export function forget() { data = null; }
