/**
 * THROWAWAY PROTOTYPE (#74): pixel control lane of the art-modality
 * bake-off. One 48×64-at-1× field medic (fine-pixel re-author of the
 * #79 subject) over the same rasterized SVG grime-market board, same
 * 2:1 dimetric projection, palette roles, light direction, and camera
 * path as the four-treatment study. Facings, idle, and attack are
 * driven by a stepped JS clock so `?freeze=<ms>` can pin any instant
 * for deterministic GIF capture. Query params: `?facing=front|side|
 * back|left`, `?anim=idle|attack|none`, `?motion=1`, `?capture=1`.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { StatusChip } from "@hazard-pay/ui";

import {
  MEDIC_HEIGHT,
  MEDIC_WIDTH,
  medicBack,
  medicFrameToRgba,
  medicFront,
  medicSide,
  medicSideAttack,
  medicSideIdle,
} from "./medic-48.ts";
import boardUrl from "../style-cohesion-assets/grime-market-board.prototype.png";

export const facings = [
  { key: "side", name: "Side (authored)" },
  { key: "front", name: "Front (authored)" },
  { key: "back", name: "Back (authored)" },
  { key: "left", name: "Left (mirrored side)" },
] as const;

export type FacingKey = (typeof facings)[number]["key"];

export const animations = [
  { key: "idle", name: "Idle loop" },
  { key: "attack", name: "Injector jab" },
  { key: "none", name: "Held still" },
] as const;

export type AnimationKey = (typeof animations)[number]["key"];

const CLOCK_STEP_MS = 125;
const TURN_CYCLE_MS = 4000;
const IDLE_DURATIONS = [400, 240, 240, 240];
const ATTACK_DURATIONS = [260, 180, 70, 100, 160, 240];

/** Camera pan waypoints carried over from the #79 harness. */
const PAN_WAYPOINTS: { at: number; x: number; y: number }[] = [
  { at: 0, x: -56, y: -20 },
  { at: 0.08, x: -56, y: -20 },
  { at: 0.48, x: -196, y: -52 },
  { at: 0.58, x: -196, y: -52 },
  { at: 0.92, x: -292, y: -76 },
  { at: 1, x: -292, y: -76 },
];

function cameraAt(clockMs: number): { x: number; y: number } {
  const phase = (clockMs % TURN_CYCLE_MS) / TURN_CYCLE_MS;
  for (let index = 1; index < PAN_WAYPOINTS.length; index += 1) {
    const from = PAN_WAYPOINTS[index - 1];
    const to = PAN_WAYPOINTS[index];
    if (from === undefined || to === undefined || phase > to.at) { continue; }
    const span = to.at - from.at;
    const local = span === 0 ? 0 : (phase - from.at) / span;
    return {
      x: Math.round(from.x + (to.x - from.x) * local),
      y: Math.round(from.y + (to.y - from.y) * local),
    };
  }
  return { x: -292, y: -76 };
}

const TURN_ORDER: FacingKey[] = ["front", "side", "back", "left"];

function facingAt(clockMs: number): FacingKey {
  const slot = Math.floor((clockMs % TURN_CYCLE_MS) / (TURN_CYCLE_MS / TURN_ORDER.length));
  return TURN_ORDER[slot] ?? "side";
}

function frameAt(clockMs: number, durations: number[]): number {
  const total = durations.reduce((sum, ms) => sum + ms, 0);
  let local = clockMs % total;
  for (let index = 0; index < durations.length; index += 1) {
    const duration = durations[index] ?? 0;
    if (local < duration) { return index; }
    local -= duration;
  }
  return 0;
}

interface SubjectState {
  mirrored: boolean;
  rows: string[];
}

function subjectAt(clockMs: number, facing: FacingKey, animation: AnimationKey): SubjectState {
  const mirrored = facing === "left";
  if (facing === "front") { return { mirrored, rows: medicFront }; }
  if (facing === "back") { return { mirrored, rows: medicBack }; }
  if (animation === "attack") {
    const frame = medicSideAttack[frameAt(clockMs, ATTACK_DURATIONS)];
    return { mirrored, rows: frame ?? medicSide };
  }
  if (animation === "idle") {
    const frame = medicSideIdle[frameAt(clockMs, IDLE_DURATIONS)];
    return { mirrored, rows: frame ?? medicSide };
  }
  return { mirrored, rows: medicSide };
}

