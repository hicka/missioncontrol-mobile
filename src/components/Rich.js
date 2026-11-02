// Agents write markdown-ish text: paragraphs, lists, fenced code, a heading
// now and then, **bold**, `code` and links. Only these few shapes are read;
// everything else stays the plain text it was.
import React from "react";
import { Linking, ScrollView, Text, View } from "react-native";
import { FONTS, T } from "../theme";

const URL_RX = /https?:\/\/[^\s<>"]+/g;

function inline(s, key, size) {
  const out = [];
  String(s ?? "").split(/(`[^`\n]+`)/g).forEach((part, i) => {
    if (i % 2) {
      out.push(<Text key={`${key}c${i}`} style={{ fontFamily: FONTS.mono, fontSize: size * 0.86,
        color: T.text, backgroundColor: T.surface2 }}>{` ${part.slice(1, -1)} `}</Text>);
      return;
    }
    // links are found first so an ampersand in a query is part of the link
    // and a full stop after one is not
    let last = 0, n = 0;
    for (const m of part.matchAll(URL_RX)) {
      let url = m[0];
      const trail = url.match(/[.,;:!?)\]}'"]+$/);
      if (trail) url = url.slice(0, -trail[0].length);
      out.push(...plain(part.slice(last, m.index), `${key}p${i}-${n}`, size));
      out.push(<Text key={`${key}u${i}-${n}`} onPress={() => Linking.openURL(url).catch(() => {})}
        style={{ textDecorationLine: "underline", textDecorationColor: T.text4 }}>{url}</Text>);
      last = m.index + url.length;
      n += 1;
    }
    out.push(...plain(part.slice(last), `${key}p${i}-e`, size));
  });
  return out;
}

function plain(s, key, size) {
  if (!s) return [];
  const out = [];
  s.split(/(\*\*[^*\n]+?\*\*)/g).forEach((bit, i) => {
    if (!bit) return;
    if (i % 2) { out.push(<Text key={`${key}b${i}`} style={{ fontWeight: "600" }}>{bit.slice(2, -2)}</Text>); return; }
    // #123 reads as a pull request or issue number
    let last = 0, j = 0;
    for (const m of bit.matchAll(/(^|[\s(])(#\d{2,5})\b/g)) {
      const at = m.index + m[1].length;
      if (at > last) out.push(bit.slice(last, at));
      out.push(<Text key={`${key}r${i}-${j++}`} style={{ fontFamily: FONTS.mono, fontSize: size * 0.9,
        color: T.text2 }}>{m[2]}</Text>);
      last = at + m[2].length;
    }
    if (last < bit.length) out.push(bit.slice(last));
  });
  return out;
}

export function parse(text) {
  const lines = String(text ?? "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let para = [], list = null;
  const flushPara = () => { if (para.length) { blocks.push({ t: "p", text: para.join("\n") }); para = []; } };
  const flushList = () => { if (list) { blocks.push(list); list = null; } };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```[\w+-]*\s*$/.test(line)) {
      flushPara(); flushList();
      const body = [];
      while (++i < lines.length && !/^\s*```\s*$/.test(lines[i])) body.push(lines[i]);
      blocks.push({ t: "code", text: body.join("\n") });
      continue;
    }
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const num = line.match(/^\s*(\d{1,3})[.)]\s+(.*)$/);
    const head = line.match(/^\s*#{1,4}\s+(.+)$/);
    if (bullet || num) {
      flushPara();
      const type = bullet ? "ul" : "ol";
      if (!list || list.type !== type) { flushList(); list = { t: "list", type, items: [], start: num ? +num[1] : 1 }; }
      list.items.push(bullet ? bullet[1] : num[2]);
    } else if (head) {
      flushPara(); flushList();
      blocks.push({ t: "h", text: head[1] });
    } else if (!line.trim()) {
      flushPara(); flushList();
    } else if (list && /^\s{2,}\S/.test(line)) {
      list.items[list.items.length - 1] += " " + line.trim();
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara(); flushList();
  return blocks;
}

export default function Rich({ text, size = 16, color, selectable = true }) {
  const blocks = parse(text);
  const lh = Math.round(size * 1.5);
  const base = { fontSize: size, lineHeight: lh, color: color || T.text };
  return (
    <View style={{ gap: Math.round(size * 0.6) }}>
      {blocks.map((b, i) => {
        if (b.t === "code") {
          return (
            <ScrollView key={i} horizontal showsHorizontalScrollIndicator={false}
              style={{ backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: 10 }}
              contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10 }}>
              <Text selectable={selectable} style={{ fontFamily: FONTS.mono, fontSize: 12.5, lineHeight: 19,
                color: T.text }}>{b.text}</Text>
            </ScrollView>
          );
        }
        if (b.t === "h") {
          return <Text key={i} selectable={selectable} style={[base, { fontWeight: "600" }]}>{inline(b.text, i, size)}</Text>;
        }
        if (b.t === "list") {
          return (
            <View key={i} style={{ gap: 4 }}>
              {b.items.map((item, j) => (
                <View key={j} style={{ flexDirection: "row", gap: 8, paddingLeft: 2 }}>
                  <Text style={[base, { color: T.text3, minWidth: b.type === "ol" ? 18 : 10 }]}>
                    {b.type === "ol" ? `${b.start + j}.` : "•"}
                  </Text>
                  <Text selectable={selectable} style={[base, { flex: 1 }]}>{inline(item, `${i}-${j}`, size)}</Text>
                </View>
              ))}
            </View>
          );
        }
        return <Text key={i} selectable={selectable} style={base}>{inline(b.text, i, size)}</Text>;
      })}
    </View>
  );
}

// `code` spans inside an ordinary line of text, as children of a <Text>
export function codeSpans(text, size = 15) {
  return String(text ?? "").split(/(`[^`\n]+`)/g).map((part, i) => i % 2
    ? <Text key={i} style={{ fontFamily: FONTS.mono, fontSize: size * 0.86, backgroundColor: T.surface2 }}>
        {part.slice(1, -1)}</Text>
    : part);
}

// One line, for previews: code spans keep their look, nothing else does.
export function Inline({ text, size = 14, color, numberOfLines = 1, style }) {
  return (
    <Text numberOfLines={numberOfLines} style={[{ fontSize: size, lineHeight: Math.round(size * 1.4),
      color: color || T.text3 }, style]}>
      {String(text ?? "").split(/(`[^`\n]+`)/g).map((part, i) => i % 2
        ? <Text key={i} style={{ fontFamily: FONTS.mono, fontSize: size * 0.86 }}>{part.slice(1, -1)}</Text>
        : part)}
    </Text>
  );
}
