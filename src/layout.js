// How every stack of pages looks: the system's header sitting on the page with no
// line under it, a back button that is only the chevron, and the page colour
// behind everything so nothing flashes white between pages.
import React from "react";
import { Stack } from "expo-router";
import { RouteCtx, useApp } from "./route";
import { T } from "./theme";

export function stackOptions() {
  return {
    headerStyle: { backgroundColor: T.bg },
    headerTintColor: T.text,
    headerTitleStyle: { color: T.text },
    headerLargeTitleStyle: { color: T.text },
    headerLargeStyle: { backgroundColor: T.bg },
    headerShadowVisible: false,
    headerLargeTitleShadowVisible: false,
    headerBackButtonDisplayMode: "minimal",
    contentStyle: { backgroundColor: T.bg },
  };
}

const ROUTED = {};

// Each page is drawn again when the theme changes, so every colour follows it,
// while the stack itself, and so where you are, stays as it was.
export function screenLayout(scheme, skip = () => false) {
  return ({ children, route }) => (
    <RouteCtx.Provider value={ROUTED}>
      {/* a keyed fragment adds no view, so a page's scroll view stays first under the header and its large title folds */}
      {skip(route) ? children : <React.Fragment key={scheme}>{children}</React.Fragment>}
    </RouteCtx.Provider>
  );
}

// A tab's own stack: its first page under a large title that folds into the bar as you scroll.
export function TabStack({ title, large = true, header = true }) {
  const { scheme } = useApp();
  return (
    <Stack screenOptions={stackOptions()} screenLayout={screenLayout(scheme)}>
      <Stack.Screen name="index" options={{ title, headerLargeTitleEnabled: large, headerShown: header }} />
    </Stack>
  );
}
