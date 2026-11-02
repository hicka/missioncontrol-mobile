import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { api } from "../../api";
import Icon from "../../components/Icon";
import { T } from "../../theme";
import { Card, Choice, Dim, Field, Key, Keys, Note, Pill, Shell, Toggle, Txt, agentOptions } from "../../ui";

const META = {
  imessage: { label: "iMessage", secret: "BlueBubbles password",
    hint: "Needs a BlueBubbles server on a Mac. Its password is the secret.",
    fields: [["server_url", "BlueBubbles server"]],
    senders: "Your phone number or email, as iMessage sees it" },
  telegram: { label: "Telegram", secret: "Bot token",
    hint: "Create a bot with @BotFather and paste its token. Works everywhere.",
    fields: [], senders: "Your numeric id or @username" },
  whatsapp: { label: "WhatsApp", secret: "Access token",
    hint: "Meta Business Cloud API. Needs a stable public webhook address.",
    fields: [["phone_number_id", "Phone number id"], ["verify_token", "Verify token"]],
    senders: "Phone numbers, digits only" },
  email: { label: "Email", secret: "App password",
    hint: "A dedicated address the agent owns. Unseen mail from allowed senders goes to the agent.",
    fields: [["address", "Email address"], ["imap_host", "IMAP host"], ["smtp_host", "SMTP host"]],
    senders: "Email addresses allowed to write in" },
};

export default function ChannelsScreen({ state, onBack }) {
  const [full, setFull] = useState(null);
  const [form, setForm] = useState({});
  const [open, setOpen] = useState({});
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState("");

  async function load() {
    try {
      const f = await api.get("/api/settings/full");
      setFull(f);
      const init = {};
      for (const name of Object.keys(META)) {
        const c = f.channels.settings[name] || {};
        init[name] = { enabled: !!c.enabled, default_agent: c.default_agent || "",
                       senders: (c.allowed_senders || []).join(", "), secret: "",
                       ...Object.fromEntries(META[name].fields.map(([k]) => [k, c[k] || ""])) };
      }
      setForm(init);
      setOpen(Object.fromEntries(Object.keys(META).map((n) => [n, !!init[n].enabled])));
    } catch (e) { setNotes({ _: { kind: "err", text: String(e.message || e) } }); }
  }
  useEffect(() => { load(); }, []);

  function set(name, patch) { setForm({ ...form, [name]: { ...form[name], ...patch } }); }

  async function save(name) {
    const f = form[name];
    const body = { enabled: f.enabled, default_agent: f.default_agent || undefined,
                   allowed_senders: f.senders.split(",").map((s) => s.trim()).filter(Boolean) };
    for (const [k] of META[name].fields) body[k] = (f[k] || "").trim();
    if (f.secret.trim()) body.secret = f.secret.trim();
    setBusy(name); setNotes({ ...notes, [name]: { kind: "busy", text: "Saving" } });
    try {
      const d = await api.put(`/api/settings/channels/${name}`, body);
      if (d.ok) {
        const st = d.status[name] || {};
        setFull({ ...full, channels: { ...full.channels, status: d.status } });
        set(name, { secret: "" });
        setNotes({ ...notes, [name]: st.connected ? { kind: "ok", text: "Saved and connected" }
          : f.enabled ? { kind: "err", text: "Saved. " + (st.detail || "Not connected yet") }
          : { kind: "ok", text: "Saved" } });
      } else setNotes({ ...notes, [name]: { kind: "err", text: d.error || "Failed" } });
    } catch (e) { setNotes({ ...notes, [name]: { kind: "err", text: String(e.message || e) } }); }
    setBusy("");
  }

  const agents = agentOptions(state);
  const status = full?.channels?.status || {};

  return (
    <Shell title="Channels" onBack={onBack}>
      <Dim size={14}>Reach the agent from anywhere. It answers where you last spoke.</Dim>
      {!!full?.public_url && <Dim size={13.5} style={{ marginTop: 6 }}>Public webhook base: {full.public_url}</Dim>}
      <Note note={notes._} />
      <View style={{ gap: 12, marginTop: 18 }}>
        {Object.entries(META).map(([name, meta]) => {
          const f = form[name]; if (!f) return null;
          const st = status[name] || {};
          return (
            <Card key={name}>
              <Pressable onPress={() => setOpen({ ...open, [name]: !open[name] })}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, padding: 14,
                                           backgroundColor: pressed ? T.hover : "transparent" })}>
                <Txt size={15.5} weight="600" style={{ flex: 1 }}>{meta.label}</Txt>
                <Pill status={st.connected ? "completed" : f.enabled ? "waiting" : "retired"}
                  label={st.connected ? "Connected" : f.enabled ? (st.detail || "Not connected") : "Off"} />
                <View style={{ transform: [{ rotate: open[name] ? "90deg" : "0deg" }] }}>
                  <Icon name="chev" size={16} color={T.text4} />
                </View>
              </Pressable>
              {open[name] && (
                <View style={{ paddingHorizontal: 14, paddingBottom: 16, borderTopWidth: 1, borderColor: T.line }}>
                  <Dim size={13.5} style={{ marginTop: 12 }}>{meta.hint}</Dim>
                  <Toggle label="On" value={f.enabled} onChange={(v) => set(name, { enabled: v })} />
                  {meta.fields.map(([k, label]) => (
                    <Field key={k} label={label} value={f[k]} onChangeText={(v) => set(name, { [k]: v })} />
                  ))}
                  <Field label={meta.secret} value={f.secret} secureTextEntry
                    onChangeText={(v) => set(name, { secret: v })}
                    placeholder={st.secret_set ? "Saved (paste to replace)" : "Paste it here"} />
                  <Field label="Allowed senders" value={f.senders}
                    onChangeText={(v) => set(name, { senders: v })} placeholder={meta.senders} />
                  <Choice label="Answered by" options={agents} value={f.default_agent}
                    onChange={(v) => set(name, { default_agent: v })} />
                  <Keys>
                    <Key label="Save" busy={busy === name} onPress={() => save(name)} />
                  </Keys>
                  <Note note={notes[name]} />
                </View>
              )}
            </Card>
          );
        })}
      </View>
    </Shell>
  );
}
