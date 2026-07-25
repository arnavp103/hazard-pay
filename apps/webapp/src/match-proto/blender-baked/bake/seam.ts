/**
 * THROWAWAY PROTOTYPE (#82): the contract across the Blender process seam.
 *
 * A thin Python layer is unavoidable in any Blender lane — `bpy` only exists
 * inside Blender's embedded interpreter. That makes the TS<->Python boundary a
 * genuine process seam with an untyped wire format, so it gets the same
 * treatment ADR 0002 gives the HTTP seam: one schema, parsed (not cast) at the
 * boundary, and nothing downstream is allowed to see the raw JSON.
 *
 * Direction matters. TypeScript owns every number a human would tune (framing,
 * cell size, clip budget, palette, tier scale); Python owns only what bpy can
 * own (geometry, poses, camera, render) and reports back what it actually did
 * — including which decorative parts it had to DROP because they fell under
 * the minimum readable feature size at the requested scale. That number is
 * round 4's central evidence, so it travels as data, not as a claim.
 */

import { z } from "zod";

import {
  ANCHOR,
  CELL,
  CLIPS,
  FACINGS,
  PIXELS_PER_UNIT,
  RIG_HEIGHT_UNITS,
  type UnitBake,
  type UnitId,
} from "../framing.ts";

const sizeSchema = z.object({ width: z.number().int().positive(), height: z.number().int().positive() });
const pointSchema = z.object({ x: z.number(), y: z.number() });
const clipSchema = z.object({
  name: z.string(),
  frames: z.number().int().positive(),
  fps: z.number().int().positive(),
});

/** Written by TypeScript, read by `unit_bake.py`. */
export const bakeSpecSchema = z.object({
  workDir: z.string(),
  manifestPath: z.string(),
  /** Which rig to build. Python owns the geometry; TypeScript owns the choice. */
  unit: z.enum(["brute", "marksman", "medic", "ranger"]),
  /** Uniform world scale on the authored rig — the tier's size boost. */
  unitScale: z.number().positive(),
  cell: sizeSchema,
  supersample: z.number().int().min(1).max(16),
  pixelsPerUnit: z.number().positive(),
  anchor: pointSchema,
  facings: z.number().int().positive(),
  clips: z.array(clipSchema).nonempty(),
});

export type BakeSpec = z.infer<typeof bakeSpecSchema>;

/**
 * Written by `unit_bake.py`, read by TypeScript. Every field is echoed from
 * what Blender actually rendered rather than assumed from the spec, so a
 * silent drift (a resolution Blender clamped, a clip Python skipped) fails
 * here instead of surfacing as a misaligned atlas twelve steps later.
 */
export const bakeManifestSchema = z.object({
  version: z.literal(2),
  generator: z.string(),
  engine: z.string(),
  unit: z.string(),
  unitScale: z.number().positive(),
  cell: sizeSchema,
  supersample: z.number().int().min(1),
  pixelsPerUnit: z.number().positive(),
  anchor: pointSchema,
  facings: z.number().int().positive(),
  partCount: z.number().int().positive(),
  /**
   * Decorative parts omitted because they would render under ~1.2 art px at
   * this scale. A pixel artist working at 14 px does not draw the pocket; the
   * rig should not either, and pretending otherwise is how a bake turns into
   * sub-pixel confetti that flickers between facings.
   */
  droppedDetails: z.number().int().min(0),
  /**
   * The rig's own world-Z extent in the bind pose, divided back out of the tier
   * scale — i.e. how tall this rig is when nobody has scaled it. TypeScript owns
   * every tunable number in this lane, but it cannot own this one: it is a
   * property of geometry Python built. Round 6 reads it back to check
   * `RIG_HEIGHT_UNITS`, which is the constant a size-boost ratio is computed
   * from and the one round 5 got wrong for two rigs out of three.
   */
  authoredHeightUnits: z.number().positive(),
  clips: z.array(clipSchema).nonempty(),
  frames: z.array(z.object({
    clip: z.string(),
    frame: z.number().int().min(0),
    facing: z.number().int().min(0),
    color: z.string(),
    id: z.string(),
  })).nonempty(),
  timing: z.object({
    renderSeconds: z.number().nonnegative(),
    totalSeconds: z.number().nonnegative(),
    renderCount: z.number().int().positive(),
  }),
});

