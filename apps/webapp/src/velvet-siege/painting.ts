/** Original vector painting. Pure time sampling is shared by the route and offline film. */
export const DURATION = 36;
export const CHAPTERS = [
  { time: 0, title: "The procession" },
  { time: 6, title: "Choir of mortars" },
  { time: 13, title: "The violet breach" },
  { time: 21, title: "A crown unmade" },
  { time: 29, title: "The last cathedral" },
];
export const WIDTH = 1600;
export const HEIGHT = 900;
type C = CanvasRenderingContext2D;
const ink = "#130f25";
const gold = "#f8ed96";
const violet = "#a093f9";
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
export type Engine = { id: number; faction: 0 | 1; kind: number; row: number; x: number; y: number; death: number };
export const ENGINES: Engine[] = Array.from({ length: 48 }, (_, id) => {
  const faction = (id >= 24 ? 1 : 0) as 0 | 1;
  const n = id % 24;
  const row = Math.floor(n / 6);
  const col = n % 6;
  return { id, faction, kind: col % 3, row, x: faction ? 990 + col * 78 : 130 + col * 79, y: 398 + row * 91 + (col % 2) * 12, death: faction ? (n < 6 ? 8.1 + n * 0.19 : n < 16 ? 15.1 + (n - 6) * 0.1 : 31.2 + (n - 16) * 0.18) : n % 3 === 0 ? 22.6 + Math.floor(n / 3) * 0.12 : 99 };
});
export const SKIRMISHES = [3.9, 9.8, 18.7, 25.5, 28.7].flatMap((time, beat) =>
  Array.from({ length: 6 }, (_, i) => ({ time: time + i * 0.17, source: beat % 2 ? 42 + i : 12 + i, target: beat % 2 ? 12 + i : 42 + i })),
);
export function statusAt(time: number) {
  return { violet: ENGINES.filter((u) => u.faction === 0 && u.death > time).length + 1, ivory: ENGINES.filter((u) => u.faction === 1 && u.death > time).length + (time < 33 ? 1 : 0), chapter: CHAPTERS.filter((s) => s.time <= time).at(-1)?.title ?? CHAPTERS[0]?.title };
}
function sky(c: C, t: number) {
  const g = c.createLinearGradient(0, 0, 0, 620);
  g.addColorStop(0, "#100c22");
  g.addColorStop(0.5, "#3b274f");
  g.addColorStop(1, "#ba7180");
  c.fillStyle = g;
  c.fillRect(0, 0, WIDTH, HEIGHT);
  ellipse(c, 795, 205, 183, 183, "#aa858c");
  ellipse(c, 795, 192, 173, 173, "#17122b");
  c.save();
  c.globalAlpha = 0.35;
  for (let i = 0; i < 50; i++) {
    const x = (i * 277) % WIDTH;
    const y = 40 + ((i * 137) % 300);
    ellipse(c, x, y, 1, 1, gold);
  } c.restore();
  path(c, "M0 362 Q130 342 205 247 L212 164 L221 248 Q290 324 394 340 L430 408 L0 450Z", "#2a203c");
  path(c, "M1600 450 L1200 402 L1258 338 Q1372 316 1401 191 L1410 113 L1421 194 Q1474 326 1600 355Z", "#2a203c");
  path(c, "M548 380 L590 320 L619 170 L643 124 L658 173 L670 292 L705 326 L719 364 L883 364 L897 326 L932 292 L944 173 L960 124 L984 170 L1011 320 L1052 380 Z", "#1b182e", "#866274", 2);
  path(c, "M665 350 Q669 113 795 66 Q927 116 932 350 L888 350 Q886 165 795 124 Q708 168 706 350 Z", "#3c2b4c", "#ab8190", 2);
  path(c, "M700 347 Q708 147 795 109 Q886 151 897 347", "", "#bc9396", 3);
  path(c, "M717 343 Q725 180 795 144 Q868 183 880 343", "", "#725974", 2);
  for (let i = 0; i < 7; i++) {
    const x = 736 + i * 20;
    line(c, [x, 275 - Math.sin(i / 6 * Math.PI) * 97, x, 348], "#866775", 3);
  }
  path(c, "M795 162 L812 244 L795 277 L778 244 Z", "#ceaf93");
  path(c, "M764 318 L795 287 L825 318 L844 363 L745 363Z", "#665066");
  for (let i = 0; i < 9; i++) {
    const x = 320 + i * 120;
    path(c, `M${x} 370 L${x + 15} 302 L${x + 23} 260 L${x + 32} 301 L${x + 49} 370Z`, "#29233c");
  }
  path(c, "M577 353 L612 194 L630 172 L651 356Z", "#33273e", "#b18a8b", 1.5);
  path(c, "M612 194 L630 172 L617 349 L595 357Z", "#61445b");
  path(c, "M945 356 L967 172 L986 194 L1021 353Z", "#33273e", "#b18a8b", 1.5);
  path(c, "M967 172 L986 194 L1003 352 L982 349Z", "#604459");
  path(c, "M631 327 L662 295 L677 306 L677 364 L643 374 L624 357Z M923 306 L938 295 L969 327 L976 357 L957 374 L923 364Z", "#524054", "#a6818a", 1);
  c.save();
  c.globalAlpha = 0.13;
  for (let i = 0; i < 4; i++) {
    const x = ((t * 4 + i * 410) % 1850) - 230;
    path(c, `M${x} 325 Q${x + 100} 281 ${x + 220} 315 Q${x + 280} 330 ${x + 360} 316 Q${x + 250} 353 ${x + 90} 342 Z`, "#ffe4c6");
  } c.restore();
}
function ground(c: C) {
  path(c, "M0 371 Q795 309 1600 371 L1600 900 L0 900Z", "#201a32");
  const g = c.createLinearGradient(0, 350, 0, 900);
  g.addColorStop(0, "#594054");
  g.addColorStop(0.4, "#39283f");
  g.addColorStop(1, "#171426");
  path(c, "M171 357 L1430 357 L1700 900 L-100 900Z", g);
  for (let i = 0; i < 7; i++) {
    const y = 383 + i * i * 10;
    line(c, [190, y, 1400, y], "#69536538", 1);
  }
  for (let i = -2; i < 10; i++) {
    line(c, [795 + (i - 5) * 110, 354, 795 + (i - 5) * 250, 900], "#785c6d20", 1);
  }
  path(c, "M745 375 L848 375 L973 900 L590 900 Z", "#262036", "#a27c73", 2);
  for (let i = 0; i < 7; i++) {
    const y = 409 + i * 69;
    path(c, `M795 ${y} L${820 + i * 6} ${y + 20} L795 ${y + 40} L${770 - i * 6} ${y + 20}Z`, "", "#77616a", 1);
  }
  path(c, "M0 367 L262 349 L283 366 L215 388 L91 476 L0 465Z", "#3a3045", "#a78288", 1.5);
  path(c, "M0 465 L91 476 L215 388 L215 425 L103 538 L0 530Z", "#171525");
  path(c, "M1600 353 L1430 345 L1358 380 L1416 400 L1510 472 L1600 460Z", "#4e394e", "#bc8e93", 1.5);
  path(c, "M1600 460 L1510 472 L1416 400 L1405 441 L1505 526 L1600 502Z", "#181426");
  path(c, "M0 703 L94 623 L141 632 L241 561 L269 570 L235 605 L137 677 L91 678 L0 755Z", "#221d30", "#685266", 2);
  path(c, "M1600 714 L1506 631 L1454 636 L1380 594 L1354 617 L1435 686 L1499 687 L1600 780Z", "#1b192c", "#6e5368", 2);
  path(c, "M622 374 L647 374 L566 532 L544 534Z M980 373 L1001 373 L1100 531 L1075 532Z", "#d2a3991a");
  line(c, [633, 382, 563, 522], "#bc9d9255", 2);
  line(c, [992, 382, 1080, 522], "#bc9d9255", 2);
  ellipse(c, 835, 563, 110, 24, "#d9a8cb0d");
  ellipse(c, 697, 734, 160, 31, "#b19ceb0c");
  path(c, "M744 492 L764 475 L790 480 L804 496 L788 509 L774 540 L763 502Z M863 669 L890 650 L916 659 L935 706 L909 691 L889 682 L866 698Z", "#161322", "#715263", 1.5);
  path(c, "M775 501 L806 518 L819 548 L850 558 M887 683 L862 720 L870 744 L846 771", "", "#140f20", 4);
  path(c, "M576 773 L595 748 L611 752 L623 795 L601 799Z M1240 421 L1254 391 L1273 396 L1281 429Z", "#181528", "#7a596d", 1);
  line(c, [589, 765, 601, 757, 615, 788], "#ad8589", 1.5);
  path(c, "M0 787 L150 738 L205 758 L0 851Z", "#0d0d1b", "#64505c", 2);
  path(c, "M1600 761 L1475 715 L1402 765 L1600 853Z", "#0d0d1b", "#64505c", 2);
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
export function enginePosition(u: Engine, time: number) {
  const t = Math.min(time, u.death);
  const col = u.id % 6;
  const deployment = ease(t / 5);
  const breach = ease((t - 11.8 - u.row * 0.15) / 3.3);
  const final = ease((t - 27.5) / 4.5);
  const initialX = u.x + (u.faction ? -1 : 1) * deployment * 65;
  const flank = u.row >= 2;
  const combatX = u.faction ? (flank ? 1085 : 865) + col * 62 : (flank ? 465 : 630) + col * 52;
  const x = mix(initialX, combatX, breach) + (u.faction ? final * 30 : final * 190);
  const y = u.y + Math.sin(col * 2) * breach * 22 + (u.row - 1.5) * (u.faction ? 10 : -15) * breach + final * (u.row - 1.5) * 8;
  return { x, y };
}
function unit(c: C, u: Engine, t: number) {
  const direction = u.faction ? -1 : 1;
  const { x, y } = enginePosition(u, t);
  const death = clamp((t - u.death) / 1.6);
  const salvo = u.faction ? 21.2 + (u.id % 6) * 0.2 : 6.2 + (u.id % 6) * 0.2;
  const brace = ease((t - salvo + 1.5) / 1.2) - ease((t - salvo - 1.2) / 1.5);
  const smallShot = SKIRMISHES.filter((shot) => shot.source === u.id).reduce((value, shot) => Math.max(value, Math.max(0, 1 - (t - shot.time + 0.8) / 0.65) * (t >= shot.time - 0.8 ? 1 : 0)), 0);
  const hit = SKIRMISHES.filter((shot) => shot.target === u.id).reduce((value, shot) => Math.max(value, Math.sin(clamp((t - shot.time) / 0.8) * Math.PI)), 0);
  const recoil = Math.max(smallShot, Math.max(0, 1 - (t - salvo) / 0.7) * (t >= salvo ? 1 : 0));
  const flight = u.kind === 2 ? (ease((t - 12) / 2) - ease((t - 17) / 2)) * 56 : 0;
  const move = t < 5 || (t > 12 && t < 15.5) || (t > 29 && t < 33);
  const gait = move ? t * 6 + u.id : u.id;
  if (death > 0.65) {
    c.save();
    c.translate(x, y);
    c.scale(direction, 1);
    ellipse(c, 0, 12, 43, 13, "#1a1527");
    c.rotate((u.id % 5 - 2) * 0.14);
    const scrap = u.faction ? "#98818b" : "#4b3d64";
    if (u.kind === 0) {
      path(c, "M-35 8 Q-36 -19 -12 -16 L-3 -6 L-14 -3 L-6 8 L-13 17Z M4 8 Q18 -6 31 2 L22 20Z", scrap, ink, 2);
    } else if (u.kind === 1) {
      path(c, "M-41 5 Q-23 -18 -14 0 L-19 12Z M-10 16 L-7 -9 L3 -18 L9 14Z M18 -2 Q33 -23 40 -6 L29 14Z", scrap, ink, 2);
    } else {
      path(c, "M-32 8 L-30 -13 L-19 -3 L-13 -20 L-8 -1 L2 -9 L7 8 L-11 18Z M14 11 L30 -12 L39 -6 L28 18Z", scrap, ink, 2);
    }
    path(c, "M-40 12 L-54 21 L-34 19 M27 14 L47 10 L39 23", "", u.faction ? "#c4b7ad" : "#837295", 3);
    line(c, [-19, -3, -12, 3, -19, 12], "#d1b095", 1);
    c.restore();
    burst(c, x, y - 20, (t - u.death) / 1.1, 62);
    return;
  }
  c.save();
  ellipse(c, x, y + 14, 41, 10, "#15112099");
  c.translate(x - direction * (recoil * 13 + hit * 18), y - flight + brace * 5 - (u.kind === 1 ? 10 : 0));
  c.scale(direction * (0.67 + u.row * 0.075), (0.67 + u.row * 0.075) * (1 - hit * 0.1));
  c.rotate(death * 1.05 + recoil * 0.13 - hit * 0.18);
  c.translate(0, death * 14);
  if (u.faction) {
    ivory(c, u.kind, brace, gait);
  } else if (u.kind === 0) {
    walker(c, false, gait, recoil);
  } else if (u.kind === 1) {
    manta(c, false, brace);
  } else {
    crown(c, false, brace);
  }
  if (death > 0.5) {
    c.globalAlpha = death * 0.8;
    path(c, "M-31 -34 L1 -12 L-10 3 L19 18", "", "#1c1225", 5);
  }
  c.restore();
  burst(c, x, y - 20, (t - u.death) / 1.1, 62);
}
function projectile(c: C, x: number, y: number, tx: number, ty: number, p: number, high: number, color: string) {
  if (p < 0 || p > 1) {
    return;
  }
  const px = mix(x, tx, p);
  const py = mix(y, ty, p) - Math.sin(p * Math.PI) * high;
  const prior = Math.max(0, p - 0.09);
  const qx = mix(x, tx, prior);
  const qy = mix(y, ty, prior) - Math.sin(prior * Math.PI) * high;
  line(c, [qx, qy, px, py], color, 3);
  star(c, px, py, 10, gold);
}
function setpieces(c: C, t: number) {
  for (const shot of SKIRMISHES) {
    const source = ENGINES[shot.source];
    const target = ENGINES[shot.target];
    if (!source || !target || source.death <= shot.time - 0.8 || target.death <= shot.time) {
      continue;
    }
    const from = enginePosition(source, shot.time - 0.8);
    const to = enginePosition(target, shot.time);
    projectile(c, from.x, from.y - 35, to.x, to.y - 15, (t - shot.time + 0.8) / 0.8, 30, source.faction ? "#f4c0b6" : gold);
    burst(c, to.x, to.y - 15, (t - shot.time) / 0.55, 31, true);
  }
  for (const target of ENGINES) {
    const n = target.id % 24;
    if (target.death > 36) {
      continue;
    }
    const impact = target.death;
    const end = enginePosition(target, impact);
    if (target.faction && n < 6) {
      const source = ENGINES[(n % 4) * 6 + 1];
      if (source) {
        const start = enginePosition(source, impact - 1.7);
        projectile(c, start.x, start.y - 45, end.x, end.y - 15, (t - impact + 1.7) / 1.7, 240, gold);
      }
    } else if (!target.faction) {
      const source = ENGINES[42 + (n % 6)];
      if (source) {
        const start = enginePosition(source, impact - 1.5);
        projectile(c, start.x, start.y - 44, end.x, end.y - 15, (t - impact + 1.5) / 1.5, 145, "#fce6d3");
      }
    }
    burst(c, end.x, end.y - 20, (t - impact) / 1.2, n < 6 ? 90 : 67, !target.faction);
  }
  if (t > 14.55 && t < 15.6) {
    const p = ease((t - 14.55) / 0.55);
    c.save();
    c.globalAlpha = 1 - ease((t - 15.05) / 0.55);
    path(c, `M908 598 L${1010 + p * 200} ${526 - p * 65} L${1020 + p * 200} ${552 + p * 25} L914 616Z`, "#d0b4ffbb");
    line(c, [913, 607, 1020 + p * 200, 552], "#fff8c7", 6);
    c.restore();
  }
  for (let i = 0; i < 8; i++) {
    const source = ENGINES[i * 3 + 1];
    if (!source) {
      continue;
    }
    const impact = 31.2 + i * 0.18;
    const start = enginePosition(source, impact - 1);
    projectile(c, start.x, start.y - 35, 1005, 605, (t - impact + 1) / 1, 65, violet);
    burst(c, 1005 + (i % 3) * 18, 608 - (i % 4) * 24, (t - impact) / 1.35, 98);
  }
}
export function paintBattle(c: C, time: number, width = WIDTH, height = HEIGHT) {
  const t = Math.max(0, Math.min(DURATION, time));
  c.save();
  c.scale(width / WIDTH, height / HEIGHT);
  c.save();
  const zoom = 1 + ease((t - 11) / 5) * 0.065;
  c.translate(WIDTH / 2, 490);
  c.scale(zoom, zoom);
  c.translate(-WIDTH / 2, -490);
  sky(c, t);
  ground(c);
  path(c, "M748 288 L797 272 L1127 900 L753 900Z", "#d3a4bd07");
  c.save();
  const shake = (t > 15.3 && t < 16 ? 4 : t > 31.4 && t < 32.1 ? 5 : 0);
  c.translate(Math.sin(t * 83) * shake, Math.cos(t * 69) * shake * 0.5);
  for (const u of ENGINES) {
    if (u.row < 3) {
      unit(c, u, t);
    }
  }
  const hx = 405 + ease(t / 6) * 48 + ease((t - 11.7) / 2.8) * 280 + ease((t - 27) / 4) * 45;
  const swing = -ease((t - 12) / 2) * 0.72 + ease((t - 14.5) / 0.45) * 2.1 - ease((t - 16) / 2.8) * 1.38;
  const lean = -ease((t - 12) / 2) * 0.12 + ease((t - 14.5) / 0.45) * 0.28 - ease((t - 16) / 2.8) * 0.16;
  ellipse(c, hx, 751, 98, 31, "#b292ea0c");
  for (let i = 0; i < 5; i++) {
    line(c, [hx - 54 + i * 23, 739, hx - 65 + i * 25, 791 - i * 4], "#aa89d21b", 5);
  }
  ellipse(c, hx, 735, 113, 24, "#100d1ddd");
  c.save();
  c.translate(hx, 651);
  c.scale(1.12, 1.12);
  c.rotate(lean);
  hero(c, false, swing, clamp(1 - (t - 15) / 0.8) * (t > 15 ? 1 : 0));
  c.restore();
  const ix = 1115 - ease((t - 12) / 4) * 110;
  ellipse(c, ix, 734, 110, 24, "#100d1ddd");
  c.save();
  c.translate(ix + ease((t - 31) / 3) * 42, 655 + ease((t - 31) / 3) * 53);
  c.scale(-1.1, 1.1);
  c.rotate(ease((t - 31) / 3) * 1.2);
  ivoryHero(c, (ease((t - 14.9) / 0.35) - ease((t - 16.2) / 2.1)) * 1.25 + ease((t - 19.4) / 1.8) - ease((t - 23) / 2), ease((t - 31.4) / 2));
  c.restore();
  for (const u of ENGINES) {
    if (u.row === 3) {
      unit(c, u, t);
    }
  }
  setpieces(c, t);
  c.restore();
  c.restore();
  path(c, "M0 867 L87 799 L126 812 L144 847 L226 873 L260 900 L0 900Z M1600 829 L1534 783 L1497 805 L1490 852 L1393 881 L1390 900 L1600 900Z", "#0c0d1b");
  path(c, "M0 900 L0 699 L62 665 L87 699 L93 794 L126 804 L145 853 L204 900Z", "#101021", "#5f485c", 2);
  path(c, "M0 699 L62 665 L60 792 L31 813 L29 715Z", "#282037");
  path(c, "M62 665 L87 699 L93 794 L60 792Z", "#453249");
  path(c, "M1600 900 L1600 725 L1547 682 L1519 717 L1510 810 L1469 835 L1446 900Z", "#0f1020", "#584255", 2);
  path(c, "M1547 682 L1519 717 L1510 810 L1542 801Z", "#493449");
  line(c, [61, 689, 66, 778], "#8e6a7b", 2);
  line(c, [1545, 706, 1535, 791], "#8b6976", 2);
  const fade = c.createLinearGradient(0, 0, 0, 165);
  fade.addColorStop(0, "#110e24e8");
  fade.addColorStop(1, "#110e2400");
  c.fillStyle = fade;
  c.fillRect(0, 0, WIDTH, 165);
  text(c, "HAZARD PAY  /  MOTION STUDY No. 03", 57, 47, 12, "#c2abc8", 2.5);
  text(c, "Velvet Siege", 55, 94, 38, "#fff0db");
  text(c, "THE ECLIPSE CAUSEWAY", 60, 120, 10, "#cab3cd", 3);
  const s = statusAt(t);
  text(c, "VESPER COURT", 1236, 45, 11, "#d2b9f4", 2);
  text(c, `${String(s.violet).padStart(2, "0")}  /  ${String(s.ivory).padStart(2, "0")}`, 1240, 83, 31, gold);
  text(c, "IVORY DOMINION", 1392, 45, 11, "#e9cdbc", 1.5);
  text(c, s.chapter?.toUpperCase() ?? "", 60, 850, 12, "#ead4df", 3);
  text(c, `${t.toFixed(1).padStart(4, "0")}  /  36.0`, 1408, 850, 12, "#c9b6ce", 1);
  if (t > 34) {
    c.save();
    c.globalAlpha = ease((t - 34) / 1.2);
    path(c, "M615 157 L985 157 L960 228 L640 228Z", "#181225dc", "#ad929d", 1);
    text(c, "THE COURT ENDURES", 656, 187, 15, gold, 3);
    text(c, "IVORY DOMINION  ·  ROUTED", 682, 211, 10, "#dbc6dd", 1.5);
    c.restore();
  }
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
