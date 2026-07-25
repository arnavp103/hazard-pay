/**
 * THROWAWAY PROTOTYPE (#91) — environment register bake-off harness.
 *
 * Two treatments of one grime-market board, one camera, one palette, one
 * unit layer. Everything that could drift between them is shared code;
 * the only thing that differs is how the board's pixels are produced.
 *
 * Query params for deterministic capture:
 *   ?t=a|b                    which treatment (single view)
 *   ?view=single|split|stamp  single panel / side-by-side / stamp study
 *   ?zoom=combat|crowd        framing (both emit 1280×720, integer-scaled)
 *   ?units=0|1                composite the placeholder roster
 *   ?tier=all|hero|fodder     restrict the roster, for tier separation
 *   ?frame=0..5               ambient frame, for the filmstrips
 *   ?detail=0                 treatment B without its generated passes
 *   ?stamps=0                 treatment B without its authored stamps
 *   ?capture=1                hide the page chrome
 *
 * Run at `/match-proto`.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { StatusChip } from "@hazard-pay/ui";

import {
  type CameraKey,
  type Tier,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  AMBIENT_FRAMES,
  cameras,
} from "./board-model.ts";
import { createSurface } from "./pixel-canvas.ts";
import { drawUnitLayer } from "./compose.ts";
import { renderBoardPixels, renderPropSwatch } from "./treatment-b-pixel.ts";
import { renderBoardSvg, svgDataUrl } from "./treatment-a-svg.ts";

export const treatments = [
  {
    key: "a",
    name: "A — SVG→raster comic-book",
    law: "Ink-like outer contours, clean internal separations, flat cel-shaded colour clusters, graphic shapes. Agent writes shape markup; the rasterizer makes pixels.",
  },
  {
    key: "b",
    name: "B — MST register",
    law: "Dense illustrative pixel: clustered shading, layered props and clutter, warm lived-in surface, ground plane readable under a busy scene.",
  },
] as const;

export type TreatmentKey = (typeof treatments)[number]["key"];

type ViewKey = "single" | "split" | "stamp";

interface Options {
  capture: boolean;
  crisp: boolean;
  detail: boolean;
  frame: number;
  stamps: boolean;
  tier: "all" | Tier;
  treatment: TreatmentKey;
  units: boolean;
  view: ViewKey;
  zoom: CameraKey;
}

function readParams(): Options {
  const search = globalThis.location === undefined ? "" : globalThis.location.search;
  const params = new URLSearchParams(search);
  const treatment = params.get("t") === "b" ? "b" : "a";
  const viewParam = params.get("view");
  const view: ViewKey = viewParam === "split" || viewParam === "stamp" ? viewParam : "single";
  const zoomParam = params.get("zoom");
  const zoom: CameraKey = zoomParam !== null && zoomParam in cameras ? zoomParam as CameraKey : "combat";
  const tierParam = params.get("tier");
  const tier = tierParam === "hero" || tierParam === "fodder" ? tierParam : "all";
  return {
    capture: params.get("capture") === "1",
    crisp: params.get("crisp") === "1",
    detail: params.get("detail") !== "0",
    frame: Number.parseInt(params.get("frame") ?? "0", 10) % AMBIENT_FRAMES,
    stamps: params.get("stamps") !== "0",
    tier,
    treatment,
    units: params.get("units") !== "0",
    view,
    zoom,
  };
}

function surfaceToCanvas(width: number, height: number, data: Uint8ClampedArray): HTMLCanvasElement | null {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context === null) { return null; }
  context.imageSmoothingEnabled = false;
  context.putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
  return canvas;
}

/**
 * Treatment A's raster step. The agent authors SVG markup; the browser is
 * the rasterizer (sharp/resvg would be the build-time equivalent — this
 * lane deliberately adds no dependency to prove the register).
 */
function useTreatmentACanvas(frame: number, superScale: number): HTMLCanvasElement | null {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  useEffect(() => {
    let cancelled = false;
    const target = document.createElement("canvas");
    target.width = BOARD_WIDTH * superScale;
    target.height = BOARD_HEIGHT * superScale;
    const context = target.getContext("2d");
    if (context === null) { return; }
    const image = new Image();
    image.addEventListener("load", () => {
      if (cancelled) { return; }
      context.imageSmoothingEnabled = false;
      context.drawImage(image, 0, 0, BOARD_WIDTH * superScale, BOARD_HEIGHT * superScale);
      setCanvas(target);
    });
    image.src = svgDataUrl(renderBoardSvg({ frame }));
    return () => { cancelled = true; };
  }, [frame, superScale]);
  return canvas;
}

function useTreatmentBCanvas(frame: number, detail: boolean, stamps: boolean): HTMLCanvasElement | null {
  return useMemo(() => {
    const surface = renderBoardPixels({ detail, frame, stamps });
    return surfaceToCanvas(BOARD_WIDTH, BOARD_HEIGHT, surface.data);
  }, [frame, detail, stamps]);
}

function useUnitCanvas(enabled: boolean, tier: "all" | Tier): HTMLCanvasElement | null {
  return useMemo(() => {
    if (!enabled) { return null; }
    const surface = createSurface(BOARD_WIDTH, BOARD_HEIGHT);
    drawUnitLayer(surface, tier === "all" ? {} : { tiers: [tier] });
    return surfaceToCanvas(BOARD_WIDTH, BOARD_HEIGHT, surface.data);
  }, [enabled, tier]);
}

interface PanelProps {
  board: HTMLCanvasElement | null;
  label: string;
  panelId: string;
  /** Board-pixels-per-source-pixel; >1 when treatment A rasterizes crisp. */
  sourceScale?: number;
  units: HTMLCanvasElement | null;
  zoom: CameraKey;
}

