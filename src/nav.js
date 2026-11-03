// Where everything is. Five tabs at the bottom: the agent at a glance, the
// conversation, what needs you, its tasks, and settings. Anything opened from
// them, a task, a direct line, a profile, a setting, everything that reached the
// agent, opens over the tabs with the system's back gesture. The screens still
// call the same few verbs they always have.
import { router } from "expo-router";
import * as store from "./store";
import { notify } from "./ui";

// the older names still lead somewhere: Now became Home, More settings
const TABS = { home: "/", now: "/", agent: "/chat", chat: "/chat", inbox: "/inbox", tasks: "/tasks",
               settings: "/settings", more: "/settings" };

function href(r) {
  switch (r.kind) {
    case "chat": return { pathname: "/thread/[id]", params: { id: r.threadId, ...(r.atId ? { at: String(r.atId) } : null) } };
    case "voice": return { pathname: "/voice", params: { thread: r.threadId } };
    case "task": return { pathname: "/task/[id]", params: { id: r.workerId } };
    case "profile": return { pathname: "/profile/[id]", params: { id: r.agentId } };
    case "config": return { pathname: "/config/[section]", params: { section: r.section, ...(r.editId ? { edit: r.editId } : null) } };
    case "knowledge": return { pathname: "/knowledge", params: r.tab ? { tab: r.tab } : {} };
    default: return `/${r.kind}`;
  }
}

export const nav = {
  tab(id, opts) {
    if (id === "activity") return router.push("/activity");
    router.navigate(TABS[id] || "/");
    if (opts?.focus) store.askToWrite();
  },
  push(route) {
    if (route.kind === "tasks") return nav.tab("tasks");
    router.push(href(route));
  },
  pop() { if (router.canGoBack()) router.back(); },
  // the agent's own conversation is a tab; anything else is a direct line, or a task's own record
  openThread(id) {
    if (id === store.leadThread(store.get().state) || id === "group:team") nav.tab("chat");
    else if (String(id).startsWith("task:")) nav.openMission(String(id).slice(5));
    else nav.push({ kind: "chat", threadId: id });
  },
  openTask(id) { nav.push({ kind: "task", workerId: id }); },
  async openMission(mission) {
    const find = () => {
      const s = store.get();
      return (s.kernel?.sessions || s.control.workers || []).find((x) => x.mission === mission);
    };
    if (!find()) await store.refreshKernel();
    const w = find();
    if (w) nav.openTask(w.id);
    else notify("That task is past what the phone can list, about the last day of work.");
  },
  openVoice() { nav.push({ kind: "voice", threadId: store.leadThread(store.get().state) }); },
  openProfile(aid) { nav.push({ kind: "profile", agentId: aid }); },
  openConfig(section) { nav.push({ kind: "config", section }); },
};
