import { poseAt, project, roster, type Point, type Pose, type Role, type View } from "./motion.ts";

const C = {
  paper: "#e8e0cb", light: "#f5eedc", ink: "#252d2d", muted: "#777b70",
  teal: "#467a77", tealDark: "#315853", red: "#c44d35", redDark: "#833f32",
  skin: "#c59978", bone: "#beb6a0", shadow: "#a9ad9b", pale: "#d5d2ba",
};
type Context = CanvasRenderingContext2D;
const poly = (c: Context, pts: readonly Point[], fill: string, stroke?: string, width = 1.6) => {
  c.beginPath();
  pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = width;
    c.lineJoin = "miter";
    c.stroke();
  }
};
const line = (c: Context, pts: readonly Point[], color = C.ink, width = 1) => {
  c.beginPath();
  pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
  c.strokeStyle = color;
  c.lineWidth = width;
  c.lineCap = "butt";
  c.stroke();
};
const label = (c: Context, s: string, x: number, y: number, size = 12, color = C.ink) => {
  c.font = `600 ${size}px ui-monospace, monospace`;
  c.fillStyle = color;
  c.fillText(s, x, y);
};
const ellipse = (c: Context, x: number, y: number, rx: number, ry: number, color: string) => {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fillStyle = color;
  c.fill();
};

/** Tapered limbs are built from actual joint endpoints, not rotating rectangles. */
function limb(c: Context, a: Point, b: Point, widthA: number, widthB: number, fill: string) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  poly(c, [[a[0] + nx * widthA, a[1] + ny * widthA], [b[0] + nx * widthB, b[1] + ny * widthB],
    [b[0] - nx * widthB, b[1] - ny * widthB], [a[0] - nx * widthA, a[1] - ny * widthA]], fill, C.ink);
}

function hatch(c: Context, pts: readonly Point[], color: string, step = 5) {
  c.save();
  c.beginPath();
  pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
  c.closePath();
  c.clip();
  for (let n = -250; n < 250; n += step) {
    line(c, [[n, -190], [n + 180, 40]], color, 0.6);
  }
  c.restore();
}

function face(c: Context, role: Role, p: Pose) {
  const x = p.lean * 0.4;
  const y = -137 + p.crouch;
  c.save();
  c.translate(x, y);
  c.rotate(p.lean * 0.007);
  if (role === "veteran") {
    poly(c, [[-13, -16], [5, -22], [17, -13], [20, 2], [10, 13], [-7, 9]], C.skin, C.ink, 2);
    poly(c, [[-14, -10], [-10, -23], [6, -28], [16, -17], [7, -16], [2, -8]], C.ink);
    poly(c, [[-9, 0], [4, 5], [18, 1], [12, 15], [0, 16], [-6, 10]], C.ink);
    poly(c, [[-3, -10], [18, -12], [19, -6], [-4, -4]], C.red, C.ink, 1);
    line(c, [[9, -10], [15, -10]], C.light, 1.5);
    line(c, [[-9, -2], [-2, 2]], C.bone, 1);
  } else if (role === "medic") {
    poly(c, [[-11, -17], [8, -21], [16, -11], [18, 2], [8, 12], [-5, 9], [-12, 0]], C.skin, C.ink, 1.5);
    poly(c, [[-16, -10], [-10, -25], [6, -29], [15, -22], [18, -14], [2, -15], [-3, -6], [-8, -9], [-12, 4]], C.ink);
    poly(c, [[0, -4], [19, -5], [15, 8], [4, 9], [-2, 4]], C.light, C.ink, 1);
    line(c, [[1, -9], [7, -10]], C.ink, 2);
    line(c, [[11, -10], [16, -9]], C.ink, 1.7);
    line(c, [[5, 0], [13, -1]], C.teal, 1);
    poly(c, [[-15, -15], [-7, -17], [-6, -3], [-14, -1]], C.teal, C.ink, 1);
  } else {
    poly(c, [[-12, -18], [6, -24], [14, -13], [16, 0], [6, 13], [-7, 8], [-13, -1]], C.skin, C.ink, 1.5);
    poly(c, [[-17, -15], [-9, -30], [6, -31], [18, -19], [18, -7], [9, -15], [2, -9], [-4, -17], [-9, 0], [-17, 10]], C.light, C.ink, 2);
    line(c, [[-1, -6], [6, -5]], C.ink, 1.6);
    line(c, [[10, -6], [14, -7]], C.ink, 1.6);
    line(c, [[5, 4], [10, 3]], C.red, 1);
    poly(c, [[-20, -19], [-13, -24], [-11, -3], [-18, 0]], C.teal, C.ink);
  }
  c.restore();
}

