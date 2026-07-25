import { describe, expect, it } from "vitest";

import { CELL, CLIPS, FACINGS, RIG_HEIGHT_UNITS } from "../framing.ts";
import {
  assertManifestMatchesSpec,
  assertRigHeight,
  bakeManifestSchema,
  buildSpec,
} from "./seam.ts";

const spec = buildSpec("/tmp/work", "/tmp/work/manifest.json");

function manifestFixture(overrides: Record<string, unknown> = {}): unknown {
  const frames = CLIPS.flatMap((clip) =>
    Array.from({ length: clip.frames }, (_, frame) =>
      Array.from({ length: FACINGS }, (_, facing) => ({
        clip: clip.name,
        frame,
        facing,
        color: `${clip.name}_${String(frame)}_${String(facing)}.png`,
        id: `${clip.name}_${String(frame)}_${String(facing)}.id.png`,
      }))).flat());

  return {
    version: 2,
    generator: "blender 5.2.0 LTS",
    engine: "CYCLES/CPU",
    unit: "medic",
    unitScale: 1,
    droppedDetails: 0,
    authoredHeightUnits: 1.9104,
    cell: { width: CELL.width, height: CELL.height },
    supersample: 1,
    pixelsPerUnit: spec.pixelsPerUnit,
    anchor: spec.anchor,
    facings: FACINGS,
    partCount: 58,
    clips: CLIPS.map((clip) => ({ name: clip.name, frames: clip.frames, fps: clip.fps })),
    frames,
    timing: { renderSeconds: 6.9, totalSeconds: 7.4, renderCount: frames.length * 2 },
    ...overrides,
  };
}

describe("bakeManifestSchema", () => {
  it("parses what unit_bake.py actually writes", () => {
    const parsed = bakeManifestSchema.parse(manifestFixture());
    expect(parsed.frames).toHaveLength(
      CLIPS.reduce((sum, clip) => sum + clip.frames, 0) * FACINGS,
    );
  });

  it("rejects a manifest from a future script version rather than guessing", () => {
    expect(() => bakeManifestSchema.parse(manifestFixture({ version: 3 }))).toThrow();
  });

  it("rejects a manifest that forgot to say which rig it baked", () => {
    const { unit: _unit, ...withoutUnit } = manifestFixture() as Record<string, unknown>;
    expect(() => bakeManifestSchema.parse(withoutUnit)).toThrow();
  });

  it("rejects a bake that rendered nothing", () => {
    expect(() => bakeManifestSchema.parse(manifestFixture({ frames: [] }))).toThrow();
  });

  it("rejects a non-integer cell — Blender clamping the resolution must not pass", () => {
    expect(() => bakeManifestSchema.parse(manifestFixture({ cell: { width: 63.5, height: 48 } })))
      .toThrow();
  });
});

describe("assertManifestMatchesSpec", () => {
  it("accepts a manifest that matches what we asked Blender for", () => {
    expect(() => {
      assertManifestMatchesSpec(bakeManifestSchema.parse(manifestFixture()), spec);
    }).not.toThrow();
  });

  it("catches a cell-size drift between the spec and the render", () => {
    const drifted = bakeManifestSchema.parse(manifestFixture({ cell: { width: 32, height: 48 } }));
    expect(() => { assertManifestMatchesSpec(drifted, spec); }).toThrow(/cell size/);
  });

  it("catches a short bake — missing frames would silently break the atlas", () => {
    const parsed = bakeManifestSchema.parse(manifestFixture());
    const short = { ...parsed, frames: parsed.frames.slice(0, 10) };
    expect(() => { assertManifestMatchesSpec(short, spec); }).toThrow(/frame count/);
  });

  it("catches a facing-count drift", () => {
    const drifted = bakeManifestSchema.parse(manifestFixture({ facings: 4 }));
    expect(() => { assertManifestMatchesSpec(drifted, spec); }).toThrow(/facing count/);
  });

  it("catches Blender baking a different rig than the spec asked for", () => {
    const wrong = bakeManifestSchema.parse(manifestFixture({ unit: "brute" }));
    expect(() => { assertManifestMatchesSpec(wrong, spec); }).toThrow(/unit/);
  });
});

describe("buildSpec", () => {
  it("bakes at 1x on purpose — supersampling would hand the quantizer blends", () => {
    expect(spec.supersample).toBe(1);
    expect(spec.cell).toEqual({ width: CELL.width, height: CELL.height });
    expect(spec.clips.map((clip) => clip.name)).toEqual(CLIPS.map((clip) => clip.name));
  });
});

/**
 * The round-5 regression, as a test rather than as a note.
 *
 * Every tier size on the register ladder is `bodyArtPx / (RIG_HEIGHT_UNITS[rig]
 * * PIXELS_PER_UNIT)`. When that constant is wrong for a rig, nothing fails —
 * the rig simply draws at a size nobody asked for, and the hero:fodder ratio the
 * #69 ruling is written in drifts silently. It drifted from 1.27 to 1.08 in
 * round 5 that way. So the table is now checked against the geometry Blender
 * actually built, on every bake.
 */
describe("assertRigHeight", () => {
  it("accepts a rig that matches the declared authored height", () => {
    const manifest = bakeManifestSchema.parse(manifestFixture({
      authoredHeightUnits: RIG_HEIGHT_UNITS.medic,
      unit: "medic",
    }));
    expect(() => { assertRigHeight(manifest); }).not.toThrow();
  });

  it("rejects a drift of more than a twentieth of an art pixel, with the fix in the message", () => {
    const manifest = bakeManifestSchema.parse(manifestFixture({
      authoredHeightUnits: RIG_HEIGHT_UNITS.medic + 0.2,
      unit: "medic",
    }));
    expect(() => { assertRigHeight(manifest); })
      .toThrow(String((RIG_HEIGHT_UNITS.medic + 0.2).toFixed(4)));
  });

  it("refuses a rig the framing has no size for at all", () => {
    const manifest = bakeManifestSchema.parse(manifestFixture({ unit: "not-a-rig" }));
    expect(() => { assertRigHeight(manifest); }).toThrow("no RIG_HEIGHT_UNITS entry");
  });
});
