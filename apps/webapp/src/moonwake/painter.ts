import { drawBellKeeper, drawCaptain } from "./figure-art.ts";
import { chapterAt, clamp, DURATION, ramp, soldierAt, soldiers, volleys } from "./timeline.ts";
import type { Soldier } from "./timeline.ts";
export const WIDTH = 1600;
export const HEIGHT = 900;
type C = CanvasRenderingContext2D;
type Paint = string | CanvasGradient;
const bone = "#e6d5a5";
const gold = "#b99655";
const contours = new Map<string, Path2D>();
function shade(c: C, light: string, mid: string, dark: string, x = -45, y = -150, xx = 45, yy = 10) {
  const g = c.createLinearGradient(x, y, xx, yy);
  g.addColorStop(0, light);
  g.addColorStop(0.38, mid);
  g.addColorStop(1, dark);
  return g;
}
function path(c: C, d: string, fill: Paint, stroke?: string, width = 1) {
  const shape = contours.get(d) ?? new Path2D(d);
  if (contours.size < 6000) {
    contours.set(d, shape);
  } c.fillStyle = fill;
  c.fill(shape);
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = width;
    c.stroke(shape);
  }
}
function line(c: C, x: number, y: number, xx: number, yy: number, color: string, width = 1) {
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(xx, yy);
  c.strokeStyle = color;
  c.lineWidth = width;
  c.stroke();
}
function ellipse(c: C, x: number, y: number, rx: number, ry: number, color: Paint) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fillStyle = color;
  c.fill();
}
function glow(c: C, x: number, y: number, radius: number, color: string) {
  const g = c.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, color);
  g.addColorStop(1, "transparent");
  c.fillStyle = g;
  c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}
