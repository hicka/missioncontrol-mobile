import React from "react";
import { useGate } from "../src/components/Reach";
import { nav } from "../src/nav";
import { useApp } from "../src/route";
import ActivityScreen from "../src/screens/ActivityScreen";

export default function Activity() {
  const gate = useGate();
  const { saved } = useApp();
  return gate || <ActivityScreen nav={nav} saved={saved} />;
}
