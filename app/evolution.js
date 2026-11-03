import React from "react";
import { nav } from "../src/nav";
import { useApp } from "../src/route";
import EvolutionScreen from "../src/screens/EvolutionScreen";

export default function Evolution() {
  const { saved } = useApp();
  return <EvolutionScreen saved={saved} nav={nav} onBack={nav.pop} />;
}
