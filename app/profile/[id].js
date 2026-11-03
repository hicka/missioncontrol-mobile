import React from "react";
import { useLocalSearchParams } from "expo-router";
import { nav } from "../../src/nav";
import ProfileScreen from "../../src/screens/ProfileScreen";

export default function Profile() {
  const { id } = useLocalSearchParams();
  return <ProfileScreen key={id} agentId={String(id)} nav={nav} onBack={nav.pop} />;
}
