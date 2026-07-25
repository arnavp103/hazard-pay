/**
 * THROWAWAY PROTOTYPE (#91) — shared geometry for both treatments.
 *
 * The bake-off only means something if the two treatments draw the *same*
 * board, so shape and colour are resolved once, here, in board-pixel space.
 * Treatment A turns these polygons into SVG paths with ink contours;
 * treatment B scanline-fills the identical polygons into a pixel buffer and
 * then runs its own surface-detail pass over them.
 *
 * What each treatment adds on top is exactly the experimental variable: A
 * adds vector contour language, B adds handcrafted pixel surface.
 *
 * ROUND 2 adds three things, all of them shared so neither treatment can
 * claim an advantage it did not earn:
 *
 * 1. **A cover kit.** Round 1 had one kind of cover — a market stall with a
 *    roof — so the only spatial relationship the board could express was
 *    "under". The kit below spans low barriers, waist blocks, see-through
 *    screens, hard full-height masses, poles and roofs, and every one of them
 *    is authored against the 22 px fodder figure rather than against the
 *    tile.
 *
 * 2. **Wares with form.** The hanging goods under the canopies were a grid of
 *    identical dots on a flat field, which is a texture and not a shelf of
 *    objects. `hangingWares` gives every bundle its own size, a three-value
 *    ramp, an ink underline, and a cast shadow onto whatever is beneath it,
 *    and draws them back-to-front so they occlude each other.
 *
 * 3. **Evidence that a ceiling exists.** `groundFill` steps the floor down its
 *    own ramp under a roof and inside a roof's cast shadow, so the canopy
 *    lands a shaped mark on the ground plane instead of floating above an
 *    unchanged floor.
 */

import {
  type EmissionName,
  type RampName,
  INK,
  INK_SOFT,
  backdrop,
  emissions,
  ramps,
  shadeStep,
} from "./palette.ts";
import {
  type Ambient,
  type Point,
  type Prop,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  GRID,
  TILE_H,
  TILE_W,
  groundAt,
  project,
  propSpecs,
  props,
} from "./board-model.ts";
import { inCanopyShadow, sortedProps, underCover } from "./occupancy.ts";

export type Shade = "base" | "light" | "shadow" | "spec";
export type Role = "flat" | "ground" | "left" | "mesh" | "right" | "signal" | "top";

export interface Piece {
  points: Point[];
  fill: string;
  /** Treatment A strokes this piece's silhouette; B inks its border. */
  ink: boolean;
  role: Role;
  /** Grouping tag so the detail passes know what they are drawing on. */
  tag: string;
}

function shadeOf(ramp: RampName, shade: Shade): string {
  const entry = ramps[ramp];
  if (shade === "spec") { return entry.spec ?? entry.light; }
  return entry[shade];
}

/** Light is upper-left: top face catches it, right-facing faces fall off. */
const FACE_SHADE = { top: "light", left: "base", right: "shadow" } as const;

interface BoxSpec {
  cx: number;
  cy: number;
  /** Footprint in cells. */
  sx: number;
  sy: number;
  /** Height in board pixels. */
  height: number;
  /** Base lift off the ground, in board pixels. */
  lift?: number;
  ramp: RampName;
  tag: string;
}

/**
 * A dimetric box. Returns top/left/right faces back-to-front so a painter
 * composite is correct without per-face sorting.
 */
export function isoBox(spec: BoxSpec): Piece[] {
  const { cx, cy, sx, sy, height, ramp, tag } = spec;
  const lift = spec.lift ?? 0;
  const x0 = cx - 0.5;
  const y0 = cy - 0.5;
  const x1 = cx + sx - 0.5;
  const y1 = cy + sy - 0.5;

  const raise = (point: Point, by: number): Point => ({ x: point.x, y: point.y - by });
  const north = raise(project(x0, y0), lift);
  const east = raise(project(x1, y0), lift);
  const south = raise(project(x1, y1), lift);
  const west = raise(project(x0, y1), lift);

  const top = [north, east, south, west].map((point) => raise(point, height));

  const topFace: Piece = { points: top, fill: shadeOf(ramp, FACE_SHADE.top), ink: true, role: "top", tag };
  const leftFace: Piece = {
    points: [top[3] ?? west, top[2] ?? south, south, west],
    fill: shadeOf(ramp, FACE_SHADE.left),
    ink: true,
    role: "left",
    tag,
  };
  const rightFace: Piece = {
    points: [top[2] ?? south, top[1] ?? east, east, south],
    fill: shadeOf(ramp, FACE_SHADE.right),
    ink: true,
    role: "right",
    tag,
  };
  return [leftFace, rightFace, topFace];
}

/** Flat quad on the ground plane (decals, shadows, mats). */
export function isoSlab(cx: number, cy: number, sx: number, sy: number, fill: string, tag: string): Piece {
  const x0 = cx - 0.5;
  const y0 = cy - 0.5;
  const x1 = cx + sx - 0.5;
  const y1 = cy + sy - 0.5;
  return {
    points: [project(x0, y0), project(x1, y0), project(x1, y1), project(x0, y1)],
    fill,
    ink: false,
    role: "flat",
    tag,
  };
}

