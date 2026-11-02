// What the agent knows and how it works: shared memory every task reads,
// procedures it saved as skills, and step-by-step playbooks for websites.
// Fix a wrong memory or delete a stale one and every task sees the change
// on its next turn.
import React, { useEffect, useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import Icon from "../components/Icon";
import { agentName } from "../components/Work";
import { api } from "../api";
import * as store from "../store";
import { useStore } from "../store";
import { FONTS, T, ago } from "../theme";
import { Button, Card, Empty, Header, Input, Item, ItemIcon, List, Pill, Pre, Screen, Segmented, Sheet, Title, Toggle,
         Txt, haptic, notify } from "../ui";

export default function KnowledgeScreen({ nav, onBack, tab: initial }) {
  const [tab, setTab] = useState(initial || "memory");
  return (
    <View style={{ flex: 1 }}>
      <Header onBack={onBack} />
      <Screen>
        <Title sub="Shared memory every task reads, procedures it saved as skills, and step-by-step playbooks for websites.">
          Knowledge
        </Title>
        <Segmented value={tab} onChange={setTab} style={{ marginBottom: 14 }}
          options={[{ value: "memory", label: "Memory" }, { value: "skills", label: "Skills" }, { value: "playbooks", label: "Playbooks" }]} />
        {tab === "memory" && <Memory />}
        {tab === "skills" && <Skills nav={nav} />}
        {tab === "playbooks" && <Playbooks />}
      </Screen>
    </View>
  );
}

function Memory() {
  const agents = store.agentsById(useStore((s) => s.state));
  const [q, setQ] = useState("");
  const [rows, setRows] = useState(null);
  const [editing, setEditing] = useState(null);
  const [armed, setArmed] = useState(null);
  const [fact, setFact] = useState("");
  const [busy, setBusy] = useState(false);
  const [whole, setWhole] = useState({});     // long memories open to their full text when tapped
  const seq = useRef(0), timer = useRef(null);

  async function load(query = q) {
    const mine = ++seq.current;
    try {
      const d = await api.memory(query.trim());
      if (mine === seq.current) setRows(query.trim() ? d.memories : [...d.memories].reverse());
    } catch (e) { notify(e.message, true); }
  }
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => load(q), 220);
    return () => clearTimeout(timer.current);
  }, [q]);

  async function save() {
    try { await api.call("PUT", `/api/memory/${editing.id}`, { text: editing.text }); setEditing(null); load(); }
    catch (e) { notify(e.message, true); }
  }
  async function remove(id) {
    if (armed !== id) { setArmed(id); return; }
    setArmed(null);
    try { await api.call("DELETE", `/api/memory/${id}`); setRows((r) => r.filter((m) => m.id !== id)); }
    catch (e) { notify(e.message, true); }
  }
  async function remember() {
    if (!fact.trim()) return;
    setBusy(true);
    try {
      const r = await api.command(`/remember ${fact.trim()}`);
      setFact("");
      notify(r.reply || "Remembered.");
      haptic.done();
      load();
    } catch (e) { notify(e.message, true); }
    setBusy(false);
  }

  return (
    <>
      <View style={{ marginBottom: 10 }}>
        <View style={{ position: "absolute", left: 12, top: 0, bottom: 0, justifyContent: "center", zIndex: 1 }}>
          <Icon name="search" size={16} color={T.text4} />
        </View>
        <Input value={q} onChangeText={setQ} placeholder="Search facts, decisions, names" autoCorrect={false}
          clearButtonMode="while-editing" inputStyle={{ paddingLeft: 36 }} />
      </View>
      <Card pad={12} style={{ marginBottom: 12, flexDirection: "row", gap: 8, alignItems: "center" }}>
        <TextInput value={fact} onChangeText={setFact} placeholder="Remember something"
          placeholderTextColor={T.text4} keyboardAppearance={T.scheme} selectionColor={T.focus} multiline
          style={{ flex: 1, fontSize: 15, color: T.text, maxHeight: 100, paddingVertical: 4 }} />
        <Button label="Save" kind="primary" small busy={busy} disabled={!fact.trim()} onPress={remember} />
      </Card>
      {rows === null ? <Txt color={T.text3}>Loading…</Txt> : rows.length ? (
        <List>
          {rows.slice(0, 200).map((m) => (
            <View key={m.id} style={{ padding: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Txt size={11.5} weight="500" color={T.text2} style={{ backgroundColor: T.surface2, borderRadius: 6,
                  paddingHorizontal: 7, paddingVertical: 1, overflow: "hidden" }}>{m.kind || "fact"}</Txt>
                <Txt size={12.5} color={T.text3} style={{ flex: 1 }} numberOfLines={1}>
                  {agentName(m.author, agents)} · {ago(m.ts)}
                </Txt>
                {editing?.id !== m.id && (
                  <>
                    <Pressable hitSlop={8} onPress={() => setEditing({ id: m.id, text: m.text })} accessibilityLabel="Edit">
                      <Icon name="edit" size={16} color={T.text3} />
                    </Pressable>
                    <Pressable hitSlop={8} onPress={() => remove(m.id)} accessibilityLabel="Delete"
                      style={{ marginLeft: 10, flexDirection: "row", alignItems: "center", gap: 4 }}>
                      {armed === m.id ? <Txt size={12.5} weight="600" color={T.danger}>Delete?</Txt>
                        : <Icon name="x" size={16} color={T.text4} />}
                    </Pressable>
                  </>
                )}
              </View>
              {editing?.id === m.id ? (
                <>
                  <Input value={editing.text} onChangeText={(t) => setEditing({ ...editing, text: t })} multiline
                    autoCapitalize="sentences" style={{ marginTop: 8 }} inputStyle={{ minHeight: 90, textAlignVertical: "top" }} />
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                    <Button label="Save" kind="primary" small onPress={save} />
                    <Button label="Cancel" kind="ghost" small onPress={() => setEditing(null)} />
                  </View>
                </>
              ) : (
                <Pressable onPress={() => setWhole((w) => ({ ...w, [m.id]: !w[m.id] }))}>
                  <Txt size={14.5} selectable={!!whole[m.id]} numberOfLines={whole[m.id] ? undefined : 8}
                    style={{ marginTop: 6 }}>{m.text}</Txt>
                </Pressable>
              )}
            </View>
          ))}
        </List>
      ) : <Card><Empty compact text={q ? "Nothing matches." : "Nothing saved yet."} /></Card>}
    </>
  );
}

function sampleInputs(s) {
  const sample = {};
  for (const [name, spec] of Object.entries(s.contract?.inputs?.properties || {})) {
    sample[name] = spec.default ?? spec.examples?.[0] ?? (spec.type === "number" || spec.type === "integer" ? 1
      : spec.type === "boolean" ? false : spec.type === "array" ? [] : spec.type === "object" ? {} : "");
  }
  return JSON.stringify(sample, null, 2);
}

function Skills({ nav }) {
  // the list arrives with the rest of the state; only the setting is asked for
  const loaded = useStore((s) => s.loaded);
  const skills = useStore((s) => (s.loaded ? s.control.skills : null));
  const [autolearn, setAutolearn] = useState(true);
  const [open, setOpen] = useState(null);     // {s, content, mode: "read" | "run", inputs}
  const [busy, setBusy] = useState("");
  const [armed, setArmed] = useState(false);

  const load = () => store.refreshControl();
  useEffect(() => {
    api.get("/api/skills").then((d) => setAutolearn(d.autolearn !== false)).catch(() => {});
  }, []);

  async function read(s) {
    try { const d = await api.skill(s.slug); setOpen({ s, content: d.content, mode: "read" }); setArmed(false); }
    catch (e) { notify(e.message, true); }
  }
  async function save() {
    setBusy("save");
    try { await api.call("PUT", `/api/skills/${encodeURIComponent(open.s.slug)}`, { content: open.content }); notify("Saved."); load(); }
    catch (e) { notify(e.message, true); }
    setBusy("");
  }
  async function remove() {
    if (!armed) { setArmed(true); return; }
    try { await api.call("DELETE", `/api/skills/${encodeURIComponent(open.s.slug)}`); setOpen(null); load(); }
    catch (e) { notify(e.message, true); }
  }
  async function run() {
    setBusy("run");
    try {
      const inputs = JSON.parse(open.inputs);
      const r = await api.command(`/skill ${open.s.slug} ${JSON.stringify(inputs)}`);
      setOpen(null);
      notify(r.mission ? `Skill started as task ${r.mission.id}.` : (r.reply || "Started."));
      store.refreshControl();
      nav.push({ kind: "tasks" });
    } catch (e) { notify(e instanceof SyntaxError ? "Inputs are not valid JSON." : e.message, true); }
    setBusy("");
  }
  async function setLearn(v) {
    setAutolearn(v);
    try { await api.call("PUT", "/api/skills-autolearn", { autolearn: v }); }
    catch (e) { setAutolearn(!v); notify(e.message, true); }
  }

  return (
    <>
      <Card pad={14} style={{ marginBottom: 12 }}>
        <Toggle label="Learn new skills" sub="After a long turn, a task writes down a procedure worth keeping"
          value={autolearn} onChange={setLearn} style={{ marginTop: 0 }} />
      </Card>
      {!loaded || !skills ? <Txt color={T.text3}>Loading…</Txt> : skills.length ? (
        <View style={{ gap: 10 }}>
          {skills.map((s) => (
            <Card key={s.slug} pad={16} style={{ gap: 8 }}>
              <Txt size={15} weight="600">{s.name}</Txt>
              <Txt size={13.5} color={T.text2}>{s.description || "A saved procedure."}</Txt>
              {!!s.avoid && <Txt size={13} color={T.text3}>Not for: {s.avoid}</Txt>}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                {s.valid ? <Pill status="completed" label="Valid" /> : <Pill status="failed" label="Needs attention" />}
                <Txt size={12.5} color={T.text3} style={{ flex: 1 }}>{s.uses ? `used ${s.uses}×` : "not used yet"}</Txt>
                <Button label="Open" kind="ghost" small onPress={() => read(s)} />
                <Button label="Run" small disabled={!s.valid} onPress={() => setOpen({ s, mode: "run", inputs: sampleInputs(s) })} />
              </View>
            </Card>
          ))}
        </View>
      ) : (
        <Card><Empty title="No skills yet" text="When a task works out a procedure worth keeping, it is saved here for the whole team." /></Card>
      )}
      {!!open && open.mode === "read" && (
        <Sheet visible onClose={() => setOpen(null)} title={open.s.name}>
          <Input value={open.content} onChangeText={(t) => setOpen({ ...open, content: t })} multiline
            autoCapitalize="none" autoCorrect={false}
            inputStyle={{ minHeight: 320, fontFamily: FONTS.mono, fontSize: 12.5, lineHeight: 19, textAlignVertical: "top" }} />
          {!!open.s.error && <Txt size={13} color={T.danger} style={{ marginTop: 10 }}>{open.s.error}</Txt>}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <Button label="Save" kind="primary" small busy={busy === "save"} onPress={save} />
            <Button label={armed ? "Delete this skill?" : "Delete"} kind={armed ? "confirm" : "ghost"} small onPress={remove} />
          </View>
          <Txt size={15} weight="600" style={{ marginTop: 22 }}>Contract</Txt>
          <Pre>{JSON.stringify(open.s.contract, null, 2)}</Pre>
        </Sheet>
      )}
      {!!open && open.mode === "run" && (
        <Sheet visible onClose={() => setOpen(null)} title={`Run ${open.s.name}`}>
          <Txt size={14} color={T.text2}>{open.s.description}</Txt>
          <Txt size={12.5} color={T.text3} style={{ marginTop: 8 }}>
            {open.s.contract?.max_tool_calls} tool calls · {open.s.contract?.timeout_seconds}s · version {open.s.contract?.version}
          </Txt>
          <Txt size={15} weight="600" style={{ marginTop: 20, marginBottom: 6 }}>Inputs</Txt>
          <Input value={open.inputs} onChangeText={(t) => setOpen({ ...open, inputs: t })} multiline autoCapitalize="none"
            autoCorrect={false} inputStyle={{ minHeight: 160, fontFamily: FONTS.mono, fontSize: 12.5, lineHeight: 19, textAlignVertical: "top" }} />
          <Button label="Start" icon="play" kind="primary" busy={busy === "run"} onPress={run}
            style={{ marginTop: 14, alignSelf: "flex-start" }} />
        </Sheet>
      )}
    </>
  );
}

function Playbooks() {
  const agents = store.agentsById(useStore((s) => s.state));
  const [rows, setRows] = useState(null);
  const [armed, setArmed] = useState(null);
  async function load() {
    try { setRows((await api.playbooks()).playbooks || []); } catch (e) { notify(e.message, true); }
  }
  useEffect(() => { load(); }, []);
  async function remove(p) {
    const key = p.site + "|" + p.title;
    if (armed !== key) { setArmed(key); return; }
    setArmed(null);
    try { await api.call("POST", "/api/playbooks/delete", { site: p.site, title: p.title }); load(); }
    catch (e) { notify(e.message, true); }
  }
  if (rows === null) return <Txt color={T.text3}>Loading…</Txt>;
  if (!rows.length) {
    return <Card><Empty compact text="No playbooks yet. A task saves one after it works out how to do something on a website." /></Card>;
  }
  return (
    <List>
      {rows.map((p) => {
        const key = p.site + "|" + p.title;
        return (
          <Item key={key} left={<ItemIcon name="globe" />} title={p.title}
            sub={`${p.site} · ${agentName(p.author, agents)} · ${ago(p.ts)}`}
            right={<Button label={armed === key ? "Delete?" : "Delete"} kind={armed === key ? "confirm" : "ghost"} small
              onPress={() => remove(p)} />} />
        );
      })}
    </List>
  );
}
