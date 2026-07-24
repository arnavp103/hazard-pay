/**
 * THROWAWAY PROTOTYPE (#82): which baked cell is on screen at time t.
 *
 * Pure functions, no renderer — this is the whole animation brain of a baked
 * lane, and it is the part that differs most from the real-time rival. There
 * is no rig to pose at runtime: every beat has to be chosen from cells that
 * already exist, so the acting budget is spent at bake time and the runtime
 * only schedules.
 *
 * The turn is where that shows. The rival lane can ease a rig through a
 * facing change; here the change is a hard cut between two baked facings, so
 * it has to be HIDDEN inside an authored pivot — anticipation and lift play
 * on the OLD facing, the swap happens at the apex where the silhouette is
 * smallest and most ambiguous, and the land and settle play on the NEW one.
 * Uneven dwells keep it from reading as a turntable.
 */

import { CLIPS, FACINGS } from "./framing.ts";

export type Mode = "attack" | "idle" | "turn";

export interface Cue {
  clip: string;
  facing: number;
  frame: number;
}

interface Clip { name: string; frames: number; fps: number }

const clipByName = new Map<string, Clip>(CLIPS.map((clip) => [clip.name, clip]));

function clipFrame(name: string, elapsedMs: number): number {
  const clip = clipByName.get(name);
  if (clip === undefined) { throw new Error(`unknown clip: ${name}`); }
  return Math.floor((elapsedMs / 1000) * clip.fps) % clip.frames;
}

function clipDurationMs(name: string): number {
  const clip = clipByName.get(name);
  if (clip === undefined) { throw new Error(`unknown clip: ${name}`); }
  return (clip.frames / clip.fps) * 1000;
}

/**
 * Per-facing hold before the next pivot, in ms. Deliberately uneven: two long
 * "deciding" beats, two quick snaps, so eight facings do not read as a clock.
 */
export const TURN_DWELLS_MS: readonly number[] = [420, 260, 340, 480, 240, 360, 420, 280];

export const PIVOT_MS = clipDurationMs("pivot");
/** The pivot frame at which the sprite swaps to the new facing (the apex). */
const PIVOT_SWAP_FRAME = 3;
export const TURN_CYCLE_MS = TURN_DWELLS_MS.reduce((sum, dwell) => sum + dwell, 0)
  + TURN_DWELLS_MS.length * PIVOT_MS;

export function turnCue(elapsedMs: number, startFacing = 0): Cue {
  let t = ((elapsedMs % TURN_CYCLE_MS) + TURN_CYCLE_MS) % TURN_CYCLE_MS;
  for (let step = 0; step < TURN_DWELLS_MS.length; step += 1) {
    const facing = (startFacing + step) % FACINGS;
    const dwell = TURN_DWELLS_MS[step] ?? 0;
    if (t < dwell) {
      return { clip: "idle", facing, frame: clipFrame("idle", t) };
    }
    t -= dwell;
    if (t < PIVOT_MS) {
      const frame = Math.min(clipFrame("pivot", t), (clipByName.get("pivot")?.frames ?? 1) - 1);
      const next = (facing + 1) % FACINGS;
      return { clip: "pivot", facing: frame < PIVOT_SWAP_FRAME ? facing : next, frame };
    }
    t -= PIVOT_MS;
  }
  return { clip: "idle", facing: startFacing, frame: 0 };
}

export function cueAt(mode: Mode, elapsedMs: number, facing: number): Cue {
  if (mode === "turn") { return turnCue(elapsedMs, facing); }
  return { clip: mode, facing, frame: clipFrame(mode, elapsedMs) };
}

/** Track key in the baked spritesheet's `animations` map. */
export function trackKey(cue: Cue): string {
  return `${cue.clip}_${String(cue.facing)}`;
}
