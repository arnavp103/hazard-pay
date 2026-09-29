/** Deterministic elevated battlefield; coordinates are ground-space, never screen-space. */
export const DURATION = 42;
export const TICK = 24;
export const clamp = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, n));
export const ease = (n: number) => {
  const v = clamp(n);
  return v * v * (3 - 2 * v);
};
export const ramp = (time: number, from: number, to: number) => ease((time - from) / (to - from));
export const chapters = [
  { at: 0, name: "The scattered company", detail: "Six companies cross the drowned monastery from different directions." },
  { at: 8, name: "The crescent line", detail: "Shield captains send a connected pulse through three fronts." },
  { at: 17, name: "Lantern rain", detail: "Rear companies launch a staggered, ground-targeted bombardment." },
  { at: 26, name: "The drowned choir", detail: "Bell-keepers call a radial tide; the scattered company braces." },
  { at: 34, name: "Close the circle", detail: "Northern and southern flanks fold inward around the surviving choir." },
] as const;
export function chapterAt(time: number) {
  return chapters.findLast((chapter) => time >= chapter.at) ?? chapters[0];
}
export interface Point { x: number; y: number }
export interface Obstacle extends Point { radius: number; kind: "ruin" | "pillar" | "tree"; height: number }
export const obstacles: Obstacle[] = [
  { x: 745, y: 330, radius: 96, kind: "ruin", height: 49 },
  { x: 900, y: 940, radius: 100, kind: "ruin", height: 58 },
  { x: 555, y: 725, radius: 31, kind: "pillar", height: 77 },
  { x: 1060, y: 550, radius: 35, kind: "pillar", height: 91 },
  { x: 600, y: 1060, radius: 24, kind: "pillar", height: 58 },
  { x: 1130, y: 180, radius: 28, kind: "pillar", height: 70 },
  { x: 200, y: 1100, radius: 38, kind: "tree", height: 86 },
  { x: 1420, y: 1030, radius: 42, kind: "tree", height: 90 },
];
export function project(point: Point, height = 0) {
  return { x: 70 + point.x * 0.91 + point.y * 0.014, y: 52 + point.y * 0.60 - height };
}
export function groundClear(point: Point, margin = 11) {
  return obstacles.every((o) => Math.hypot(point.x - o.x, point.y - o.y) >= o.radius + margin - 0.01);
}
export const sectors = [{ x: 520, y: 210 }, { x: 1060, y: 360 }, { x: 760, y: 655 }, { x: 470, y: 880 }, { x: 1100, y: 1080 }, { x: 1230, y: 715 }];
export interface Soldier { id: number; side: "ivory" | "tide"; kind: number; start: Point; scale: number; sector: number }
export const soldiers: Soldier[] = Array.from({ length: 88 }, (_, id) => {
  const n = id % 44;
  const side = id < 44 ? "ivory" : "tide";
  const sector = Math.floor(n / 8);
  const centre = sectors[sector]!;
  const angle = [-0.15, 0.80, 0.22, -0.65, -0.75, 1.18][sector]!;
  const direction = side === "ivory" ? -1 : 1;
  const rank = n % 8;
  const lateral = (rank % 4 - 1.5) * 34;
  const reach = 215 + Math.floor(rank / 4) * 65;
  const start = { x: centre.x + Math.cos(angle) * direction * reach - Math.sin(angle) * lateral, y: centre.y + Math.sin(angle) * direction * reach + Math.cos(angle) * lateral };
  start.x = clamp(start.x, 85, 1500);
  start.y = clamp(start.y, 80, 1220);
  for (const o of obstacles) {
    const d = Math.hypot(start.x - o.x, start.y - o.y);
    if (d < o.radius + 20) {
      const a = Math.atan2(start.y - o.y, start.x - o.x);
      start.x = o.x + Math.cos(a) * (o.radius + 22);
      start.y = o.y + Math.sin(a) * (o.radius + 22);
    }
  }
  return { id, side, sector, kind: n === 22 ? 3 : n % 4 === 0 ? 1 : n % 7 === 0 ? 2 : 0, start, scale: n === 22 ? side === "ivory" ? 1.48 : 2.05 : 0.94 + (n % 3) * 0.045 };
});
export interface Pose extends Point { dx: number; dy: number; moving: number; hp: number; attack: number; target: number; hit: number; died: number }
export interface Projectile { from: Point; to: Point; progress: number; side: Soldier["side"]; volley: boolean }
export interface Battle { units: Pose[]; projectiles: Projectile[] }
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
function clearSegment(a: Point, b: Point) {
  const length = Math.max(1, distance(a, b));
  const count = Math.ceil(length / 13);
  for (let s = 1; s <= count; s++) {
    const k = s / count;
    if (!groundClear({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }, 17)) {
      return false;
    }
  }
  return true;
}
/** Visibility graph around physical footprints. Units can actually take either flank. */
export function route(start: Point, end: Point): Point[] {
  if (!groundClear(end, 18)) {
    for (const o of obstacles) {
      const d = distance(end, o);
      if (d < o.radius + 19) {
        const a = Math.atan2(end.y - o.y, end.x - o.x);
        end = { x: o.x + Math.cos(a) * (o.radius + 21), y: o.y + Math.sin(a) * (o.radius + 21) };
      }
    }
  }
  if (clearSegment(start, end)) {
    return [end];
  }
  const nodes = [start, end, ...obstacles.flatMap((o) => Array.from({ length: 10 }, (_, i) => ({ x: o.x + Math.cos(i * Math.PI / 5) * (o.radius + 34), y: o.y + Math.sin(i * Math.PI / 5) * (o.radius + 34) }))).filter((p) => groundClear(p, 17))];
  const costs = nodes.map(() => Infinity);
  costs[0] = 0;
  const prev = nodes.map(() => -1);
  const open = new Set(nodes.map((_, i) => i));
  while (open.size) {
    let u = -1;
    for (const i of open) {
      if (u < 0 || costs[i]! < costs[u]!) {
        u = i;
      }
    }
    if (u === 1 || !Number.isFinite(costs[u]!)) {
      break;
    }
    open.delete(u);
    for (const v of open) {
      const d = costs[u]! + distance(nodes[u]!, nodes[v]!);
      if (d < costs[v]! && clearSegment(nodes[u]!, nodes[v]!)) {
        costs[v] = d;
        prev[v] = u;
      }
    }
  }
  if (prev[1]! < 0) {
    return [start];
  }
  const result: Point[] = [];
  let cursor = 1;
  while (cursor > 0) {
    result.unshift(nodes[cursor]!);
    cursor = prev[cursor]!;
  }
  return result;
}
let history: Pose[][] | undefined;
function buildBattle() {
  const units: Pose[] = soldiers.map((s) => ({ ...s.start, dx: s.side === "ivory" ? 1 : -1, dy: 0, moving: 0, hp: s.kind === 3 ? 28 : 8.5, attack: 0, target: -1, hit: -10, died: -1 }));
  const paths: Point[][] = soldiers.map((s) => route(s.start, { x: sectors[s.sector]!.x + Math.sin(s.id * 6) * 70, y: sectors[s.sector]!.y + Math.cos(s.id * 7) * 75 }));
  const results: Pose[][] = [units.map((p) => ({ ...p }))];
  for (let tick = 1; tick <= DURATION * TICK; tick++) {
    const time = tick / TICK;
    const before = units.map((p) => ({ ...p }));
    for (const s of soldiers) {
      const p = units[s.id]!;
      if (p.hp <= 0) {
        continue;
      }
      let target = -1;
      let nearest = Infinity;
      for (const foe of soldiers) {
        if (foe.side === s.side || before[foe.id]!.hp <= 0) {
          continue;
        }
        const d = distance(p, before[foe.id]!);
        const priority = d + (foe.sector !== s.sector && time < 33 ? 600 : 0);
        if (priority < nearest) {
          nearest = priority;
          target = foe.id;
        }
      }
      p.target = target;
      p.attack = 0;
      p.moving = 0;
      if (target < 0) {
        continue;
      }
      const enemy = before[target]!;
      nearest = distance(p, enemy);
      const reach = s.kind === 1 || s.kind === 2 ? 170 : s.kind === 3 && s.side === "tide" ? 68 : 36;
      const cadence = (time + s.id * 0.213) % (s.kind === 1 ? 2.7 : 1.85);
      if (nearest < reach && clearSegment(p, enemy)) {
        p.dx = (enemy.x - p.x) / Math.max(nearest, 1);
        p.dy = (enemy.y - p.y) / Math.max(nearest, 1);
        p.attack = ramp(cadence, 0.48, 0.78) * (1 - ramp(cadence, 0.82, 1.3));
        if (cadence >= 0.80 && cadence < 0.80 + 1 / TICK && time > 5) {
          const victim = units[target]!;
          victim.hp -= (time > 33 && s.side === "ivory" ? 1.35 : 0.53);
          victim.hit = time;
        }
      } else {
        if (tick % 30 === s.id % 30 && time > 5) {
          let end = { x: enemy.x, y: enemy.y };
          // Individual approach offsets avoid collapsing whole squads onto one waypoint.
          const approach = Math.atan2(p.y - enemy.y, p.x - enemy.x) + Math.sin(s.id * 4) * 0.3;
          end = { x: enemy.x + Math.cos(approach) * reach * 0.72, y: enemy.y + Math.sin(approach) * reach * 0.72 };
          paths[s.id] = route(p, end);
        }
        const path = paths[s.id]!;
        while (path.length > 1 && distance(p, path[0]!) < 10) {
          path.shift();
        } const goal = path[0] ?? enemy;
        const d = distance(p, goal);
        const speed = (s.kind === 3 ? 46 : s.kind === 1 ? 38 : 56) * (time > 34 ? 1.22 : 1);
        if (d > 5) {
          p.dx = (goal.x - p.x) / d;
          p.dy = (goal.y - p.y) / d;
          p.x += p.dx * Math.min(d, speed / TICK);
          p.y += p.dy * Math.min(d, speed / TICK);
          p.moving = 1;
        }
      }
      // Captain's authored overhead cut lands on the actual adjacent bell-keeper.
      if (s.id === 22 && tick === 824 && units[66]!.hp > 0 && distance(p, units[66]!) < 90) {
        units[66]!.hp -= 5;
        units[66]!.hit = time;
      }
      // Local separation and obstacle projection preserve independently moving footprints.
      for (const other of before) {
        if (other === before[s.id] || other.hp <= 0) {
          continue;
        }
        const d = distance(p, other);
        const gap = 30;
        if (d > 0 && d < gap) {
          p.x += (p.x - other.x) / d * (gap - d) * 0.13;
          p.y += (p.y - other.y) / d * (gap - d) * 0.13;
        }
      }
      for (const o of obstacles) {
        const d = distance(p, o);
        if (d < o.radius + 12) {
          const a = Math.atan2(p.y - o.y, p.x - o.x);
          p.x = o.x + Math.cos(a) * (o.radius + 12);
          p.y = o.y + Math.sin(a) * (o.radius + 12);
        }
      }
      p.x = clamp(p.x, 75, 1510);
      p.y = clamp(p.y, 75, 1220);
      if (s.side === "tide" && tick === 12 * TICK + s.id % 11 * 3) {
        p.hp -= 1.3;
        p.hit = time;
      }
      if (s.side === "tide" && tick === 21 * TICK + s.id % 9 * 5) {
        p.hp -= 2.6;
        p.hit = time;
      }
      if (s.side === "ivory" && tick === 29 * TICK + s.id % 10 * 4) {
        p.hp -= 2.2;
        p.hit = time;
      }
      if (s.side === "tide" && s.kind !== 3 && time > 37) {
        p.hp -= 0.025;
      }
    }
    for (const p of units) {
      if (p.hp <= 0 && p.died < 0) {
        p.died = time;
        p.moving = 0;
        p.attack = 0;
      }
    }
    results.push(units.map((p) => ({ ...p })));
  }
  return results;
}
export function battleAt(time: number): Battle {
  history ??= buildBattle();
  const t = clamp(time, 0, DURATION) * TICK;
  const index = Math.floor(t);
  const f = t - index;
  const a = history[index]!;
  const b = history[Math.min(index + 1, history.length - 1)]!;
  const units = a.map((p, id) => ({ ...p, x: p.x + (b[id]!.x - p.x) * f, y: p.y + (b[id]!.y - p.y) * f }));
  const projectiles: Projectile[] = [];
  for (const s of soldiers) {
    const p = units[s.id]!;
    if (p.hp <= 0 || p.target < 0 || (s.kind !== 1 && s.kind !== 2)) {
      continue;
    }
    const flight = (time + s.id * 0.213) % 2.7 - 0.82;
    if (flight >= 0 && flight < 0.65 && !p.moving) {
      projectiles.push({ from: p, to: units[p.target]!, progress: flight / 0.65, side: s.side, volley: false });
    }
  }
  // A full-company launch has independent ground origins and target points, plus height.
  for (let n = 0; n < 32; n++) {
    const launch = 18.4 + n * 0.052;
    const progress = (time - launch) / 2.4;
    if (progress < 0 || progress > 1) {
      continue;
    }
    const source = history[Math.floor(launch * TICK)]![n % 44]!;
    const target = history[Math.floor(21 * TICK)]![44 + n % 44]!;
    projectiles.push({ from: source, to: target, progress, side: "ivory", volley: true });
  }
  return { units, projectiles };
}
