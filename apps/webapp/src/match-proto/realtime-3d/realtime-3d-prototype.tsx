/**
 * THROWAWAY PROTOTYPE (#81): real-time cel-shaded low-poly 3D bake-off
 * lane. One Three.js scene recreates the #79 grime-market board and one
 * modular field medic under a fixed-angle 2:1 dimetric orthographic
 * camera. Switch animation with `?anim=idle|attack|turn`; `?motion=1`
 * runs the stepped camera pan + character turn; `?capture=1` hides dev
 * chrome; `?freeze=<ms>` renders one deterministic frame for capture.
 * Run at `/match-proto`.
 */

import { useEffect, useRef, useState } from "react";

import { StatusChip } from "@hazard-pay/ui";

import {
  LOUPE_HEIGHT,
  LOUPE_WIDTH,
  type MedicAnim,
  mountRealtime3d,
  type Realtime3dHandle,
  STAGE_HEIGHT,
  STAGE_WIDTH,
} from "./scene3d.ts";

export const animations = [
  {
    key: "idle",
    name: "Idle loop",
    law: "Breath, weight shift, and a held look-around beat sampled at 8 held poses/sec — stepped, not eased.",
  },
  {
    key: "attack",
    name: "Injector strike",
    law: "Coil, held anticipation, one-step lunge, squashed impact hold at 12 poses/sec; tip flash stays inside the 5% budget.",
  },
  {
    key: "turn",
    name: "Character turn",
    law: "Eight facings snapped at 45° with a two-sample step into each — the rig turns; no mirrored sprites, the renderer owns every facing.",
  },
] as const;

function isAnim(candidate: string | null): candidate is MedicAnim {
  return animations.some((animation) => animation.key === candidate);
}

function readAnim(): MedicAnim {
  if (globalThis.location === undefined) { return "idle"; }
  const candidate = new URLSearchParams(globalThis.location.search).get("anim");
  return isAnim(candidate) ? candidate : "idle";
}

function readMotion(): boolean {
  if (globalThis.location === undefined) { return false; }
  return new URLSearchParams(globalThis.location.search).get("motion") === "1";
}

function isCaptureMode(): boolean {
  if (globalThis.location === undefined) { return false; }
  return new URLSearchParams(globalThis.location.search).get("capture") === "1";
}

