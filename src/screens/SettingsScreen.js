// Everything around the agent: which Mac this phone reaches, the roles a task can
// run as, its schedule, what it knows and how it is learning; then every setting
// on the Mac, how the app looks, and restarting the server.
import React, { useState } from "react";
import { Linking, View } from "react-native";
import Constants from "expo-constants";
import { LeadMark } from "../components/Presence";
import { api, isDemo } from "../api";
import { nav } from "../nav";
import { useApp } from "../route";
import * as store from "../store";
import { useStore } from "../store";
import { T } from "../theme";
import { Button, Item, ItemIcon, List, Note, Screen, Section, Segmented, Title, Txt } from "../ui";

const SETTINGS = [
  ["model", "spark", "Model", "Provider, key, fallbacks and usage"],
  ["voice", "wave", "Voice", "Its voice, speed and spoken replies"],
  ["channels", "chat", "Channels", "iMessage, Telegram, WhatsApp and email"],
  ["github", "branch", "GitHub", "Watched repositories and routing"],
  ["remote", "globe", "Remote access", "Mobile access, token, ports and addresses"],
  ["fleet", "link", "Fleet", "Machines acting as one agent"],
  ["heartbeat", "heart", "Heartbeat", "A periodic checklist pulse"],
  ["hooks", "bolt", "Webhooks", "Routes that reach the agent"],
  ["import", "down", "Import", "Skills or profiles from a git address"],
];

const SITE = "https://hicka.github.io/missioncontrol";

export default function SettingsScreen() {
  const { saved, theme, setTheme } = useApp();
  const state = useStore((s) => s.state);
  const online = useStore((s) => s.online);
  const jobs = useStore((s) => s.control.jobs || []);
  const watches = useStore((s) => s.control.watches || []);
  const evolution = useStore((s) => s.control.evolution || {});
  const directUnread = useStore((s) => Object.keys(s.unread).filter((id) => id !== store.leadThread(s.state)).length);
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState(null);
  const [busy, setBusy] = useState(false);
  const connected = !!state;
  const reachable = connected && online !== false;
  const scheduled = jobs.filter((j) => j.status === "active").length + watches.filter((w) => w.status === "active").length;
  const name = store.lead(state)?.name || "Mission Control";

  async function restart() {
    if (!confirm) { setConfirm(true); return; }
    setConfirm(false); setBusy(true);
    setNote({ kind: "busy", text: "Restarting Mission Control" });
    try { await api.post("/api/shutdown"); } catch {}
    const started = Date.now();
    let back = false;
    while (Date.now() - started < 40000) {
      await new Promise((r) => setTimeout(r, 2000));
      try { await api.state(); back = true; break; } catch {}
    }
    setBusy(false);
    setNote(back ? { kind: "ok", text: "Back online" } : { kind: "err", text: "Not back yet. Give it a moment." });
    if (back) store.refresh();
  }

  const count = (n) => (n ? <Txt size={14} color={T.text3}>{n}</Txt> : null);
  const row = (key, icon, title, sub, onPress, n, locked) => (
    <View key={key} style={{ opacity: locked ? 0.4 : 1 }}>
      <Item left={<ItemIcon name={icon} />} title={title} sub={sub} right={count(n)} chevron lines={1}
        onPress={locked ? undefined : onPress} />
    </View>
  );

  return (
    <Screen>
      <Title>Settings</Title>

      <List>
        <Item onPress={() => nav.openConfig("connection")} chevron lines={1}
          left={<LeadMark size={46} />}
          title={<Txt size={17} weight="600" numberOfLines={1}>{connected ? name : "Connect this phone"}</Txt>}
          sub={(
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: reachable ? T.good : online === false ? T.danger : T.text4 }} />
              <Txt size={13.5} color={T.text3} numberOfLines={1} style={{ flexShrink: 1 }}>
                {isDemo() ? "Sample data, not a real Mac"
                  : reachable ? saved.url : saved.url ? (online === false ? `Can't reach ${saved.url}` : "Connecting…") : "Your Mac's address and token"}
              </Txt>
            </View>
          )} />
      </List>

      <Section title="The agent">
        <List>
          {row("agents", "users", "Profiles", directUnread ? "A direct line has a new message" : "The roles a task can run as, and direct lines",
            () => nav.openConfig("agents"), directUnread, !connected)}
          {row("schedule", "clock", "Schedule", "Recurring jobs and watches", () => nav.push({ kind: "schedule" }), scheduled, !connected)}
          {row("knowledge", "book", "Knowledge", "Memory, skills and web playbooks", () => nav.push({ kind: "knowledge" }), 0, !connected)}
          {row("evolution", "growth", "Getting better", "Lessons from your corrections and its mistakes",
            () => nav.push({ kind: "evolution" }), evolution.trial || 0, !connected)}
          {row("activity", "bolt", "Activity", "Everything that reached it, its rules, and the Watchdog",
            () => nav.tab("activity"), 0, !connected)}
        </List>
      </Section>

      <Section title="On your Mac">
        <List>
          {SETTINGS.map(([id, icon, title, sub]) => row(id, icon, title, sub, () => nav.openConfig(id), 0, !connected))}
        </List>
      </Section>

      <Section title="Appearance">
        <Segmented value={theme} onChange={setTheme}
          options={[{ value: "auto", label: "Automatic" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
        <Txt size={13} color={T.text3} style={{ marginTop: 8 }}>Automatic follows your phone's light and dark setting.</Txt>
      </Section>

      {connected && !isDemo() && (
        <Section title="Server">
          <Txt size={13.5} color={T.text3}>
            Port, remote access, GitHub, fleet and webhook changes apply after a restart. launchd brings the server straight back.
          </Txt>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <Button label={confirm ? "Yes, restart now" : "Restart Mission Control"} kind={confirm ? "danger-primary" : "danger"}
              small busy={busy} onPress={restart} />
            {confirm && <Button label="Cancel" kind="ghost" small onPress={() => setConfirm(false)} />}
          </View>
          <Note note={note} />
        </Section>
      )}

      <Section title="About">
        <List>
          <Item title="Support" chevron lines={1} onPress={() => Linking.openURL(`${SITE}/support.html`)} />
          <Item title="Privacy policy" chevron lines={1} onPress={() => Linking.openURL(`${SITE}/privacy.html`)} />
          <Item title="Source code" chevron lines={1} onPress={() => Linking.openURL("https://github.com/hicka/missioncontrol")} />
        </List>
      </Section>

      <Txt size={12} color={T.text4} style={{ textAlign: "center", marginTop: 28 }}>
        Mission Control {Constants.expoConfig?.version || ""}
      </Txt>
    </Screen>
  );
}
