// Quiet cards on a graphite page, sentence-case headings, rows with a tinted
// icon, status pills that pair a dot with a word, and one strong button style
// for the thing you came to do. The older names (Mono, Dim, Gutter, Key, Rule,
// Shell…) stay, so every settings screen picks up the look as it is.
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView,
         Share, Switch, Text, TextInput, View } from "react-native";
import * as Haptics from "expo-haptics";
import Icon from "./components/Icon";
import { FONTS, RADIUS, T } from "./theme";

export const haptic = {
  tap: () => { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {} },
  pick: () => { try { Haptics.selectionAsync(); } catch {} },
  done: () => { try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {} },
  warn: () => { try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch {} },
};

const cap = (s) => { s = String(s ?? ""); return s ? s[0].toUpperCase() + s.slice(1) : s; };

/* ---------- text ---------- */
export function Txt({ style, size = 15, weight, color, mono, display, children, ...rest }) {
  return (
    <Text {...rest} style={[{
      fontSize: size, lineHeight: Math.round(size * (display ? 1.16 : 1.42)), color: color || T.text,
      fontFamily: mono ? FONTS.mono : undefined,
      fontWeight: weight || (display ? "700" : "400"),
      letterSpacing: display ? -0.6 : 0,
    }, style]}>
      {children}
    </Text>
  );
}

// kept names: Mono is the body text it always was, now set in the system face
export function Mono(props) { return <Txt {...props} />; }
export function Dim({ style, ...props }) { return <Txt color={T.text3} {...props} style={style} />; }
export function Code({ style, ...props }) { return <Txt mono size={12.5} color={T.text2} {...props} style={style} />; }

export function Title({ children, sub, style, right }) {
  return (
    <View style={[{ marginTop: 6, marginBottom: 18 }, style]}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
        <Txt display size={30} style={{ flex: 1 }}>{children}</Txt>
        {right}
      </View>
      {!!sub && <Txt size={14} color={T.text3} style={{ marginTop: 6 }}>{sub}</Txt>}
    </View>
  );
}

export function Label({ children, style }) {
  return <Txt size={13} weight="500" color={T.text3} style={[{ marginBottom: 6 }, style]}>{cap(children)}</Txt>;
}

/* ---------- surfaces ---------- */
export function Card({ children, style, pad = 0 }) {
  return (
    <View style={[{ backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: RADIUS.lg,
                    padding: pad, overflow: "hidden" }, style]}>
      {children}
    </View>
  );
}

export function Divider({ style, inset = 0 }) {
  return <View style={[{ height: 1, backgroundColor: T.line, marginLeft: inset }, style]} />;
}

// rows inside a card, each separated by a hairline
export function List({ children, style }) {
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <Card style={style}>
      {rows.map((r, i) => <View key={r.key ?? i}>{i > 0 && <Divider />}{r}</View>)}
    </Card>
  );
}

export function Section({ title, count, action, onAction, children, style }) {
  return (
    <View style={[{ marginTop: 28 }, style]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, minHeight: 22 }}>
        <Txt size={16.5} weight="700">{title}</Txt>
        {count !== undefined && count !== null && count !== "" && <Txt size={13} color={T.text3}>{count}</Txt>}
        <View style={{ flex: 1 }} />
        {!!action && (
          <Pressable onPress={onAction} hitSlop={10} style={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
            <Txt size={13.5} color={T.text3}>{action}</Txt>
            <Icon name="chev" size={15} color={T.text3} />
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

const TONES = {
  warn: () => [T.warnSoft, T.warn], info: () => [T.infoSoft, T.info], good: () => [T.goodSoft, T.good],
  danger: () => [T.dangerSoft, T.danger], signal: () => [T.signalSoft, T.signal], "": () => [T.surface2, T.text2],
};
export function ItemIcon({ name, tone = "", size = 32 }) {
  const [bg, fg] = (TONES[tone] || TONES[""])();
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: bg,
                   alignItems: "center", justifyContent: "center" }}>
      <Icon name={name} size={size * 0.52} color={fg} />
    </View>
  );
}

// One row: something on the left (a face, an icon), a title and a line under
// it, and whatever belongs on the right. Tappable when it leads somewhere.
export function Item({ left, title, titleMono, sub, right, onPress, children, chevron, lines = 2, style }) {
  const body = (
    <View style={[{ flexDirection: "row", gap: 12, paddingVertical: 13, paddingHorizontal: 16,
                    alignItems: "flex-start" }, style]}>
      {!!left && <View style={{ marginTop: 1 }}>{left}</View>}
      <View style={{ flex: 1, minWidth: 0 }}>
        {typeof title === "string" ? (
          <Txt size={titleMono ? 13 : 15} mono={titleMono} weight={titleMono ? "400" : "500"}
            numberOfLines={lines || undefined}>{title}</Txt>
        ) : title}
        {typeof sub === "string" ? (
          <Txt size={13.5} color={T.text3} style={{ marginTop: 2 }} numberOfLines={lines ? lines + 1 : undefined}>{sub}</Txt>
        ) : sub}
        {children}
      </View>
      {(right || chevron) && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 1 }}>
          {right}
          {chevron && <Icon name="chev" size={16} color={T.text4} />}
        </View>
      )}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ backgroundColor: pressed ? T.hover : "transparent" })}>
      {body}
    </Pressable>
  );
}

