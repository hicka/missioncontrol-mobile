import React, { useEffect, useState } from "react";
import { api } from "../../api";
import { Choice, Dim, Field, Key, Keys, Note, Rule, Shell, Toggle, agentOptions } from "../../ui";

export default function GithubScreen({ state, onBack }) {
  const [enabled, setEnabled] = useState(false);
  const [repos, setRepos] = useState("");
  const [routeCi, setRouteCi] = useState("");
  const [routeCode, setRouteCode] = useState("");
  const [note, setNote] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/api/settings/full").then((f) => {
      const g = f.github || {};
      setEnabled(!!g.enabled);
      setRepos((g.repos || []).join(", "));
      setRouteCi(g.route_ci || "");
      setRouteCode(g.route_code || "");
    }).catch((e) => setNote({ kind: "err", text: String(e.message || e) }));
  }, []);

  async function save() {
    setBusy(true); setNote({ kind: "busy", text: "Saving" });
    try {
      const d = await api.put("/api/settings/github", {
        enabled, repos: repos.split(",").map((s) => s.trim()).filter(Boolean),
        route_ci: routeCi || undefined, route_code: routeCode || undefined });
      setNote(d.ok ? { kind: "ok", text: "Saved. Applies after a restart (More › Restart Mission Control)." }
                   : { kind: "err", text: d.error || "Failed" });
    } catch (e) { setNote({ kind: "err", text: String(e.message || e) }); }
    setBusy(false);
  }

  const agents = agentOptions(state);
  return (
    <Shell title="GitHub" onBack={onBack}>
      <Dim size={14}>Optional. Watched repositories post their events into the right agent's chat.</Dim>
      <Rule label="Watching" />
      <Toggle label="GitHub bridge" value={enabled} onChange={setEnabled} style={{ marginTop: 0 }} />
      <Field label="Repositories" value={repos} onChangeText={setRepos} placeholder="owner/repo, owner/other" />
      <Choice label="CI and deploy events go to" options={agents} value={routeCi} onChange={setRouteCi} />
      <Choice label="Code events go to" options={agents} value={routeCode} onChange={setRouteCode} />
      <Keys><Key label="Save" busy={busy} onPress={save} /></Keys>
      <Note note={note} />
    </Shell>
  );
}
