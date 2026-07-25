/**
 * THROWAWAY PROTOTYPE (#74, round 3) - the two-tier crowd stage.
 *
 * Renders the same order of battle at two candidate resolutions so the
 * open fork on #69 can be settled by looking rather than arguing:
 *
 *   ?config=small - fodder 22px tall, hero 28px (the Hero's Hour register
 *                   the cofounder asked for, with the *slight* hero boost)
 *   ?config=large - fodder 34px tall, hero 44px (the register this lane
 *                   has been drawing in)
 *
 * Both are authored at their own resolution and blitted at 1x. The whole
 * stage is composited in a single ImageData pass: the board is drawn, the
 * (tier-independent) contact shadows are laid down, then every unit's
 * posed grid is written pixel-for-pixel in painter's order. No CSS scaling
 * touches a sprite, so nothing here is a resample of anything else.
 *
 * Capture params: ?scene=crowd&config=small|large&freeze=<ms>&capture=1
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { StatusChip } from "@hazard-pay/ui";

import {
  type ConfigKey,
  CAMERA,
  CROWD_CYCLE_MS,
  STAGE_H,
  STAGE_W,
  blitOrigin,
  buildLineup,
  buildRoster,
  crowdConfigs,
  footprintWidth,
  poseUnit,
} from "./crowd-scene.ts";
import {
  crowdRowsToRgba,
  figureHeight,
  getGrid,
  teamPalettes,
} from "./crowd-sprites.ts";
import boardUrl from "../style-cohesion-assets/grime-market-board.prototype.png";

const CLOCK_STEP_MS = 40;

function readParam(name: string): string | null {
  if (globalThis.location === undefined) { return null; }
  return new URLSearchParams(globalThis.location.search).get(name);
}

function isLineup(): boolean {
  return readParam("lineup") === "1";
}

export function readCrowdConfig(): ConfigKey {
  return readParam("config") === "small" ? "small" : "large";
}

function readFreeze(): number | null {
  const raw = readParam("freeze");
  if (raw === null) { return null; }
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function isCaptureMode(): boolean {
  return readParam("capture") === "1";
}

/** Composite one frame of the crowd into the stage canvas. */
function paintStage(
  context: CanvasRenderingContext2D,
  board: HTMLImageElement | null,
  configKey: ConfigKey,
  clockMs: number,
  lineup: boolean,
): void {
  context.imageSmoothingEnabled = false;
  context.fillStyle = "#120b10";
  context.fillRect(0, 0, STAGE_W, STAGE_H);
  if (board !== null) {
    context.drawImage(board, CAMERA.x, CAMERA.y);
  }

  const config = crowdConfigs[configKey];
  const roster = lineup ? buildLineup(config) : buildRoster(config);

  // Contact shadows first, identical treatment for every unit regardless
  // of tier - grounding must not smuggle in the marking that was deferred.
  context.fillStyle = "rgb(18 11 16 / 0.42)";
  for (const unit of roster) {
    const grid = getGrid(unit.gridKey);
    const width = Math.max(6, footprintWidth(grid));
    context.beginPath();
    context.ellipse(unit.x, unit.y + 1, width / 2, Math.max(2, width / 6), 0, 0, Math.PI * 2);
    context.fill();
  }

  const frame = context.getImageData(0, 0, STAGE_W, STAGE_H);
  for (const unit of roster) {
    const grid = getGrid(unit.gridKey);
    const posed = poseUnit(unit, clockMs);
    const rgba = crowdRowsToRgba(posed.rows, grid.width, teamPalettes[unit.team]);
    const origin = blitOrigin(unit, grid, posed.bob);
    for (let y = 0; y < grid.height; y += 1) {
      for (let x = 0; x < grid.width; x += 1) {
        const at = (y * grid.width + x) * 4;
        if (rgba[at + 3] === 0) { continue; }
        const sx = unit.mirrored ? grid.width - 1 - x : x;
        const px = origin.x + sx;
        const py = origin.y + y;
        if (px < 0 || px >= STAGE_W || py < 0 || py >= STAGE_H) { continue; }
        const to = (py * STAGE_W + px) * 4;
        frame.data[to] = rgba[at] ?? 0;
        frame.data[to + 1] = rgba[at + 1] ?? 0;
        frame.data[to + 2] = rgba[at + 2] ?? 0;
        frame.data[to + 3] = 255;
      }
    }
  }
  context.putImageData(frame, 0, 0);
}

