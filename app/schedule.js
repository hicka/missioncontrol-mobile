import React from "react";
import { nav } from "../src/nav";
import ScheduleScreen from "../src/screens/ScheduleScreen";

export default function Schedule() {
  return <ScheduleScreen nav={nav} onBack={nav.pop} />;
}
