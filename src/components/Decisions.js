// Everything waiting on the owner: a question from a task, commands and tool
// calls the guard held, jobs asking to start, proposed changes, sign-ins and
// lessons that need a decision. Whatever is approved here runs exactly as shown,
// so nothing that will run is shortened: a held command in full, with what moved
// since a near-identical one was answered, and a job's whole task and the shell
// check it runs before every fire. Anything that runs on the Mac asks twice.
import React, { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import Icon from "./Icon";
import { DiffView } from "./Messages";
import { codeSpans } from "./Rich";
import { agentName } from "./Work";
import { api } from "../api";
import * as store from "../store";
import { T, ago } from "../theme";
import { Button, Card, Input, ItemIcon, Pre, Sheet, Txt, haptic, notify } from "../ui";

export const KIND = {
  question: { icon: "chat", tone: "signal", label: "A task needs your answer" },
  command: { icon: "shield", tone: "signal", label: "Command held for you" },
  tool: { icon: "shield", tone: "signal", label: "Tool call held for you" },
  job: { icon: "clock", tone: "info", label: "Recurring job wants to start" },
  proposal: { icon: "branch", tone: "info", label: "Proposed change to Mission Control" },
  signin: { icon: "globe", tone: "signal", label: "Website sign-in" },
  lesson: { icon: "flask", tone: "warn", label: "Lesson needs a decision" },
};

// Three near-identical held commands are impossible to tell apart, so say
// which one was already answered and what moved since.
function Prior({ prior }) {
  const [open, setOpen] = useState(false);
  if (!prior) return null;
  const when = new Date(prior.ts * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const verb = prior.status === "denied" ? "declined" : "approved";
  if (prior.identical) {
    return <Txt size={13.5} color={T.warn} style={{ marginTop: 8 }}>
      Identical to the command you {verb} at {when}. Running it runs it again.
    </Txt>;
  }
  return (
    <View style={{ marginTop: 8 }}>
      <Pressable onPress={() => setOpen(!open)} hitSlop={6} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <View style={{ transform: [{ rotate: open ? "90deg" : "0deg" }] }}><Icon name="chev" size={14} color={T.text3} /></View>
        <Txt size={13.5} color={T.text3}>Differs from the command you {verb} at {when}</Txt>
      </Pressable>
      {open && (prior.diff?.length ? <View style={{ marginTop: 6 }}><DiffView text={prior.diff.join("\n")} /></View>
        : <Txt size={13} color={T.text3} style={{ marginTop: 6 }}>Only whitespace changed.</Txt>)}
    </View>
  );
}

// A line for something waiting, shut: enough to know what it is. Opening it shows
// the whole thing, and only then can it be answered.
export function DecisionRow({ i, agents, onPress }) {
  const k = KIND[i.kind] || { icon: "inbox", tone: "", label: i.kind };
  const code = i.kind === "command" || i.kind === "tool";
  const who = i.agent && i.agent !== "*" ? agentName(i.agent, agents) : "";
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityHint="Shows it whole"
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 14, paddingVertical: 11,
                                 backgroundColor: pressed ? T.hover : "transparent" })}>
      <ItemIcon name={k.icon} tone={k.tone} size={28} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt size={code ? 12.5 : 14.5} mono={code} weight={code ? "400" : "500"} numberOfLines={1}>{String(i.title).split("\n")[0]}</Txt>
        <Txt size={12.5} color={T.text3} numberOfLines={1} style={{ marginTop: 1 }}>{k.label}{who ? ` · ${who}` : ""}</Txt>
      </View>
      <Txt size={12.5} color={T.text3}>{ago(i.ts)}</Txt>
      <Icon name="chev" size={15} color={T.text4} />
    </Pressable>
  );
}

