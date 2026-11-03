// The conversation with the agent, with what its hands are on just above it.
import React from "react";
import { useIsFocused } from "expo-router";
import { useGate } from "../../../src/components/Reach";
import { nav } from "../../../src/nav";
import * as store from "../../../src/store";
import { useStore } from "../../../src/store";
import ChatScreen from "../../../src/screens/ChatScreen";

export default function Chat() {
  const gate = useGate();
  const state = useStore((s) => s.state);
  const write = useStore((s) => s.write);
  const focused = useIsFocused();
  const lead = store.leadThread(state);
  if (gate) return gate;
  if (!lead) return null;
  return <ChatScreen threadId={lead} nav={nav} inTab active={focused} focusKey={write} onVoice={() => nav.openVoice()} />;
}
