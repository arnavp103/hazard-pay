/**
 * THROWAWAY PROTOTYPE (#82): the Blender-baked bake-off lane. A modular
 * low-poly field medic authored and rendered entirely by headless `bpy`,
 * quantized onto the Direction B palette, packed into one atlas, and played
 * back by PixiJS over the shared grime-market board.
 *
 * Nothing 3D reaches the browser: the runtime is two files, a PNG and a JSON.
 *
 * `?mode=idle|attack|turn` · `?facing=0..7` · `?zoom=` · `?capture=1` hides
 * dev chrome · `?freeze=<ms>` renders one deterministic frame ·
 * `?view=quant` swaps in the quantization comparison. Run at `/match-proto`.
 */

import { useEffect, useRef, useState } from "react";

import { StatusChip } from "@hazard-pay/ui";

import { FACINGS } from "./framing.ts";
import {
  type BakedStageHandle,
  COMPARISON_STRIPS,
  type Mode,
  mountBakedStage,
  STAGE_HEIGHT,
  STAGE_WIDTH,
  stripUrl,
} from "./scene.ts";

export const modes = [
  {
    key: "idle",
    name: "Idle loop",
    law: "8 baked frames at 8 fps. The whole loop is one second — a baked lane pays 8 cells per frame, so the breath, weight shift and held glance are authored INTO eight poses rather than sampled out of five seconds.",
  },
  {
    key: "attack",
    name: "Injector strike",
    law: "12 baked frames at 12 fps: coil, held anticipation, lunge, then a three-frame hit-stop on the squashed impact. The tip flash and the single-frame contact spark stay inside the 5% emission budget.",
  },
  {
    key: "turn",
    name: "Character turn",
    law: "Eight baked facings with an authored 6-frame pivot between them. The facing swaps at the pivot's apex — anticipation on the old facing, land and settle on the new — so a hard cut between two sprites reads as a hop.",
  },
] as const;

function params(): URLSearchParams {
  return new URLSearchParams(globalThis.location.search);
}

function isMode(candidate: string | null): candidate is Mode {
  return modes.some((entry) => entry.key === candidate);
}

function readMode(): Mode {
  const candidate = params().get("mode");
  return isMode(candidate) ? candidate : "idle";
}

function readFacing(): number {
  const parsed = Number(params().get("facing") ?? "0");
  return Number.isInteger(parsed) && parsed >= 0 && parsed < FACINGS ? parsed : 0;
}

function readZoom(): number {
  const raw = params().get("zoom");
  const parsed = raw === null ? 1 : Number(raw);
  return Number.isFinite(parsed) && parsed >= 0.5 && parsed <= 4 ? parsed : 1;
}

