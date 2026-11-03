// The system's own tab bar: the agent at a glance, the conversation, what needs
// you, its tasks, and settings. Orange on a badge means something is waiting
// on you; everything else stays in the one ink.
import React from "react";
import { Platform } from "react-native";
import { NativeTabs } from "expo-router/native-tabs";
import { useApp } from "../../src/route";
import * as store from "../../src/store";
import { useStore } from "../../src/store";
import { T } from "../../src/theme";

const { Trigger } = NativeTabs;

export default function Tabs() {
  useApp();   // follows the theme
  const state = useStore((s) => s.state);
  const inbox = useStore((s) => (s.control.inbox || []).length);
  const lead = store.leadThread(state);
  const unread = useStore((s) => !!(lead && s.unread[lead]));
  // a reply on a direct line brings no push while the app is open, so it has to show somewhere
  const directUnread = useStore((s) => Object.keys(s.unread).some((id) => id !== lead));
  const name = store.lead(state)?.name || "Agent";

  const android = Platform.OS === "android" ? {
    backgroundColor: T.surface, indicatorColor: T.surface3, rippleColor: T.hover,
    iconColor: { default: T.text3, selected: T.text }, badgeTextColor: T.signalInk,
    labelStyle: { default: { color: T.text3 }, selected: { color: T.text } },
  } : null;

  return (
    <NativeTabs tintColor={T.text} badgeBackgroundColor={T.signal} {...android}>
      <Trigger name="(home)" accessibilityLabel={name} disableAutomaticContentInsets>
        <Trigger.Icon sf="sparkles" md="auto_awesome" />
        <Trigger.Label>{name}</Trigger.Label>
      </Trigger>
      <Trigger name="chat" accessibilityLabel={unread ? "Chat, new reply" : "Chat"} disableAutomaticContentInsets>
        <Trigger.Icon sf={{ default: "bubble.left.and.bubble.right", selected: "bubble.left.and.bubble.right.fill" }} md="forum" />
        <Trigger.Label>Chat</Trigger.Label>
        <Trigger.Badge hidden={!unread} />
      </Trigger>
      <Trigger name="inbox" accessibilityLabel={inbox ? `Inbox, ${inbox} waiting on you` : "Inbox"}>
        <Trigger.Icon sf={{ default: "tray", selected: "tray.fill" }} md="inbox" />
        <Trigger.Label>Inbox</Trigger.Label>
        {inbox > 0 ? <Trigger.Badge>{inbox > 99 ? "99+" : String(inbox)}</Trigger.Badge> : <Trigger.Badge hidden />}
      </Trigger>
      <Trigger name="tasks">
        <Trigger.Icon sf="checklist" md="checklist" />
        <Trigger.Label>Tasks</Trigger.Label>
      </Trigger>
      <Trigger name="settings">
        <Trigger.Icon sf={{ default: "gearshape", selected: "gearshape.fill" }} md="settings" />
        <Trigger.Label>Settings</Trigger.Label>
        <Trigger.Badge hidden={!directUnread} />
      </Trigger>
    </NativeTabs>
  );
}
