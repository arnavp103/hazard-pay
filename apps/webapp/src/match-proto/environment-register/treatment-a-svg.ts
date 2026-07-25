/**
 * THROWAWAY PROTOTYPE (#91) — TREATMENT A: SVG→raster comic-book.
 *
 * The register #66 ruled for environments: ink-like outer contours, clean
 * internal separations, flat cel-shaded colour clusters, graphic shapes.
 *
 * Authoring model: the agent emits shape markup (this module is the
 * "artist"), and the browser rasterizes the SVG to pixels at capture time.
 * That is the #69 lane definition — agent-authored SVG source, rasterized
 * to PNG — with the rasterizer swapped for the one that is available
 * locally without adding a dependency. Nothing here is hand-drawn: every
 * path comes out of the shared geometry in `prop-geometry.ts`.
 *
 * The register is produced by three devices layered over that geometry:
 *   1. a two-pass ink: a fat plum-black under-stroke gives every prop a
 *      continuous outer contour, then a thin stroke re-draws the internal
 *      separations on top;
 *   2. flat fills only — no gradients, no per-pixel texture;
 *   3. a single halftone screen, used selectively on the block masses, as
 *      the offset-print accent the board's style hypothesis calls for.
 */

import {
  type Ambient,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  ambientAt,
  sortedProps,
} from "./board-model.ts";
import {
  type Piece,
  applyAmbient,
  backdropPieces,
  groundPieces,
  groundSeams,
  piecesForProp,
  steamPieces,
} from "./prop-geometry.ts";
import { INK } from "./palette.ts";

/** Outer contour weight, in board pixels. */
export const INK_OUTER = 3.2;
/** Internal separation weight. */
export const INK_INNER = 1;

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
 * through a fat stroke, so the union of its faces gets one continuous
 * contour without computing a real polygon union; pass two lays the flat
 * colour back on with a hairline separation between faces.
 */
function inkedGroup(pieces: Piece[]): string {
  const inked = pieces.filter((piece) => piece.ink);
  const plain = pieces.filter((piece) => !piece.ink);
  const paths = inked.map((piece) => `<path d="${pathOf(piece)}"/>`).join("");
  const under = inked.length === 0
    ? ""
    : `<g fill="${INK}" stroke="${INK}" stroke-width="${round(INK_OUTER)}" stroke-linejoin="round">${paths}</g>`;
  const over = inked
    .map((piece) => `<path d="${pathOf(piece)}" fill="${piece.fill}" stroke="${INK}" stroke-width="${round(INK_INNER)}" stroke-linejoin="bevel"/>`)
    .join("");
  return `${under}${over}${flat(plain)}`;
}

function seamMarkup(): string {
  const seams = groundSeams()
    .map((seam) => `M${round(seam.from.x)} ${round(seam.from.y)}L${round(seam.to.x)} ${round(seam.to.y)}`)
    .join("");
  return `<path d="${seams}" fill="none" stroke="${INK}" stroke-width="1.4" stroke-linecap="square" opacity="0.85"/>`;
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
    + `<pattern id="hp-halftone" width="4" height="4" patternUnits="userSpaceOnUse">`
    + `<rect width="4" height="4" fill="none"/>`
    + `<circle cx="1" cy="1" r="0.9" fill="${INK}"/>`
    + `</pattern>`
    + `</defs>`;

  const body = [
    flat(backdropPieces()),
    flat(groundPieces()),
    seamMarkup(),
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