export function Decision({ i, agents, nav }) {
  const [busy, setBusy] = useState("");
  const [armed, setArmed] = useState("");      // an action waiting for its second tap
  const [diff, setDiff] = useState(null);
  const [answer, setAnswer] = useState("");
  const disarm = useRef(null);
  useEffect(() => () => clearTimeout(disarm.current), []);
  const k = KIND[i.kind] || { icon: "inbox", tone: "", label: i.kind };
  const who = i.agent && i.agent !== "*" ? agentName(i.agent, agents) : (i.kind === "lesson" ? "Everywhere" : "");

  function twice(key) {
    if (armed === key) { setArmed(""); return true; }
    setArmed(key);
    haptic.warn();
    clearTimeout(disarm.current);
    disarm.current = setTimeout(() => setArmed(""), 4000);
    return false;
  }

  async function run(key, fn, done) {
    setBusy(key);
    try {
      const said = await fn();
      haptic.done();
      if (typeof said === "string") notify(said);
      else if (done) notify(done);
      await store.refreshControl();
      store.refreshKernel();
    } catch (e) { notify(e.message, true); }
    setBusy("");
  }

  let sub = null, actions = null;
  if (i.kind === "question") {
    sub = (
      <>
        <Txt size={13.5} color={T.text3} style={{ marginTop: 8 }}>
          <Txt size={13.5} color={T.text2}>{who}</Txt> stopped on this while working on: {i.detail}
        </Txt>
        <Input value={answer} onChangeText={setAnswer} multiline placeholder="Your answer goes straight to this task."
          autoCapitalize="sentences" style={{ marginTop: 10 }} inputStyle={{ minHeight: 44, maxHeight: 130 }} />
      </>
    );
    actions = (
      <>
        <Button label="Send" kind="primary" small busy={busy === "answer"} disabled={!answer.trim()}
          onPress={() => run("answer", async () => { await api.stepIn(i.id, answer.trim()); setAnswer(""); }, "Sent.")} />
        <Button label="Open task" small onPress={() => nav.openTask(i.id)} />
      </>
    );
  } else if (i.kind === "command" || i.kind === "tool") {
    sub = (
      <>
        <Txt size={13.5} color={T.text3} style={{ marginTop: 8 }}>
          {i.kind === "command" ? (
            <>
              <Txt size={13.5} color={T.text2}>{who}</Txt> wants to run this in <Txt size={13.5} mono color={T.text2}>{i.detail}</Txt>.
              Running it runs exactly what is shown.
            </>
          ) : (
            <>
              <Txt size={13.5} color={T.text2}>{who}</Txt> wants to make this change through the {i.detail} MCP server,
              which marks it as one that cannot be taken back. Approving sends exactly what is shown.
            </>
          )}
        </Txt>
        {!!i.reason && <Txt size={13} color={T.text3} style={{ marginTop: 4 }}>Held because: {i.reason}</Txt>}
        <Prior prior={i.prior} />
      </>
    );
    const yes = i.kind === "command" ? "Run it" : "Approve";
    actions = (
      <>
        <Button label={armed === "run" ? `Tap again to ${yes.toLowerCase()}` : yes} kind={armed === "run" ? "danger-primary" : "primary"}
          small busy={busy === "run"} onPress={() => twice("run") &&
            run("run", async () => {
              const r = await api.approval(i.id, "approve");
              const out = String((r.approvals || []).find((a) => a.id === i.id)?.result || "");
              // approved can still be refused by policy, and the answer is ok either way
              if (/blocked by policy/i.test(out)) return `Refused: ${out.slice(0, 160)}`;
              return i.kind === "command" ? "It ran. The task has the output." : "Sent. The task has the result.";
            })} />
        <Button label="Decline" small busy={busy === "deny"}
          onPress={() => run("deny", () => api.approval(i.id, "deny"), "Declined. The task has been told.")} />
      </>
    );
  } else if (i.kind === "job") {
    sub = (
      <>
        <Txt size={13.5} color={T.text3} style={{ marginTop: 4 }}>
          <Txt size={13.5} color={T.text2}>{who}</Txt> · {i.schedule}
          {i.max_runs ? ` · stops after ${i.max_runs} runs` : " · runs until you stop it"}
        </Txt>
        <Txt size={14} color={T.text2} selectable style={{ marginTop: 8 }}>{i.detail}</Txt>
        {!!i.monitor_cmd && (
          <>
            <Txt size={13.5} color={T.text3} style={{ marginTop: 10 }}>Before every run it executes this check in your shell:</Txt>
            <Pre>{i.monitor_cmd}</Pre>
          </>
        )}
      </>
    );
    actions = (
      <>
        <Button label={armed === "approve" ? "Tap again to approve" : "Approve"}
          kind={armed === "approve" ? "danger-primary" : "primary"} small busy={busy === "approve"}
          onPress={() => twice("approve") && run("approve", () => api.cronAction(i.id, "approve"), "Approved. It runs on schedule.")} />
        <Button label="Reject" small busy={busy === "delete"} onPress={() => run("delete", () => api.cronAction(i.id, "delete"))} />
      </>
    );
  } else if (i.kind === "proposal") {
    const st = i.stat || {};
    sub = (
      <>
        <Txt size={13.5} color={T.text3} style={{ marginTop: 4 }}>
          <Txt size={13.5} color={T.text2}>{who}</Txt> · {(st.files || []).length} files · +{st.added || 0}/-{st.removed || 0} · tests green
        </Txt>
        <Txt size={14} color={T.text2} style={{ marginTop: 8 }}>{i.detail}</Txt>
      </>
    );
    actions = (
      <>
        <Button label="View diff" small onPress={async () => {
          try { setDiff(await api.diff(i.id)); } catch (e) { notify(e.message, true); }
        }} />
        <Button label={armed === "apply" ? "Approve and restart?" : "Approve and restart"}
          kind={armed === "apply" ? "danger-primary" : "primary"} small busy={busy === "apply"}
          onPress={() => twice("apply") && run("apply", () => api.improvement(i.id, "approve"),
            "Applying the change and restarting. If it does not come back, it rolls back by itself.")} />
        <Button label="Reject" small busy={busy === "reject"} onPress={() => run("reject", () => api.improvement(i.id, "reject"))} />
      </>
    );
  } else if (i.kind === "signin") {
    sub = (
      <Txt size={13.5} color={T.text3} style={{ marginTop: 4 }}>
        <Txt size={13.5} color={T.text2}>{who}</Txt> is waiting. {i.detail} Sign in from Mission Control on your Mac.
      </Txt>
    );
  } else if (i.kind === "lesson") {
    sub = <Txt size={13.5} color={T.text3} style={{ marginTop: 4 }}>{who ? `${who} · ` : ""}{i.detail}</Txt>;
    const ownerRule = ["owner", "owner-rule"].includes(i.source);
    const act = (to, label, primary) => (
      <Button key={to + label} label={label} kind={primary ? "primary" : "default"} small busy={busy === to}
        onPress={() => run(to, () => api.updateLesson(i.id, { status: to }))} />
    );
    // what can be done depends on why it is here: a lesson waiting for an
    // OK, one the regression guard held back, or one the review flagged
    actions = (
      <>
        {i.reason === "proposed" ? [act("active", "Use it", true), act("retired", "Discard")]
          : i.reason === "suspended" ? [act(ownerRule ? "active" : "trial", "Restore"), act("retired", "Retire")]
          : i.status === "active" ? [act("active", "Keep it", true), act("retired", "Retire")]
          : [act("active", "Keep it as a rule", true), act("retired", "Dismiss")]}
        <Button label="Review" kind="ghost" small onPress={() => nav.push({ kind: "evolution" })} />
      </>
    );
  }

  const code = i.kind === "command" || i.kind === "tool";
  return (
    <Card pad={16}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <ItemIcon name={k.icon} tone={k.tone} size={28} />
        <Txt size={13} color={T.text3} style={{ flex: 1 }}>{k.label}</Txt>
        <Txt size={12.5} color={T.text3}>{ago(i.ts)}</Txt>
      </View>
      {code ? <Pre style={{ marginTop: 12 }}>{i.title}</Pre>
        : <Txt size={15.5} weight="500" selectable style={{ marginTop: 12 }}>{codeSpans(i.title, 15.5)}</Txt>}
      {sub}
      {!!actions && <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }}>{actions}</View>}
      {!!diff && (
        <Sheet visible onClose={() => setDiff(null)} title={diff.title || "Proposed change"}>
          <DiffView text={diff.diff || "(empty)"} />
        </Sheet>
      )}
    </Card>
  );
}