function rectPiece(x: number, y: number, width: number, height: number, fill: string, tag: string, ink = true, role: Role = "flat"): Piece {
  return {
    points: [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ],
    fill,
    ink,
    role,
    tag,
  };
}

/** Ground-contact shadow: a squashed diamond under a prop. */
function contactShadow(cx: number, cy: number, sx: number, sy: number, tag: string): Piece {
  const piece = isoSlab(cx, cy, sx, sy, INK_SOFT, `${tag}-shadow`);
  const centre = project(cx + sx / 2 - 0.5, cy + sy / 2 - 0.5);
  return {
    ...piece,
    points: piece.points.map((point) => ({
      x: centre.x + (point.x - centre.x) * 1.1,
      y: centre.y + (point.y - centre.y) * 1.1 + 1,
    })),
  };
}

function emissionFill(prop: Prop, level: "active" | "hot" | "idle"): string {
  const channel: EmissionName = prop.signal ?? "amber";
  return emissions[channel][level];
}

function toneRamp(prop: Prop, warm: RampName, cool: RampName): RampName {
  return prop.tone === "warm" ? warm : cool;
}

/**
 * A chain fence occludes its wire and nothing else. The lattice below is the
 * chain-link read: two opposing diagonals on a 4 px pitch, so roughly half the
 * mesh area blocks and a unit standing behind it stays legible *through* it.
 *
 * It lives here, in the shared geometry, because both treatments rasterize it
 * and `compose.ts` occludes with it — if the drawn lattice and the occluding
 * lattice ever drifted apart, units would be cut by wire that is not there.
 */
export function meshBlocks(x: number, y: number): boolean {
  return (x + y) % 4 === 0 || (x - y + 4096) % 4 === 0;
}

/** Deterministic 0..1 from a prop id and an index — no RNG on the board. */
function jitter(seed: string, index: number): number {
  let hash = 2166136261;
  for (const char of `${seed}:${String(index)}`) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 8) & 0xffff) / 0xffff;
}

/* ------------------------------------------------------------------ */
/* Hanging wares — the "dots" repair                                   */
/* ------------------------------------------------------------------ */

/**
 * A run of goods hung from a canopy lip.
 *
 * The cofounder's note on round 1 was that the wares "look confusing … like
 * the characters have no perspective / depth". Round 1 stamped one 5×5 grid
 * of identical single-pixel dots twice per stall: uniform mark, uniform
 * spacing, uniform value, on a uniform field. That is the definition of a
 * texture, and a texture hung in mid-air reads as noise.
 *
 * Every property that made it noise is inverted here:
 *
 * - **size varies** (3–7 px wide, 4–9 px tall) so no two neighbours match;
 * - **value varies** — each bundle carries a lit column, a base mass, a
 *   shadow column and an ink underline, which is four values inside a 5 px
 *   object rather than one;
 * - **they overlap** — the run is drawn back to front along the hanging rail
 *   with the spacing deliberately smaller than the widths, so bundles occlude
 *   each other and the eye gets depth ordering for free;
 * - **they cast** — each bundle drops a shadow onto the surface below it, so
 *   the goods are attached to the stall rather than floating in front of it.
 */
export function hangingWares(prop: Prop, lipX: number, lipY: number, span: number, count: number): Piece[] {
  const pieces: Piece[] = [];
  const cloth = toneRamp(prop, "canvasWarm", "canvasCool");
  const goods: RampName[] = [toneRamp(prop, "wood", "steel"), cloth, toneRamp(prop, "rust", "sandbag")];

  for (let index = 0; index < count; index += 1) {
    const t = count === 1 ? 0.5 : index / (count - 1);
    const x = Math.round(lipX + (t - 0.5) * span);
    const width = 3 + Math.round(jitter(prop.id, index) * 4);
    const drop = 4 + Math.round(jitter(prop.id, index + 40) * 5);
    const cord = 2 + Math.round(jitter(prop.id, index + 80) * 4);
    const ramp = goods[index % goods.length] ?? cloth;
    const top = lipY + cord;

    // Cast shadow first: a squashed smear on whatever sits below the run.
    pieces.push(rectPiece(x - Math.floor(width / 2) + 2, top + drop + 2, width, 2, INK_SOFT, `${prop.id}-ware-cast-${String(index)}`, false));
    // Cord.
    pieces.push(rectPiece(x, lipY, 1, cord + 1, ramps.steel.shadow, `${prop.id}-ware-cord-${String(index)}`, false));

    const left = x - Math.floor(width / 2);
    pieces.push(rectPiece(left, top, width, drop, shadeOf(ramp, "base"), `${prop.id}-ware-${String(index)}`, false));
    pieces.push(rectPiece(left, top, 1, drop - 1, shadeOf(ramp, "light"), `${prop.id}-ware-lit-${String(index)}`, false));
    pieces.push(rectPiece(left + width - 2, top + 1, 2, drop - 1, shadeOf(ramp, "shadow"), `${prop.id}-ware-dark-${String(index)}`, false));
    pieces.push(rectPiece(left, top + drop - 1, width, 1, INK, `${prop.id}-ware-ink-${String(index)}`, false));
  }
  return pieces;
}

/* ------------------------------------------------------------------ */
/* Prop builders — the cover kit                                       */
/* ------------------------------------------------------------------ */

