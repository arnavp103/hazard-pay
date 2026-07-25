/**
 * THROWAWAY PROTOTYPE (#91) — shared geometry for both treatments.
 *
 * The bake-off only means something if the two treatments draw the *same*
 * board, so shape and colour are resolved once, here, in board-pixel
 * space. Treatment A turns these polygons into SVG paths with ink
 * contours; treatment B scanline-fills the identical polygons into a pixel
 * buffer and then runs its own surface-detail pass over them.
 *
 * What each treatment adds on top is exactly the experimental variable:
 * A adds vector contour language, B adds handcrafted pixel surface.
 */

import {
  type EmissionName,
  type RampName,
  INK,
  INK_SOFT,
  backdrop,
  emissions,
  ramps,
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
  props,
  sortedProps,
} from "./board-model.ts";

export type Shade = "base" | "light" | "shadow" | "spec";
export type Role = "flat" | "ground" | "left" | "right" | "signal" | "top";

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

  const topFace: Piece = {
    points: top,
    fill: shadeOf(ramp, FACE_SHADE.top),
    ink: true,
    role: "top",
    tag,
  };
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
      x: centre.x + (point.x - centre.x) * 1.08,
      y: centre.y + (point.y - centre.y) * 1.08 + 2,
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

/* ------------------------------------------------------------------ */
/* Prop builders                                                       */
/* ------------------------------------------------------------------ */

function awningStall(prop: Prop): Piece[] {
  const { cx, cy } = prop;
  const canopy = toneRamp(prop, "canvasWarm", "canvasCool");
  const pieces: Piece[] = [
    contactShadow(cx, cy, 2, 2, prop.id),
    // Counter run.
    ...isoBox({ cx, cy, sx: 2, sy: 1.6, height: 34, ramp: "wood", tag: `${prop.id}-counter` }),
    // Back shelving.
    ...isoBox({ cx: cx + 1.5, cy, sx: 0.5, sy: 1.6, height: 76, ramp: "steel", tag: `${prop.id}-shelf` }),
    // Corner posts.
    ...isoBox({ cx: cx - 0.35, cy: cy - 0.35, sx: 0.14, sy: 0.14, height: 88, ramp: "grate", tag: `${prop.id}-post` }),
    ...isoBox({ cx: cx + 1.7, cy: cy + 1.3, sx: 0.14, sy: 0.14, height: 88, ramp: "grate", tag: `${prop.id}-post` }),
    // Awning slab, lifted clear of the counter, with a hanging valance so
    // the canopy reads as fabric rather than as a floating shelf.
    ...isoBox({ cx: cx - 0.4, cy: cy - 0.4, sx: 2.5, sy: 2.3, height: 9, lift: 84, ramp: canopy, tag: `${prop.id}-awning` }),
    ...isoBox({ cx: cx - 0.4, cy: cy + 1.75, sx: 2.5, sy: 0.15, height: 13, lift: 71, ramp: canopy, tag: `${prop.id}-valance` }),
    ...isoBox({ cx: cx + 1.95, cy: cy - 0.4, sx: 0.15, sy: 2.3, height: 13, lift: 71, ramp: canopy, tag: `${prop.id}-valance` }),
  ];

  // Stall signal: a strip lamp under the awning lip.
  const lamp = project(cx + 0.4, cy + 1.2);
  pieces.push(rectPiece(lamp.x - 17, lamp.y - 76, 34, 5, emissionFill(prop, "active"), `${prop.id}-signal`, false, "signal"));
  pieces.push(rectPiece(lamp.x - 6, lamp.y - 76, 9, 4, emissionFill(prop, "hot"), `${prop.id}-signal`, false, "signal"));
  return pieces;
}

