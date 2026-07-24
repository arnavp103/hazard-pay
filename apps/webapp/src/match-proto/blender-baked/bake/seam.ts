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
 * cell size, clip budget, palette); Python owns only what bpy can own
 * (geometry, poses, camera, render) and reports back what it actually did.
 */

import { z } from "zod";

import { ANCHOR, CELL, CLIPS, FACINGS, PIXELS_PER_UNIT } from "../framing.ts";

const sizeSchema = z.object({ width: z.number().int().positive(), height: z.number().int().positive() });
const pointSchema = z.object({ x: z.number(), y: z.number() });

/** Written by TypeScript, read by `medic_bake.py`. */
export const bakeSpecSchema = z.object({
  workDir: z.string(),
  manifestPath: z.string(),
  cell: sizeSchema,
  supersample: z.number().int().min(1).max(16),
  pixelsPerUnit: z.number().positive(),
  anchor: pointSchema,
  facings: z.number().int().positive(),
  clips: z.array(z.object({
    name: z.string(),
    frames: z.number().int().positive(),
    fps: z.number().int().positive(),
  })).nonempty(),
});

export type BakeSpec = z.infer<typeof bakeSpecSchema>;

/**
 * Written by `medic_bake.py`, read by TypeScript. Every field is echoed from
 * what Blender actually rendered rather than assumed from the spec, so a
 * silent drift (a resolution Blender clamped, a clip Python skipped) fails
 * here instead of surfacing as a misaligned atlas twelve steps later.
 */
export const bakeManifestSchema = z.object({
  version: z.literal(1),
  generator: z.string(),
  engine: z.string(),
  cell: sizeSchema,
  supersample: z.number().int().min(1),
  pixelsPerUnit: z.number().positive(),
  anchor: pointSchema,
  facings: z.number().int().positive(),
  partCount: z.number().int().positive(),
  clips: z.array(z.object({
    name: z.string(),
    frames: z.number().int().positive(),
    fps: z.number().int().positive(),
  })).nonempty(),
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
 * The spec this lane bakes. `supersample` stays 1 on purpose: rendering at
 * the target resolution with a ~0 reconstruction filter gives hard-edged,
 * binary-alpha pixels. Supersampling and downscaling would hand the quantizer
 * a cloud of blended in-between colours — which is exactly how a bake starts
 * looking like a shrunken 3D render.
 */
export function buildSpec(workDir: string, manifestPath: string, supersample = 1): BakeSpec {
  return bakeSpecSchema.parse({
    workDir,
    manifestPath,
    cell: { width: CELL.width, height: CELL.height },
    supersample,
    pixelsPerUnit: PIXELS_PER_UNIT,
    anchor: { x: ANCHOR.x, y: ANCHOR.y },
    facings: FACINGS,
    clips: CLIPS.map((clip) => ({ name: clip.name, frames: clip.frames, fps: clip.fps })),
  });
}

/** Cross-check the manifest against what we asked for. Cheap, catches drift. */
export function assertManifestMatchesSpec(manifest: BakeManifest, spec: BakeSpec): void {
  const problems: string[] = [];
  if (manifest.cell.width !== spec.cell.width || manifest.cell.height !== spec.cell.height) {
    problems.push("cell size");
  }
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
