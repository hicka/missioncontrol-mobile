// How every stack of pages looks: the system's header sitting on the page with no
// line under it, a back button that is only the chevron, and the page colour
// behind everything so nothing flashes white between pages.
import React from "react";
import { Stack } from "expo-router";
import { RouteCtx, useApp } from "./route";
import { T } from "./theme";

// Titles take the system's own label colour in the header's appearance, which is set to
// the app's theme: a fixed colour left the large title invisible in dark mode.
export function stackOptions() {
  return {
    headerStyle: { backgroundColor: T.bg },
    headerTintColor: T.text,
    headerUserInterfaceStyle: T.scheme,
    headerShadowVisible: false,
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

// A tab's own stack. Large titles stay off: on iOS 26 and 27 a large title over a tracked
// scroll view rested half-collapsed, with neither title showing.
export function TabStack({ title, large = false, header = true }) {
  const { scheme } = useApp();
  return (
    <Stack screenOptions={stackOptions()} screenLayout={screenLayout(scheme)}>
      <Stack.Screen name="index" options={{ title, headerLargeTitleEnabled: large, headerShown: header }} />
    </Stack>
  );
}