function readFreezeMs(): number | undefined {
  const raw = params().get("freeze");
  if (raw === null) { return undefined; }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readFlag(name: string): boolean {
  return params().get(name) === "1";
}

export function BlenderBakedPrototype() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<BakedStageHandle | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [facing, setFacing] = useState(0);
  const [failed, setFailed] = useState(false);
  const [comparison, setComparison] = useState(false);
  const modeInfo = modes.find((entry) => entry.key === mode) ?? modes[0];

  useEffect(() => {
    setMode(readMode());
    setFacing(readFacing());
    setComparison(params().get("view") === "quant");
    const host = hostRef.current;
    if (host === null) { return; }
    const handle = mountBakedStage(host, {
      facing: readFacing(),
      freezeMs: readFreezeMs(),
      mode: readMode(),
      zoom: readZoom(),
    });
    handleRef.current = handle;
    void handle.ready.catch(() => { setFailed(true); });
    return () => {
      handleRef.current = null;
      handle.destroy();
    };
  }, []);

  const changeMode = (next: Mode): void => {
    setMode(next);
    handleRef.current?.setMode(next);
  };

  const changeFacing = (next: number): void => {
    const wrapped = ((next % FACINGS) + FACINGS) % FACINGS;
    setFacing(wrapped);
    handleRef.current?.setFacing(wrapped);
  };

  // No `hp-noise` on this surface. The UI grain is a sub-pixel texture, and
  // over a 2x nearest-neighbour canvas it lands INSIDE the art pixel: it cost
  // the first pass its palette lock — 6,665 unique colours in a shipped still
  // whose atlas holds 26 — while being invisible as texture. Grit belongs in
  // the art, at the art's own pixel size.
  return (
    <main className="flex min-h-screen flex-col bg-shell">
      <header className="flex items-center justify-between border-b-2 border-line bg-panel px-5 py-3">
        <div className="flex items-baseline gap-4">
          <h1 className="font-display text-2xl leading-none font-extrabold tracking-[0.06em] text-ink uppercase">
            Baked lane
            <span className="text-accent"> bake-off</span>
          </h1>
          <span className="font-data text-[10px] tracking-[0.1em] text-ink-dim uppercase">
            /// throwaway prototype · blender low-poly → pixel sprites → pixi
          </span>
        </div>
        <div className="flex items-center gap-3">
          <StatusChip tone="warn" stamped>not production art</StatusChip>
          <StatusChip tone={failed ? "warn" : "acid"}>
            {failed ? "atlas missing — run pnpm bake" : "2D runtime · no 3D at runtime"}
          </StatusChip>
        </div>
      </header>

      <div className="grid flex-1 place-items-center px-5 py-4">
        <div className="flex flex-col gap-4" style={{ width: comparison ? 800 : STAGE_WIDTH }}>
          <section>
            <div className="mb-2 flex items-end justify-between font-data uppercase">
              <div>
                <div className="text-[9px] tracking-[0.15em] text-ink-dim">actual match scale</div>
                <div className="text-xs tracking-[0.08em] text-ink">480×270 · 240×135 art pixels at 2×</div>
              </div>
              <span className="text-[9px] tracking-[0.12em] text-accent-2">
                2:1 dimetric ortho · 31px baked rig
              </span>
            </div>
            <div
              className="relative overflow-hidden border-2 border-line bg-shell shadow-hard-lg"
              data-prototype-stage
              style={{ height: STAGE_HEIGHT, width: STAGE_WIDTH }}
            >
              {/* Pixi appends its canvas here; React never renders into this div. */}
              <div ref={hostRef} data-testid="baked-stage-host" className="absolute inset-0" />

              <div className="absolute top-3 left-3 border border-line/80 bg-shell/90 px-2 py-1 font-data text-[8px] tracking-[0.12em] text-ink-dim uppercase">
                baked atlas · 8 facings
              </div>
              <div className="absolute right-3 bottom-3 flex items-center gap-2 border border-line/80 bg-shell/90 px-2 py-1 font-data text-[8px] tracking-[0.1em] uppercase">
                <span className="text-ink-dim">Mara Voss</span>
                <span className="text-accent-2">field medic</span>
              </div>
            </div>
          </section>

          {comparison
            ? (
                <section data-quant-panel className="border-2 border-line bg-panel px-4 py-3 shadow-hard">
                  <div className="font-display text-lg font-extrabold tracking-[0.05em] text-ink uppercase">
                    Deliberate pixel art, or a shrunken 3D render?
                  </div>
                  <p className="mt-1 mb-3 font-data text-[10px] leading-relaxed text-ink-dim uppercase">
                    Same rig · same pose · same camera · three facings. Read top to bottom.
                  </p>
                  <div className="flex flex-col gap-3">
                    {COMPARISON_STRIPS.map((strip) => (
                      <div key={strip.key} className="flex items-center gap-4">
                        <div className="w-40 shrink-0 font-data text-[9px] leading-relaxed uppercase">
                          <div className="text-ink">{strip.label}</div>
                          <div className="text-ink-dim">{strip.note}</div>
                        </div>
                        <img
                          src={stripUrl(strip.key)}
                          alt={strip.label}
                          className="h-[168px] bg-panel-2"
                          style={{ imageRendering: "pixelated" }}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )
            : (
                <section className="grid grid-cols-[1fr_180px] gap-4 border-2 border-line bg-panel px-4 py-3 shadow-hard">
                  <div>
                    <div className="font-display text-lg font-extrabold tracking-[0.05em] text-ink uppercase">
                      {modeInfo.name}
                    </div>
                    <p className="mt-1 max-w-xl font-data text-[10px] leading-relaxed text-ink-dim uppercase">
                      {modeInfo.law}
                    </p>
                  </div>
                  <div className="border-l border-line pl-4 font-data text-[9px] leading-relaxed text-ink-dim uppercase">
                    <div>One atlas · one palette</div>
                    <div>Board quantized too</div>
                    <div className="text-ink">
                      Facing
                      {facing}
                      {" "}
                      of
                      {FACINGS}
                    </div>
                  </div>
                </section>
              )}
        </div>
      </div>

      <footer className="flex items-center justify-between border-t-2 border-line bg-panel px-5 py-3 font-data text-[9px] uppercase">
        <span className="text-ink-dim">gritty / dangerous / lived-in · avoid toy-like</span>
        <span className="tracking-[0.1em] text-ink">70 / 25 / 5 hierarchy · plum-black anchor</span>
        <span className="text-ink-dim">nearest-neighbour only · no runtime 3D, no shaders</span>
      </footer>

      {import.meta.env.DEV && !readFlag("capture") && (
        <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 border-2 border-line bg-ink px-3 py-2 font-data text-xs text-shell uppercase shadow-hard-lg">
          {modes.map((entry) => (
            <button
              key={entry.key}
              type="button"
              className={`border border-shell/40 px-3 py-1 hover:bg-accent hover:text-ink ${entry.key === mode ? "bg-accent-2 text-ink" : ""}`}
              onClick={() => { changeMode(entry.key); }}
            >
              {entry.key}
            </button>
          ))}
          <button
            type="button"
            className="ml-1 border border-shell/40 px-3 py-1 hover:bg-accent-2 hover:text-ink"
            onClick={() => { changeFacing(facing - 1); }}
          >
            ◀ facing
          </button>
          <button
            type="button"
            className="border border-shell/40 px-3 py-1 hover:bg-accent-2 hover:text-ink"
            onClick={() => { changeFacing(facing + 1); }}
          >
            facing ▶
          </button>
        </div>
      )}
    </main>
  );
}
