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
  if (!data) data = shifted();
  return data;
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
