// What the routes hand every screen: where it is drawn, and the app-wide settings.
// A screen drawn by a route has the system's own header and back gesture, so the
// kit's Header and Title set that header rather than drawing one of their own.
import { createContext, useContext } from "react";

export const RouteCtx = createContext(null);
export const useRoute = () => useContext(RouteCtx);

// saved: the server address and token; theme: auto, light or dark
export const AppCtx = createContext({ saved: { url: "", token: "" }, theme: "auto", setTheme() {}, onConnected() {} });
export const useApp = () => useContext(AppCtx);
