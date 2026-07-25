/**
 * THROWAWAY PROTOTYPE (#91, round 2) — the occlusion compositor.
 *
 * This module is round 1's bug, fixed, and the fix is structural rather than
 * cosmetic.
 *
 * Round 1 rendered the board to one canvas and the entire unit roster to a
 * second canvas, then drew the second over the first. Under that pipeline a
 * unit is in front of every prop on the board by construction — no amount of
 * sorting inside either layer can change it — which is why the round-1
 * captures show figures standing on crate lids and inside awnings. It reads as
 * a bug because it *is* one, and it is a bug about compositing structure, not
 * about draw order.
 *
 * Round 2 keeps the two treatments' board passes intact (that is the
 * experimental variable and it must not move) and instead composites units
 * against a **depth index built from the shared prop geometry**:
 *
 *   1. `sceneOrder` interleaves props and units into one topological painter
 *      order (`occupancy.ts`).
 *   2. Every prop stamps its own pixel mask into `frontIndex`, recording the
 *      order index of the *frontmost* prop covering each board pixel.
 *   3. A unit at order index `i` may only paint pixel `p` where
 *      `frontIndex[p] <= i`. Anything nearer the camera cuts it.
 *
 * Because the mask comes from the shared geometry rather than from either
 * renderer, occlusion is identical in treatment A and treatment B, and the
 * comparison stays honest. And because step 3 is a plain array test, the
 * result is measurable: `occlusionReport` returns how many pixels of each unit
 * survived and which prop ate the rest, which is what the round-2 brief asks
 * to be proven mechanically instead of by eye.
 */

import {
  type Prop,
  type UnitPlacement,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  project,
} from "./board-model.ts";
import { type SceneItem, sceneOrder, units as defaultRoster } from "./roster.ts";
import { type Surface, clusterField, getPixel, polygonPixels, setPixel } from "./pixel-canvas.ts";
import { INK_SOFT, luma } from "./palette.ts";
import { inShade } from "./occupancy.ts";
import { meshBlocks, piecesForProp } from "./prop-geometry.ts";
import {
  MARKING_RADIUS,
  contouredRows,
  gridFor,
  markingBrightLimit,
  markingOffsets,
  markingPaletteFor,
  markingRole,
  paletteFor,
} from "./unit-sprites.ts";

const TRANSPARENT = ".";

function pixelKey(x: number, y: number): number {
  return y * BOARD_WIDTH + x;
}

/**
 * Roof geometry, which is exempt from occluding units.
 *
 * A canopy's *footprint* is its column or its counter — one or four tiles —
 * but its *geometry* spans five tiles of roof, thirty-odd pixels in the air.
 * If the roof joins the occluding mask, every unit standing under the canopy
 * is erased by the ceiling above its own head, because the whole prop is
 * sorted at the column's depth. That is a worse artefact than the one round 2
 * set out to fix, and it is what the first build of this compositor did.
 *
 * The exemption is deliberate and it is an approximation: a roof at lift 32
 * genuinely *can* clip the crown of a unit standing several tiles behind it,
 * and here it will not. At a 22 px figure that is a two-or-three-pixel error
 * on a handful of units; solving it properly needs per-piece footprints and a
 * real height field, which is more machinery than a throwaway register test
 * should carry. Recorded rather than hidden.
 */
const ROOF_TAGS = ["-awning", "-canopy", "-valance"];

/**
 * Which of a prop's pieces are solid mass. Contact shadows lie on the floor
 * and signal overlays sit on the prop's own face, so neither occludes.
 */
function occludingPixels(prop: Prop): { dilate: boolean; x: number; y: number }[] {
  const out: { dilate: boolean; x: number; y: number }[] = [];
  for (const piece of piecesForProp(prop)) {
    if (ROOF_TAGS.some((tag) => piece.tag.includes(tag))) { continue; }
    if (piece.role === "mesh") {
      // NOT dilated. A one-pixel dilation closes a four-pixel lattice, which
      // turns a chain fence into a solid steel panel — the first build of this
      // compositor hid 84 % of the unit standing behind one.
      for (const pixel of polygonPixels(piece.points, BOARD_WIDTH, BOARD_HEIGHT)) {
        if (meshBlocks(pixel.x, pixel.y)) { out.push({ dilate: false, x: pixel.x, y: pixel.y }); }
      }
      continue;
    }
    if (!piece.ink) { continue; }
    for (const pixel of polygonPixels(piece.points, BOARD_WIDTH, BOARD_HEIGHT)) {
      out.push({ dilate: true, x: pixel.x, y: pixel.y });
    }
  }
  return out;
}

