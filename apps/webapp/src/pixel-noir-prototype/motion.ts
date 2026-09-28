/** Deterministic, stepped animation. Seconds enter here; the painter never owns time. */
export const ACTIONS = ["idle", "walk", "attack", "turn", "stagger"] as const;
export type Action = (typeof ACTIONS)[number];
export type View = "hero" | "crowd" | "lineup";
export type Point = [number, number];
export type Joint = [number, number, number];
export interface Pose {
  frame: number;
  facing: number;
  lean: number;
  bob: number;
  stride: number;
  lift: number;
  elbow: Joint;
  hand: Joint;
  otherHand: Joint;
  flash: number;
  phase: string;
  coat: number;
}
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export function poseAt(seconds: number, action: Action, facing = 0.12): Pose {
  const frame = Math.floor(Math.max(0, seconds) * 12 + 1e-7);
  const t = frame / 12;
  const cycle = t % 2.4;
  const p: Pose = { frame, facing, lean: 0, bob: Math.round(Math.sin(t * 2) * 0.7), stride: 0, lift: 0, elbow: [10, 0, 37], hand: [12, 10, 32], otherHand: [-11, 5, 33], flash: 0, phase: "HOLD / BREATHE", coat: Math.sin(t * 2) };
  if (action === "walk") {
    const a = t * Math.PI * 2;
    p.stride = Math.sin(a) * 13;
    p.lift = Math.cos(a);
    p.bob = Math.round(Math.abs(Math.cos(a)) * 2);
    p.lean = 3;
    p.elbow = [11, -p.stride * 0.25, 38];
    p.hand = [11, -p.stride * 0.55 + 5, 30];
    p.otherHand = [-11, p.stride * 0.55 + 4, 30];
    p.coat = -p.stride * 0.3;
    p.phase = Math.abs(p.stride) > 9 ? "CONTACT / WEIGHT" : "PASS / LIFT";
  }
  if (action === "attack") {
    if (cycle < 0.55) {
      const a = clamp(cycle / 0.45);
      p.lean = -5 * a;
      p.bob = -3 * a;
      p.elbow = [13, -8 * a, 40];
      p.hand = [10, mix(10, -3, a), mix(32, 48, a)];
      p.otherHand = [-12, 5, 41];
      p.stride = -4;
      p.phase = "01 / ANTICIPATION";
    } else if (cycle < 0.8) {
      p.lean = 8;
      p.bob = -3;
      p.elbow = [10, 15, 45];
      p.hand = [9, 33, 44];
      p.otherHand = [-12, 14, 43];
      p.stride = 12;
      p.flash = 1;
      p.coat = -7;
      p.phase = "02 / CONTACT · HOLD";
    } else if (cycle < 1.2) {
      const a = (cycle - 0.8) / 0.4;
      p.lean = mix(8, 3, a);
      p.elbow = [11, 15, 42];
      p.hand = [10, mix(33, 20, a), mix(44, 36, a)];
      p.stride = 8;
      p.coat = -4;
      p.phase = "03 / FOLLOW THROUGH";
    } else {
      const a = clamp((cycle - 1.2) / 0.55);
      p.lean = 3 * (1 - a);
      p.hand = [12, mix(20, 10, a), mix(36, 32, a)];
      p.phase = "04 / RECOVER";
    }
  }
  if (action === "turn") {
    p.facing = Math.floor(t * 1.4) * Math.PI / 4 + 0.12;
    p.phase = `FACING ${((Math.floor(t * 1.4) % 8) + 1).toString().padStart(2, "0")} / 08`;
  }
  if (action === "stagger") {
    const hit = Math.max(0, 1 - cycle / 0.9);
    p.lean = -12 * hit;
    p.bob = -6 * hit;
    p.elbow = [14, -4, 39];
    p.hand = [15, 8, 41 + hit * 8];
    p.otherHand = [-15, 1, 39 + hit * 6];
    p.stride = -9 * hit;
    p.coat = 7 * hit;
    p.phase = hit > 0.3 ? "IMPACT / BRACE" : "RECOVER / RESET";
  }
  return p;
}

export function project(x: number, y: number, z = 0): Point {
  return [512 + (x - y), 172 + (x + y) / 2 - z];
}
export type ActorKind = "medic" | "guard" | "raider" | "scout" | "bruiser";
export interface Actor { id: number; x: number; y: number; facing: number; action: Action; phase: number; kind: ActorKind }
/** Forty units follow deterministic patrol/engage/withdraw loops; no random calls or mutable sim. */
export function crowdAt(seconds: number): Actor[] {
  return Array.from({ length: 40 }, (_, id) => {
    const team = id < 20 ? 0 : 1;
    const row = Math.floor((id % 20) / 5);
    const col = id % 5;
    const phase = (seconds + id * 0.41) % 9;
    const walk = phase < 3.2 || phase > 6.5;
    const advance = phase < 3.2 ? phase * 5 : phase > 6.5 ? (9 - phase) * 6.4 : 16;
    const direction = team ? -1 : 1;
    const baseX = (team ? 90 : -55) + col * 47 + ((id * 37) % 29) - 14;
    let baseY = (team ? 70 : 202) + row * 48 + ((id * 19) % 35) - 17;
    // Choose a lane once from its anchor, not from live position: no boundary pops.
    // These are staged paths around the three fixed barriers, not collision AI.
    if (baseX > 165 && baseX < 257 && baseY > 137 && baseY < 204) { baseY -= 61; }
    if (baseX > -28 && baseX < 61 && baseY > 344) { baseY -= 27; }
    return {
      id,
      x: baseX + advance * direction,
      y: baseY - advance * direction,
      facing: (team ? 2.5 : -0.65) + (phase > 6.5 ? Math.PI : 0),
      action: walk ? "walk" : (id % 7 === 0 ? "stagger" : "attack"),
      phase: seconds + id * 0.41,
      kind: id === 7 || id === 27 ? "medic" : team ? (id % 4 === 0 ? "bruiser" : "raider") : (id % 4 === 0 ? "scout" : "guard"),
    };
  });
}