export function Empty({ art, title, text, children, compact }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: compact ? 22 : 40, paddingHorizontal: 22, gap: 8 }}>
      {!!art && <View style={{ marginBottom: 6 }}>{art}</View>}
      {!!title && <Txt size={15} weight="600" style={{ textAlign: "center" }}>{title}</Txt>}
      {!!text && <Txt size={13.5} color={T.text3} style={{ textAlign: "center" }}>{text}</Txt>}
      {children}
    </View>
  );
}

// a status as a dot and a word, never colour alone
const PILL = {
  info: ["running", "active", "queued", "trial"],
  warn: ["waiting", "pending", "paused", "suspended"],
  good: ["completed", "done", "adopted", "good", "learned", "ready"],
  danger: ["failed", "cancelled", "expired", "interrupted", "stopped", "dropped"],
  signal: ["blocked"],
};
export function Pill({ status, label, tone: given }) {
  const tone = given !== undefined ? given : Object.keys(PILL).find((k) => PILL[k].includes(status));
  const [bg, fg] = tone ? TONES[tone]() : [T.surface2, status === "retired" || status === "skipped" ? T.text3 : T.text2];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 22, paddingHorizontal: 9,
                   borderRadius: 99, backgroundColor: bg, alignSelf: "flex-start" }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tone ? fg : T.text4 }} />
      <Txt size={12} weight="500" color={fg} style={{ lineHeight: 15 }}>
        {label || cap(String(status).replace(/_/g, " "))}
      </Txt>
    </View>
  );
}

export function Dot({ state, size = 8 }) {
  const c = state === "thinking" ? T.warn : state === "doing" ? T.good : T.text4;
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c }} />;
}

// A number and what it counts, for the instrument cards.
export function Stat({ value, label, note, tone, onPress }) {
  const color = tone ? (TONES[tone] || TONES[""])()[1] : T.text;
  const body = (
    <View style={{ flexGrow: 1, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line,
                   borderRadius: RADIUS.md + 2, paddingHorizontal: 13, paddingVertical: 11 }}>
      <Txt size={21} weight="700" color={color} numberOfLines={1} style={{ letterSpacing: -0.4, fontVariant: ["tabular-nums"] }}>{value}</Txt>
      <Txt size={12.5} color={T.text2} numberOfLines={1} style={{ marginTop: 1 }}>{label}</Txt>
      {!!note && <Txt size={12} color={T.text3} numberOfLines={1}>{note}</Txt>}
    </View>
  );
  if (!onPress) return <View style={{ flex: 1, minWidth: 0 }}>{body}</View>;
  return <Pressable onPress={onPress} style={({ pressed }) => ({ flex: 1, minWidth: 0, opacity: pressed ? 0.75 : 1 })}>{body}</Pressable>;
}
export function Glyph({ state, style }) {
  return <View style={style}><Dot state={state} /></View>;
}

export function Progress({ value }) {
  return (
    <View style={{ height: 4, borderRadius: 4, backgroundColor: T.surface3, overflow: "hidden", marginTop: 8 }}>
      <View style={{ height: 4, borderRadius: 4, backgroundColor: T.text2,
                     width: `${Math.max(0, Math.min(100, value * 100))}%` }} />
    </View>
  );
}

