/**
 * THROWAWAY PROTOTYPE (#91) — TREATMENT A: SVG→raster comic-book.
 *
 * The register #66 ruled for environments: ink-like outer contours, clean
 * internal separations, flat cel-shaded colour clusters, graphic shapes.
 *
 * Authoring model: the agent emits shape markup (this module is the "artist"),
 * and the browser rasterizes the SVG to pixels at capture time. That is the
 * #69 lane definition — agent-authored SVG source, rasterized to PNG — with
 * the rasterizer swapped for the one available locally without adding a
 * dependency. Nothing here is hand-drawn: every path comes out of the shared
 * geometry in `prop-geometry.ts`.
 *
 * The register is produced by three devices layered over that geometry:
 *   1. a two-pass ink: a fat plum-black under-stroke gives every prop a
 *      continuous outer contour, then a thin stroke re-draws the internal
 *      separations on top;
 *   2. flat fills only — no gradients, no per-pixel texture;
 *   3. a single halftone screen, used selectively on the sky band, as the
 *      offset-print accent the board's style hypothesis calls for.
 *
 * ROUND 2 changes two things. The ink weights are re-authored for the 28×14
 * tile — round 1's 5 px outer stroke was tuned to a 64 px tile and at this
 * scale it would swallow a whole crate. And the canopy shadow gets its own
 * seam pass, so the comic-book treatment states the ceiling with a drawn edge
 * rather than relying on a value step alone, which is what its register would
 * actually do.
 */

import {
  type Ambient,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  ambientAt,
} from "./board-model.ts";
import {
  type Piece,
  applyAmbient,
  backdropPieces,
  groundPieces,
  groundSeams,
  piecesForProp,
  shadowSeams,
  steamPieces,
} from "./prop-geometry.ts";
import { INK, INK_SOFT, ramps } from "./palette.ts";
import { sortedProps } from "./occupancy.ts";

/** Outer contour weight, in board pixels. */
export const INK_OUTER = 2;
/** Internal separation weight. */
export const INK_INNER = 0.7;

function round(value: number): string {
  return (Math.round(value * 100) / 100).toString();
}

function pathOf(piece: Piece): string {
  const [first, ...rest] = piece.points;
  if (first === undefined) { return ""; }
  const head = `M${round(first.x)} ${round(first.y)}`;
  const tail = rest.map((point) => `L${round(point.x)} ${round(point.y)}`).join("");
  return `${head}${tail}Z`;
}

function flat(pieces: Piece[]): string {
  return pieces
    .map((piece) => `<path d="${pathOf(piece)}" fill="${piece.fill}"/>`)
    .join("");
}

/**
 * The two-pass ink. Pass one floods the prop's silhouette with plum-black
 * through a fat stroke, so the union of its faces gets one continuous contour
 * without computing a real polygon union; pass two lays the flat colour back
 * on with a hairline separation between faces.
 *
 * `mesh` pieces are excluded from the flood and drawn as a stroked lattice
 * instead — a chain fence that inks like a solid panel is not a chain fence.
 */
function inkedGroup(pieces: Piece[]): string {
  const mesh = pieces.filter((piece) => piece.role === "mesh");
  const inked = pieces.filter((piece) => piece.ink && piece.role !== "mesh");
  const plain = pieces.filter((piece) => !piece.ink && piece.role !== "mesh");
  const paths = inked.map((piece) => `<path d="${pathOf(piece)}"/>`).join("");
  const under = inked.length === 0
    ? ""
    : `<g fill="${INK}" stroke="${INK}" stroke-width="${round(INK_OUTER)}" stroke-linejoin="round">${paths}</g>`;
  const over = inked
    .map((piece) => `<path d="${pathOf(piece)}" fill="${piece.fill}" stroke="${INK}" stroke-width="${round(INK_INNER)}" stroke-linejoin="bevel"/>`)
    .join("");
  const screen = mesh
    .map((piece) => `<path d="${pathOf(piece)}" fill="url(#hp-mesh)" stroke="${INK}" stroke-width="${round(INK_INNER)}"/>`)
    .join("");
  return `${under}${over}${screen}${flat(plain)}`;
}

function seamMarkup(): string {
  const seams = groundSeams()
    .map((seam) => `M${round(seam.from.x)} ${round(seam.from.y)}L${round(seam.to.x)} ${round(seam.to.y)}`)
    .join("");
  return `<path d="${seams}" fill="none" stroke="${INK}" stroke-width="1" stroke-linecap="square" opacity="0.8"/>`;
}

/**
 * The drawn edge of every canopy shadow. `groundFill` already steps the tiles
 * under and behind a roof one rung down their own ramp; this outlines the
 * union of those tiles, which is what turns a darker patch of floor into a
 * shape a specific roof threw.
 */
function shadowMarkup(): string {
  const seams = shadowSeams()
    .map((seam) => `M${round(seam.from.x)} ${round(seam.from.y)}L${round(seam.to.x)} ${round(seam.to.y)}`)
    .join("");
  if (seams === "") { return ""; }
  return `<path d="${seams}" fill="none" stroke="${INK_SOFT}" stroke-width="1" stroke-linecap="square"/>`;
}

export interface SvgOptions {
  /** Ambient frame index; defaults to the still frame 0. */
  frame?: number;
  /** Emit the halftone accent screen. On by default. */
  halftone?: boolean;
}

/** The whole board as one SVG document string. */
export function renderBoardSvg(options: SvgOptions = {}): string {
  const ambient: Ambient = ambientAt(options.frame ?? 0);
  const halftone = options.halftone ?? true;

  const defs = `<defs>`
    + `<pattern id="hp-halftone" width="5" height="5" patternUnits="userSpaceOnUse">`
    + `<rect width="5" height="5" fill="none"/>`
    + `<circle cx="1" cy="1" r="1.1" fill="${INK}"/>`
    + `</pattern>`
    + `<pattern id="hp-mesh" width="4" height="4" patternUnits="userSpaceOnUse">`
    + `<rect width="4" height="4" fill="none"/>`
    + `<path d="M0 0L4 4M4 0L0 4" stroke="${ramps.steel.base}" stroke-width="1"/>`
    + `</pattern>`
    + `</defs>`;

  const body = [
    flat(backdropPieces()),
    flat(groundPieces()),
    seamMarkup(),
    shadowMarkup(),
    sortedProps()
      .map((prop) => inkedGroup(applyAmbient(piecesForProp(prop), ambient)))
      .join(""),
    flat(applyAmbient(steamPieces(ambient), ambient)),
    halftone ? `<rect x="0" y="0" width="${String(BOARD_WIDTH)}" height="34" fill="url(#hp-halftone)" opacity="0.5"/>` : "",
  ].join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${String(BOARD_WIDTH)}" height="${String(BOARD_HEIGHT)}" `
    + `viewBox="0 0 ${String(BOARD_WIDTH)} ${String(BOARD_HEIGHT)}" shape-rendering="geometricPrecision">`
    + `<title>Grime market plaza — treatment A, SVG comic-book register</title>`
    + defs
    + body
    + `</svg>`;
}

/** Every colour literal the SVG emits, for the palette-conformance gate. */
export function svgColors(markup: string): string[] {
  return [...markup.matchAll(/#[0-9a-f]{6}/gi)].map((match) => match[0].toLowerCase());
}

/** Data URL for the browser rasterizer — this is the "→raster" step. */
export function svgDataUrl(markup: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}

export { BOARD_HEIGHT, BOARD_WIDTH };
