import React, { useEffect, useState } from "react";
import { api } from "../../api";
import { Area, Choice, Dim, Field, Key, Keys, Note, Rule, Shell, Toggle, agentOptions } from "../../ui";

export default function HeartbeatScreen({ state, onBack }) {
  const [enabled, setEnabled] = useState(false);
  const [agent, setAgent] = useState("");
  const [minutes, setMinutes] = useState("30");
  const [checklist, setChecklist] = useState("");
  const [note, setNote] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/api/heartbeat").then((h) => {
      setEnabled(!!h.enabled); setAgent(h.agent || "");
      setMinutes(String(h.every_minutes || 30)); setChecklist(h.checklist || "");
    }).catch((e) => setNote({ kind: "err", text: String(e.message || e) }));
  }, []);

  async function save() {
    setBusy(true); setNote({ kind: "busy", text: "Saving" });
    try {
      const d = await api.put("/api/heartbeat", {
        enabled, agent: agent || undefined, every_minutes: +minutes || 30, checklist });
      setNote(d.ok ? { kind: "ok", text: "Saved" } : { kind: "err", text: "Failed" });
    } catch (e) { setNote({ kind: "err", text: String(e.message || e) }); }
    setBusy(false);
  }

  return (
    <Shell title="Heartbeat" onBack={onBack}>
      <Dim size={14}>
        One agent reads this checklist on a timer and only speaks up when something needs you. Cheap when all is quiet.
      </Dim>
      <Rule label="Pulse" />
      <Toggle label="Heartbeat" value={enabled} onChange={setEnabled} style={{ marginTop: 0 }} />
      <Choice label="Agent" options={agentOptions(state)} value={agent} onChange={setAgent} />
      <Field label="Every, in minutes" value={minutes} onChangeText={setMinutes} keyboardType="number-pad" />
      <Area label="Checklist" value={checklist} onChangeText={setChecklist}
        autoCapitalize="sentences" autoCorrect placeholder="- Anything promised but not delivered?" />
      <Keys><Key label="Save" busy={busy} onPress={save} /></Keys>
      <Note note={note} />
    </Shell>
  );
}
