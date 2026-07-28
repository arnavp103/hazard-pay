/**
 * THROWAWAY PROTOTYPE (#74): four controlled treatments of one 24×32
 * pixel character over one rasterized SVG environment. The layout does
 * not vary because contour/shading language is the experiment variable.
 * Switch with `?variant=A|B|C|D`; add `?motion=1` for the matched camera
 * pan and character turn. Run at `/match-proto`.
 */

import { useEffect, useMemo, useState } from "react";

import { StatusChip } from "@hazard-pay/ui";

import boardUrl from "./style-cohesion-assets/grime-market-board.prototype.png";

export const styleCohesionVariants = [
  {
    key: "A",
    name: "Contour-first control",
    shortName: "Flat clusters",
    law: "Strong silhouette; selective plum-black edge; material-colored internal separations; minimal form shadow.",
  },
  {
    key: "B",
    name: "Hard two-band cel",
    shortName: "Two-band cel",
    law: "Base plus one hard shadow per material; selective plum-black edge; no texture or smooth gradient.",
  },
  {
    key: "C",
    name: "Material three-band cel",
    shortName: "Three-band cel",
    law: "Shadow and base plus sparse focal highlights; local dark separations; less outer ink.",
  },
  {
    key: "D",
    name: "Grit hybrid",
    shortName: "Cel + grit",
    law: "Two-band cel with restrained dither, worn clusters, chipped color, and deliberately broken contours.",
  },
] as const;

export type StyleCohesionVariantKey = (typeof styleCohesionVariants)[number]["key"];

type Material = "boot" | "coat" | "emission" | "hair" | "livery" | "metal" | "pants" | "skin";

interface MaterialRamp {
  base: string;
  highlight: string;
  shadow: string;
}

const INK = "#120b10";
const CHARACTER_WIDTH = 24;
const CHARACTER_HEIGHT = 32;

const ramps: Record<Material, MaterialRamp> = {
  boot: { shadow: "#171217", base: "#29252a", highlight: "#554951" },
  coat: { shadow: "#293334", base: "#485654", highlight: "#77827b" },
  emission: { shadow: "#142729", base: "#2f9e96", highlight: "#d0fff4" },
  hair: { shadow: "#211820", base: "#3b2936", highlight: "#644054" },
  livery: { shadow: "#62352f", base: "#a6533f", highlight: "#d1845d" },
  metal: { shadow: "#34343a", base: "#77777d", highlight: "#c9c3b8" },
  pants: { shadow: "#242229", base: "#3b3942", highlight: "#68636d" },
  skin: { shadow: "#70483a", base: "#a96e51", highlight: "#d9a078" },
};

type SubjectGrid = Array<Array<Material | undefined>>;

