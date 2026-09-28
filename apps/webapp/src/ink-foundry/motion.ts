/** Original, deterministic pose study. Seconds can be sampled in either direction. */
export const CLIPS = ["idle", "walk", "attack", "turn", "stagger"] as const;
export type Clip = typeof CLIPS[number];
export const DURATIONS: Record<Clip, number> = { idle: 3.2, walk: 1.05, attack: 1.65, turn: 3.4, stagger: 1.4 };

/** URL capture times are bounded to ten minutes and never propagate NaN into joints. */
export function parseFreeze(value: string | null) {
  if (value === null) { return null; }
  const milliseconds = Number(value);
  return Number.isFinite(milliseconds) ? Math.max(0, Math.min(600_000, milliseconds)) / 1000 : 0;
}

const smooth = (x: number) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};
const pulse = (t: number, start: number, apex: number, end: number) => t < apex
  ? smooth((t - start) / (apex - start))
  : 1 - smooth((t - apex) / (end - apex));

export function poseAt(clip: Clip, seconds: number, phase = 0) {
  const t = ((seconds + phase) % DURATIONS[clip] + DURATIONS[clip]) % DURATIONS[clip];
  const cycle = t / DURATIONS[clip];
  const wave = Math.sin(cycle * Math.PI * 2);
  const gait = clip === "walk" ? wave : 0;
  const aim = clip === "attack" ? pulse(t, 0.05, 0.4, 1.5) : 0;
  const recoil = clip === "attack" ? pulse(t, 0.53, 0.6, 0.94) : 0;
  const hit = clip === "stagger" ? pulse(t, 0.03, 0.16, 0.86) : 0;
  const turn = clip === "turn" ? smooth((t - 0.45) / 0.65) * Math.PI * 0.8 - smooth((t - 2.05) / 0.65) * Math.PI * 0.8 : 0;
  return {
    bob: clip === "walk" ? Math.abs(wave) * 0.065 : Math.sin(seconds * 2.4 + phase) * 0.018 - hit * 0.2,
    hipX: gait * 0.025 + hit * 0.12 - aim * 0.09,
    torsoX: gait * 0.055 - aim * 0.14 - recoil * 0.17 - hit * 0.37,
    torsoZ: -gait * 0.07 + hit * 0.3,
    torsoY: -gait * 0.1 + aim * 0.3 + turn * 0.2,
    headY: Math.sin(seconds * 0.9 + phase) * 0.1 + (clip === "turn" ? pulse(t, 0.1, 0.5, 1.1) * 0.45 : 0),
    yaw: turn,
    leftHip: gait * 0.56 + hit * 0.2 - aim * 0.32,
    rightHip: -gait * 0.56 - hit * 0.45 + aim * 0.3,
    leftKnee: Math.max(0, -gait) * 0.8 + hit * 0.35 + aim * 0.14,
    rightKnee: Math.max(0, gait) * 0.8 + hit * 0.7 + aim * 0.18,
    leftShoulder: -0.1 - gait * 0.34 - aim * 1.0 + hit * 0.55,
    rightShoulder: -0.18 + gait * 0.3 - aim * 1.22 + recoil * 0.26 - hit * 0.65,
    leftElbow: -0.26 - aim * 0.57 - Math.max(0, gait) * 0.22,
    rightElbow: -0.32 - aim * 0.35 - recoil * 0.2,
    brace: aim,
    coat: gait * 0.22 + Math.sin(seconds * 3 + phase) * 0.045 + hit * 0.22,
    muzzle: clip === "attack" && t >= 0.55 && t < 0.65,
    shotAge: clip === "attack" ? t - 0.55 : -1,
    cycle,
  };
}
