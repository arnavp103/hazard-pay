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
      y: centre.y + (point.y - centre.y) * 1.08 + 1,
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
    ...isoBox({ cx, cy, sx: 2, sy: 1.6, height: 18, ramp: "wood", tag: `${prop.id}-counter` }),
    // Back shelving.
    ...isoBox({ cx: cx + 1.5, cy, sx: 0.5, sy: 1.6, height: 40, ramp: "steel", tag: `${prop.id}-shelf` }),
    // Corner posts.
    ...isoBox({ cx: cx - 0.35, cy: cy - 0.35, sx: 0.22, sy: 0.22, height: 46, ramp: "steel", tag: `${prop.id}-post` }),
    ...isoBox({ cx: cx + 1.7, cy: cy + 1.3, sx: 0.22, sy: 0.22, height: 46, ramp: "steel", tag: `${prop.id}-post` }),
    // Awning slab, lifted clear of the counter.
    ...isoBox({ cx: cx - 0.4, cy: cy - 0.4, sx: 2.5, sy: 2.3, height: 5, lift: 44, ramp: canopy, tag: `${prop.id}-awning` }),
  ];

  // Stall signal: a strip lamp under the awning lip.
  const lamp = project(cx + 0.4, cy + 1.2);
  pieces.push(rectPiece(lamp.x - 9, lamp.y - 40, 18, 3, emissionFill(prop, "active"), `${prop.id}-signal`, false, "signal"));
  pieces.push(rectPiece(lamp.x - 3, lamp.y - 40, 5, 2, emissionFill(prop, "hot"), `${prop.id}-signal`, false, "signal"));
  return pieces;
}

function crateStack(prop: Prop): Piece[] {
  const { cx, cy } = prop;
  const ramp = toneRamp(prop, "wood", "rust");
  return [
    contactShadow(cx, cy, 1, 1, prop.id),
    ...isoBox({ cx, cy, sx: 0.95, sy: 0.95, height: 14, ramp, tag: `${prop.id}-a` }),
    ...isoBox({ cx: cx + 0.1, cy: cy + 0.12, sx: 0.72, sy: 0.72, height: 12, lift: 14, ramp, tag: `${prop.id}-b` }),
    ...isoBox({ cx: cx + 0.02, cy: cy + 0.3, sx: 0.6, sy: 0.55, height: 9, lift: 26, ramp: "steel", tag: `${prop.id}-c` }),
  ];
}

function barrelPair(prop: Prop): Piece[] {
  const { cx, cy } = prop;
  const ramp = toneRamp(prop, "rust", "steel");
  return [
    contactShadow(cx, cy, 1.1, 1, prop.id),
    ...isoBox({ cx, cy, sx: 0.55, sy: 0.55, height: 17, ramp, tag: `${prop.id}-a` }),
    ...isoBox({ cx: cx + 0.55, cy: cy + 0.35, sx: 0.55, sy: 0.55, height: 17, ramp: "steel", tag: `${prop.id}-b` }),
  ];
}

function vent(prop: Prop): Piece[] {
  const { cx, cy } = prop;
  return [
    contactShadow(cx, cy, 1, 1, prop.id),
    ...isoBox({ cx, cy, sx: 0.9, sy: 0.9, height: 13, ramp: "steel", tag: `${prop.id}-body` }),
    ...isoBox({ cx: cx + 0.15, cy: cy + 0.15, sx: 0.6, sy: 0.6, height: 3, lift: 13, ramp: "grate", tag: `${prop.id}-fan` }),
  ];
}

