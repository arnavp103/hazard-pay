import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { StatusChip } from "@hazard-pay/ui";

import { ResolutionMapPrototype } from "../match-proto/resolution-map-prototype.tsx";
import { mountMatchStage, STAGE_HEIGHT, STAGE_WIDTH } from "../match-proto/stage.ts";

export const Route = createFileRoute("/match-proto")({
  component: MatchProtoScreen,
});

/**
 * Prototype (#27): hello-world match render — two pixel characters idling
 * on a PixiJS v8 canvas, mounted imperatively per the #26 research. No
 * match state, no transport; the point is the mount pattern and the
 * chrome frame (HUD-core, from the #13 prototype: canvas center, minimal
 * Direction B chrome docked at the edges).
 *
 * Remount check: navigate to the overworld (link in the header) and back —
 * each visit must land exactly one canvas and the idle loop must resume.
 * The stage handle also guards StrictMode's dev double-mount (see
 * ../match-proto/stage.ts); the automated lifecycle proof lives in
 * ../match-proto/stage.test.ts.
 */
const feedChip = {
  linking: { tone: "neutral", label: "linking…" },
  live: { tone: "acid", label: "render loop live" },
  failed: { tone: "warn", label: "renderer down" },
} as const;

function MatchProtoScreen() {
  if (isResolutionStudy()) { return <ResolutionMapPrototype />; }
  return <OriginalMatchPrototype />;
}

function OriginalMatchPrototype() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [feed, setFeed] = useState<keyof typeof feedChip>("linking");

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) { return; }
    const stage = mountMatchStage(host);
    // HUD reacting to renderer lifecycle across the handle boundary —
    // the same seam a real match view would use for "connecting…" chrome.
    void stage.ready.then(
      () => { setFeed("live"); },
      () => { setFeed("failed"); },
    );
    return () => { stage.destroy(); };
  }, []);

  return (
    <main className="hp-noise flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b-2 border-line bg-panel px-5 py-3">
        <div className="flex items-baseline gap-4">
          <h1 className="font-display text-2xl leading-none font-extrabold tracking-[0.06em] text-ink uppercase">
            Match
            <span className="text-accent"> feed</span>
          </h1>
          <span className="font-data text-[10px] tracking-[0.1em] text-ink-dim uppercase">
            /// proto rig · no transport
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
          style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT }}
        />
      </div>

      <footer className="flex items-center justify-between border-t-2 border-line bg-panel px-5 py-3">
        <div className="flex items-center gap-3 font-data text-[10px] uppercase">
          <StatusChip tone="acid">JAX-9</StatusChip>
          <span className="text-ink-dim">idle · lane courier</span>
        </div>
        <span className="font-data text-[10px] tracking-[0.1em] text-ink-dim uppercase">
          hello render — phase and moves land with the real match view
        </span>
        <div className="flex items-center gap-3 font-data text-[10px] uppercase">
          <span className="text-ink-dim">idle · pit enforcer</span>
          <StatusChip tone="magenta">NYX-4</StatusChip>
        </div>
      </footer>
    </main>
  );
}

function isResolutionStudy(): boolean {
  if (globalThis.location === undefined) { return false; }
  return new URLSearchParams(globalThis.location.search).get("study") === "resolution";
}
