/**
 * THROWAWAY PROTOTYPE (#91) — environment register bake-off harness.
 *
 * Two treatments of one grime-market board, one camera, one palette, one unit
 * layer, one occlusion pipeline. Everything that could drift between them is
 * shared code; the only thing that differs is how the board's pixels are
 * produced.
 *
 * ROUND 2 tightened the control. Round 1 composited units as a separate canvas
 * laid over each finished board, which made the unit layer identical between
 * treatments in the weakest possible sense — identical *and* wrong, since a
 * flat overlay cannot be occluded. Both treatments now hand their finished
 * 640×360 board to `composeUnits`, which cuts units against the shared prop
 * geometry and inks their silhouettes against whatever that treatment actually
 * drew. The unit code path is still one path; it just does real work now.
 *
 * Query params for deterministic capture:
 *   ?t=a|b                      which treatment (single view)
 *   ?view=single|split|cover|occlusion|stamp
 *   ?zoom=native|native3x|combat|combat1x|split|cover
 *   ?units=0|1                  composite the roster
 *   ?frame=0..5                 ambient frame, for the filmstrips
 *   ?detail=0                   treatment B without its generated passes
 *   ?stamps=0                   treatment B without its authored stamps
 *   ?gray=1                     grayscale pass, for the value check
 *   ?capture=1                  hide the page chrome
 *
 * Run at `/env-register`.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { StatusChip } from "@hazard-pay/ui";

import {
  type CameraKey,
  AMBIENT_FRAMES,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  FODDER_FIGURE,
  cameras,
  propSpecs,
} from "./board-model.ts";
import { type Surface } from "./pixel-canvas.ts";
import { type UnitOcclusion, buildDepthIndex, composeUnits } from "./compose.ts";
import { COVER_PANEL_H, COVER_PANEL_W, coverFrames, units as roster } from "./roster.ts";
import { luma, rgbToHex } from "./palette.ts";
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

type ViewKey = "cover" | "occlusion" | "single" | "split" | "stamp";

interface Options {
  capture: boolean;
  detail: boolean;
  frame: number;
  gray: boolean;
  stamps: boolean;
  treatment: TreatmentKey;
  units: boolean;
  view: ViewKey;
  zoom: CameraKey;
}

const VIEWS: ViewKey[] = ["cover", "occlusion", "single", "split", "stamp"];

function readParams(): Options {
  const search = globalThis.location === undefined ? "" : globalThis.location.search;
  const params = new URLSearchParams(search);
  const viewParam = params.get("view");
  const view: ViewKey = VIEWS.includes(viewParam as ViewKey) ? viewParam as ViewKey : "single";
  const zoomParam = params.get("zoom");
  const zoom: CameraKey = zoomParam !== null && zoomParam in cameras ? zoomParam as CameraKey : "native";
  return {
    capture: params.get("capture") === "1",
    detail: params.get("detail") !== "0",
    frame: Number.parseInt(params.get("frame") ?? "0", 10) % AMBIENT_FRAMES,
    gray: params.get("gray") === "1",
    stamps: params.get("stamps") !== "0",
    treatment: params.get("t") === "b" ? "b" : "a",
    units: params.get("units") !== "0",
    view,
    zoom,
  };
}

function surfaceToCanvas(surface: Surface): HTMLCanvasElement | null {
  const canvas = document.createElement("canvas");
  canvas.width = surface.width;
  canvas.height = surface.height;
  const context = canvas.getContext("2d");
  if (context === null) { return null; }
  context.imageSmoothingEnabled = false;
  context.putImageData(new ImageData(new Uint8ClampedArray(surface.data), surface.width, surface.height), 0, 0);
  return canvas;
}

function cloneSurface(surface: Surface): Surface {
  return { width: surface.width, height: surface.height, data: new Uint8ClampedArray(surface.data) };
}

/** Rec. 601 luma pass — the grayscale legibility check, applied last. */
function toGrayscale(surface: Surface): Surface {
  const out = cloneSurface(surface);
  for (let at = 0; at < out.data.length; at += 4) {
    const value = Math.round(luma(rgbToHex(out.data[at] ?? 0, out.data[at + 1] ?? 0, out.data[at + 2] ?? 0)));
    out.data[at] = value;
    out.data[at + 1] = value;
    out.data[at + 2] = value;
  }
  return out;
}

/**
 * Treatment A's raster step. The agent authors SVG markup; the browser is the
 * rasterizer (sharp/resvg would be the build-time equivalent — this lane
 * deliberately adds no dependency to prove the register). The result is read
 * back into a plain pixel buffer so the unit compositor treats both treatments
 * identically.
 */
