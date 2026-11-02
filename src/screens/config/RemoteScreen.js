import React, { useEffect, useState } from "react";
import { api } from "../../api";
import { Dim, Field, Key, Keys, Note, Rule, Shell, Toggle, Value } from "../../ui";

// swap the fleet port in an address for another one
function withPort(url, port) {
  return url ? url.replace(/:\d+$/, ":" + port) : "";
}

export default function RemoteScreen({ onBack }) {
  const [expose, setExpose] = useState(false);
  const [token, setToken] = useState("");
  const [ports, setPorts] = useState({ app: "8899", public: "8901", fleet: "8902" });
  const [addr, setAddr] = useState(null);
  const [note, setNote] = useState(null);
  const [portsNote, setPortsNote] = useState(null);
  const [busy, setBusy] = useState("");

  async function load() {
    try {
      const r = await api.get("/api/remote");
      setExpose(!!r.expose); setToken(r.token || "");
      const f = await api.get("/api/settings/full");
      setPorts({ app: String(f.ports.app), public: String(f.ports.public),
                 fleet: String(f.ports.fleet) });
    } catch (e) { setNote({ kind: "err", text: String(e.message || e) }); }
    try { setAddr(await api.get("/api/fleet/addresses")); } catch {}
  }
  useEffect(() => { load(); }, []);

  const [confirmRegen, setConfirmRegen] = useState(false);

  async function saveRemote(regenerate) {
    if (regenerate && !confirmRegen) { setConfirmRegen(true); return; }   // a new token logs this phone out
    setConfirmRegen(false);
    setBusy(regenerate ? "regen" : "remote");
    try {
      const d = await api.put("/api/remote", { expose, regenerate: !!regenerate });
      setToken(d.token || "");
      setNote(d.ok ? { kind: "ok", text: "Saved. Applies after a restart (More › Restart Mission Control)." }
                   : { kind: "err", text: "Failed" });
    } catch (e) { setNote({ kind: "err", text: String(e.message || e) }); }
    setBusy("");
  }

  async function savePorts() {
    setBusy("ports");
    try {
      const d = await api.put("/api/settings/ports", {
        app: +ports.app, public: +ports.public, fleet: +ports.fleet });
      setPortsNote(d.ok ? { kind: "ok", text: "Saved. Applies after a restart; then reconnect this phone on the new port." }
                        : { kind: "err", text: d.error || "Failed" });
    } catch (e) { setPortsNote({ kind: "err", text: String(e.message || e) }); }
    setBusy("");
  }

  const phoneTs = withPort(addr?.tailscale, ports.app);
  const phoneLan = withPort(addr?.lan, ports.app);

  return (
    <Shell title="Remote access" onBack={onBack}>
      <Dim size={14}>
        Lets phones and other machines reach this Mission Control. Remote callers always need the token; the Mac
        itself never does.
      </Dim>
      <Rule label="Mobile access" />
      <Toggle label="Allow remote connections" value={expose} onChange={setExpose} style={{ marginTop: 0 }} />
      <Value label="Access token" value={token} />
      <Keys>
        <Key label="Save" busy={busy === "remote"} onPress={() => saveRemote(false)} />
        <Key label={confirmRegen ? "Sure? This phone will need the new one" : "New token"} kind="danger"
          busy={busy === "regen"} onPress={() => saveRemote(true)} />
      </Keys>
      <Note note={note} />
      <Rule label="This Mac's addresses" />
      <Value label="Phone address · Tailscale" value={phoneTs} />
      {!phoneTs && !!addr && (
        <Dim size={13} style={{ marginTop: 6 }}>Tailscale: {addr.tailscale_error || "not available"}</Dim>
      )}
      <Value label="Phone address · same network" value={phoneLan} />
      <Value label="Fleet address · Tailscale" value={addr?.tailscale || ""} />
      <Rule label="Ports" />
      <Dim size={13.5}>1024 to 65535, all different.</Dim>
      <Field label="App" value={ports.app} keyboardType="number-pad"
        onChangeText={(v) => setPorts({ ...ports, app: v })} />
      <Field label="Public webhooks" value={ports.public} keyboardType="number-pad"
        onChangeText={(v) => setPorts({ ...ports, public: v })} />
      <Field label="Fleet" value={ports.fleet} keyboardType="number-pad"
        onChangeText={(v) => setPorts({ ...ports, fleet: v })} />
      <Keys><Key label="Save ports" busy={busy === "ports"} onPress={savePorts} /></Keys>
      <Note note={portsNote} />
    </Shell>
  );
}
