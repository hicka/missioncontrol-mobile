// One of the Mac's settings, or how this phone reaches it.
import React from "react";
import { useLocalSearchParams } from "expo-router";
import { nav } from "../../src/nav";
import { useApp } from "../../src/route";
import * as store from "../../src/store";
import { useStore } from "../../src/store";
import AgentsScreen from "../../src/screens/config/AgentsScreen";
import ChannelsScreen from "../../src/screens/config/ChannelsScreen";
import ConnectionScreen from "../../src/screens/config/ConnectionScreen";
import FleetScreen from "../../src/screens/config/FleetScreen";
import GithubScreen from "../../src/screens/config/GithubScreen";
import HeartbeatScreen from "../../src/screens/config/HeartbeatScreen";
import HooksScreen from "../../src/screens/config/HooksScreen";
import ImportScreen from "../../src/screens/config/ImportScreen";
import ModelScreen from "../../src/screens/config/ModelScreen";
import RemoteScreen from "../../src/screens/config/RemoteScreen";
import VoiceSettingsScreen from "../../src/screens/config/VoiceSettingsScreen";

const SCREENS = {
  connection: ConnectionScreen, model: ModelScreen, voice: VoiceSettingsScreen, agents: AgentsScreen,
  channels: ChannelsScreen, github: GithubScreen, remote: RemoteScreen, fleet: FleetScreen,
  heartbeat: HeartbeatScreen, hooks: HooksScreen, import: ImportScreen,
};

export default function Config() {
  const { section, edit } = useLocalSearchParams();
  const { saved, onConnected } = useApp();
  const state = useStore((s) => s.state);
  const Screen = SCREENS[String(section)];
  if (!Screen) return null;
  return <Screen nav={nav} state={state} saved={saved} onBack={nav.pop} editId={edit ? String(edit) : undefined}
    onChanged={() => store.refresh()} onConnected={onConnected} />;
}