function useTreatmentASurface(frame: number): Surface | null {
  const [surface, setSurface] = useState<Surface | null>(null);
  useEffect(() => {
    let cancelled = false;
    const target = document.createElement("canvas");
    target.width = BOARD_WIDTH;
    target.height = BOARD_HEIGHT;
    const context = target.getContext("2d", { willReadFrequently: true });
    if (context === null) { return; }
    const image = new Image();
    image.addEventListener("load", () => {
      if (cancelled) { return; }
      context.imageSmoothingEnabled = false;
      context.drawImage(image, 0, 0, BOARD_WIDTH, BOARD_HEIGHT);
      const data = context.getImageData(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
      setSurface({ width: BOARD_WIDTH, height: BOARD_HEIGHT, data: data.data });
    });
    image.src = svgDataUrl(renderBoardSvg({ frame }));
    return () => { cancelled = true; };
  }, [frame]);
  return surface;
}

function useTreatmentBSurface(frame: number, detail: boolean, stamps: boolean): Surface {
  return useMemo(() => renderBoardPixels({ detail, frame, stamps }), [frame, detail, stamps]);
}

interface Composed {
  surface: Surface | null;
  occlusion: UnitOcclusion[];
  edgesTotal: number;
  edgesDissolving: number;
}

/** Board plus units, occluded against the shared geometry. */
function useComposed(board: Surface | null, showUnits: boolean, gray: boolean): Composed {
  return useMemo(() => {
    if (board === null) { return { surface: null, occlusion: [], edgesTotal: 0, edgesDissolving: 0 }; }
    const surface = cloneSurface(board);
    if (!showUnits) { return { surface: gray ? toGrayscale(surface) : surface, occlusion: [], edgesTotal: 0, edgesDissolving: 0 }; }
    const result = composeUnits(surface, { index: buildDepthIndex(roster), roster });
    return {
      surface: gray ? toGrayscale(surface) : surface,
      occlusion: result.occlusion,
      edgesTotal: result.edgesTotal,
      edgesDissolving: result.edgesDissolving,
    };
  }, [board, showUnits, gray]);
}

interface PanelProps {
  aperture?: { x: number; y: number; width: number; height: number; scale: number };
  label: string;
  panelId: string;
  surface: Surface | null;
  zoom?: CameraKey;
}

function BoardPanel({ aperture, label, panelId, surface, zoom }: PanelProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const frame = aperture ?? cameras[zoom ?? "native"];
  const width = frame.width * frame.scale;
  const height = frame.height * frame.scale;

  useEffect(() => {
    const canvas = ref.current;
    if (canvas === null || surface === null) { return; }
    const context = canvas.getContext("2d");
    if (context === null) { return; }
    const source = surfaceToCanvas(surface);
    if (source === null) { return; }
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, width, height);
    context.drawImage(source, frame.x, frame.y, frame.width, frame.height, 0, 0, width, height);
    canvas.dataset["ready"] = "1";
  }, [surface, frame, width, height]);

  return (
    <figure className="m-0" data-panel={panelId}>
      <canvas
        aria-label={label}
        className="block border border-line"
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

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <figcaption className="mt-1 max-w-[320px] font-data text-[10px] leading-snug tracking-[0.06em] text-ink-dim uppercase">
      {children}
    </figcaption>
  );
}

/**
 * The cover-variety sheet: the same board, cropped onto every cover kind it
 * carries, each with a real unit posted behind it. The label states the cover
 * class, the silhouette height in board pixels, and that height as a multiple
 * of the 22 px fodder figure — which is the number that actually predicts what
 * a player sees.
 */
