/** Emberwatch: a deterministic, seekable 36-second native-pixel encounter. */
export const DURATION = 36;
export const CHAPTERS = [
  { time: 0, title: "The green line", note: "The salvage crew enters the abandoned aqueduct." },
  { time: 6, title: "Contact", note: "Breakers meet the brood while the rifle line opens fire." },
  { time: 11, title: "Spore rain", note: "The brood artillery fractures the front. The crew falls back." },
  { time: 17, title: "Hammerfall", note: "Captain Rook clears the breach with a rocket-assisted plunge." },
  { time: 24, title: "The brood engine", note: "A coordinated rocket volley stops the charging matriarch." },
  { time: 30, title: "A quiet railway", note: "The surviving crew regroups among the spent shells." },
] as const;
export type Pose = "idle" | "run" | "strike" | "stagger" | "death" | "charge";
const POSES: Pose[] = ["idle", "run", "strike", "stagger", "death", "charge"];
export type Unit = { id: number;
  kind: number;
  x: number;
  y: number;
  pose: Pose;
  frame: number;
  flip: boolean;
  dead: boolean; };
export type Assets = { field: CanvasImageSource;
  units: CanvasImageSource;
  brood: CanvasImageSource; };
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => {
  const n = clamp(v);
  return n * n * (3 - 2 * n);
};
const mix = (a: number, b: number, p: number) => a + (b - a) * ease(p);
const hash = (n: number) => ((n * 127 + 91) % 257) / 257;
export function chapterAt(time: number) {
  return CHAPTERS.findLast((c) => time >= c.time) ?? CHAPTERS[0];
}
export function unitsAt(t: number): Unit[] {
  const units: Unit[] = [];
  for (let team = 0;
    team < 2;
    team++) {
    for (let i = 0;
      i < 23;
      i++) {
      const id = team * 23 + i;
      const lane = i % 3;
      const rank = Math.floor(i / 3);
      const kind = team ? (rank >= 5 && rank % 2 ? 5 : 4) : (rank < 2 ? 1 : rank === 6 ? 2 : 0);
      const y = 164 + lane * 51 + Math.floor(hash(i * 3) * 7) + rank % 2 * 8;
      const rear = Math.floor(i / 3);
      const startX = team ? 473 + rear * 21 : 73 + rear * 20;
      const front = [286, 338, 306][lane]!;
      const contactX = team ? (kind === 5 ? 474 + rear * 5 : front + 42 + rear * 24) : (kind === 1 ? front - rear % 2 * 20 : kind === 2 ? 112 + rear * 15 : front - 62 - rear * 17);
      let x = mix(startX, contactX, (t - i * 0.052) / 6);
      let yy = y;
      let pose: Pose = t < 5.8 ? "run" : "strike";
      let frame = Math.floor(t * (kind === 2 ? 7 : 10) + i * 2.7) % 8;
      const cycle = (t + i * 0.217) % (team ? 1.72 : kind === 2 ? 2.8 : 1.36);
      if (t > 6 && t < 30) {
        x += Math.round((cycle < 0.22 ? cycle / 0.22 : Math.max(0, 1 - (cycle - 0.22) / 0.35)) * (team ? -7 : 5));
        pose = cycle > 0.68 ? "idle" : "strike";
        frame = Math.min(7, Math.floor(cycle / 0.085));
        if ((t + i * 0.31) % 3.2 < 0.19) {
          pose = "stagger";
          frame = 2;
        }
      }
      if (!team && t > 12.4 && t < 17.3) {
        const retreat = ease((t - 12.4 - lane * 0.11) / 0.5) * (1 - ease((t - 16) / 1.3));
        x -= retreat * (kind === 1 ? 29 : 17);
        if (t < 13.3) {
          pose = "stagger";
          frame = Math.min(7, Math.floor((t - 12.4) * 9));
        }
      }
      if (team && t > 20.15 && t < 23.5) {
        const dt = t - 20.15 - rear * 0.035;
        x += ease(dt / 0.25) * (1 - ease((dt - 1.1) / 2)) * (39 - rear * 3);
        if (dt < 0.9) {
          pose = "stagger";
          frame = Math.min(7, Math.max(0, Math.floor(dt * 8)));
        }
      }
      if (!team && kind === 1 && t > 25 && t < 27) {
        const p = clamp((t - 25) / 1.5);
        x -= Math.round(4 * p * (1 - p) * 36);
        yy -= Math.round(4 * p * (1 - p) * 21);
        pose = "stagger";
        frame = Math.min(7, Math.floor(p * 8));
      }
      const deathAt = team ? (i % 4 === 0 ? 8.5 + i * 0.14 : i % 3 === 0 ? 20.25 + i * 0.04 : 28.6 + i * 0.06) : (i === 6 ? 12.6 : i === 12 ? 25.6 : 100);
      const dead = t > deathAt;
      if (dead) {
        x = contactX;
        pose = "death";
        frame = Math.min(7, Math.floor((t - deathAt) * 10));
      }
      if (t > 29.8 && !dead) {
        x += ease((t - 29.8) / 4) * 82;
        pose = t < 34.2 ? "run" : "idle";
      }
      units.push({ id, kind, x: Math.round(x), y: Math.round(yy), pose, frame, flip: Boolean(team), dead });
    }
  }
  let hx = mix(112, 243, t / 6);
  let hy = 267;
  let pose: Pose = t < 6 ? "run" : "idle";
  let frame = Math.floor(t * 10) % 8;
  if (t >= 17 && t < 18) {
    pose = "strike";
    frame = Math.min(2, Math.floor((t - 17) * 3));
  }
  if (t >= 18 && t < 20.15) {
    const p = (t - 18) / 2.15;
    hx = mix(243, 350, p);
    hy = 267 - 92 * Math.sin(p * Math.PI);
    pose = "charge";
  }
  if (t >= 20.15) {
    hx = 350;
    pose = "strike";
    frame = Math.min(7, Math.floor((t - 20.15) * 7) + 3);
  }
  if (t >= 22) {
    pose = t < 29.8 ? "strike" : t < 33.5 ? "run" : "idle";
    hx = mix(350, 430, (t - 29.8) / 3.5);
    frame = Math.floor(t * 7) % 8;
  }
  units.push({ id: 46, kind: 3, x: Math.round(hx), y: Math.round(hy), pose, frame, flip: false, dead: false });
  return units;
}
function pixelDisc(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
  ctx.fillStyle = color;
  const r = Math.round(radius);
  for (let yy = -r;
    yy <= r;
    yy++) {
    const w = Math.floor(Math.sqrt(r * r - yy * yy));
    ctx.fillRect(Math.round(x - w), Math.round(y + yy), w * 2 + 1, 1);
  }
}
function burst(ctx: CanvasRenderingContext2D, x: number, y: number, age: number, seed: number, purple = false, big = false) {
  if (age < 0 || age > 1.6) { return; }
  const size = big ? 1.8 : 1;
  for (let i = 0;
    i < 19;
    i++) {
    const a = hash(i + seed) * Math.PI * 2;
    const speed = (10 + hash(i * 7 + seed) * 25) * size;
    const px = x + Math.cos(a) * age * speed;
    const py = y + Math.sin(a) * age * speed - 18 * age + 22 * age * age;
    const rad = (1 - age / 1.6) * (2 + hash(i * 3) * 4) * size;
    const color = age < 0.22 ? "#fff2ba" : purple ? (i % 2 ? "#a0abc8" : "#665a8c") : age < 0.55 ? "#e5aa56" : (i % 2 ? "#526151" : "#8e9670");
    ctx.fillStyle = color;
    const rr = Math.max(1, Math.round(rad));
    const xx = Math.round(px);
    const yy = Math.round(py);
    ctx.fillRect(xx - rr, yy - rr + 1, rr * 2, rr);
    ctx.fillRect(xx - rr + 2, yy - rr - 2, rr, rr * 2 + 1);
    ctx.fillRect(xx - rr - 2, yy, rr + 2, rr);
    if (age < 0.35) {
      ctx.fillStyle = "#fff2c3";
      ctx.fillRect(xx - 1, yy - 2, 3, 3);
    }
  }
}
function sprite(ctx: CanvasRenderingContext2D, assets: Assets, unit: Unit) {
  const row = unit.kind * 6 + POSES.indexOf(unit.pose);
  ctx.save();
  ctx.translate(unit.x, unit.y);
  if (unit.flip) { ctx.scale(-1, 1); }
  ctx.drawImage(assets.units, unit.frame * 64, row * 64, 64, 64, -32, -53, 64, 64);
  ctx.restore();
}
export function renderBattle(ctx: CanvasRenderingContext2D, assets: Assets, time: number) {
  const t = Math.max(0, Math.min(DURATION, time));
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 640, 360);
  ctx.save();
  const hit = [12.4, 20.15, 25.05, 28.65].find((at) => t >= at && t < at + 0.22);
  if (hit !== undefined) { ctx.translate(Math.floor(t * 51) % 3 - 1, Math.floor(t * 37) % 3 - 1); }
  ctx.drawImage(assets.field, 0, 0);
  for (let i = 0;
    i < 13;
    i++) {
    const x = Math.floor((i * 57 + t * (3 + i % 3)) % 680 - 20);
    const y = Math.floor(61 + (i * 29 + t * (4 + i % 2)) % 193);
    ctx.fillStyle = i % 3 ? "#a9b970" : "#d4b86c";
    ctx.fillRect(x, y, 3, 1);
    ctx.fillRect(x + 1, y - 1, 2, 1);
  }
  if (t > 12.4) {
    for (let i = 0;
      i < 3;
      i++) {
      pixelDisc(ctx, 267 + i * 23, 224 + i * 14, 12, "#5d6c57");
      ctx.fillStyle = "#3d5148";
      ctx.fillRect(263 + i * 23, 224 + i * 14, 9, 2);
    }
  }
  if (t > 20.15) {
    ctx.strokeStyle = "#435747";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(341, 260);
    ctx.lineTo(355, 254);
    ctx.lineTo(374, 256);
    ctx.lineTo(391, 266);
    ctx.stroke();
  }
  const units = unitsAt(t);
  for (const u of units) {
    ctx.fillStyle = u.dead ? "#51684f" : "#596f51";
    ctx.fillRect(u.x - (u.kind > 3 ? 18 : 9), u.y - 2, u.kind > 3 ? 31 : 19, 3);
  }
  const queenX = t < 24 ? mix(585, 516, t / 10) : t < 25.1 ? mix(516, 423, (t - 24) / 1.1) : t < 28.65 ? 423 : mix(423, 446, (t - 28.65) / 0.9);
  const queenY = 247 + (t > 28.65 ? ease((t - 28.65) / 0.8) * 16 : 0);
  const drawQueen = () => {
    ctx.save();
    ctx.translate(Math.round(queenX), Math.round(queenY));
    ctx.scale(-1, 1);
    if (t > 28.65) {
      ctx.globalAlpha = 0.75;
      ctx.scale(1, 0.68);
    }
    ctx.drawImage(assets.brood, (t > 28.65 ? 7 : Math.floor(t * 7) % 8) * 128, 0, 128, 128, -64, -99, 128, 128);
    ctx.restore();
  };
  let queenDrawn = false;
  for (const unit of units.sort((a, b) => a.y - b.y || a.id - b.id)) {
    if (!queenDrawn && unit.y > queenY - 4) {
      drawQueen();
      queenDrawn = true;
    }
    sprite(ctx, assets, unit);
  }
  if (!queenDrawn) { drawQueen(); }
  if (t > 6 && t < 29.5) {
    for (const u of units) {
      if (u.kind === 0 && !u.dead && u.pose === "strike" && u.frame === 3) {
        ctx.fillStyle = "#f6df99";
        ctx.fillRect(u.x + 26, u.y - 19, 30, 1);
        burst(ctx, 341 + u.id % 4 * 9, u.y - 17, 0.12, u.id);
      }
    }
  }
  for (let i = 0;
    i < 3;
    i++) {
    const start = 10.3 + i * 0.15;
    const end = 12.4 + i * 0.12;
    if (t >= start && t < end) {
      const p = (t - start) / (end - start);
      const x = 482 + (267 + i * 23 - 482) * p;
      const y = 205 + i * 7 - 102 * Math.sin(p * Math.PI);
      for (let k = 3;
        k > 0;
        k--) { pixelDisc(ctx, x + k * 5, y - k * 2, 2, "#8a8fac"); }
      pixelDisc(ctx, x, y, 4, "#d9a3a6");
      pixelDisc(ctx, x - 1, y - 1, 2, "#f3d6bd");
    }
    burst(ctx, 267 + i * 23, 221 + i * 14, t - end, i + 7, true, true);
  }
  if (t >= 18 && t < 20.15) {
    const hero = units.find((u) => u.id === 46)!;
    for (let i = 0;
      i < 8;
      i++) {
      ctx.fillStyle = i < 3 ? "#f9e5a0" : "#b67b49";
      ctx.fillRect(hero.x - 13 - i * 3, hero.y - 26 + i * 4, Math.max(1, 6 - i), 3);
    }
  }
  burst(ctx, 377, 252, t - 20.15, 25, false, true);
  if (t > 20.15 && t < 21.2) {
    const p = (t - 20.15) / 1.05;
    for (let i = 0;
      i < 40;
      i++) {
      const a = i / 40 * Math.PI * 2;
      ctx.fillStyle = i % 2 ? "#d0bd7c" : "#8c9b69";
      ctx.fillRect(Math.round(369 + Math.cos(a) * p * 67), Math.round(257 + Math.sin(a) * p * 18), 4, 2);
    }
  }
  for (let i = 0;
    i < 6;
    i++) {
    const start = 27 + i * 0.1;
    const end = 28.35 + i * 0.07;
    if (t >= start && t < end) {
      const p = (t - start) / (end - start);
      const x = 145 + p * 269;
      const y = 212 + i % 3 * 14 - Math.sin(p * Math.PI) * (25 + i * 4);
      ctx.fillStyle = "#e5c788";
      ctx.fillRect(Math.round(x), Math.round(y), 7, 2);
      ctx.fillStyle = "#f1e2b0";
      ctx.fillRect(Math.round(x - 4), Math.round(y), 4, 2);
      for (let k = 1;
        k < 6;
        k++) {
        ctx.fillStyle = k % 2 ? "#9f9c78" : "#75866c";
        ctx.fillRect(Math.round(x - k * 8), Math.round(y + k / 2), 3, 2);
      }
    }
    burst(ctx, 411 + i * 4, 213 + i % 3 * 13, t - end, i * 9, false, true);
  }
  if (t > 28.65) {
    for (let i = 0;
      i < 9;
      i++) {
      const age = Math.min(1.1, t - 28.65);
      const x = 433 + (hash(i) - 0.5) * 83 * age;
      const y = 219 - 50 * age + 61 * age * age + i % 3 * 9;
      ctx.fillStyle = i % 2 ? "#7589b5" : "#404967";
      ctx.fillRect(Math.round(x), Math.round(y), 6, 3);
    }
  }
  if (t > 32.5) {
    const height = Math.round(ease((t - 32.5) / 1.5) * 36);
    ctx.fillStyle = "#d3c498";
    ctx.fillRect(418, 258 - height, 1, height);
    if (height > 20) {
      ctx.fillStyle = "#bd714b";
      ctx.fillRect(419, 260 - height, 19, 10);
      ctx.fillStyle = "#ecd49a";
      ctx.fillRect(422, 263 - height, 4, 4);
    }
  }
  ctx.restore();
}
