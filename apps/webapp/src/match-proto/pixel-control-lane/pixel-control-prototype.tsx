/**
 * THROWAWAY PROTOTYPE (#74): pixel control lane of the art-modality
 * bake-off. One 48×64-at-1× field medic over the rasterized SVG
 * grime-market board, 2:1 dimetric projection, palette roles, light and
 * camera path carried from the #79 study.
 *
 * ROUND 2 (#74 refinement): the animation is now driven by the three
 * competing treatments in `./medic-rig.ts` (authored keys / programmatic /
 * hybrid) so the taste gate can pick a production approach; the combat
 * camera can be pulled back (`?zoom=wide`) so the unit sits smaller on the
 * map; and the medic art itself is the round-2 refine (shorter legs,
 * staggered stance, more detail, kit on every facing).
 *
 * Query params for deterministic capture:
 *   ?facing=front|side|back|left  ?anim=idle|attack|none
 *   ?treatment=authored|programmatic|hybrid
 *   ?zoom=combat|wide   ?motion=1   ?freeze=<ms>   ?capture=1
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { StatusChip } from "@hazard-pay/ui";

import {
  MEDIC_HEIGHT,
  MEDIC_WIDTH,
  medicFrameToRgba,
} from "./medic-48.ts";
import {
  type Facing,
  type RigFrame,
  getTreatment,
  subjectFor,
  treatments,
} from "./medic-rig.ts";
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

const CLOCK_STEP_MS = 40;
const TURN_CYCLE_MS = 4000;

/**
 * Combat-camera framings. `combat` is the round-1 zoom, `wide` the round-2
 * pulled-back tactical framing (unit sits smaller on the map), and `loupe`
 * an integer 2× inspection framing used only to judge the animation acting
 * up close on the board — crisp nearest-neighbour, not a proposed game zoom.
 */
const ZOOMS = {
  combat: { scale: 1, still: { x: -174, y: -46 }, label: "combat (round 1)" },
  wide: { scale: 0.72, still: { x: -150, y: -30 }, label: "wide tactical (round 2)" },
  loupe: { scale: 2, still: { x: -250, y: -96 }, label: "2× animation loupe" },
} as const;

export type ZoomKey = keyof typeof ZOOMS;

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

interface MedicCanvasProps {
  frame: RigFrame;
  mirrored: boolean;
  scale: number;
}