function CoverSheet({ occlusion, surface }: { occlusion: UnitOcclusion[]; surface: Surface | null }) {
  const frames = useMemo(() => coverFrames(), []);
  const hiddenByKind = new Map(
    occlusion.filter((entry) => entry.unitId.startsWith("cover-")).map((entry) => [entry.unitId.slice(6), entry]),
  );
  return (
    <div className="grid grid-cols-4 gap-3" data-panel="cover-sheet">
      {frames.map((frame) => {
        const posted = hiddenByKind.get(frame.kind);
        const verdict = posted === undefined
          ? "no unit posted — perimeter, not cover"
          : `${String(Math.round(posted.fraction * 100))}% of the posted unit hidden${posted.shaded ? ", in shade" : ""}`;
        return (
          <figure className="m-0 flex flex-col" key={frame.kind}>
            <BoardPanel
              aperture={{ height: COVER_PANEL_H, scale: 3, width: COVER_PANEL_W, x: frame.x, y: frame.y }}
              label={frame.note}
              panelId={`cover-${frame.kind}`}
              surface={surface}
            />
            <figcaption className="mt-1 min-h-[64px] font-data text-[10px] leading-snug tracking-[0.06em] text-ink-dim uppercase">
              <span className="text-ink">{frame.kind}</span>
              {` · ${frame.cover} · ${String(frame.height)}px = ${String(frame.figureRatio)}× figure`}
              <br />
              <span className="text-accent">{verdict}</span>
              <br />
              {frame.note}
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

/** The occlusion proof, with the measured numbers next to the picture. */
function OcclusionProof({ occlusion, surface }: { occlusion: UnitOcclusion[]; surface: Surface | null }) {
  const cut = occlusion
    .filter((entry) => entry.hidden > 0 && entry.drawn > 0)
    .sort((a, b) => b.fraction - a.fraction)
    .slice(0, 12);
  const clear = occlusion.filter((entry) => entry.hidden === 0).length;
  return (
    <div className="flex items-start gap-4" data-panel="occlusion">
      <BoardPanel label="Occlusion proof" panelId="panel-occlusion" surface={surface} zoom="cover" />
      <div className="font-data text-[11px] leading-relaxed tracking-[0.04em] text-ink-dim">
        <p className="text-ink">
          {String(cut.length)}
          {" of "}
          {String(occlusion.length)}
          {" units are cut by a prop; "}
          {String(clear)}
          {" are fully clear."}
        </p>
        <table className="mt-2">
          <tbody>
            {cut.map((entry) => (
              <tr key={entry.unitId}>
                <td className="pr-3 text-ink">{entry.unitId}</td>
                <td className="pr-3">{`${String(Math.round(entry.fraction * 100))}% hidden`}</td>
                <td>{entry.occluders.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface SwatchProps {
  caption: string;
  detail: boolean;
  propId: string;
  stamps: boolean;
}

/**
 * The production-risk exhibit: one prop with the authored stamp layer, and the
 * same prop with only the generated passes.
 */
function PropSwatch({ caption, detail, propId, stamps }: SwatchProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const surface = useMemo(() => renderPropSwatch(propId, { detail, stamps }), [propId, detail, stamps]);
  const scale = 3;

  useEffect(() => {
    const canvas = ref.current;
    if (canvas === null) { return; }
    const context = canvas.getContext("2d");
    if (context === null) { return; }
    const source = surfaceToCanvas(surface);
    if (source === null) { return; }
    context.imageSmoothingEnabled = false;
    context.drawImage(source, 0, 0, surface.width, surface.height, 0, 0, surface.width * scale, surface.height * scale);
    canvas.dataset["ready"] = "1";
  }, [surface]);

  return (
    <figure className="m-0">
      <canvas
        aria-label={caption}
        className="block border border-line"
        data-ready="0"
        height={surface.height * scale}
        ref={ref}
        role="img"
        style={{ imageRendering: "pixelated" }}
        width={surface.width * scale}
      />
      <Caption>{caption}</Caption>
    </figure>
  );
}

export function EnvironmentRegisterPrototype() {
  const [options] = useState<Options>(readParams);
  const boardA = useTreatmentASurface(options.frame);
  const boardB = useTreatmentBSurface(options.frame, options.detail, options.stamps);
  const composedA = useComposed(boardA, options.units, options.gray);
  const composedB = useComposed(boardB, options.units, options.gray);
  const active = treatments.find((entry) => entry.key === options.treatment) ?? treatments[0];
  const own = options.treatment === "a" ? composedA : composedB;

  const body = options.view === "stamp"
    ? (
        <div className="grid grid-cols-2 gap-4" data-panel="stamp-study">
          <PropSwatch caption="Stall — generated passes only" detail propId="stall-nw" stamps={false} />
          <PropSwatch caption="Stall — with authored stamps" detail propId="stall-nw" stamps />
          <PropSwatch caption="Container — generated passes only" detail propId="container-ne" stamps={false} />
          <PropSwatch caption="Container — with authored stamps" detail propId="container-ne" stamps />
        </div>
      )
    : options.view === "cover"
      ? <CoverSheet occlusion={own.occlusion} surface={own.surface} />
      : options.view === "occlusion"
        ? <OcclusionProof occlusion={own.occlusion} surface={own.surface} />
        : options.view === "split"
          ? (
              <div className="flex items-start gap-2" data-panel="split">
                <BoardPanel label="Treatment A" panelId="panel-a" surface={composedA.surface} zoom="split" />
                <BoardPanel label="Treatment B" panelId="panel-b" surface={composedB.surface} zoom="split" />
              </div>
            )
          : (
              <BoardPanel
                label={active.name}
                panelId="panel-single"
                surface={own.surface}
                zoom={options.zoom}
              />
            );

  if (options.capture) {
    return <main className="inline-block bg-shell p-0">{body}</main>;
  }

  const dissolve = own.edgesTotal === 0 ? 0 : Math.round((own.edgesDissolving / own.edgesTotal) * 1000) / 10;
  const covers = new Set(Object.values(propSpecs).map((spec) => spec.cover)).size;

  return (
    <main className="hp-noise flex min-h-screen flex-col bg-shell">
      <header className="flex items-center justify-between border-b-2 border-line bg-panel px-5 py-3">
        <div className="flex items-baseline gap-4">
          <h1 className="font-display text-2xl leading-none font-extrabold tracking-[0.06em] text-ink uppercase">
            Environment
            <span className="text-accent"> register</span>
          </h1>
          <span className="font-data text-[10px] tracking-[0.1em] text-ink-dim uppercase">
            {`/// lane 5 · round 2 · ${String(roster.length)} units at ${String(FODDER_FIGURE)}px · ${String(covers)} cover classes`}
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
            {options.units ? ` Silhouette edges needing ink against this board: ${String(dissolve)}%.` : ""}
          </p>
        </div>
      </div>
    </main>
  );
}
