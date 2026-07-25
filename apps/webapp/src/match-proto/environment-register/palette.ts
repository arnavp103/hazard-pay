/**
 * THROWAWAY PROTOTYPE (#91) — environment register bake-off lane.
 *
 * The single palette both treatments draw from. Treatment A (SVG→raster
 * comic-book) and treatment B (MST-register dense pixel) import these
 * exact hexes, so "same palette anchors" is a mechanical property of the
 * lane rather than a claim in a caption: `palette.test.ts` asserts that
 * every colour emitted by either treatment is a member of `ALL_COLORS`.
 *
 * Canon obeyed (#68):
 * - plum-black `#120b10` is the deepest ink and the darkest colour here;
 * - no default magenta `#ff2e6c` / chartreuse `#c8f031` anywhere in assets;
 * - 70/25/5 value-saturation budget — the `band` of every colour is
 *   declared below and `treatment-b-pixel.test.ts` measures the realised
 *   split off the actual pixel buffer;
 * - silhouettes must survive a grayscale pass, so every ramp keeps a
 *   luminance gap from the material next to it.
 */

/** Which slice of the 70/25/5 budget a colour is allowed to spend. */
export type Band = "body" | "emission" | "identity";

export interface Ramp {
  /** Budget slice this material spends against. */
  band: Band;
  shadow: string;
  base: string;
  light: string;
  /** Sparse third band — focal materials only. */
  spec?: string;
}

/** Plum-black: deepest ink, contour, and shadow anchor (#68). */
export const INK = "#120b10";

/** One step above ink; cast shadow and deep crevice. */
export const INK_SOFT = "#1b141c";

const rampTable = {
  asphalt: { band: "body", shadow: "#241d26", base: "#322a34", light: "#3d3440" },
  asphaltWet: { band: "body", shadow: "#1e1b26", base: "#2a2634", light: "#37324a" },
  dirt: { band: "body", shadow: "#2e2721", base: "#3f362c", light: "#4e4436" },
  grate: { band: "body", shadow: "#1d1d24", base: "#2b2b33", light: "#3a3a44" },
  concrete: { band: "body", shadow: "#2b2833", base: "#3d3947", light: "#4f4a5b" },
  steel: { band: "body", shadow: "#31313a", base: "#4a4a54", light: "#66666f", spec: "#9a9aa2" },
  wood: { band: "identity", shadow: "#43301f", base: "#63482e", light: "#82633f" },
  rust: { band: "identity", shadow: "#4a2c1c", base: "#6f4224", light: "#8f5a30" },
  canvasWarm: { band: "identity", shadow: "#57312a", base: "#77462f", light: "#90593b" },
  canvasCool: { band: "identity", shadow: "#1a302f", base: "#254946", light: "#33635d" },
  // Team cloth stays where the canopies used to sit, so unit identity is
  // the most saturated thing on screen rather than the awnings.
  teamCloth: { band: "identity", shadow: "#1e3a3a", base: "#2c5a56", light: "#3d7f76" },
  plum: { band: "body", shadow: "#241a24", base: "#382a38", light: "#4a3849" },
  mat: { band: "body", shadow: "#2f3130", base: "#414341", light: "#535551" },
} as const satisfies Record<string, Ramp>;

export type RampName = keyof typeof rampTable;

/** Widened so `spec` stays optional at the use site. */
export const ramps: Record<RampName, Ramp> = rampTable;

/**
 * Emission ramps follow the #68 cybernetics signal law: near-black housing,
 * dull idle, saturated active, tiny near-white hot point. Emission is the
 * 5% slice — both treatments are budgeted against it.
 */
export const emissions = {
  teal: { housing: "#142729", idle: "#1f6b66", active: "#2f9e96", hot: "#d0fff4" },
  amber: { housing: "#241708", idle: "#7a4a1c", active: "#c8842f", hot: "#ffe0a8" },
} as const;

export type EmissionName = keyof typeof emissions;

/** Backdrop band behind the board — quiet so units own the contrast. */
export const backdrop = {
  far: "#1a141d",
  mid: "#241b26",
  near: "#2d2130",
  hazeWarm: "#3a2a2c",
} as const;

/** Colours canon forbids as default asset ingredients (#68). */
export const FORBIDDEN_DEFAULTS = ["#ff2e6c", "#c8f031"] as const;

function rampColors(ramp: Ramp): string[] {
  return ramp.spec === undefined
    ? [ramp.shadow, ramp.base, ramp.light]
    : [ramp.shadow, ramp.base, ramp.light, ramp.spec];
}

/** Every colour either treatment is permitted to emit. */
export const ALL_COLORS: readonly string[] = [
  INK,
  INK_SOFT,
  ...Object.values(ramps).flatMap(rampColors),
  ...Object.values(emissions).flatMap((emission) => [
    emission.housing,
    emission.idle,
    emission.active,
    emission.hot,
  ]),
  ...Object.values(backdrop),
];

const bandByColor = new Map<string, Band>();
for (const ramp of Object.values(ramps)) {
  for (const color of rampColors(ramp)) { bandByColor.set(color, ramp.band); }
}
for (const emission of Object.values(emissions)) {
  bandByColor.set(emission.housing, "body");
  bandByColor.set(emission.idle, "emission");
  bandByColor.set(emission.active, "emission");
  bandByColor.set(emission.hot, "emission");
}
for (const color of [INK, INK_SOFT, ...Object.values(backdrop)]) {
  bandByColor.set(color, "body");
}

/** Budget band a colour spends against, or `undefined` if off-palette. */
export function bandOf(color: string): Band | undefined {
  return bandByColor.get(color.toLowerCase());
}

export function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const pack = (channel: number) => channel.toString(16).padStart(2, "0");
  return `#${pack(r)}${pack(g)}${pack(b)}`;
}

/** Rec. 601 luma — the grayscale-readability check the canon asks for. */
export function luma(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

const rampByColor = new Map<string, RampName>();
for (const [name, ramp] of Object.entries(ramps) as [RampName, Ramp][]) {
  for (const color of rampColors(ramp)) { rampByColor.set(color, name); }
}

/** Which material ramp a colour belongs to, if any. */
export function rampOf(color: string): RampName | undefined {
  return rampByColor.get(color.toLowerCase());
}
