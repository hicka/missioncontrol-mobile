import React, { useState } from "react";
import { api } from "../../api";
import { Choice, Dim, Field, Key, Keys, Note, Rule, Shell } from "../../ui";

const KINDS = [{ value: "skills", label: "Skills" }, { value: "agents", label: "Agents" }];

export default function ImportScreen({ onBack, onChanged }) {
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState("skills");
  const [note, setNote] = useState(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true); setNote({ kind: "busy", text: "Importing" });
    try {
      const d = await api.post("/api/import", { url: url.trim(), kind });
      if (d.ok) {
        setNote({ kind: "ok", text: `Imported ${d.imported} ${d.kind}` });
        if (d.kind === "agents") onChanged && onChanged();
      } else setNote({ kind: "err", text: d.error || "Failed" });
    } catch (e) { setNote({ kind: "err", text: String(e.message || e) }); }
    setBusy(false);
  }

  return (
    <Shell title="Import" onBack={onBack}>
      <Dim size={14}>
        Pull skills or an agent roster from a git repository. Only import sources you trust: skills are instructions
        your agents will follow.
      </Dim>
      <Rule label="From git" />
      <Field label="Repository address" value={url} onChangeText={setUrl}
        placeholder="https://github.com/owner/repo" keyboardType="url" />
      <Choice label="Import" options={KINDS} value={kind} onChange={setKind} />
      <Keys><Key label="Import" busy={busy} disabled={!url.trim()} onPress={run} /></Keys>
      <Note note={note} />
    </Shell>
  );
}