function roofSlab(prop: Prop, roof: { lift: number; ox: number; oy: number; sx: number; sy: number }, cloth: RampName): Piece[] {
  const { cx, cy } = prop;
  return [
    // The canopy itself, cantilevered forward off the frame behind it.
    ...isoBox({
      cx: cx + roof.ox - 0.35,
      cy: cy + roof.oy - 0.35,
      sx: roof.sx - 0.3,
      sy: roof.sy - 0.3,
      height: 3,
      lift: roof.lift,
      ramp: cloth,
      tag: `${prop.id}-canopy`,
    }),
    // Hanging valance on the two camera-facing edges. This is what turns the
    // roof from a floating shelf into something with an underside, and it is
    // the edge a unit standing beneath has to be read as being *under*.
    ...isoBox({
      cx: cx + roof.ox - 0.35,
      cy: cy + roof.oy + roof.sy - 0.75,
      sx: roof.sx - 0.3,
      sy: 0.1,
      height: 5,
      lift: roof.lift - 5,
      ramp: cloth,
      tag: `${prop.id}-valance`,
    }),
    ...isoBox({
      cx: cx + roof.ox + roof.sx - 0.75,
      cy: cy + roof.oy - 0.35,
      sx: 0.1,
      sy: roof.sy - 0.3,
      height: 5,
      lift: roof.lift - 5,
      ramp: cloth,
      tag: `${prop.id}-valance`,
    }),
  ];
}

function awningStall(prop: Prop): Piece[] {
  const { cx, cy } = prop;
  const spec = propSpecs.awningStall;
  const roof = spec.roof;
  const canopy = toneRamp(prop, "canvasWarm", "canvasCool");
  const lift = roof?.lift ?? 38;
  const pieces: Piece[] = [
    contactShadow(cx, cy, 2, 1, prop.id),
    ...isoBox({ cx, cy, sx: 1.95, sy: 0.9, height: 13, ramp: "wood", tag: `${prop.id}-counter` }),
    ...isoBox({ cx: cx + 1.35, cy, sx: 0.6, sy: 0.9, height: 26, ramp: "steel", tag: `${prop.id}-shelf` }),
  ];

  // The frame stands on the counter's OWN tiles, so no walkable tile has a
  // post buried in it and the awning is carried forward on a cantilever.
  for (const [px, py] of [[cx, cy], [cx + spec.sx - 1, cy]] as [number, number][]) {
    pieces.push(...isoBox({ cx: px, cy: py, sx: 0.12, sy: 0.12, height: lift + 3, ramp: "steel", tag: `${prop.id}-post` }));
  }

  if (roof !== undefined) { pieces.push(...roofSlab(prop, roof, canopy)); }

  const lip = project(cx + 0.5, cy + 1.3);
  pieces.push(...hangingWares(prop, lip.x, lip.y - lift + 4, 30, 6));
  pieces.push(rectPiece(lip.x - 9, lip.y - lift + 2, 18, 2, emissionFill(prop, "active"), `${prop.id}-signal`, false, "signal"));
  pieces.push(rectPiece(lip.x - 3, lip.y - lift + 2, 4, 2, emissionFill(prop, "hot"), `${prop.id}-signal`, false, "signal"));
  return pieces;
}

/**
 * A bare shelter: a row of columns at the back and a shallow roof cantilevered
 * over the walkable row in front of them. This prop exists purely to make
 * "under a ceiling" a thing the board can say without also saying "there is a
 * shop here", so every tile it shades except its own column row is walkable.
 */
function canopySpan(prop: Prop): Piece[] {
  const { cx, cy } = prop;
  const spec = propSpecs.canopySpan;
  const roof = spec.roof;
  const cloth = toneRamp(prop, "canvasWarm", "canvasCool");
  const lift = roof?.lift ?? 38;
  const pieces: Piece[] = [contactShadow(cx, cy, spec.sx, 1, prop.id)];
  for (let index = 0; index < spec.sx; index += 1) {
    // Deliberately THIN. A shelter column drawn half a tile wide is a
    // 14 px grey slab against a 22 px figure, and four shelters' worth of
    // them turned the first pass into a forest of pillars with a crowd
    // hiding somewhere behind it.
    pieces.push(...isoBox({
      cx: cx + index + 0.35,
      cy: cy + 0.35,
      sx: 0.18,
      sy: 0.18,
      height: lift,
      ramp: "steel",
      tag: `${prop.id}-column-${String(index)}`,
    }));
  }
  if (roof !== undefined) { pieces.push(...roofSlab(prop, roof, cloth)); }

  const lip = project(cx + 0.5, cy + 1.1);
  pieces.push(...hangingWares(prop, lip.x, lip.y - lift + 4, 32, 6));
  if (prop.signal !== undefined) {
    pieces.push(rectPiece(lip.x - 7, lip.y - lift + 2, 14, 2, emissionFill(prop, "idle"), `${prop.id}-signal`, false, "signal"));
  }
  return pieces;
}