function buildSubjectGrid(): SubjectGrid {
  const grid = Array.from(
    { length: CHARACTER_HEIGHT },
    () => Array.from<Material | undefined>({ length: CHARACTER_WIDTH }).fill(undefined),
  );

  const rect = (material: Material, x: number, y: number, width: number, height: number) => {
    for (let drawY = y; drawY < y + height; drawY += 1) {
      for (let drawX = x; drawX < x + width; drawX += 1) {
        const row = grid[drawY];
        if (row === undefined || row[drawX] !== undefined) { continue; }
        row[drawX] = material;
      }
    }
  };
  const overwrite = (material: Material, x: number, y: number, width: number, height: number) => {
    for (let drawY = y; drawY < y + height; drawY += 1) {
      for (let drawX = x; drawX < x + width; drawX += 1) {
        const row = grid[drawY];
        if (row !== undefined && drawX >= 0 && drawX < CHARACTER_WIDTH) {
          row[drawX] = material;
        }
      }
    }
  };

  // Deliberately asymmetric field-medic silhouette: hood, shoulder case,
  // cybernetic forearm, injector tool, and offset stance.
  rect("hair", 8, 1, 7, 3);
  rect("hair", 6, 3, 11, 4);
  rect("skin", 8, 5, 8, 5);
  rect("hair", 6, 4, 3, 5);
  rect("hair", 15, 4, 2, 3);
  rect("skin", 10, 9, 4, 2);
  rect("coat", 5, 10, 13, 13);
  rect("coat", 3, 12, 4, 10);
  rect("metal", 0, 11, 5, 10);
  rect("skin", 2, 20, 4, 3);
  rect("metal", 17, 12, 4, 11);
  rect("metal", 20, 17, 4, 5);
  rect("pants", 7, 22, 5, 8);
  rect("pants", 13, 22, 5, 8);
  rect("boot", 5, 29, 7, 3);
  rect("boot", 13, 29, 7, 3);

  overwrite("livery", 6, 11, 3, 10);
  overwrite("livery", 9, 12, 7, 3);
  overwrite("coat", 10, 15, 7, 7);
  overwrite("metal", 0, 13, 4, 2);
  overwrite("metal", 1, 16, 4, 2);
  overwrite("emission", 2, 12, 2, 1);
  overwrite("emission", 18, 14, 2, 5);
  overwrite("emission", 21, 18, 2, 1);
  overwrite("metal", 9, 8, 2, 1);
  overwrite("emission", 10, 7, 5, 1);
  overwrite("coat", 10, 10, 4, 2);
  overwrite("metal", 11, 17, 4, 3);
  overwrite("emission", 12, 18, 2, 1);
  overwrite("boot", 10, 27, 2, 3);
  overwrite("boot", 13, 27, 2, 3);

  return grid;
}

const subjectGrid = buildSubjectGrid();

function isOuterEdge(grid: SubjectGrid, x: number, y: number): boolean {
  return (
    grid[y - 1]?.[x] === undefined
    || grid[y + 1]?.[x] === undefined
    || grid[y]?.[x - 1] === undefined
    || grid[y]?.[x + 1] === undefined
  );
}

function isMaterialEdge(grid: SubjectGrid, material: Material, x: number, y: number): boolean {
  return (
    (grid[y - 1]?.[x] !== undefined && grid[y - 1]?.[x] !== material)
    || (grid[y + 1]?.[x] !== undefined && grid[y + 1]?.[x] !== material)
    || (grid[y]?.[x - 1] !== undefined && grid[y]?.[x - 1] !== material)
    || (grid[y]?.[x + 1] !== undefined && grid[y]?.[x + 1] !== material)
  );
}

function isLightEdge(grid: SubjectGrid, x: number, y: number): boolean {
  return grid[y - 1]?.[x] === undefined || grid[y]?.[x - 1] === undefined;
}

function isShadowBand(material: Material, x: number, y: number): boolean {
  if (material === "emission") { return false; }
  return x >= 13 || y >= 21 || ((material === "coat" || material === "livery") && y >= 18);
}

function isSelectiveContour(grid: SubjectGrid, x: number, y: number): boolean {
  if (!isOuterEdge(grid, x, y)) { return false; }
  return grid[y + 1]?.[x] === undefined || grid[y]?.[x + 1] === undefined || x <= 1;
}

function pixelColor(
  variant: StyleCohesionVariantKey,
  grid: SubjectGrid,
  material: Material,
  x: number,
  y: number,
): string {
  const ramp = ramps[material];
  const outer = isOuterEdge(grid, x, y);
  const internal = isMaterialEdge(grid, material, x, y);
  const shadow = isShadowBand(material, x, y);

  if (variant === "A") {
    if (isSelectiveContour(grid, x, y)) { return INK; }
    if (internal && (x + y) % 3 !== 0) { return ramp.shadow; }
    return ramp.base;
  }

  if (variant === "B") {
    if (isSelectiveContour(grid, x, y)) { return INK; }
    return shadow ? ramp.shadow : ramp.base;
  }

  if (variant === "C") {
    if (outer && !isLightEdge(grid, x, y) && (x + y) % 2 === 0) { return INK; }
    if (isLightEdge(grid, x, y) && (material === "metal" || material === "emission" || (x + y) % 4 === 0)) {
      return ramp.highlight;
    }
    if (internal && !isLightEdge(grid, x, y)) { return ramp.shadow; }
    return shadow ? ramp.shadow : ramp.base;
  }

  // The grit pass is deterministic so stills and motion captures compare
  // the same exact wear clusters. It changes surface history, not anatomy.
  const grit = (x * 7 + y * 11) % 17;
  if (isSelectiveContour(grid, x, y) && grit > 3) { return INK; }
  if (!outer && grit === 0) { return ramp.highlight; }
  if (!outer && (grit === 5 || grit === 9)) { return ramp.shadow; }
  if (internal && grit % 3 !== 0) { return ramp.shadow; }
  return shadow ? ramp.shadow : ramp.base;
}

