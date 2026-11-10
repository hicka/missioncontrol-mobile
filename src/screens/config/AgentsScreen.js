import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { api } from "../../api";
import Presence, { AgentMark } from "../../components/Presence";
import { useStore } from "../../store";
import { T } from "../../theme";
import { Area, Dim, Field, Item, Key, Keys, Label, List, Note, Rule, Shell } from "../../ui";

// the desktop's swatches; the near-black one takes the theme's ink on dark
const SWATCHES = ["#7a68c9", "#e0559b", "#d6493f", "#f5a623", "#3aa655", "#30c8bd", "#3f7bd9", "#8e8e93", "#1d1d1f"];

export default function AgentsScreen({ nav, onBack, onChanged, editId }) {
  const unread = useStore((s) => s.unread);
  const [agents, setAgents] = useState([]);
  const [edit, setEdit] = useState(null);   // {id?, name, blurb, cwd, color, prompt}
  const [note, setNote] = useState(null);
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState(false);

  async function load() {
    try {
      const list = (await api.get("/api/agents-full")).agents || [];
      setAgents(list);
      return list;
    } catch (e) { setNote({ kind: "err", text: String(e.message || e) }); return []; }
  }
  useEffect(() => {
    load().then((list) => {
      const a = editId && list.find((x) => x.id === editId);
      if (a) open(a);
    });
  }, []);

  function open(a) {
    setConfirm(false); setNote(null);
    setEdit(a ? { ...a } : { name: "", blurb: "", cwd: "~", color: SWATCHES[0], prompt: "" });
  }

  async function save() {
    setBusy("save"); setNote({ kind: "busy", text: "Saving" });
    const body = { name: edit.name.trim(), blurb: edit.blurb.trim(), cwd: edit.cwd.trim() || "~",
                   color: edit.color, prompt: edit.prompt };
    try {
      const d = edit.id ? await api.put(`/api/agents/${encodeURIComponent(edit.id)}`, body)
                        : await api.post("/api/agents", body);
      if (d.ok) { setNote({ kind: "ok", text: "Saved" }); setEdit(null); load(); onChanged && onChanged(); }
      else setNote({ kind: "err", text: d.error || "Failed" });
    } catch (e) { setNote({ kind: "err", text: String(e.message || e) }); }
    setBusy("");
  }

  async function remove() {
    if (!confirm) { setConfirm(true); return; }
    setBusy("del");
    try {
      const d = await api.del(`/api/agents/${encodeURIComponent(edit.id)}`);
      if (d.ok) { setEdit(null); load(); onChanged && onChanged(); }
      else setNote({ kind: "err", text: d.error || "Failed" });
    } catch (e) { setNote({ kind: "err", text: String(e.message || e) }); }
    setBusy(""); setConfirm(false);
  }

  if (edit) {
    return (
      <Shell title={edit.id ? edit.name || "Profile" : "New profile"} onBack={onBack}>
        <View style={{ alignItems: "center", paddingVertical: 14 }}>
          <Presence color={edit.color} size={84} label={edit.name} />
        </View>
        <Field label="Name" value={edit.name} onChangeText={(v) => setEdit({ ...edit, name: v })}
          placeholder="Research Analyst" autoCapitalize="words" />
        <Field label="What it is for" value={edit.blurb} onChangeText={(v) => setEdit({ ...edit, blurb: v })}
          placeholder="One line, shown under its name" autoCapitalize="sentences" />
        <Field label="Working folder" value={edit.cwd} onChangeText={(v) => setEdit({ ...edit, cwd: v })} placeholder="~" />
        <View style={{ marginTop: 14 }}>
          <Label>Colour</Label>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {SWATCHES.map((c) => (
              <Pressable key={c} onPress={() => setEdit({ ...edit, color: c })} accessibilityLabel={`Colour ${c}`}
                style={{ width: 34, height: 34, borderRadius: 17, padding: 3, borderWidth: 2,
                         borderColor: edit.color === c ? T.text : "transparent" }}>
                <View style={{ flex: 1, borderRadius: 14, backgroundColor: c === "#1d1d1f" ? T.botDark : c,
                               borderWidth: c === "#1d1d1f" ? 1 : 0, borderColor: T.lineStrong }} />
              </Pressable>
            ))}
          </View>
        </View>
        <Area label="Instructions" value={edit.prompt} onChangeText={(v) => setEdit({ ...edit, prompt: v })}
          placeholder="Who this agent is and how it works" autoCapitalize="sentences" autoCorrect />
        <Keys>
          <Key label="Save" busy={busy === "save"} disabled={!edit.name.trim() || !edit.prompt.trim()} onPress={save} />
          {!!edit.id && (
            <Key label={confirm ? "Yes, remove it" : "Remove"} kind="danger" busy={busy === "del"} onPress={remove} />
          )}
          {confirm && <Key label="Cancel" kind="ghost" onPress={() => setConfirm(false)} />}
          {!confirm && !editId && <Key label="Back to profiles" kind="ghost" onPress={() => setEdit(null)} />}
        </Keys>
        <Note note={note} />
      </Shell>
    );
  }

  return (
    <Shell title="Profiles" onBack={onBack}>
      <Dim size={14}>The roles a task can run as. Open one to see its work, write to it directly, or change it.</Dim>
      <Rule label={`Roster · ${agents.length}`} />
      <List>
        {agents.map((a) => (
          <Item key={a.id} onPress={() => (nav ? nav.openProfile(a.id) : open(a))} left={<AgentMark agent={a} size={36} />} title={a.name}
            sub={a.blurb || "No description"} chevron
            right={unread[`dm:${a.id}`] ? <View accessibilityLabel="New message" style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: T.text }} /> : null} />
        ))}
      </List>
      <Keys>
        <Key label="New profile" onPress={() => open(null)} />
      </Keys>
      <Note note={note} />
    </Shell>
  );
}