/** Waist cover, soft: sacks a unit crouches behind. */
function sandbagLine(prop: Prop): Piece[] {
  const { cx, cy } = prop;
  const pieces: Piece[] = [contactShadow(cx, cy, 2, 1, prop.id)];
  const rows: [number, number, number][] = [[0, 0, 0], [1, 0, 0], [0.5, 0.05, 5]];
  for (const [dx, dy, lift] of rows) {
    pieces.push(...isoBox({
      cx: cx + dx,
      cy: cy + dy,
      sx: 0.95,
      sy: 0.85,
      height: 5,
      lift,
      ramp: "sandbag",
      tag: `${prop.id}-bag-${String(dx)}-${String(lift)}`,
    }));
  }
  return pieces;
}

/** Waist cover, hard: a poured barrier with a hazard chevron. */
function jerseyBarrier(prop: Prop): Piece[] {
  const { cx, cy } = prop;
  const foot = project(cx + 0.5, cy + 0.6);
  return [
    contactShadow(cx, cy, 2, 1, prop.id),
    ...isoBox({ cx, cy, sx: 1.95, sy: 0.72, height: 8, ramp: "concrete", tag: `${prop.id}-base` }),
    ...isoBox({ cx: cx + 0.1, cy: cy + 0.08, sx: 1.75, sy: 0.56, height: 5, lift: 8, ramp: "concrete", tag: `${prop.id}-cap` }),
    rectPiece(foot.x - 16, foot.y - 9, 7, 4, ramps.hazard.base, `${prop.id}-chevron`, false),
    rectPiece(foot.x - 2, foot.y - 8, 7, 4, ramps.hazard.base, `${prop.id}-chevron`, false),
    rectPiece(foot.x + 12, foot.y - 7, 6, 4, ramps.hazard.shadow, `${prop.id}-chevron`, false),
  ];
}

/** Screen cover: two rails on posts. A unit reads *through* it. */
function railing(prop: Prop): Piece[] {
  const { cx, cy } = prop;
  const pieces: Piece[] = [contactShadow(cx, cy, 3, 0.5, prop.id)];
  for (let index = 0; index <= 3; index += 1) {
    pieces.push(...isoBox({ cx: cx + index, cy, sx: 0.12, sy: 0.12, height: 12, ramp: "steel", tag: `${prop.id}-post-${String(index)}` }));
  }
  const from = project(cx - 0.5, cy);
  const to = project(cx + 3, cy);
  for (const [height, thickness] of [[12, 2], [7, 2]] as [number, number][]) {
    pieces.push({
      points: [
        { x: from.x, y: from.y - height },
        { x: to.x, y: to.y - height },
        { x: to.x, y: to.y - height + thickness },
        { x: from.x, y: from.y - height + thickness },
      ],
      fill: ramps.steel.light,
      ink: false,
      role: "flat",
      tag: `${prop.id}-rail-${String(height)}`,
    });
  }
  return pieces;
}

/** Screen cover, tall: mesh occludes in a stipple, posts occlude solidly. */
function chainFence(prop: Prop): Piece[] {
  const { cx, cy } = prop;
  const spec = propSpecs.chainFence;
  const pieces: Piece[] = [contactShadow(cx, cy, 3, 0.5, prop.id)];
  for (let index = 0; index <= 3; index += 1) {
    pieces.push(...isoBox({ cx: cx + index, cy, sx: 0.14, sy: 0.14, height: spec.height, ramp: "steel", tag: `${prop.id}-post-${String(index)}` }));
  }
  const from = project(cx - 0.5, cy);
  const to = project(cx + 3, cy);
  pieces.push({
    points: [
      { x: from.x, y: from.y - spec.height },
      { x: to.x, y: to.y - spec.height },
      { x: to.x, y: to.y - 1 },
      { x: from.x, y: from.y - 1 },
    ],
    fill: ramps.steel.base,
    ink: false,
    role: "mesh",
    tag: `${prop.id}-mesh`,
  });
  pieces.push({
    points: [
      { x: from.x, y: from.y - spec.height },
      { x: to.x, y: to.y - spec.height },
      { x: to.x, y: to.y - spec.height + 2 },
      { x: from.x, y: from.y - spec.height + 2 },
    ],
    fill: ramps.steel.light,
    ink: false,
    role: "flat",
    tag: `${prop.id}-toprail`,
  });
  return pieces;
}

function crateStack(prop: Prop): Piece[] {
  const { cx, cy } = prop;
  const ramp = toneRamp(prop, "wood", "rust");
  return [
    contactShadow(cx, cy, 1, 1, prop.id),
    ...isoBox({ cx, cy, sx: 0.92, sy: 0.92, height: 11, ramp, tag: `${prop.id}-a` }),
    ...isoBox({ cx: cx + 0.1, cy: cy + 0.14, sx: 0.68, sy: 0.66, height: 7, lift: 11, ramp: "steel", tag: `${prop.id}-b` }),
  ];
}

function barrelPair(prop: Prop): Piece[] {
  const { cx, cy } = prop;
  const ramp = toneRamp(prop, "rust", "steel");
  return [
    contactShadow(cx, cy, 1, 1, prop.id),
    ...isoBox({ cx: cx - 0.05, cy, sx: 0.5, sy: 0.5, height: 16, ramp, tag: `${prop.id}-a` }),
    ...isoBox({ cx: cx + 0.45, cy: cy + 0.36, sx: 0.5, sy: 0.5, height: 14, ramp: "steel", tag: `${prop.id}-b` }),
  ];
}