function drawFigure(c: Context, role: Role, p: Pose, faction = false, elite = true) {
  c.save();
  c.scale(role === "veteran" ? 1.16 : role === "esper" ? 0.9 : 1, role === "veteran" ? 0.96 : role === "esper" ? 1.03 : 1);
  const accent = faction ? C.red : C.teal;
  const main = role === "medic" ? C.light : role === "veteran" ? accent : C.ink;
  if (role === "medic" && elite) {
    poly(c, [[p.lean - 39, -124 + p.crouch], [p.lean - 19, -121 + p.crouch], [p.lean - 21, -75 + p.crouch], [p.lean - 42, -78 + p.crouch]], accent, C.ink, 2);
    poly(c, [[p.lean - 42, -109 + p.crouch], [p.lean - 33, -108 + p.crouch], [p.lean - 34, -86 + p.crouch], [p.lean - 43, -88 + p.crouch]], C.light, C.ink, 1);
    line(c, [[p.lean - 37, -119 + p.crouch], [p.lean - 23, -117 + p.crouch]], C.light, 3);
  }
  if (p.impact > 0.5) {
    poly(c, [[-18, -121], [p.lean + 56, -104 + p.crouch], [p.lean + 22, -88 + p.crouch], [-34, -109]], `${C.red}24`);
    line(c, [[-43, -127], [-12, -122]], C.red, 1.3);
    line(c, [[-46, -120], [-20, -114]], accent, 1);
  }
  if (role === "veteran") {
    // Broad shield-like shoulder and elevated ammunition pack break his contour.
    poly(c, [[p.lean - 29, -132 + p.crouch], [p.lean - 11, -129 + p.crouch], [p.lean - 16, -84 + p.crouch], [p.lean - 34, -83 + p.crouch], [p.lean - 39, -115 + p.crouch]], C.ink, C.ink, 2);
    poly(c, [[p.lean - 36, -121 + p.crouch], [p.lean - 18, -119 + p.crouch], [p.lean - 21, -91 + p.crouch], [p.lean - 35, -91 + p.crouch]], accent, C.bone, 1);
    line(c, [[p.lean - 33, -116 + p.crouch], [p.lean - 26, -114 + p.crouch]], C.light, 2);
  }
  const hip: Point = [p.lean * 0.3, -61 + p.crouch];
  const backKnee: Point = [-16 - p.stride * 12, -29 + p.crouch * 0.4];
  const backFoot: Point = [-20 - p.stride * 23, -2 - Math.max(0, -p.stride) * 11];
  const frontKnee: Point = [14 + p.stride * 11, -29 + p.crouch * 0.4];
  const frontFoot: Point = [20 + p.stride * 22, 1 - Math.max(0, p.stride) * 11];
  // Trailing coat separates from the legs and preserves the negative space.
  const tail: Point[] = [[-23 + p.lean, -98 + p.crouch], [-29, -51], [-38 - p.cloth, role === "veteran" ? -49 : -18], [-12 - p.cloth * 0.5, role === "veteran" ? -51 : -32], [6, -73]];
  poly(c, tail, role === "esper" ? accent : C.bone, C.ink, 2);
  hatch(c, tail, role === "esper" ? C.light : C.muted, 6);
  limb(c, [hip[0] - 8, hip[1]], backKnee, 8, 6, C.ink);
  limb(c, backKnee, backFoot, 6, 4.5, C.ink);
  poly(c, [[backFoot[0] - 6, backFoot[1] - 5], [backFoot[0] + 5, backFoot[1] - 4], [backFoot[0] + 13, backFoot[1] + 2], [backFoot[0] + 12, backFoot[1] + 6], [backFoot[0] - 7, backFoot[1] + 6]], C.ink);
  limb(c, [hip[0] + 8, hip[1]], frontKnee, 9, 7, role === "medic" ? C.tealDark : C.ink);
  limb(c, frontKnee, frontFoot, 7, 5, role === "esper" ? C.bone : C.tealDark);
  poly(c, [[frontFoot[0] - 7, frontFoot[1] - 9], [frontFoot[0] + 4, frontFoot[1] - 8], [frontFoot[0] + 6, frontFoot[1]], [frontFoot[0] + 16, frontFoot[1] + 3], [frontFoot[0] + 14, frontFoot[1] + 8], [frontFoot[0] - 7, frontFoot[1] + 7]], C.ink, C.ink);
  line(c, [[frontFoot[0] - 4, frontFoot[1] + 4], [frontFoot[0] + 10, frontFoot[1] + 4]], C.bone, 1);
  const s: Point = [p.lean - 18, -111 + p.crouch];
  const elbow: Point = [p.lean - 29 - p.reach * 0.15, -80 + p.crouch];
  const wrist: Point = [p.lean - 9 + p.reach * 0.25, -70 + p.crouch];
  limb(c, s, elbow, 8, 6, role === "medic" ? C.bone : C.tealDark);
  limb(c, elbow, wrist, 6, 5, C.ink);
  poly(c, [[p.lean - 16, -123 + p.crouch], [p.lean + 13, -121 + p.crouch], [p.lean + 25, -101 + p.crouch], [hip[0] + 15, -60 + p.crouch], [hip[0] - 15, -57 + p.crouch], [p.lean - 22, -96 + p.crouch]], main, C.ink, 2.2);
  poly(c, [[p.lean - 16, -120 + p.crouch], [p.lean - 2, -111 + p.crouch], [hip[0] - 2, -63 + p.crouch], [hip[0] - 15, -57 + p.crouch], [p.lean - 21, -97 + p.crouch]], role === "medic" ? accent : faction ? C.redDark : C.tealDark);
  if (role === "medic") {
    poly(c, [[p.lean + 5, -120 + p.crouch], [p.lean + 19, -112 + p.crouch], [hip[0] + 23, -43 + p.crouch], [hip[0] + 9, -50 + p.crouch], [hip[0] - 1, -97 + p.crouch]], C.light, C.ink);
    poly(c, [[p.lean - 2, -117 + p.crouch], [p.lean + 5, -119 + p.crouch], [hip[0] + 8, -67 + p.crouch], [hip[0] + 1, -66 + p.crouch]], accent);
    line(c, [[p.lean - 11, -104 + p.crouch], [p.lean - 6, -105 + p.crouch]], C.red, 3);
    poly(c, [[-24, -64 + p.crouch], [-9, -66 + p.crouch], [-7, -43 + p.crouch], [-25, -40 + p.crouch]], accent, C.ink);
    line(c, [[-20, -53 + p.crouch], [-12, -54 + p.crouch]], C.light, 2);
  } else if (role === "veteran") {
    poly(c, [[p.lean - 21, -118 + p.crouch], [p.lean + 1, -118 + p.crouch], [p.lean + 15, -107 + p.crouch], [p.lean + 7, -89 + p.crouch], [p.lean - 17, -88 + p.crouch], [p.lean - 24, -101 + p.crouch]], C.bone, C.ink, 2);
    hatch(c, [[p.lean - 22, -113 + p.crouch], [p.lean - 8, -110 + p.crouch], [p.lean - 12, -91 + p.crouch], [p.lean - 21, -96 + p.crouch]], C.ink, 4);
    line(c, [[p.lean - 4, -107 + p.crouch], [p.lean + 5, -105 + p.crouch]], C.red, 4);
    for (let i = 0; i < 3; i++) {
      poly(c, [[p.lean - 13 + i * 8, -83 + p.crouch], [p.lean - 7 + i * 8, -84 + p.crouch], [p.lean - 8 + i * 8, -72 + p.crouch], [p.lean - 14 + i * 8, -71 + p.crouch]], C.light, C.ink, 1);
    }
  } else {
    poly(c, [[p.lean - 19, -121 + p.crouch], [p.lean + 12, -125 + p.crouch], [p.lean + 26, -111 + p.crouch], [p.lean - 2, -92 + p.crouch], [p.lean - 25, -108 + p.crouch]], C.light, C.ink, 2);
    poly(c, [[p.lean - 13, -118 + p.crouch], [p.lean + 4, -114 + p.crouch], [p.lean - 3, -99 + p.crouch]], accent);
    line(c, [[p.lean + 5, -107 + p.crouch], [hip[0] + 6, -70 + p.crouch]], C.bone, 2);
  }
  face(c, role, p);
  const fs: Point = [p.lean + 17, -108 + p.crouch];
  const fe: Point = [p.lean + 30 + p.reach * 0.2, -83 + p.crouch - p.charge * 8];
  const fw: Point = [p.lean + 43 + p.reach, -103 + p.crouch - p.charge * 17];
  limb(c, fs, fe, role === "veteran" ? 12 : 8, 6, role === "medic" && !elite ? accent : main);
  limb(c, fe, fw, 7, 3.2, role === "medic" ? C.light : accent);
  poly(c, [[fe[0] - 5, fe[1] - 5], [fe[0] + 5, fe[1] - 2], [fe[0] + 2, fe[1] + 6], [fe[0] - 5, fe[1] + 5]], faction ? C.redDark : C.tealDark, C.ink, 1);
  poly(c, [[fw[0] - 5, fw[1] + 2], [fw[0] - 4, fw[1] - 6], [fw[0] + 3, fw[1] - 10], [fw[0] + 9, fw[1] - 8], [fw[0] + 11, fw[1] - 3], [fw[0] + 4, fw[1] + 3]], role === "esper" ? C.skin : C.bone, C.ink, 1);
  poly(c, [[fw[0] - 3, fw[1] - 6], [fw[0] + 4, fw[1] - 8], [fw[0] + 7, fw[1] - 4], [fw[0] + 1, fw[1] - 1]], role === "esper" ? C.skin : C.light, C.ink, 0.8);
  if (role !== "esper") {
    const gun = role === "veteran" ? 34 : 17;
    poly(c, [[fw[0] - 6, fw[1] - 14], [fw[0] + gun, fw[1] - 16], [fw[0] + gun + 4, fw[1] - 8], [fw[0] + 8, fw[1] - 5], [fw[0] + 5, fw[1] + 4], [fw[0] - 2, fw[1] + 3], [fw[0], fw[1] - 5]], C.ink, C.ink, 1);
    line(c, [[fw[0] + 4, fw[1] - 12], [fw[0] + gun - 2, fw[1] - 13]], C.bone, 2);
    if (p.impact > 0) {
      poly(c, [[fw[0] + gun, fw[1] - 12], [fw[0] + gun + 21, fw[1] - 30], [fw[0] + gun + 15, fw[1] - 17], [fw[0] + gun + 45, fw[1] - 14], [fw[0] + gun + 20, fw[1] - 9], [fw[0] + gun + 28, fw[1] + 5]], C.red);
      line(c, [[fw[0] + gun + 30, fw[1] - 12], [fw[0] + gun + 63 * p.impact, fw[1] - 12]], C.red, 1.5);
    }
  } else {
    c.save();
    c.translate(fw[0] + 13, fw[1] - 8);
    c.rotate(p.charge * 1.2);
    c.strokeStyle = accent;
    c.lineWidth = 2;
    c.beginPath();
    c.arc(0, 0, 12 + p.charge * 15, 0.25, Math.PI * 1.75);
    c.stroke();
    poly(c, [[-5, 0], [0, -8], [5, 0], [0, 8]], C.red);
    c.restore();
    if (p.impact > 0) {
      for (let i = 0; i < 5; i++) {
        const x = fw[0] - 5 + i * 3;
        const y = fw[1] - 18 - i * 15;
        const r = (30 - i * 4) * p.impact;
        line(c, [[x - r, y - 4], [x, y + 8], [x + r, y - 4]], i % 2 ? C.red : accent, 3 - i * 0.4);
      }
    }
  }
  // Broken cloth end: lagged from the body, intentionally asymmetric.
  if (role === "esper") {
    poly(c, [[p.lean - 16, -119 + p.crouch], [-40 - p.cloth, -107], [-58 - p.cloth, -115], [-53 - p.cloth, -103], [-70 - p.cloth, -98], [-31, -95]], accent, C.ink, 1.4);
  }
  c.restore();
}

