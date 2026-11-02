import React, { useEffect, useRef, useState } from "react";
import { BackHandler, Pressable, View, useColorScheme } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SecureStore from "expo-secure-store";
import * as SystemUI from "expo-system-ui";
import { SafeAreaProvider, initialWindowMetrics, useSafeAreaInsets } from "react-native-safe-area-context";
import { configure } from "./src/api";
import { routeForPush } from "./src/harness";
import * as live from "./src/live";
import * as store from "./src/store";
import { useStore } from "./src/store";
import { onNotificationTap, registerDevice } from "./src/push";
import { T, applyScheme } from "./src/theme";
import { ToastHost, Txt, haptic, notify } from "./src/ui";
import Icon from "./src/components/Icon";
import StackLayer from "./src/components/Stack";
import NowScreen from "./src/screens/NowScreen";
import ChatScreen from "./src/screens/ChatScreen";
import VoiceScreen from "./src/screens/VoiceScreen";
import ActivityScreen from "./src/screens/ActivityScreen";
import TaskScreen from "./src/screens/TaskScreen";
import TasksScreen from "./src/screens/TasksScreen";
import EvolutionScreen from "./src/screens/EvolutionScreen";
import ScheduleScreen from "./src/screens/ScheduleScreen";
import KnowledgeScreen from "./src/screens/KnowledgeScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import SearchScreen from "./src/screens/SearchScreen";
import MoreScreen from "./src/screens/MoreScreen";
import ConnectionScreen from "./src/screens/config/ConnectionScreen";
import ModelScreen from "./src/screens/config/ModelScreen";
import VoiceSettingsScreen from "./src/screens/config/VoiceSettingsScreen";
import AgentsScreen from "./src/screens/config/AgentsScreen";
import ChannelsScreen from "./src/screens/config/ChannelsScreen";
import GithubScreen from "./src/screens/config/GithubScreen";
import RemoteScreen from "./src/screens/config/RemoteScreen";
import FleetScreen from "./src/screens/config/FleetScreen";
import HeartbeatScreen from "./src/screens/config/HeartbeatScreen";
import HooksScreen from "./src/screens/config/HooksScreen";
import ImportScreen from "./src/screens/config/ImportScreen";

const TABS = [
  { id: "now", label: "Now", icon: "spark" },
  { id: "chat", label: "Chat", icon: "chat" },
  { id: "activity", label: "Activity", icon: "bolt" },
  { id: "more", label: "More", icon: "menu" },
];

const CONFIG_SCREENS = {
  connection: ConnectionScreen, model: ModelScreen, voice: VoiceSettingsScreen, agents: AgentsScreen,
  channels: ChannelsScreen, github: GithubScreen, remote: RemoteScreen, fleet: FleetScreen,
  heartbeat: HeartbeatScreen, hooks: HooksScreen, import: ImportScreen,
};

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <Root />
    </SafeAreaProvider>
  );
}

let layerSeq = 0;

