// The insets inside a tab include the tab bar, so this page measures its own.
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import HomeScreen from "../../../src/screens/HomeScreen";

export default function Home() {
  return <SafeAreaProvider><HomeScreen /></SafeAreaProvider>;
}