function block(c: Context, x: number, y: number, w: number, d: number, h: number, color = C.pale) {
  const a = project(x, y);
  const b = project(x + w, y);
  const f = project(x + w, y + d);
  const e = project(x, y + d);
  const aa = project(x, y, h);
  const bb = project(x + w, y, h);
  const ff = project(x + w, y + d, h);
  const ee = project(x, y + d, h);
  poly(c, [a, b, f, e], C.shadow);
  poly(c, [bb, b, f, ff], C.shadow, C.ink, 1);
  poly(c, [ee, ff, f, e], color, C.ink, 1);
  poly(c, [aa, bb, ff, ee], C.light, C.ink, 1);
  line(c, [[ee[0] + 4, ee[1] + 5], [ff[0] - 4, ff[1] + 5]], C.muted, 1);
}

const barricades = [
  { x: 175, y: 190, w: 85, d: 28 },
  { x: 440, y: 150, w: 30, d: 100 },
  { x: 230, y: 420, w: 62, d: 28 },
  { x: 410, y: 400, w: 32, d: 95 },
];

function board(c: Context, includeBarricades = true) {
  const a = project(-50, -50);
  const b = project(680, -50);
  const d = project(-50, 680);
  const e = project(680, 680);
  poly(c, [a, b, e, d], C.pale, C.ink, 1.2);
  for (let i = 0; i <= 650; i += 50) {
    line(c, [project(i, -50), project(i, 680)], "#b6b9a6", 0.6);
    line(c, [project(-50, i), project(680, i)], "#b6b9a6", 0.6);
  }
  poly(c, [project(270, -50), project(400, -50), project(400, 680), project(270, 680)], C.bone);
  for (let n = 0; n < 650; n += 58) {
    line(c, [project(335, n), project(335, n + 26)], C.light, 3);
  }
  for (let n = 0; n < 7; n++) {
    line(c, [project(-35 + n * 13, 620), project(-35 + n * 13, 656)], C.ink, 5);
    line(c, [project(570 + n * 13, -20), project(570 + n * 13, 15)], C.red, 5);
  }
  block(c, 0, 15, 135, 90, 92);
  block(c, 18, 22, 98, 62, 105, C.bone);
  block(c, 540, 0, 125, 95, 112);
  block(c, 553, 8, 98, 76, 124, C.bone);
  block(c, 0, 485, 100, 148, 67);
  block(c, 545, 490, 105, 135, 50);
  // Factory doors, service panels and roof ribs give each mass a distinct use.
  poly(c, [project(26, 105), project(86, 105), project(86, 105, 64), project(26, 105, 64)], C.ink, C.ink);
  for (let h = 9; h < 63; h += 9) {
    line(c, [project(28, 105, h), project(84, 105, h)], C.muted, 1);
  }
  line(c, [project(55, 105, 3), project(55, 105, 62)], C.bone, 1.5);
  for (let y = 28; y < 95; y += 18) {
    poly(c, [project(135, y, 48), project(135, y + 9, 48), project(135, y + 9, 74), project(135, y, 74)], C.tealDark);
  }
  poly(c, [project(14, 510, 68), project(84, 510, 68), project(84, 595, 68), project(14, 595, 68)], C.tealDark, C.ink);
  for (let x = 20; x < 84; x += 11) {
    line(c, [project(x, 514, 69), project(x, 591, 69)], C.bone, 1.5);
  }
  for (let x = 561; x < 640; x += 18) {
    poly(c, [project(x, 510, 51), project(x + 8, 510, 51), project(x + 8, 600, 51), project(x, 600, 51)], C.ink);
  }
  line(c, [project(5, 633, 15), project(90, 633, 15), project(90, 633, 49)], C.ink, 2.5);
  for (let y = 20; y < 78; y += 8) {
    line(c, [project(665, y, 22), project(665, y, 56)], C.tealDark, 2);
  }
  if (includeBarricades) {
    for (const b of barricades) { block(c, b.x, b.y, b.w, b.d, 29); }
  }
  // Rooftop vents and power conduits supply material without photograph textures.
  for (let i = 0; i < 7; i++) {
    line(c, [project(22 + i * 12, 34, 106), project(22 + i * 12, 69, 106)], C.muted, 2);
    line(c, [project(563 + i * 12, 17, 125), project(563 + i * 12, 67, 125)], C.muted, 2);
  }
  line(c, [project(65, 95, 58), project(65, 137, 58), project(160, 137, 58)], C.ink, 3);
  const sign = project(590, 95, 70);
  c.save();
  c.translate(...sign);
  c.transform(0.8944, 0.4472, 0, 1, 0, 0);
  c.fillStyle = C.red;
  c.fillRect(-20, -15, 75, 28);
  label(c, "NO. 04", -15, 4, 15, C.light);
  c.restore();
}

