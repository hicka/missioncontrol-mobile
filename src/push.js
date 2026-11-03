// Push notifications with nothing in between: the phone hands its Expo
// push token to the Mission Control server it is connected to, and the
// server posts to Expo directly when an agent needs you.
import Constants from "expo-constants";
import { api, isDemo } from "./api";

function notifications() {
  try { return require("expo-notifications"); } catch { return null; }
}

export async function registerDevice() {
  const N = notifications();
  if (!N) return { ok: false, error: "notifications module unavailable" };
  if (isDemo()) return { ok: false, error: "Sample data has no Mac to send notifications." };
  try {
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return { ok: false, error: "no EAS projectId configured" };
    const perm = await N.requestPermissionsAsync();
    if (!perm.granted) return { ok: false, error: "notification permission denied" };
    const { data: token } = await N.getExpoPushTokenAsync({ projectId });
    const d = await api.post("/api/devices", {
      expo_push_token: token, name: Constants.deviceName || "phone" });
    return { ok: !!d.ok, error: d.error };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

// tapping a notification opens the chat it came from
export function onNotificationTap(handler) {
  const N = notifications();
  if (!N) return () => {};
  N.setNotificationHandler({
    handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true,
                                       shouldSetBadge: false }),
  });
  const sub = N.addNotificationResponseReceivedListener((r) =>
    handler(r.notification?.request?.content?.data || {}));
  N.getLastNotificationResponseAsync?.().then((r) => {
    if (r) handler(r.notification?.request?.content?.data || {});
  }).catch(() => {});
  return () => sub.remove();
}
