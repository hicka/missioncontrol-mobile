// A direct line to one of the agent's roles, or a past conversation opened at a search result.
import React from "react";
import { useIsFocused, useLocalSearchParams } from "expo-router";
import { nav } from "../../src/nav";
import ChatScreen from "../../src/screens/ChatScreen";

export default function Thread() {
  const { id, at } = useLocalSearchParams();
  const focused = useIsFocused();
  const threadId = String(id);
  return <ChatScreen key={`${threadId}:${at || ""}`} threadId={threadId} atId={at ? Number(at) : undefined} nav={nav}
    active={focused} onVoice={() => nav.push({ kind: "voice", threadId })} />;
}
