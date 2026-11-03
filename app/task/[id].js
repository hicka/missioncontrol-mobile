import React from "react";
import { useLocalSearchParams } from "expo-router";
import { nav } from "../../src/nav";
import TaskScreen from "../../src/screens/TaskScreen";

export default function Task() {
  const { id } = useLocalSearchParams();
  return <TaskScreen key={id} workerId={String(id)} nav={nav} onBack={nav.pop} />;
}
