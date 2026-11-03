// Talking to the agent, full screen, with its own way back.
import React, { useMemo } from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { nav } from "../src/nav";
import { RouteCtx } from "../src/route";
import * as store from "../src/store";
import { useStore } from "../src/store";
import { T } from "../src/theme";
import VoiceScreen from "../src/screens/VoiceScreen";

export default function Voice() {
  const { thread: id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const state = useStore((s) => s.state);
  const agents = useMemo(() => store.agentsById(state), [state]);
  const threadId = String(id || store.leadThread(state) || "");
  const thread = (state?.threads || []).find((t) => t.id === threadId)
    || { id: threadId, agent: threadId.startsWith("dm:") ? threadId.slice(3) : null };
  return (
    <RouteCtx.Provider value={null}>
      <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: T.bg }}>
        <VoiceScreen thread={thread} agents={agents} onBack={nav.pop} />
      </View>
    </RouteCtx.Provider>
  );
}