function crateStack(prop: Prop): Piece[] {
  const { cx, cy } = prop;
  const ramp = toneRamp(prop, "wood", "rust");
  return [
    contactShadow(cx, cy, 1, 1, prop.id),
    ...isoBox({ cx, cy, sx: 0.95, sy: 0.95, height: 27, ramp, tag: `${prop.id}-a` }),
    ...isoBox({ cx: cx + 0.1, cy: cy + 0.12, sx: 0.72, sy: 0.72, height: 23, lift: 27, ramp, tag: `${prop.id}-b` }),
    ...isoBox({ cx: cx + 0.02, cy: cy + 0.3, sx: 0.6, sy: 0.55, height: 17, lift: 50, ramp: "steel", tag: `${prop.id}-c` }),
  ];
}

function barrelPair(prop: Prop): Piece[] {
  const { cx, cy } = prop;
  const ramp = toneRamp(prop, "rust", "steel");
  return [
    contactShadow(cx, cy, 1.1, 1, prop.id),
    ...isoBox({ cx, cy, sx: 0.55, sy: 0.55, height: 32, ramp, tag: `${prop.id}-a` }),
    ...isoBox({ cx: cx + 0.55, cy: cy + 0.35, sx: 0.55, sy: 0.55, height: 32, ramp: "steel", tag: `${prop.id}-b` }),
  ];
}

function vent(prop: Prop): Piece[] {
  const { cx, cy } = prop;
  return [
    contactShadow(cx, cy, 1, 1, prop.id),
    ...isoBox({ cx, cy, sx: 0.9, sy: 0.9, height: 25, ramp: "steel", tag: `${prop.id}-body` }),
    ...isoBox({ cx: cx + 0.15, cy: cy + 0.15, sx: 0.6, sy: 0.6, height: 6, lift: 25, ramp: "grate", tag: `${prop.id}-fan` }),
  ];
}

function pipeRack(prop: Prop): Piece[] {
  const { cx, cy } = prop;
  const pieces: Piece[] = [contactShadow(cx, cy, 1, 2, prop.id)];
  pieces.push(...isoBox({ cx, cy, sx: 0.9, sy: 1.8, height: 11, ramp: "steel", tag: `${prop.id}-base` }));
  for (let index = 0; index < 3; index += 1) {
    pieces.push(...isoBox({
      cx: cx + 0.05,
      cy: cy + 0.1,
      sx: 0.8,
      sy: 1.6,
      height: 8,
      lift: 11 + index * 9,
      ramp: toneRamp(prop, "rust", "steel"),
      tag: `${prop.id}-pipe-${String(index)}`,
    }));
  }
  return pieces;
}

function dumpster(prop: Prop): Piece[] {
  const { cx, cy } = prop;
  return [
    contactShadow(cx, cy, 1.4, 1, prop.id),
    ...isoBox({ cx, cy, sx: 1.35, sy: 0.95, height: 30, ramp: toneRamp(prop, "rust", "steel"), tag: `${prop.id}-body` }),
    ...isoBox({ cx: cx - 0.05, cy: cy - 0.05, sx: 1.45, sy: 1.05, height: 6, lift: 30, ramp: "grate", tag: `${prop.id}-lid` }),
  ];
}

function cableSpool(prop: Prop): Piece[] {
  const { cx, cy } = prop;
  return [
    contactShadow(cx, cy, 1, 1, prop.id),
    ...isoBox({ cx, cy, sx: 0.85, sy: 0.85, height: 8, ramp: "wood", tag: `${prop.id}-flange` }),
    ...isoBox({ cx: cx + 0.12, cy: cy + 0.12, sx: 0.6, sy: 0.6, height: 15, lift: 8, ramp: "grate", tag: `${prop.id}-coil` }),
    ...isoBox({ cx, cy, sx: 0.85, sy: 0.85, height: 8, lift: 23, ramp: "wood", tag: `${prop.id}-flange` }),
  ];
}

