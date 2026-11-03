import React from "react";
import { nav } from "../src/nav";
import SearchScreen from "../src/screens/SearchScreen";

export default function Search() {
  return <SearchScreen nav={nav} onBack={nav.pop} />;
}
