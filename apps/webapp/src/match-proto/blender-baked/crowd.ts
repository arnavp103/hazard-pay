/**
 * THROWAWAY PROTOTYPE (#82), round 4: the crowd, as pure functions.
 *
 * This file exists separately from the renderer because the question round 4
 * is here to answer is not a rendering question. Baking forecloses procedural
 * animation: after the atlas is written, the only thing a runtime can vary is
 * WHICH already-existing cell it shows and WHEN. So the honest way to ask
 * "does phase offset alone carry a crowd?" is to write the scheduler down as
 * arithmetic and measure it, rather than to squint at a GIF.
 *
 * Three treatments, in increasing order of what they cost:
 *
 *  - `sync`  — every unit plays the same clip on the same tick. What a naive
 *              baked runtime does, and the synchronized-toys artifact itself.
 *  - `phase` — per-unit playback phase offset. This is the lever the director
 *              named as the ONLY one a bake leaves available, so it gets
 *              measured on its own rather than bundled with anything else.
 *  - `variants` — phase, plus a second BAKED idle clip. This is the only
 *              treatment that costs atlas, and isolating it is the point:
 *              it measures what buying pose vocabulary actually buys.
 *  - `full`  — variants, plus staggered attack scheduling, which is free.
 */

import { type ClipSpec, type CrowdConfig, type TierKey, type UnitId } from "./framing.ts";

export type Treatment = "full" | "phase" | "sync" | "variants";

/** Hero marking: none, a ring grown outside, or the silhouette's own edge. */
export type MarkMode = "inset" | "off" | "outward";

export function markedUnitId(unit: { tier: string; unit: string }, marking: MarkMode): string {
  if (marking === "off" || unit.tier !== "hero") { return unit.unit; }
  return marking === "inset" ? `${unit.unit}_marked_inset` : `${unit.unit}_marked`;
}

export interface CrowdUnit {
  index: number;
  /** Atlas unit id, e.g. `brute_b` — rig plus faction. */
  unit: string;
  rig: UnitId;
  tier: TierKey;
  side: 0 | 1;
  /** Art-pixel stand point. */
  x: number;
  y: number;
  facing: number;
  /** Which baked idle this unit draws from when the treatment allows two. */
  idleClip: "idle" | "idle_b";
  /** Playback phase offset in ms. */
  phaseMs: number;
  /** Period between attack bursts, and where in that period this unit sits. */
  attackPeriodMs: number;
  attackOffsetMs: number;
}

export interface CrowdCue {
  /** Spritesheet animation key: `${unit}_${clip}_${facing}`. */
  track: string;
  frame: number;
  clip: string;
}

/** Deterministic PRNG: the same crowd every capture, on every machine. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Which baked facing points at the enemy. Eight facings exist; a formation
 * only ever needs a couple of them plus jitter, which is exactly why the
 * fodder tier could have been cut to four facings — see FACING_NOTE.
 */
export const FACING_A = 6;
export const FACING_B = 2;

/**
 * Cutting fodder to 4 facings would halve the fodder half of the atlas again.
 * It was NOT taken, and the reason is this file: facing spread inside a rank is
 * one of the few things that stops thirty-six units reading as one object, and
 * 90-degree granularity would take it away in the exact capture that is meant
 * to test for sameness. The saving is recorded in the cost report instead.
 */
export const FACING_NOTE = "8 facings kept; 4 would halve fodder cells";

const RANKS = 4;
const FILES = 5;
/**
 * Melee ranks first, then ranged, with the two heroes deliberately NOT
 * adjacent. Standing them side by side merges their marking rings into one
 * shape, which measures the ring rather than the tier separation it is there
 * to test.
 */
const SIDE_COMPOSITION: readonly UnitId[] = [
  ...Array.from({ length: 10 }, () => "brute" as const),
  "marksman", "marksman", "marksman", "medic", "marksman",
  "marksman", "marksman", "medic",
];

/**
 * The battle is centred in the aperture and scales with the units, so the two
 * configs differ in RESOLUTION rather than in crowding — which is the only way
 * the side-by-side answers the #69 fork instead of confounding it.
 */
const CENTRE = { gapSteps: 2.4, x: 120, y: 100 };

/**
 * Build both armies. Fodder count per side matches the director's capture
 * default (16 fodder, 2 heroes); positions, facings, idle variant and phase
 * are all drawn from one seeded stream so every capture is reproducible.
 */
