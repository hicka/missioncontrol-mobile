// Search every message ever sent, however old, in the conversation, direct lines
// and tasks alike. A result opens where it was said, or the task it belongs to.
import React, { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import Icon from "../components/Icon";
import { Inline } from "../components/Rich";
import { api } from "../api";
import * as store from "../store";
import { useStore } from "../store";
import { T, listTime } from "../theme";
import { Empty, Header, Input, Screen, Txt } from "../ui";

export default function SearchScreen({ nav, onBack }) {
  const state = useStore((s) => s.state);
  const agents = store.agentsById(state);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState(null);
  const timer = useRef(null);
  const seq = useRef(0);

  useEffect(() => {
    clearTimeout(timer.current);
    const query = q.trim();
    const mine = ++seq.current;
    if (query.length < 2) { setHits(null); return undefined; }
    timer.current = setTimeout(async () => {
      try {
        const d = await api.get(`/api/search?q=${encodeURIComponent(query)}`);
        if (mine === seq.current) setHits(d.results || []);
      } catch { if (mine === seq.current) setHits([]); }
    }, 220);
    return () => clearTimeout(timer.current);
  }, [q]);

  // a2a traffic lives inside the direct lines of the roles involved
  const openHit = (m) => {
    const id = String(m.thread).startsWith("a2a:") ? `dm:${m.sender}` : String(m.thread);
    if (id.startsWith("task:")) nav.openMission(id.slice(5));
    else if ((state?.threads || []).some((t) => t.id === id)) nav.push({ kind: "chat", threadId: id, atId: m.id });
  };
  const openable = (m) => /^(a2a:|task:)/.test(String(m.thread)) || (state?.threads || []).some((t) => t.id === m.thread);
  const shown = (hits || []).filter(openable);

  return (
    <View style={{ flex: 1 }}>
      <Header title="Search" onBack={onBack} />
      <Screen>
        <View>
          <View style={{ position: "absolute", left: 12, top: 0, bottom: 0, justifyContent: "center", zIndex: 1 }}>
            <Icon name="search" size={16} color={T.text4} />
          </View>
          <Input value={q} onChangeText={setQ} placeholder="Search every message" returnKeyType="search" autoFocus
            clearButtonMode="while-editing" autoCorrect={false}
            inputStyle={{ paddingLeft: 36, backgroundColor: T.surface2, borderColor: "transparent" }} />
        </View>
        {hits !== null && !shown.length && <Empty compact text="Nothing found." />}
        <View style={{ marginTop: 14, gap: 2 }}>
          {shown.map((m) => {
            const who = m.sender === "user" ? "You" : agents[m.sender]?.name || m.sender;
            const where = String(m.thread).startsWith("task:") ? "A task" : String(m.thread) === store.leadThread(state) ? "" : "Direct line";
            return (
              <Pressable key={m.id} onPress={() => openHit(m)} accessibilityRole="button"
                style={({ pressed }) => ({ paddingVertical: 10, paddingHorizontal: 4, borderRadius: 10, backgroundColor: pressed ? T.hover : "transparent" })}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Txt size={13} weight="600" color={T.text2} numberOfLines={1} style={{ flex: 1 }}>{who}{where ? ` · ${where}` : ""}</Txt>
                  <Txt size={12.5} color={T.text4}>{listTime(m.ts)}</Txt>
                </View>
                <Inline text={String(m.text || "").replace(/\s+/g, " ").slice(0, 240)} size={14} numberOfLines={3} style={{ marginTop: 1 }} />
              </Pressable>
            );
          })}
        </View>
      </Screen>
    </View>
  );
}