function BoardPanel({ board, label, panelId, sourceScale = 1, units, zoom }: PanelProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const camera = cameras[zoom];
  const width = camera.width * camera.scale;
  const height = camera.height * camera.scale;

  useEffect(() => {
    const canvas = ref.current;
    if (canvas === null || board === null) { return; }
    const context = canvas.getContext("2d");
    if (context === null) { return; }
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, width, height);
    context.drawImage(
      board,
      camera.x * sourceScale,
      camera.y * sourceScale,
      camera.width * sourceScale,
      camera.height * sourceScale,
      0,
      0,
      width,
      height,
    );
    if (units !== null) {
      context.drawImage(units, camera.x, camera.y, camera.width, camera.height, 0, 0, width, height);
    }
    canvas.dataset["ready"] = "1";
  }, [board, units, camera, width, height, sourceScale]);

  return (
    <figure className="m-0" data-panel={panelId}>
      <canvas
        aria-label={label}
        className="block border-2 border-line"
        data-ready="0"
        height={height}
        id={panelId}
        ref={ref}
        role="img"
        style={{ imageRendering: "pixelated" }}
        width={width}
      />
    </figure>
  );
}

interface SwatchProps {
  caption: string;
  detail: boolean;
  propId: string;
  stamps: boolean;
}

/**
 * The production-risk exhibit: one prop with the authored stamp layer, and
 * the same prop with only the generated passes. Same geometry, same
 * palette, same shading — the difference is entirely "is there an object
 * on it".
 */
function PropSwatch({ caption, detail, propId, stamps }: SwatchProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const surface = useMemo(() => renderPropSwatch(propId, { detail, stamps }), [propId, detail, stamps]);
  const scale = 2;

  useEffect(() => {
    const canvas = ref.current;
    if (canvas === null) { return; }
    const context = canvas.getContext("2d");
    if (context === null) { return; }
    const source = surfaceToCanvas(surface.width, surface.height, surface.data);
    if (source === null) { return; }
    context.imageSmoothingEnabled = false;
    context.drawImage(source, 0, 0, surface.width, surface.height, 0, 0, surface.width * scale, surface.height * scale);
    canvas.dataset["ready"] = "1";
  }, [surface]);

  return (
    <figure className="m-0">
      <canvas
        aria-label={caption}
        className="block border-2 border-line"
        data-ready="0"
        height={surface.height * scale}
        ref={ref}
        role="img"
        style={{ imageRendering: "pixelated" }}
        width={surface.width * scale}
      />
      <figcaption className="mt-1 font-data text-[10px] tracking-[0.1em] text-ink-dim uppercase">
        {caption}
      </figcaption>
    </figure>
  );
}

export function EnvironmentRegisterPrototype() {
  const [options] = useState<Options>(readParams);
  const superScale = options.crisp ? cameras[options.zoom].scale : 1;
  const boardA = useTreatmentACanvas(options.frame, superScale);
  const boardB = useTreatmentBCanvas(options.frame, options.detail, options.stamps);
  const unitCanvas = useUnitCanvas(options.units, options.tier);
  const active = treatments.find((entry) => entry.key === options.treatment) ?? treatments[0];

  const body = options.view === "stamp"
    ? (
        <div className="grid grid-cols-2 gap-4" data-panel="stamp-study">
          <PropSwatch caption="Stall — generated passes only" detail propId="stall-ne-1" stamps={false} />
          <PropSwatch caption="Stall — with authored stamps" detail propId="stall-ne-1" stamps />
          <PropSwatch caption="Crate stack — generated passes only" detail propId="crate-ne" stamps={false} />
          <PropSwatch caption="Crate stack — with authored stamps" detail propId="crate-ne" stamps />
        </div>
      )
    : options.view === "split"
      ? (
          <div className="flex items-start gap-3" data-panel="split">
            <BoardPanel board={boardA} label="Treatment A" panelId="panel-a" sourceScale={superScale} units={unitCanvas} zoom="split" />
            <BoardPanel board={boardB} label="Treatment B" panelId="panel-b" units={unitCanvas} zoom="split" />
          </div>
        )
      : (
          <BoardPanel
            board={options.treatment === "a" ? boardA : boardB}
            label={active.name}
            panelId="panel-single"
            sourceScale={options.treatment === "a" ? superScale : 1}
            units={unitCanvas}
            zoom={options.zoom}
          />
        );

  if (options.capture) {
    return <main className="inline-block bg-shell p-0">{body}</main>;
  }

  return (
    <main className="hp-noise flex min-h-screen flex-col bg-shell">
      <header className="flex items-center justify-between border-b-2 border-line bg-panel px-5 py-3">
        <div className="flex items-baseline gap-4">
          <h1 className="font-display text-2xl leading-none font-extrabold tracking-[0.06em] text-ink uppercase">
            Environment
            <span className="text-accent"> register</span>
          </h1>
          <span className="font-data text-[10px] tracking-[0.1em] text-ink-dim uppercase">
            /// bake-off lane 5 · one board, two treatments
          </span>
        </div>
        <div className="flex items-center gap-3">
          <StatusChip tone="warn" stamped>not production art</StatusChip>
          <StatusChip tone="neutral">{cameras[options.zoom].label}</StatusChip>
        </div>
      </header>

      <div className="grid flex-1 place-items-center px-5 py-4">
        <div>
          {body}
          <p className="mt-3 max-w-[1280px] font-data text-[11px] leading-relaxed tracking-[0.04em] text-ink-dim">
            <span className="text-ink">{active.name}</span>
            {" — "}
            {active.law}
          </p>
        </div>
      </div>
    </main>
  );
}