export function CrowdPrototype() {
  const [configKey, setConfigKey] = useState<ConfigKey>(readCrowdConfig);
  const freeze = useMemo(readFreeze, []);
  const [clockMs, setClockMs] = useState(freeze ?? 0);
  const [board, setBoard] = useState<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const image = new Image();
    image.src = boardUrl;
    image.onload = () => { setBoard(image); };
  }, []);

  useEffect(() => {
    if (freeze !== null) { return; }
    const timer = setInterval(() => {
      setClockMs((previous) => (previous + CLOCK_STEP_MS) % (CROWD_CYCLE_MS * 4));
    }, CLOCK_STEP_MS);
    return () => { clearInterval(timer); };
  }, [freeze]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) { return; }
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context === null) { return; }
    paintStage(context, board, configKey, clockMs, isLineup());
  }, [board, configKey, clockMs]);

  const config = crowdConfigs[configKey];
  const heroFigure = figureHeight(getGrid(config.hero));
  const meleeFigure = figureHeight(getGrid(config.melee));
  const roster = useMemo(() => buildRoster(config), [config]);
  const fodderCount = roster.filter((unit) => unit.tier === "fodder").length;
  const heroCount = roster.length - fodderCount;

  const switchConfig = (next: ConfigKey) => {
    const url = new URL(globalThis.location.href);
    url.searchParams.set("scene", "crowd");
    url.searchParams.set("config", next);
    globalThis.history.replaceState(null, "", url);
    setConfigKey(next);
  };

  return (
    <main className="hp-noise flex min-h-screen flex-col bg-shell">
      <header className="flex items-center justify-between border-b-2 border-line bg-panel px-5 py-3">
        <div className="flex items-baseline gap-4">
          <h1 className="font-display text-2xl leading-none font-extrabold tracking-[0.06em] text-ink uppercase">
            Two-tier
            <span className="text-accent"> crowd</span>
          </h1>
          <span className="font-data text-[10px] tracking-[0.1em] text-ink-dim uppercase">
            /// pixel control lane · round 3 · resolution fork
          </span>
        </div>
        <div className="flex items-center gap-3">
          <StatusChip tone="warn" stamped>not production art</StatusChip>
          <StatusChip tone="acid">{`config ${configKey}`}</StatusChip>
        </div>
      </header>

      <div className="grid flex-1 place-items-center px-5 py-4">
        <div className="grid grid-cols-[480px] gap-3">
          <section>
            <div className="mb-2 flex items-end justify-between font-data uppercase">
              <div>
                <div className="text-[9px] tracking-[0.15em] text-ink-dim">actual match scale · 1×</div>
                <div className="text-xs tracking-[0.08em] text-ink">{config.label}</div>
              </div>
              <span className="text-[9px] tracking-[0.12em] text-accent-2">
                {`${String(fodderCount)} fodder · ${String(heroCount)} heroes`}
              </span>
            </div>
            <canvas
              ref={canvasRef}
              aria-label={`Two-tier crowd at config ${configKey}`}
              data-crowd-stage
              height={STAGE_H}
              width={STAGE_W}
              className="block border-2 border-line shadow-hard-lg"
              style={{ height: STAGE_H, imageRendering: "pixelated", width: STAGE_W }}
            />
          </section>

          <section className="border-2 border-line bg-panel px-4 py-3 font-data text-[10px] leading-relaxed text-ink-dim uppercase shadow-hard">
            <div className="text-ink">
              {`fodder ${String(meleeFigure)}px · hero ${String(heroFigure)}px · boost ${(heroFigure / meleeFigure).toFixed(2)}×`}
            </div>
            <div>
              Tier separation is size + detail density only — no rim light, no banner,
              no ground decal, no hero-only hue. Both sides share one palette except
              three livery entries.
            </div>
          </section>
        </div>
      </div>

      <footer className="flex items-center justify-between border-t-2 border-line bg-panel px-5 py-3 font-data text-[9px] uppercase">
        <span className="text-ink-dim">crowd fodder vs hero units · #69 two-tier ruling</span>
        <span className="tracking-[0.1em] text-ink">70 / 25 / 5 hierarchy · plum-black anchor</span>
        <span className="text-ink-dim">authored at 1× · no fractional scaling</span>
      </footer>

      {import.meta.env.DEV && !isCaptureMode() && (
        <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 border-2 border-line bg-ink px-3 py-2 font-data text-xs text-shell uppercase shadow-hard-lg">
          {(["small", "large"] as const).map((key) => (
            <button
              key={key}
              type="button"
              className={`border px-2 py-1 hover:bg-accent hover:text-ink ${configKey === key ? "border-accent-2 text-accent-2" : "border-shell/40"}`}
              onClick={() => { switchConfig(key); }}
            >
              {key}
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