export function buildRoster(config: CrowdConfig, seed = 0x5a17): CrowdUnit[] {
  const random = mulberry32(seed);
  const step = config.spacing;
  const dx = step.along[0];
  const dy = step.rank[1] * 1.72;
  const units: CrowdUnit[] = [];

  for (const side of [0, 1] as const) {
    const dir = side === 0 ? -1 : 1;
    const gap = step.along[0] * CENTRE.gapSteps * 0.5;
    const originX = CENTRE.x + dir * gap;
    const baseFacing = side === 0 ? FACING_A : FACING_B;
    SIDE_COMPOSITION.forEach((rig, slot) => {
      const rank = Math.min(RANKS - 1, Math.floor(slot / FILES));
      const file = slot % FILES;
      // A rank recedes away from the contact line; files skew with the 2:1
      // projection so a block reads as ground, not as a spreadsheet.
      const jitterX = (random() - 0.5) * dx * 0.3;
      const jitterY = (random() - 0.5) * dy * 0.35;
      const x = originX + dir * rank * dx * 0.86
        + (file - (FILES - 1) / 2) * dx * 0.22 + jitterX;
      const y = CENTRE.y + (file - (FILES - 1) / 2) * dy + jitterY;
      const facingJitter = random() < 0.34 ? (random() < 0.5 ? -1 : 1) : 0;
      units.push({
        attackOffsetMs: Math.round(random() * 2600),
        attackPeriodMs: 1800 + Math.round(random() * 1800),
        facing: (baseFacing + facingJitter + 8) % 8,
        idleClip: random() < 0.5 ? "idle" : "idle_b",
        index: units.length,
        phaseMs: Math.round(random() * 1000),
        rig,
        side,
        tier: rig === "medic" ? "hero" : "fodder",
        unit: `${rig}_${side === 0 ? "a" : "b"}`,
        x,
        y,
      });
    });
  }

  // Painter's order: back of the board first. Ties break on x so the sort is
  // stable across engines and the capture is byte-reproducible.
  return units.sort((a, b) => a.y - b.y || a.x - b.x || a.index - b.index);
}

function clipOf(clips: readonly ClipSpec[], name: string): ClipSpec {
  const found = clips.find((clip) => clip.name === name);
  if (found === undefined) { throw new Error(`unknown clip: ${name}`); }
  return found;
}

function frameIn(clip: ClipSpec, elapsedMs: number): number {
  const t = ((elapsedMs % ((clip.frames / clip.fps) * 1000)) + (clip.frames / clip.fps) * 1000)
    % ((clip.frames / clip.fps) * 1000);
  return Math.min(clip.frames - 1, Math.floor((t / 1000) * clip.fps));
}

/**
 * Which cell this unit shows at time t. The whole animation brain of a baked
 * crowd is this function; there is nothing else a runtime can do.
 */
export function crowdCueAt(
  unit: CrowdUnit,
  clips: readonly ClipSpec[],
  elapsedMs: number,
  treatment: Treatment,
  marking: MarkMode = "off",
): CrowdCue {
  // Marking is a hero-only variant of the same cells; fodder never carries it,
  // because a ring on everything marks nothing.
  const atlasUnit = markedUnitId(unit, marking);
  const phase = treatment === "sync" ? 0 : unit.phaseMs;
  const t = elapsedMs + phase;

  if (treatment === "full") {
    const attack = clipOf(clips, "attack");
    const attackMs = (attack.frames / attack.fps) * 1000;
    const cycle = ((t + unit.attackOffsetMs) % unit.attackPeriodMs + unit.attackPeriodMs)
      % unit.attackPeriodMs;
    if (cycle < attackMs) {
      return {
        clip: "attack",
        frame: frameIn(attack, cycle),
        track: `${atlasUnit}_attack_${String(unit.facing)}`,
      };
    }
  }

  // `sync` and `phase` are held to ONE baked idle on purpose: the delta from
  // `phase` to `variants` is then exactly what a second baked clip buys, with
  // nothing else moving.
  const twoIdles = treatment === "full" || treatment === "variants";
  const name = twoIdles && clips.some((clip) => clip.name === unit.idleClip)
    ? unit.idleClip
    : "idle";
  const clip = clipOf(clips, name);
  return { clip: name, frame: frameIn(clip, t), track: `${atlasUnit}_${name}_${String(unit.facing)}` };
}

export interface CrowdMotionStats {
  /** Distinct atlas cells the crowd draws across the sampled window. */
  distinctCells: number;
  /** Mean units showing the byte-identical cell at one instant. */
  meanDuplicateMultiplicity: number;
  /** Worst-case share of units sitting on the same clip frame index. */
  peakFrameSynchrony: number;
  /**
   * Coefficient of variation of "units that changed cell this tick". This is
   * the synchronized-toys number: when a crowd steps in unison the changes
   * pile onto a few ticks and this goes high; when playback is decorrelated it
   * approaches the smooth-arrival value.
   */
  changeBurstiness: number;
}

/**
 * Measure a treatment over a window, by sampling the scheduler rather than the
 * pixels. Sampling the schedule is the honest measurement here: a GIF's own
 * cadence aliases motion beats, which has already misled this lane's cold
 * critic twice.
 */
