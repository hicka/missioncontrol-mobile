// Live updates over the server's websocket: messages, typing, agent
// state. The phone counts as a viewer while this is open, which is what
// tells the server not to push-notify for things you are already seeing;
// so the socket closes when the app goes to the background and reopens
// when it comes back.
import { AppState } from "react-native";
import { authHeaders, baseUrl, isDemo } from "./api";

let ws = null;
let alive = false;
let timer = null;
let foreground = true;
const listeners = new Set();

function emit(ev) {
  for (const fn of [...listeners]) {
    try { fn(ev); } catch {}
  }
}

function ensure() {
  if (ws || !baseUrl() || isDemo() || !foreground) return;
  try {
    // the token travels as a header, never in the url
    ws = new WebSocket(baseUrl().replace(/^http/, "ws") + "/ws", null, { headers: authHeaders() });
  } catch { ws = null; return; }
  // a socket being replaced still reports its close; only the current one speaks
  const me = ws;
  me.onopen = () => { if (ws !== me) return; alive = true; emit({ type: "link", on: true }); };
  me.onmessage = (e) => { if (ws !== me) return; try { emit(JSON.parse(e.data)); } catch {} };
  me.onerror = () => { try { me.close(); } catch {} };
  me.onclose = () => {
    if (ws !== me) return;
    alive = false; ws = null;
    emit({ type: "link", on: false });
    clearTimeout(timer);
    if (listeners.size && foreground) timer = setTimeout(ensure, 2000);
  };
}

function close() {
  clearTimeout(timer);
  if (ws) { try { ws.close(); } catch {} ws = null; }
  alive = false;
}

AppState.addEventListener("change", (s) => {
  foreground = s === "active";
  if (foreground) ensure(); else close();
});

export function subscribe(fn) {
  listeners.add(fn);
  ensure();
  return () => { listeners.delete(fn); };
}

export function connected() {
  return alive;
}

export function reconnect() {
  close();
  ensure();
}
