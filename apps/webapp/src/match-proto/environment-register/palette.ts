/**
 * THROWAWAY PROTOTYPE (#91) — environment register bake-off lane.
 *
 * The single palette both treatments draw from. Treatment A (SVG→raster
 * comic-book) and treatment B (MST-register dense pixel) import these exact
 * hexes, so "same palette anchors" is a mechanical property of the lane
 * rather than a claim in a caption: `palette.test.ts` asserts that every
 * colour emitted by either treatment — including the composited unit layer —
 * is a member of `ALL_COLORS`.
 *
 * Canon obeyed (#68):
 * - plum-black `#120b10` is the deepest ink and the darkest colour here;
 * - no default magenta `#ff2e6c` / chartreuse `#c8f031` anywhere in assets;
 * - 70/25/5 value-saturation budget — the `band` of every colour is declared
 *   below and `treatments.test.ts` measures the realised split off the actual
 *   pixel buffer;
 * - silhouettes must survive a grayscale pass, so every ramp keeps a
 *   luminance gap from the material next to it.
 *
 * ROUND 2 — the readability repair.
 *
 * The cofounder's first word about round 1 was "unreadable", and the reason
 * is in this file rather than in either renderer. Round 1 put the whole frame
 * inside one narrow value band: its ground sat at luma 36–60, its props at
 * 59–77, and the borrowed unit coat at 79. Everything was the same grey, so
 * nothing separated from anything, and the 93/6/0.5 budget it measured was
 * the symptom rather than the disease.
 *
 * Round 2 spreads the frame into four declared value zones instead:
 *
 *   BACKDROP   luma 18–54   the district behind the plaza, furthest back
 *   GROUND     luma 39–80   the walkable plane, deliberately the quietest
 *                           band on the board (canon: playable regions keep
 *                           low contrast so units own the extremes)
 *   DRESSING   luma 56–126  props, cover, structure — the zone that gives
 *                           the frame its shape at a glance
 *   UNITS      luma 14–194  the borrowed crowd palette, which alone reaches
 *                           both the darkest ink and the brightest highlight
 *
 * `palette.test.ts` pins those zones, so a future round cannot quietly flatten
 * the frame back into one value again.
 *
 * The other round-2 change is honest re-banding rather than accounting: stall
 * matting used to be neutral grey `#414341`, which is a body colour by any
 * reading. It is now a warm woven fibre, so it spends against identity — the
 * colour changed, and the band followed it.
 */

/** Which slice of the 70/25/5 budget a colour is allowed to spend. */
export type Band = "body" | "emission" | "identity";

/** Which declared value zone a colour belongs to. */
export type Zone = "backdrop" | "dressing" | "ground" | "unit";

export interface Ramp {
  /** Budget slice this material spends against. */
  band: Band;
  /** Value zone this material is authored into. */
  zone: Zone;
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
  // --- GROUND: the walkable plane. Quietest and DARKEST band on the
  // board. Every step is held at or below luma 58 on purpose: the borrowed
  // unit coat sits at 79 and is the largest single mass on any figure, so a
  // floor that climbs into the seventies is a floor a unit dissolves into.
  asphalt: { band: "body", zone: "ground", shadow: "#1b1a23", base: "#26242f", light: "#2c2a36" },
  asphaltWet: { band: "body", zone: "ground", shadow: "#1a1b28", base: "#24263a", light: "#2d3050" },
  dirt: { band: "body", zone: "ground", shadow: "#262019", base: "#332b20", light: "#3d3423" },
  grate: { band: "body", zone: "ground", shadow: "#1a1a20", base: "#24242c", light: "#2c2c35" },
  // Stall matting: round 1 had this as neutral grey `#414341` and counted it
  // as body, which was the correct band for that colour. It is woven fibre
  // laid out as market dressing, so round 2 draws it as warm fibre — the
  // colour changed first and the band followed it.
  mat: { band: "identity", zone: "ground", shadow: "#2b2415", base: "#3b3120", light: "#3e3420" },
  /** The apron the plaza sits in. Ground zone, one step above the plaza. */
  pavement: { band: "body", zone: "ground", shadow: "#25242c", base: "#2f2d37", light: "#35323d" },

