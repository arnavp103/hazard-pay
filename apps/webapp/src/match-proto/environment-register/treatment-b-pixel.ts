/**
 * THROWAWAY PROTOTYPE (#91) — TREATMENT B: the Metal Slug Tactics register.
 *
 * Dense illustrative pixel: clustered shading, layered props and clutter,
 * warm lived-in surface detail, and a ground plane that still reads under
 * all of it. Same board, same geometry, same palette as treatment A — the
 * only variable is the register.
 *
 * The pipeline has four layers, and they are deliberately separable
 * (`?detail=0`, `?stamps=0`) because the separation *is* the finding:
 *
 *   1. GEOMETRY — shared with treatment A, scanline-filled at 1:1 with no
 *      antialiasing (`prop-geometry.ts`).
 *   2. SELECTIVE INK — a 1px plum-black silhouette per prop plus softer
 *      internal separations, instead of A's uniform vector contour.
 *   3. SURFACE PASSES — generated, per material: plank seams, bolt rows,
 *      rust bleed, awning stripes and folds, concrete patches, gravel and
 *      scuff clusters on the floor. This is what makes the board *dense*.
 *   4. AUTHORED STAMPS — five hand-typed text grids (`pixel-stamps.ts`)
 *      composited onto specific props. This is what makes the board
 *      *inhabited*, and it is the layer that does not scale.
 *
 * Layer 3 is cheap and generalises to any map. Layer 4 costs real authoring
 * time per motif and does not generalise at all. The gap between them is
 * the production risk this lane was asked to measure.
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
  sortedProps,
} from "./board-model.ts";
import {
  type Piece,
  applyAmbient,
  backdropPieces,
  groundDiamond,
  groundFill,
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
} from "./palette.ts";
import {
  bundleTop,
  counterClutter,
  groundJunk,
  junctionBox,
  stallGoods,
  stampPalette,
} from "./pixel-stamps.ts";

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

  // Window grids on the far towers: repeating architecture is the one
  // motif a generated pass can carry convincingly.
  for (let y = 4; y < 46; y += 4) {
    for (let x = 3; x < BOARD_WIDTH; x += 5) {
      const here = clusterField(x, y, 9, 3);
      if (here < 0.42) { continue; }
      const lit = clusterField(x, y, 5, 11);
      const color = lit > 0.86 ? emissions.amber.idle : lit > 0.8 ? emissions.teal.housing : INK;
      setPixel(surface, x, y, color);
      setPixel(surface, x + 1, y, color);
    }
  }
  // Haze band: clustered, not a gradient — the register has no gradients.
  for (let y = 40; y < 56; y += 1) {
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      if (clusterField(x, y, 6, 5) > 0.55) { continue; }
      setPixel(surface, x, y, y > 49 ? INK : backdrop.hazeWarm);
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

  for (const pixel of polygonPixels(groundDiamond(cx, cy), surface.width, surface.height)) {
    const { x, y } = pixel;
    const grime = clusterField(x, y, 11, 2);
    const fine = clusterField(x, y, 4, 7);

    if (material === "grate") {
      // Drain slats: the strongest read on the floor, so they stay hard.
      const slat = (y - cy) % 3 === 0;
      setPixel(surface, x, y, slat ? INK : fine > 0.7 ? ramp.light : ramp.base);
      continue;
    }
    if (material === "asphaltWet") {
      // Standing water: horizontal reflection runs, never per-pixel sparkle.
      if (fine > 0.74 && y % 2 === 0) {
        setPixel(surface, x, y, ramp.light);
      } else if (grime < 0.3) {
        setPixel(surface, x, y, ramp.shadow);
      }
      continue;
    }
    if (material === "mat") {
      // Woven stall matting: a 2px iso weave.
      if ((x + 2 * y) % 6 < 2) {
        setPixel(surface, x, y, ramp.shadow);
      } else if (grime > 0.72) {
        setPixel(surface, x, y, ramp.light);
      }
      continue;
    }
    if (material === "dirt") {
      if (fine > 0.78) {
        setPixel(surface, x, y, ramp.light);
      } else if (grime < 0.28) {
        setPixel(surface, x, y, ramp.shadow);
      }
      continue;
    }
    if (material === "concrete") {
      // Slab patches are clustered, never per-pixel noise.
      if (grime > 0.74) {
        setPixel(surface, x, y, ramp.light);
      } else if (grime < 0.24) {
        setPixel(surface, x, y, ramp.shadow);
      }
      continue;
    }
    // Asphalt: gravel clusters, tyre scuffs along the aisle direction.
    if (fine > 0.82) {
      setPixel(surface, x, y, ramp.light);
    } else if (grime < 0.26) {
      setPixel(surface, x, y, ramp.shadow);
    } else if (Math.abs(x - centre.x) < 9 && (x + 2 * y) % 24 === 0) {
      setPixel(surface, x, y, ramp.shadow);
    }
  }
}

function drawGround(surface: Surface, detail: boolean): void {
  for (let sum = 0; sum <= (GRID - 1) * 2; sum += 1) {
    for (let cx = 0; cx < GRID; cx += 1) {
      const cy = sum - cx;
      if (cy < 0 || cy >= GRID) { continue; }
      fillPolygon(surface, groundDiamond(cx, cy), groundFill(cx, cy));
      if (detail) { groundDetail(surface, cx, cy); }
    }
  }
  if (!detail) { return; }

  // Material seams, 1px and soft — the floor must not out-contrast units.
  for (let cx = 0; cx < GRID; cx += 1) {
    for (let cy = 0; cy < GRID; cy += 1) {
      const here = groundAt(cx, cy);
      const diamond = groundDiamond(cx, cy);
      const [, east, south, west] = diamond;
      if (east === undefined || south === undefined || west === undefined) { continue; }
      if (cx + 1 < GRID && groundAt(cx + 1, cy) !== here) { drawLine(surface, east, south, INK_SOFT); }
      if (cy + 1 < GRID && groundAt(cx, cy + 1) !== here) { drawLine(surface, south, west, INK_SOFT); }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Material surface passes                                             */
