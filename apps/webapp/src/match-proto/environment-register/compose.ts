/**
 * THROWAWAY PROTOTYPE (#91) — the unit layer, shared by both treatments.
 *
 * Units are composited by exactly this code over treatment A and over
 * treatment B, at the same cells, in the same order, with the same contact
 * shadows. If the two captures differ in how the characters sit, the
 * difference is the board's doing — which is the whole point of the lane.
 */

import { type Tier, type UnitPlacement, depth, project, units } from "./board-model.ts";
import { type Surface, clusterField, setPixel } from "./pixel-canvas.ts";
import { INK_SOFT } from "./palette.ts";
import { drawUnit } from "./unit-sprites.ts";

export interface UnitLayerOptions {
  /** Restrict to a tier, for the tier-separation captures. */
  tiers?: readonly Tier[];
}

/** Squashed clustered blob under a unit so it is planted, not floating. */
function contactShadow(surface: Surface, x: number, y: number, radius: number): void {
  for (let dy = -Math.ceil(radius / 2); dy <= Math.ceil(radius / 2); dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const inside = (dx * dx) / (radius * radius) + (dy * dy * 4) / (radius * radius) <= 1;
      if (!inside) { continue; }
      if (clusterField(x + dx, y + dy, 4, 47) < 0.32) { continue; }
      setPixel(surface, x + dx, y + dy, INK_SOFT);
    }
  }
}

export function unitsInDrawOrder(options: UnitLayerOptions = {}): UnitPlacement[] {
  const allowed = options.tiers;
  const filtered = allowed === undefined
    ? [...units]
    : units.filter((unit) => allowed.includes(unit.tier));
  return filtered.sort((a, b) => depth(a.cx, a.cy) - depth(b.cx, b.cy));
}

export function drawUnitLayer(surface: Surface, options: UnitLayerOptions = {}): void {
  const ordered = unitsInDrawOrder(options);
  for (const unit of ordered) {
    const at = project(unit.cx, unit.cy);
    contactShadow(surface, Math.round(at.x), Math.round(at.y + 3), unit.tier === "hero" ? 13 : 10);
    drawUnit(surface, unit, at.x, at.y + 4);
  }
}