function vent(prop: Prop): Piece[] {
  const { cx, cy } = prop;
  return [
    contactShadow(cx, cy, 1, 1, prop.id),
    ...isoBox({ cx, cy, sx: 0.85, sy: 0.85, height: 9, ramp: "steel", tag: `${prop.id}-body` }),
    ...isoBox({ cx: cx + 0.15, cy: cy + 0.15, sx: 0.55, sy: 0.55, height: 3, lift: 9, ramp: "grate", tag: `${prop.id}-fan` }),
  ];
}

function pipeRack(prop: Prop): Piece[] {
  const { cx, cy } = prop;
  const pieces: Piece[] = [contactShadow(cx, cy, 1, 2, prop.id)];
  pieces.push(...isoBox({ cx, cy, sx: 0.85, sy: 1.8, height: 5, ramp: "steel", tag: `${prop.id}-base` }));
  for (let index = 0; index < 3; index += 1) {
    pieces.push(...isoBox({
      cx: cx + 0.06,
      cy: cy + 0.1,
      sx: 0.72,
      sy: 1.6,
      height: 4,
      lift: 5 + index * 5,
      ramp: "rust",
      tag: `${prop.id}-pipe-${String(index)}`,
    }));
  }
  return pieces;
}

function dumpster(prop: Prop): Piece[] {
  const { cx, cy } = prop;
  return [
    contactShadow(cx, cy, 2, 1, prop.id),
    ...isoBox({ cx, cy, sx: 1.8, sy: 0.9, height: 13, ramp: "rust", tag: `${prop.id}-body` }),
    ...isoBox({ cx: cx - 0.05, cy: cy - 0.05, sx: 1.9, sy: 1, height: 3, lift: 13, ramp: "grate", tag: `${prop.id}-lid` }),
  ];
}

function cableSpool(prop: Prop): Piece[] {
  const { cx, cy } = prop;
  return [
    contactShadow(cx, cy, 1, 1, prop.id),
    ...isoBox({ cx, cy, sx: 0.8, sy: 0.8, height: 4, ramp: "wood", tag: `${prop.id}-flange` }),
    ...isoBox({ cx: cx + 0.12, cy: cy + 0.12, sx: 0.56, sy: 0.56, height: 6, lift: 4, ramp: "grate", tag: `${prop.id}-coil` }),
    ...isoBox({ cx, cy, sx: 0.8, sy: 0.8, height: 3, lift: 10, ramp: "wood", tag: `${prop.id}-flange-top` }),
  ];
}

function rubble(prop: Prop): Piece[] {
  const { cx, cy } = prop;
  const pieces: Piece[] = [];
  const chunks = [
    { dx: 0, dy: 0, size: 0.4, height: 5 },
    { dx: 0.42, dy: 0.14, size: 0.28, height: 3 },
    { dx: 0.14, dy: 0.48, size: 0.24, height: 4 },
    { dx: 0.56, dy: 0.56, size: 0.3, height: 2 },
  ];
  for (const [index, chunk] of chunks.entries()) {
    pieces.push(...isoBox({
      cx: cx + chunk.dx,
      cy: cy + chunk.dy,
      sx: chunk.size,
      sy: chunk.size,
      height: chunk.height,
      ramp: index % 2 === 0 ? "concrete" : toneRamp(prop, "rust", "grate"),
      tag: `${prop.id}-chunk-${String(index)}`,
    }));
  }
  return pieces;
}

/** Narrow full-height occluder — the pole class, at architectural scale. */
function pillar(prop: Prop): Piece[] {
  const { cx, cy } = prop;
  const spec = propSpecs.pillar;
  return [
    contactShadow(cx, cy, 1, 1, prop.id),
    ...isoBox({ cx: cx + 0.1, cy: cy + 0.1, sx: 0.8, sy: 0.8, height: 4, ramp: "concrete", tag: `${prop.id}-plinth` }),
    ...isoBox({ cx: cx + 0.28, cy: cy + 0.28, sx: 0.44, sy: 0.44, height: spec.height - 8, lift: 4, ramp: "concrete", tag: `${prop.id}-shaft` }),
    ...isoBox({ cx: cx + 0.1, cy: cy + 0.1, sx: 0.8, sy: 0.8, height: 4, lift: spec.height - 4, ramp: "concrete", tag: `${prop.id}-capital` }),
  ];
}

/** Full cover, hard: a unit behind this is simply gone. */
function container(prop: Prop): Piece[] {
  const { cx, cy } = prop;
  const spec = propSpecs.container;
  const ramp = toneRamp(prop, "rust", "containerBlue");
  const pieces: Piece[] = [
    contactShadow(cx, cy, 3, 2, prop.id),
    ...isoBox({ cx, cy, sx: 2.95, sy: 1.95, height: spec.height, ramp, tag: `${prop.id}-body` }),
    ...isoBox({ cx: cx - 0.05, cy: cy - 0.05, sx: 3.05, sy: 2.05, height: 2, lift: spec.height, ramp: "steel", tag: `${prop.id}-cap` }),
  ];
  // Door end: three ribs so the mass reads as a container and not a slab.
  const face = project(cx - 0.5, cy + 1.45);
  for (let index = 0; index < 3; index += 1) {
    pieces.push(rectPiece(face.x + 3 + index * 6, face.y - spec.height + 4, 2, spec.height - 8, shadeOf(ramp, "shadow"), `${prop.id}-rib-${String(index)}`, false));
  }
  if (prop.signal !== undefined) {
    pieces.push(rectPiece(face.x + 4, face.y - 7, 12, 2, emissionFill(prop, "idle"), `${prop.id}-signal`, false, "signal"));
  }
  return pieces;
}

