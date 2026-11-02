// Everything around the agent: all its tasks, its schedule, what it knows and how
// it is learning, the roles a task can run as; then every setting, how this phone
// reaches the Mac, and how the app looks.
import React, { useState } from "react";
import { View } from "react-native";
import Constants from "expo-constants";
import { api } from "../api";
import { ACTIVE, isRoutine } from "../harness";
import * as store from "../store";
import { useStore } from "../store";
import { T } from "../theme";
import { Button, Item, ItemIcon, List, Note, Screen, Section, Segmented, Title, Txt } from "../ui";

const SETTINGS = [
  ["connection", "phone", "This phone", "Server address and access token"],
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

export default function MoreScreen({ nav, saved, theme, setTheme }) {
  const state = useStore((s) => s.state);
  const online = useStore((s) => s.online);
  const sessions = useStore((s) => s.kernel?.sessions || s.control.workers || []);
  const jobs = useStore((s) => s.control.jobs || []);
  const watches = useStore((s) => s.control.watches || []);
  const evolution = useStore((s) => s.control.evolution || {});
  const directUnread = useStore((s) => Object.keys(s.unread).filter((id) => id !== store.leadThread(s.state)).length);
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState(null);
  const [busy, setBusy] = useState(false);
  const connected = !!state;
  const open = sessions.filter((w) => ACTIVE.includes(w.status) && !isRoutine(w) && !w.direct).length;
  const scheduled = jobs.filter((j) => j.status === "active").length + watches.filter((w) => w.status === "active").length;

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

  const count = (n) => (n ? <Txt size={13.5} color={T.text3}>{n}</Txt> : null);
  return (
    <Screen>
      <Title>More</Title>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: -8, marginBottom: 6 }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: connected && online !== false ? T.good : T.text4 }} />
        <Txt size={13.5} color={T.text3} numberOfLines={1} style={{ flex: 1 }}>
          {connected && online !== false ? `Connected to ${saved.url}` : saved.url ? (online === false ? `Can't reach ${saved.url}` : "Connecting…") : "Not connected"}
        </Txt>
      </View>

      <Section title="The agent">
        <List>
          {[["tasks", "tasks", "Recent tasks", "What it is working on, and about the last day of work", open],
            ["schedule", "clock", "Schedule", "Recurring jobs and watches", scheduled],
            ["knowledge", "book", "Knowledge", "Memory, skills and web playbooks", 0],
            ["evolution", "growth", "Getting better", "Lessons from your corrections and its mistakes", evolution.trial || 0]].map(([kind, icon, title, sub, n]) => (
            <View key={kind} style={{ opacity: connected ? 1 : 0.4 }}>
              <Item left={<ItemIcon name={icon} />} title={title} sub={sub} right={count(n)} chevron lines={1}
                onPress={connected ? () => nav.push({ kind }) : undefined} />
            </View>
          ))}
          <View style={{ opacity: connected ? 1 : 0.4 }}>
            <Item left={<ItemIcon name="users" />} title="Profiles" sub={directUnread ? "A direct line has a new message" : "The roles a task can run as, and direct lines"}
              right={count(directUnread)} chevron lines={1}
              onPress={connected ? () => nav.openConfig("agents") : undefined} />
          </View>
        </List>
      </Section>

      <Section title="Settings">
        <List>
          {SETTINGS.map(([id, icon, title, sub]) => {
            const locked = !connected && id !== "connection";
            return (
              <View key={id} style={{ opacity: locked ? 0.4 : 1 }}>
                <Item left={<ItemIcon name={icon} />} title={title} sub={sub} chevron lines={1}
                  onPress={locked ? undefined : () => nav.openConfig(id)} />
              </View>
            );
          })}
        </List>
      </Section>

      <Section title="Appearance">
        <Segmented value={theme} onChange={setTheme}
          options={[{ value: "auto", label: "Automatic" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
        <Txt size={13} color={T.text3} style={{ marginTop: 8 }}>Automatic follows your phone's light and dark setting.</Txt>
      </Section>

      {connected && (
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

      <Txt size={12} color={T.text4} style={{ textAlign: "center", marginTop: 36 }}>
        Mission Control {Constants.expoConfig?.version || ""}
      </Txt>
    </Screen>
  );
}