function Root() {
  const insets = useSafeAreaInsets();
  const system = useColorScheme();
  const [booted, setBooted] = useState(false);
  const [theme, setThemePref] = useState("auto");
  const [saved, setSaved] = useState({ url: "", token: "" });
  const [tab, setTab] = useState("now");
  const [seen, setSeen] = useState({ now: true });     // tabs stay mounted once opened
  const [stack, setStack] = useState([]);              // [{key, route, leaving}]
  const [focusKey, setFocusKey] = useState(0);
  const pendingPush = useRef(null);
  const state = useStore((s) => s.state);
  const inboxCount = useStore((s) => (s.control.inbox || []).length);
  const leadThread = store.leadThread(state);
  const unread = useStore((s) => !!(leadThread && s.unread[leadThread]));
  // a reply on a direct line brings no push while the app is open, so it has to show somewhere
  const directUnread = useStore((s) => Object.keys(s.unread).some((id) => id !== leadThread));

  const scheme = theme === "auto" ? (system === "light" ? "light" : "dark") : theme;
  applyScheme(scheme);
  useEffect(() => { SystemUI.setBackgroundColorAsync(T.bg).catch(() => {}); }, [scheme]);

  const nav = {
    tab: (id, opts) => {
      setTab(id);
      setSeen((s) => ({ ...s, [id]: true }));
      setStack([]);
      if (opts?.focus) setFocusKey((k) => k + 1);
    },
    push: (route) => setStack((s) => [...s, { key: ++layerSeq, route }]),
    pop: () => setStack((s) => {
      const i = s.map((l) => !l.leaving).lastIndexOf(true);
      return i < 0 ? s : s.map((l, j) => (j === i ? { ...l, leaving: true } : l));
    }),
    // the agent's own conversation is a tab; anything else is a direct line, or a task's own record
    openThread: (id) => {
      if (id === store.leadThread(store.get().state) || id === "group:team") nav.tab("chat");
      else if (String(id).startsWith("task:")) nav.openMission(String(id).slice(5));
      else nav.push({ kind: "chat", threadId: id });
    },
    openTask: (id) => nav.push({ kind: "task", workerId: id }),
    openMission: async (mission) => {
      const find = () => {
        const s = store.get();
        return (s.kernel?.sessions || s.control.workers || []).find((x) => x.mission === mission);
      };
      if (!find()) await store.refreshKernel();
      const w = find();
      if (w) navRef.current.openTask(w.id);
      else notify("That task is past what the phone can list, about the last day of work.");
    },
    openVoice: () => nav.push({ kind: "voice", threadId: store.leadThread(store.get().state) }),
    openProfile: (aid) => nav.push({ kind: "profile", agentId: aid }),
    openConfig: (section) => nav.push({ kind: "config", section }),
  };
  const navRef = useRef(nav);
  navRef.current = nav;

  // a tapped notification opens what it was about
  function followPush(thread) {
    const route = routeForPush(thread, store.leadThread(store.get().state));
    const n = navRef.current;
    if (route.to === "task") n.openMission(route.mission);
    else if (route.to === "chat") n.tab("chat");
    else if (route.to === "direct") n.openThread(route.thread);
    else n.tab("now");
  }

  useEffect(() => {
    (async () => {
      // a keychain that cannot be read, or does not answer, must not leave the app on a blank screen
      const read = (k) => SecureStore.getItemAsync(k).catch(() => null);
      const stored = Promise.all([read("mc_url"), read("mc_token"), read("mc_theme")]);
      await Promise.race([stored, new Promise((r) => setTimeout(r, 4000))]);
      setBooted(true);
      const [url, token, pref] = await stored;
      if (pref === "light" || pref === "dark") setThemePref(pref);
      setSaved({ url: url || "", token: token || "" });
      if (url) {
        configure(url, token);
        store.start();
        if (await store.refresh()) registerDevice();
      }
    })();
    return onNotificationTap((data) => {
      const id = data?.thread;
      if (!id || id === "budget" || id === "test") return;
      if (store.get().state) followPush(id);
      else pendingPush.current = id;
    });
  }, []);

  useEffect(() => {
    if (state && pendingPush.current) {
      followPush(pendingPush.current);
      pendingPush.current = null;
    }
  }, [state]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!stack.some((l) => !l.leaving)) return false;
      navRef.current.pop();
      return true;
    });
    return () => sub.remove();
  }, [stack]);

  function setTheme(pref) {
    setThemePref(pref);
    SecureStore.setItemAsync("mc_theme", pref).catch(() => {});
  }

  function onConnected(_s, creds) {
    setSaved(creds);
    store.start();
    live.reconnect();
    store.refresh();
    registerDevice();
    setStack([]);
    setTab("now");
  }

  function render(route, key) {
    const onBack = () => nav.pop();
    switch (route.kind) {
      case "chat":
        return <ChatScreen key={key} threadId={route.threadId} atId={route.atId} nav={nav} onBack={onBack}
          onVoice={() => nav.push({ kind: "voice", threadId: route.threadId })} />;
      case "voice": {
        const agents = store.agentsById(state);
        const thread = (state?.threads || []).find((t) => t.id === route.threadId)
          || { id: route.threadId, agent: String(route.threadId).startsWith("dm:") ? route.threadId.slice(3) : null };
        return <VoiceScreen key={key} thread={thread} agents={agents} onBack={onBack} />;
      }
      case "task": return <TaskScreen key={key} workerId={route.workerId} nav={nav} onBack={onBack} />;
      case "tasks": return <TasksScreen key={key} nav={nav} onBack={onBack} />;
      case "search": return <SearchScreen key={key} nav={nav} onBack={onBack} />;
      case "evolution": return <EvolutionScreen key={key} saved={saved} nav={nav} onBack={onBack} />;
      case "profile": return <ProfileScreen key={key} agentId={route.agentId} nav={nav} onBack={onBack} />;
      case "schedule": return <ScheduleScreen key={key} nav={nav} onBack={onBack} />;
      case "knowledge": return <KnowledgeScreen key={key} nav={nav} onBack={onBack} tab={route.tab} />;
      case "config": {
        const Screen = CONFIG_SCREENS[route.section];
        return Screen ? <Screen key={key} nav={nav} state={state} saved={saved} onBack={onBack} editId={route.editId}
          onChanged={() => store.refresh()} onConnected={onConnected} /> : null;
      }
      default: return null;
    }
  }

  if (!booted) return <View style={{ flex: 1, backgroundColor: T.bg }} />;

  const tabProps = { nav, saved, theme, setTheme, onConnected };
  return (
    <View key={scheme} style={{ flex: 1, backgroundColor: T.bg }}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <View style={{ flex: 1, paddingTop: insets.top }}>
        {seen.now && <Pane on={tab === "now"}><NowScreen {...tabProps} /></Pane>}
        {seen.chat && (
          <Pane on={tab === "chat"}>
            {leadThread ? (
              <ChatScreen threadId={leadThread} nav={nav} active={tab === "chat"} focusKey={focusKey}
                onVoice={() => nav.openVoice()} />
            ) : <NowScreen {...tabProps} />}
          </Pane>
        )}
        {seen.activity && <Pane on={tab === "activity"}><ActivityScreen {...tabProps} /></Pane>}
        {seen.more && <Pane on={tab === "more"}><MoreScreen {...tabProps} /></Pane>}
      </View>
      <View style={{ backgroundColor: T.bg, paddingHorizontal: 14, paddingTop: 2, paddingBottom: Math.max(insets.bottom - 6, 8) }}>
        <View style={{ flexDirection: "row", gap: 4, padding: 4, borderRadius: 26, backgroundColor: T.surface,
                       borderWidth: 1, borderColor: T.line }}>
          {TABS.map((t) => {
            const on = tab === t.id;
            const badge = t.id === "now" && inboxCount ? inboxCount : 0;
            const dot = (t.id === "chat" && unread) || (t.id === "more" && directUnread);
            return (
              <Pressable key={t.id} accessibilityRole="tab" accessibilityState={{ selected: on }}
                accessibilityLabel={badge ? `${t.label}, ${badge} waiting on you` : t.label}
                onPress={() => { if (!on) haptic.pick(); nav.tab(t.id); }}
                style={{ flex: 1, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", gap: 1,
                         backgroundColor: on ? T.surface3 : "transparent" }}>
                <View>
                  <Icon name={t.icon} size={19} color={on ? T.text : T.text3} weight={on ? 2 : 1.7} />
                  {!!badge && (
                    <View style={{ position: "absolute", left: 11, top: -6, minWidth: 17, height: 17, borderRadius: 9,
                                   paddingHorizontal: 4, backgroundColor: T.signal, alignItems: "center", justifyContent: "center" }}>
                      <Txt size={10.5} weight="700" color={T.signalInk} style={{ lineHeight: 13 }}>{badge > 99 ? "99+" : badge}</Txt>
                    </View>
                  )}
                  {dot && <View style={{ position: "absolute", right: -3, top: -1, width: 8, height: 8, borderRadius: 4, backgroundColor: T.text }} />}
                </View>
                <Txt size={10.5} weight={on ? "600" : "500"} color={on ? T.text : T.text3} style={{ lineHeight: 13 }}>{t.label}</Txt>
              </Pressable>
            );
          })}
        </View>
      </View>
      {stack.map((l) => (
        <StackLayer key={l.key} leaving={l.leaving}
          onRemoved={() => setStack((s) => s.filter((x) => x.key !== l.key))}>
          <View style={{ flex: 1, paddingTop: insets.top }}>{render(l.route, l.key)}</View>
        </StackLayer>
      ))}
      <ToastHost bottom={insets.bottom + 78} />
    </View>
  );
}

function Pane({ on, children }) {
  return <View style={{ flex: 1, display: on ? "flex" : "none" }}>{children}</View>;
}