function paper(c: Context, width: number, height: number) {
  c.fillStyle = C.paper;
  c.fillRect(0, 0, width, height);
  // Repeatable print grain: sparse low-contrast ink flecks, independent of time.
  let seed = 719;
  for (let i = 0; i < 11500; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const x = seed % width;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const y = seed % height;
    c.fillStyle = i % 3 ? "#252d2d09" : "#fff9e523";
    c.fillRect(x, y, 1, i % 4 ? 1 : 2);
  }
}

export function makeBackdrop(view: View): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 1400;
  canvas.height = 800;
  const c = canvas.getContext("2d");
  if (!c) {
    return canvas;
  }
  paper(c, 1400, 800);
  if (view === "crowd") {
    board(c, false);
  } else {
    c.globalAlpha = 0.28;
    c.save();
    c.translate(0, 145);
    board(c);
    c.restore();
    c.globalAlpha = 1;
    for (let i = 0; i < 3; i++) {
      const x = 150 + i * 425;
      c.save();
      c.beginPath();
      c.rect(x, 120, 380, 475);
      c.clip();
      c.fillStyle = i === 1 ? "#c44d350b" : "#467a770b";
      c.fillRect(x, 120, 380, 475);
      for (let j = 0; j < 70; j++) {
        line(c, [[x - 80 + j * 8, 120], [x + 80 + j * 8, 595]], "#252d2d12", 0.6);
      }
      c.restore();
      label(c, `0${i + 1}`, x + 7, 193, 65, "#252d2d18");
    }
  }
  line(c, [[40, 80], [1360, 80]], C.ink, 1);
  label(c, view === "hero" ? "PLATE A / PERSONNEL STUDIES" : "PLATE B / THE TRANSFER YARD", 42, 48, 13);
  label(c, "HAZARD PAY   •   SIGNAL / PRINT", 995, 48, 13);
  return canvas;
}