interface PixelSubjectProps {
  scale: number;
  variant: StyleCohesionVariantKey;
}

function PixelSubject({ scale, variant }: PixelSubjectProps) {
  const cells = useMemo(
    () =>
      subjectGrid.flatMap((row, y) =>
        row.flatMap((material, x) =>
          material === undefined
            ? []
            : [{ color: pixelColor(variant, subjectGrid, material, x, y), x, y }],
        ),
      ),
    [variant],
  );

  return (
    <svg
      aria-label={`24 by 32 pixel character, ${variant} treatment`}
      height={CHARACTER_HEIGHT * scale}
      role="img"
      shapeRendering="crispEdges"
      viewBox={`0 0 ${String(CHARACTER_WIDTH)} ${String(CHARACTER_HEIGHT)}`}
      width={CHARACTER_WIDTH * scale}
    >
      {cells.map((cell) => (
        <rect
          key={`${String(cell.x)}-${String(cell.y)}`}
          fill={cell.color}
          height="1"
          width="1"
          x={cell.x}
          y={cell.y}
        />
      ))}
    </svg>
  );
}

function readVariant(): StyleCohesionVariantKey {
  if (globalThis.location === undefined) { return "A"; }
  const candidate = new URLSearchParams(globalThis.location.search).get("variant");
  return styleCohesionVariants.some((variant) => variant.key === candidate)
    ? candidate as StyleCohesionVariantKey
    : "A";
}

function readMotion(): boolean {
  if (globalThis.location === undefined) { return false; }
  return new URLSearchParams(globalThis.location.search).get("motion") === "1";
}

function isCaptureMode(): boolean {
  if (globalThis.location === undefined) { return false; }
  return new URLSearchParams(globalThis.location.search).get("capture") === "1";
}

function writeUrl(variant: StyleCohesionVariantKey, motion: boolean): void {
  const url = new URL(globalThis.location.href);
  url.searchParams.set("variant", variant);
  if (motion) {
    url.searchParams.set("motion", "1");
  } else {
    url.searchParams.delete("motion");
  }
  globalThis.history.replaceState(null, "", url);
}