export interface DepthIndex {
  /** Order index of the frontmost prop covering each board pixel, or -1. */
  frontIndex: Int32Array;
  order: SceneItem[];
}

/**
 * Build the depth index. The mask is dilated by one pixel because treatment A
 * draws a 2 px outer ink stroke around every prop, so its silhouette is a
 * pixel fatter than the raw polygon; dilating keeps the two treatments cutting
 * units in exactly the same place.
 */
export function buildDepthIndex(roster: readonly UnitPlacement[] = defaultRoster): DepthIndex {
  const order = sceneOrder(roster);
  const frontIndex = new Int32Array(BOARD_WIDTH * BOARD_HEIGHT).fill(-1);
  order.forEach((item, index) => {
    if (item.kind !== "prop") { return; }
    for (const pixel of occludingPixels(item.prop)) {
      const reach = pixel.dilate ? 1 : 0;
      for (let dy = -reach; dy <= reach; dy += 1) {
        for (let dx = -reach; dx <= reach; dx += 1) {
          const x = pixel.x + dx;
          const y = pixel.y + dy;
          if (x < 0 || y < 0 || x >= BOARD_WIDTH || y >= BOARD_HEIGHT) { continue; }
          const at = pixelKey(x, y);
          if ((frontIndex[at] ?? -1) < index) { frontIndex[at] = index; }
        }
      }
    }
  });
  return { frontIndex, order };
}

/** Squashed clustered blob under a unit so it is planted, not floating. */
function contactShadow(
  surface: Surface,
  x: number,
  y: number,
  radius: number,
  visible: (px: number, py: number) => boolean,
): void {
  for (let dy = -Math.ceil(radius / 2); dy <= Math.ceil(radius / 2); dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const inside = (dx * dx) / (radius * radius) + (dy * dy * 6) / (radius * radius) <= 1;
      if (!inside) { continue; }
      if (clusterField(x + dx, y + dy, 3, 47) < 0.3) { continue; }
      if (!visible(x + dx, y + dy)) { continue; }
      setPixel(surface, x + dx, y + dy, INK_SOFT);
    }
  }
}

export interface UnitOcclusion {
  unitId: string;
  /** Pixels the unit actually painted. */
  drawn: number;
  /** Pixels a nearer prop cut away. */
  hidden: number;
  /** `hidden / (drawn + hidden)`, 0 when nothing occludes. */
  fraction: number;
  /** Ids of the props responsible, frontmost first. */
  occluders: string[];
  /** Was this unit standing in shade (under a roof, or in one's shadow)? */
  shaded: boolean;
}

export interface ComposeResult {
  occlusion: UnitOcclusion[];
  /** Every background-facing silhouette edge on every composited unit. */
  edgesTotal: number;
  /**
   * Edges that needed ink or a rim light *because of low contrast* — the
   * figure/ground dissolve rate, and the number comparable with the sibling
   * lanes' 53 % and 4–7 %.
   */
  edgesDissolving: number;
  /**
   * Edges in the contact zone, which this lane inks unconditionally because
   * that edge is grounding rather than separation. Counted separately: folding
   * it into the dissolve rate would inflate the number by a quarter and make
   * it incomparable with anything.
   */
  edgesContact: number;
}

export interface ComposeOptions {
  roster?: readonly UnitPlacement[];
  /** Pre-built index, so a caller rendering both treatments pays once. */
  index?: DepthIndex;
}

/**
 * Composite the unit layer onto a finished board surface, with occlusion.
 *
 * The surface is read as well as written: the selective contour samples the
 * board *behind* each silhouette edge, and earlier units are already on the
 * buffer by the time later ones are drawn, so unit-versus-unit separation is
 * handled by the same rule as unit-versus-board.
 */
