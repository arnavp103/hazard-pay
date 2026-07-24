/**
 * THROWAWAY PROTOTYPE (#82): the numbers that make this lane comparable to
 * the other two bake-off lanes. Imported by BOTH the offline bake spec and
 * the PixiJS runtime, so the camera that renders the sprites and the stage
 * that draws them cannot drift.
 *
 * Framing is pinned to the real-time 3D lane's pulled-back still (PR #85):
 * a 480x270 aperture at 40 world-px per unit, zoomed 0.82 — i.e. ~32.8
 * screen px per world unit, character ~60 px tall.
 *
 * This lane reaches the same screen framing through the pixel-art canon
 * instead (#68: 24x32 authored at an integer 2x). Everything is authored on
 * a 240x135 ART-PIXEL grid at 16 art px per world unit and blown up 2x with
 * nearest-neighbour, which lands the medic at 31 art px / 62 screen px. The
 * board goes through the same grid, so character and environment share one
 * pixel size — the cohesion the other two lanes have to argue for.
 */

/** Integer render scale from art pixels to screen pixels (#68 canon). */
export const ART_SCALE = 2;

export const STAGE_WIDTH = 480;
export const STAGE_HEIGHT = 270;
export const ART_WIDTH = STAGE_WIDTH / ART_SCALE;
export const ART_HEIGHT = STAGE_HEIGHT / ART_SCALE;

/** Art pixels per Blender world unit. 40 * 0.82 / ART_SCALE, rounded to an integer. */
export const PIXELS_PER_UNIT = 16;

/** Sprite cell. Sized to hold the attack lunge and the hop, not the idle bbox. */
export const CELL = { width: 64, height: 48 } as const;

/** Where world origin (the rig's ground point) lands inside the cell. */
export const ANCHOR = { x: 32, y: 40 } as const;

export const FACINGS = 8;

/**
 * The baked clip budget. Every frame here costs FACINGS atlas cells, which
 * is the whole cost question this lane exists to answer — so the acting is
 * authored INTO short loops rather than sampled out of long ones.
 */
export const CLIPS = [
  { name: "idle", frames: 8, fps: 8 },
  { name: "attack", frames: 12, fps: 12 },
  { name: "pivot", frames: 6, fps: 12 },
] as const;

export type ClipName = (typeof CLIPS)[number]["name"];

/** The #74/#79 grime-market board, 840x360 at 40 px/unit, into art pixels. */
export const BOARD_SCALE = PIXELS_PER_UNIT / 40;
export const BOARD_WIDTH = Math.round(840 * BOARD_SCALE);
export const BOARD_HEIGHT = Math.round(360 * BOARD_SCALE);
/** Board top-left in art pixels, chosen so the medic lands where PR #85 put it. */
export const BOARD_OFFSET = { x: -45, y: 2 } as const;
/** The board's authored character stand point (SVG 421,255) in art pixels. */
export const FEET = {
  x: Math.round(421 * BOARD_SCALE) + BOARD_OFFSET.x,
  y: Math.round(255 * BOARD_SCALE) + BOARD_OFFSET.y,
} as const;

export const ATLAS_BASENAME = "medic";
/** Served from apps/webapp/public; Pixi loads the sheet JSON from here. */
export const ATLAS_PUBLIC_DIR = "blender-baked";
