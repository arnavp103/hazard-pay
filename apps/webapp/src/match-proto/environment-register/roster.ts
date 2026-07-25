/**
 * THROWAWAY PROTOTYPE (#91, round 2) — where the units stand.
 *
 * Round 1 authored unit positions as raw fractional cell coordinates in the
 * board model and hoped for the best; the capture came back with figures on
 * crate lids and stall roofs. Round 2 does not author positions at all. Every
 * placement here is *derived* from the occupancy model, so a unit standing on
 * a prop is not a bug that can be reintroduced by a careless edit — it is
 * unrepresentable.
 *
 * Three kinds of placement, in priority order:
 *
 * - **Cover posts** are generated, one per cover kind: for the first prop of
 *   each kind, the tile immediately behind it (its north or west neighbour) is
 *   claimed by a unit. Generating them rather than hand-listing them means the
 *   cover-variety sheet is guaranteed to have a real unit standing behind every
 *   cover type on the board, and it stays true if the manifest changes.
 * - **Front posts** are hand-picked tiles nearer the camera than a named prop.
 *   They are the other half of the occlusion proof: without one, a capture
 *   cannot show that the sort is doing work rather than simply drawing every
 *   unit last.
 * - **The line** is everything else, filled by walking outward from each side's
 *   anchor and taking walkable tiles in a fixed order.
 *
 * Archetype staging is decorrelated from both screen axes on purpose: the
 * pixel lane's round-3 critique found its archetype read was positional rather
 * than silhouettic because every ranged unit sat at the back of its clump. The
 * interleave below alternates along the fill order instead.
 */

import {
  type Archetype,
  type Prop,
  type PropKind,
  type Side,
  type Tier,
  type UnitPlacement,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  FODDER_FIGURE,
  GRID,
  project,
  propSpecs,
  props,
} from "./board-model.ts";
import { coverPost, paintOrder, propRect, walkable } from "./occupancy.ts";

/** Cover kinds in the order the variety sheet presents them: least to most. */
export const COVER_ORDER: readonly PropKind[] = [
  "rubble",
  "sandbagLine",
  "railing",
  "jerseyBarrier",
  "cableSpool",
  "vent",
  "barrelPair",
  "dumpster",
  "crateStack",
  "pipeRack",
  "hulk",
  "chainFence",
  "container",
  "pillar",
  "lampPost",
  "signPylon",
  "awningStall",
  "canopySpan",
  "blockWall",
];

/** The representative prop the cover sheet frames for each kind. */
export function exemplarFor(kind: PropKind): Prop | undefined {
  return props.find((prop) => prop.kind === kind);
}

interface FrontPost {
  id: string;
  side: Side;
  archetype: Archetype;
  cx: number;
  cy: number;
  /** The prop this unit is meant to stand in front of. */
  inFrontOf: string;
}

/**
 * Units deliberately nearer the camera than a named prop. Both of these sit on
 * the aisle side of a waist-height cover, so the same barrier has a unit cut by
 * it and a unit cutting it within a couple of tiles — which is the single frame
 * that proves the depth sort rather than asserting it.
 */
export const frontPosts: readonly FrontPost[] = [
  { id: "front-jersey", side: "crew", archetype: "ranged", cx: 7, cy: 13, inFrontOf: "jersey-sw" },
  { id: "front-crate", side: "rival", archetype: "melee", cx: 11, cy: 14, inFrontOf: "crate-se" },
  { id: "front-sandbag", side: "crew", archetype: "melee", cx: 5, cy: 12, inFrontOf: "sandbag-sw-a" },
];

export interface CoverPost {
  id: string;
  kind: PropKind;
  propId: string;
  cx: number;
  cy: number;
}

/** One unit posted behind the exemplar of every cover kind on the board. */
export function coverPosts(): CoverPost[] {
  const out: CoverPost[] = [];
  for (const kind of COVER_ORDER) {
    // The perimeter blocks are the edge of the level, not cover a unit takes:
    // they are 50-68 px of solid mass against a 22 px figure, so anything
    // posted behind one is simply not in the picture.
    if (kind === "blockWall") { continue; }
    const prop = exemplarFor(kind);
    if (prop === undefined) { continue; }
    const post = coverPost(prop, "north") ?? coverPost(prop, "west");
    if (post === undefined) { continue; }
    out.push({ id: `cover-${kind}`, kind, propId: prop.id, cx: post.cx, cy: post.cy });
  }
  return out;
}

/** Where each side's line grows from. */
const anchors: Record<Side, { cx: number; cy: number }> = {
  crew: { cx: 6, cy: 13 },
  rival: { cx: 13, cy: 6 },
};

/** Fill counts, inside the director's 15–20 fodder / 1–2 hero gauge. */
const LINE_PER_SIDE = 10;

/** Melee/ranged alternation along the fill order, not along a screen axis. */
const INTERLEAVE: Archetype[] = ["melee", "ranged", "melee", "ranged", "ranged", "melee", "ranged", "melee"];

/**
 * Deterministic outward scan from an anchor. Cells come back sorted by distance
 * and then by a fixed tiebreak, so the roster is reproducible.
 */
function candidatesAround(anchor: { cx: number; cy: number }, side: Side): { cx: number; cy: number }[] {
  const out: { cx: number; cy: number }[] = [];
  for (let cx = 0; cx < GRID; cx += 1) {
    for (let cy = 0; cy < GRID; cy += 1) {
      if (!walkable(cx, cy)) { continue; }
      // Keep each side on its own half of the aisle so the two orders of
      // battle read as two orders of battle.
      if (side === "crew" ? cy < cx : cx < cy) { continue; }
      out.push({ cx, cy });
    }
  }
  return out.sort((a, b) => {
    const da = Math.hypot(a.cx - anchor.cx, (a.cy - anchor.cy) * 0.9);
    const db = Math.hypot(b.cx - anchor.cx, (b.cy - anchor.cy) * 0.9);
    if (da !== db) { return da - db; }
    if (a.cx !== b.cx) { return a.cx - b.cx; }
    return a.cy - b.cy;
  });
}

