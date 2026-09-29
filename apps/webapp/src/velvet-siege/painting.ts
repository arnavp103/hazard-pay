/** Original sprite-like vector figures in an elevated, depth-sorted ground world. */
export const DURATION = 42;
export const WIDTH = 1600;
export const HEIGHT = 900;
export const CHAPTERS = [
  { time: 0, title: "The divided garden" },
  { time: 8, title: "Mortar constellation" },
  { time: 17, title: "The northern breach" },
  { time: 25, title: "Ivory encirclement" },
  { time: 34, title: "The crown falls" },
];
type C = CanvasRenderingContext2D;
const ink = "#130f25";
const gold = "#f8ed96";
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => {
  const x = clamp(v);
  return x * x * (3 - 2 * x);
};
function path(c: C, d: string, fill: string | CanvasGradient, stroke?: string, width = 1) {
  const p = new Path2D(d);
  if (fill) {
    c.fillStyle = fill;
    c.fill(p);
  }
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = width;
    c.stroke(p);
  }
}
function ellipse(c: C, x: number, y: number, rx: number, ry: number, color: string) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fillStyle = color;
  c.fill();
}
function line(c: C, points: number[], color: string, width = 1) {
  c.beginPath();
  c.moveTo(points[0] ?? 0, points[1] ?? 0);
  for (let i = 2; i < points.length; i += 2) {
    c.lineTo(points[i] ?? 0, points[i + 1] ?? 0);
  }
  c.strokeStyle = color;
  c.lineWidth = width;
  c.stroke();
}
function text(c: C, value: string, x: number, y: number, size: number, color: string, spacing = 0) {
  c.font = `${size > 26 ? "500" : "400"} ${size}px ${size > 26 ? "Georgia" : "Arial"}`;
  c.fillStyle = color;
  c.letterSpacing = `${spacing}px`;
  c.fillText(value, x, y);
  c.letterSpacing = "0px";
}
function star(c: C, x: number, y: number, radius: number, color: string) {
  c.save();
  c.translate(x, y);
  path(c, `M 0 ${-radius} Q 2 -2 ${radius} 0 Q 2 2 0 ${radius} Q -2 2 ${-radius} 0 Q -2 -2 0 ${-radius}`, color);
  c.restore();
}
function walker(c: C, white: boolean, gait: number, attack: number) {
  const shell = white ? "#e8deca" : "#6550a1";
  const light = white ? "#fff6df" : "#beacf3";
  const shade = white ? "#9e7986" : "#372755";
  const glow = white ? "#ffbe8f" : gold;
  for (const rear of [true, false]) {
    if (!rear) {
      path(c, "M-39 -13 Q-36 -49 -5 -52 Q20 -55 43 -20 L31 4 Q-5 19 -37 5Z", shell, ink, 3);
      path(c, "M-31 -20 Q-25 -46 -1 -45 Q17 -44 30 -26 Q1 -34 -31 -20Z", light);
      path(c, "M-34 -11 Q-3 -22 39 -18 L27 5 Q-5 19 -32 3Z", shade);
      path(c, "M-29 -13 Q-3 -25 32 -17", "", gold, 1.5);
      path(c, "M-14 -45 L-6 -22 L-11 6 M4 -45 L13 -25 L8 6", "", ink, 2);
      path(c, `M17 -36 Q36 -45 ${61 + attack * 12} -27 L58 -21 L30 -20Z`, shell, ink, 2);
      ellipse(c, 46 + attack * 7, -28, 9, 3, glow);
      ellipse(c, -29, -7, 3, 3, glow);
    }
    for (let i = 0; i < 3; i++) {
      const x = -24 + i * 23;
      const shift = Math.sin(gait + i * 2) * 8;
      const y = rear ? -1 : 8;
      path(c, `M${x} ${y - 11} Q${x - 19} ${y + 3} ${x - 17 + shift} ${y + 23} L${x + 2 + shift} ${y + 30} L${x - 8 + shift} ${y + 16} L${x + 8} ${y - 1}Z`, rear ? shade : shell, ink, 2);
      line(c, [x - 1, y - 2, x - 11 + shift, y + 15], light, 1.3);
    }
  }
}
function manta(c: C, white: boolean, attack: number) {
  c.save();
  c.scale(1 + attack * 0.45, 1 - attack * 0.15);
  const shell = white ? "#eee5d1" : "#7661b5";
  const light = white ? "#fff7e1" : "#c3aef0";
  const shade = white ? "#b5888d" : "#402b67";
  path(c, "M-33 3 Q-66 0 -78 -27 Q-79 -8 -68 8 L-44 22 L-18 13Z", shade, ink, 3);
  path(c, "M-15 17 L-30 34 L-28 52 L-11 44 L-17 37 L-1 26 M13 18 L30 37 L23 53 L43 47 L43 31 L27 13", shell, ink, 2);
  path(c, "M-53 11 Q-30 -13 -47 -33 Q-7 -42 31 -17 L57 -11 L34 5 Q-18 -1 -53 11Z", shell, ink, 3);
  path(c, "M-43 -30 Q-6 -30 25 -15 L-11 -16 L-47 7 Q-25 -12 -43 -30Z", light);
  path(c, "M-45 13 Q-19 9 4 18 L40 4 L25 27 L-1 34 L-30 22Z", shade, ink, 2);
  path(c, "M-13 -20 L-5 -57 L6 -68 L15 -58 L11 -27 L28 -18Z", shell, ink, 2);
  path(c, `M-5 -54 L4 ${-77 - attack * 12} L12 -54Z`, gold);
  path(c, "M-9 -14 Q9 -28 30 -12 L39 -8 L22 3 L-2 1Z", shade, ink, 2);
  line(c, [-35, -25, -12, -23, 11, -13, 32, -10], gold, 1.5);
  for (let i = 0; i < 3; i++) {
    ellipse(c, -15 + i * 16, 21 - i * 3, 6, 2, white ? "#ffb89b" : "#dddb9c");
  }
  c.restore();
}
function crown(c: C, white: boolean, attack: number) {
  const shell = white ? "#efead9" : "#735cbd";
  const light = white ? "#fffef0" : "#c7b0f8";
  path(c, "M-13 0 Q-29 13 -21 35 L-6 45 L16 38 Q29 19 9 2Z", white ? "#bca49c" : "#473065", ink, 3);
  path(c, "M-13 12 Q0 4 15 14 L10 29 L-7 34 L-18 25Z", light, ink, 2);
  path(c, "M-20 6 Q-58 -8 -53 29 L-42 44 L-48 18 L-30 29 L-11 20 M22 3 Q59 -12 57 22 L43 39 L48 14 L31 25 L13 15Z", shell, ink, 3);
  path(c, "M-4 35 L-7 54 L6 63 L18 49 L12 34Z", shell, ink, 2);
  ellipse(c, 0, 16, 5, 5, gold);
  path(c, "M-18 5 L-37 29 L-18 22 L-5 11 L10 12 L27 29 L42 32 L26 7Z", shell, ink, 3);
  path(c, "M-32 -9 L-38 -49 L-23 -35 L-13 -68 L-1 -37 L13 -72 L22 -35 L40 -53 L35 -9 L17 10 L-11 10Z", shell, ink, 3);
  path(c, "M-30 -12 L-28 -27 L27 -27 L31 -12 L14 4 L-8 4Z", white ? "#4b394d" : "#302049", ink, 2);
  path(c, "M-23 -18 Q0 -32 23 -17 L14 -10 L-12 -10Z", gold);
  path(c, "M-9 -47 L-3 -21 L5 -21 L10 -49 L4 -30 L-2 -30Z", light);
  path(c, `M30 -6 Q51 -17 ${54 + attack * 12} -44 Q50 -32 43 -22 L35 7Z`, light, ink, 2);
  line(c, [-31, -37, -25, -17, -14, 0], light, 2);
}
function ivory(c: C, kind: number, unfold: number, gait: number) {
  const shell = "#eee8d6";
  const shine = "#fff9e6";
  const shade = "#b18b96";
  if (kind === 0) {
    for (let i = 0; i < 3; i++) {
      const x = -30 + i * 25;
      const step = Math.sin(gait + i * 2) * 6;
      path(c, `M${x} -4 Q${x - 18} 9 ${x - 12 + step} 25 L${x + 3 + step} 31 L${x - 1 + step} 18 L${x + 9} 1Z`, shade, ink, 2);
    }
    path(c, "M-43 -8 Q-55 -50 -21 -61 Q-47 -29 -4 -27 Q15 -30 25 -14 L29 7 Q-10 26 -43 -8Z", shell, ink, 3);
    path(c, "M-27 -38 Q-3 -72 22 -59 Q8 -42 14 -26 L-6 -22Z", shade, ink, 2);
    path(c, "M3 -23 Q4 -73 33 -77 Q49 -80 54 -67 L49 -56 L27 -59 Q17 -47 26 -23Z", shell, ink, 3);
    path(c, "M28 -71 L62 -65 L48 -56 L28 -59Z", shine, ink, 2);
    path(c, "M-37 -25 Q-39 -40 -30 -46 Q-32 -25 -8 -14 L20 -9 Q-19 0 -37 -25Z", shine);
    line(c, [-24, -9, -3, 2, 20, -1], "#d6b06c", 2);
    ellipse(c, 38, -66, 5, 2, "#59223e");
  } else if (kind === 1) {
    c.save();
    c.scale(1 + unfold * 0.6, 1);
    path(c, "M-5 -24 Q-31 -72 -59 -48 Q-50 -13 -16 6 L0 19 L17 6 Q51 -14 61 -47 Q32 -74 5 -24Z", shell, ink, 3);
    path(c, "M-51 -45 Q-34 -45 -8 -10 L-10 -1 Q-39 -18 -51 -45Z M51 -45 Q34 -45 8 -10 L10 -1 Q39 -18 51 -45Z", shade);
    path(c, "M-44 -45 Q-28 -39 -14 -16 M44 -45 Q28 -39 14 -16", "", shine, 3);
    c.restore();
    path(c, "M-12 13 L-9 -46 Q0 -66 10 -46 L13 13 L0 31Z", shell, ink, 3);
    ellipse(c, 0, -37, 18, 18, ink);
    ellipse(c, 0, -37, 14, 14, gold);
    ellipse(c, 0, -37, 10, 10, shade);
    path(c, `M-4 -33 L0 ${-65 - unfold * 24} L4 -33Z`, shine);
    line(c, [0, -7, 0, 19], "#bd9278", 2);
  } else {
    path(c, "M-54 -2 Q-27 -58 2 -49 Q-8 -23 20 -27 Q44 -40 54 -13 L40 9 Q9 -4 -3 25 Q-18 -9 -54 -2Z", shell, ink, 3);
    path(c, "M-47 -7 Q-27 -29 -17 -28 Q-28 -11 -11 2 Q-23 -7 -47 -7Z M1 -40 Q-5 -14 24 -14 L41 -21 Q29 0 1 -5 Q-18 -20 1 -40Z", shine);
    path(c, "M-4 2 Q12 -16 32 -8 L21 6 L3 10Z", shade, ink, 2);
    ellipse(c, 21, -3, 7, 2, "#5d2848");
    path(c, "M-40 3 L-17 16 L-9 38 L2 29 L-3 12Z", shade, ink, 2);
  }
}
function ivoryHero(c: C, pose: number, ruin: number) {
  path(c, "M-70 16 Q-89 44 -87 78 L-63 69 L-55 42 L-14 24 M26 18 L59 52 L71 77 L95 80 L79 44 L57 9", "#e2d3c5", ink, 5);
  c.save();
  c.rotate(pose * 0.18);
  path(c, "M-47 0 Q-126 -24 -97 -127 Q-84 -161 -54 -176 Q-95 -106 -44 -61 L-9 -34Z", "#dfd3c8", ink, 5);
  path(c, "M-63 -58 Q-96 -89 -81 -138 Q-82 -79 -37 -60Z", "#fff7e0");
  c.save();
  c.translate(15, -41);
  c.rotate(pose * -0.42 + ruin * 0.4);
  c.translate(-15, 41);
  path(c, "M-25 -31 Q-29 -108 25 -148 Q77 -182 91 -146 Q66 -153 49 -127 Q26 -92 46 -53 L60 -5Z", "#f0e7d4", ink, 5);
  path(c, "M16 -53 Q0 -105 47 -135 Q22 -100 40 -67Z", "#b8939b");
  path(c, "M53 -148 Q87 -178 111 -145 L120 -130 L92 -119 L67 -129Z", "#f7eeda", ink, 4);
  path(c, "M94 -137 L153 -126 L117 -110 L88 -119Z", "#fff9df", ink, 4);
  ellipse(c, 87, -139, 8, 3, "#7d3650");
  c.restore();
  path(c, "M-67 -2 Q-62 -52 -12 -59 Q28 -65 60 -24 L66 4 Q14 44 -44 25Z", "#e9dfce", ink, 5);
  path(c, "M-53 -4 Q-34 -38 4 -43 Q28 -44 49 -24 Q0 -28 -53 -4Z", "#fff7e2");
  path(c, "M-41 11 Q-8 -10 49 -12 L45 12 Q3 36 -41 11Z", "#a37e8d", ink, 3);
  for (let i = 0; i < 5; i++) {
    line(c, [-27 + i * 16, 8, -22 + i * 16, 17], gold, 3);
  }
  c.restore();
  if (ruin > 0) {
    c.save();
    c.translate(-40 - ruin * 35, -90 + ruin * 100);
    c.rotate(-ruin * 1.7);
    path(c, "M0 0 Q-30 -30 -11 -83 L11 -101 Q-2 -53 25 -24Z", "#d0bdb7", ink, 4);
    c.restore();
  }
}
function hero(c: C, white: boolean, pose: number, recoil: number) {
  const shell = white ? "#f2ead8" : "#6d51a2";
  const light = white ? "#fff7db" : "#c2a2ec";
  const shade = white ? "#a27b82" : "#342341";
  for (let i = 0; i < 5; i++) {
    c.save();
    c.translate(-23, -40);
    c.rotate(-0.2 - i * 0.2 - Math.max(0, -pose) * i * 0.2);
    path(c, "M0 0 Q-22 -29 -15 -91 Q1 -89 13 -61 L13 -7Z", i % 2 ? shade : shell, ink, 3);
    path(c, "M-9 -73 Q-8 -44 5 -23", "", light, 1.5);
    c.restore();
  }
  const plant = Math.max(0, pose);
  path(c, `M-55 9 L-94 ${46 - plant * 8} L-99 72 L-68 59 L-65 37 L-38 25 M29 11 L${65 + plant * 30} 40 L${70 + plant * 28} 68 L${95 + plant * 34} 78 L${89 + plant * 28} 39 L54 9`, shell, ink, 5);
  path(c, "M-43 16 L-63 67 L-35 71 L-20 36 M17 21 L19 72 L50 76 L40 28", shade, ink, 4);
  path(c, "M-62 -29 Q-51 -79 -5 -86 Q37 -88 57 -51 L58 8 Q17 41 -43 15Z", shell, ink, 5);
  path(c, "M-53 -35 Q-32 -72 2 -75 Q30 -72 45 -51 Q4 -64 -53 -35Z", light);
  path(c, "M-50 -18 Q-10 -43 50 -29 L44 5 Q2 29 -42 9Z", shade, ink, 3);
  path(c, "M-49 -19 Q1 -41 49 -27", "", gold, 3);
  for (let i = 0; i < 4; i++) {
    path(c, `M${-34 + i * 19} -3 L${-25 + i * 19} -7 L${-23 + i * 19} 5 L${-31 + i * 19} 8Z`, gold);
  }
  path(c, "M-23 -68 L-21 -132 L-8 -108 L1 -158 L12 -112 L26 -137 L29 -69Z", shell, ink, 4);
  path(c, "M-14 -82 L-11 -101 L-5 -87 L4 -127 L12 -86 L21 -103 L22 -80Z", gold);
  path(c, "M-48 -39 Q-108 -67 -92 -122 Q-91 -87 -46 -79 L-28 -53Z", light, ink, 4);
  c.save();
  c.translate(45 - recoil * 13, -32);
  c.rotate(pose);
  path(c, "M-7 4 L32 -34 L47 -91 L66 -86 L60 -38 L24 16Z", shade, ink, 4);
  const extension = Math.max(0, -pose) * 36 + recoil * 13;
  c.translate(0, -extension);
  path(c, "M-7 4 L32 -34 L47 -91 L45 -161 L63 -195 L71 -129 L74 -87 L93 -133 L103 -197 L115 -166 L112 -84 L74 -20 L35 21 L2 26Z", shell, ink, 5);
  path(c, "M44 -20 L63 -83 L60 -141 L68 -115 L76 -66 L99 -116 L106 -161 L104 -84 L69 -20Z", gold);
  line(c, [52, -93, 104, -83], ink, 6);
  line(c, [46, -68, 91, -58], ink, 6);
  path(c, "M2 -4 L29 -20 L41 -1 L24 16Z", shade, ink, 3);
  ellipse(c, 28, -6, 7, 7, light);
  for (const side of [-1, 1]) {
    c.save();
    c.translate(80, -79);
    c.rotate(side * Math.max(0, -pose) * 0.5);
    path(c, side < 0 ? "M-14 0 L-31 -53 L-25 -80 L-6 -32Z" : "M14 0 L31 -53 L25 -80 L6 -32Z", light, ink, 2);
    c.restore();
  }
  c.restore();
  path(c, "M-42 -26 Q-66 -57 -56 -81 Q-43 -68 -29 -63 M-33 -28 Q-45 -46 -40 -58", "", "#e2c9ef", 1.5);
  path(c, "M-16 -65 Q2 -80 27 -61 M-10 -58 Q7 -70 28 -55", "", gold, 1);
  ellipse(c, 35, -51, 13, 4, gold);
}
function burst(c: C, x: number, y: number, p: number, size: number, white = false) {
  if (p < 0 || p > 1) {
    return;
  }
  c.save();
  c.translate(x, y);
  c.globalAlpha = (1 - p) * 0.9;
  const r = size * (0.15 + p);
  c.strokeStyle = white ? "#fff5cc" : "#d1adff";
  c.lineWidth = 5 * (1 - p) + 1;
  c.beginPath();
  c.ellipse(0, 0, r, r * 0.45, 0, 0, Math.PI * 2);
  c.stroke();
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4;
    const d = r * (0.5 + (i % 3) * 0.27);
    const x2 = Math.cos(a) * d;
    const y2 = Math.sin(a) * d * 0.7 - p * size * 0.3;
    path(c, `M${x2} ${y2} l${Math.cos(a) * 16} ${Math.sin(a) * 16} l-9 0Z`, i % 2 ? gold : "#f5beac");
  }
  star(c, 0, 0, size * (1 - p) * 0.7, "#fffadd");
  c.restore();
}

