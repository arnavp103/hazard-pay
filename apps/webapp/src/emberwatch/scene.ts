/** Native-pixel sprites on an elevated, continuous two-axis battlefield. */
export const DURATION = 44;
export const CHAPTERS = [
  { time: 0, title: "The copper garden", note: "Ninety combatants split around the ruins and railway." },
  { time: 8, title: "Four breaches", note: "Breakers pin the brood while rifle teams circle the foundations." },
  { time: 14, title: "Spore rain", note: "Artillery walks across the clearing. The north patrol flanks behind cover." },
  { time: 21, title: "Hammerfall", note: "Rook vaults into the southern breach; the shock scatters its defenders." },
  { time: 29, title: "The brood engine", note: "The matriarch charges across the garden into a converging rocket volley." },
  { time: 37, title: "The field holds", note: "Survivors secure the clearings. Fallen bodies mark the broken encirclement." },
] as const;
export type Pose = "idle" | "run" | "strike" | "stagger" | "death" | "charge";
const POSES: Pose[] = ["idle", "run", "strike", "stagger", "death", "charge"];
export type Unit = { id: number; kind: number; x: number; y: number; z: number; pose: Pose; frame: number; direction: number; dead: boolean };
export type Assets = { field: CanvasImageSource; units: CanvasImageSource; brood: CanvasImageSource; props: CanvasImageSource };
export type Prop = { x: number; y: number; kind: number; radius: number };
export const PROPS: Prop[] = [
  ...[[22, 32], [58, 46], [13, 113], [22, 177], [10, 330], [36, 404], [12, 476], [80, 470], [145, 482], [571, 108], [618, 113], [626, 208], [602, 315], [632, 390], [605, 463], [562, 492], [493, 493], [207, 27], [389, 22], [348, 10]].map(([x, y]) => ({ x: x!, y: y!, kind: 0, radius: 15 })),
  ...[[286, 129], [319, 123], [349, 128], [344, 399], [374, 392], [406, 386], [487, 286], [516, 280]].map(([x, y]) => ({ x: x!, y: y!, kind: 1, radius: 18 })),
  ...[[191, 119], [221, 351], [449, 187], [520, 411], [159, 326], [420, 457], [381, 240]].map(([x, y]) => ({ x: x!, y: y!, kind: 2, radius: 12 })),
  ...[[154, 68], [167, 80], [465, 456], [483, 449]].map(([x, y]) => ({ x: x!, y: y!, kind: 3, radius: 15 })),
  { x: 66, y: 275, kind: 4, radius: 20 }, { x: 564, y: 216, kind: 4, radius: 20 },
];
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => {
  const n = clamp(v); return n * n * (3 - 2 * n);
};
const mix = (a: number, b: number, p: number) => a + (b - a) * ease(p);
const hash = (n: number) => ((n * 127 + 91) % 257) / 257;
export const project = (x: number, y: number, z = 0) => ({ x: Math.round(x), y: Math.round(12 + y * 0.66 - z) });
export function chapterAt(time: number) {
  return CHAPTERS.findLast((c) => time >= c.time) ?? CHAPTERS[0];
}
/** Enforce prop footprints in world coordinates, independent from drawing order. */
function outsideCover(x: number, y: number, clearance = 7) {
  for (let pass = 0; pass < 8; pass++) {
    for (const p of PROPS) {
      const dx = x - p.x;
      const dy = y - p.y;
      const distance = Math.hypot(dx, dy);
      const safe = p.radius + clearance;
      if (distance < safe) {
        const angle = distance > 0.01 ? Math.atan2(dy, dx) : 0;
        x = p.x + Math.cos(angle) * safe;
        y = p.y + Math.sin(angle) * safe;
      }
    }
  }
  return { x, y };
}
const CENTERS = [[333, 79], [282, 220], [377, 333], [306, 443]] as const;
function position(id: number, time: number) {
  const team = id >= 44 ? 1 : 0;
  const i = id % 44;
  const group = i % 4;
  const rank = Math.floor(i / 4);
  const [cx, cy] = CENTERS[group]!;
  const ranged = team ? rank >= 8 : rank >= 4;
  const startX = team ? 503 + rank % 3 * 24 : 79 + rank % 3 * 25;
  const startY = 57 + group * 119 + (rank - 5) * 7;
  const theta = rank * 2.4 + group * 0.9; const radius = 13 + rank % 4 * 8;
  let endX = cx + (team ? 1 : -1) * (ranged ? 53 + rank % 4 * 11 : 11) + Math.cos(theta) * radius;
  let endY = cy + Math.sin(theta) * radius + (rank % 3 - 1) * 13;
  // Northern rifle squad loops over the wall, then attacks southwards from its rear.
  if (!team && group === 0 && ranged) {
    endX += ease((time - 14) / 8) * 83; endY -= ease((time - 14) / 8) * 28;
  }
  // Southern brood pursues through the eastern gap instead of marching in a row.
  if (team && group === 2 && !ranged) {
    endX -= ease((time - 25) / 4) * 42; endY += ease((time - 25) / 4) * 19;
  }
  const approach = ease((time - rank * 0.1) / (8 + group * 0.35));
  let x = startX + (endX - startX) * approach;
  let y = startY + (endY - startY) * approach + Math.sin(approach * Math.PI) * (group % 2 ? -28 : 24);
  if (time > 8 && time < 37) {
    x += Math.cos(time * 0.9 + id * 2) * (ranged ? 3 : 8); y += Math.sin(time * 0.65 + id * 1.3) * (ranged ? 3 : 9);
  }
  if (time > 37 && !team) {
    x += ease((time - 37) / 5) * 57; y += ease((time - 37) / 5) * (240 - cy) * 0.06;
  }
  return outsideCover(x, y);
}
function direction(dx: number, dy: number) {
  return Math.abs(dy) > Math.abs(dx) * 0.8 ? dy > 0 ? 1 : 3 : dx > 0 ? 0 : 2;
}
export function unitsAt(time: number): Unit[] {
  const t = Math.max(0, Math.min(DURATION, time)); const result: Unit[] = [];
  for (let id = 0; id < 88; id++) {
    const team = id >= 44;
    const i = id % 44;
    const rank = Math.floor(i / 4);
    const group = i % 4;
    const kind = team ? rank >= 8 ? 5 : 4 : rank < 4 ? 1 : rank >= 9 ? 2 : 0;
    const deathAt = team ? i % 5 === 0 ? 12.4 + i * 0.11 : group === 2 && rank < 5 ? 23.65 + rank * 0.05 : 34.7 + i * 0.041 : i % 13 === 3 ? 16.2 + group * 0.22 : i === 21 ? 31 : 100;
    const dead = t >= deathAt;
    const point = position(id, Math.min(t, deathAt));
    const before = position(id, Math.max(0, Math.min(t, deathAt) - 0.08));
    const cycle = (t + id * 0.181) % (kind === 2 ? 2.7 : 1.8);
    let pose: Pose = t < 8.4 || (!team && group === 0 && rank >= 4 && t > 14 && t < 22) || (t > 37 && t < 42 && !team) ? "run" : t >= 42 ? "idle" : cycle < 0.62 ? "strike" : "idle";
    let frame = pose === "strike" ? Math.min(7, Math.floor(cycle * 13)) : Math.floor(t * 9 + id) % 8;
    let z = 0;
    if (!dead && team && group === 2 && t > 23.65 && t < 24.5) {
      pose = "stagger";
      frame = Math.min(7, Math.floor((t - 23.65) * 10));
      point.x += Math.sin((t - 23.65) / 0.85 * Math.PI) * 14;
      z = Math.sin((t - 23.65) / 0.85 * Math.PI) * 5;
      Object.assign(point, outsideCover(point.x, point.y));
    }
    if (dead) {
      pose = "death";
      frame = Math.min(7, Math.floor((t - deathAt) * 10));
      z = 0;
    }
    const moving = pose === "run";
    const face = moving ? direction(point.x - before.x, point.y - before.y) : direction((team ? -1 : 1) * 45, Math.sin(id * 2.1) * 61);
    result.push({ id, kind, ...point, z, pose, frame, direction: face, dead });
  }
  for (const u of result) {
    if (u.dead || u.pose === "run") {
      continue;
    }
    const enemies = result.filter((v) => !v.dead && (v.id >= 44) !== (u.id >= 44));
    const target = enemies.sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y))[0];
    if (target) {
      u.direction = direction(target.x - u.x, target.y - u.y);
    }
  }
  const hero = outsideCover(mix(159, 272, t / 8) + mix(0, 76, (t - 21.8) / 1.85), mix(398, 346, t / 8) + mix(0, -13, (t - 21.8) / 1.85));
  const flight = clamp((t - 21.8) / 1.85);
  result.push({ id: 88, kind: 3, ...hero, z: Math.sin(flight * Math.PI) * 43, pose: t < 8 ? "run" : t < 21 ? "idle" : t < 21.8 ? "strike" : t < 23.65 ? "charge" : t < 25 ? "strike" : t < 37 ? "idle" : t < 42 ? "run" : "idle", frame: t >= 21 && t < 21.8 ? Math.floor((t - 21) * 3) : t >= 23.65 && t < 25 ? Math.min(7, 3 + Math.floor((t - 23.65) * 5)) : Math.floor(t * 8) % 8, direction: 0, dead: false });
  return result;
}
export function queenAt(t: number) {
  const x = t < 29 ? mix(547, 467, t / 12) : t < 31.1 ? mix(467, 287, (t - 29) / 2.1) : mix(287, 318, (t - 31.1) / 3);
  const y = t < 29 ? mix(197, 281, t / 12) : mix(281, 325, (t - 29) / 2.1);
  return { ...outsideCover(x, y, 20), dead: t >= 35.2 };
}
function pixelDisc(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, ratio = 1) {
  ctx.fillStyle = color; const r = Math.round(radius);
  for (let yy = -r; yy <= r; yy++) {
    const w = Math.floor(Math.sqrt(r * r - yy * yy)); ctx.fillRect(Math.round(x - w), Math.round(y + yy * ratio), w * 2 + 1, 1);
  }
}
function burst(ctx: CanvasRenderingContext2D, x: number, y: number, age: number, seed: number, violet = false) {
  if (age < 0 || age > 1.4) {
    return;
  }
  for (let i = 0; i < 16; i++) {
    const a = hash(i * 3 + seed) * Math.PI * 2; const speed = 12 + hash(i * 7 + seed) * 29;
    const xx = Math.round(x + Math.cos(a) * age * speed); const yy = Math.round(y + Math.sin(a) * age * speed * 0.5 - 20 * age + 22 * age * age);
    const r = Math.max(1, Math.round((1 - age / 1.4) * (2 + hash(i) * 3)));
    ctx.fillStyle = age < 0.15 ? "#fff0b1" : violet ? i % 2 ? "#9e9ab8" : "#706982" : age < 0.4 ? "#ddaa62" : i % 2 ? "#a6a887" : "#6e826d";
    ctx.fillRect(xx - r, yy, r * 2, r); ctx.fillRect(xx - r + 1, yy - 2, r, r * 2);
  }
}
function drawUnit(ctx: CanvasRenderingContext2D, assets: Assets, u: Unit) {
  const row = (u.kind * 6 + POSES.indexOf(u.pose)) * 4 + u.direction; const p = project(u.x, u.y, u.z);
  ctx.drawImage(assets.units, u.frame * 32, row * 32, 32, 32, p.x - 16, p.y - 27, 32, 32);
}
export function renderBattle(ctx: CanvasRenderingContext2D, assets: Assets, time: number) {
  const t = Math.max(0, Math.min(DURATION, time));
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 640, 360);
  ctx.drawImage(assets.field, 0, 0);
  const units = unitsAt(t);
  const queen = queenAt(t);
  const qp = project(queen.x, queen.y);
  // Ground effects precede all upright geometry; projected shadows anchor every footpoint.
  for (let i = 0; i < 7; i++) {
    const impact = 16 + i * 0.22; const p = project(225 + i % 3 * 34, 132 + Math.floor(i / 3) * 95);
    if (t > impact) {
      pixelDisc(ctx, p.x, p.y, 10, "#747d62", 0.5); pixelDisc(ctx, p.x, p.y, 6, "#67705c", 0.45);
    }
  }
  if (t > 23.65) {
    const p = project(348, 333); pixelDisc(ctx, p.x, p.y, 18, "#767c62", 0.5);
  }
  for (const u of units) {
    const p = project(u.x, u.y); pixelDisc(ctx, p.x, p.y, u.kind > 3 ? 8 : 5, u.dead ? "#768264" : "#62775f", 0.35);
  }
  for (const p of PROPS) {
    const s = project(p.x, p.y); pixelDisc(ctx, s.x + 3, s.y, p.kind === 0 ? 18 : p.radius, "#61765d", 0.4);
  }
  pixelDisc(ctx, qp.x, qp.y, 27, "#62705d", 0.4);
  for (const u of units.filter((u) => u.dead)) {
    drawUnit(ctx, assets, u);
  }
  const drawQueen = () => {
    ctx.save();
    ctx.translate(qp.x, qp.y);
    ctx.scale(-1, queen.dead ? 0.55 : 1);
    ctx.drawImage(assets.brood, (queen.dead ? 7 : Math.floor(t * (t > 29 && t < 31 ? 12 : 6)) % 8) * 64, 0, 64, 64, -32, -50, 64, 64); ctx.restore();
  };
  const ordered = [
    ...units.filter((u) => !u.dead).map((u) => ({ y: u.y, draw: () => drawUnit(ctx, assets, u) })),
    ...PROPS.map((p) => ({ y: p.y, draw: () => {
      const s = project(p.x, p.y); ctx.drawImage(assets.props, p.kind * 64, 0, 64, 80, s.x - 32, s.y - 68, 64, 80);
    } })),
    { y: queen.y, draw: drawQueen },
  ].sort((a, b) => a.y - b.y);
  for (const item of ordered) {
    item.draw();
  }
  // Bullets connect actual living opposing footpoints rather than arbitrary screen positions.
  if (t > 8 && t < 35) {
    for (const u of units.filter((u) => u.kind === 0 && !u.dead && u.pose === "strike" && u.frame === 3)) {
      const target = units.filter((v) => v.kind >= 4 && !v.dead).sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y))[0];
      if (!target) {
        continue;
      }
      const a = project(u.x, u.y, 10); const b = project(target.x, target.y, 5);
      ctx.strokeStyle = "#eadcaf";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.fillStyle = "#fff3c2";
      ctx.fillRect(b.x - 1, b.y - 1, 3, 2);
    }
  }
  for (let i = 0; i < 7; i++) {
    const start = 13.6 + i * 0.22;
    const end = 16 + i * 0.22;
    const target = project(225 + i % 3 * 34, 132 + Math.floor(i / 3) * 95);
    if (t >= start && t < end) {
      const p = (t - start) / (end - start);
      const spitter = unitsAt(start).filter((u) => u.kind === 5)[i]!;
      const source = project(spitter.x, spitter.y, 9);
      const x = source.x + (target.x - source.x) * p;
      const y = source.y + (target.y - source.y) * p - Math.sin(p * Math.PI) * 53;
      pixelDisc(ctx, x + 3, y - 3, 2, "#887e9d");
      pixelDisc(ctx, x, y, 3, "#d5a6bc");
      ctx.fillStyle = "#f8dbc7";
      ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
    }
    burst(ctx, target.x, target.y, t - end, i + 10, true);
  }
  if (t > 21.8 && t < 23.65) {
    const hero = units[88]!; const p = project(hero.x, hero.y, hero.z);
    for (let k = 0; k < 5; k++) {
      ctx.fillStyle = k < 2 ? "#f6d997" : "#b78754"; ctx.fillRect(p.x - 8 - k * 2, p.y - 7 + k * 3, 3, 2);
    }
  }
  const hp = project(348, 333); burst(ctx, hp.x, hp.y, t - 23.65, 39);
  if (t > 23.65 && t < 24.8) {
    const p = (t - 23.65) / 1.15; for (let i = 0; i < 32; i++) {
      const a = i / 32 * Math.PI * 2;
      ctx.fillStyle = i % 2 ? "#c4bb88" : "#9f9d71";
      ctx.fillRect(Math.round(hp.x + Math.cos(a) * p * 64), Math.round(hp.y + Math.sin(a) * p * 40), 3, 1);
    }
  }
  // Three rocketeer teams converge on the moving queen, each on its own arc.
  for (let i = 0; i < 8; i++) {
    const start = 32.3 + i * 0.18, end = 34.8 + i * 0.1; const source = units.filter((u) => u.kind === 2 && !u.dead)[i % 8];
    const impact = queenAt(end); const target = project(impact.x, impact.y, 17);
    if (source && t > start && t < end) {
      const p = (t - start) / (end - start);
      const s = project(source.x, source.y, 14);
      const x = s.x + (target.x - s.x) * p, y = s.y + (target.y - s.y) * p - Math.sin(p * Math.PI) * 29;
      ctx.fillStyle = "#f4e4b2";
      ctx.fillRect(Math.round(x) - 3, Math.round(y), 6, 2);
      for (let k = 1; k < 5; k++) {
        ctx.fillStyle = "#8f987b"; ctx.fillRect(Math.round(x) - (target.x > s.x ? k * 4 : -k * 4), Math.round(y) + k, 2, 2);
      }
    }
    burst(ctx, target.x + i % 3 * 4, target.y, t - end, i * 5);
  }
  if (t > 35.2) {
    for (let i = 0; i < 9; i++) {
      const age = Math.min(1, t - 35.2), x = qp.x + (hash(i) - 0.5) * 58 * age, y = qp.y - 15 - 31 * age + 45 * age * age + i % 3 * 4;
      ctx.fillStyle = i % 2 ? "#7187b5" : "#454d77";
      ctx.fillRect(Math.round(x), Math.round(y), 4, 2);
    }
  }
}