function rubble(prop: Prop): Piece[] {
  const { cx, cy } = prop;
  const pieces: Piece[] = [];
  const chunks = [
    { dx: 0, dy: 0, size: 0.42, height: 9 },
    { dx: 0.45, dy: 0.15, size: 0.3, height: 6 },
    { dx: 0.15, dy: 0.5, size: 0.26, height: 8 },
    { dx: 0.6, dy: 0.6, size: 0.34, height: 4 },
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

function lampPost(prop: Prop): Piece[] {
  const { cx, cy } = prop;
  const foot = project(cx, cy);
  return [
    contactShadow(cx, cy, 0.6, 0.6, prop.id),
    ...isoBox({ cx, cy, sx: 0.28, sy: 0.28, height: 9, ramp: "concrete", tag: `${prop.id}-foot` }),
    rectPiece(foot.x - 4, foot.y - 92, 7, 86, ramps.steel.base, `${prop.id}-pole`),
    rectPiece(foot.x - 13, foot.y - 107, 26, 15, ramps.steel.shadow, `${prop.id}-head`),
    rectPiece(foot.x - 9, foot.y - 96, 18, 6, emissionFill(prop, "active"), `${prop.id}-signal`, false, "signal"),
    rectPiece(foot.x - 4, foot.y - 96, 7, 4, emissionFill(prop, "hot"), `${prop.id}-signal`, false, "signal"),
  ];
}

function signPylon(prop: Prop): Piece[] {
  const { cx, cy } = prop;
  const foot = project(cx, cy);
  return [
    contactShadow(cx, cy, 0.7, 0.7, prop.id),
    ...isoBox({ cx, cy, sx: 0.35, sy: 0.35, height: 11, ramp: "concrete", tag: `${prop.id}-foot` }),
    rectPiece(foot.x - 6, foot.y - 100, 11, 92, ramps.steel.shadow, `${prop.id}-mast`),
    rectPiece(foot.x - 25, foot.y - 142, 50, 50, ramps.plum.base, `${prop.id}-panel`),
    rectPiece(foot.x - 19, foot.y - 136, 38, 15, emissionFill(prop, "idle"), `${prop.id}-signal`, false, "signal"),
    rectPiece(foot.x - 19, foot.y - 115, 38, 10, emissionFill(prop, "active"), `${prop.id}-signal`, false, "signal"),
    rectPiece(foot.x - 19, foot.y - 115, 11, 10, emissionFill(prop, "hot"), `${prop.id}-signal`, false, "signal"),
  ];
}

function blockWall(prop: Prop): Piece[] {
  const { cx, cy } = prop;
  const pieces = isoBox({
    cx,
    cy,
    sx: 3.6,
    sy: 1.8,
    height: prop.tone === "warm" ? 138 : 111,
    ramp: prop.tone === "warm" ? "plum" : "concrete",
    tag: `${prop.id}-mass`,
  });
  // Two lit windows per block; the only emission allowed on the backdrop mass.
  const anchor = project(cx + 1.4, cy + 1.4);
  pieces.push(rectPiece(anchor.x - 34, anchor.y - 84, 13, 9, emissions.amber.idle, `${prop.id}-window`, false, "signal"));
  pieces.push(rectPiece(anchor.x + 11, anchor.y - 100, 11, 8, emissions.teal.idle, `${prop.id}-window`, false, "signal"));
  return pieces;
}

const builders: Record<Prop["kind"], (prop: Prop) => Piece[]> = {
  awningStall,
  barrelPair,
  blockWall,
  cableSpool,
  crateStack,
  dumpster,
  lampPost,
  pipeRack,
  rubble,
  signPylon,
  vent,
};

/** Every prop's pieces, already painter-sorted back to front. */
export function propPieces(): Piece[] {
  return sortedProps().flatMap((prop) => builders[prop.kind](prop));
}

/** Pieces for one prop, for the authored-vs-procedural comparison view. */
export function piecesForProp(prop: Prop): Piece[] {
  return builders[prop.kind](prop);
}

/* ------------------------------------------------------------------ */
/* Ground + backdrop                                                   */
/* ------------------------------------------------------------------ */

/**
 * Deterministic 3×3-cell value clusters. Comic-book flatness wants *few,
 * large* value areas, not per-tile noise, so the cluster is coarse and
 * the same clusters drive treatment B's shading.
 */
export function groundShade(cx: number, cy: number): Shade {
  const cluster = (Math.floor(cx / 5) * 7 + Math.floor(cy / 4) * 13) % 6;
  if (cluster === 0) { return "light"; }
  if (cluster === 2) { return "shadow"; }
  return "base";
}

export function groundFill(cx: number, cy: number): string {
  return shadeOf(groundAt(cx, cy), groundShade(cx, cy));
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

const APRON = 3;

export function groundPieces(): Piece[] {
  const pieces: Piece[] = [];
  const lo = -APRON;
  const hi = GRID - 1 + APRON;
  for (let sum = lo * 2; sum <= hi * 2; sum += 1) {
    for (let cx = lo; cx <= hi; cx += 1) {
      const cy = sum - cx;
      if (cy < lo || cy > hi) { continue; }
      const ring = apronRing(cx, cy);
      // The apron is the unlit ground the board sits in: it falls to ink
      // over three rings so the playable diamond reads as a lit plaza in a
      // dark district, not as a tabletop floating in a void.
      const fill = ring === 0
        ? groundFill(cx, cy)
        : ring === 1 ? ramps.asphalt.shadow : ring === 2 ? INK_SOFT : INK;
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

/** Material boundaries — the "clean internal separations" of the register. */
export function groundSeams(): { from: Point; to: Point }[] {
  const seams: { from: Point; to: Point }[] = [];
  for (let cx = 0; cx < GRID; cx += 1) {
    for (let cy = 0; cy < GRID; cy += 1) {
      const here = groundAt(cx, cy);
      const diamond = groundDiamond(cx, cy);
      const [north, east, south, west] = diamond;
      if (north === undefined || east === undefined || south === undefined || west === undefined) { continue; }
      if (cx + 1 < GRID && groundAt(cx + 1, cy) !== here) { seams.push({ from: east, to: south }); }
      if (cy + 1 < GRID && groundAt(cx, cy + 1) !== here) { seams.push({ from: south, to: west }); }
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
    { x: 24, w: 92, h: 124 },
    { x: 128, w: 60, h: 88 },
    { x: 208, w: 116, h: 156 },
    { x: 344, w: 52, h: 72 },
    { x: 420, w: 88, h: 112 },
    { x: 536, w: 72, h: 140 },
    { x: 636, w: 104, h: 96 },
    { x: 764, w: 56, h: 128 },
    { x: 840, w: 96, h: 80 },
    { x: 956, w: 68, h: 116 },
    { x: 1044, w: 112, h: 148 },
    { x: 1180, w: 80, h: 100 },
  ];
  for (const [index, tower] of towers.entries()) {
    pieces.push(rectPiece(tower.x, 92 - tower.h, tower.w, tower.h + 16, index % 2 === 0 ? backdrop.mid : backdrop.near, `tower-${String(index)}`, false));
  }
  pieces.push(rectPiece(0, 80, BOARD_WIDTH, 28, backdrop.hazeWarm, "haze", false));
  pieces.push(rectPiece(0, 100, BOARD_WIDTH, 12, INK, "horizon-ink", false));
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
 * Ambient flicker without leaving the palette: a dimmed signal steps *down
 * the emission ramp* (hot → active → idle) rather than being blended with
 * an alpha, so every frame of the filmstrip stays palette-conformant and
 * the #68 signal law still reads.
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
      const rise = 30 + index * 17 + ambient.steamRise;
      const width = 13 + index * 6;
      const fill = index === 0 ? ramps.concrete.light : ramps.concrete.base;
      pieces.push(rectPiece(
        foot.x - width / 2 + index * 2,
        foot.y - rise,
        width,
        Math.max(6, 12 - index * 2),
        fill,
        `${prop.id}-steam-${String(index)}`,
        false,
        "flat",
      ));
    });
  }
  return pieces;
}
