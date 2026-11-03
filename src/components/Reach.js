// Whether the phone can see the agent at all: not set up yet, still connecting,
// out of reach, or reachable but not working. Every tab starts from the same answer.
import React from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import * as SecureStore from "expo-secure-store";
import Mark from "./Mark";
import { configure } from "../api";
import { DEMO_URL } from "../demo";
import { nav } from "../nav";
import { useApp } from "../route";
import * as store from "../store";
import { useStore } from "../store";
import { T, ago } from "../theme";
import { Button, Card, Empty, Screen, Txt } from "../ui";

// What a tab shows in place of itself until there is something to show. Null once there is.
export function useGate() {
  const { saved, booted } = useApp();
  const state = useStore((s) => s.state);
  const online = useStore((s) => s.online);
  const error = useStore((s) => s.error);
  if (!booted) return <View style={{ flex: 1, backgroundColor: T.bg }} />;
  if (!saved.url) return <Welcome />;
  if (!state) {
    return (
      <Screen>
        <Empty art={<Mark size={72} />} title={online === false ? "Can't reach Mission Control" : "Connecting…"}
          text={online === false ? `${error || "No answer"} from ${saved.url}. Check the Mac is awake and on the same network, or on Tailscale.` : saved.url}>
          {online === false && (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <Button label="Try again" kind="primary" onPress={() => store.refresh()} />
              <Button label="Connection" onPress={() => nav.openConfig("connection")} />
            </View>
          )}
        </Empty>
      </Screen>
    );
  }
  return null;
}

function Welcome() {
  const { onConnected } = useApp();
  async function sample() {
    configure(DEMO_URL, "");
    await SecureStore.setItemAsync("mc_url", DEMO_URL).catch(() => {});
    await SecureStore.setItemAsync("mc_token", "").catch(() => {});
    onConnected(null, { url: DEMO_URL, token: "" });
  }
  return (
    <Screen contentStyle={{ paddingTop: 56, alignItems: "center" }}>
      <Stack.Screen options={{ title: "" }} />
      <Mark size={104} used={0} />
      <Txt display size={32} style={{ textAlign: "center", marginTop: 26 }}>One agent, in your pocket</Txt>
      <Txt size={15} color={T.text3} style={{ textAlign: "center", marginTop: 10, marginHorizontal: 12 }}>
        Connect this phone to the Mission Control running on your Mac. See what it is doing, decide what it asks, and step in.
      </Txt>
      <View style={{ marginTop: 26, gap: 10, alignItems: "center" }}>
        <Button label="Connect this phone" kind="primary" icon="link" onPress={() => nav.openConfig("connection")} />
        <Button label="Look around with sample data" kind="ghost" onPress={sample} />
      </View>
    </Screen>
  );
}

// Said once, above whatever the tab shows, when the agent cannot do its work.
export function ReachBanner({ style }) {
  const kernel = useStore((s) => s.kernel);
  const online = useStore((s) => s.online);
  const error = useStore((s) => s.error);
  const seen = useStore((s) => s.seen);
  if (online === false) {
    return (
      <Card pad={14} style={[{ borderColor: T.danger }, style]}>
        <Txt size={14} weight="600" color={T.danger}>Your Mac is out of reach</Txt>
        <Txt size={13.5} color={T.text2} style={{ marginTop: 2 }}>
          This is what it looked like {seen ? ago(seen) : "earlier"}. {error}
        </Txt>
        <View style={{ flexDirection: "row", marginTop: 10 }}>
          <Button label="Try again" small onPress={() => store.refresh()} />
        </View>
      </Card>
    );
  }
  if (kernel && !kernel.router?.alive) {
    return (
      <Card pad={14} style={[{ borderColor: T.danger }, style]}>
        <Txt size={14} weight="600" color={T.danger}>The Router is not running</Txt>
        <Txt size={13.5} color={T.text2} style={{ marginTop: 2 }}>Nothing new is being read. Restarting Mission Control brings it back.</Txt>
      </Card>
    );
  }
  if (kernel?.paused) {
    return (
      <Card pad={14} style={[{ borderColor: T.warn }, style]}>
        <Txt size={14} weight="600" color={T.warn}>Paused</Txt>
        <Txt size={13.5} color={T.text2} style={{ marginTop: 2 }}>Events are still recorded, but no new work starts until you carry on.</Txt>
        <View style={{ flexDirection: "row", marginTop: 10 }}>
          <Button label="Open Activity" small onPress={() => nav.tab("activity")} />
        </View>
      </Card>
    );
  }
  return null;
}