/** Full cover with a broken top line — the silhouette variety test. */
function hulk(prop: Prop): Piece[] {
  const { cx, cy } = prop;
  const ramp = toneRamp(prop, "rust", "steel");
  return [
    contactShadow(cx, cy, 3, 2, prop.id),
    ...isoBox({ cx, cy, sx: 2.9, sy: 1.9, height: 9, ramp, tag: `${prop.id}-chassis` }),
    ...isoBox({ cx: cx + 0.3, cy: cy + 0.25, sx: 1.4, sy: 1.4, height: 11, lift: 9, ramp, tag: `${prop.id}-cab` }),
    ...isoBox({ cx: cx + 1.9, cy: cy + 0.4, sx: 0.8, sy: 1.1, height: 5, lift: 9, ramp: "grate", tag: `${prop.id}-bed` }),
    ...isoBox({ cx: cx + 0.15, cy: cy + 1.55, sx: 0.5, sy: 0.5, height: 5, ramp: "grate", tag: `${prop.id}-wheel-a` }),
    ...isoBox({ cx: cx + 2.2, cy: cy + 1.55, sx: 0.5, sy: 0.5, height: 5, ramp: "grate", tag: `${prop.id}-wheel-b` }),
  ];
}

function lampPost(prop: Prop): Piece[] {
  const { cx, cy } = prop;
  const foot = project(cx, cy);
  const spec = propSpecs.lampPost;
  return [
    contactShadow(cx, cy, 0.5, 0.5, prop.id),
    ...isoBox({ cx: cx + 0.35, cy: cy + 0.35, sx: 0.3, sy: 0.3, height: 4, ramp: "concrete", tag: `${prop.id}-foot` }),
    rectPiece(foot.x - 1, foot.y - spec.height, 3, spec.height - 2, ramps.steel.base, `${prop.id}-pole`),
    rectPiece(foot.x - 6, foot.y - spec.height - 5, 13, 6, ramps.steel.shadow, `${prop.id}-head`),
    rectPiece(foot.x - 4, foot.y - spec.height, 9, 3, emissionFill(prop, "active"), `${prop.id}-signal`, false, "signal"),
    rectPiece(foot.x - 1, foot.y - spec.height, 3, 2, emissionFill(prop, "hot"), `${prop.id}-signal`, false, "signal"),
  ];
}

function signPylon(prop: Prop): Piece[] {
  const { cx, cy } = prop;
  const foot = project(cx, cy);
  const spec = propSpecs.signPylon;
  return [
    contactShadow(cx, cy, 0.6, 0.6, prop.id),
    ...isoBox({ cx: cx + 0.3, cy: cy + 0.3, sx: 0.4, sy: 0.4, height: 5, ramp: "concrete", tag: `${prop.id}-foot` }),
    rectPiece(foot.x - 2, foot.y - spec.height, 5, spec.height - 3, ramps.steel.shadow, `${prop.id}-mast`),
    rectPiece(foot.x - 11, foot.y - spec.height - 22, 23, 24, ramps.plum.base, `${prop.id}-panel`),
    rectPiece(foot.x - 8, foot.y - spec.height - 18, 17, 6, emissionFill(prop, "idle"), `${prop.id}-signal`, false, "signal"),
    rectPiece(foot.x - 8, foot.y - spec.height - 9, 17, 5, emissionFill(prop, "active"), `${prop.id}-signal`, false, "signal"),
    rectPiece(foot.x - 8, foot.y - spec.height - 9, 5, 5, emissionFill(prop, "hot"), `${prop.id}-signal`, false, "signal"),
  ];
}

function blockWall(prop: Prop): Piece[] {
  const { cx, cy } = prop;
  const spec = propSpecs.blockWall;
  const height = prop.tone === "warm" ? spec.height : spec.height - 18;
  const pieces = isoBox({
    cx,
    cy,
    sx: 3.9,
    sy: 1.9,
    height,
    ramp: prop.tone === "warm" ? "brick" : "concrete",
    tag: `${prop.id}-mass`,
  });
  const anchor = project(cx + 1.4, cy + 1.4);
  pieces.push(rectPiece(anchor.x - 20, anchor.y - height + 16, 7, 5, emissions.amber.idle, `${prop.id}-window`, false, "signal"));
  pieces.push(rectPiece(anchor.x + 8, anchor.y - height + 26, 6, 4, emissions.teal.idle, `${prop.id}-window`, false, "signal"));
  return pieces;
}

const builders: Record<Prop["kind"], (prop: Prop) => Piece[]> = {
  awningStall,
  barrelPair,
  blockWall,
  cableSpool,
  canopySpan,
  chainFence,
  container,
  crateStack,
  dumpster,
  hulk,
  jerseyBarrier,
  lampPost,
  pillar,
  pipeRack,
  railing,
  rubble,
  sandbagLine,
  signPylon,
  vent,
};

