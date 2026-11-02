import React, { useState } from "react";
import { View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { api, configure } from "../../api";
import { registerDevice } from "../../push";
import { T } from "../../theme";
import { Dim, Field, Key, Keys, Note, Rule, Shell } from "../../ui";

export default function ConnectionScreen({ state, saved, onBack, onConnected }) {
  const [url, setUrl] = useState(saved?.url || (__DEV__ ? "http://127.0.0.1:8899" : ""));
  const [token, setToken] = useState(saved?.token || "");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const [busy2, setBusy2] = useState("");
  const [pushNote, setPushNote] = useState(null);

  async function register() {
    setBusy2("reg");
    const r = await registerDevice();
    setPushNote(r.ok ? { kind: "ok", text: "Registered. The Mac will buzz this phone." }
                     : { kind: "err", text: r.error || "Failed" });
    setBusy2("");
  }

  async function testPush() {
    setBusy2("test");
    try {
      const d = await api.post("/api/devices/test");
      setPushNote(d.ok ? { kind: "ok", text: "Sent. It should arrive in a moment." }
                       : { kind: "err", text: d.error || "Failed" });
    } catch (e) { setPushNote({ kind: "err", text: String(e.message || e) }); }
    setBusy2("");
  }

  async function connect() {
    setBusy(true); setNote(null);
    configure(url, token);
    try {
      const s = await api.state();
      await SecureStore.setItemAsync("mc_url", url.trim());
      await SecureStore.setItemAsync("mc_token", token.trim());
      onConnected(s, { url: url.trim(), token: token.trim() });
    } catch (e) {
      // a failed attempt must not leave the client pointed at the bad server
      configure(saved?.url || "", saved?.token || "");
      setNote({ kind: "err", text: String(e.message || e) });
    }
    setBusy(false);
  }

  return (
    <Shell title="This phone" onBack={onBack}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: state ? T.good : T.text4 }} />
        <Dim size={14} numberOfLines={1} style={{ flex: 1 }}>
          {state ? `Connected to ${saved?.url || url}` : "Not connected"}
        </Dim>
      </View>
      <Rule label="Mission Control" />
      <Dim size={14}>
        On the Mac, turn on Settings › Integrations › Mobile access and restart once, then paste the address and token here.
      </Dim>
      <Field label="Server address" value={url} onChangeText={setUrl}
        placeholder="http://100.x.y.z:8899" keyboardType="url" />
      <Field label="Access token" value={token} onChangeText={setToken}
        placeholder="Paste the token from Mobile access" secureTextEntry />
      <Keys>
        <Key label={state ? "Reconnect" : "Connect"} busy={busy} disabled={!url} onPress={connect} />
      </Keys>
      <Note note={note} />
      <Dim size={13.5} style={{ marginTop: 14 }}>
        Use a Tailscale address so it works away from home. The Mac itself never needs the token; this phone always does.
      </Dim>
      {!!state && (
        <>
          <Rule label="Notifications" />
          <Dim size={14}>
            When you are away from every app window, an agent's reply buzzes this phone directly. No account in between.
          </Dim>
          <Keys>
            <Key label="Register this phone" kind="ghost" busy={busy2 === "reg"} onPress={register} />
            <Key label="Send a test" kind="ghost" busy={busy2 === "test"} onPress={testPush} />
          </Keys>
          <Note note={pushNote} />
        </>
      )}
    </Shell>
  );
}
