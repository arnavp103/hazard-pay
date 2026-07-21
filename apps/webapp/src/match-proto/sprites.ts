/**
 * Pixel-art authoring for the match-proto hello render (#27).
 *
 * Characters are authored as text grids (one char per pixel, `.` =
 * transparent) with a per-character palette, and compiled to raw RGBA
 * buffers. No external assets, no canvas — this module is pure data and
 * runs (and is unit-tested) in plain Node.
 *
 * SEAM (real match view): this module is the stand-in for the asset
 * pipeline. Real units swap these grids for sprite-sheet PNGs loaded via
 * `Assets.load` + `Spritesheet` (Aseprite/TexturePacker JSON); the stage
 * module would then consume `Texture[]` frames from there instead of
 * `frameToRgba` buffers. Keep authored art out of the renderer either way.
 */

export const SPRITE_WIDTH = 12;
export const SPRITE_HEIGHT = 16;

export interface CharacterSpriteSpec {
  /** Callsign shown on the HUD nameplate. */
  name: string;
  /** Idle frames: text grids of SPRITE_HEIGHT rows x SPRITE_WIDTH chars. */
  frames: string[][];
  /** Pixel char -> #rrggbb. `.` is always transparent and never mapped. */
  palette: Record<string, string>;
}

// Palette hexes echo the Direction B tokens (packages/ui globals.css):
// acid #c8f031 (accent-2), hot magenta #ff2e6c (accent), cyan #2ed9ff (info).
// Canvas art cannot resolve CSS custom properties, so the values are pinned
// here on purpose — grime-market skins, not semantic UI colors.

/** Acid-jacket runner. Frame B: visor scanline flicker, chest LED swap. */
export const runner: CharacterSpriteSpec = {
  name: "JAX-9",
  palette: {
    o: "#120b10", // outline (shell ink)
    h: "#2b2431", // hair
    v: "#c8f031", // visor, acid
    w: "#e9ff7a", // visor, flicker-bright
    s: "#d99e6a", // skin
    j: "#3a4030", // jacket, olive grime
    m: "#ff2e6c", // chest stripe, magenta
    d: "#241a22", // chest stripe, dimmed
    p: "#2a2330", // pants
    b: "#181218", // boots
  },
  frames: [
    [
      "..oooooooo..",
      ".ohhhhhhhho.",
      ".ohhhhhhhho.",
      ".ovvvvvvvvo.",
      ".osssssssso.",
      "..ossssso...",
      ".ojjjjjjjjo.",
      "ojjjjmmjjjjo",
      "ojjojjjjojjo",
      "ojjojjjjojjo",
      "ossojjjjosso",
      "...ojjjjo...",
      "...oppppo...",
      "...op..po...",
      "...op..po...",
      "..obb..bbo..",
    ],
    [
      "..oooooooo..",
      ".ohhhhhhhho.",
      ".ohhhhhhhho.",
      ".owvwvwvwvo.",
      ".osssssssso.",
      "..ossssso...",
      ".ojjjjjjjjo.",
      "ojjjjddjjjjo",
      "ojjojjjjojjo",
      "ojjojjjjojjo",
      "ossojjjjosso",
      "...ojjjjo...",
      "...oppppo...",
      "...op..po...",
      "...op..po...",
      "..obb..bbo..",
    ],
  ],
};

/** Magenta-coat bruiser with an acid mohawk. Frame B: goggle flicker. */
export const bruiser: CharacterSpriteSpec = {
  name: "NYX-4",
  palette: {
    o: "#120b10", // outline (shell ink)
    a: "#c8f031", // mohawk, acid
    s: "#b97a52", // skin
    g: "#2ed9ff", // goggles, cyan
    f: "#aefcff", // goggles, flicker-bright
    c: "#8f1f46", // coat, deep magenta grime
    m: "#ff2e6c", // coat emblem, hot magenta
    p: "#2a2330", // pants
    b: "#181218", // boots
  },
  frames: [
    [
      "....oaao....",
      "....oaao....",
      "..ooaaaaoo..",
      "..osssssso..",
      "..oggggggo..",
      "..osssssso..",
      ".occcccccco.",
      "occcccccccco",
      "occoccccocco",
      "occocmmcocco",
      "ossoccccosso",
      "...occcco...",
      "...oppppo...",
      "...op..po...",
      "...op..po...",
      "..obb..bbo..",
    ],
    [
      "....oaao....",
      "....oaao....",
      "..ooaaaaoo..",
      "..osssssso..",
      "..offffffo..",
      "..osssssso..",
      ".occcccccco.",
      "occcccccccco",
      "occoccccocco",
      "occocmmcocco",
      "ossoccccosso",
      "...occcco...",
      "...oppppo...",
      "...op..po...",
      "...op..po...",
      "..obb..bbo..",
    ],
  ],
};

export const characters: CharacterSpriteSpec[] = [runner, bruiser];

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/**
 * Compile one text-grid frame to a straight-alpha RGBA byte buffer
 * (SPRITE_WIDTH x SPRITE_HEIGHT x 4). Transparent pixels are fully zeroed
 * so premultiplication on upload is a no-op.
 */
export function frameToRgba(rows: string[], palette: Record<string, string>): Uint8Array {
  if (rows.length !== SPRITE_HEIGHT) {
    throw new Error(`expected ${String(SPRITE_HEIGHT)} rows, got ${String(rows.length)}`);
  }
  const out = new Uint8Array(SPRITE_WIDTH * SPRITE_HEIGHT * 4);
  rows.forEach((row, y) => {
    if (row.length !== SPRITE_WIDTH) {
      throw new Error(`row ${String(y)}: expected ${String(SPRITE_WIDTH)} chars, got ${String(row.length)}`);
    }
    [...row].forEach((ch, x) => {
      if (ch === ".") { return; }
      const hex = palette[ch];
      if (hex === undefined) {
        throw new Error(`row ${String(y)} col ${String(x)}: no palette entry for "${ch}"`);
      }
      const [r, g, b] = hexToRgb(hex);
      const i = (y * SPRITE_WIDTH + x) * 4;
      out[i] = r;
      out[i + 1] = g;
      out[i + 2] = b;
      out[i + 3] = 0xff;
    });
  });
  return out;
}

/** Compile every idle frame of a character to RGBA buffers. */
export function buildCharacterFrames(spec: CharacterSpriteSpec): Uint8Array[] {
  return spec.frames.map((rows) => frameToRgba(rows, spec.palette));
}