interface MedicCanvasProps {
  mirrored: boolean;
  rows: string[];
  scale: number;
}

function MedicCanvas({ mirrored, rows, scale }: MedicCanvasProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (canvas === null) { return; }
    const context = canvas.getContext("2d");
    if (context === null) { return; }
    const rgba = medicFrameToRgba(rows);
    context.putImageData(new ImageData(new Uint8ClampedArray(rgba), MEDIC_WIDTH, MEDIC_HEIGHT), 0, 0);
  }, [rows]);

  return (
    <canvas
      ref={ref}
      aria-label="48 by 64 pixel field medic, rendered at 1x"
      height={MEDIC_HEIGHT}
      width={MEDIC_WIDTH}
      style={{
        height: MEDIC_HEIGHT * scale,
        imageRendering: "pixelated",
        transform: mirrored ? "scaleX(-1)" : undefined,
        width: MEDIC_WIDTH * scale,
      }}
    />
  );
}

function readParam(name: string): string | null {
  if (globalThis.location === undefined) { return null; }
  return new URLSearchParams(globalThis.location.search).get(name);
}

function readFacing(): FacingKey {
  const candidate = readParam("facing");
  return facings.some((facing) => facing.key === candidate) ? candidate as FacingKey : "side";
}

function readAnimation(): AnimationKey {
  const candidate = readParam("anim");
  return animations.some((animation) => animation.key === candidate) ? candidate as AnimationKey : "idle";
}

