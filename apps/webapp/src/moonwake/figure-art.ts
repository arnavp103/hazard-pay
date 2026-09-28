/** Original, resolution-independent Moonwake character illustrations.
 * The six drawings in each pose table are anatomical keyframes: planted feet,
 * knees, pelvis, rib cage, elbows and hands interpolate independently.
 */
type C = CanvasRenderingContext2D;
type Paint = string | CanvasGradient;
type Point = [number, number];
export interface FigurePose { pose?: number; time?: number; wind?: number }
const INK = "#091c29";
const GOLD = "#ad8651";
const TAU = Math.PI * 2;
function shape(c: C, d: string, fill: Paint, stroke: string = INK, w = 1.6) {
  const p = new Path2D(d);
  c.fillStyle = fill;
  c.fill(p);
  if (stroke && w) {
    c.strokeStyle = stroke;
    c.lineWidth = w;
    c.stroke(p);
  }
}
function line(c: C, d: string, color: string, w = 1) {
  const p = new Path2D(d);
  c.strokeStyle = color;
  c.lineWidth = w;
  c.stroke(p);
}
function oval(c: C, x: number, y: number, rx: number, ry: number, fill: Paint, stroke = "", w = 1) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, TAU);
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = w;
    c.stroke();
  }
}
function grad(c: C, x: number, y: number, xx: number, yy: number, a: string, b: string, d: string) {
  const g = c.createLinearGradient(x, y, xx, yy);
  g.addColorStop(0, a);
  g.addColorStop(0.45, b);
  g.addColorStop(1, d);
  return g;
}
function glow(c: C, x: number, y: number, r: number, color: string) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "#e8ab4400");
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
}
function sample(frames: number[][], p: number) {
  const u = Math.max(0, Math.min(frames.length - 1, p));
  const i = Math.floor(u);
  const a = frames[i]!;
  const b = frames[Math.min(i + 1, frames.length - 1)]!;
  const t = u - i;
  const s = t * t * (3 - 2 * t);
  return a.map((v, k) => v + (b[k]! - v) * s);
}
function limb(c: C, a: Point, b: Point, width: number, fill: Paint, edge = INK) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const ax = a[0] + nx * width;
  const ay = a[1] + ny * width;
  const bx = b[0] + nx * width * 0.66;
  const by = b[1] + ny * width * 0.66;
  shape(c, `M${ax} ${ay} Q${ax + dx * 0.7} ${ay + dy * 0.32} ${bx} ${by} Q${b[0] + dx * 0.12} ${b[1] + dy * 0.12} ${b[0] - nx * width * 0.66} ${b[1] - ny * width * 0.66} Q${a[0] - nx * width + dx * 0.28} ${a[1] - ny * width + dy * 0.5} ${a[0] - nx * width} ${a[1] - ny * width} Q${a[0] - dx * 0.2} ${a[1] - dy * 0.2} ${ax} ${ay}Z`, fill, edge, 1.8);
}
function at(c: C, x: number, y: number, rot: number, draw: () => void) {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  draw();
  c.restore();
}
function chain(c: C, a: Point, b: Point, sag: number, links: number, color = "#a69a64") {
  for (let i = 0; i <= links; i++) {
    const t = i / links;
    const x = a[0] + (b[0] - a[0]) * t;
    const y = a[1] + (b[1] - a[1]) * t + Math.sin(t * Math.PI) * sag;
    c.save();
    c.translate(x, y);
    c.rotate(i % 2 ? 0.5 : -0.3);
    oval(c, 0, 0, 2.1, 3.1, "#173b43", color, 0.85);
    c.restore();
  }
}
// hip, chest, head tilt, back knee/foot, front knee/foot, shoulder tilt,
// rear elbow/hand, forward elbow/hand, weapon angle, cape streaming.
const CAPTAIN = [
  [0, -48, 0, -96, -0.07, -12, -24, -20, 0, 15, -25, 24, 0, -0.07, -20, -75, 3, -70, 28, -76, 27, -84, -0.69, 0],
  [-8, -43, -14, -89, -0.16, -24, -23, -34, 0, 18, -20, 36, 0, -0.25, -42, -94, -31, -120, 3, -106, -14, -131, -2.03, 9],
  [4, -42, 21, -79, 0.17, -28, -22, -47, 0, 30, -26, 48, 0, 0.28, 0, -73, 29, -63, 45, -62, 63, -64, -0.15, 37],
  [-5, -65, -13, -105, -0.13, -30, -44, -39, -14, 24, -44, 41, -29, -0.35, -42, -103, -30, -140, 4, -126, -10, -152, -1.95, 43],
  [15, -44, 31, -88, 0.20, -20, -21, -43, 0, 43, -23, 60, 0, 0.30, 35, -70, 65, -76, 61, -93, 89, -103, 0.18, 31],
  [5, -46, 8, -94, 0.02, -12, -25, -24, 0, 26, -25, 40, 0, 0.02, -14, -72, 11, -61, 33, -74, 39, -61, 0.64, 15],
];
function boot(c: C, x: number, y: number, front: boolean) {
  at(c, x, y, front ? -0.03 : -0.10, () => {
    shape(c, "M-7 -15 Q-1 -18 5 -13 L7 -7 Q14 -5 16 -1 Q9 3 -8 1 L-10 -4Z", "#172c39", INK, 1.8);
    shape(c, "M-7 -14 Q-1 -16 5 -12 L5 -7 L-6 -5Z", "#c2ba9f", "#49616a", 0.8);
    line(c, "M-7 -2 Q4 0 13 -1", "#79918d", 1);
    line(c, "M-4 -9 L3 -10", GOLD, 1.4);
  });
}
function captainLeg(c: C, hip: Point, knee: Point, foot: Point, front: boolean) {
  limb(c, hip, knee, front ? 9.5 : 8, "#162e3c");
  limb(c, knee, [foot[0], foot[1] - 9], 6.5, grad(c, knee[0] - 5, knee[1], foot[0] + 7, foot[1], "#f3ead0", "#b9b99f", "#3e5b64"));
  oval(c, knee[0], knee[1], 7.5, 5.7, front ? "#dedac0" : "#8eaaa5", INK, 1.3);
  line(c, `M${knee[0] - 3} ${knee[1] + 5} Q${foot[0] - 4} ${foot[1] - 14} ${foot[0] - 2} ${foot[1] - 8}`, "#f9edd0", 1.5);
  boot(c, foot[0], foot[1], front);
}
function gauntlet(c: C, x: number, y: number, angle: number) {
  at(c, x, y, angle, () => {
    shape(c, "M-7 -5 Q0 -8 7 -3 L8 3 L3 7 L-5 4Z", "#ddd4b6", INK, 1.3);
    line(c, "M-4 -2 L4 1 M-4 1 L3 4", "#6d7a73", 0.8);
  });
}
function glaive(c: C) {
  shape(c, "M-48 -2 L79 -2 L84 0 L79 3 L-48 3 L-57 0Z", grad(c, -30, -3, 20, 4, "#d2ac67", "#715940", "#243c45"), INK, 1);
  line(c, "M-46 -1 L75 -1", "#e2c384", 0.9);
  for (let i = 0; i < 9; i++) {
    line(c, `M${-13 + i * 4} -2 L${-16 + i * 4} 3`, "#152d37", 1.1);
  }
  shape(c, "M61 -4 L70 -10 L74 -4 L80 -5 L84 0 L79 6 L71 5 L68 12 L62 5Z", GOLD, INK, 1.2);
  // Deep concave hook and long tapered outer edge are one forged crescent.
  shape(c, "M77 -4 C60 -28 69 -59 99 -71 C119 -80 136 -77 144 -72 C109 -70 96 -52 99 -33 C102 -17 117 -12 131 -13 C121 4 101 12 86 7 C82 5 78 0 77 -4Z", grad(c, 88, -70, 119, 7, "#fff5d6", "#c4d9d0", "#547b84"), INK, 2);
  shape(c, "M80 -8 C67 -31 78 -59 103 -68 C82 -49 83 -21 104 -10 C115 -5 124 -10 131 -13 C117 0 95 5 80 -8Z", "#769e9e", "", 0);
  line(c, "M78 -14 C72 -39 87 -64 112 -70", "#f9f2d6", 1.8);
  line(c, "M86 -12 C90 -3 100 1 112 -2", "#e1c48a", 1.3);
  shape(c, "M81 -19 L91 -24 L98 -13 L88 -9Z", GOLD, "#4a6467", 1);
  oval(c, 88, -17, 2, 2, "#172e3b");
  line(c, "M69 7 Q59 22 46 19 Q54 28 65 23", GOLD, 2);
}
export function drawCaptain(c: C, params: FigurePose = {}) {
  const v = sample(CAPTAIN, params.pose ?? 0);
  // Both grips remain exactly on the shaft through the interpolated sweep.
  v[16] = v[20]! - Math.cos(v[22]!) * 26;
  v[17] = v[21]! - Math.sin(v[22]!) * 26;
  const [hx, hy, tx, ty, head, kx, ky, fx, fy, k2x, k2y, f2x, f2y, tilt, ex, ey, handx, handy, e2x, e2y, h2x, h2y, weapon, stream] = v as [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number];
  c.save();
  c.lineJoin = "round";
  c.lineCap = "round";
  // The mantle has a broad cloth silhouette; its three overlapping folds lag
  // behind the body rather than rotating as a cardboard silhouette.
  const wind = stream + (params.wind ?? 0) + Math.sin((params.time ?? 0) * 2) * 2;
  shape(c, `M${tx - 13} ${ty - 9} C${tx - 51} ${ty - 2} ${hx - 46 - wind} ${hy - 16} ${hx - 74 - wind} ${hy - 30} C${hx - 67 - wind} ${hy + 2} ${hx - 61 - wind} ${hy + 14} ${hx - 88 - wind} ${hy + 31} C${hx - 51 - wind} ${hy + 39} ${hx - 36} ${hy + 13} ${hx - 17} ${hy + 8} L${tx + 3} ${ty + 1}Z`, grad(c, tx - 20, ty, tx - 45, hy + 30, "#d9d8c3", "#7f9d99", "#2b535f"), INK, 2.2);
  shape(c, `M${tx - 17} ${ty - 6} C${tx - 52} ${ty + 13} ${hx - 40 - wind} ${hy + 8} ${hx - 74 - wind} ${hy + 25} C${hx - 42 - wind} ${hy + 21} ${hx - 28} ${hy - 12} ${tx - 10} ${ty + 10}Z`, "#e0ddc7", "", 0);
  shape(c, `M${tx - 13} ${ty + 4} C${hx - 41} ${hy - 9} ${hx - 38 - wind} ${hy + 28} ${hx - 56 - wind} ${hy + 30} Q${hx - 23} ${hy + 18} ${hx - 13} ${hy - 4}Z`, "#345866", "", 0);
  line(c, `M${tx - 25} ${ty + 1} C${tx - 58} ${ty + 30} ${hx - 37 - wind} ${hy + 30} ${hx - 79 - wind} ${hy + 29}`, "#dfc789", 1.8);
  captainLeg(c, [hx - 9, hy], [kx, ky], [fx, fy], false);
  captainLeg(c, [hx + 8, hy], [k2x, k2y], [f2x, f2y], true);
  // Rib cage is drawn in its own local coordinates while the pelvis remains
  // anchored between planted legs. The waist is a flexible, visible join.
  limb(c, [hx, hy - 4], [tx, ty + 20], 14, "#203744");
  for (let i = 0; i < 3; i++) {
    line(c, `M${hx - 13} ${hy - 12 - i * 5} Q${hx} ${hy - 8 - i * 5} ${hx + 13} ${hy - 15 - i * 5}`, "#637e80", 1.4);
  }
  at(c, hx, hy - 8, tilt * 0.4, () => {
    shape(c, "M-18 -1 Q-1 3 19 -3 L24 18 L12 26 L3 18 L-5 26 L-22 18Z", grad(c, -19, 0, 20, 23, "#f1e5c6", "#c5c4aa", "#496574"), INK, 1.8);
    shape(c, "M-6 3 L2 4 L8 29 L-3 34 L-12 25Z", "#264957", GOLD, 1);
    line(c, "M-16 7 L-20 15 M16 6 L20 16", "#fff0c9", 1.3);
    shape(c, "M-19 -5 Q0 0 19 -6 L20 0 Q0 7 -19 1Z", "#8e6b46", INK, 1);
    shape(c, "M-3 -3 L4 -4 L5 3 L-2 4Z", "#dbbb73", INK, 0.8);
  });
  limb(c, [tx - 15, ty + 4], [ex, ey], 7, "#587681");
  limb(c, [ex, ey], [handx, handy], 6, "#c4cbb9");
  at(c, tx, ty, tilt, () => {
    shape(c, "M-18 -7 Q-8 -16 10 -11 Q23 -7 23 10 L15 34 Q-2 39 -17 28 L-22 7Z", grad(c, -22, -8, 23, 32, "#fff0cd", "#c9c9af", "#58747b"), INK, 2);
    shape(c, "M-15 -4 Q-5 -9 1 -6 L5 15 Q12 16 19 11 L14 29 L2 32 L-6 22 L-16 21Z", "#254856", GOLD, 1.2);
    shape(c, "M-1 -9 L7 -9 L10 11 L5 15Z", "#e8dfc0", "", 0);
    line(c, "M-17 3 Q-8 -1 -3 2 M11 -4 Q19 -2 20 7", "#fff4d5", 1.4);
    shape(c, "M-5 6 L2 4 L4 11 L0 16 L-4 12Z", GOLD, INK, 0.8);
    line(c, "M-11 22 L0 27 L12 27", "#a98c57", 1.2);
    // Engraved pauldrons are curved shells with rolled gold rims.
    shape(c, "M-17 -10 C-31 -14 -34 -3 -29 9 L-13 14 L-9 4 L-10 -5Z", grad(c, -32, -11, -11, 14, "#ede3c5", "#b3c3b6", "#41616d"), INK, 1.8);
    shape(c, "M10 -9 Q24 -16 30 -3 L30 7 L18 13 L10 5Z", grad(c, 15, -9, 30, 12, "#fff0cf", "#c4c5a9", "#516b71"), INK, 1.7);
    line(c, "M-29 7 Q-22 12 -14 11 M19 10 Q25 8 29 5", GOLD, 2);
    line(c, "M-28 -3 Q-23 -7 -17 -3 M18 -4 Q23 -7 27 -1", "#fbefd0", 1);
    oval(c, -21, 3, 2, 2, GOLD);
    oval(c, 23, 3, 2, 2, GOLD);
    // Tall neck guard and flesh separate the armor from the face.
    shape(c, "M-8 -12 L-7 -23 L8 -25 L12 -13 L4 -7Z", "#ab8870", INK, 1.3);
    shape(c, "M-15 -12 L-12 -24 L-6 -17 L4 -11 L13 -19 L17 -11 Q1 -4 -15 -12Z", "#d7d5b9", INK, 1.2);
    at(c, 0, -27, head, () => {
      shape(c, "M-10 -14 Q-6 -27 7 -25 Q20 -20 17 -7 L21 -2 L16 1 L14 8 L5 13 L-7 5 L-11 -4Z", grad(c, -9, -21, 18, 10, "#edcc9f", "#c59c78", "#785e56"), INK, 1.4);
      shape(c, "M-12 -8 Q-20 -17 -13 -27 Q-6 -36 9 -32 Q21 -29 20 -16 Q9 -23 2 -16 Q-2 -9 -8 -5 L-10 5 L-16 -1Z", "#e5e7d2", INK, 1.5);
      shape(c, "M-13 -22 Q-29 -33 -47 -25 C-32 -23 -30 -13 -45 -6 Q-29 -1 -17 -10 L-10 -20Z", "#d4dec9", INK, 1.3);
      line(c, "M-39 -24 Q-23 -22 -20 -16 M-33 -9 Q-21 -9 -15 -18", "#8ba89f", 1.1);
      shape(c, "M-13 -25 L-8 -37 L-3 -29 L4 -39 L10 -29 L17 -33 L18 -22 Q3 -28 -13 -25Z", GOLD, INK, 1.2);
      line(c, "M-7 -26 Q3 -29 15 -25", "#efcc86", 1.1);
      shape(c, "M4 -9 L12 -10 L15 -7 L7 -6Z", "#2d3537", "", 0);
      oval(c, 11, -8, 1.2, 0.9, "#e8e5c4");
      line(c, "M16 0 L11 1 M8 6 Q12 7 15 4", "#72564d", 0.8);
      shape(c, "M-8 1 L-3 5 L3 9 L0 13 L-7 8Z", "#a4bbb1", "", 0);
    });
  });
  at(c, (handx + h2x) / 2, (handy + h2y) / 2, weapon, () => glaive(c));
  limb(c, [tx + 17, ty + 4], [e2x, e2y], 7.8, grad(c, tx, ty, e2x + 7, e2y, "#e7dfc2", "#b1bba9", "#3f6270"));
  limb(c, [e2x, e2y], [h2x, h2y], 6.7, grad(c, e2x - 5, e2y, h2x + 7, h2y, "#ecdfbd", "#bfc1a8", "#49656d"));
  oval(c, e2x, e2y, 6, 5, "#d7d5b9", INK, 1.1);
  line(c, `M${e2x - 3} ${e2y - 2} L${e2x + 3} ${e2y - 3}`, "#f5edce", 1);
  gauntlet(c, handx, handy, weapon);
  gauntlet(c, h2x, h2y, weapon);
  c.restore();
}