// a command, a check, an error: shown whole, in monospace
export function Pre({ children, style, lines }) {
  return (
    <View style={[{ backgroundColor: T.surface2, borderWidth: 1, borderColor: T.line, borderRadius: 10,
                    paddingHorizontal: 12, paddingVertical: 10, marginTop: 8 }, style]}>
      <Txt mono selectable size={12.5} color={T.text2} numberOfLines={lines} style={{ lineHeight: 19 }}>
        {children}
      </Txt>
    </View>
  );
}

/* ---------- actions ---------- */
export function Button({ label, onPress, kind = "default", small, icon, busy, disabled, style, wide }) {
  const filled = kind === "primary" || kind === "danger-primary";
  const bg = kind === "primary" ? T.accent : kind === "danger-primary" ? T.danger
    : kind === "ghost" ? "transparent" : kind === "confirm" ? T.dangerSoft : T.surface2;
  const fg = kind === "primary" ? T.accentInk : kind === "danger-primary" ? "#ffffff"
    : kind === "danger" || kind === "confirm" ? T.danger : kind === "ghost" ? T.text2 : T.text;
  const h = small ? 32 : 40;
  return (
    <Pressable onPress={(e) => { haptic.tap(); onPress && onPress(e); }} disabled={disabled || busy}
      style={({ pressed }) => [{
        height: h, paddingHorizontal: small ? 12 : 16, borderRadius: small ? 9 : 11, backgroundColor: bg,
        borderWidth: filled || kind === "ghost" || kind === "confirm" ? 0 : 1, borderColor: T.line,
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
        opacity: disabled ? 0.4 : pressed ? 0.75 : 1, ...(wide ? { alignSelf: "stretch" } : null),
      }, style]}>
      {busy ? <ActivityIndicator size="small" color={fg} /> : (
        <>
          {!!icon && <Icon name={icon} size={small ? 15 : 16} color={fg} fill={icon === "stop" || icon === "play"} />}
          <Txt size={small ? 13.5 : 15} weight="500" color={fg} style={{ lineHeight: small ? 18 : 20 }}>{label}</Txt>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({ name, onPress, color, size = 20, active, label, style, disabled }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityLabel={label} disabled={disabled}
      style={({ pressed }) => [{ width: 38, height: 38, borderRadius: 11, alignItems: "center",
        justifyContent: "center", backgroundColor: active || pressed ? T.surface2 : "transparent",
        opacity: disabled ? 0.4 : 1 }, style]}>
      <Icon name={name} size={size} color={color || (active ? T.text : T.text2)} fill={name === "stop"} />
    </Pressable>
  );
}

// Older screens call buttons Keys; a Key reads as a sentence now.
export function Key({ label, onPress, kind = "primary", disabled, busy, style }) {
  const k = kind === "danger" ? "danger" : kind === "ghost" ? "ghost" : "primary";
  return <Button label={cap(label)} onPress={onPress} kind={k} disabled={disabled} busy={busy}
    small style={[{ minWidth: 0 }, style]} />;
}

export function Keys({ children, style }) {
  return <View style={[{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }, style]}>{children}</View>;
}

// a segmented control: few choices, one on
export function Segmented({ options, value, onChange, style }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      style={[{ alignSelf: "flex-start", maxWidth: "100%", flexGrow: 0, borderRadius: 11, backgroundColor: T.surface2,
                borderWidth: 1, borderColor: T.line }, style]}
      contentContainerStyle={{ padding: 3, gap: 2 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={String(o.value)} onPress={() => { haptic.pick(); onChange(o.value); }}
            style={{ height: 30, paddingHorizontal: 12, borderRadius: 8, flexDirection: "row", alignItems: "center",
                     gap: 5, backgroundColor: on ? T.surface : "transparent",
                     shadowColor: "#000", shadowOpacity: on ? 0.12 : 0, shadowRadius: 3,
                     shadowOffset: { width: 0, height: 1 } }}>
            <Txt size={13.5} weight={on ? "500" : "400"} color={on ? T.text : T.text3}>{o.label}</Txt>
            {o.count !== undefined && <Txt size={12.5} weight="500" color={T.text4}>{o.count}</Txt>}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/* ---------- form controls ---------- */
function useFocus() {
  const [on, setOn] = useState(false);
  return [on, { onFocus: () => setOn(true), onBlur: () => setOn(false) }];
}
export const inputStyle = () => ({
  fontSize: 15, color: T.text, backgroundColor: T.surface, borderWidth: 1, borderColor: T.lineStrong,
  borderRadius: 11, paddingHorizontal: 12, paddingVertical: Platform.OS === "ios" ? 11 : 8,
});

export function Input({ style, inputStyle: extra, ...props }) {
  const [focus, handlers] = useFocus();
  return (
    <TextInput placeholderTextColor={T.text4} keyboardAppearance={T.scheme} selectionColor={T.focus}
      {...props} {...handlers}
      onFocus={(e) => { handlers.onFocus(); props.onFocus && props.onFocus(e); }}
      onBlur={(e) => { handlers.onBlur(); props.onBlur && props.onBlur(e); }}
      style={[inputStyle(), focus && { borderColor: T.focus }, extra, style]} />
  );
}

export function Field({ label, style, ...props }) {
  return (
    <View style={[{ marginTop: 14 }, style]}>
      {!!label && <Label>{label}</Label>}
      <Input autoCapitalize="none" autoCorrect={false} {...props} />
    </View>
  );
}

export function Area({ label, style, ...props }) {
  return (
    <View style={[{ marginTop: 14 }, style]}>
      {!!label && <Label>{label}</Label>}
      <Input autoCapitalize="none" autoCorrect={false} multiline textAlignVertical="top" {...props}
        inputStyle={{ minHeight: 120, lineHeight: 21, paddingTop: 11 }} />
    </View>
  );
}

export function Toggle({ label, sub, value, onChange, style }) {
  return (
    <Pressable onPress={() => onChange(!value)}
      style={[{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14 }, style]}>
      <View style={{ flex: 1 }}>
        <Txt size={15}>{cap(label)}</Txt>
        {!!sub && <Txt size={13} color={T.text3} style={{ marginTop: 1 }}>{sub}</Txt>}
      </View>
      <Switch value={!!value} onValueChange={(v) => { haptic.pick(); onChange(v); }}
        trackColor={{ true: T.good, false: T.surface3 }} ios_backgroundColor={T.surface3} />
    </Pressable>
  );
}

export function Choice({ label, options, value, onChange, style }) {
  return (
    <View style={[{ marginTop: 14 }, style]}>
      {!!label && <Label>{label}</Label>}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable key={String(o.value)} onPress={() => { haptic.pick(); onChange(o.value); }}
              style={{ height: 32, paddingHorizontal: 12, borderRadius: 99, justifyContent: "center",
                       borderWidth: 1, borderColor: on ? T.accent : T.line,
                       backgroundColor: on ? T.accent : T.surface }}>
              <Txt size={13.5} weight={on ? "500" : "400"} color={on ? T.accentInk : T.text2}>{o.label}</Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Note({ note, style }) {
  if (!note || !note.text) return null;
  const c = note.kind === "err" ? T.danger : note.kind === "ok" ? T.good : T.text3;
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", gap: 7, marginTop: 12 }, style]}>
      {note.kind === "busy" ? <ActivityIndicator size="small" color={T.text3} />
        : <Icon name={note.kind === "err" ? "alert" : note.kind === "ok" ? "check" : "spark"} size={15} color={c} />}
      <Txt size={13.5} color={c} style={{ flex: 1 }}>{cap(note.text)}</Txt>
    </View>
  );
}

// A read-only value the owner may need elsewhere (a token, a url): long
// press selects it, Share hands it to any app.
export function Value({ label, value, style }) {
  return (
    <View style={[{ marginTop: 14 }, style]}>
      {!!label && <Label>{label}</Label>}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: T.surface2,
                     borderWidth: 1, borderColor: T.line, borderRadius: 11, paddingLeft: 12, paddingVertical: 4,
                     paddingRight: 4, minHeight: 44 }}>
        <Txt mono selectable numberOfLines={2} size={12.5} color={value ? T.text : T.text4} style={{ flex: 1 }}>
          {value || "—"}
        </Txt>
        {!!value && <Button label="Share" small kind="ghost" onPress={() => Share.share({ message: value })} />}
      </View>
    </View>
  );
}

/* ---------- screens ---------- */
export function Header({ title, sub, onBack, right, left, center }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8, height: 54,
                   borderBottomWidth: 1, borderColor: T.line, backgroundColor: T.bg }}>
      {onBack ? <IconButton name="back" size={24} color={T.text} onPress={onBack} label="Back" /> : <View style={{ width: 8 }} />}
      {left}
      {center || (
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt size={16.5} weight="600" numberOfLines={1}>{title}</Txt>
          {!!sub && <Txt size={12.5} color={T.text3} numberOfLines={1}>{sub}</Txt>}
        </View>
      )}
      {right}
    </View>
  );
}

export function Crumb({ path, style }) {
  return <Txt size={16.5} weight="600" numberOfLines={1} style={style}>{cap(path[path.length - 1])}</Txt>;
}

// Section header from the older screens: "roster · 5" reads as Roster, 5.
export function Rule({ label, style }) {
  const [head, ...rest] = String(label).split(" · ");
  return (
    <View style={[{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 28, marginBottom: 10 }, style]}>
      <Txt size={15} weight="600">{cap(head)}</Txt>
      {rest.length > 0 && <Txt size={13} color={T.text3}>{rest.join(" · ")}</Txt>}
    </View>
  );
}

// The older screens' list entries become cards.
export function Gutter({ children, style }) {
  return <Card pad={14} style={style}>{children}</Card>;
}

export function Screen({ children, scroll = true, refreshControl, contentStyle, innerRef, ...rest }) {
  if (!scroll) return <View style={{ flex: 1, backgroundColor: T.bg }}>{children}</View>;
  return (
    <ScrollView ref={innerRef} style={{ flex: 1, backgroundColor: T.bg }} keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl} keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets {...rest}
      contentContainerStyle={[{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 48 }, contentStyle]}>
      {children}
    </ScrollView>
  );
}

export function Shell({ crumbs, title, onBack, right, children }) {
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <Header title={title || cap(crumbs[crumbs.length - 1])} onBack={onBack} right={right} />
      <Screen>{children}</Screen>
    </KeyboardAvoidingView>
  );
}