function readMotion(): boolean {
  return readParam("motion") === "1";
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

function writeUrl(facing: FacingKey, animation: AnimationKey, motion: boolean): void {
  const url = new URL(globalThis.location.href);
  url.searchParams.set("facing", facing);
  url.searchParams.set("anim", animation);
  if (motion) {
    url.searchParams.set("motion", "1");
  } else {
    url.searchParams.delete("motion");
  }
  globalThis.history.replaceState(null, "", url);
}

export function PixelControlPrototype() {
  const [facing, setFacing] = useState<FacingKey>(readFacing);
  const [animation, setAnimation] = useState<AnimationKey>(readAnimation);
  const [motion, setMotion] = useState(readMotion);
  const freeze = useMemo(readFreeze, []);
  const [clockMs, setClockMs] = useState(freeze ?? 0);

  useEffect(() => {
    if (freeze !== null) { return; }
    const timer = setInterval(() => {
      setClockMs((previous) => previous + CLOCK_STEP_MS);
    }, CLOCK_STEP_MS);
    return () => { clearInterval(timer); };
  }, [freeze]);

  const activeFacing = motion ? facingAt(clockMs) : facing;
  const subject = subjectAt(clockMs, activeFacing, animation);
  const camera = motion ? cameraAt(clockMs) : { x: -174, y: -46 };

  const changeFacing = (next: FacingKey) => {
    writeUrl(next, animation, motion);
    setFacing(next);
  };
  const changeAnimation = (next: AnimationKey) => {
    writeUrl(facing, next, motion);
    setAnimation(next);
  };
  const toggleMotion = () => {
    const next = !motion;
    writeUrl(facing, animation, next);
    setMotion(next);
  };

  const facingInfo = facings.find((item) => item.key === activeFacing) ?? facings[0];
  const animationInfo = animations.find((item) => item.key === animation) ?? animations[0];

  return (
    <main className="hp-noise flex min-h-screen flex-col bg-shell">
      <header className="flex items-center justify-between border-b-2 border-line bg-panel px-5 py-3">
        <div className="flex items-baseline gap-4">
          <h1 className="font-display text-2xl leading-none font-extrabold tracking-[0.06em] text-ink uppercase">
            Pixel control
            <span className="text-accent"> lane</span>
          </h1>
          <span className="font-data text-[10px] tracking-[0.1em] text-ink-dim uppercase">
            /// modality bake-off · throwaway prototype
          </span>
        </div>
        <div className="flex items-center gap-3">
          <StatusChip tone="warn" stamped>not production art</StatusChip>
          <StatusChip tone={motion ? "acid" : "neutral"}>{motion ? "turn + pan" : "controlled still"}</StatusChip>
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
              <span className="text-[9px] tracking-[0.12em] text-accent-2">2:1 board · 48×64 @ 1×</span>
            </div>
            <div
              className="relative h-[270px] w-[480px] overflow-hidden border-2 border-line bg-shell shadow-hard-lg"
              data-prototype-stage
            >
              <div
                className="absolute h-[360px] w-[840px]"
                style={{ transform: `translate3d(${String(camera.x)}px, ${String(camera.y)}px, 0)` }}
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
              <div className="absolute" style={{ left: 223, top: 145 }}>
                <MedicCanvas mirrored={subject.mirrored} rows={subject.rows} scale={1} />
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
              <div className="text-xs tracking-[0.08em] text-ink">authored cells at 4×</div>
            </div>
            <div className="grid flex-1 place-items-center bg-panel-2 py-2">
              <div className="relative">
                <div
                  className="absolute bottom-1 left-1/2 h-3 w-24 rounded-[50%] bg-shell/70"
                  style={{ transform: "translateX(-50%) skewX(-48deg)" }}
                />
                <div className="relative">
                  <MedicCanvas mirrored={subject.mirrored} rows={subject.rows} scale={4} />
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
                {facingInfo.name}
                {" "}
                ·
                {" "}
                {animationInfo.name}
              </div>
              <p className="mt-1 max-w-xl font-data text-[10px] leading-relaxed text-ink-dim uppercase">
                48×64 authored pixels at 1×: A-synthesis silhouette ink and material
                clusters, sparse third band on metal and emission, wear only where
                history earns it. Mirrored left facing swaps the pack and injector side.
              </p>
            </div>
            <div className="border-l border-line pl-4 font-data text-[9px] leading-relaxed text-ink-dim uppercase">
              <div>Same map + palette roles + light</div>
              <div>Idle 4f · attack 6f · stepped</div>
              <div className="text-ink">Judge at 1× first</div>
            </div>
          </section>
        </div>
      </div>

      <footer className="flex items-center justify-between border-t-2 border-line bg-panel px-5 py-3 font-data text-[9px] uppercase">
        <span className="text-ink-dim">gritty / dangerous / lived-in · avoid toy-like</span>
        <span className="tracking-[0.1em] text-ink">70 / 25 / 5 hierarchy · plum-black anchor</span>
        <span className="text-ink-dim">quasimorph density register · fine-pixel @ 1×</span>
      </footer>

      {import.meta.env.DEV && !isCaptureMode() && (
        <PrototypeSwitcher
          animation={animation}
          facing={facing}
          motion={motion}
          onChangeAnimation={changeAnimation}
          onChangeFacing={changeFacing}
          onToggleMotion={toggleMotion}
        />
      )}
    </main>
  );
}

interface PrototypeSwitcherProps {
  animation: AnimationKey;
  facing: FacingKey;
  motion: boolean;
  onChangeAnimation: (animation: AnimationKey) => void;
  onChangeFacing: (facing: FacingKey) => void;
  onToggleMotion: () => void;
}

function PrototypeSwitcher({
  animation,
  facing,
  motion,
  onChangeAnimation,
  onChangeFacing,
  onToggleMotion,
}: PrototypeSwitcherProps) {
  return (
    <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 border-2 border-line bg-ink px-3 py-2 font-data text-xs text-shell uppercase shadow-hard-lg">
      {facings.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`border px-2 py-1 hover:bg-accent hover:text-ink ${facing === item.key ? "border-accent-2 text-accent-2" : "border-shell/40"}`}
          onClick={() => { onChangeFacing(item.key); }}
        >
          {item.key}
        </button>
      ))}
      <span className="mx-1 text-shell/50">|</span>
      {animations.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`border px-2 py-1 hover:bg-accent-2 hover:text-ink ${animation === item.key ? "border-accent-2 text-accent-2" : "border-shell/40"}`}
          onClick={() => { onChangeAnimation(item.key); }}
        >
          {item.key}
        </button>
      ))}
      <span className="mx-1 text-shell/50">|</span>
      <button
        type="button"
        className="border border-shell/40 px-2 py-1 hover:bg-accent-2 hover:text-ink"
        onClick={onToggleMotion}
      >
        {motion ? "still" : "motion"}
      </button>
    </div>
  );
}