function readFreezeMs(): number | undefined {
  if (globalThis.location === undefined) { return undefined; }
  const raw = new URLSearchParams(globalThis.location.search).get("freeze");
  if (raw === null) { return undefined; }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readZoom(): number {
  if (globalThis.location === undefined) { return 1; }
  const raw = new URLSearchParams(globalThis.location.search).get("zoom");
  const parsed = raw === null ? 1 : Number(raw);
  return Number.isFinite(parsed) && parsed >= 0.5 && parsed <= 4 ? parsed : 1;
}

function writeUrl(anim: MedicAnim, motion: boolean): void {
  const url = new URL(globalThis.location.href);
  url.searchParams.set("anim", anim);
  if (motion) {
    url.searchParams.set("motion", "1");
  } else {
    url.searchParams.delete("motion");
  }
  globalThis.history.replaceState(null, "", url);
}

export function Realtime3dPrototype() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const loupeRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<Realtime3dHandle | null>(null);
  const [anim, setAnim] = useState<MedicAnim>(readAnim);
  const [motion, setMotion] = useState(readMotion);
  const animInfo = animations.find((item) => item.key === anim) ?? animations[0];

  useEffect(() => {
    const stage = stageRef.current;
    if (stage === null) { return; }
    const handle = mountRealtime3d(stage, loupeRef.current, {
      anim: readAnim(),
      freezeMs: readFreezeMs(),
      motion: readMotion(),
      zoom: readZoom(),
    });
    handleRef.current = handle;
    return () => {
      handleRef.current = null;
      handle.destroy();
    };
  }, []);

  const changeAnim = (next: MedicAnim): void => {
    writeUrl(next, motion);
    setAnim(next);
    handleRef.current?.setAnim(next);
  };

  const toggleMotion = (): void => {
    const next = !motion;
    writeUrl(anim, next);
    setMotion(next);
    handleRef.current?.setMotion(next);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") { return; }
      const target = event.target;
      if (
        target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || (target instanceof HTMLElement && target.isContentEditable)
      ) { return; }
      const currentIndex = animations.findIndex((item) => item.key === anim);
      const delta = event.key === "ArrowLeft" ? -1 : 1;
      const nextIndex = (currentIndex + delta + animations.length) % animations.length;
      const next = animations[nextIndex];
      if (next !== undefined) { changeAnim(next.key); }
    };
    globalThis.addEventListener("keydown", onKeyDown);
    return () => { globalThis.removeEventListener("keydown", onKeyDown); };
  });

  return (
    <main className="hp-noise flex min-h-screen flex-col bg-shell">
      <header className="flex items-center justify-between border-b-2 border-line bg-panel px-5 py-3">
        <div className="flex items-baseline gap-4">
          <h1 className="font-display text-2xl leading-none font-extrabold tracking-[0.06em] text-ink uppercase">
            3D lane
            <span className="text-accent"> bake-off</span>
          </h1>
          <span className="font-data text-[10px] tracking-[0.1em] text-ink-dim uppercase">
            /// throwaway prototype · real-time cel-shaded low-poly
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
              <span className="text-[9px] tracking-[0.12em] text-accent-2">2:1 dimetric ortho · ~64px rig</span>
            </div>
            <div
              className="relative overflow-hidden border-2 border-line bg-shell shadow-hard-lg"
              data-prototype-stage
              style={{ height: STAGE_HEIGHT, width: STAGE_WIDTH }}
            >
              {/* Three.js appends its canvas here; React never renders into this div. */}
              <div ref={stageRef} className="absolute inset-0" />

              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_58%,rgb(18_11_16_/_0.22)_58%)]" />
              <div className="absolute top-3 left-3 border border-line/80 bg-shell/90 px-2 py-1 font-data text-[8px] tracking-[0.12em] text-ink-dim uppercase">
                camera ortho · translation only
              </div>
              <div className="absolute right-3 bottom-3 flex items-center gap-2 border border-line/80 bg-shell/90 px-2 py-1 font-data text-[8px] tracking-[0.1em] uppercase">
                <span className="text-ink-dim">Mara Voss</span>
                <span className="text-accent-2">field medic</span>
              </div>
            </div>
          </section>

          <aside className="flex flex-col border-2 border-line bg-panel shadow-hard-lg">
            <div className="border-b-2 border-line px-3 py-2 font-data uppercase">
              <div className="text-[9px] tracking-[0.14em] text-ink-dim">rig inspection only</div>
              <div className="text-xs tracking-[0.08em] text-ink">same rig at 3×</div>
            </div>
            <div className="grid flex-1 place-items-center bg-panel-2 py-2">
              <div ref={loupeRef} style={{ height: LOUPE_HEIGHT, width: LOUPE_WIDTH }} />
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
                {animInfo.name}
              </div>
              <p className="mt-1 max-w-xl font-data text-[10px] leading-relaxed text-ink-dim uppercase">
                {animInfo.law}
              </p>
            </div>
            <div className="border-l border-line pl-4 font-data text-[9px] leading-relaxed text-ink-dim uppercase">
              <div>Same board + subject + light</div>
              <div>Renderer owns every facing</div>
              <div className="text-ink">Judge at combat zoom first</div>
            </div>
          </section>
        </div>
      </div>

      <footer className="flex items-center justify-between border-t-2 border-line bg-panel px-5 py-3 font-data text-[9px] uppercase">
        <span className="text-ink-dim">gritty / dangerous / lived-in · avoid toy-like</span>
        <span className="tracking-[0.1em] text-ink">70 / 25 / 5 hierarchy · plum-black anchor</span>
        <span className="text-ink-dim">MSAA only · no TAA · stepped poses on twos/threes</span>
      </footer>

      {import.meta.env.DEV && !isCaptureMode() && (
        <AnimSwitcher
          current={anim}
          motion={motion}
          onChange={changeAnim}
          onToggleMotion={toggleMotion}
        />
      )}
    </main>
  );
}

interface AnimSwitcherProps {
  current: MedicAnim;
  motion: boolean;
  onChange: (anim: MedicAnim) => void;
  onToggleMotion: () => void;
}

function AnimSwitcher({ current, motion, onChange, onToggleMotion }: AnimSwitcherProps) {
  return (
    <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 border-2 border-line bg-ink px-3 py-2 font-data text-xs text-shell uppercase shadow-hard-lg">
      {animations.map((animation) => (
        <button
          key={animation.key}
          type="button"
          className={`border border-shell/40 px-3 py-1 hover:bg-accent hover:text-ink ${animation.key === current ? "bg-accent-2 text-ink" : ""}`}
          onClick={() => { onChange(animation.key); }}
        >
          {animation.key}
        </button>
      ))}
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