export function crowdMotionStats(
  roster: readonly CrowdUnit[],
  clipsFor: (unit: CrowdUnit) => readonly ClipSpec[],
  treatment: Treatment,
  windowMs = 4000,
  stepMs = 1000 / 60,
): CrowdMotionStats {
  const samples = Math.max(2, Math.round(windowMs / stepMs));
  const distinct = new Set<string>();
  let previous: string[] = [];
  const changes: number[] = [];
  let multiplicitySum = 0;
  let peakSynchrony = 0;

  for (let sample = 0; sample < samples; sample += 1) {
    const t = sample * stepMs;
    const cells: string[] = [];
    const perCell = new Map<string, number>();
    const perFrameIndex = new Map<number, number>();
    for (const unit of roster) {
      const cue = crowdCueAt(unit, clipsFor(unit), t, treatment);
      const cell = `${cue.track}#${String(cue.frame)}`;
      cells.push(cell);
      distinct.add(cell);
      perCell.set(cell, (perCell.get(cell) ?? 0) + 1);
      perFrameIndex.set(cue.frame, (perFrameIndex.get(cue.frame) ?? 0) + 1);
    }
    // Mean multiplicity weighted by unit, not by cell: what matters is how
    // many units are drawing something another unit is also drawing.
    multiplicitySum += cells.reduce((sum, cell) => sum + (perCell.get(cell) ?? 1), 0) / cells.length;
    peakSynchrony = Math.max(
      peakSynchrony,
      Math.max(...perFrameIndex.values()) / roster.length,
    );
    if (previous.length > 0) {
      changes.push(cells.reduce((sum, cell, i) => sum + (cell === previous[i] ? 0 : 1), 0));
    }
    previous = cells;
  }

  const mean = changes.reduce((sum, value) => sum + value, 0) / Math.max(1, changes.length);
  const variance = changes.reduce((sum, value) => sum + (value - mean) ** 2, 0)
    / Math.max(1, changes.length);
  return {
    changeBurstiness: mean === 0 ? 0 : Number((Math.sqrt(variance) / mean).toFixed(3)),
    distinctCells: distinct.size,
    meanDuplicateMultiplicity: Number((multiplicitySum / samples).toFixed(2)),
    peakFrameSynchrony: Number(peakSynchrony.toFixed(3)),
  };
}

export const TREATMENTS: readonly Treatment[] = ["sync", "phase", "variants", "full"];

export interface PixelIdentityStats {
  /** Distinct IMAGES the crowd draws across the window, by pixel content. */
  distinctImages: number;
  /** Mean units standing on a byte-identical image at one instant. */
  meanIdenticalMultiplicity: number;
  /** The worst instant: most units simultaneously drawing one image. */
  peakIdenticalUnits: number;
}

/**
 * The same question as `crowdMotionStats`, asked of PIXELS instead of cell
 * names.
 *
 * Round 4 reported "2.8 units on a pixel-identical image at all times" by
 * counting cell NAMES, which is an upper bound on variety in one direction and
 * a lower bound in the other: two differently-named cells can be byte-identical
 * (a 4-frame idle whose first and last poses round to the same pixels), and no
 * name-based count can see that. `hashOf` is handed the finished atlas pixels,
 * so this counts what a viewer actually sees twice.
 */
export function crowdPixelIdentity(
  roster: readonly CrowdUnit[],
  clipsFor: (unit: CrowdUnit) => readonly ClipSpec[],
  treatment: Treatment,
  hashOf: (track: string, frame: number) => string,
  windowMs = 4000,
  stepMs = 1000 / 60,
): PixelIdentityStats {
  const samples = Math.max(2, Math.round(windowMs / stepMs));
  const distinct = new Set<string>();
  let multiplicitySum = 0;
  let peak = 0;

  for (let sample = 0; sample < samples; sample += 1) {
    const seen = new Map<string, number>();
    const hashes: string[] = [];
    for (const unit of roster) {
      const cue = crowdCueAt(unit, clipsFor(unit), sample * stepMs, treatment);
      const hash = hashOf(cue.track, cue.frame);
      hashes.push(hash);
      distinct.add(hash);
      seen.set(hash, (seen.get(hash) ?? 0) + 1);
    }
    multiplicitySum += hashes.reduce((sum, hash) => sum + (seen.get(hash) ?? 1), 0) / hashes.length;
    peak = Math.max(peak, ...seen.values());
  }

  return {
    distinctImages: distinct.size,
    meanIdenticalMultiplicity: Number((multiplicitySum / samples).toFixed(2)),
    peakIdenticalUnits: peak,
  };
}

/**
 * The degenerate crowd: every unit in a side facing the same way, which is
 * what a real formation does when it is marching or holding a line. Facing
 * spread is doing a lot of the anti-sameness work in the roster above, and a
 * decision should know how much of the result depends on it.
 */
export function lockFacings(roster: readonly CrowdUnit[]): CrowdUnit[] {
  return roster.map((unit) => ({ ...unit, facing: unit.side === 0 ? FACING_A : FACING_B }));
}
