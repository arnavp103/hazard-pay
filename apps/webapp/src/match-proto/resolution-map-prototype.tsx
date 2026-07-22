/**
 * THROWAWAY PROTOTYPE (#68): compare 24×32 and 32×48 character sprites at
 * actual match scale over one fixed map. Variants deliberately hold layout,
 * palette, camera, and ground line constant so resolution is the variable.
 */

import { useEffect, useState } from "react";

import { StatusChip } from "@hazard-pay/ui";

const STAGE_WIDTH = 480;
const STAGE_HEIGHT = 270;
const GROUND_Y = 232;

type VariantKey = "A" | "B" | "C";

interface PixelCluster {
  color: string;
  height: number;
  width: number;
  x: number;
  y: number;
}

interface SpriteStudy {
  authoredCells: number;
  clusters: PixelCluster[];
  height: number;
  label: string;
  scale: number;
  width: number;
}

const colors = {
  acid: "#c8f031",
  acidBright: "#e9ff7a",
  boot: "#181218",
  cyan: "#2ed9ff",
  ink: "#120b10",
  jacket: "#4b5531",
  jacketLight: "#697440",
  magenta: "#ff2e6c",
  metal: "#8e8290",
  pants: "#31293a",
  skin: "#d99e6a",
};

const sprite24: SpriteStudy = {
  authoredCells: 24 * 32,
  height: 32,
  label: "24×32 · 3×",
  scale: 3,
  width: 24,
  clusters: [
    { x: 8, y: 1, width: 8, height: 2, color: colors.ink },
    { x: 10, y: 0, width: 5, height: 2, color: colors.acid },
    { x: 7, y: 3, width: 10, height: 8, color: colors.ink },
    { x: 8, y: 4, width: 8, height: 6, color: colors.skin },
    { x: 8, y: 5, width: 8, height: 2, color: colors.cyan },
    { x: 9, y: 5, width: 5, height: 1, color: "#b9f7ff" },
    { x: 10, y: 10, width: 4, height: 3, color: colors.ink },
    { x: 4, y: 12, width: 16, height: 12, color: colors.ink },
    { x: 5, y: 13, width: 14, height: 10, color: colors.jacket },
    { x: 5, y: 14, width: 3, height: 7, color: colors.jacketLight },
    { x: 3, y: 14, width: 3, height: 9, color: colors.ink },
    { x: 18, y: 14, width: 3, height: 9, color: colors.ink },
    { x: 2, y: 16, width: 2, height: 6, color: colors.skin },
    { x: 20, y: 16, width: 2, height: 6, color: colors.skin },
    { x: 10, y: 13, width: 2, height: 10, color: colors.magenta },
    { x: 12, y: 14, width: 5, height: 2, color: colors.acid },
    { x: 15, y: 16, width: 2, height: 2, color: colors.acidBright },
    { x: 7, y: 23, width: 5, height: 7, color: colors.ink },
    { x: 13, y: 23, width: 5, height: 7, color: colors.ink },
    { x: 8, y: 23, width: 3, height: 6, color: colors.pants },
    { x: 14, y: 23, width: 3, height: 6, color: colors.pants },
    { x: 6, y: 29, width: 6, height: 3, color: colors.boot },
    { x: 13, y: 29, width: 6, height: 3, color: colors.boot },
  ],
};