function pipeRack(prop: Prop): Piece[] {
  const { cx, cy } = prop;
  const pieces: Piece[] = [contactShadow(cx, cy, 1, 2, prop.id)];
  pieces.push(...isoBox({ cx, cy, sx: 0.9, sy: 1.8, height: 6, ramp: "steel", tag: `${prop.id}-base` }));
  for (let index = 0; index < 3; index += 1) {
    pieces.push(...isoBox({
      cx: cx + 0.05,
      cy: cy + 0.1,
      sx: 0.8,
      sy: 1.6,
      height: 4,
      lift: 6 + index * 5,
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
    ...isoBox({ cx, cy, sx: 1.35, sy: 0.95, height: 16, ramp: toneRamp(prop, "rust", "steel"), tag: `${prop.id}-body` }),
    ...isoBox({ cx: cx - 0.05, cy: cy - 0.05, sx: 1.45, sy: 1.05, height: 3, lift: 16, ramp: "grate", tag: `${prop.id}-lid` }),
  ];
}

function cableSpool(prop: Prop): Piece[] {
  const { cx, cy } = prop;
  return [
    contactShadow(cx, cy, 1, 1, prop.id),
    ...isoBox({ cx, cy, sx: 0.85, sy: 0.85, height: 4, ramp: "wood", tag: `${prop.id}-flange` }),
    ...isoBox({ cx: cx + 0.12, cy: cy + 0.12, sx: 0.6, sy: 0.6, height: 8, lift: 4, ramp: "grate", tag: `${prop.id}-coil` }),
    ...isoBox({ cx, cy, sx: 0.85, sy: 0.85, height: 4, lift: 12, ramp: "wood", tag: `${prop.id}-flange` }),
  ];
}

function rubble(prop: Prop): Piece[] {
  const { cx, cy } = prop;
  const pieces: Piece[] = [];
  const chunks = [
    { dx: 0, dy: 0, size: 0.42, height: 5 },
    { dx: 0.45, dy: 0.15, size: 0.3, height: 3 },
    { dx: 0.15, dy: 0.5, size: 0.26, height: 4 },
    { dx: 0.6, dy: 0.6, size: 0.34, height: 2 },
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
    ...isoBox({ cx, cy, sx: 0.28, sy: 0.28, height: 5, ramp: "concrete", tag: `${prop.id}-foot` }),
    rectPiece(foot.x - 2, foot.y - 48, 4, 45, ramps.steel.base, `${prop.id}-pole`),
    rectPiece(foot.x - 7, foot.y - 56, 14, 8, ramps.steel.shadow, `${prop.id}-head`),
    rectPiece(foot.x - 5, foot.y - 50, 10, 3, emissionFill(prop, "active"), `${prop.id}-signal`, false, "signal"),
    rectPiece(foot.x - 2, foot.y - 50, 4, 2, emissionFill(prop, "hot"), `${prop.id}-signal`, false, "signal"),
  ];
}

function signPylon(prop: Prop): Piece[] {
  const { cx, cy } = prop;
  const foot = project(cx, cy);
  return [
    contactShadow(cx, cy, 0.7, 0.7, prop.id),
    ...isoBox({ cx, cy, sx: 0.35, sy: 0.35, height: 6, ramp: "concrete", tag: `${prop.id}-foot` }),
    rectPiece(foot.x - 3, foot.y - 52, 6, 48, ramps.steel.shadow, `${prop.id}-mast`),
    rectPiece(foot.x - 13, foot.y - 74, 26, 26, ramps.plum.base, `${prop.id}-panel`),
    rectPiece(foot.x - 10, foot.y - 71, 20, 8, emissionFill(prop, "idle"), `${prop.id}-signal`, false, "signal"),
    rectPiece(foot.x - 10, foot.y - 60, 20, 5, emissionFill(prop, "active"), `${prop.id}-signal`, false, "signal"),
    rectPiece(foot.x - 10, foot.y - 60, 6, 5, emissionFill(prop, "hot"), `${prop.id}-signal`, false, "signal"),
  ];
}

function blockWall(prop: Prop): Piece[] {
  const { cx, cy } = prop;
  const pieces = isoBox({
    cx,
    cy,
    sx: 3.6,
    sy: 1.8,
    height: prop.tone === "warm" ? 72 : 58,
    ramp: prop.tone === "warm" ? "plum" : "concrete",
    tag: `${prop.id}-mass`,
  });
  // Two lit windows per block; the only emission allowed on the backdrop mass.
  const anchor = project(cx + 1.4, cy + 1.4);
  pieces.push(rectPiece(anchor.x - 18, anchor.y - 44, 7, 5, emissions.amber.idle, `${prop.id}-window`, false, "signal"));
  pieces.push(rectPiece(anchor.x + 6, anchor.y - 52, 6, 4, emissions.teal.idle, `${prop.id}-window`, false, "signal"));
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
  const cluster = (Math.floor(cx / 3) * 7 + Math.floor(cy / 3) * 11) % 5;
  if (cluster === 0) { return "light"; }
  if (cluster === 1 || cluster === 3) { return "shadow"; }
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

export function groundPieces(): Piece[] {
  const pieces: Piece[] = [];
  for (let sum = 0; sum <= (GRID - 1) * 2; sum += 1) {
    for (let cx = 0; cx < GRID; cx += 1) {
      const cy = sum - cx;
      if (cy < 0 || cy >= GRID) { continue; }
      pieces.push({
        points: groundDiamond(cx, cy),
        fill: groundFill(cx, cy),
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
    { x: 12, w: 46, h: 62 },
    { x: 64, w: 30, h: 44 },
    { x: 104, w: 58, h: 78 },
    { x: 172, w: 26, h: 36 },
    { x: 210, w: 44, h: 56 },
    { x: 268, w: 36, h: 70 },
    { x: 318, w: 52, h: 48 },
    { x: 382, w: 28, h: 64 },
    { x: 420, w: 48, h: 40 },
    { x: 478, w: 34, h: 58 },
    { x: 522, w: 56, h: 74 },
    { x: 590, w: 40, h: 50 },
  ];
  for (const [index, tower] of towers.entries()) {
    pieces.push(rectPiece(tower.x, 46 - tower.h, tower.w, tower.h + 8, index % 2 === 0 ? backdrop.mid : backdrop.near, `tower-${String(index)}`, false));
  }
  pieces.push(rectPiece(0, 40, BOARD_WIDTH, 14, backdrop.hazeWarm, "haze", false));
  pieces.push(rectPiece(0, 50, BOARD_WIDTH, 6, INK, "horizon-ink", false));
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
      const rise = 16 + index * 9 + ambient.steamRise;
      const width = 7 + index * 3;
      const fill = index === 0 ? ramps.concrete.light : ramps.concrete.base;
      pieces.push(rectPiece(
        foot.x - width / 2 + index * 2,
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
