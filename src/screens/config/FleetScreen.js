import React, { useEffect, useState } from "react";
import { api } from "../../api";
import { ago } from "../../theme";
import { Area, Dim, Field, Item, Key, Keys, List, Note, Pill, Rule, Shell, Value } from "../../ui";

export default function FleetScreen({ onBack }) {
  const [fleet, setFleet] = useState(null);
  const [node, setNode] = useState("");
  const [key, setKey] = useState("");
  const [peers, setPeers] = useState("");
  const [addr, setAddr] = useState(null);
  const [note, setNote] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const f = (await api.get("/api/settings/full")).fleet || {};
      setFleet(f);
      setNode(f.node_name || "");
      setPeers((f.peers || []).map((p) => `${p.name} ${p.url}`).join("\n"));
    } catch (e) { setNote({ kind: "err", text: String(e.message || e) }); }
    try { setAddr(await api.get("/api/fleet/addresses")); } catch {}
  }
  useEffect(() => { load(); }, []);

  async function save() {
    setBusy(true); setNote({ kind: "busy", text: "Saving" });
    const body = { node_name: node.trim(), peers: peers.split("\n").map((l) => {
      const [name, url] = l.trim().split(/\s+/);
      return name && url ? { name, url } : null;
    }).filter(Boolean) };
    if (key.trim()) body.sync_key = key.trim();
    try {
      const d = await api.put("/api/settings/fleet", body);
      if (d.ok) { setFleet(d.fleet); setKey(""); setNote({ kind: "ok", text: "Saved. Restart to start or stop the fleet listener." }); }
      else setNote({ kind: "err", text: d.error || "Failed" });
    } catch (e) { setNote({ kind: "err", text: String(e.message || e) }); }
    setBusy(false);
  }

  return (
    <Shell title="Fleet" onBack={onBack}>
      <Dim size={14}>
        Several machines running Mission Control share memory, skills and playbooks and act as one agent. Use the same
        sync key on every machine.
      </Dim>
      <Rule label="This machine" />
      <Field label="Name" value={node} onChangeText={setNode} placeholder="studio" />
      <Field label="Sync key" value={key} onChangeText={setKey} secureTextEntry
        placeholder={fleet?.key_set ? "Saved (paste to replace)" : "The same key on every machine"} />
      <Value label="Fleet address · Tailscale" value={addr?.tailscale || ""} />
      <Value label="Fleet address · same network" value={addr?.lan || ""} />
      <Rule label="Machines" />
      <Dim size={13.5}>One per line: a name, then its address.</Dim>
      <Area value={peers} onChangeText={setPeers} placeholder={"laptop http://laptop.local:8902"} />
      {(fleet?.peers || []).length > 0 && (
        <List style={{ marginTop: 12 }}>
          {fleet.peers.map((p) => (
            <Item key={p.name} title={p.name} sub={p.url}
              right={<Pill status={p.ok === true ? "completed" : p.ok === false ? "waiting" : "retired"}
                label={p.ok ? (p.last_sync ? `Synced ${ago(p.last_sync)}` : "Reachable") : (p.detail || "Not seen yet")} />} />
          ))}
        </List>
      )}
      <Keys><Key label="Save" busy={busy} onPress={save} /></Keys>
      <Note note={note} />
    </Shell>
  );
}