export function composeUnits(surface: Surface, options: ComposeOptions = {}): ComposeResult {
  const roster = options.roster ?? defaultRoster;
  const { frontIndex, order } = options.index ?? buildDepthIndex(roster);
  const occlusion: UnitOcclusion[] = [];
  let edgesTotal = 0;
  let edgesDissolving = 0;
  let edgesContact = 0;

  order.forEach((item, index) => {
    if (item.kind !== "unit") { return; }
    const unit = item.unit;
    const grid = gridFor(unit);
    const shaded = inShade(unit.cx, unit.cy);
    const palette = paletteFor(unit, shaded);
    const anchor = project(unit.cx, unit.cy);
    const originX = Math.round(anchor.x - grid.width / 2);
    const originY = Math.round(anchor.y - grid.bottomRow);

    const visible = (px: number, py: number): boolean => {
      if (px < 0 || py < 0 || px >= BOARD_WIDTH || py >= BOARD_HEIGHT) { return false; }
      return (frontIndex[pixelKey(px, py)] ?? -1) <= index;
    };

    contactShadow(surface, Math.round(anchor.x), Math.round(anchor.y), grid.tier === "hero" ? 7 : 6, visible);

    const sampleLuma = (gx: number, gy: number): number | null => {
      const hex = getPixel(surface, originX + gx, originY + gy);
      return hex === undefined ? null : luma(hex);
    };
    const rows = contouredRows(grid.rows, grid.width, palette, sampleLuma);

    // Figure/ground telemetry, measured off this lane's own composited buffer.
    const contactY = grid.bottomRow - Math.max(1, Math.round((grid.bottomRow - grid.topRow + 1) * 0.18));
    for (let y = 0; y < grid.rows.length; y += 1) {
      const before = grid.rows[y];
      const after = rows[y];
      if (before === undefined || after === undefined) { continue; }
      for (let x = 0; x < grid.width; x += 1) {
        const was = before[x];
        if (was === undefined || was === TRANSPARENT) { continue; }
        const isEdge = [[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => {
          const nx = x + (dx ?? 0);
          const ny = y + (dy ?? 0);
          return (grid.rows[ny]?.[nx] ?? TRANSPARENT) === TRANSPARENT;
        });
        if (!isEdge) { continue; }
        edgesTotal += 1;
        if (y >= contactY) {
          edgesContact += 1;
        } else if (after[x] !== was) {
          edgesDissolving += 1;
        }
      }
    }

    if (unit.tier === "hero") {
      const markPalette = markingPaletteFor(unit);
      const limit = markingBrightLimit(grid);
      for (const mark of markingOffsets(rows, grid.width, MARKING_RADIUS)) {
        if (mark.dy > grid.bottomRow) { continue; }
        const role = mark.dy > limit && mark.ring < MARKING_RADIUS ? "k" : markingRole(mark.ring, MARKING_RADIUS);
        const hex = markPalette[role];
        const px = originX + (unit.mirrored ? grid.width - 1 - mark.dx : mark.dx);
        const py = originY + mark.dy;
        if (hex === undefined || !visible(px, py)) { continue; }
        setPixel(surface, px, py, hex);
      }
    }

    let drawn = 0;
    let hidden = 0;
    const occluders = new Set<string>();
    for (let y = 0; y < rows.length; y += 1) {
      const row = rows[y];
      if (row === undefined) { continue; }
      for (let x = 0; x < grid.width; x += 1) {
        const role = row[unit.mirrored ? grid.width - 1 - x : x];
        if (role === undefined || role === TRANSPARENT) { continue; }
        const hex = palette[role];
        if (hex === undefined) { continue; }
        const px = originX + x;
        const py = originY + y;
        if (px < 0 || py < 0 || px >= BOARD_WIDTH || py >= BOARD_HEIGHT) { continue; }
        const front = frontIndex[pixelKey(px, py)] ?? -1;
        if (front > index) {
          hidden += 1;
          const owner = order[front];
          if (owner?.kind === "prop") { occluders.add(owner.prop.id); }
          continue;
        }
        setPixel(surface, px, py, hex);
        drawn += 1;
      }
    }

    occlusion.push({
      unitId: unit.id,
      drawn,
      hidden,
      fraction: drawn + hidden === 0 ? 0 : hidden / (drawn + hidden),
      occluders: [...occluders].sort((a, b) => a.localeCompare(b)),
      shaded,
    });
  });

  return { edgesContact, edgesDissolving, edgesTotal, occlusion };
}

/**
 * Occlusion telemetry without touching a surface — the cheap path for tests.
 * Renders onto a scratch buffer so the numbers are the real ones rather than a
 * second implementation that could drift from the renderer.
 */
export function occlusionReport(roster: readonly UnitPlacement[] = defaultRoster): UnitOcclusion[] {
  const scratch: Surface = {
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    data: new Uint8ClampedArray(BOARD_WIDTH * BOARD_HEIGHT * 4),
  };
  return composeUnits(scratch, { roster }).occlusion;
}