/** Every prop's pieces, already painter-sorted back to front. */
export function propPieces(): Piece[] {
  return sortedProps().flatMap((prop) => builders[prop.kind](prop));
}

/** Pieces for one prop, for the swatch and cover-sheet views. */
export function piecesForProp(prop: Prop): Piece[] {
  return builders[prop.kind](prop);
}

/* ------------------------------------------------------------------ */
/* Ground + backdrop                                                   */
/* ------------------------------------------------------------------ */

/**
 * Deterministic 3×3-cell value clusters. Comic-book flatness wants *few,
 * large* value areas, not per-tile noise, so the cluster is coarse and the
 * same clusters drive treatment B's shading.
 */
export function groundShade(cx: number, cy: number): Shade {
  const cluster = (Math.floor(cx / 5) * 7 + Math.floor(cy / 4) * 13) % 6;
  if (cluster === 0) { return "light"; }
  if (cluster === 2) { return "shadow"; }
  return "base";
}

/**
 * The floor colour of one cell, *including* the evidence that there is a
 * ceiling. Under a roof the floor drops one rung on its own ramp; inside a
 * roof's cast shadow it drops one rung as well. Both are value steps in the
 * material's own ramp rather than black laid over the top, so the floor still
 * reads as that floor and the frame stays palette-indexed.
 */
export function groundFill(cx: number, cy: number): string {
  const base = shadeOf(groundAt(cx, cy), groundShade(cx, cy));
  if (underCover(cx, cy)) { return shadeStep(base); }
  if (inCanopyShadow(cx, cy)) { return shadeStep(base); }
  return base;
}

export function groundDiamond(cx: number, cy: number): Point[] {
  const centre = project(cx, cy);
  return [
    { x: centre.x, y: centre.y - TILE_H / 2 },
    { x: centre.x + TILE_W / 2, y: centre.y },
    { x: centre.x, y: centre.y + TILE_H / 2 },
    { x: centre.x - TILE_W / 2, y: centre.y },
  ];
}

/** How far outside the playable grid a cell sits (0 = on the board). */
export function apronRing(cx: number, cy: number): number {
  const overX = Math.max(0, -cx, cx - (GRID - 1));
  const overY = Math.max(0, -cy, cy - (GRID - 1));
  return Math.max(overX, overY);
}

const APRON = 9;

/** Everything above this line is skyline, not floor. */
const HORIZON_Y = 62;

/**
 * The plaza and the district pavement it sits in.
 *
 * Round 1 let the apron fall to plum-black over three rings. That reads as a
 * lit tabletop in a void, and it is the single biggest reason the round-1
 * frame measured 45 % backdrop: a diamond inscribed in a rectangle covers
 * exactly half of it, so *every* full-board view of a plaza has enormous
 * corners, and round 1 filled all four of them with ink.
 *
 * Round 2 runs the apron out far enough to reach the frame corners and keeps
 * it as lit pavement, with the falloff pushed to the outermost rings and the
 * whole thing clipped at the horizon so the skyline still reads. The corners
 * become street rather than void, which is where most of the round-2
 * readability gain actually comes from.
 */
export function groundPieces(): Piece[] {
  const pieces: Piece[] = [];
  const lo = -APRON;
  const hi = GRID - 1 + APRON;
  for (let sum = lo * 2; sum <= hi * 2; sum += 1) {
    for (let cx = lo; cx <= hi; cx += 1) {
      const cy = sum - cx;
      if (cy < lo || cy > hi) { continue; }
      const centre = project(cx, cy);
      if (centre.y + TILE_H / 2 < HORIZON_Y) { continue; }
      const ring = apronRing(cx, cy);
      const fill = ring === 0
        ? groundFill(cx, cy)
        : ring <= 4 ? apronFill(cx, cy) : ring === 5 ? ramps.pavement.shadow : ring === 6 ? INK_SOFT : INK;
      pieces.push({
        points: groundDiamond(cx, cy),
        fill,
        ink: false,
        role: "ground",
        tag: `ground-${String(cx)}-${String(cy)}`,
      });
    }
  }
  return pieces;
}

/** District pavement: the same coarse clusters, one material. */
export function apronFill(cx: number, cy: number): string {
  return shadeOf("pavement", groundShade(cx, cy));
}

/** Material boundaries — the "clean internal separations" of the register. */
export function groundSeams(): { from: Point; to: Point }[] {
  const seams: { from: Point; to: Point }[] = [];
  for (let cx = 0; cx < GRID; cx += 1) {
    for (let cy = 0; cy < GRID; cy += 1) {
      const here = groundAt(cx, cy);
      const [north, east, south, west] = groundDiamond(cx, cy);
      if (north === undefined || east === undefined || south === undefined || west === undefined) { continue; }
      if (cx + 1 < GRID && groundAt(cx + 1, cy) !== here) { seams.push({ from: east, to: south }); }
      if (cy + 1 < GRID && groundAt(cx, cy + 1) !== here) { seams.push({ from: south, to: west }); }
    }
  }
  return seams;
}

/**
 * The hard outline of every canopy's cast shadow. The per-cell value step in
 * `groundFill` supplies the shadow's mass; this supplies its *edge*, which is
 * what makes it read as a shape thrown by a specific roof rather than as a
 * patch of dirtier floor.
 */