const sprite32: SpriteStudy = {
  authoredCells: 32 * 48,
  height: 48,
  label: "32×48 · 2×",
  scale: 2,
  width: 32,
  clusters: [
    { x: 12, y: 2, width: 11, height: 2, color: colors.ink },
    { x: 16, y: 0, width: 6, height: 3, color: colors.acid },
    { x: 10, y: 4, width: 14, height: 9, color: colors.ink },
    { x: 12, y: 13, width: 10, height: 3, color: colors.ink },
    { x: 11, y: 5, width: 12, height: 7, color: colors.skin },
    { x: 13, y: 12, width: 8, height: 3, color: colors.skin },
    { x: 10, y: 6, width: 14, height: 3, color: colors.cyan },
    { x: 12, y: 6, width: 8, height: 1, color: "#b9f7ff" },
    { x: 21, y: 7, width: 2, height: 1, color: "#167791" },
    { x: 13, y: 10, width: 2, height: 2, color: "#bd7d55" },
    { x: 18, y: 13, width: 3, height: 1, color: "#8d503d" },
    { x: 14, y: 16, width: 6, height: 3, color: colors.ink },
    { x: 7, y: 18, width: 20, height: 5, color: colors.ink },
    { x: 9, y: 23, width: 16, height: 13, color: colors.ink },
    { x: 10, y: 19, width: 15, height: 16, color: colors.jacket },
    { x: 8, y: 20, width: 4, height: 11, color: colors.jacketLight },
    { x: 11, y: 34, width: 12, height: 3, color: colors.ink },
    { x: 4, y: 20, width: 4, height: 8, color: colors.ink },
    { x: 2, y: 27, width: 5, height: 3, color: colors.ink },
    { x: 1, y: 30, width: 4, height: 5, color: colors.skin },
    { x: 2, y: 30, width: 1, height: 2, color: "#f1bb81" },
    { x: 26, y: 19, width: 4, height: 12, color: colors.ink },
    { x: 28, y: 30, width: 3, height: 5, color: colors.skin },
    { x: 29, y: 25, width: 2, height: 6, color: colors.metal },
    { x: 30, y: 26, width: 1, height: 3, color: "#b5abb6" },
    { x: 13, y: 19, width: 3, height: 16, color: colors.magenta },
    { x: 17, y: 20, width: 7, height: 3, color: colors.acid },
    { x: 20, y: 23, width: 3, height: 3, color: colors.acidBright },
    { x: 17, y: 27, width: 2, height: 8, color: colors.metal },
    { x: 20, y: 28, width: 4, height: 2, color: "#303923" },
    { x: 22, y: 31, width: 2, height: 3, color: "#303923" },
    { x: 25, y: 21, width: 3, height: 8, color: colors.magenta },
    { x: 10, y: 36, width: 8, height: 10, color: colors.ink },
    { x: 18, y: 36, width: 8, height: 10, color: colors.ink },
    { x: 11, y: 36, width: 6, height: 8, color: colors.pants },
    { x: 19, y: 36, width: 6, height: 8, color: colors.pants },
    { x: 13, y: 37, width: 2, height: 5, color: "#493c53" },
    { x: 21, y: 37, width: 2, height: 5, color: "#493c53" },
    { x: 8, y: 44, width: 10, height: 4, color: colors.boot },
    { x: 18, y: 44, width: 10, height: 4, color: colors.boot },
    { x: 9, y: 44, width: 5, height: 1, color: colors.metal },
    { x: 20, y: 44, width: 4, height: 1, color: colors.metal },
  ],
};

const variants: Record<VariantKey, { description: string; label: string }> = {
  A: {
    description: "Chunkier clusters · lower frame cost · exact 72×96 footprint",
    label: "24×32 at 3×",
  },
  B: {
    description: "Finer contour and gear cues · 64×96 footprint",
    label: "32×48 at 2×",
  },
  C: {
    description: "Both candidates on one ground line at actual match scale",
    label: "Same-map lineup",
  },
};

