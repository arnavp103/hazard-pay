export type Role = "medic" | "veteran" | "esper";
export type View = "hero" | "crowd";
export const LOOP_MS = 6400;
export type Point = readonly [number, number];

export interface Pose {
  phase: "BREATHE" | "GATHER" | "STRIKE" | "HOLD" | "RECOVER" | "ADVANCE";
  lean: number;
  crouch: number;
  reach: number;
  recoil: number;
  stride: number;
  cloth: number;
  lift: number;
  impact: number;
  charge: number;
}

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => {
  const t = clamp(v);
  return t * t * (3 - 2 * t);
};
const wave = (t: number, a: number, b: number) => smooth((t - a) / (b - a));

/** Deliberately pose-to-pose: the strike holds for 100ms, cloth resolves later. */
export function poseAt(milliseconds: number, role: Role): Pose {
  const t = ((milliseconds % LOOP_MS) + LOOP_MS) % LOOP_MS;
  const gather = wave(t, 950, 1750) * (1 - wave(t, 2100, 2200));
  const strike = wave(t, 2100, 2200) * (1 - wave(t, 2520, 3120));
  const move = wave(t, 3500, 3900) * (1 - wave(t, 5750, 6200));
  const stride = Math.sin((t - 3500) / 145) * move;
  const recoil = Math.sin(clamp((t - 2180) / 450) * Math.PI) * 9;
  const weight = role === "veteran" ? 1.25 : role === "esper" ? 0.55 : 1;
  return {
    phase: t < 950 ? "BREATHE" : t < 2100 ? "GATHER" : t < 2220 ? "STRIKE" : t < 2520 ? "HOLD" : t < 3500 ? "RECOVER" : "ADVANCE",
    lean: -gather * 9 + strike * 14 + move * 6 - recoil * weight,
    crouch: gather * 8 * weight + strike * 3 + Math.abs(stride) * 3 * weight,
    reach: strike * 24 - gather * 16,
    recoil,
    stride: stride * (role === "esper" ? 0.45 : 1),
    cloth: Math.sin(t / 230) * 3 - gather * 6 + Math.sin(clamp((t - 2230) / 1250) * Math.PI) * 24 + stride * 8,
    lift: role === "esper" ? 10 + Math.sin(t / 340) * 3 + gather * 14 : 0,
    impact: t >= 2180 && t < 2460 ? 1 - (t - 2180) / 280 : 0,
    charge: gather,
  };
}

export function project(x: number, y: number, z = 0): Point {
  return [700 + (x - y) * 0.8944, 195 + (x + y) * 0.4472 - z];
}

export const roster: { role: Role; name: string; number: string; title: string; note: string }[] = [
  { role: "medic", name: "MORROW", number: "01", title: "FIELD SURGEON", note: "The coat moves after the body." },
  { role: "veteran", name: "RUSK", number: "02", title: "BREACH VETERAN", note: "Weight lands before the recoil." },
  { role: "esper", name: "VESPER", number: "03", title: "SIGNAL DIVINER", note: "A held breath. A broken circle." },
];