export type Point = { x: number; y: number };
export type Engine = { id: number; faction: 0 | 1; kind: number; row: number; x: number; y: number; death: number; commander: boolean };
export const OBSTACLES = [
  { x: 680, y: 285, w: 220, d: 98, height: 40 },
  { x: 795, y: 685, w: 184, d: 80, height: 34 },
  { x: 287, y: 310, w: 98, d: 60, height: 60 },
  { x: 1235, y: 740, w: 86, d: 58, height: 57 },
];
export function project(p: Point, z = 0) {
  return { x: p.x + 22, y: 86 + p.y * 0.72 - z };
}
export const ENGINES: Engine[] = Array.from({ length: 84 }, (_, id) => {
  const faction = (id >= 42 ? 1 : 0) as 0 | 1;
  const n = id % 42;
  const row = Math.floor(n / 14);
  const col = n % 14;
  return { id, faction, kind: col % 3, row, x: faction ? 1440 - (col % 7) * 41 : 100 + (col % 7) * 41, y: [166, 529, 885][row]! + (col % 4 - 1.5) * 35 + Math.sin(col * 3) * 10, death: faction ? (n < 7 ? 10.6 + n * 0.21 : n < 14 ? 19.5 + (n - 7) * 0.24 : 35.4 + (n - 14) * 0.14) : n % 4 === 0 ? 27.5 + Math.floor(n / 4) * 0.19 : 99, commander: faction ? n === 27 : n === 13 };
});
export function insideObstacle(p: Point, margin = 0) {
  return OBSTACLES.some((o) => p.x > o.x - margin && p.x < o.x + o.w + margin && p.y > o.y - margin && p.y < o.y + o.d + margin);
}
function legal(p: Point): Point {
  let result = { ...p };
  for (const o of OBSTACLES) {
    if (result.x > o.x - 22 && result.x < o.x + o.w + 22 && result.y > o.y - 22 && result.y < o.y + o.d + 22) {
      const edges = [{ x: o.x - 24, y: result.y }, { x: o.x + o.w + 24, y: result.y }, { x: result.x, y: o.y - 24 }, { x: result.x, y: o.y + o.d + 24 }];
      result = edges.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0]!;
    }
  }
  return result;
}
function clearSegment(a: Point, b: Point) {
  const samples = Math.ceil(Math.hypot(a.x - b.x, a.y - b.y) / 8);
  for (let i = 0; i <= samples; i++) {
    const v = i / Math.max(1, samples);
    if (insideObstacle({ x: mix(a.x, b.x, v), y: mix(a.y, b.y, v) }, 16)) {
      return false;
    }
  }
  return true;
}
function detour(a: Point, b: Point): Point[] {
  if (clearSegment(a, b)) {
    return [a, b];
  }
  const nodes = [a, b, ...OBSTACLES.flatMap((o) => [{ x: o.x - 22, y: o.y - 22 }, { x: o.x + o.w + 22, y: o.y - 22 }, { x: o.x - 22, y: o.y + o.d + 22 }, { x: o.x + o.w + 22, y: o.y + o.d + 22 }])];
  const distances = nodes.map(() => Infinity);
  const previous = nodes.map(() => -1);
  const visited = new Set<number>();
  distances[0] = 0;
  for (let step = 0; step < nodes.length; step++) {
    let index = -1;
    for (let i = 0; i < nodes.length; i++) {
      if (!visited.has(i) && (index < 0 || distances[i]! < distances[index]!)) {
        index = i;
      }
    }
    if (index < 0 || !Number.isFinite(distances[index]!)) {
      break;
    }
    if (index === 1) {
      const result = [b];
      let cursor = 1;
      while (previous[cursor]! >= 0) {
        cursor = previous[cursor]!;
        result.unshift(nodes[cursor]!);
      } return result;
    }
    visited.add(index);
    for (let i = 0; i < nodes.length; i++) {
      if (!visited.has(i) && clearSegment(nodes[index]!, nodes[i]!)) {
        const d = distances[index]! + Math.hypot(nodes[index]!.x - nodes[i]!.x, nodes[index]!.y - nodes[i]!.y);
        if (d < distances[i]!) {
          distances[i] = d;
          previous[i] = index;
        }
      }
    }
  }
  return [a, b];
}
function route(u: Engine): Point[][] {
  const n = u.id % 42;
  const col = n % 14;
  const f = u.faction;
  const offset = (col % 7 - 3) * 30;
  const center = [980, 783, 605][u.row]!;
  const y = u.y;
  const engagementX = center + (f ? 68 + offset : -68 - offset);
  const flank = u.row === 2 && col >= 7;
  const points = [{ x: u.x, y }, { x: f ? 1130 + offset : 435 - offset, y: y + Math.sin(n * 2) * 54 },
    { x: engagementX, y: y + Math.sin(n * 3) * 33 },
    flank ? { x: f ? 530 + (col - 10) * 16 : 1080 + (col - 10) * 16, y: y + 20 } : { x: engagementX + (f ? -47 : 47), y: y + Math.sin(n * 1.8) * 39 },
    flank ? { x: f ? 530 + (col - 10) * 24 : 1070 + (col - 10) * 23, y: 490 + (col - 10) * 37 } : { x: engagementX + (f ? -67 : 95), y: y + Math.sin(n * 1.8) * 39 },
    { x: flank ? (f ? 670 + (col - 10) * 25 : 910 + (col - 10) * 23) : engagementX + (f ? -60 : 142), y: flank ? 480 + (col - 10) * 40 : y + Math.sin(n * 1.8) * 39 }].map(legal);
  return points.slice(1).map((p, i) => detour(points[i]!, p));
}
const ROUTES = ENGINES.map(route);
export function enginePosition(u: Engine, time: number): Point {
  const t = Math.min(time, u.death);
  const routes = ROUTES[u.id]!;
  const beats = [0, 6, 15, 23, 31, 39];
  for (let i = 1; i < beats.length; i++) {
    if (t <= beats[i]!) {
      const points = routes[i - 1]!;
      const v = ease((t - beats[i - 1]!) / (beats[i]! - beats[i - 1]!));
      const lengths = points.slice(1).map((p, j) => Math.hypot(p.x - points[j]!.x, p.y - points[j]!.y));
      let distance = lengths.reduce((a, b) => a + b, 0) * v;
      for (let j = 0; j < lengths.length; j++) {
        if (distance <= lengths[j]! || j === lengths.length - 1) {
          const a = points[j]!;
          const b = points[j + 1]!;
          const phase = lengths[j] ? distance / lengths[j]! : 0;
          return { x: mix(a.x, b.x, phase), y: mix(a.y, b.y, phase) };
        } distance -= lengths[j]!;
      }
    }
  }
  return routes.at(-1)!.at(-1)!;
}
export function engineFacing(u: Engine, t: number) {
  const a = enginePosition(u, Math.max(0, t - 0.15));
  const b = enginePosition(u, Math.min(DURATION, t + 0.15));
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return { side: Math.abs(dx) > 0.2 ? Math.sign(dx) : u.faction ? -1 : 1, back: dy < -0.4, moving: Math.hypot(dx, dy) > 0.4 };
}
export const SKIRMISHES = [5.5, 13, 16, 22, 30, 33].flatMap((time, beat) => Array.from({ length: 15 }, (_, i) => ({ time: time + (i % 5) * 0.22, source: (beat % 2 ? 42 : 0) + 14 * Math.floor(i / 5) + 7 + i % 5, target: (beat % 2 ? 0 : 42) + 14 * Math.floor(i / 5) + 7 + (i + 2) % 5 })));
export function statusAt(t: number) {
  return { violet: ENGINES.filter((u) => !u.faction && u.death > t).length, ivory: ENGINES.filter((u) => u.faction && u.death > t).length, chapter: CHAPTERS.filter((s) => s.time <= t).at(-1)?.title };
}
function tile(c: C, x: number, y: number, w: number, d: number, color: string) {
  const p = project({ x, y });
  c.fillStyle = color;
  c.fillRect(p.x, p.y, w, d * 0.72);
}
function terrain(c: C, t: number) {
  c.fillStyle = "#352b40";
  c.fillRect(0, 0, WIDTH, HEIGHT);
  for (let row = -3; row < 20; row++) {
    for (let col = -1; col < 27; col++) {
      const x = col * 64 + (row % 2) * 32;
      const y = row * 64;
      tile(c, x + 1, y + 1, 62, 61, ["#403347", "#3c3043", "#443649", "#3b3041"][(row * row + col * col) % 4]!);
    }
  }
  // Irregular intersecting paths, not three repeated horizontal stages.
  path(c, "M40 190 Q330 205 510 290 Q770 396 1100 189 L1530 92 L1550 216 Q1210 253 1010 422 Q780 594 611 602 Q324 522 44 358Z", "#796574", "#b09a99", 3);
  path(c, "M45 683 Q270 669 498 590 Q690 508 725 385 Q752 277 720 85 L902 80 Q933 340 866 490 Q803 659 574 700 Q305 786 42 806Z", "#705c70", "#a48c90", 3);
  path(c, "M1100 96 Q998 384 1070 539 Q1189 720 1488 691 L1535 805 Q1170 852 1015 650 Q920 476 976 322 L1025 87Z", "#715c70", "#aa9393", 3);
  // Engraved radial courtyard inlays supply scale and ground orientation.
  for (const circle of [{ x: 480, y: 545, r: 139 }, { x: 1080, y: 535, r: 115 }, { x: 1020, y: 155, r: 119 }]) {
    const p = project(circle);
    c.strokeStyle = "#bca89555";
    c.lineWidth = 2;
    for (const scale of [1, 0.85]) {
      c.beginPath();
      c.ellipse(p.x, p.y, circle.r * scale, circle.r * scale * 0.72, 0, 0, Math.PI * 2);
      c.stroke();
    } for (let i = 0; i < 12; i++) {
      const a = i / 6 * Math.PI;
      line(c, [p.x + Math.cos(a) * circle.r * 0.86, p.y + Math.sin(a) * circle.r * 0.62, p.x + Math.cos(a) * circle.r, p.y + Math.sin(a) * circle.r * 0.72], "#c2ab9255", 2);
    }
  }
  for (let i = 0; i < 160; i++) {
    const x = (i * 173 + 57) % 1530;
    const y = (i * 347 + 31) % 1030;
    const p = project({ x, y });
    if (i % 5 === 0) {
      line(c, [p.x, p.y, p.x + 12, p.y - 4, p.x + 23, p.y + 3], "#34243f", 1);
    } else {
      ellipse(c, p.x, p.y, 1.5 + i % 3, 1, "#d8c8be26");
    }
  }
  for (const x of [33, 1490]) {
    tile(c, x, 0, 32, 1080, "#243744");
    for (let i = 0; i < 30; i++) {
      const p = project({ x: x + 6, y: (i * 43 + t * 8) % 1050 });
      line(c, [p.x, p.y, p.x + 20, p.y], "#607486", 1);
    }
  }
  for (const cluster of [{ x: 142, y: 66, r: 80 }, { x: 534, y: 340, r: 55 }, { x: 1105, y: 914, r: 90 }, { x: 1280, y: 60, r: 74 }, { x: 131, y: 1020, r: 90 }, { x: 488, y: 1038, r: 60 }]) {
    for (let i = 0; i < 13; i++) {
      const p = project({ x: cluster.x + Math.sin(i * 7) * cluster.r, y: cluster.y + Math.cos(i * 13) * cluster.r * 0.47 });
      ellipse(c, p.x + 10, p.y + 7, 24, 11, "#201c2d66");
      ellipse(c, p.x, p.y, 22, 13, i % 2 ? "#45564e" : "#3d4644");
      ellipse(c, p.x - 4, p.y - 8, 16, 9, i % 3 ? "#5d7060" : "#777961");
      ellipse(c, p.x + 7, p.y - 9, 4, 3, i % 2 ? "#c493b1" : "#d6baba");
    }
  }
}
function structure(c: C, o: typeof OBSTACLES[number]) {
  const p = project({ x: o.x, y: o.y });
  const bottom = project({ x: o.x, y: o.y + o.d });
  const h = o.height;
  path(c, `M${p.x} ${p.y} L${p.x + o.w} ${p.y} L${p.x + o.w + 29} ${bottom.y + 18} L${p.x + 19} ${bottom.y + 20}Z`, "#171b2866");
  path(c, `M${p.x} ${p.y - h} L${p.x + o.w} ${p.y - h} L${p.x + o.w} ${bottom.y - h} L${p.x} ${bottom.y - h}Z`, "#c2b3b1", "#35323f", 2);
  path(c, `M${p.x} ${bottom.y - h} L${p.x + o.w} ${bottom.y - h} L${p.x + o.w} ${bottom.y} L${p.x} ${bottom.y}Z`, "#655e6e", "#35323f", 2);
  c.fillStyle = "#918591";
  c.fillRect(p.x + 5, bottom.y - h + 4, o.w - 10, 8);
  if (o.w > 150) {
    c.fillStyle = "#41444b";
    c.fillRect(p.x + 17, p.y - h + 12, o.w - 34, o.d * 0.72 - 26);
    for (let i = 0; i < Math.floor(o.w / 24) - 1; i++) {
      ellipse(c, p.x + 27 + i * 24, p.y - h + 35 + Math.sin(i * 2) * 8, 19, 14, i % 2 ? "#526b5c" : "#6f7762");
      ellipse(c, p.x + 23 + i * 24, p.y - h + 26 + Math.sin(i * 2) * 8, 8, 5, i % 3 ? "#af7e9c" : "#e1b8bb");
    }
    for (let i = 0; i < Math.floor(o.w / 42); i++) {
      line(c, [p.x + i * 42, bottom.y - h + 14, p.x + i * 42, bottom.y], "#48434f", 2);
    }
  } else {
    path(c, `M${p.x + 28} ${p.y - h + 10} L${p.x + 56} ${p.y - h - 47} L${p.x + 86} ${p.y - h + 10} L${p.x + 56} ${p.y - h + 43}Z`, "#d6c6bb", "#534654", 2);
    line(c, [p.x + 56, p.y - h - 34, p.x + 56, p.y - h + 33], "#eaddcb", 3);
  }
}
function unit(c: C, u: Engine, t: number) {
  const world = enginePosition(u, t);
  const p = project(world);
  const face = engineFacing(u, t);
  const dead = clamp((t - u.death) / 1.2);
  const s = u.commander ? 0.31 : 0.37;
  ellipse(c, p.x + 4, p.y + 2, u.commander ? 29 : 19, u.commander ? 10 : 6, "#18172377");
  c.save();
  c.translate(p.x, p.y - (u.commander ? 21 : 13) + dead * 9);
  c.scale(face.side * s, s);
  const attackTime = u.faction ? 26.6 : 9.4;
  const brace = ease((t - attackTime + 1) / 1.1) - ease((t - attackTime - 1) / 1.4);
  const shotRecoil = SKIRMISHES.filter((shot) => shot.source === u.id).reduce((value, shot) => Math.max(value, t >= shot.time - 0.7 ? Math.max(0, 1 - (t - shot.time + 0.7) / 0.38) : 0), 0);
  c.translate(-shotRecoil * 13, shotRecoil * 4);
  const swing = -ease((t - 17.6) / 1.6) * 0.72 + ease((t - 19.1) / 0.45) * 2.1 - ease((t - 20.3) / 1.6) * 1.38;
  if (dead > 0.85) {
    c.scale(1, 0.34);
    c.rotate(0.23 * (u.id % 3 - 1));
  } else {
    c.rotate(dead * 1.14);
  }
  if (u.commander) {
    if (u.faction) {
      ivoryHero(c, brace, dead);
    } else {
      hero(c, false, swing, Math.max(0, 1 - Math.abs(t - 19.7) * 2));
    }
  } else if (u.faction) {
    ivory(c, u.kind, brace, face.moving ? t * 10 + u.id : u.id);
  } else if (u.kind === 0) {
    walker(c, false, face.moving ? t * 10 + u.id : u.id, brace);
  } else if (u.kind === 1) {
    manta(c, false, brace);
  } else {
    crown(c, false, brace);
  }
  if (face.back && !dead) { // Back plates cover the forward face when troops run north.
    path(c, "M-31 -21 Q-12 -49 15 -28 L27 -2 L8 19 L-22 8Z", u.faction ? "#c3b3ac" : "#493267", ink, 3);
    path(c, "M-20 -16 Q-7 -32 12 -20 L16 2 L1 10Z", u.faction ? "#f0dfca" : "#9d7cc5", ink, 2);
  }
  c.restore();
  if (dead > 0) {
    burst(c, p.x, p.y - 8, (t - u.death) / 0.8, 23, !!u.faction);
  }
}
export function projectileAt(from: Point, to: Point, p: number, arc: number) {
  return { x: mix(from.x, to.x, p), y: mix(from.y, to.y, p), z: 21 + Math.sin(Math.PI * p) * arc };
}
function projectile(c: C, from: Point, to: Point, p: number, arc: number, color: string) {
  if (p < 0 || p > 1) {
    return;
  }
  const now = projectileAt(from, to, p, arc);
  const prior = projectileAt(from, to, Math.max(0, p - 0.055), arc);
  const a = project(now, now.z);
  const b = project(prior, prior.z);
  const shadow = project(now);
  ellipse(c, shadow.x, shadow.y, 4, 2, "#231f2c55");
  line(c, [b.x, b.y, a.x, a.y], color, 2);
  ellipse(c, a.x, a.y, 3, 3, "#fff8dc");
}
function effects(c: C, t: number) {
  for (const shot of SKIRMISHES) {
    const source = ENGINES[shot.source]!;
    const target = ENGINES[shot.target]!;
    if (source.death < shot.time - 0.7 || target.death < shot.time) {
      continue;
    } const end = enginePosition(target, shot.time);
    projectile(c, enginePosition(source, shot.time - 0.7), end, (t - shot.time + 0.7) / 0.7, 16, source.faction ? "#ffe0ac" : "#d3b5ff");
    const p = project(end);
    burst(c, p.x, p.y - 14, (t - shot.time) / 0.45, 12);
  }
  for (const target of ENGINES) {
    if (target.death > DURATION) {
      continue;
    }
    const impact = target.death;
    const end = enginePosition(target, impact);
    const source = ENGINES[(target.faction ? [15, 18, 21, 23] : [71, 74, 77, 80])[target.id % 4]!]!;
    if (impact < 13 || impact > 25) {
      projectile(c, enginePosition(source, impact - 1.45), end, (t - impact + 1.45) / 1.45, impact < 13 ? 100 : 64, target.faction ? gold : "#f6d8bb");
    }
    if (t > impact - 0.8 && t < impact) {
      const p = project(end);
      c.save();
      c.globalAlpha = 0.4;
      c.strokeStyle = gold;
      c.lineWidth = 1;
      c.beginPath();
      c.ellipse(p.x, p.y, 20, 9, 0, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }
  }
  // Regent's rail sweep is a world-space strike through the north court, never a camera close-up.
  if (t > 19.1 && t < 21.3) {
    const regent = ENGINES[13]!;
    const a = project(enginePosition(regent, t), 32);
    const progress = ease((t - 19.1) / 0.8);
    const victim = ENGINES[49 + Math.min(6, Math.floor(progress * 7))]!;
    const b = project(enginePosition(victim, Math.min(t, victim.death)), 16);
    c.save();
    c.globalAlpha = 1 - ease((t - 20.2) / 1.1);
    line(c, [a.x, a.y, b.x, b.y], "#caa5ed55", 16);
    line(c, [a.x, a.y, b.x, b.y], "#fff0b2", 2);
    c.restore();
  }
}
export function renderOrder(t: number) {
  return [...ENGINES.map((u) => ({ type: "unit" as const, id: u.id, depth: enginePosition(u, t).y })), ...OBSTACLES.map((o, id) => ({ type: "prop" as const, id, depth: o.y + o.d }))].sort((a, b) => a.depth - b.depth || a.id - b.id);
}
export function paintBattle(c: C, time: number, width = WIDTH, height = HEIGHT) {
  const t = Math.max(0, Math.min(DURATION, time));
  c.save();
  c.scale(width / WIDTH, height / HEIGHT);
  terrain(c, t);
  for (const item of renderOrder(t)) {
    if (item.type === "prop") {
      structure(c, OBSTACLES[item.id]!);
    } else {
      unit(c, ENGINES[item.id]!, t);
    }
  }
  effects(c, t);
  c.fillStyle = "#181522ed";
  c.fillRect(31, 20, 480, 52);
  c.fillRect(1100, 20, 464, 52);
  text(c, "VELVET SIEGE", 49, 43, 16, "#f0e2d1", 2.5);
  text(c, "THE DIVIDED GARDEN", 49, 61, 10, "#cbbbcf", 1.2);
  const s = statusAt(t);
  text(c, `VESPER ${s.violet}     /     IVORY ${s.ivory}`, 1121, 43, 14, "#eadfb5", 2);
  text(c, "THE VESPER COURT / IVORY DOMINION", 1121, 61, 9, "#baa7c4", 0.8);
  c.fillStyle = "#191621dd";
  c.fillRect(31, 849, 1533, 31);
  text(c, s.chapter?.toUpperCase() ?? "", 48, 870, 11, "#e2cddd", 2);
  text(c, `${t.toFixed(1).padStart(4, "0")} / 42.0`, 1430, 870, 11, "#eadbbb", 1);
  c.restore();
}
/** Inspection plate; the same original paths used by the running game. */
export function paintLineup(c: C) {
  c.fillStyle = "#171225";
  c.fillRect(0, 0, WIDTH, HEIGHT);
  text(c, "VELVET SIEGE / ORIGINAL SHAPE LANGUAGE", 70, 66, 16, gold, 3);
  text(c, "Vesper Court", 70, 127, 35, "#d5b8f5");
  text(c, "Ivory Dominion", 70, 510, 35, "#eee2cb");
  const names = ["SCYTHE WALKER", "MANTLE MORTAR", "CROWN HARRIER", "REGENT / RAIL LANCE"];
  const others = ["SWAN STRIDER", "HALO ARTILLERY", "MOURNING RAY", "CATHEDRAL MATRIARCH"];
  for (let i = 0; i < 4; i++) {
    const x = 235 + i * 365;
    c.save();
    c.translate(x, 299);
    c.scale(i === 3 ? 0.95 : 1.8, i === 3 ? 0.95 : 1.8);
    if (i === 0) {
      walker(c, false, 0, 0);
    } else if (i === 1) {
      manta(c, false, 0);
    } else if (i === 2) {
      crown(c, false, 0);
    } else {
      hero(c, false, -0.3, 0);
    } c.restore();
    text(c, names[i] ?? "", x - 111, 425, 12, "#cfb4df", 1.6);
    c.save();
    c.translate(x, 684);
    c.scale(i === 3 ? 1.1 : 1.8, i === 3 ? 1.1 : 1.8);
    if (i < 3) {
      ivory(c, i, 0, 0);
    } else {
      ivoryHero(c, 0, 0);
    } c.restore();
    text(c, others[i] ?? "", x - 111, 798, 12, "#e1cdbd", 1.6);
  }
}