export function StyleCohesionPrototype() {
  const [variant, setVariant] = useState<StyleCohesionVariantKey>(readVariant);
  const [motion, setMotion] = useState(readMotion);
  const variantInfo = styleCohesionVariants.find((item) => item.key === variant) ?? styleCohesionVariants[0];

  const changeVariant = (next: StyleCohesionVariantKey) => {
    writeUrl(next, motion);
    setVariant(next);
  };

  const toggleMotion = () => {
    const next = !motion;
    writeUrl(variant, next);
    setMotion(next);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") { return; }
      const target = event.target;
      if (
        target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || (target instanceof HTMLElement && target.isContentEditable)
      ) { return; }
      const currentIndex = styleCohesionVariants.findIndex((item) => item.key === variant);
      const delta = event.key === "ArrowLeft" ? -1 : 1;
      const nextIndex = (currentIndex + delta + styleCohesionVariants.length) % styleCohesionVariants.length;
      const next = styleCohesionVariants[nextIndex];
      if (next !== undefined) { changeVariant(next.key); }
    };
    globalThis.addEventListener("keydown", onKeyDown);
    return () => { globalThis.removeEventListener("keydown", onKeyDown); };
  });

  return (
    <main className="hp-noise flex min-h-screen flex-col bg-shell">
      <style>
        {`
          @keyframes cohesion-camera-pan {
            0%, 8% { transform: translate3d(-56px, -20px, 0); }
            48%, 58% { transform: translate3d(-196px, -52px, 0); }
            92%, 100% { transform: translate3d(-292px, -76px, 0); }
          }
          @keyframes cohesion-turn {
            0%, 34% { transform: scaleX(1); }
            35%, 65% { transform: scaleX(-1); }
            66%, 100% { transform: scaleX(1); }
          }
          .cohesion-world--motion {
            animation: cohesion-camera-pan 4s steps(28, end) infinite;
          }
          .cohesion-subject--motion {
            animation: cohesion-turn 4s steps(1, end) infinite;
          }
        `}
      </style>

      <header className="flex items-center justify-between border-b-2 border-line bg-panel px-5 py-3">
        <div className="flex items-baseline gap-4">
          <h1 className="font-display text-2xl leading-none font-extrabold tracking-[0.06em] text-ink uppercase">
            Cohesion
            <span className="text-accent"> field test</span>
          </h1>
          <span className="font-data text-[10px] tracking-[0.1em] text-ink-dim uppercase">
            /// throwaway prototype · controlled treatment study
          </span>
        </div>
        <div className="flex items-center gap-3">
          <StatusChip tone="warn" stamped>not production art</StatusChip>
          <StatusChip tone={motion ? "acid" : "neutral"}>{motion ? "motion run" : "controlled still"}</StatusChip>
        </div>
      </header>

      <div className="grid flex-1 place-items-center px-5 py-4">
        <div className="grid grid-cols-[480px_210px] gap-4">
          <section>
            <div className="mb-2 flex items-end justify-between font-data uppercase">
              <div>
                <div className="text-[9px] tracking-[0.15em] text-ink-dim">actual match scale</div>
                <div className="text-xs tracking-[0.08em] text-ink">480×270 fixed camera aperture</div>
              </div>
              <span className="text-[9px] tracking-[0.12em] text-accent-2">2:1 board · 24×32 @ 2×</span>
            </div>
            <div
              className="relative h-[270px] w-[480px] overflow-hidden border-2 border-line bg-shell shadow-hard-lg"
              data-prototype-stage
            >
              <div
                className={`absolute h-[360px] w-[840px] ${motion ? "cohesion-world--motion" : ""}`}
                style={{ transform: motion ? undefined : "translate3d(-174px, -46px, 0)" }}
              >
                <img
                  alt=""
                  className="block h-[360px] w-[840px] max-w-none"
                  draggable={false}
                  src={boardUrl}
                />
              </div>

              <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_58%,rgb(18_11_16_/_0.22)_58%)]" />
              <div
                className="absolute h-3 w-11 -translate-x-1/2 rounded-[50%] bg-shell/70"
                style={{ left: 247, top: 207, transform: "translateX(-50%) skewX(-48deg)" }}
              />
              <div
                className={`absolute origin-bottom ${motion ? "cohesion-subject--motion" : ""}`}
                style={{ left: 223, top: 145 }}
              >
                <PixelSubject scale={2} variant={variant} />
              </div>

              <div className="absolute top-3 left-3 border border-line/80 bg-shell/90 px-2 py-1 font-data text-[8px] tracking-[0.12em] text-ink-dim uppercase">
                camera fixed · translation only
              </div>
              <div className="absolute right-3 bottom-3 flex items-center gap-2 border border-line/80 bg-shell/90 px-2 py-1 font-data text-[8px] tracking-[0.1em] uppercase">
                <span className="text-ink-dim">Mara Voss</span>
                <span className="text-accent-2">field medic</span>
              </div>
            </div>
          </section>

          <aside className="flex flex-col border-2 border-line bg-panel shadow-hard-lg">
            <div className="border-b-2 border-line px-3 py-2 font-data uppercase">
              <div className="text-[9px] tracking-[0.14em] text-ink-dim">sprite inspection only</div>
              <div className="text-xs tracking-[0.08em] text-ink">authored cells at 6×</div>
            </div>
            <div className="grid flex-1 place-items-center bg-panel-2 py-2">
              <div className="relative">
                <div
                  className="absolute bottom-1 left-1/2 h-3 w-24 rounded-[50%] bg-shell/70"
                  style={{ transform: "translateX(-50%) skewX(-48deg)" }}
                />
                <div className={`relative origin-bottom ${motion ? "cohesion-subject--motion" : ""}`}>
                  <PixelSubject scale={6} variant={variant} />
                </div>
              </div>
            </div>
            <div className="border-t-2 border-line px-3 py-2 font-data text-[9px] leading-relaxed text-ink-dim uppercase">
              <div>Muted material body</div>
              <div className="text-ink">Rust livery identity</div>
              <div className="text-accent-2">Teal signal emission</div>
            </div>
          </aside>

          <section className="col-span-2 grid grid-cols-[1fr_210px] gap-4 border-2 border-line bg-panel px-4 py-3 shadow-hard">
            <div>
              <div className="font-display text-lg font-extrabold tracking-[0.05em] text-ink uppercase">
                {variant}
                {" "}
                —
                {" "}
                {variantInfo.name}
              </div>
              <p className="mt-1 max-w-xl font-data text-[10px] leading-relaxed text-ink-dim uppercase">
                {variantInfo.law}
              </p>
            </div>
            <div className="border-l border-line pl-4 font-data text-[9px] leading-relaxed text-ink-dim uppercase">
              <div>Same map + subject + pose</div>
              <div>Same palette roles + light</div>
              <div className="text-ink">Judge cohesion at 2× first</div>
            </div>
          </section>
        </div>
      </div>

      <footer className="flex items-center justify-between border-t-2 border-line bg-panel px-5 py-3 font-data text-[9px] uppercase">
        <span className="text-ink-dim">gritty / dangerous / lived-in · avoid toy-like</span>
        <span className="tracking-[0.1em] text-ink">70 / 25 / 5 hierarchy · plum-black anchor</span>
        <span className="text-ink-dim">SVG environment rasterized sharply to PNG</span>
      </footer>

      {import.meta.env.DEV && !isCaptureMode() && (
        <PrototypeSwitcher
          current={variant}
          motion={motion}
          onChange={changeVariant}
          onToggleMotion={toggleMotion}
        />
      )}
    </main>
  );
}

