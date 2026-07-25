/**
 * THROWAWAY PROTOTYPE (#91) — TREATMENT B: the Metal Slug Tactics register.
 *
 * Dense illustrative pixel: clustered shading, layered props and clutter,
 * warm lived-in surface detail, and a ground plane that still reads under all
 * of it. Same board, same geometry, same palette as treatment A — the only
 * variable is the register.
 *
 * The pipeline has four layers, and they are deliberately separable
 * (`?detail=0`, `?stamps=0`) because the separation *is* the finding:
 *
 *   1. GEOMETRY — shared with treatment A, scanline-filled at 1:1 with no
 *      antialiasing (`prop-geometry.ts`).
 *   2. SELECTIVE INK — a 1 px plum-black silhouette per prop plus softer
 *      internal separations, instead of A's uniform vector contour.
 *   3. SURFACE PASSES — generated, per material: plank seams, bolt rows, rust
 *      bleed, canvas weave, concrete patches, gravel and scuff clusters on the
 *      floor. This is what makes the board *dense*.
 *   4. AUTHORED STAMPS — five hand-typed text grids (`pixel-stamps.ts`)
 *      composited onto specific props. This is what makes the board
 *      *inhabited*, and it is the layer that does not scale.
 *
 * Layer 3 is cheap and generalises to any map. Layer 4 costs real authoring
 * time per motif and does not generalise at all. The gap between them is the
 * production risk this lane was asked to measure.
 *
 * ROUND 2 additions, both about the ceiling: the floor's *generated* detail is
 * stepped down inside a canopy's shade along with its base fill, so the shadow
 * survives layer 3 instead of being scribbled over by it; and mesh pieces are
 * rasterized as an actual lattice, so a chain fence occludes in stripes.
 */

import {
  type Ambient,
  type Prop,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  GRID,
  TILE_H,
  TILE_W,
  ambientAt,
  groundAt,
  project,
  propSpecs,
} from "./board-model.ts";
import {
  type Piece,
  applyAmbient,
  backdropPieces,
  groundDiamond,
  groundPieces,
  meshBlocks,
  piecesForProp,
  steamPieces,
} from "./prop-geometry.ts";
import {
  type Surface,
  clusterField,
  createSurface,
  drawLine,
  fillPolygon,
  polygonPixels,
  setPixel,
  stampGrid,
} from "./pixel-canvas.ts";
import {
  type Ramp,
  type RampName,
  INK,
  INK_SOFT,
  backdrop,
  emissions,
  ramps,
  rampOf,
  shadeStep,
} from "./palette.ts";
import {
  bundleTop,
  containerTag,
  counterCrock,
  groundJunk,
  junctionBox,
  stampPalette,
} from "./pixel-stamps.ts";
import { inShade, sortedProps } from "./occupancy.ts";

export interface PixelOptions {
  /** Ambient frame index. */
  frame?: number;
  /** Generated surface-detail passes (layer 3). On by default. */
  detail?: boolean;
  /** Hand-authored stamps (layer 4). On by default. */
  stamps?: boolean;
}

/* ------------------------------------------------------------------ */
/* Backdrop                                                            */
/* ------------------------------------------------------------------ */

