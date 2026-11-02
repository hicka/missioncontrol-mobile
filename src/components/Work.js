// A task record and the steps inside it, for a profile's history, which reaches
// further back than the kernel's list of live sessions.
import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { api } from "../api";
import * as store from "../store";
import { useStore } from "../store";
import { T, ago } from "../theme";
import { Button, Empty, Item, ItemIcon, List, Pill, Pre, Sheet, Txt, notify } from "../ui";

export function agentName(id, agents) {
  return agents?.[id]?.name || (id === "*" ? "Everywhere" : id) || "Someone";
}

// what a running tool is working on, in one line
export function toolDetail(e) {
  const args = (e?.detail || {}).arguments;
  if (!args) return "";
  try {
    const a = typeof args === "string" ? JSON.parse(args) : args;
    return String(a.command || a.url || a.query || a.action || a.text || a.prompt || a.task || a.name || "").replace(/\s+/g, " ").slice(0, 120);
  } catch { return String(args).slice(0, 120); }
}

export const RESUMABLE = ["waiting", "failed", "cancelled"];

// One task, whole: what was asked, the latest result or checkpoint, and every
// step recorded for it. Steps open in place.
export function TaskSheet({ taskId, executionId, onClose, nav }) {
  const control = useStore((s) => s.control);
  const agents = store.agentsById(useStore((s) => s.state));
  const [step, setStep] = useState(executionId || null);
  const [busy, setBusy] = useState(false);
  const m = (control.missions || []).find((x) => x.id === taskId);
  const e = step ? (control.executions || []).find((x) => x.id === step) : null;

  async function resume() {
    setBusy(true);
    try {
      await api.command(`/resume ${m.id}`);
      notify("Resumed.");
      store.refreshControl();
      onClose();
    } catch (err) { notify(err.message, true); }
    setBusy(false);
  }

  if (e) {
    let inputs = e.detail;
    try { inputs = JSON.stringify(e.detail, null, 2); } catch {}
    return (
      <Sheet visible onClose={onClose} title={e.name.replace(/_/g, " ")}
        right={taskId ? <Pressable onPress={() => setStep(null)} hitSlop={8}><Txt size={15} color={T.text2}>Task</Txt></Pressable> : null}>
        <Pill status={e.status} />
        <Txt size={13} color={T.text3} style={{ marginTop: 10 }}>
          {agentName(e.agent, agents)} · {e.kind} · {new Date(e.ts * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          {" · "}{Math.max(0, (e.updated || e.ts) - e.ts).toFixed(1)}s
        </Txt>
        <Txt size={15} weight="600" style={{ marginTop: 22 }}>Inputs</Txt>
        <Pre>{inputs}</Pre>
        <Txt size={15} weight="600" style={{ marginTop: 22 }}>Result</Txt>
        <Pre>{e.result || (e.status === "running" ? "Running…" : "No output recorded.")}</Pre>
      </Sheet>
    );
  }

  if (!m) {
    return (
      <Sheet visible onClose={onClose} title="Task">
        <Empty title="This task is gone" text="It may have been cleared since the list was drawn." />
      </Sheet>
    );
  }
  const steps = (control.executions || []).filter((x) => x.mission === m.id);
  const live = (store.get().kernel?.sessions || control.workers || []).find((w) => w.mission === m.id);
  return (
    <Sheet visible onClose={onClose} title="Task">
      <Pill status={m.status} />
      <Txt size={15} weight="600" style={{ marginTop: 18 }}>Objective</Txt>
      <Pre>{m.objective}</Pre>
      <Txt size={15} weight="600" style={{ marginTop: 22 }}>Latest result or checkpoint</Txt>
      <Pre>{m.result || "No result has been reported yet."}</Pre>
      {steps.length > 0 && (
        <>
          <Txt size={15} weight="600" style={{ marginTop: 22, marginBottom: 10 }}>Steps recorded</Txt>
          <List>
            {steps.slice(0, 20).map((x) => (
              <Item key={x.id} onPress={() => setStep(x.id)} left={<ItemIcon name="bolt" />}
                title={x.name.replace(/_/g, " ")} sub={`${agentName(x.agent, agents)} · ${ago(x.ts)}`}
                right={<Pill status={x.status} />} lines={1} />
            ))}
          </List>
        </>
      )}
      <Txt size={12.5} color={T.text3} style={{ marginTop: 18 }}>
        {agentName(m.agent, agents)} · task {m.id} · started {new Date(m.ts * 1000).toLocaleString()}
      </Txt>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
        {!!live && <Button label="Open task" kind="primary" onPress={() => { onClose(); nav.openTask(live.id); }} />}
        {RESUMABLE.includes(m.status) && <Button label="Resume" busy={busy} onPress={resume} />}
      </View>
    </Sheet>
  );
}
