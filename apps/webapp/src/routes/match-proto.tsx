import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { StatusChip } from "@hazard-pay/ui";

import {
  artistLoopVariants,
  ARTIST_LOOP_STAGE_HEIGHT,
  ARTIST_LOOP_STAGE_WIDTH,
  type ArtistLoopVariantKey,
  mountArtistLoopStage,
} from "../match-proto/artist-loop-prototype.ts";

export const Route = createFileRoute("/match-proto")({
  component: MatchProtoScreen,
});

/**
 * THROWAWAY PROTOTYPE (#67): five planted art-direction variants,
 * switchable via `?variant=`, on the existing `/match-proto` route.
 * The gallery tests whether a provenance-blind critic can separate the
 * Direction B controls from subtle palette, contour, and world-language
 * faults. The production match prototype remains in git history at #27.
 */
const feedChip = {
  linking: { tone: "neutral", label: "linking…" },
  live: { tone: "acid", label: "render loop live" },
  failed: { tone: "warn", label: "renderer down" },
} as const;

function MatchProtoScreen() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [feed, setFeed] = useState<keyof typeof feedChip>("linking");
  const [variant, setVariant] = useState<ArtistLoopVariantKey>(readVariant);

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) { return; }
    setFeed("linking");
    const stage = mountArtistLoopStage(host, variant);
    void stage.ready.then(
      () => { setFeed("live"); },
      () => { setFeed("failed"); },
    );
    return () => { stage.destroy(); };
  }, [variant]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") { return; }
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) { return; }
      cycleVariant(variant, event.key === "ArrowLeft" ? -1 : 1, setVariant);
    };
    globalThis.addEventListener("keydown", onKeyDown);
    return () => { globalThis.removeEventListener("keydown", onKeyDown); };
  }, [variant]);

  const variantName = artistLoopVariants.find((item) => item.key === variant)?.name ?? variant;

  return (
    <main className="hp-noise flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b-2 border-line bg-panel px-5 py-3">
        <div className="flex items-baseline gap-4">
          <h1 className="font-display text-2xl leading-none font-extrabold tracking-[0.06em] text-ink uppercase">
            Match
            <span className="text-accent"> feed</span>
          </h1>
          <span className="font-data text-[10px] tracking-[0.1em] text-ink-dim uppercase">
            /// cold-critic rig · variant
            {" "}
            {variant}
          </span>
        </div>
        <div className="flex items-center gap-4 font-data text-[10px] uppercase">
          <StatusChip tone={feedChip[feed].tone} stamped={feed === "live"}>
            {feedChip[feed].label}
          </StatusChip>
          <Link
            to="/"
            className="border border-line px-2 py-1 text-ink-dim hover:bg-panel-2 hover:text-ink"
          >
            back to overworld
          </Link>
        </div>
      </header>

      <div className="grid flex-1 place-items-center p-8">
        {/* Pixi appends its canvas here; React never renders into this div. */}
        <div
          ref={hostRef}
          data-testid="match-stage-host"
          className="border-2 border-line bg-shell shadow-hard-lg"
          style={{ width: ARTIST_LOOP_STAGE_WIDTH, height: ARTIST_LOOP_STAGE_HEIGHT }}
        />
      </div>

      <footer className="flex items-center justify-between border-t-2 border-line bg-panel px-5 py-3">
        <div className="flex items-center gap-3 font-data text-[10px] uppercase">
          <StatusChip tone="acid">JAX-9</StatusChip>
          <span className="text-ink-dim">{variantName}</span>
        </div>
        <span className="font-data text-[10px] tracking-[0.1em] text-ink-dim uppercase">
          planted direction study · screenshot at match scale
        </span>
        <div className="flex items-center gap-3 font-data text-[10px] uppercase">
          <span className="text-ink-dim">idle · pit enforcer</span>
          <StatusChip tone="magenta">NYX-4</StatusChip>
        </div>
      </footer>

      {import.meta.env.DEV && !isCaptureMode() && (
        <PrototypeSwitcher current={variant} onChange={setVariant} />
      )}
    </main>
  );
}

function isArtistLoopVariantKey(value: string | null): value is ArtistLoopVariantKey {
  return artistLoopVariants.some((variant) => variant.key === value);
}

function readVariant(): ArtistLoopVariantKey {
  if (globalThis.location === undefined) { return "A"; }
  const candidate = new URLSearchParams(globalThis.location.search).get("variant");
  return isArtistLoopVariantKey(candidate) ? candidate : "A";
}

function isCaptureMode(): boolean {
  if (globalThis.location === undefined) { return false; }
  return new URLSearchParams(globalThis.location.search).get("capture") === "1";
}

function cycleVariant(
  current: ArtistLoopVariantKey,
  delta: -1 | 1,
  onChange: (variant: ArtistLoopVariantKey) => void,
): void {
  const index = artistLoopVariants.findIndex((variant) => variant.key === current);
  const nextIndex = (index + delta + artistLoopVariants.length) % artistLoopVariants.length;
  const next = artistLoopVariants[nextIndex];
  if (next === undefined) { return; }
  const url = new URL(globalThis.location.href);
  url.searchParams.set("variant", next.key);
  globalThis.history.replaceState(null, "", url);
  onChange(next.key);
}

interface PrototypeSwitcherProps {
  current: ArtistLoopVariantKey;
  onChange: (variant: ArtistLoopVariantKey) => void;
}

function PrototypeSwitcher({ current, onChange }: PrototypeSwitcherProps) {
  const label = artistLoopVariants.find((variant) => variant.key === current)?.name ?? current;
  return (
    <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 border-2 border-line bg-ink px-3 py-2 font-data text-xs text-shell uppercase shadow-hard-lg">
      <button
        type="button"
        aria-label="Previous prototype variant"
        className="border border-shell/40 px-3 py-1 hover:bg-accent hover:text-ink"
        onClick={() => { cycleVariant(current, -1, onChange); }}
      >
        ←
      </button>
      <span className="min-w-40 text-center">
        {current}
        {" "}
        —
        {" "}
        {label}
      </span>
      <button
        type="button"
        aria-label="Next prototype variant"
        className="border border-shell/40 px-3 py-1 hover:bg-accent-2 hover:text-ink"
        onClick={() => { cycleVariant(current, 1, onChange); }}
      >
        →
      </button>
    </div>
  );
}
