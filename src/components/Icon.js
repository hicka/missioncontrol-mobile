// The desktop's icon set, stroke for stroke: 24-unit line icons with round
// ends, drawn in whatever ink the caller gives them.
import React from "react";
import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";
import { T } from "../theme";

const P = (d) => ({ t: "path", d });
const ICONS = {
  home: [P("M3.5 10.2 12 3.5l8.5 6.7V19a1.5 1.5 0 0 1-1.5 1.5h-4.2v-5.8H9.2v5.8H5A1.5 1.5 0 0 1 3.5 19z")],
  inbox: [P("M3.5 13.5h4.8l1.4 2.8h4.6l1.4-2.8h4.8"),
          P("M6.3 5h11.4l2.8 8.5V18a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18v-4.5z")],
  tasks: [P("m4 6.8 1.6 1.6L8.6 5.4M4 12.8l1.6 1.6 3-3M4 18.8l1.6 1.6 3-3M12 7h8M12 13h8M12 19h8")],
  clock: [{ t: "circle", cx: 12, cy: 12, r: 8.5 }, P("M12 7.5V12l3 2")],
  book: [P("M4.5 18.5V5.8A2.3 2.3 0 0 1 6.8 3.5h12.7v13H6.8a2.3 2.3 0 0 0-2.3 2.3 2.2 2.2 0 0 0 2.3 2.2h12.7"),
         P("M8.5 7.5h7")],
  growth: [P("m3.5 16.5 5.5-5.5 4 4 7.5-7.5"), P("M15 7.5h5.5V13")],
  settings: [P("M4 7h9M17 7h3M4 17h3M11 17h9"), { t: "circle", cx: 15, cy: 7, r: 2 },
             { t: "circle", cx: 9, cy: 17, r: 2 }],
  plus: [P("M12 5v14M5 12h14")],
  search: [{ t: "circle", cx: 11, cy: 11, r: 6.5 }, P("m20 20-4.2-4.2")],
  up: [P("M12 19V5.5M5.5 12 12 5.5l6.5 6.5")],
  mic: [{ t: "rect", x: 9, y: 3.5, width: 6, height: 11, rx: 3 }, P("M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5")],
  clip: [P("m20.5 11.5-8.3 8.3a5 5 0 0 1-7.1-7.1l8.6-8.6a3.4 3.4 0 0 1 4.8 4.8l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9")],
  stop: [{ t: "rect", x: 6.5, y: 6.5, width: 11, height: 11, rx: 2.5 }],
  edit: [P("M4.5 19.5h4l10-10a2.8 2.8 0 0 0-4-4l-10 10z"), P("m13 7 4 4")],
  users: [{ t: "circle", cx: 9, cy: 8.5, r: 3.5 }, P("M3 19.5a6 6 0 0 1 12 0"),
          P("M16 5.5a3.5 3.5 0 0 1 0 6.5M18 14a6 6 0 0 1 3 5.5")],
  chev: [P("m9.5 6 6 6-6 6")],
  back: [P("m14.5 6-6 6 6 6")],
  down: [P("m6 9.5 6 6 6-6")],
  x: [P("M6.5 6.5l11 11M17.5 6.5l-11 11")],
  check: [P("m5 12.5 4.5 4.5L19 7.5")],
  circle: [{ t: "circle", cx: 12, cy: 12, r: 7.5 }],
  spark: [P("M12 3.5c.6 4.4 2.6 6.4 7 7-4.4.6-6.4 2.6-7 7-.6-4.4-2.6-6.4-7-7 4.4-.6 6.4-2.6 7-7z")],
  bolt: [P("M13 3.5 5 13.5h6l-1 7 8-10h-6z")],
  shield: [P("M12 3.5 5 6.2v5.6c0 4.4 3 7.6 7 8.7 4-1.1 7-4.3 7-8.7V6.2z")],
  term: [{ t: "rect", x: 3.5, y: 4.5, width: 17, height: 15, rx: 2.5 }, P("m7.5 9.5 3 2.5-3 2.5M12.5 15h4")],
  globe: [{ t: "circle", cx: 12, cy: 12, r: 8.5 },
          P("M3.5 12h17M12 3.5c2.3 2.5 3.4 5.3 3.4 8.5s-1.1 6-3.4 8.5c-2.3-2.5-3.4-5.3-3.4-8.5s1.1-6 3.4-8.5z")],
  branch: [{ t: "circle", cx: 7, cy: 6, r: 2 }, { t: "circle", cx: 7, cy: 18, r: 2 },
           { t: "circle", cx: 17, cy: 8, r: 2 }, P("M7 8v8M17 10c0 4-4 4-8.6 6.8")],
  menu: [P("M4 7h16M4 12h16M4 17h16")],
  more: [{ t: "circle", cx: 6, cy: 12, r: 1.2, fill: true }, { t: "circle", cx: 12, cy: 12, r: 1.2, fill: true },
         { t: "circle", cx: 18, cy: 12, r: 1.2, fill: true }],
  moon: [P("M19.5 14.5A7.8 7.8 0 1 1 9.5 4.5a6.3 6.3 0 0 0 10 10z")],
  sun: [{ t: "circle", cx: 12, cy: 12, r: 3.8 },
        P("M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4")],
  auto: [{ t: "circle", cx: 12, cy: 12, r: 8.5 }, { t: "path", d: "M12 3.5v17a8.5 8.5 0 0 0 0-17z", fill: true }],
  refresh: [P("M19.5 11.5a7.5 7.5 0 1 0-2.2 5.3"), P("M19.5 4.5v7h-7")],
  pin: [P("M12 16v5M8.5 3.5h7l-1 5.5 3.5 3.5V14h-12v-1.5L9.5 9z")],
  flask: [P("M9.5 3.5h5M10.5 3.5v5.8l-5.2 8.8a1.6 1.6 0 0 0 1.4 2.4h10.6a1.6 1.6 0 0 0 1.4-2.4l-5.2-8.8V3.5"),
          P("M7.6 15h8.8")],
  alert: [P("M12 4 2.8 19.5h18.4z"), P("M12 10v4.2M12 16.8v.2")],
  play: [P("M8 5.5v13l10.5-6.5z")],
  chat: [P("M20.5 12a8 8 0 0 1-11.6 7.1L4 20l1-4.3A8 8 0 1 1 20.5 12z")],
  memory: [{ t: "ellipse", cx: 12, cy: 6, rx: 7.5, ry: 2.8 },
           P("M4.5 6v6c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V6M4.5 12v6c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-6")],
  lightbulb: [P("M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3z")],
  wave: [P("M4 10v4M8 7v10M12 4.5v15M16 7v10M20 10v4")],
  phone: [{ t: "rect", x: 6.5, y: 2.5, width: 11, height: 19, rx: 2.5 }, P("M10.5 18.5h3")],
  link: [P("M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2"),
         P("M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2")],
  image: [{ t: "rect", x: 3.5, y: 4.5, width: 17, height: 15, rx: 2.5 }, { t: "circle", cx: 9, cy: 10, r: 1.6 },
          P("m4.5 17.5 5-5 4 4 2.5-2.5 3.5 3.5")],
  file: [P("M6.5 3.5h7l4.5 4.5v11a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5z"),
         P("M13.5 3.5V8H18")],
  heart: [{ t: "path", fill: true,
            d: "M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z" }],
};

export default function Icon({ name, size = 18, color, weight = 1.7, fill = false }) {
  const parts = ICONS[name] || ICONS.chev;
  const ink = color || T.text;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {parts.map((p, i) => {
        const solid = fill || p.fill;
        const paint = solid ? { fill: ink, stroke: "none" }
          : { fill: "none", stroke: ink, strokeWidth: weight, strokeLinecap: "round", strokeLinejoin: "round" };
        if (p.t === "circle") return <Circle key={i} cx={p.cx} cy={p.cy} r={p.r} {...paint} />;
        if (p.t === "rect") return <Rect key={i} x={p.x} y={p.y} width={p.width} height={p.height} rx={p.rx} {...paint} />;
        if (p.t === "ellipse") return <Ellipse key={i} cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} {...paint} />;
        return <Path key={i} d={p.d} {...paint} />;
      })}
    </Svg>
  );
}