function text(c: C, words: string, x: number, y: number, size: number, color = bone, serif = false) {
  c.fillStyle = color;
  c.font = `${size}px ${serif ? "Georgia, serif" : "sans-serif"}`;
  c.fillText(words, x, y);
}
function arch(c: C, x: number, y: number, s: number, alpha: number) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.globalAlpha = alpha;
  const stone = shade(c, "#789186", "#355363", "#142e44", -100, -90, 110, 230);
  const bevel = shade(c, "#a3ac8b", "#5b756f", "#243e52", -85, -75, 75, 180);
  path(c, "M-87 278 L-87 46 C-87 -21 -50 -70 -3 -106 C41 -78 86 -29 86 42 L86 278 L49 278 L49 46 Q48 -17 -2 -68 Q-53 -19 -51 49 L-51 278Z", stone, "#68827e", 1);
  path(c, "M-84 46 C-84 -19 -45 -65 -3 -98 Q73 -42 80 42 L70 42 C68 -12 38 -49 -3 -82 Q-69 -23 -71 48Z", bevel);
  path(c, "M-51 279 L-51 49 Q-53 -19 -2 -68 Q48 -17 49 46 L49 279 L58 279 L58 44 Q55 -23 -2 -79 Q-61 -27 -61 48 L-61 278Z", "#142e4180");
  path(c, "M-95 278 L-91 2 L-78 -3 L-78 278Z M67 278 L68 -3 L82 5 L86 278Z", bevel, "#2a4758", 1);
  path(c, "M-92 276 L-93 224 L-79 217 L-78 276Z M69 277 L70 215 L86 224 L87 277Z", stone);
  for (let k = 0; k < 9; k++) {
    const yy = 19 + k * 30;
    line(c, -85, yy, -53, yy + 3, "#122c4190", 1.4);
    line(c, -83, yy + 2, -54, yy + 5, "#a1b09544", 1);
    line(c, 53, yy, 80, yy + 4, "#142f4280", 1);
  }
  for (let j = 0; j < 11; j++) {
    const a = Math.PI + j * Math.PI / 10;
    const xx = Math.cos(a) * 71;
    const yy = 45 + Math.sin(a) * 125;
    line(c, xx, yy, xx * 1.14, yy - 13, "#16324790", 1);
  }
  path(c, "M-11 -95 Q-11 -115 -3 -132 Q6 -115 7 -97 L-3 -83Z", bevel, "#2a4756");
  path(c, "M-87 110 L-74 123 L-78 142 L-68 152 M66 57 L74 75 L62 84 L73 96 M-23 -86 L-29 -61 L-42 -60", "transparent", "#102b3d", 1.8);
  for (let i = 0; i < 28; i++) {
    const xx = i % 2 ? -78 : 72;
    const yy = 90 + (i * 37.1) % 180;
    ellipse(c, xx + (i % 5) * 2, yy, 1 + i % 3, 1.5, "#a6b49338");
  }
  path(c, "M-72 149 Q-96 147 -89 182 Q-78 170 -90 206 Q-66 194 -74 160 M73 231 Q54 216 66 190 Q71 217 87 216", "#294e4e99");
  c.restore();
}
function environment(c: C, t: number) {
  const sky = c.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, "#07182c");
  sky.addColorStop(0.5, "#33576b");
  sky.addColorStop(1, "#102638");
  c.fillStyle = sky;
  c.fillRect(0, 0, WIDTH, HEIGHT);
  glow(c, 1070, 220, 440, "#76979855");
  ellipse(c, 1090, 173, 91, 91, "#e2d6a9");
  ellipse(c, 1057, 152, 86, 89, "#1a3343");
  for (let r = 113; r < 149; r += 13) {
    c.beginPath();
    c.arc(1090, 173, r, -0.7, 4.7);
    c.strokeStyle = "#afbb9c26";
    c.lineWidth = 1;
    c.stroke();
  }
  for (let i = 0; i < 78; i++) {
    ellipse(c, (i * 173.77) % WIDTH, 30 + (i * 83.7) % 350, i % 7 === 0 ? 1.4 : 0.6, 0.7, "#d3d4b68a");
  }
  for (let j = 0; j < 8; j++) {
    const x = (j * 267 + t * 1.4) % 1900 - 190;
    const y = 180 + j * 32;
    c.save();
    c.globalAlpha = 0.09;
    path(c, `M${x - 230} ${y} Q${x - 110} ${y - 35} ${x} ${y - 12} Q${x + 100} ${y - 38} ${x + 270} ${y + 5} Q${x + 130} ${y + 21} ${x - 50} ${y + 8}Z`, shade(c, "#ccd4be", "#77959b", "#183c58", 0, y - 30, 0, y + 20));
    c.restore();
  }
  path(c, "M0 380 L90 345 L137 354 L162 247 L196 210 L225 267 L225 372 L308 348 L326 288 L345 304 L365 376 L450 345 L502 386 L565 272 L597 292 L611 390 L710 365 L768 403 L842 355 L897 385 L949 332 L1008 385 L1106 369 L1155 390 L1244 281 L1274 300 L1290 393 L1405 364 L1470 407 L1600 354 L1600 560 L0 560Z", "#152f3e");
  arch(c, 200, 290, 1.45, 0.68);
  arch(c, 454, 354, 0.87, 0.55);
  arch(c, 1315, 282, 1.4, 0.58);
  arch(c, 1490, 344, 0.9, 0.57);
  for (const x of [193, 1311]) {
    line(c, x, 234, x, 350, "#547478", 2);
    path(c, `M${x - 23} 345 Q${x - 18} 308 ${x} 308 Q${x + 18} 308 ${x + 23} 345 L${x + 31} 352 L${x - 31} 352Z`, "#344b4e", "#6d7a69");
  }
  for (let i = 0; i < 8; i++) {
    arch(c, i * 235 - 35, 478, 0.52, 0.65);
  }
  c.save();
  c.translate(57, 337);
  path(c, "M-57 190 L-57 -153 L-9 -168 L15 -139 L48 -135 L44 -108 L67 -95 L61 190Z", shade(c, "#8c9980", "#3d5b62", "#112d45", -80, -120, 65, 160), "#526f75", 1);
  path(c, "M-11 -153 L12 -137 L16 191 L-10 190Z", "#142e4077");
  for (let j = 0; j < 11; j++) {
    line(c, -50, -133 + j * 29, 41, -126 + j * 29, "#1c394980", 2);
    line(c, -44, -130 + j * 29, 40, -123 + j * 29, "#95a28a35");
  }
  path(c, "M11 95 L11 18 Q28 -29 47 18 L47 95Z", "#102c3d");
  glow(c, 29, 72, 90, "#e7aa4a28");
  line(c, 30, 82, 30, 68, "#b09569", 6);
  path(c, "M25 68 Q24 54 31 45 Q39 62 34 68Z", "#ffdb86");
  glow(c, 31, 59, 17, "#ffda8766");
  c.restore();
  const mist = c.createLinearGradient(0, 400, 0, 640);
  mist.addColorStop(0, "#aac9bd00");
  mist.addColorStop(0.5, "#9fbfb41f");
  mist.addColorStop(1, "#aac9bd00");
  c.fillStyle = mist;
  c.fillRect(0, 390, 1600, 270);
  path(c, "M0 522 Q350 466 810 506 Q1160 484 1600 511 L1600 809 Q930 770 0 858Z", shade(c, "#6b807c", "#394f59", "#193244", 100, 490, 1200, 850), "#899385", 1);
  for (let row = 0; row < 10; row++) {
    const y = 510 + row * 33;
    const edge = row * 7;
    line(c, 0, y + edge, 1600, y - edge * 0.5, "#101f2b66", 2);
    for (let k = 0; k < 13; k++) {
      const x = k * 146 + (row % 2) * 73;
      line(c, x, y + edge, x - 18, y + edge + 35, "#101f2b55", 1);
    }
  }
  for (let i = 0; i < 90; i++) {
    const x = (i * 197.32) % 1600;
    const y = 523 + (i * 47.2) % 293;
    ellipse(c, x, y, 2 + (i % 4), 1, "#b8b9a129");
  }
  for (let j = 0; j < 22; j++) {
    ellipse(c, 940 + Math.sin(j * 1.3) * 122, 519 + j * 12, 60 + j % 5 * 17, 2 + j % 3, "#c4c8a311");
  }
  for (let j = 0; j < 480; j++) {
    const xx = (j * 137.33) % 1600;
    const yy = 501 + (j * 79.37) % 306;
    line(c, xx, yy, xx + 4 + j % 27, yy - j % 2, j % 3 ? "#d2d1a70a" : "#071b2b13", 1 + j % 2);
  }
  for (const [xx, yy, ss] of [[127, 616, 1.2], [1377, 658, 1.3], [78, 758, 1], [1428, 557, 0.65]]) {
    c.save();
    c.translate(xx!, yy!);
    c.scale(ss!, ss!);
    path(c, "M-32 0 L-23 -22 L4 -29 L35 -15 L26 5Z", shade(c, "#a1a28b", "#6b7c75", "#244452", -20, -30, 20, 10), "#294752", 1);
    path(c, "M-23 -22 L1 -10 L35 -15 L26 5 L-5 8 L-32 0Z", "#2d4c5990");
    path(c, "M-23 -22 L1 -10 L4 -29", "transparent", "#bcc0a04a");
    c.restore();
  }
  path(c, "M0 844 Q352 789 829 803 Q1240 764 1600 815 L1600 900 L0 900Z", "#0d2633");
  for (let i = 0; i < 45; i++) {
    const x = (i * 157.1 + t * 5) % 1640 - 20;
    const y = 828 + (i * 11.8) % 78;
    line(c, x, y, x + 20 + i % 39, y - 2, "#6c97974a");
  }
  glow(c, 360, 672, 220, "#e2b36b14");
  glow(c, 1120, 509, 240, "#91c8c315");
  for (const x of [26, 1497]) {
    c.save();
    c.translate(x, 695);
    path(c, "M0 173 L5 40 L-13 22 L8 8 L23 -63 L39 8 L61 22 L46 40 L52 173Z", "#102632", "#486163", 2);
    path(c, "M13 164 L16 45 L34 45 L39 164Z", "#28414a");
    path(c, "M8 13 L23 -53 L38 13 L23 32Z", "#60716b");
    c.restore();
  }
}
function knight(c: C, kind: number, attack: number, brace: number, cadence: number, moving: boolean, id: number) {
  const stride = moving ? Math.sin(cadence * 8) * 9 : 0;
  const lean = attack * 0.2 + brace * -0.2;
  const plate = shade(c, "#ffedbf", "#c2bf9b", "#526d76");
  const linen = shade(c, "#fff0c7", "#b9bda6", "#4b6975");
  const blue = shade(c, "#718f96", "#385765", "#122d42");
  const copper = shade(c, "#f7bf6b", "#b67740", "#4e5557");
  path(c, `M-13 -31 Q-21 -15 ${-25 - stride} -7 L${-30 - stride} -4 Q${-25 - stride} 2 ${-12 - stride} -1 Q${-8 - stride} -3 -7 -12 L1 -28Z`, blue, "#173241", 1.3);
  path(c, `M5 -32 Q${8 + attack * 8} -19 ${15 + stride + attack * 9} -9 L${26 + stride + attack * 9} -5 Q${29 + stride + attack * 9} 1 ${12 + stride + attack * 9} 0 L${4 + stride} -5 Q-2 -13 -5 -28Z`, blue, "#152e40", 1.3);
  path(c, `M-16 -21 Q-10 -28 -6 -21 L-10 -10 L-20 -9Z M7 -22 Q15 -26 19 -18 L22 -9 L14 -6Z`, plate, "#3b5a66", 0.8);
  c.save();
  c.translate(attack * 6 - brace * 5, brace * 6);
  c.rotate(lean);
  path(c, `M-17 -70 C-31 -68 -31 -44 ${-39 - stride * 0.6} -19 Q-25 -17 -21 -11 Q-16 -18 -10 -16 Q-3 -10 3 -18 L12 -33 L17 -67 Q-1 -81 -17 -70Z`, linen, "#29414d", 1.1);
  path(c, "M-22 -64 Q-21 -47 -29 -25 Q-19 -39 -12 -47 L-14 -21 Q-3 -30 0 -54Z", "#8b9e9866");
  path(c, "M-15 -67 C-6 -77 11 -74 18 -61 L19 -48 Q14 -39 8 -34 L-14 -38 Q-24 -49 -15 -67Z", blue, "#142e3f", 1.4);
  path(c, "M-11 -65 Q-1 -72 10 -65 L15 -48 Q7 -42 -4 -43 L-15 -51Z", plate, "#405b67", 1);
  path(c, "M-9 -63 Q-4 -67 2 -66 L5 -48 Q-4 -47 -10 -53Z", "#fff1c28a");
  path(c, "M5 -67 Q15 -73 21 -63 Q25 -54 18 -50 L12 -52Z", plate, "#375965", 1);
  path(c, "M-22 -64 Q-19 -75 -8 -70 Q-2 -64 -7 -57 L-19 -56Z", plate, "#355866", 1);
  for (let j = 0; j < 3; j++) {
    path(c, `M-17 ${-50 + j * 4} Q-4 ${-44 + j * 4} 12 ${-48 + j * 4}`, "transparent", j === 1 ? gold : "#526d72", 1);
  }
  path(c, "M-12 -73 Q-18 -88 -7 -96 Q6 -103 14 -91 Q20 -80 11 -71 L0 -68Z", "#ac9270", "#2b4452", 1);
  path(c, "M-12 -78 Q-9 -66 0 -66 L7 -74 L3 -84Z", "#765d4e");
  path(c, "M-17 -81 Q-22 -97 -7 -105 Q9 -110 18 -94 L24 -82 Q11 -78 6 -80 L-9 -79 Q-16 -73 -22 -74Z", plate, "#294854", 1.2);
  path(c, "M-14 -96 Q-5 -108 8 -97 L12 -89 Q-1 -93 -14 -86Z", "#fff0be7a");
  path(c, "M-13 -84 Q2 -90 19 -85 L22 -80 Q8 -80 -9 -77Z", "#193644");
  line(c, 7, -86, 12, -86, "#efddb0", 1);
  path(c, "M-12 -101 Q-27 -114 -15 -123 Q-7 -126 -3 -113 L5 -105 Q-8 -103 -12 -101Z", id % 3 === 0 ? copper : blue, "#294551", 0.8);
  path(c, "M-15 -101 Q-24 -117 -15 -119", "transparent", "#e6c98c99", 1);
  path(c, "M-15 -74 Q-1 -67 10 -74 L13 -68 Q2 -58 -17 -65Z", copper, "#4e5650", 0.7);
  path(c, `M-15 -68 Q-35 -66 ${-44 - stride} -80 Q-39 -58 -21 -59Z`, copper, "#495459", 0.7);
  if (kind === 0) {
    c.save();
    c.translate(18 + attack * 23, -48 - brace * 8);
    c.rotate(-brace * 0.55 - attack * 0.17);
    path(c, "M-18 -25 Q1 -36 22 -25 Q29 -5 17 17 Q9 29 -1 32 Q-19 21 -23 3 Q-26 -13 -18 -25Z", plate, "#213b49", 1.5);
    path(c, "M-13 -23 Q2 -30 17 -21 Q22 -1 13 14 L0 25 Q-14 15 -16 0Z", blue, gold, 1.3);
    path(c, "M-9 -18 Q-3 -25 0 -23 L-2 16 Q-12 7 -9 -18Z", "#a2b9aa44");
    path(c, "M1 -21 Q-6 -5 0 16 Q7 3 1 -21Z", "#ead5a0");
    ellipse(c, 1, -5, 5, 5, copper);
    for (const [x, y] of [[-14, -19], [17, -19], [-15, 5], [12, 13], [0, 26]]) {
      ellipse(c, x!, y!, 1.3, 1.3, "#ffe4a8");
    } c.restore();
    c.save();
    c.translate(-17, -60);
    c.rotate(-0.65 + attack * 1.65);
    path(c, "M-5 -5 Q-17 -14 -21 -5 L-15 17 L-4 19 L-2 7Z", blue, "#1f3d4c", 1);
    path(c, "M-18 10 Q-13 7 -7 13 L-2 20 L-7 27 L-16 24Z", plate, "#345460", 1);
    c.translate(-7, 19);
    c.rotate(-attack * 0.6);
    path(c, "M-2 4 L-2 -58 Q0 -72 2 -76 L5 -57 L4 4Z", shade(c, "#effbe1", "#a8c6c3", "#527889"), "#345867", 0.7);
    line(c, -11, 0, 11, -1, "#dcb67b", 2.6);
    line(c, 1, 4, 1, 13, "#715d46", 4);
    c.restore();
  } else if (kind === 1) {
    const pull = attack * 21;
    path(c, `M-10 -60 Q2 -56 ${21 - pull} -59 Q${30 - pull} -58 ${24 - pull} -51 Q4 -43 -15 -51Z`, blue, "#244654", 1.3);
    path(c, `M${18 - pull} -60 Q${29 - pull} -65 ${29 - pull} -55 L${24 - pull} -50Z`, "#c7ab7d", "#4f635f", 0.8);
    c.save();
    c.translate(36, -59);
    c.rotate(-0.52);
    path(c, "M-1 -44 C36 -16 37 13 0 42 Q24 12 20 0 Q18 -24 -1 -44Z", copper, "#213f4c", 1);
    line(c, 0, -43, -pull, 0, "#e4d3a8", 0.8);
    line(c, -pull, 0, 0, 41, "#e4d3a8", 0.8);
    if (attack < 0.9) {
      line(c, -24 - pull, 0, 45, 0, "#d9cba4", 1.2);
      path(c, "M47 0 L38 -3 L38 3Z", "#d2e7da");
    } c.restore();
    path(c, "M-29 -84 Q-20 -88 -19 -73 L-23 -31 L-34 -35Z", "#244b60", gold, 1);
    for (let j = 0; j < 4; j++) {
      line(c, -30 + j * 3, -96 - j % 2 * 6, -26 + j * 2, -69, "#dfc18b", 1);
    }
    path(c, "M-35 -58 L-37 -39 Q-30 -33 -23 -39 L-25 -58Z", "#ad8657", "#243f4c", 1);
    glow(c, -30, -47, 25, "#ffd58170");
    path(c, "M-33 -55 L-33 -42 Q-29 -38 -26 -43 L-27 -55Z", "#ffe2a1");
  } else {
    path(c, `M-9 -61 Q5 -54 ${25 + attack * 10} -57 L${28 + attack * 10} -47 Q5 -43 -15 -51Z`, blue, "#1e3f51", 1.3);
    path(c, `M${23 + attack * 10} -58 Q${35 + attack * 10} -60 ${33 + attack * 10} -51 L${26 + attack * 10} -48Z`, "#c2aa80", "#365766", 0.8);
    c.save();
    c.translate(15 + attack * 25, -54);
    c.rotate(-0.16 - brace * 0.65);
    line(c, -53, 0, 72, 0, "#796b52", 3);
    line(c, -53, -0.8, 72, -0.8, "#c1a36e", 1);
    path(c, "M68 -4 Q84 -8 96 0 Q83 2 72 7 L78 0Z", plate, "#294958", 0.8);
    path(c, "M56 2 Q64 21 69 15 L70 2 Q64 10 62 3Z", copper, "#2f4c55", 0.8);
    c.restore();
    c.beginPath();
    c.ellipse(-23, -39, 10, 14, -0.2, 0, Math.PI * 2);
    c.strokeStyle = "#c1a977";
    c.lineWidth = 3;
    c.stroke();
  }
  for (let j = 0; j < 3; j++) {
    line(c, -19, -29 + j * 4, -11, -31 + j * 4, "#f1dfb166", 0.8);
  } c.restore();
}
function creature(c: C, kind: number, attack: number, recoil: number, id: number) {
  const stretch = attack * 19;
  const crouch = recoil * 10;
  const shell = shade(c, "#c2d3b6", "#6faaa6", "#264f6b", -40, -90, 40, 0);
  const skin = shade(c, "#739b91", "#416b79", "#152f4c", -40, -70, 25, 0);
  const boneMat = shade(c, "#f0dfb2", "#c0c7a4", "#547c82", -40, -95, 30, 0);
  path(c, `M-21 -31 Q-34 -26 -40 -13 L-50 -2 Q-36 1 -30 -6 L-16 -21 M14 -30 Q35 -26 39 -12 L52 -2 Q41 1 30 -5 L6 -20`, skin, "#193a50", 1.4);
  c.save();
  c.translate(recoil * 9, crouch);
  c.rotate(-recoil * 0.25);
  path(c, "M-35 -40 C-35 -73 -8 -86 17 -73 Q47 -66 37 -37 Q30 -13 3 -16 Q-17 -13 -35 -40Z", skin, "#133a50", 1.5);
  path(c, "M15 -51 Q48 -76 62 -49 Q55 -43 60 -26 Q42 -32 37 -38Z", skin, "#2d5365", 1.2);
  for (let j = 0; j < 5; j++) {
    const x = -27 + j * 12;
    const y = -61 - Math.sin(j * 0.65) * 13;
    path(c, `M${x - 8} ${y + 26} Q${x - 18} ${y - 1} ${x + 1} ${y - 20} Q${x - 2} ${y - 1} ${x + 12} ${y + 6} Q${x + 17} ${y + 19} ${x - 8} ${y + 26}Z`, shell, "#2b5a6c", 1);
    path(c, `M${x - 9} ${y + 11} Q${x - 13} ${y - 4} ${x} ${y - 16}`, "transparent", "#def2c49c", 1.2);
    for (let k = 0; k < 3; k++) {
      ellipse(c, x - 6 + k * 4, y + 10 + k * 4, 0.8, 0.8, "#dae9c890");
    }
  }
  if (kind === 2) {
    path(c, "M15 -70 Q34 -99 22 -123 Q38 -118 39 -99 Q52 -109 51 -123 Q62 -105 44 -89 Q43 -66 30 -52Z", boneMat, "#315d69", 1.2);
    path(c, "M22 -74 Q32 -96 29 -109", "transparent", "#eff2c799", 1);
  }
  c.save();
  c.translate(-26 - stretch, -49);
  c.rotate(recoil * -0.3);
  path(c, kind === 1 ? "M12 -8 Q-10 -27 -31 -18 Q-45 -12 -49 0 L-32 6 Q-20 20 -7 14 L18 3Z" : "M13 -10 C-4 -32 -25 -25 -35 -10 Q-49 -7 -43 3 L-32 11 Q-15 19 1 10 L19 3Z", boneMat, "#214b60", 1.3);
  path(c, "M-38 -5 Q-30 -19 -16 -13 L-9 -4 Q-28 -4 -30 3Z", "#244b60");
  path(c, "M-29 -8 Q-24 -12 -18 -9 L-21 -5 L-28 -4Z", "#b7f5d0");
  ellipse(c, -24, -8, 1.2, 2, "#17394d");
  path(c, "M-36 7 Q-20 7 -10 15 Q-24 24 -37 12Z", skin, "#234a5c", 0.8);
  path(c, "M-34 8 Q-34 25 -28 22 L-26 10 M-20 12 Q-18 25 -12 19 L-12 10", boneMat, "#3b6370", 0.7);
  path(c, "M-6 -18 Q7 -35 0 -46 Q22 -37 9 -14Z", shell, "#31596a", 1);
  path(c, "M-31 -18 Q-27 -27 -18 -25", "transparent", "#fff1c782", 1.2);
  c.restore();
  c.save();
  c.translate(-22, -35);
  c.rotate(attack * -0.7);
  path(c, "M-7 -4 Q-39 -11 -45 12 L-32 26 L-16 12 L-3 8Z", skin, "#22475d", 1.2);
  path(c, "M-42 12 Q-57 6 -60 24 Q-49 17 -48 30 Q-35 21 -32 14Z", boneMat, "#365b69", 1.2);
  c.restore();
  path(c, "M21 -35 Q53 -28 50 -11 Q47 -8 43 -12 L36 -20 Q37 -5 27 -2 L21 -20 L9 -27Z", skin, "#22475b", 1.3);
  path(c, "M39 -18 L51 -11 L58 -2 Q45 -2 39 -9 M22 -18 L26 -3 L35 -1 Q26 4 20 -3Z", boneMat, "#365b68", 0.8);
  if (id % 4 === 0) {
    ellipse(c, 10, -44, 3, 4, "#deb77b");
    ellipse(c, 15, -49, 2, 3, "#a7c8aa");
  } c.restore();
}
function actor(c: C, unit: Soldier, t: number) {
  const p = soldierAt(unit, t);
  c.save();
  c.translate(p.x, p.y);
  c.scale(unit.scale, unit.scale);
  ellipse(c, 0, 0, 36, 9, "#07172470");
  c.translate(0, -p.attack * 3);
  c.rotate(unit.side === "ivory" ? p.attack * 0.09 + p.brace * 0.13 - p.fallen * 1.35 : -p.recoil * 0.18 - p.fallen * 1.3);
  c.globalAlpha = 1 - p.fallen * 0.25;
  if (unit.side === "ivory") {
    knight(c, unit.kind, p.attack, p.brace, p.cadence, t < 5 || (t > 23 && t < 27), unit.id);
  } else {
    creature(c, unit.kind, p.attack, p.recoil, unit.id);
  } c.restore();
}
function giant(c: C, t: number) {
  const pose = t < 15.5 ? ramp(t, 13, 15.5) : t < 17.5 ? 1 + ramp(t, 15.5, 16.15) : t < 20 ? 2 + ramp(t, 17.5, 19) : t < 21 ? 3 * (1 - ramp(t, 20, 21)) : t < 29 ? ramp(t, 21, 23) * 4 : 4 + ramp(t, 29.2, 33);
  c.save();
  c.translate(1245, 574);
  c.scale(1.04, 1.04);
  drawBellKeeper(c, { pose, time: t });
  c.restore();
}
function captain(c: C, t: number) {
  const dash = ramp(t, 23.8, 25.2);
  const leap = Math.sin(clamp((t - 27.2) / 2.7) * Math.PI);
  const slash = ramp(t, 28.6, 29.25);
  const pose = t < 23.8 ? ramp(t, 21, 23) : t < 27.2 ? 1 + ramp(t, 23.8, 24.8) : t < 28.6 ? 2 + ramp(t, 27.2, 28.4) : t < 30 ? 3 + ramp(t, 28.6, 29.25) : 4 + ramp(t, 30, 31.4);
  c.save();
  c.translate(535 + dash * 410 + slash * 130, 738 - leap * 300);
  c.scale(1.32, 1.32);
  drawCaptain(c, { pose, time: t, wind: dash * 22 });
  c.restore();
}
function effects(c: C, t: number) {
  for (const launch of volleys) {
    if (t < launch || t > launch + 2.6) { continue; }
    for (let j = 0; j < 17; j++) {
      const u = (t - launch - j * 0.055) / 1.25;
      const archerId = Math.floor(j % 8 / 2) * 7 + j % 2;
      const origin = soldierAt(soldiers[archerId]!, launch + j * 0.055);
      const target = soldierAt(soldiers[28 + j * 11 % 28]!, t);
      const startX = origin.x + 30;
      const startY = origin.y - 48;
      const endX = target.x;
      const endY = target.y - 43;
      if (u > 0 && u < 1) {
        const x = startX + u * (endX - startX);
        const y = startY + u * (endY - startY) - Math.sin(u * Math.PI) * 205;
        const angle = Math.atan2(endY - startY - Math.cos(u * Math.PI) * 205 * Math.PI, endX - startX);
        c.save();
        c.translate(x, y);
        c.rotate(angle);
        line(c, -36, 0, 0, 0, "#e4d7a7", 1.7);
        path(c, "M4 0 L-5 -3 L-5 3Z", bone);
        line(c, -34, -4, -29, 0, gold);
        c.restore();
      }
      const hit = (t - launch - j * 0.055 - 1.25) / 0.38;
      if (hit > 0 && hit < 1) {
        c.globalAlpha = 1 - hit;
        for (let k = 0; k < 6; k++) {
          const a = k * 1.04;
          line(c, endX, endY, endX + Math.cos(a) * hit * 32, endY + Math.sin(a) * hit * 30, "#d6e4bc", 2);
        } c.globalAlpha = 1;
      }
    }
  }
  const wave = clamp((t - 15.8) / 2.2);
  if (wave > 0 && wave < 1) {
    const x = 1110 - wave * 650;
    c.save();
    c.globalAlpha = Math.sin(wave * Math.PI) * 0.9;
    path(c, `M${x - 95} 780 Q${x + 5} 699 ${x - 34} 616 Q${x + 63} 647 ${x + 15} 567 Q${x + 130} 650 ${x + 60} 782Z`, "#81b9b8", "#c1e3cc", 3);
    for (let j = 0; j < 23; j++) {
      const y = 585 + (j * 53) % 190;
      ellipse(c, x + Math.sin(j * 2) * 100, y, 2 + j % 3, 5, "#c5e5ce");
    } c.restore();
  }
  const ropes = ramp(t, 21.2, 22.6) * (1 - ramp(t, 29.5, 30.3));
  if (ropes > 0) {
    for (let j = 0; j < 5; j++) {
      c.beginPath();
      c.moveTo(600 + j * 20, 571 + j * 42);
      c.quadraticCurveTo(890, 555 + j * 25, 600 + j * 20 + (625 - j * 20) * ropes, 362 + j * 31);
      c.strokeStyle = "#d7c188";
      c.lineWidth = 1.5;
      c.stroke();
    }
  }
  const cut = clamp((t - 28.8) / 0.65);
  if (cut > 0 && cut < 1) {
    c.save();
    c.globalAlpha = Math.sin(cut * Math.PI) * 0.38;
    path(c, "M910 519 Q1120 329 1364 417 Q1145 362 982 539Z", "#ecedd4");
    glow(c, 1210, 425, 140, "#a9e3d230");
    c.restore();
  }
  if (t > 29) {
    for (let j = 0; j < 70; j++) {
      const u = clamp((t - 29 - j * 0.012) / 4);
      if (u > 0 && u < 1) {
        const a = j * 2.39;
        c.save();
        c.globalAlpha = 1 - u;
        const x = 1230 + Math.cos(a) * u * 240;
        const y = 350 + Math.sin(a) * u * 230 + u * u * 180;
        c.translate(x, y);
        c.rotate(a + u * 3);
        path(c, "M-4 -9 L7 -3 L2 9 L-6 3Z", j % 3 ? "#a9c8b1" : "#d0bd88");
        c.restore();
      }
    }
  }
  for (let j = 0; j < 12; j++) {
    const u = ((t + j * 0.33) % 2.7 - 1.7) / 0.23;
    if (t > 5 && t < 30 && u > 0 && u < 1) {
      c.globalAlpha = 1 - u;
      const x = 760 + j % 3 * 61 + ramp(t, 24, 27) * 110;
      const y = 518 + Math.floor(j / 3) * 65;
      for (let k = 0; k < 4; k++) {
        line(c, x, y, x + Math.cos(k * 1.9) * u * 23, y + Math.sin(k * 1.9) * u * 23, bone, 1.5);
      } c.globalAlpha = 1;
    }
  }
}
export function paintMoonwake(c: C, time: number, width = WIDTH, height = HEIGHT, withTitles = true) {
  const t = clamp(time, 0, DURATION);
  c.save();
  c.scale(width / WIDTH, height / HEIGHT);
  c.clearRect(0, 0, WIDTH, HEIGHT);
  const zoom = 1 + ramp(t, 21, 25) * (1 - ramp(t, 31, 35)) * 0.12;
  const cameraDrop = ramp(t, 27.2, 28.2) * (1 - ramp(t, 28.7, 29.2)) * 48;
  c.save();
  c.translate(1050, 560 + cameraDrop);
  c.scale(zoom, zoom);
  c.translate(-1050, -560);
  environment(c, t);
  giant(c, t);
  [...soldiers].sort((a, b) => soldierAt(a, t).y - soldierAt(b, t).y).forEach((unit) => actor(c, unit, t));
  captain(c, t);
  effects(c, t);
  for (let j = 0; j < 46; j++) {
    const x = (j * 83.21 + t * (8 + j % 5)) % 1600;
    const y = 360 + (j * 41.78 - t * 6 + 600) % 450;
    ellipse(c, x, y, 0.8, 1.5, "#deead351");
  } c.restore();
  const vignette = c.createRadialGradient(800, 490, 270, 800, 450, 920);
  vignette.addColorStop(0, "transparent");
  vignette.addColorStop(1, "#0313219a");
  c.fillStyle = vignette;
  c.fillRect(0, 0, WIDTH, HEIGHT);
  if (withTitles) {
    text(c, "H A Z A R D   P A Y     /     A R T   D I R E C T I O N   S T U D Y   0 1", 59, 51, 11, "#aebeb5");
    text(c, "MOONWAKE", 57, 102, 42, "#e5dfc4", true);
    text(c, "THE IVORY COMPANY  ·  THE DROWNED CAUSEWAY", 59, 131, 10, "#c0c6af");
    line(c, 59, 151, 296, 151, "#9da78b66");
    const chapter = chapterAt(t);
    text(c, chapter.name, 59, 179, 19, "#d0d5bd", true);
    text(c, "28 MERCENARIES   /   28 TIDEBORN   /   1 BELL-KEEPER", 59, 202, 9, "#9caea7");
    c.textAlign = "right";
    text(c, `${Math.floor(t).toString().padStart(2, "0")} / 36`, 1540, 51, 15, "#d4d8be");
    text(c, "DETERMINISTIC ENCOUNTER", 1540, 73, 9, "#9caea7");
    c.textAlign = "left";
    line(c, 59, 855, 1540, 855, "#9caa8c44");
    line(c, 59, 855, 59 + 1481 * t / 36, 855, "#d1bd82", 2);
    text(c, chapter.detail, 59, 881, 13, "#bdc9bc", true);
  } c.restore();
}