function MedicCanvas({ frame, mirrored, scale }: MedicCanvasProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (canvas === null) { return; }
    const context = canvas.getContext("2d");
    if (context === null) { return; }
    const rgba = medicFrameToRgba(frame.rows);
    context.clearRect(0, 0, MEDIC_WIDTH, MEDIC_HEIGHT);
    context.putImageData(new ImageData(new Uint8ClampedArray(rgba), MEDIC_WIDTH, MEDIC_HEIGHT), 0, 0);
  }, [frame.rows]);

  // Snap any render offset to whole device pixels — off-grid translation
  // would soften the nearest-neighbour sprite (deliberate-pixel-art axis).
  const shift = `translate(${String(Math.round(frame.dx) * scale)}px, ${String(Math.round(frame.dy) * scale)}px)`;
  return (
    <canvas
      ref={ref}
      aria-label="48 by 64 pixel field medic, rendered at 1x"
      height={MEDIC_HEIGHT}
      width={MEDIC_WIDTH}
      style={{
        height: MEDIC_HEIGHT * scale,
        imageRendering: "pixelated",
        transform: mirrored ? `${shift} scaleX(-1)` : shift,
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

function readTreatment(): string {
  const candidate = readParam("treatment");
  return treatments.some((treatment) => treatment.key === candidate) ? (candidate as string) : "hybrid";
}

function readZoom(): ZoomKey {
  const candidate = readParam("zoom");
  return candidate !== null && candidate in ZOOMS ? candidate as ZoomKey : "combat";
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

function writeUrl(facing: FacingKey, animation: AnimationKey, treatment: string, zoom: ZoomKey, motion: boolean): void {
  const url = new URL(globalThis.location.href);
  url.searchParams.set("facing", facing);
  url.searchParams.set("anim", animation);
  url.searchParams.set("treatment", treatment);
  url.searchParams.set("zoom", zoom);
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
  const [treatment, setTreatment] = useState<string>(readTreatment);
  const [zoom, setZoom] = useState<ZoomKey>(readZoom);
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
  const subject = subjectFor(clockMs, activeFacing as Facing, animation, treatment);
  const zoomSpec = ZOOMS[zoom];
  const camera = motion ? cameraAt(clockMs) : zoomSpec.still;

  const changeFacing = (next: FacingKey) => {
    writeUrl(next, animation, treatment, zoom, motion);
    setFacing(next);
  };
  const changeAnimation = (next: AnimationKey) => {
    writeUrl(facing, next, treatment, zoom, motion);
    setAnimation(next);
  };
  const changeTreatment = (next: string) => {
    writeUrl(facing, animation, next, zoom, motion);
    setTreatment(next);
  };
  const toggleZoom = () => {
    const next = zoom === "wide" ? "combat" : "wide";
    writeUrl(facing, animation, treatment, next, motion);
    setZoom(next);
  };
  const toggleMotion = () => {
    const next = !motion;
    writeUrl(facing, animation, treatment, zoom, next);
    setMotion(next);
  };

  const facingInfo = facings.find((item) => item.key === activeFacing) ?? facings[0];
  const animationInfo = animations.find((item) => item.key === animation) ?? animations[0];
  const treatmentInfo = getTreatment(treatment);

  return (
    <main className="hp-noise flex min-h-screen flex-col bg-shell">
      <header className="flex items-center justify-between border-b-2 border-line bg-panel px-5 py-3">
        <div className="flex items-baseline gap-4">
          <h1 className="font-display text-2xl leading-none font-extrabold tracking-[0.06em] text-ink uppercase">
            Pixel control
            <span className="text-accent"> lane</span>
          </h1>
          <span className="font-data text-[10px] tracking-[0.1em] text-ink-dim uppercase">
            /// modality bake-off · round 2 · throwaway prototype
          </span>
        </div>
        <div className="flex items-center gap-3">
          <StatusChip tone="warn" stamped>not production art</StatusChip>
          <StatusChip tone={motion ? "acid" : "neutral"}>{motion ? "turn + pan" : zoomSpec.label}</StatusChip>
        </div>
      </header>

      <div className="grid flex-1 place-items-center px-5 py-4">
        <div className="grid grid-cols-[480px_210px] gap-4">
          <section>
            <div className="mb-2 flex items-end justify-between font-data uppercase">
              <div>
                <div className="text-[9px] tracking-[0.15em] text-ink-dim">actual match scale</div>
                <div className="text-xs tracking-[0.08em] text-ink">{`480×270 aperture · ${zoomSpec.label}`}</div>
              </div>
              <span className="text-[9px] tracking-[0.12em] text-accent-2">2:1 board · 48×64 @ 1×</span>
            </div>
            <div
              className="relative h-[270px] w-[480px] overflow-hidden border-2 border-line bg-shell shadow-hard-lg"
              data-prototype-stage
            >
              <div
                className="absolute inset-0"
                style={{ transform: `scale(${String(zoomSpec.scale)})`, transformOrigin: "247px 205px" }}
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
                <div
                  className="absolute h-3 w-11 -translate-x-1/2 rounded-[50%] bg-shell/70"
                  style={{ left: 247, top: 207, transform: "translateX(-50%) skewX(-48deg)" }}
                />
                <div className="absolute" style={{ left: 223, top: 145 }}>
                  <MedicCanvas frame={subject.frame} mirrored={subject.mirrored} scale={1} />
                </div>
              </div>

              <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_58%,rgb(18_11_16_/_0.22)_58%)]" />

              <div className="absolute top-3 left-3 border border-line/80 bg-shell/90 px-2 py-1 font-data text-[8px] tracking-[0.12em] text-ink-dim uppercase">
                {motion ? "camera fixed · translation only" : zoomSpec.label}
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
                  <MedicCanvas frame={subject.frame} mirrored={subject.mirrored} scale={4} />
                </div>
              </div>
            </div>
            <div className="border-t-2 border-line px-3 py-2 font-data text-[9px] leading-relaxed text-ink-dim uppercase">
              <div>Treatment</div>
              <div className="text-ink">{treatmentInfo.name}</div>
              <div className="text-accent-2">{treatmentInfo.blurb}</div>
            </div>
          </aside>

          <section className="col-span-2 grid grid-cols-[1fr_210px] gap-4 border-2 border-line bg-panel px-4 py-3 shadow-hard">
            <div>
              <div className="font-display text-lg font-extrabold tracking-[0.05em] text-ink uppercase">
                {facingInfo.name}
                {" · "}
                {animationInfo.name}
                {" · "}
                {treatmentInfo.name}
              </div>
              <p className="mt-1 max-w-xl font-data text-[10px] leading-relaxed text-ink-dim uppercase">
                Round 2: the attack and idle act with the whole body — hip-pivoted weight
                shift, lunge step, chin tuck — under three competing animation treatments.
                Authored = stepped hand poses; programmatic = one sprite transformed with a
                smear + sub-pixel; hybrid = authored keys with programmatic in-betweens.
              </p>
            </div>
            <div className="border-l border-line pl-4 font-data text-[9px] leading-relaxed text-ink-dim uppercase">
              <div>Same map + palette roles + light</div>
              <div>Whole-body key poses · smears</div>
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
          treatment={treatment}
          zoom={zoom}
          onChangeAnimation={changeAnimation}
          onChangeFacing={changeFacing}
          onChangeTreatment={changeTreatment}
          onToggleMotion={toggleMotion}
          onToggleZoom={toggleZoom}
        />
      )}
    </main>
  );
}

interface PrototypeSwitcherProps {
  animation: AnimationKey;
  facing: FacingKey;
  motion: boolean;
  treatment: string;
  zoom: ZoomKey;
  onChangeAnimation: (animation: AnimationKey) => void;
  onChangeFacing: (facing: FacingKey) => void;
  onChangeTreatment: (treatment: string) => void;
  onToggleMotion: () => void;
  onToggleZoom: () => void;
}

function PrototypeSwitcher({
  animation,
  facing,
  motion,
  treatment,
  zoom,
  onChangeAnimation,
  onChangeFacing,
  onChangeTreatment,
  onToggleMotion,
  onToggleZoom,
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
      {treatments.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`border px-2 py-1 hover:bg-accent hover:text-ink ${treatment === item.key ? "border-accent-2 text-accent-2" : "border-shell/40"}`}
          onClick={() => { onChangeTreatment(item.key); }}
        >
          {item.key}
        </button>
      ))}
      <span className="mx-1 text-shell/50">|</span>
      <button
        type="button"
        className="border border-shell/40 px-2 py-1 hover:bg-accent-2 hover:text-ink"
        onClick={onToggleZoom}
      >
        {zoom === "wide" ? "wide" : "combat"}
      </button>
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