  // --- DRESSING: props, cover, structure. Carries the frame's shape, and
  // is where round 2 put the light round 1 never had anywhere.
  concrete: { band: "body", zone: "dressing", shadow: "#4a4757", base: "#625d70", light: "#7b7589" },
  steel: { band: "body", zone: "dressing", shadow: "#42424e", base: "#626270", light: "#85859a", spec: "#a8a8b4" },
  plum: { band: "body", zone: "dressing", shadow: "#302438", base: "#493957", light: "#605070" },
  wood: { band: "identity", zone: "dressing", shadow: "#5e4126", base: "#86602f", light: "#a87d47" },
  rust: { band: "identity", zone: "dressing", shadow: "#663820", base: "#94552a", light: "#b8713c" },
  /** Fired brick — the perimeter blocks, and the frame's largest warm mass. */
  brick: { band: "identity", zone: "dressing", shadow: "#57342c", base: "#74463a", light: "#8f5a4a" },
  canvasWarm: { band: "identity", zone: "dressing", shadow: "#703d2f", base: "#99573b", light: "#b8714e" },
  canvasCool: { band: "identity", zone: "dressing", shadow: "#234b48", base: "#356e67", light: "#4a9086" },
  /** Faded shipping-container blue — the cool half of the hard-cover kit. */
  containerBlue: { band: "identity", zone: "dressing", shadow: "#26485c", base: "#3a6884", light: "#528ead" },
  /** Sacking for sandbag lines — the softest of the waist-height covers. */
  sandbag: { band: "identity", zone: "dressing", shadow: "#574c33", base: "#776a48", light: "#97885f" },
  /** Chevron stripe on jersey barriers. Bright, so it is used by the metre. */
  hazard: { band: "identity", zone: "dressing", shadow: "#7a6220", base: "#ab8c2c", light: "#c4a444" },
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
  teal: { housing: "#17292b", idle: "#24807a", active: "#35b8ae", hot: "#d8fff6" },
  amber: { housing: "#2b1a09", idle: "#8f5620", active: "#e09a38", hot: "#ffe8bc" },
} as const;

export type EmissionName = keyof typeof emissions;

/** Backdrop band behind the board — quiet so units own the contrast. */
export const backdrop = {
  far: "#14101c",
  mid: "#1e1826",
  near: "#2a2233",
  hazeWarm: "#3d3038",
} as const;

/** Colours canon forbids as default asset ingredients (#68). */
export const FORBIDDEN_DEFAULTS = ["#ff2e6c", "#c8f031"] as const;

function rampColors(ramp: Ramp): string[] {
  return ramp.spec === undefined
    ? [ramp.shadow, ramp.base, ramp.light]
    : [ramp.shadow, ramp.base, ramp.light, ramp.spec];
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

/**
 * Step a colour one rung DOWN its own ramp. This is how round 2 shades the
 * ground under a canopy and inside a cast shadow: the shadow is a *value
 * step in the material's own ramp*, not a black slab blended over the top,
 * so a shadowed floor still reads as that floor and the render stays
 * palette-indexed. Off-ramp colours fall to `INK_SOFT`.
 */
const stepDown = new Map<string, string>();
for (const ramp of Object.values(rampTable) as Ramp[]) {
  stepDown.set(ramp.light, ramp.base);
  stepDown.set(ramp.base, ramp.shadow);
  stepDown.set(ramp.shadow, INK_SOFT);
  if (ramp.spec !== undefined) { stepDown.set(ramp.spec, ramp.light); }
}
for (const emission of Object.values(emissions)) {
  stepDown.set(emission.hot, emission.active);
  stepDown.set(emission.active, emission.idle);
  stepDown.set(emission.idle, emission.housing);
}
for (const shade of Object.values(backdrop)) { stepDown.set(shade, INK_SOFT); }
stepDown.set(INK_SOFT, INK);

export function shadeStep(color: string): string {
  return stepDown.get(color.toLowerCase()) ?? INK_SOFT;
}

/** Every colour the environment itself is permitted to emit. */
export const BOARD_COLORS: readonly string[] = [
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
const zoneByColor = new Map<string, Zone>();
for (const ramp of Object.values(ramps)) {
  for (const color of rampColors(ramp)) {
    bandByColor.set(color, ramp.band);
    zoneByColor.set(color, ramp.zone);
  }
}
for (const emission of Object.values(emissions)) {
  bandByColor.set(emission.housing, "body");
  bandByColor.set(emission.idle, "emission");
  bandByColor.set(emission.active, "emission");
  bandByColor.set(emission.hot, "emission");
  for (const level of Object.values(emission)) { zoneByColor.set(level, "dressing"); }
}
for (const color of [INK, INK_SOFT]) {
  bandByColor.set(color, "body");
  zoneByColor.set(color, "backdrop");
}
for (const color of Object.values(backdrop)) {
  bandByColor.set(color, "body");
  zoneByColor.set(color, "backdrop");
}

/**
 * Register a colour that arrives from the borrowed unit art. Units are not
 * this lane's variable, but they are composited into the same buffer, so the
 * budget measurement has to know what band their pixels spend against.
 */
export function registerUnitColor(color: string, band: Band): void {
  const key = color.toLowerCase();
  bandByColor.set(key, band);
  zoneByColor.set(key, "unit");
}

/** Budget band a colour spends against, or `undefined` if off-palette. */
export function bandOf(color: string): Band | undefined {
  return bandByColor.get(color.toLowerCase());
}

/** Declared value zone of a colour, or `undefined` if off-palette. */
export function zoneOf(color: string): Zone | undefined {
  return zoneByColor.get(color.toLowerCase());
}

const rampByColor = new Map<string, RampName>();
for (const [name, ramp] of Object.entries(ramps) as [RampName, Ramp][]) {
  for (const color of rampColors(ramp)) { rampByColor.set(color, name); }
}

/** Which material ramp a colour belongs to, if any. */
export function rampOf(color: string): RampName | undefined {
  return rampByColor.get(color.toLowerCase());
}