// pelvis, ribs, head pitch, left knee/foot, right knee/foot,
// left elbow/hand, right elbow/hand, rib tilt, bell swing.
const KEEPER = [
  [0, -116, 0, -243, -0.09, -41, -57, -58, 0, 43, -52, 57, 0, -111, -210, -135, -104, 97, -178, 100, -88, -0.07, 0],
  [-3, -123, -12, -250, 0.10, -44, -57, -58, 0, 43, -54, 57, 0, -116, -281, -56, -325, 103, -252, 47, -298, 0.04, -0.2],
  [-27, -98, -43, -215, 0.24, -53, -51, -68, 0, 39, -47, 58, 0, -116, -165, -159, -16, 38, -153, -54, -28, -0.29, 0.5],
  [-8, -118, -8, -241, 0.02, -43, -56, -61, 0, 39, -53, 57, 0, -115, -203, -139, -100, 88, -185, 106, -94, -0.09, 0.12],
  [19, -92, 37, -220, -0.30, -23, -46, -60, 0, 52, -43, 77, 0, -73, -180, -118, -112, 109, -236, 140, -184, 0.24, -0.5],
  [44, -35, -47, -85, 0.74, -11, -19, -73, 0, 87, -20, 122, 0, -97, -36, -143, -7, 34, -39, 4, -9, -1.0, 1.25],
];
function bell(c: C, x: number, y: number, size: number, swing: number, luminous = false) {
  at(c, x, y, swing, () => {
    c.scale(size, size);
    oval(c, 0, -22, 4, 5, "#3b625e", GOLD, 1.1);
    shape(c, "M-4 -20 C-14 -18 -12 -5 -18 4 L-23 10 Q0 19 23 10 L18 4 C12 -5 14 -18 4 -20Z", grad(c, -18, -18, 23, 13, "#dfc582", "#a78e51", "#355452"), INK, 2);
    shape(c, "M-10 -14 Q-6 -21 -2 -15 L-5 6 L-14 7Z", "#ead094", "", 0);
    line(c, "M-15 0 Q0 7 15 0 M-18 6 Q0 13 18 6", "#665d3c", 1.3);
    oval(c, 0, 11, 20, 5, "#102e37", "#b9a76a", 1.2);
    oval(c, 0, 13, 4, 6, luminous ? "#ffd58a" : "#bca46b", INK, 1);
    if (luminous) {
      glow(c, 0, 8, 36, "#e7a73d45");
      line(c, "M-14 -9 L-11 -2 M8 -11 L6 -3", "#f2d18e", 1.1);
    }
  });
}
function barnacles(c: C, x: number, y: number, size = 1) {
  for (let i = 0; i < 5; i++) {
    const a = i * 2.2;
    const xx = x + Math.cos(a) * 5 * size;
    const yy = y + Math.sin(a) * 4 * size;
    const r = (2 + i % 2) * size;
    oval(c, xx, yy, r, r * 0.8, "#9eac8f", "#325c61", 0.8);
    oval(c, xx - 0.2, yy + 0.3, r * 0.35, r * 0.4, "#254d53");
  }
}
function keeperLeg(c: C, hip: Point, knee: Point, foot: Point, front: boolean) {
  limb(c, hip, knee, 21, front ? "#2c555c" : "#183c4b");
  limb(c, knee, [foot[0], foot[1] - 13], 19, grad(c, knee[0] - 18, knee[1], foot[0] + 14, foot[1], "#8ba491", "#4d7a77", "#173e4c"));
  oval(c, knee[0], knee[1], 22, 15, "#607f73", INK, 2.5);
  line(c, `M${knee[0] - 14} ${knee[1] - 4} Q${knee[0]} ${knee[1] - 12} ${knee[0] + 16} ${knee[1] - 3}`, "#b8c0a1", 2);
  at(c, foot[0], foot[1] - 3, 0, () => {
    shape(c, "M-17 -19 Q-6 -23 13 -14 L28 -8 L36 -1 Q14 7 -22 1 L-25 -6Z", grad(c, -20, -20, 29, 3, "#8ca695", "#416b6c", "#163646"), INK, 2.5);
    shape(c, "M-18 -6 L-20 0 L-8 1 L-6 -8 M-2 -8 L0 2 L12 1 L10 -8 M15 -6 L20 1 L33 -1 L25 -8", "#7b9989", INK, 1.2);
    line(c, "M-16 -17 L-11 -9 M2 -17 L7 -10", "#bbbc99", 1.4);
  });
}
function keeperArm(c: C, shoulder: Point, elbow: Point, hand: Point, major: boolean) {
  limb(c, shoulder, elbow, major ? 26 : 18, grad(c, shoulder[0] - 20, shoulder[1], elbow[0] + 20, elbow[1], "#9bab91", "#527d76", "#173b4b"));
  oval(c, elbow[0], elbow[1], major ? 25 : 19, 19, "#284f5b", INK, 2.8);
  limb(c, elbow, hand, major ? 25 : 20, grad(c, elbow[0] - 20, elbow[1], hand[0] + 22, hand[1], "#a5b49a", "#527d76", "#153c4b"));
  const angle = Math.atan2(hand[1] - elbow[1], hand[0] - elbow[0]) - Math.PI / 2;
  at(c, (elbow[0] + hand[0]) * 0.5, (elbow[1] + hand[1]) * 0.5, angle, () => {
    shape(c, "M-23 -32 Q-6 -41 20 -32 L16 30 Q1 43 -21 30 L-25 2Z", grad(c, -24, -30, 20, 32, "#92a88f", "#557e76", "#244f59"), INK, 2);
    line(c, "M-18 -23 Q-1 -32 14 -23 M-17 -16 Q-2 -24 14 -16 M-18 23 Q-2 32 12 23", "#b5bc97", 1.6);
    shape(c, "M-5 -19 Q-16 -1 -5 13 Q8 3 4 -8 Q0 -2 -5 -1Z", "#234d55", "#779788", 1.2);
    line(c, "M8 -22 L3 -10 L10 0 L4 10 L9 18", "#193e49", 2);
    if (major) {
      barnacles(c, -16, -26, 1.2);
    }
  });
  at(c, hand[0], hand[1], angle, () => {
    shape(c, "M-21 -10 Q-2 -19 18 -9 L24 4 L18 14 L12 5 L10 23 L1 27 L-3 9 L-7 28 L-17 23 L-17 6 L-25 17 L-31 11Z", grad(c, -23, -12, 21, 24, "#b2bca0", "#74968b", "#315b65"), INK, 2.5);
    line(c, "M-17 -1 Q-6 -8 9 -4 M-10 -9 L-6 3 M3 -11 L7 1", "#d2c8a1", 1.4);
  });
}
export function drawBellKeeper(c: C, params: FigurePose = {}) {
  const v = sample(KEEPER, params.pose ?? 0);
  const [hx, hy, tx, ty, head, kx, ky, fx, fy, k2x, k2y, f2x, f2y, ex, ey, handx, handy, e2x, e2y, h2x, h2y, tilt, swing] = v as [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number];
  c.save();
  c.lineJoin = "round";
  c.lineCap = "round";
  const fall = Math.max(0, (params.pose ?? 0) - 4);
  const drift = Math.sin((params.time ?? 0) * 1.3) * 3;
  // Heavy drowned vestments are hung from the shoulder, not the waist.
  shape(c, `M${tx - 51} ${ty - 28} C${tx - 103} ${ty + 33} ${hx - 105} ${hy + 59} ${hx - 102 - fall * 45} ${hy + 111} L${hx - 76} ${hy + 91} L${hx - 79} ${hy + 122} Q${hx - 29} ${hy + 99} ${hx - 20} ${hy + 112} L${hx + 5} ${hy + 97} L${hx + 23} ${hy + 119} L${hx + 55} ${hy + 90} L${hx + 80} ${hy + 112} C${hx + 83} ${hy + 42} ${tx + 90} ${ty + 58} ${tx + 52} ${ty - 17}Z`, grad(c, tx - 70, ty, tx + 30, hy + 110, "#416f70", "#214c5b", "#102a3b"), INK, 3);
  shape(c, `M${tx - 44} ${ty - 15} C${tx - 67} ${ty + 38} ${hx - 49} ${hy + 62} ${hx - 89} ${hy + 105} Q${hx - 54} ${hy + 81} ${hx - 35} ${hy + 92} C${hx - 17} ${hy + 39} ${tx - 40} ${ty + 43} ${tx - 26} ${ty - 13}Z`, "#527974", "", 0);
  shape(c, `M${tx + 28} ${ty + 12} C${tx + 76} ${ty + 66} ${hx + 37} ${hy + 56} ${hx + 58} ${hy + 99} L${hx + 71} ${hy + 91} Q${hx + 43} ${hy + 15} ${tx + 49} ${ty + 1}Z`, "#366368", "", 0);
  line(c, `M${tx - 54} ${ty + 3} C${tx - 81} ${ty + 70} ${hx - 57} ${hy + 53} ${hx - 85} ${hy + 100}`, "#a2a280", 2.4);
  keeperLeg(c, [hx - 23, hy], [kx, ky], [fx, fy], false);
  keeperLeg(c, [hx + 27, hy], [k2x, k2y], [f2x, f2y], true);
  keeperArm(c, [tx + 48, ty + 8], [e2x, e2y], [h2x, h2y], false);
  limb(c, [hx, hy], [tx, ty + 54], 43, "#234b56");
  at(c, hx, hy - 10, tilt * 0.45, () => {
    shape(c, "M-48 -8 Q-10 -24 47 -11 L53 27 L32 45 L15 34 L2 48 L-18 34 L-39 47 L-55 22Z", grad(c, -50, -14, 54, 37, "#98a98e", "#507b73", "#214754"), INK, 3);
    for (let i = 0; i < 5; i++) {
      const x = -42 + i * 20;
      shape(c, `M${x} 1 Q${x + 7} -5 ${x + 16} 0 L${x + 12} 29 L${x + 4} 36 L${x - 2} 26Z`, i % 2 ? "#5a8074" : "#789589", INK, 1.4);
      line(c, `M${x + 3} 6 L${x + 6} 24`, "#b8b999", 1.2);
    }
    chain(c, [-46, -10], [45, -7], 17, 20);
    bell(c, -34, 28, 0.40, swing * 0.6, true);
    bell(c, 27, 35, 0.31, -swing, false);
  });
  at(c, tx, ty, tilt, () => {
    // Asymmetric battered cuirass surrounds a truly hollow bell chamber.
    shape(c, "M-62 -31 C-56 -61 -28 -65 -8 -56 Q24 -69 50 -41 C76 -15 61 48 40 75 Q7 94 -28 74 C-63 57 -73 8 -62 -31Z", grad(c, -62, -49, 58, 78, "#a5b298", "#537b77", "#163d4e"), INK, 3.8);
    shape(c, "M-30 -35 C-6 -52 24 -37 30 -14 Q48 26 23 59 Q-4 77 -31 50 C-44 30 -48 -11 -30 -35Z", "#0a2937", "#889d82", 3);
    shape(c, "M-30 -33 Q-13 -48 -2 -40 L-17 -12 L-27 20 L-35 12Z", "#41695f", "", 0);
    shape(c, "M23 -27 Q42 -13 39 19 L29 44 L20 57 L16 44 Q31 19 23 -27Z", "#b0b296", "", 0);
    shape(c, "M-52 -31 Q-61 -8 -49 15 L-37 31 L-43 -11 L-34 -32Z", "#bcc1a0", "", 0);
    shape(c, "M-47 23 L-25 55 L-22 74 L-38 67 L-56 44Z", "#7d9986", INK, 1.3);
    // Ragged verdigris ribs interrupt the polished chamber with worn relief.
    shape(c, "M-44 8 Q-27 3 -20 11 L-24 16 Q-33 11 -43 20Z", "#829c84", INK, 1.2);
    shape(c, "M-41 27 Q-30 19 -20 27 L-24 33 Q-34 29 -37 38Z", "#779880", INK, 1.2);
    shape(c, "M37 5 Q24 5 18 16 L23 20 L33 15Z", "#739283", INK, 1.2);
    shape(c, "M35 29 Q22 23 18 35 L22 40 L30 37Z", "#8fa68b", INK, 1.2);
    line(c, "M-47 -45 L-40 -28 L-48 -16 M42 -35 L29 -20 L36 -7 M-46 32 L-38 38 L-41 49", "#193f4b", 2.5);
    // Crown of overlapping carved ribs; uneven lengths prevent a logo shape.
    shape(c, "M-54 -46 Q-69 -77 -43 -86 Q-28 -87 -16 -61 L-9 -46 L-22 -25 L-34 -56 L-46 -66 L-45 -46Z", grad(c, -58, -82, -8, -23, "#b4baa0", "#7d9988", "#365e66"), INK, 2.5);
    shape(c, "M4 -52 Q17 -87 41 -79 L59 -53 L46 -31 L37 -53 L24 -60 L15 -33Z", grad(c, 12, -80, 51, -32, "#c0c2a0", "#749789", "#385f63"), INK, 2.5);
    line(c, "M-50 -75 Q-33 -76 -24 -49 M17 -53 Q27 -74 41 -63", "#e1d2a5", 1.5);
    line(c, "M-4 -35 L-4 -20", GOLD, 3);
    bell(c, -2, 11, 1.25, swing, true);
    glow(c, 0, 21, 67, "#dfab4938");
    // Left shoulder resembles a broken cathedral capital, right is bare bone.
    shape(c, "M-40 -52 C-73 -84 -108 -61 -107 -27 L-100 -3 Q-79 12 -55 0 L-37 -24Z", grad(c, -109, -63, -40, 4, "#c4c4a3", "#6e9586", "#274e5c"), INK, 3.4);
    shape(c, "M-100 -34 Q-82 -68 -55 -43 L-49 -28 Q-74 -48 -98 -17Z", "#9eb298", INK, 1.6);
    line(c, "M-102 -14 Q-75 2 -56 -10 M-99 -6 Q-77 10 -58 -3", "#bbb994", 2);
    line(c, "M-82 -61 L-79 -45 L-88 -32 L-78 -23 L-82 -9", "#234a52", 3);
    shape(c, "M-71 -33 Q-86 -24 -70 -14 Q-58 -22 -71 -33Z", "#385f5d", "#b8b991", 1.3);
    barnacles(c, -97, -42, 1.4);
    barnacles(c, -51, -14, 1);
    shape(c, "M-90 -57 Q-104 -80 -96 -95 L-90 -88 L-93 -76 L-85 -82 L-80 -72 L-83 -60 M-65 -66 L-68 -84 L-62 -92 L-60 -78 L-51 -80 L-55 -67", "#759a89", INK, 1.7);
    shape(c, "M-93 2 Q-107 27 -92 55 Q-98 37 -84 33 L-91 23 L-86 13Z", "#527b66", INK, 1.3);
    shape(c, "M-80 3 Q-88 20 -77 44 L-80 66 Q-66 54 -70 30 L-73 10Z", "#3a6c60", INK, 1.2);
    shape(c, "M44 -50 Q76 -58 88 -28 L79 -6 L62 -12 L48 -30Z", "#617f71", INK, 2.5);
    shape(c, "M62 -46 Q81 -40 80 -23 L70 -15 L60 -28Z", "#c2c0a0", INK, 1.4);
    chain(c, [-66, -26], [49, -31], 32, 26);
    bell(c, -55, 5, 0.35, -swing, true);
    bell(c, 44, -8, 0.45, swing * 0.6, false);
    at(c, -4, -79, head, () => {
      // The hood is a sea-worn funeral cowl around a recognizable long face.
      shape(c, "M-33 -21 Q-42 -60 -20 -81 Q0 -101 26 -77 Q47 -54 35 -21 L24 10 L-15 16 L-32 -6Z", grad(c, -35, -70, 31, 7, "#79928b", "#335b62", "#102d3e"), INK, 3);
      shape(c, "M-23 -31 Q-27 -61 -9 -67 Q12 -76 23 -57 L24 -29 L14 -5 L-1 6 L-15 -7Z", grad(c, -23, -58, 21, 2, "#d6cba5", "#9da68b", "#436765"), INK, 2.3);
      shape(c, "M-17 -47 Q-9 -51 -3 -41 L-8 -29 L-19 -33Z", "#0c303b", "", 0);
      shape(c, "M5 -41 Q12 -50 20 -44 L17 -31 L7 -28Z", "#0c303b", "", 0);
      line(c, "M-15 -39 L-8 -37 M9 -37 L16 -40", "#f2c770", 2);
      shape(c, "M-3 -40 L3 -44 L5 -22 L0 -19 L-6 -23Z", "#c0bea0", "#54776d", 1);
      shape(c, "M-12 -15 Q0 -9 11 -17 L6 -3 L-1 1 L-8 -4Z", "#1e4046", "", 0);
      for (let i = 0; i < 4; i++) {
        line(c, `M${-8 + i * 5} -13 L${-7 + i * 4} -7`, "#c5c1a0", 1.4);
      }
      line(c, "M-20 -57 Q-3 -64 12 -56 M-18 -25 L-11 -21 M12 -22 L19 -28", "#e2d5ae", 1.1);
      shape(c, "M-27 -40 C-55 -48 -64 -74 -49 -94 Q-54 -69 -27 -66 L-17 -79 L-7 -73 L-17 -55Z", grad(c, -54, -89, -18, -39, "#c2c1a0", "#769689", "#335b63"), INK, 2.5);
      shape(c, "M24 -45 Q50 -70 36 -100 Q66 -77 52 -49 L39 -29 L31 -28Z", grad(c, 36, -98, 51, -29, "#bac1a1", "#61877f", "#264f5c"), INK, 2.5);
      shape(c, "M-48 -87 L-57 -97 L-51 -101 L-42 -90 M48 -79 L61 -86 L63 -77 L52 -70", "#99ad93", INK, 1.2);
      line(c, "M-42 -62 L-35 -52 M48 -64 L41 -45", "#d9caa0", 1.4);
      barnacles(c, -29, -62, 0.8);
      chain(c, [-29, -21], [-37, 26], 4, 8);
      bell(c, -36, 35, 0.34, swing, false);
      shape(c, "M22 -23 Q34 1 29 25 L23 43 L20 27 L14 36 L16 12Z", "#3b655f", INK, 1.2);
    });
  });
  keeperArm(c, [tx - 69, ty - 11], [ex, ey], [handx, handy], true);
  chain(c, [ex - 8, ey + 15], [handx + 7, handy - 10], 14 + drift, 14);
  bell(c, handx + 11, handy + 22, 0.49, swing * 0.8, true);
  c.restore();
}