/* ------------------------------------------------------------------ */

const detailByRamp: Partial<Record<RampName, (surface: Surface, pixel: { x: number; y: number }, piece: Piece, ramp: Ramp) => void>> = {
  wood: (surface, pixel, piece, ramp) => {
    const { x, y } = pixel;
    const seam = piece.role === "top" ? (x + 2 * y) % 10 === 0 : x % 5 === 0;
    if (seam) {
      setPixel(surface, x, y, ramp.shadow);
      return;
    }
    const knot = clusterField(x, y, 6, 13);
    if (knot > 0.84) {
      setPixel(surface, x, y, ramp.shadow);
    } else if (knot < 0.16) {
      setPixel(surface, x, y, ramp.light);
    }
  },
  steel: (surface, pixel, piece, ramp) => {
    const { x, y } = pixel;
    if (x % 9 === 2 && y % 6 === 1) {
      setPixel(surface, x, y, ramps.steel.spec ?? ramp.light);
      return;
    }
    if (piece.role !== "top" && x % 7 === 0) {
      setPixel(surface, x, y, ramp.shadow);
      return;
    }
    const bleed = clusterField(x, y, 8, 17);
    if (bleed > 0.8) { setPixel(surface, x, y, ramps.rust.shadow); }
  },
  rust: (surface, pixel, _piece, ramp) => {
    const { x, y } = pixel;
    const blotch = clusterField(x, y, 7, 23);
    if (blotch > 0.72) {
      setPixel(surface, x, y, ramp.shadow);
    } else if (blotch < 0.2) {
      setPixel(surface, x, y, ramp.light);
    }
    if (y % 11 === 0 && blotch > 0.4) { setPixel(surface, x, y, INK_SOFT); }
  },
  concrete: (surface, pixel, _piece, ramp) => {
    const { x, y } = pixel;
    const patch = clusterField(x, y, 9, 29);
    if (patch > 0.78) {
      setPixel(surface, x, y, ramp.light);
    } else if (patch < 0.2) {
      setPixel(surface, x, y, ramp.shadow);
    }
  },
  plum: (surface, pixel, piece, ramp) => {
    const { x, y } = pixel;
    // Window grid on the wall faces.
    if (piece.role !== "top" && x % 11 < 5 && y % 9 < 4) {
      const lit = clusterField(x, y, 12, 31);
      setPixel(surface, x, y, lit > 0.72 ? emissions.amber.housing : INK);
      return;
    }
    const stain = clusterField(x, y, 10, 37);
    if (stain > 0.8) { setPixel(surface, x, y, ramp.shadow); }
  },
  canvasWarm: (surface, pixel, piece, ramp) => {
    const { x, y } = pixel;
    // Striped awning: bands along the iso axis, plus fold shadows.
    const band = ((x + 2 * y) % 18) < 9;
    if (band) { setPixel(surface, x, y, piece.role === "top" ? ramp.base : ramp.shadow); }
    if ((x + 2 * y) % 18 === 0) { setPixel(surface, x, y, INK_SOFT); }
  },
  canvasCool: (surface, pixel, piece, ramp) => {
    const { x, y } = pixel;
    const band = ((x + 2 * y) % 18) < 9;
    if (band) { setPixel(surface, x, y, piece.role === "top" ? ramp.base : ramp.shadow); }
    if ((x + 2 * y) % 18 === 0) { setPixel(surface, x, y, INK_SOFT); }
  },
  grate: (surface, pixel, _piece, ramp) => {
    const { x, y } = pixel;
    if (y % 2 === 0) {
      setPixel(surface, x, y, ramp.shadow);
    } else if (x % 6 === 1) {
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

/** 1px plum-black silhouette around a prop's own pixel mask. */
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

function stampsForProp(surface: Surface, prop: Prop): void {
  const foot = project(prop.cx, prop.cy);
  if (prop.kind === "awningStall") {
    const goods = project(prop.cx + 0.5, prop.cy + 0.4);
    stampGrid(surface, stallGoods.rows, stampPalette, goods.x, goods.y - 20);
    const counter = project(prop.cx + 0.5, prop.cy + 0.9);
    stampGrid(surface, counterClutter.rows, stampPalette, counter.x, counter.y - 12);
    return;
  }
  if (prop.kind === "crateStack") {
    stampGrid(surface, bundleTop.rows, stampPalette, foot.x + 2, foot.y - 32);
    return;
  }
  if (prop.kind === "blockWall") {
    const face = project(prop.cx + 0.6, prop.cy + 1.6);
    stampGrid(surface, junctionBox.rows, stampPalette, face.x, face.y - 22);
    return;
  }
  if (prop.kind === "rubble") {
    stampGrid(surface, groundJunk.rows, stampPalette, foot.x + 6, foot.y + 5);
  }
}

function drawProp(surface: Surface, prop: Prop, ambient: Ambient, detail: boolean, useStamps: boolean): void {
  const pieces = applyAmbient(piecesForProp(prop), ambient);
  const shadows = pieces.filter((piece) => !piece.ink && piece.role === "flat");
  const structural = pieces.filter((piece) => piece.ink);
  const signals = pieces.filter((piece) => piece.role === "signal");

  for (const piece of shadows) {
    for (const pixel of polygonPixels(piece.points, surface.width, surface.height)) {
      // Contact shadow is a clustered darkening, not a solid slab.
      if (clusterField(pixel.x, pixel.y, 5, 41) < 0.35) { continue; }
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

  // Internal separations first, then the outer silhouette overwrites them
  // at the boundary — the MST read: hard outside, softer inside.
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
      if (clusterField(pixel.x, pixel.y, 4, 43) < 0.42) { continue; }
      setPixel(surface, pixel.x, pixel.y, piece.fill);
    }
  }

  return surface;
}

/**
 * One prop rendered alone on a neutral field, for the authored-vs-generated
 * comparison capture. `stamps: false` is the same prop with layer 4 removed.
 */
export function renderPropSwatch(propId: string, options: PixelOptions = {}): Surface {
  const prop = sortedProps().find((entry) => entry.id === propId);
  const surface = createSurface(TILE_W * 5, TILE_H * 8);
  if (prop === undefined) { return surface; }

  for (let y = 0; y < surface.height; y += 1) {
    for (let x = 0; x < surface.width; x += 1) {
      setPixel(surface, x, y, clusterField(x, y, 9, 2) > 0.5 ? ramps.asphalt.base : ramps.asphalt.shadow);
    }
  }

  const foot = project(prop.cx, prop.cy);
  const offsetX = surface.width / 2 - foot.x;
  const offsetY = surface.height - 24 - foot.y;
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