export function ResolutionMapPrototype() {
  const [variant, setVariant] = useState<VariantKey>(readVariant);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") { return; }
      const target = event.target;
      if (
        target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || (target instanceof HTMLElement && target.isContentEditable)
      ) { return; }
      cycleVariant(variant, event.key === "ArrowLeft" ? -1 : 1, setVariant);
    };
    globalThis.addEventListener("keydown", onKeyDown);
    return () => { globalThis.removeEventListener("keydown", onKeyDown); };
  }, [variant]);

  return (
    <main className="hp-noise flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b-2 border-line bg-panel px-5 py-3">
        <div className="flex items-baseline gap-4">
          <h1 className="font-display text-2xl leading-none font-extrabold tracking-[0.06em] text-ink uppercase">
            Resolution
            <span className="text-accent"> field test</span>
          </h1>
          <span className="font-data text-[10px] tracking-[0.1em] text-ink-dim uppercase">
            /// throwaway prototype · same map / same camera
          </span>
        </div>
        <StatusChip tone="warn" stamped>not production art</StatusChip>
      </header>

      <div className="grid flex-1 place-items-center gap-4 p-8">
        <div>
          <div className="mb-3 font-data uppercase">
            <div className="flex items-center justify-between gap-4">
              <div className="text-xs tracking-[0.12em] text-ink">{variants[variant].label}</div>
              <span className="text-[9px] tracking-[0.12em] text-accent-2">480×270 logical match canvas</span>
            </div>
            <div className="mt-1 text-[10px] text-ink-dim">{variants[variant].description}</div>
          </div>
          <svg
            aria-label={`Character resolution prototype: ${variants[variant].label}`}
            className="border-2 border-line bg-shell shadow-hard-lg"
            height={STAGE_HEIGHT}
            role="img"
            shapeRendering="crispEdges"
            viewBox={`0 0 ${String(STAGE_WIDTH)} ${String(STAGE_HEIGHT)}`}
            width={STAGE_WIDTH}
          >
            <GrimeMarketMap />
            {variant === "A" && <PixelCharacter spec={sprite24} x={240} />}
            {variant === "B" && <PixelCharacter spec={sprite32} x={240} />}
            {variant === "C" && (
              <>
                <PixelCharacter spec={sprite24} x={180} />
                <PixelCharacter spec={sprite32} x={300} />
                <StudyLabel text="24×32 / 3×" x={180} />
                <StudyLabel text="32×48 / 2×" x={300} />
              </>
            )}
          </svg>
        </div>
      </div>

      <footer className="flex items-center justify-between border-t-2 border-line bg-panel px-5 py-3 font-data text-[10px] uppercase">
        <span className="text-ink-dim">compare silhouette first, detail second</span>
        <span className="tracking-[0.1em] text-ink">feet share y=232 · character height=96px</span>
        <span className="text-ink-dim">map is fixed experimental context</span>
      </footer>

      {import.meta.env.DEV && !isCaptureMode() && (
        <PrototypeSwitcher current={variant} onChange={setVariant} />
      )}
    </main>
  );
}

function GrimeMarketMap() {
  return (
    <g>
      <defs>
        <pattern id="floor-grid" width="24" height="12" patternUnits="userSpaceOnUse">
          <path d="M 0 12 L 12 0 L 24 12" fill="none" stroke="#3d2939" strokeWidth="1" />
        </pattern>
        <pattern id="halftone" width="8" height="8" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" fill="#ff2e6c" opacity="0.16" r="1" />
        </pattern>
      </defs>

      <rect fill="#120b10" height="270" width="480" />
      <rect fill="#1b111a" height="158" width="480" />
      <rect fill="url(#halftone)" height="158" width="480" />

      <path d="M0 72 L44 42 L86 58 L126 26 L178 55 L221 34 L270 59 L319 18 L365 50 L420 31 L480 61 L480 158 L0 158Z" fill="#241724" />
      <path d="M0 92 L52 72 L99 87 L147 61 L197 81 L250 64 L304 88 L359 59 L416 82 L480 67 L480 158 L0 158Z" fill="#2c1c2b" />

      <rect fill="#251826" height="90" stroke="#3d2939" strokeWidth="3" width="116" x="18" y="54" />
      <rect fill="#120b10" height="25" stroke="#ff2e6c" strokeWidth="2" width="78" x="37" y="69" />
      <text fill="#ff2e6c" fontFamily="monospace" fontSize="12" fontWeight="700" letterSpacing="2" x="49" y="86">GUTTER 9</text>
      <path d="M27 102 H124 M27 114 H124 M27 126 H124" stroke="#3d2939" strokeWidth="3" />

      <rect fill="#20151f" height="105" stroke="#3d2939" strokeWidth="3" width="122" x="342" y="39" />
      <path d="M354 52 H451 V91 H354Z" fill="#151c1f" stroke="#2ed9ff" strokeWidth="2" />
      <path d="M365 60 H441 M365 70 H423 M365 80 H434" opacity="0.55" stroke="#2ed9ff" strokeWidth="2" />
      <rect fill="#c8f031" height="16" width="62" x="374" y="105" />
      <text fill="#120b10" fontFamily="monospace" fontSize="9" fontWeight="700" letterSpacing="1" x="382" y="116">PIT OPEN</text>

      <path d="M135 116 H345" stroke="#120b10" strokeWidth="8" />
      <path d="M155 93 V145 M325 90 V145" stroke="#3d2939" strokeWidth="7" />
      <path d="M160 99 H320" stroke="#8e8290" strokeWidth="3" />
      <path d="M193 99 L185 119 H206 L198 139 M275 99 L267 119 H288 L280 139" fill="none" stroke="#c8f031" strokeWidth="3" />

      <path d="M0 158 H480 V270 H0Z" fill="#2a1b29" />
      <path d="M0 158 H480 V270 H0Z" fill="url(#floor-grid)" opacity="0.72" />
      <path d="M0 158 H480" stroke="#ff2e6c" strokeWidth="3" />
      <path d="M112 270 L198 158 M368 270 L282 158" stroke="#4b3045" strokeWidth="2" />
      <path d="M80 210 H400" stroke="#4b3045" strokeDasharray="10 8" strokeWidth="2" />
      <ellipse cx="240" cy="231" fill="#120b10" opacity="0.32" rx="118" ry="23" />
      <path d="M129 249 H351" stroke="#c8f031" strokeDasharray="14 9" strokeWidth="2" />

      <path d="M20 178 H73 L84 194 H31Z" fill="#3d2939" stroke="#120b10" strokeWidth="2" />
      <path d="M401 177 H456 L444 196 H390Z" fill="#3d2939" stroke="#120b10" strokeWidth="2" />
      <path d="M32 178 L39 191 M47 178 L54 191 M62 178 L69 191" stroke="#c8f031" strokeWidth="3" />
      <path d="M410 180 L402 192 M425 180 L417 193 M440 180 L432 194" stroke="#ff2e6c" strokeWidth="3" />
    </g>
  );
}

