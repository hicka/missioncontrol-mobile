// The app: the five tabs, and everything that opens over them. Reads the saved
// server and theme before showing anything, connects, and sends a tapped
// notification to what it was about.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View, useColorScheme } from "react-native";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SecureStore from "expo-secure-store";
import * as SystemUI from "expo-system-ui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { configure } from "../src/api";
import { routeForPush } from "../src/harness";
import { screenLayout, stackOptions } from "../src/layout";
import * as live from "../src/live";
import { nav } from "../src/nav";
import { onNotificationTap, registerDevice } from "../src/push";
import { AppCtx } from "../src/route";
import * as store from "../src/store";
import { useStore } from "../src/store";
import { T, applyScheme } from "../src/theme";
import { ToastHost } from "../src/ui";

// a link straight to a task still has the tabs under it to go back to
export const unstable_settings = { initialRouteName: "(tabs)" };

export default function Root() {
  const insets = useSafeAreaInsets();
  const system = useColorScheme();
  const [booted, setBooted] = useState(false);
  const [theme, setThemePref] = useState("auto");
  const [saved, setSaved] = useState({ url: "", token: "" });
  const pendingPush = useRef(null);
  const state = useStore((s) => s.state);

  const scheme = theme === "auto" ? (system === "light" ? "light" : "dark") : theme;
  applyScheme(scheme);
  useEffect(() => { SystemUI.setBackgroundColorAsync(T.bg).catch(() => {}); }, [scheme]);

  // a tapped notification opens what it was about
  function followPush(thread) {
    const route = routeForPush(thread, store.leadThread(store.get().state));
    if (route.to === "task") nav.openMission(route.mission);
    else if (route.to === "chat") nav.tab("chat");
    else if (route.to === "direct") nav.openThread(route.thread);
    else nav.tab("inbox");
  }

  useEffect(() => {
    (async () => {
      // a keychain that cannot be read, or does not answer, must not leave the app on a blank screen
      const read = (k) => SecureStore.getItemAsync(k).catch(() => null);
      const stored = Promise.all([read("mc_url"), read("mc_token"), read("mc_theme")]);
      await Promise.race([stored, new Promise((r) => setTimeout(r, 4000))]);
      const [url, token, pref] = await stored;
      if (pref === "light" || pref === "dark") setThemePref(pref);
      setSaved({ url: url || "", token: token || "" });
      setBooted(true);
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

  const app = useMemo(() => ({
    saved, theme, scheme, booted,
    setTheme(pref) {
      setThemePref(pref);
      SecureStore.setItemAsync("mc_theme", pref).catch(() => {});
    },
    onConnected(_s, creds) {
      setSaved(creds);
      store.forget();
      store.start();
      live.reconnect();
      store.refresh();
      registerDevice();
      nav.tab("home");
    },
  }), [saved, theme, scheme, booted]);

  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  const navTheme = { ...base, dark: scheme === "dark",
    colors: { ...base.colors, primary: T.text, background: T.bg, card: T.bg, text: T.text, border: T.line, notification: T.signal } };

  return (
    <AppCtx.Provider value={app}>
      <ThemeProvider value={navTheme}>
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
        <View style={{ flex: 1, backgroundColor: T.bg }}>
          <Stack screenOptions={stackOptions()} screenLayout={screenLayout(scheme, (r) => r.name === "(tabs)")}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false, title: "" }} />
            <Stack.Screen name="task/[id]" options={{ title: "Task" }} />
            <Stack.Screen name="thread/[id]" options={{ title: "" }} />
            <Stack.Screen name="profile/[id]" options={{ title: "" }} />
            <Stack.Screen name="config/[section]" options={{ title: "" }} />
            <Stack.Screen name="search" options={{ title: "Search" }} />
            <Stack.Screen name="evolution" options={{ title: "Getting better" }} />
            <Stack.Screen name="schedule" options={{ title: "Schedule" }} />
            <Stack.Screen name="knowledge" options={{ title: "Knowledge" }} />
            <Stack.Screen name="activity" options={{ title: "Activity" }} />
            <Stack.Screen name="voice" options={{ presentation: "fullScreenModal", headerShown: false }} />
          </Stack>
          {!booted && <View style={[StyleSheet.absoluteFill, { backgroundColor: T.bg }]} />}
        </View>
        <ToastHost bottom={insets.bottom + 70} />
      </ThemeProvider>
    </AppCtx.Provider>
  );
}