export function render(c: Context, backdrop: HTMLCanvasElement, view: View, ms: number) {
  c.clearRect(0, 0, 1400, 800);
  c.drawImage(backdrop, 0, 0);
  // Bodies deliberately update on twos; effects and UI retain a continuous clock.
  const stepped = Math.floor((ms + 0.001) / (1000 / 12)) * (1000 / 12);
  if (view === "hero") {
    roster.forEach((member, i) => {
      const x = 290 + i * 415 + (i === 2 ? 35 : 0);
      const y = 590;
      const captionX = 155 + i * 425;
      const p = poseAt(stepped, member.role);
      ellipse(c, x + 15, y + 12, 82, 19, "#252d2d19");
      c.save();
      c.translate(x, y - p.lift * 2.15);
      c.scale(2.15, 2.15);
      drawFigure(c, member.role, p);
      c.restore();
      label(c, member.title, captionX, 651, 12, C.tealDark);
      c.font = "900 39px sans-serif";
      c.fillStyle = C.ink;
      c.fillText(member.name, captionX - 2, 696);
      label(c, member.note, captionX, 724, 11, C.muted);
    });
  } else {
    const units = Array.from({ length: 40 }, (_, i) => {
      const side = i >= 20;
      const n = i % 20;
      const row = Math.floor(n / 4);
      const col = n % 4;
      const offset = i * 271;
      const t = (ms + offset) % 6400;
      const movement = t > 3500 ? Math.sin((t - 3500) / 2900 * Math.PI) * 18 : 0;
      const anchorX = side ? [448, 460, 452, 452, 445][row]! : [145, 135, 125, 145, 140][row]!;
      const anchorY = side ? [160, 285, 390, 515, 630][row]! : [135, 300, 385, 510, 615][row]!;
      const scatter = [5, -9, 8, -3][col]!;
      return { x: anchorX + col * (side ? 24 : 28) + scatter + movement * (side ? -1 : 1), y: anchorY - col * 22 + scatter, i, side, offset };
    }).sort((a, b) => a.x + a.y - b.x - b.y);
    const paintOrder = [
      ...units.map((unit) => ({ depth: unit.x + unit.y, unit, cover: null })),
      ...barricades.map((cover) => ({ depth: cover.x + cover.y + cover.w + cover.d, unit: null, cover })),
    ].sort((a, b) => a.depth - b.depth);
    for (const entry of paintOrder) {
      if (entry.cover) {
        const b = entry.cover;
        block(c, b.x, b.y, b.w, b.d, 29);
        continue;
      }
      const unit = entry.unit;
      if (!unit) { continue; }
      const role: Role = unit.i % 20 === 0 ? "medic" : unit.i % 10 === 0 ? "esper" : unit.i % 5 === 0 ? "veteran" : "medic";
      const p = poseAt(stepped + unit.offset, role);
      const [x, y] = project(unit.x, unit.y);
      ellipse(c, x + 3, y + 3, 13, 5, "#252d2d26");
      c.save();
      c.translate(x, y - p.lift * 0.37);
      c.scale(unit.side ? -0.37 : 0.37, 0.37);
      drawFigure(c, role, p, unit.side, unit.i % 5 === 0);
      c.restore();
    }
    label(c, "20 FIELD PERSONNEL", 42, 733, 12, C.tealDark);
    label(c, "20 OPPOSITION", 1177, 733, 12, C.redDark);
    label(c, "ORTHOGRAPHIC 2:1  /  ACTUAL COMBAT SCALE  /  DETERMINISTIC CHOREOGRAPHY", 380, 770, 11, C.muted);
  }
  const phase = poseAt(ms, "medic").phase;
  label(c, `${phase}  /  ${(ms / 1000).toFixed(2)}s`, 42, 770, 11, C.muted);
}