function sideFor(cx: number, cy: number): Side {
  return cy >= cx ? "crew" : "rival";
}

function buildRoster(): UnitPlacement[] {
  const taken = new Set<number>();
  const out: UnitPlacement[] = [];

  const claim = (cx: number, cy: number): boolean => {
    const cell = cy * GRID + cx;
    if (taken.has(cell) || !walkable(cx, cy)) { return false; }
    taken.add(cell);
    return true;
  };

  coverPosts().forEach((post, index) => {
    if (!claim(post.cx, post.cy)) { return; }
    const side = sideFor(post.cx, post.cy);
    out.push({
      id: post.id,
      tier: "fodder",
      side,
      archetype: INTERLEAVE[index % INTERLEAVE.length] ?? "melee",
      cx: post.cx,
      cy: post.cy,
      mirrored: side === "rival",
    });
  });

  for (const post of frontPosts) {
    if (!claim(post.cx, post.cy)) { continue; }
    out.push({
      id: post.id,
      tier: "fodder",
      side: post.side,
      archetype: post.archetype,
      cx: post.cx,
      cy: post.cy,
      mirrored: post.side === "rival",
    });
  }

  for (const side of ["crew", "rival"] as const) {
    const cells = candidatesAround(anchors[side], side);
    let placed = 0;
    for (const cell of cells) {
      if (placed >= LINE_PER_SIDE) { break; }
      if (!claim(cell.cx, cell.cy)) { continue; }
      const tier: Tier = placed === 0 ? "hero" : "fodder";
      const archetype: Archetype = placed === 0 ? "hero" : (INTERLEAVE[placed % INTERLEAVE.length] ?? "melee");
      out.push({
        id: `${side}-${String(placed)}`,
        tier,
        side,
        archetype,
        cx: cell.cx,
        cy: cell.cy,
        mirrored: side === "rival",
      });
      placed += 1;
    }
  }
  return out;
}

export const units: readonly UnitPlacement[] = buildRoster();

/** A unit's footprint is the single tile it stands on. */
export function unitRect(unit: UnitPlacement) {
  return { x0: unit.cx, y0: unit.cy, x1: unit.cx + 1, y1: unit.cy + 1 };
}

export type SceneItem
  = | { kind: "prop"; prop: Prop }
    | { kind: "unit"; unit: UnitPlacement };

/**
 * The whole scene — props and units together — in one painter order. This is
 * the single most important line in round 2: round 1 sorted props among props,
 * sorted units among units, and then stacked the second list on top of the
 * first, which guarantees every unit is in front of every prop no matter what
 * either sort says.
 */
export function sceneOrder(roster: readonly UnitPlacement[] = units): SceneItem[] {
  const items: SceneItem[] = [
    ...props.map((prop): SceneItem => ({ kind: "prop", prop })),
    ...roster.map((unit): SceneItem => ({ kind: "unit", unit })),
  ];
  return paintOrder(items, (item) => (item.kind === "prop" ? propRect(item.prop) : unitRect(item.unit)));
}

/* ------------------------------------------------------------------ */
/* Cover-variety sheet                                                 */
/* ------------------------------------------------------------------ */

/** Panel aperture in board pixels, before the sheet's integer upscale. */
export const COVER_PANEL_W = 104;
export const COVER_PANEL_H = 82;

export interface CoverFrame {
  kind: PropKind;
  propId: string;
  /** Cover class and one-line description, from the occupancy spec. */
  cover: string;
  note: string;
  /** Silhouette height in board pixels, and against a 22 px fodder figure. */
  height: number;
  figureRatio: number;
  /** Board-pixel aperture centred on the prop and its posted unit. */
  x: number;
  y: number;
}

/**
 * One aperture per cover kind, centred between the prop and the unit posted
 * behind it, so every panel of the variety sheet frames the same question:
 * standing behind *this*, how much of a 22 px figure survives?
 *
 * The panels are crops of the real board rather than a synthetic diorama. That
 * matters: the cover types are being judged in the scene they will ship in,
 * with the real floor, the real palette, the real crowd and the real occlusion
 * pipeline, and not on a neutral field that flatters all of them equally.
 */
export function coverFrames(): CoverFrame[] {
  const posts = new Map(coverPosts().map((post) => [post.kind, post]));
  const out: CoverFrame[] = [];
  for (const kind of COVER_ORDER) {
    const prop = exemplarFor(kind);
    if (prop === undefined) { continue; }
    const spec = propSpecs[kind];
    const post = posts.get(kind);
    const rect = propRect(prop);
    const midCx = (rect.x0 + rect.x1) / 2 - 0.5;
    const midCy = (rect.y0 + rect.y1) / 2 - 0.5;
    const focus = project(post === undefined ? midCx : (midCx + post.cx) / 2, post === undefined ? midCy : (midCy + post.cy) / 2);
    const x = Math.round(focus.x - COVER_PANEL_W / 2);
    const y = Math.round(focus.y - COVER_PANEL_H + 24 + Math.min(18, spec.height / 3));
    out.push({
      kind,
      propId: prop.id,
      cover: spec.cover,
      note: spec.note,
      height: spec.height,
      figureRatio: Math.round((spec.height / FODDER_FIGURE) * 100) / 100,
      x: Math.max(0, Math.min(BOARD_WIDTH - COVER_PANEL_W, x)),
      y: Math.max(0, Math.min(BOARD_HEIGHT - COVER_PANEL_H, y)),
    });
  }
  return out;
}