function drawBackdrop(surface: Surface, detail: boolean): void {
  for (const piece of backdropPieces()) {
    fillPolygon(surface, piece.points, piece.fill);
  }
  if (!detail) { return; }

  for (let y = 4; y < 50; y += 5) {
    for (let x = 3; x < BOARD_WIDTH; x += 6) {
      const here = clusterField(x, y, 7, 3);
      if (here < 0.45) { continue; }
      const lit = clusterField(x, y, 5, 11);
      const color = lit > 0.86 ? emissions.amber.idle : lit > 0.8 ? emissions.teal.housing : INK;
      for (let dy = 0; dy < 2; dy += 1) {
        for (let dx = 0; dx < 2; dx += 1) {
          setPixel(surface, x + dx, y + dy, color);
        }
      }
    }
  }
  for (let y = 42; y < 60; y += 1) {
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      if (clusterField(x, y, 5, 5) > 0.55) { continue; }
      setPixel(surface, x, y, y > 53 ? INK : backdrop.hazeWarm);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Ground                                                              */
/* ------------------------------------------------------------------ */

function groundDetail(surface: Surface, cx: number, cy: number): void {
  const material = groundAt(cx, cy);
  const centre = project(cx, cy);
  const ramp = ramps[material];
  const shaded = inShade(cx, cy);
  /** Every generated mark obeys the same shade step as the base fill. */
  const tone = (hex: string): string => (shaded ? shadeStep(hex) : hex);

  for (const pixel of polygonPixels(groundDiamond(cx, cy), surface.width, surface.height)) {
    const { x, y } = pixel;
    const grime = clusterField(x * 0.45, y * 1.7, 8, 2);
    const fine = clusterField(x * 0.6, y * 1.4, 3, 7);

    if (material === "grate") {
      const slat = (y - cy) % 3 === 0;
      setPixel(surface, x, y, slat ? INK : tone(fine > 0.7 ? ramp.light : ramp.base));
      continue;
    }
    if (material === "asphaltWet") {
      if (fine > 0.74 && y % 2 === 0) {
        setPixel(surface, x, y, tone(ramp.light));
      } else if (grime < 0.3) {
        setPixel(surface, x, y, tone(ramp.shadow));
      }
      continue;
    }
    if (material === "mat") {
      if ((x + 2 * y) % 5 < 2) {
        setPixel(surface, x, y, tone(ramp.shadow));
      } else if (grime > 0.72) {
        setPixel(surface, x, y, tone(ramp.light));
      }
      continue;
    }
    if (material === "dirt") {
      if (fine > 0.78) {
        setPixel(surface, x, y, tone(ramp.light));
      } else if (grime < 0.28) {
        setPixel(surface, x, y, tone(ramp.shadow));
      }
      continue;
    }
    if (material === "concrete") {
      if (grime > 0.74) {
        setPixel(surface, x, y, tone(ramp.light));
      } else if (grime < 0.24) {
        setPixel(surface, x, y, tone(ramp.shadow));
      }
      continue;
    }
    // Asphalt is the walkable lane, so it is held to the quietest discipline
    // on the board: sparse gravel, sparse smear, nothing that can compete
    // with a unit's drop shadow.
    if (fine > 0.9) {
      setPixel(surface, x, y, tone(ramp.light));
    } else if (grime < 0.14) {
      setPixel(surface, x, y, tone(ramp.shadow));
    } else if (Math.abs(x - centre.x) < 5 && (x + 2 * y) % 16 === 0) {
      setPixel(surface, x, y, tone(ramp.shadow));
    }
  }
  tileSeam(surface, cx, cy, tone(ramp.shadow));
}

/**
 * The tile grid has to survive the wear pass everywhere — tactical reading of
 * the walkable plane is non-negotiable, so the seam is drawn last.
 */
function tileSeam(surface: Surface, cx: number, cy: number, hex: string): void {
  const [north, east, south, west] = groundDiamond(cx, cy);
  if (north === undefined || east === undefined || south === undefined || west === undefined) { return; }
  drawLine(surface, north, east, hex);
  drawLine(surface, north, west, hex);
}

function drawGround(surface: Surface, detail: boolean): void {
  for (const piece of groundPieces()) {
    fillPolygon(surface, piece.points, piece.fill);
  }
  if (!detail) { return; }
  for (let sum = 0; sum <= (GRID - 1) * 2; sum += 1) {
    for (let cx = 0; cx < GRID; cx += 1) {
      const cy = sum - cx;
      if (cy < 0 || cy >= GRID) { continue; }
      groundDetail(surface, cx, cy);
    }
  }

  // The district pavement gets the same discipline as the plaza: coarse
  // clusters and a slab seam, nothing that can compete with a unit.
  for (const piece of groundPieces()) {
    if (piece.role !== "ground") { continue; }
    const ring = rampOf(piece.fill);
    if (ring !== "pavement") { continue; }
    for (const pixel of polygonPixels(piece.points, surface.width, surface.height)) {
      const patch = clusterField(pixel.x, pixel.y, 9, 53);
      if (patch > 0.87) {
        setPixel(surface, pixel.x, pixel.y, ramps.pavement.light);
      } else if (patch < 0.13) {
        setPixel(surface, pixel.x, pixel.y, ramps.pavement.shadow);
      }
    }
    const [north, east, west] = piece.points;
    if (north === undefined || east === undefined || west === undefined) { continue; }
    drawLine(surface, north, east, ramps.pavement.shadow);
    drawLine(surface, north, west, ramps.pavement.shadow);
  }

  // Material seams, 1 px and soft — the floor must not out-contrast units.
  for (let cx = 0; cx < GRID; cx += 1) {
    for (let cy = 0; cy < GRID; cy += 1) {
      const here = groundAt(cx, cy);
      const [, east, south, west] = groundDiamond(cx, cy);
      if (east === undefined || south === undefined || west === undefined) { continue; }
      if (cx + 1 < GRID && groundAt(cx + 1, cy) !== here) { drawLine(surface, east, south, INK_SOFT); }
      if (cy + 1 < GRID && groundAt(cx, cy + 1) !== here) { drawLine(surface, south, west, INK_SOFT); }
    }
  }

  // The canopy shadow's own edge, drawn last so nothing scribbles over it.
  for (let cx = 0; cx < GRID; cx += 1) {
    for (let cy = 0; cy < GRID; cy += 1) {
      if (!inShade(cx, cy)) { continue; }
      const [north, east, south, west] = groundDiamond(cx, cy);
      if (north === undefined || east === undefined || south === undefined || west === undefined) { continue; }
      if (!inShade(cx - 1, cy)) { drawLine(surface, north, west, INK_SOFT); }
      if (!inShade(cx, cy - 1)) { drawLine(surface, north, east, INK_SOFT); }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Material surface passes                                             */
/* ------------------------------------------------------------------ */

type DetailPass = (surface: Surface, pixel: { x: number; y: number }, piece: Piece, ramp: Ramp) => void;

const detailByRamp: Partial<Record<RampName, DetailPass>> = {
  wood: (surface, pixel, piece, ramp) => {
    const { x, y } = pixel;
    const seam = piece.role === "top" ? (x + 2 * y) % 7 === 0 : x % 4 === 0;
    if (seam) {
      setPixel(surface, x, y, ramp.shadow);
      return;
    }
    const knot = clusterField(x, y, 5, 13);
    if (knot > 0.86) { setPixel(surface, x, y, ramp.shadow); }
  },
  steel: (surface, pixel, piece, ramp) => {
    const { x, y } = pixel;
    if (x % 7 === 2 && y % 5 === 1) {
      setPixel(surface, x, y, ramps.steel.spec ?? ramp.light);
      return;
    }
    if (piece.role !== "top" && x % 6 === 0) {
      setPixel(surface, x, y, ramp.shadow);
      return;
    }
    const bleed = clusterField(x * 2.2, y * 0.4, 6, 17);
    if (bleed > 0.82) { setPixel(surface, x, y, ramps.rust.shadow); }
  },
  rust: (surface, pixel, _piece, ramp) => {
    const { x, y } = pixel;
    const blotch = clusterField(x * 1.8, y * 0.5, 5, 23);
    if (blotch > 0.74) {
      setPixel(surface, x, y, ramp.shadow);
    } else if (blotch < 0.18) {
      setPixel(surface, x, y, ramp.light);
    }
    if (y % 8 === 0 && blotch > 0.45) { setPixel(surface, x, y, INK_SOFT); }
  },
  containerBlue: (surface, pixel, _piece, ramp) => {
    const { x, y } = pixel;
    const blotch = clusterField(x * 1.6, y * 0.5, 6, 29);
    if (blotch > 0.8) {
      setPixel(surface, x, y, ramps.rust.shadow);
    } else if (blotch < 0.2) {
      setPixel(surface, x, y, ramp.light);
    }
  },
  brick: (surface, pixel, piece, ramp) => {
    const { x, y } = pixel;
    // Coursing: a bed joint every 4 px along the face's own iso axis, with the
    // perpends offset every other course. On a 4-cell wall this is the only
    // mark that says "masonry" rather than "large brown box".
    if (piece.role === "top") {
      if (clusterField(x, y, 5, 19) > 0.85) { setPixel(surface, x, y, ramp.shadow); }
      return;
    }
    const course = Math.floor((y + (piece.role === "right" ? 2 : 0)) / 4);
    if ((y + (piece.role === "right" ? 2 : 0)) % 4 === 0) {
      setPixel(surface, x, y, ramp.shadow);
      return;
    }
    if ((x + (course % 2) * 4) % 8 === 0) {
      setPixel(surface, x, y, ramp.shadow);
      return;
    }
    if (clusterField(x, y, 6, 19) > 0.88) { setPixel(surface, x, y, ramp.light); }
  },
  pavement: (surface, pixel, _piece, ramp) => {
    const { x, y } = pixel;
    const patch = clusterField(x, y, 9, 53);
    if (patch > 0.86) {
      setPixel(surface, x, y, ramp.light);
    } else if (patch < 0.14) {
      setPixel(surface, x, y, ramp.shadow);
    }
  },
  concrete: (surface, pixel, _piece, ramp) => {
    const { x, y } = pixel;
    const patch = clusterField(x, y, 7, 29);
    if (patch > 0.88) {
      setPixel(surface, x, y, ramp.light);
    } else if (patch < 0.12) {
      setPixel(surface, x, y, ramp.shadow);
    }
  },
  sandbag: (surface, pixel, _piece, ramp) => {
    const { x, y } = pixel;
    // Sacking: a coarse weave plus the seam where two bags meet.
    if ((x + 3 * y) % 6 === 0) {
      setPixel(surface, x, y, ramp.shadow);
    } else if (clusterField(x, y, 4, 31) > 0.8) {
      setPixel(surface, x, y, ramp.light);
    }
  },
  plum: (surface, pixel, piece, ramp) => {
    const { x, y } = pixel;
    if (piece.role !== "top" && x % 8 < 4 && y % 7 < 3) {
      const lit = clusterField(x, y, 9, 31);
      setPixel(surface, x, y, lit > 0.74 ? emissions.amber.housing : INK);
      return;
    }
    const stain = clusterField(x * 2.4, y * 0.35, 8, 37);
    if (stain > 0.82) { setPixel(surface, x, y, ramp.shadow); }
  },
  canvasWarm: (surface, pixel, piece, ramp) => {
    const { x, y } = pixel;
    const band = ((x + 2 * y) % 12) < 6;
    if (band) { setPixel(surface, x, y, piece.role === "top" ? ramp.base : ramp.shadow); }
    if ((x + 2 * y) % 12 === 0) { setPixel(surface, x, y, INK_SOFT); }
  },
  canvasCool: (surface, pixel, piece, ramp) => {
    const { x, y } = pixel;
    const band = ((x + 2 * y) % 12) < 6;
    if (band) { setPixel(surface, x, y, piece.role === "top" ? ramp.base : ramp.shadow); }
    if ((x + 2 * y) % 12 === 0) { setPixel(surface, x, y, INK_SOFT); }
  },
  grate: (surface, pixel, _piece, ramp) => {
    const { x, y } = pixel;
    if (y % 2 === 0) {
      setPixel(surface, x, y, ramp.shadow);
    } else if (x % 5 === 1) {
      setPixel(surface, x, y, ramp.light);
    }
  },
};

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

function key(x: number, y: number): number {
  return y * BOARD_WIDTH + x;
}

/** 1 px plum-black silhouette around a prop's own pixel mask. */
function inkSilhouette(surface: Surface, mask: Set<number>): void {
  const edges: { x: number; y: number }[] = [];
  for (const index of mask) {
    const x = index % BOARD_WIDTH;
    const y = Math.floor(index / BOARD_WIDTH);
    const outside = !mask.has(key(x - 1, y))
      || !mask.has(key(x + 1, y))
      || !mask.has(key(x, y - 1))
      || !mask.has(key(x, y + 1));
    if (outside) { edges.push({ x, y }); }
  }
  for (const edge of edges) { setPixel(surface, edge.x, edge.y, INK); }
}

/**
 * Where the authored grids go. Round 2 re-authored every one of them at the
 * 28×14 tile, so nothing is tiled to fake a size any more — each stamp is
 * placed once, on the surface it belongs to.
 */
function stampsForProp(surface: Surface, prop: Prop): void {
  const foot = project(prop.cx, prop.cy);
  if (prop.kind === "awningStall") {
    const counter = project(prop.cx + 0.55, prop.cy + 0.75);
    stampGrid(surface, counterCrock.rows, stampPalette, counter.x, counter.y - 13);
    return;
  }
  if (prop.kind === "crateStack") {
    stampGrid(surface, bundleTop.rows, stampPalette, foot.x + 1, foot.y - 18);
    return;
  }
  if (prop.kind === "container") {
    const face = project(prop.cx - 0.4, prop.cy + 1.4);
    stampGrid(surface, containerTag.rows, stampPalette, face.x + 11, face.y - 12);
    return;
  }
  if (prop.kind === "blockWall") {
    const face = project(prop.cx + 1.2, prop.cy + 1.9);
    stampGrid(surface, junctionBox.rows, stampPalette, face.x, face.y - 16);
    return;
  }
  if (prop.kind === "rubble") {
    stampGrid(surface, groundJunk.rows, stampPalette, foot.x + 6, foot.y + 5);
  }
}

function drawProp(surface: Surface, prop: Prop, ambient: Ambient, detail: boolean, useStamps: boolean): void {
  const pieces = applyAmbient(piecesForProp(prop), ambient);
  const shadows = pieces.filter((piece) => !piece.ink && piece.role === "flat");
  const structural = pieces.filter((piece) => piece.ink && piece.role !== "mesh");
  const meshes = pieces.filter((piece) => piece.role === "mesh");
  const signals = pieces.filter((piece) => piece.role === "signal");

  for (const piece of shadows) {
    for (const pixel of polygonPixels(piece.points, surface.width, surface.height)) {
      if (piece.tag.endsWith("-shadow") && clusterField(pixel.x, pixel.y, 4, 41) < 0.3) { continue; }
      setPixel(surface, pixel.x, pixel.y, piece.fill);
    }
  }

  const mask = new Set<number>();
  for (const piece of structural) {
    const pixels = polygonPixels(piece.points, surface.width, surface.height);
    const ramp = rampOf(piece.fill);
    const pass = ramp === undefined ? undefined : detailByRamp[ramp];
    for (const pixel of pixels) {
      setPixel(surface, pixel.x, pixel.y, piece.fill);
      mask.add(key(pixel.x, pixel.y));
    }
    if (!detail || pass === undefined || ramp === undefined) { continue; }
    for (const pixel of pixels) { pass(surface, pixel, piece, ramps[ramp]); }
  }

  // Internal separations first, then the outer silhouette overwrites them at
  // the boundary — the MST read: hard outside, softer inside.
  if (detail) {
    for (const piece of structural) {
      const points = piece.points;
      for (let index = 0; index < points.length; index += 1) {
        const from = points[index];
        const to = points[(index + 1) % points.length];
        if (from === undefined || to === undefined) { continue; }
        drawLine(surface, from, to, INK_SOFT);
      }
    }
  }
  inkSilhouette(surface, mask);

  // Mesh is rasterized as an actual lattice on the same pitch `compose.ts`
  // occludes with, so what you see through the fence is what a unit behind it
  // gets cut by.
  for (const piece of meshes) {
    for (const pixel of polygonPixels(piece.points, surface.width, surface.height)) {
      if (!meshBlocks(pixel.x, pixel.y)) { continue; }
      setPixel(surface, pixel.x, pixel.y, (pixel.x + pixel.y) % 8 === 0 ? ramps.steel.light : piece.fill);
    }
  }

  if (useStamps) { stampsForProp(surface, prop); }

  for (const piece of signals) {
    fillPolygon(surface, piece.points, piece.fill);
  }
}

/* ------------------------------------------------------------------ */
/* Composite                                                           */
/* ------------------------------------------------------------------ */

export function renderBoardPixels(options: PixelOptions = {}): Surface {
  const ambient = ambientAt(options.frame ?? 0);
  const detail = options.detail ?? true;
  const useStamps = options.stamps ?? true;
  const surface = createSurface(BOARD_WIDTH, BOARD_HEIGHT);

  drawBackdrop(surface, detail);
  drawGround(surface, detail);
  for (const prop of sortedProps()) { drawProp(surface, prop, ambient, detail, useStamps); }

  for (const piece of applyAmbient(steamPieces(ambient), ambient)) {
    for (const pixel of polygonPixels(piece.points, surface.width, surface.height)) {
      if (clusterField(pixel.x, pixel.y, 3, 43) < 0.42) { continue; }
      setPixel(surface, pixel.x, pixel.y, piece.fill);
    }
  }

  return surface;
}

/**
 * One prop rendered alone on a neutral field, for the authored-vs-generated
 * comparison capture and for the cover-variety sheet. `stamps: false` is the
 * same prop with layer 4 removed.
 */
export function renderPropSwatch(propId: string, options: PixelOptions = {}): Surface {
  const prop = sortedProps().find((entry) => entry.id === propId);
  const surface = createSurface(TILE_W * 5, TILE_H * 7);
  if (prop === undefined) { return surface; }

  for (let y = 0; y < surface.height; y += 1) {
    for (let x = 0; x < surface.width; x += 1) {
      setPixel(surface, x, y, clusterField(x, y, 7, 2) > 0.5 ? ramps.asphalt.base : ramps.asphalt.shadow);
    }
  }

  const spec = propSpecs[prop.kind];
  const foot = project(prop.cx + spec.sx / 2 - 0.5, prop.cy + spec.sy / 2 - 0.5);
  const offsetX = surface.width / 2 - foot.x;
  const offsetY = surface.height - 22 - foot.y;
  const scratch = createSurface(BOARD_WIDTH, BOARD_HEIGHT);
  drawProp(scratch, prop, ambientAt(options.frame ?? 0), options.detail ?? true, options.stamps ?? true);

  for (let y = 0; y < surface.height; y += 1) {
    for (let x = 0; x < surface.width; x += 1) {
      const sourceX = Math.round(x - offsetX);
      const sourceY = Math.round(y - offsetY);
      if (sourceX < 0 || sourceY < 0 || sourceX >= BOARD_WIDTH || sourceY >= BOARD_HEIGHT) { continue; }
      const at = (sourceY * BOARD_WIDTH + sourceX) * 4;
      if ((scratch.data[at + 3] ?? 0) === 0) { continue; }
      const target = (y * surface.width + x) * 4;
      surface.data[target] = scratch.data[at] ?? 0;
      surface.data[target + 1] = scratch.data[at + 1] ?? 0;
      surface.data[target + 2] = scratch.data[at + 2] ?? 0;
      surface.data[target + 3] = 0xff;
    }
  }
  return surface;
}

export { BOARD_HEIGHT, BOARD_WIDTH };
