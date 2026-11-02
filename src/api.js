// Small client for any Mission Control server: base URL + bearer token.
let base = "";
let token = "";

export function configure(url, tok) {
  base = (url || "").trim().replace(/\/+$/, "");
  if (base && !/^https?:\/\//.test(base)) base = "http://" + base;
  token = (tok || "").trim();
}

export function baseUrl() {
  return base;
}

export function authHeaders() {
  return token ? { Authorization: "Bearer " + token } : {};
}

// Links handed to Safari or an <Image> cannot carry a header; the server
// also accepts the token as a query parameter for exactly this case.
export function fileUrl(path) {
  const u = base + path;
  if (!token) return u;
  return u + (u.includes("?") ? "&" : "?") + "token=" + encodeURIComponent(token);
}

function headers() {
  return { "Content-Type": "application/json", ...authHeaders() };
}

// A server that has gone away should say so in seconds, not hang a screen.
async function send(path, init, ms) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(base + path, { ...init, signal: ctl.signal });
  } catch (e) {
    throw new Error(ctl.signal.aborted ? "The server did not answer in time" : "Could not reach the server");
  } finally {
    clearTimeout(timer);
  }
}

async function request(method, path, body, ms) {
  const res = await send(path, {
    method,
    headers: headers(),
    body: body === undefined ? undefined : JSON.stringify(body),
  }, ms || (method === "GET" ? 20000 : 45000));
  if (res.status === 401) throw new Error("Unauthorized: check the access token");
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    throw new Error(data?.error || (typeof data?.detail === "string" ? data.detail : "HTTP " + res.status));
  }
  return data ?? {};
}

// for actions: a refusal ({ok: false, error}) is an error too
async function call(method, path, body, ms) {
  const data = await request(method, path, body, ms);
  if (data && data.ok === false) throw new Error(data.error || "That did not work. Please try again.");
  return data;
}

const enc = encodeURIComponent;

export const api = {
  get: (path) => request("GET", path),
  post: (path, body) => request("POST", path, body ?? {}),
  put: (path, body) => request("PUT", path, body),
  del: (path) => request("DELETE", path),
  call,

  state: () => request("GET", "/api/state"),
  control: () => request("GET", "/api/control"),
  agentsStatus: () => request("GET", "/api/agents-status"),
  thread: (id, before) => request("GET", "/api/thread/" + enc(id) +
    (before ? `?before_ts=${before.ts}&before_id=${before.id}` : "")),
  send: (thread, text, attachments, voice) => request("POST", "/api/send", {
    thread, text, attachments: attachments && attachments.length ? attachments : undefined,
    voice: voice ? true : undefined,
  }),
  // the owner talked over a spoken reply. Only a server that streams its voice has this
  // route; on one that does not, the reply still goes quiet here and this fails unheard.
  voiceStop: (thread, heard) => request("POST", "/api/voice/stop", { thread, heard }),
  command: (text, thread = "") => call("POST", "/api/command", { text, thread }),
  stop: (aid) => call("POST", `/api/agents/${enc(aid)}/stop`),
  profile: (aid) => call("GET", `/api/agents/${enc(aid)}/profile`),

  // the kernel: the Router, its Workers, and every event that reached them
  kernel: () => request("GET", "/api/kernel"),
  session: (id) => request("GET", `/api/kernel/sessions/${enc(id)}`),
  stepIn: (id, text) => call("POST", `/api/kernel/sessions/${enc(id)}/message`, { text }),
  worker: (id, action) => call("POST", `/api/kernel/sessions/${enc(id)}/${action}`, {}),
  pause: (on) => call("POST", on ? "/api/kernel/pause" : "/api/kernel/resume", {}),
  recall: (id) => request("GET", `/api/kernel/recall/${enc(id)}`),
  // answers {ok: false, result} when it refuses, with its reason in result
  policy: (body) => request("POST", "/api/kernel/policies", body),

  cron: () => request("GET", "/api/cron"),
  cronAction: (id, action) => call("POST", `/api/cron/${id}/${action}`),
  // approving runs the command before it answers, and a command may take minutes
  approval: (id, action) => call("POST", `/api/approvals/${enc(id)}/${action}`, undefined, 200000),
  improvements: () => request("GET", "/api/improvements"),
  improvement: (id, action) => call("POST", `/api/improvements/${id}/${action}`),
  diff: (id) => call("GET", `/api/improvements/${id}/diff`),
  cancelWatch: (id) => call("POST", `/api/watches/${id}/cancel`),

  evolution: () => request("GET", "/api/evolution"),
  evolutionSettings: (body) => call("PUT", "/api/evolution", body),
  review: () => call("POST", "/api/evolution/review"),
  addLesson: (agent, text) => call("POST", "/api/lessons", { agent, text }),
  updateLesson: (id, fields) => call("PUT", `/api/lessons/${id}`, fields),

  memory: (q = "") => request("GET", `/api/memory?q=${enc(q)}`),
  skill: (slug) => call("GET", `/api/skills/${enc(slug)}`),
  playbooks: () => request("GET", "/api/playbooks"),

  upload: async ({ uri, name, mime }) => {
    const fd = new FormData();
    fd.append("file", { uri, name, type: mime || "application/octet-stream" });
    const res = await send("/api/upload", { method: "POST", headers: authHeaders(), body: fd }, 120000);
    if (res.status === 401) throw new Error("Unauthorized: check the access token");
    if (!res.ok) throw new Error("Upload failed (HTTP " + res.status + ")");
    return res.json();
  },
};