export function shadowSeams(): { from: Point; to: Point }[] {
  const seams: { from: Point; to: Point }[] = [];
  for (let cx = 0; cx < GRID; cx += 1) {
    for (let cy = 0; cy < GRID; cy += 1) {
      if (!inCanopyShadow(cx, cy) && !underCover(cx, cy)) { continue; }
      const shaded = (x: number, y: number) => inCanopyShadow(x, y) || underCover(x, y);
      const [north, east, south, west] = groundDiamond(cx, cy);
      if (north === undefined || east === undefined || south === undefined || west === undefined) { continue; }
      if (!shaded(cx - 1, cy)) { seams.push({ from: north, to: west }); }
      if (!shaded(cx, cy - 1)) { seams.push({ from: north, to: east }); }
      if (!shaded(cx + 1, cy)) { seams.push({ from: east, to: south }); }
      if (!shaded(cx, cy + 1)) { seams.push({ from: south, to: west }); }
    }
  }
  return seams;
}

/** Distant industrial canyon behind the plaza. Identical in both lanes. */
export function backdropPieces(): Piece[] {
  const sky: Piece = {
    points: [
      { x: 0, y: 0 },
      { x: BOARD_WIDTH, y: 0 },
      { x: BOARD_WIDTH, y: BOARD_HEIGHT },
      { x: 0, y: BOARD_HEIGHT },
    ],
    fill: backdrop.far,
    ink: false,
    role: "flat",
    tag: "sky",
  };
  const pieces: Piece[] = [sky];
  const towers = [
    { x: 8, w: 54, h: 62 },
    { x: 68, w: 34, h: 44 },
    { x: 110, w: 62, h: 78 },
    { x: 182, w: 30, h: 36 },
    { x: 222, w: 48, h: 56 },
    { x: 288, w: 40, h: 70 },
    { x: 340, w: 56, h: 48 },
    { x: 406, w: 32, h: 64 },
    { x: 448, w: 52, h: 40 },
    { x: 510, w: 38, h: 58 },
    { x: 558, w: 58, h: 74 },
    { x: 624, w: 42, h: 50 },
  ];
  for (const [index, tower] of towers.entries()) {
    pieces.push(rectPiece(tower.x, 48 - tower.h, tower.w, tower.h + 10, index % 2 === 0 ? backdrop.mid : backdrop.near, `tower-${String(index)}`, false));
  }
  pieces.push(rectPiece(0, 40, BOARD_WIDTH, 16, backdrop.hazeWarm, "haze", false));
  pieces.push(rectPiece(0, 52, BOARD_WIDTH, 8, INK, "horizon-ink", false));
  return pieces;
}

/* ------------------------------------------------------------------ */
/* Ambient                                                             */
/* ------------------------------------------------------------------ */

interface SignalIdentity { channel: EmissionName; level: "active" | "hot" | "housing" | "idle" }

const signalByColor = new Map<string, SignalIdentity>();
for (const [channel, ramp] of Object.entries(emissions) as [EmissionName, typeof emissions.amber][]) {
  signalByColor.set(ramp.housing, { channel, level: "housing" });
  signalByColor.set(ramp.idle, { channel, level: "idle" });
  signalByColor.set(ramp.active, { channel, level: "active" });
  signalByColor.set(ramp.hot, { channel, level: "hot" });
}

/**
 * Ambient flicker without leaving the palette: a dimmed signal steps *down the
 * emission ramp* (hot → active → idle) rather than being blended with an
 * alpha, so every frame of the filmstrip stays palette-conformant and the #68
 * signal law still reads.
 */
export function applyAmbient(pieces: Piece[], ambient: Ambient): Piece[] {
  const out: Piece[] = [];
  for (const piece of pieces) {
    const identity = signalByColor.get(piece.fill);
    if (identity === undefined || identity.level === "housing") {
      out.push(piece);
      continue;
    }
    const level = identity.channel === "amber" ? ambient.amber : ambient.teal;
    const ramp = emissions[identity.channel];
    if (identity.level === "hot") {
      if (level >= 0.95) { out.push(piece); }
      continue;
    }
    if (identity.level === "active") {
      out.push({ ...piece, fill: level >= 0.7 ? ramp.active : ramp.idle });
      continue;
    }
    out.push({ ...piece, fill: level >= 0.7 ? ramp.idle : ramp.housing });
  }
  return out;
}

/** Vent steam: three staggered puffs per vent, same schedule in both lanes. */
export function steamPieces(ambient: Ambient): Piece[] {
  const pieces: Piece[] = [];
  for (const prop of props) {
    if (prop.kind !== "vent") { continue; }
    const foot = project(prop.cx, prop.cy);
    ambient.steamAlive.forEach((alive, index) => {
      if (!alive) { return; }
      const rise = 12 + index * 8 + ambient.steamRise;
      const width = 7 + index * 3;
      const fill = index === 0 ? ramps.concrete.light : ramps.concrete.base;
      pieces.push(rectPiece(
        foot.x - width / 2 + index,
        foot.y - rise,
        width,
        Math.max(3, 6 - index),
        fill,
        `${prop.id}-steam-${String(index)}`,
        false,
        "flat",
      ));
    });
  }
  return pieces;
}
