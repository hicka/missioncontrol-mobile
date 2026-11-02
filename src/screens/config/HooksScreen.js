import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { api } from "../../api";
import { T } from "../../theme";
import { Card, Choice, Dim, Field, Key, Keys, Note, Rule, Shell, Txt, Value, agentOptions } from "../../ui";

const MODES = [{ value: "wake", label: "Wake the agent" }, { value: "notify", label: "Notify only" }];

export default function HooksScreen({ state, onBack }) {
  const [hooks, setHooks] = useState([]);
  const [publicUrl, setPublicUrl] = useState("");
  const [name, setName] = useState("");
  const [agent, setAgent] = useState("");
  const [mode, setMode] = useState("wake");
  const [note, setNote] = useState(null);
  const [busy, setBusy] = useState("");

  async function load() {
    try {
      const d = await api.get("/api/hooks");
      setHooks(d.hooks || []); setPublicUrl(d.public_url || "");
    } catch (e) { setNote({ kind: "err", text: String(e.message || e) }); }
  }
  useEffect(() => { load(); }, []);

  async function add() {
    setBusy("add"); setNote({ kind: "busy", text: "Adding" });
    try {
      const d = await api.post("/api/hooks", { name: name.trim(), agent, mode });
      if (d.ok) { setName(""); setNote({ kind: "ok", text: "Added. Restart if this is the first route." }); load(); }
      else setNote({ kind: "err", text: d.error || "Failed" });
    } catch (e) { setNote({ kind: "err", text: String(e.message || e) }); }
    setBusy("");
  }

  const [confirm, setConfirm] = useState(null);

  async function remove(n) {
    if (confirm !== n) { setConfirm(n); return; }   // second tap confirms
    setConfirm(null); setBusy(n);
    try { await api.del(`/api/hooks/${encodeURIComponent(n)}`); load(); } catch {}
    setBusy("");
  }

  const agentName = (id) => (state?.agents || []).find((a) => a.id === id)?.name || id;
  const base = publicUrl || "(the tunnel address appears after a restart)";
  return (
    <Shell title="Webhooks" onBack={onBack}>
      <Dim size={14}>Any service that can call an address can wake an agent: alerts, forms, CI, home automation.</Dim>
      <Rule label={`Routes · ${hooks.length}`} />
      {hooks.length === 0 && <Dim size={14}>No routes yet.</Dim>}
      <View style={{ gap: 10 }}>
        {hooks.map((h) => (
          <Card key={h.name} pad={14}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Txt size={15} weight="600">{h.name}</Txt>
                <Txt size={13} color={T.text3}>To {h.agent ? agentName(h.agent) : "the lead"} · {h.mode === "notify" ? "notify only" : "wakes the agent"}</Txt>
              </View>
              <Key label={confirm === h.name ? "Remove it?" : "Remove"} kind="danger" busy={busy === h.name}
                onPress={() => remove(h.name)} />
            </View>
            <Value value={`${base}/hook/${h.name}?token=${h.secret}`} style={{ marginTop: 10 }} />
          </Card>
        ))}
      </View>
      <Rule label="New route" />
      <Field label="Name" value={name} onChangeText={setName} placeholder="deploy-alerts" />
      <Choice label="Agent" options={agentOptions(state)} value={agent} onChange={setAgent} />
      <Choice label="Mode" options={MODES} value={mode} onChange={setMode} />
      <Keys><Key label="Add route" busy={busy === "add"} disabled={!name.trim()} onPress={add} /></Keys>
      <Note note={note} />
    </Shell>
  );
}