function PixelCharacter({ spec, x }: { spec: SpriteStudy; x: number }) {
  const screenWidth = spec.width * spec.scale;
  const screenHeight = spec.height * spec.scale;
  return (
    <g>
      <ellipse cx={x} cy={GROUND_Y + 3} fill="#000000" opacity="0.48" rx={screenWidth * 0.37} ry="5" />
      <g transform={`translate(${String(x - screenWidth / 2)} ${String(GROUND_Y - screenHeight)}) scale(${String(spec.scale)})`}>
        {spec.clusters.map((cluster, index) => (
          <rect
            // The throwaway study is deliberately cluster-authored, not polished production art.
            key={`${String(index)}-${cluster.color}`}
            fill={cluster.color}
            height={cluster.height}
            width={cluster.width}
            x={cluster.x}
            y={cluster.y}
          />
        ))}
      </g>
    </g>
  );
}

function StudyLabel({ text, x }: { text: string; x: number }) {
  return (
    <g>
      <rect fill="#120b10" height="18" opacity="0.9" stroke="#3d2939" width="90" x={x - 45} y="242" />
      <text fill="#e8dfe7" fontFamily="monospace" fontSize="9" textAnchor="middle" x={x} y="254">{text}</text>
    </g>
  );
}

function isVariantKey(value: string | null): value is VariantKey {
  return value === "A" || value === "B" || value === "C";
}

function readVariant(): VariantKey {
  if (globalThis.location === undefined) { return "A"; }
  const candidate = new URLSearchParams(globalThis.location.search).get("variant");
  return isVariantKey(candidate) ? candidate : "A";
}

function isCaptureMode(): boolean {
  if (globalThis.location === undefined) { return false; }
  return new URLSearchParams(globalThis.location.search).get("capture") === "1";
}

function cycleVariant(current: VariantKey, delta: -1 | 1, onChange: (variant: VariantKey) => void) {
  const keys: VariantKey[] = ["A", "B", "C"];
  const currentIndex = keys.indexOf(current);
  const next = keys[(currentIndex + delta + keys.length) % keys.length];
  if (next === undefined) { return; }
  const url = new URL(globalThis.location.href);
  url.searchParams.set("study", "resolution");
  url.searchParams.set("variant", next);
  globalThis.history.replaceState(null, "", url);
  onChange(next);
}

function PrototypeSwitcher({ current, onChange }: { current: VariantKey; onChange: (variant: VariantKey) => void }) {
  return (
    <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 border-2 border-line bg-ink px-3 py-2 font-data text-xs text-shell uppercase shadow-hard-lg">
      <button
        aria-label="Previous prototype variant"
        className="border border-shell/40 px-3 py-1 hover:bg-accent hover:text-ink"
        onClick={() => { cycleVariant(current, -1, onChange); }}
        type="button"
      >
        ←
      </button>
      <span className="min-w-44 text-center">
        {current}
        {" — "}
        {variants[current].label}
      </span>
      <button
        aria-label="Next prototype variant"
        className="border border-shell/40 px-3 py-1 hover:bg-accent-2 hover:text-ink"
        onClick={() => { cycleVariant(current, 1, onChange); }}
        type="button"
      >
        →
      </button>
    </div>
  );
}
