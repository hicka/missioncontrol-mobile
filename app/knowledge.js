import React from "react";
import { useLocalSearchParams } from "expo-router";
import { nav } from "../src/nav";
import KnowledgeScreen from "../src/screens/KnowledgeScreen";

export default function Knowledge() {
  const { tab } = useLocalSearchParams();
  return <KnowledgeScreen nav={nav} onBack={nav.pop} tab={tab ? String(tab) : undefined} />;
}
