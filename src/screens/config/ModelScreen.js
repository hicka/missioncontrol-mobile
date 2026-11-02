import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { api } from "../../api";
import { T } from "../../theme";
import { Area, Card, Choice, Dim, Field, Key, Keys, Note, Rule, Shell, Txt } from "../../ui";

const LOCAL = new Set(["ollama", "lmstudio"]);

export default function ModelScreen({ onBack }) {
  const [full, setFull] = useState(null);
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [key, setKey] = useState("");
  const [fallbacks, setFallbacks] = useState("");
  const [models, setModels] = useState([]);
  const [usage, setUsage] = useState(null);
  const [budget, setBudget] = useState("0");
  const [budgetStatus, setBudgetStatus] = useState("");
  const [note, setNote] = useState(null);
  const [busy, setBusy] = useState("");

  function showBudget(b) {
    setBudget(String(b.daily_tokens || 0));
    setBudgetStatus(b.daily_tokens
      ? `${b.used_today.toLocaleString()} of ${b.daily_tokens.toLocaleString()} used today (${Math.round(b.pct * 100)}%)`
      : `${(b.used_today || 0).toLocaleString()} tokens used today, no limit`);
  }

  async function saveBudget() {
    setBusy("budget");
    try {
      const d = await api.put("/api/settings/budget", { daily_tokens: parseInt(budget, 10) || 0 });
      if (d.ok) showBudget(d); else setNote({ kind: "err", text: d.error });
    } catch (e) { setNote({ kind: "err", text: String(e.message || e) }); }
    setBusy("");
  }

  async function load() {
    try {
      const f = await api.get("/api/settings/full");
      setFull(f);
      setProvider(f.llm.provider);
      setModel(f.llm.model || "");
      setBaseUrl(f.llm.base_url || "");
      setFallbacks((f.llm.fallbacks || []).map((x) => `${x.provider} ${x.model}`).join("\n"));
      setKey("");
    } catch (e) { setNote({ kind: "err", text: String(e.message || e) }); }
    try { setUsage(await api.get("/api/usage")); } catch {}
    try { showBudget(await api.get("/api/settings/budget")); } catch {}
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!provider) return;
    let dead = false;
    api.get(`/api/settings/llm/models?provider=${encodeURIComponent(provider)}`
            + `&base_url=${encodeURIComponent(baseUrl)}`)
      .then((d) => { if (!dead) setModels(d.models || []); })
      .catch(() => { if (!dead) setModels([]); });
    return () => { dead = true; };
  }, [provider, baseUrl]);

  const presets = full?.llm?.presets || {};
  const preset = presets[provider] || {};
  const local = LOCAL.has(provider);
  const showBase = local || !preset.base_url;
  const showKey = !!preset.key_env;
  const keySaved = full?.llm?.key_set && provider === full?.llm?.provider;

  function body() {
    const fb = fallbacks.split("\n").map((l) => {
      const [p, m, b] = l.trim().split(/\s+/);
      return p && m ? { provider: p, model: m, base_url: b || "" } : null;
    }).filter(Boolean);
    return { provider, model: model.trim(), base_url: baseUrl.trim(),
             max_tokens: full?.llm?.max_tokens || 3000, api_key: key.trim() || null,
             fallbacks: fb };
  }

  async function test() {
    setBusy("test"); setNote({ kind: "busy", text: "Testing the connection" });
    try {
      const d = await api.post("/api/settings/llm/test", body());
      setNote(d.ok ? { kind: "ok", text: "Connection works" } : { kind: "err", text: d.error || "Failed" });
    } catch (e) { setNote({ kind: "err", text: String(e.message || e) }); }
    setBusy("");
  }

  async function save() {
    setBusy("save"); setNote({ kind: "busy", text: "Saving" });
    try {
      const d = await api.put("/api/settings/llm", body());
      setNote(d.ok ? { kind: "ok", text: "Saved" } : { kind: "err", text: d.error || "Failed" });
      if (d.ok) load();
    } catch (e) { setNote({ kind: "err", text: String(e.message || e) }); }
    setBusy("");
  }

  const fmtK = (n) => (n > 9999 ? `${Math.round(n / 1000)}k` : `${n}`);

  return (
    <Shell title="Model" onBack={onBack}>
      <Dim size={14}>The model it thinks with, plus the ones it falls back to.</Dim>
      <Rule label="Provider" />
      <Choice options={Object.entries(presets).map(([k, p]) => ({ value: k, label: p.label }))}
        value={provider} onChange={(p) => { setProvider(p); setModel((presets[p]?.models || [])[0] || ""); }} />
      <Dim size={13.5} style={{ marginTop: 10 }}>
        {local ? "Runs on your Mac. Private, free, no key needed."
          : preset.key_env ? "The key is stored in the server's local .env and never synced anywhere."
          : "Point this at any compatible endpoint."}
      </Dim>
      <Field label="Model" value={model} onChangeText={setModel} placeholder="Model id" />
      {models.length > 0 && (
        <Choice options={models.slice(0, 12).map((m) => ({ value: m, label: m }))}
          value={model} onChange={setModel} style={{ marginTop: 8 }} />
      )}
      {showBase && (
        <Field label="Base address" value={baseUrl} onChangeText={setBaseUrl}
          placeholder={preset.base_url || "https://host/v1"} keyboardType="url" />
      )}
      {showKey && (
        <Field label="API key" value={key} onChangeText={setKey} secureTextEntry
          placeholder={keySaved ? "Saved (paste to replace)" : "Paste the key"} />
      )}
      <Rule label="Fallbacks" />
      <Dim size={13.5}>One per line, provider then model, tried in order when the primary fails.</Dim>
      <Area value={fallbacks} onChangeText={setFallbacks} placeholder={"anthropic claude-sonnet-5-5\nollama llama3"} />
      <Keys>
        <Key label="Test" kind="ghost" busy={busy === "test"} disabled={!model} onPress={test} />
        <Key label="Save" busy={busy === "save"} disabled={!model} onPress={save} />
      </Keys>
      <Note note={note} />
      <Rule label="Daily budget" />
      <Dim size={13.5}>
        A token ceiling per day; 0 means no limit. A warning at 80%, a pause at 100%.
      </Dim>
      <Field label="Tokens per day" value={budget} onChangeText={setBudget} keyboardType="number-pad" placeholder="0" />
      {!!budgetStatus && <Dim size={13.5} style={{ marginTop: 8 }}>{budgetStatus}</Dim>}
      <Keys><Key label="Save budget" kind="ghost" busy={busy === "budget"} onPress={saveBudget} /></Keys>
      <Rule label={`Usage · last ${usage?.days || 7} days`} />
      {!usage || !usage.per_agent?.length ? (
        <Dim size={14}>No model calls recorded yet.</Dim>
      ) : (
        <Card>
          {usage.per_agent.map((r, i) => (
            <View key={r.agent} style={{ flexDirection: "row", gap: 10, paddingHorizontal: 14, paddingVertical: 10,
                                         borderTopWidth: i ? 1 : 0, borderColor: T.line }}>
              <Txt size={14} numberOfLines={1} style={{ flex: 1 }}>{r.agent}</Txt>
              <Txt size={13} color={T.text3} style={{ fontVariant: ["tabular-nums"] }}>{fmtK(r.in_tokens)} in</Txt>
              <Txt size={13} color={T.text3} style={{ fontVariant: ["tabular-nums"] }}>{fmtK(r.out_tokens)} out</Txt>
              <Txt size={13} color={T.text3} style={{ fontVariant: ["tabular-nums"] }}>{r.calls} calls</Txt>
            </View>
          ))}
        </Card>
      )}
    </Shell>
  );
}