export type BakeManifest = z.infer<typeof bakeManifestSchema>;

/**
 * The hero PORTRAIT spec — rounds 1-3's artifact, unchanged. `supersample`
 * stays 1 on purpose: rendering at the target resolution with a ~0
 * reconstruction filter gives hard-edged, binary-alpha pixels. Supersampling
 * and downscaling would hand the quantizer a cloud of blended in-between
 * colours — which is exactly how a bake starts looking like a shrunken 3D
 * render.
 */
export function buildSpec(workDir: string, manifestPath: string, supersample = 1): BakeSpec {
  return bakeSpecSchema.parse({
    workDir,
    manifestPath,
    unit: "medic",
    unitScale: 1,
    cell: { width: CELL.width, height: CELL.height },
    supersample,
    pixelsPerUnit: PIXELS_PER_UNIT,
    anchor: { x: ANCHOR.x, y: ANCHOR.y },
    facings: FACINGS,
    clips: CLIPS.map((clip) => ({ name: clip.name, frames: clip.frames, fps: clip.fps })),
  });
}

/** A crowd-tier spec: same seam, same camera, a different rig at a new scale. */
export function buildUnitSpec(workDir: string, manifestPath: string, unit: UnitBake): BakeSpec {
  return bakeSpecSchema.parse({
    workDir,
    manifestPath,
    unit: unit.id,
    unitScale: unit.scale,
    cell: { width: unit.cell.width, height: unit.cell.height },
    supersample: 1,
    pixelsPerUnit: PIXELS_PER_UNIT,
    anchor: { x: unit.anchor.x, y: unit.anchor.y },
    facings: unit.facings,
    clips: unit.clips.map((clip) => ({ name: clip.name, frames: clip.frames, fps: clip.fps })),
  });
}

/** Cross-check the manifest against what we asked for. Cheap, catches drift. */
export function assertManifestMatchesSpec(manifest: BakeManifest, spec: BakeSpec): void {
  const problems: string[] = [];
  if (manifest.cell.width !== spec.cell.width || manifest.cell.height !== spec.cell.height) {
    problems.push("cell size");
  }
  if (manifest.unit !== spec.unit) { problems.push("unit"); }
  if (manifest.facings !== spec.facings) { problems.push("facing count"); }
  if (manifest.pixelsPerUnit !== spec.pixelsPerUnit) { problems.push("pixelsPerUnit"); }
  const expected = spec.clips.reduce((sum, clip) => sum + clip.frames, 0) * spec.facings;
  if (manifest.frames.length !== expected) {
    problems.push(`frame count (expected ${String(expected)}, got ${String(manifest.frames.length)})`);
  }
  if (problems.length > 0) {
    throw new Error(`bake manifest disagrees with the spec: ${problems.join(", ")}`);
  }
}

/**
 * Hold `RIG_HEIGHT_UNITS` to what Blender actually built.
 *
 * The tolerance is one twentieth of an art pixel at PIXELS_PER_UNIT — tight
 * enough that any real geometry change trips it, loose enough to survive float
 * round-tripping through JSON. The message carries the correct value so the fix
 * is a copy-paste rather than an investigation.
 */
export function assertRigHeight(manifest: BakeManifest): void {
  const declared = RIG_HEIGHT_UNITS[manifest.unit as UnitId] as number | undefined;
  if (declared === undefined) {
    throw new Error(`no RIG_HEIGHT_UNITS entry for ${manifest.unit}`);
  }
  const tolerance = 0.05 / PIXELS_PER_UNIT;
  if (Math.abs(declared - manifest.authoredHeightUnits) <= tolerance) { return; }
  throw new Error(
    `RIG_HEIGHT_UNITS.${manifest.unit} is ${declared.toFixed(4)} but the rig Blender built `
    + `is ${manifest.authoredHeightUnits.toFixed(4)} world units tall. Every tier size on the `
    + `ladder is derived from this number — set it to ${manifest.authoredHeightUnits.toFixed(4)} `
    + "and re-bake.",
  );
}