// A sheet that slides up over the page, for details and for reading a whole
// command, diff or result before deciding anything.
export function Sheet({ visible, onClose, title, children, right, scroll = true }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}>
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, height: 56,
                       borderBottomWidth: 1, borderColor: T.line, gap: 10 }}>
          <Txt size={16.5} weight="600" numberOfLines={1} style={{ flex: 1 }}>{title}</Txt>
          {right}
          <Pressable onPress={onClose} hitSlop={10}><Txt size={15.5} weight="600">Done</Txt></Pressable>
        </View>
        {scroll ? <Screen>{children}</Screen> : children}
      </View>
      <ToastHost bottom={28} />
    </Modal>
  );
}

/* ---------- toasts ---------- */
const toastListeners = new Set();
let toastSeq = 0;
export function notify(text, error = false, action = null) {
  const t = { id: ++toastSeq, text: String(text || ""), error, action };
  if (error) haptic.warn();
  for (const fn of toastListeners) fn(t);
}

function Toast({ t, onGone }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(a, { toValue: 0, duration: 200, useNativeDriver: true }).start(onGone);
    }, t.error ? 9000 : 5000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <Animated.View style={{ opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
      backgroundColor: t.error ? T.danger : T.text, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11,
      flexDirection: "row", alignItems: "center", gap: 12, shadowColor: "#000", shadowOpacity: 0.25,
      shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 6 }}>
      <Txt size={14} color={t.error ? "#ffffff" : T.bg} style={{ flex: 1 }}>{t.text}</Txt>
      {!!t.action && (
        <Pressable hitSlop={8} onPress={() => { onGone(); t.action.run(); }}>
          <Txt size={14} weight="600" color={t.error ? "#ffffff" : T.bg}>{t.action.label}</Txt>
        </Pressable>
      )}
    </Animated.View>
  );
}

export function ToastHost({ bottom = 90 }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const fn = (t) => setItems((x) => [...x.slice(-2), t]);
    toastListeners.add(fn);
    return () => { toastListeners.delete(fn); };
  }, []);
  if (!items.length) return null;
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 14, right: 14, bottom, gap: 8 }}>
      {items.map((t) => <Toast key={t.id} t={t} onGone={() => setItems((x) => x.filter((y) => y.id !== t.id))} />)}
    </View>
  );
}

export function agentOptions(state) {
  return (state?.agents || []).map((a) => ({ value: a.id, label: a.name || a.id }));
}