interface PrototypeSwitcherProps {
  current: StyleCohesionVariantKey;
  motion: boolean;
  onChange: (variant: StyleCohesionVariantKey) => void;
  onToggleMotion: () => void;
}

function PrototypeSwitcher({
  current,
  motion,
  onChange,
  onToggleMotion,
}: PrototypeSwitcherProps) {
  const currentIndex = styleCohesionVariants.findIndex((variant) => variant.key === current);
  const changeBy = (delta: -1 | 1) => {
    const nextIndex = (currentIndex + delta + styleCohesionVariants.length) % styleCohesionVariants.length;
    const next = styleCohesionVariants[nextIndex];
    if (next !== undefined) { onChange(next.key); }
  };
  const currentInfo = styleCohesionVariants[currentIndex] ?? styleCohesionVariants[0];

  return (
    <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 border-2 border-line bg-ink px-3 py-2 font-data text-xs text-shell uppercase shadow-hard-lg">
      <button
        type="button"
        aria-label="Previous prototype treatment"
        className="border border-shell/40 px-3 py-1 hover:bg-accent hover:text-ink"
        onClick={() => { changeBy(-1); }}
      >
        ←
      </button>
      <span className="min-w-48 text-center">
        {current}
        {" "}
        —
        {" "}
        {currentInfo.shortName}
      </span>
      <button
        type="button"
        aria-label="Next prototype treatment"
        className="border border-shell/40 px-3 py-1 hover:bg-accent-2 hover:text-ink"
        onClick={() => { changeBy(1); }}
      >
        →
      </button>
      <button
        type="button"
        className="ml-1 border border-shell/40 px-3 py-1 hover:bg-accent-2 hover:text-ink"
        onClick={onToggleMotion}
      >
        {motion ? "still" : "motion"}
      </button>
    </div>
  );
}
