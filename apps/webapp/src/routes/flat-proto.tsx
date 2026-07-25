import { createFileRoute, Link } from "@tanstack/react-router";

import { StatusChip } from "@hazard-pay/ui";

import { FlatProceduralPrototype } from "../match-proto/flat-procedural/flat-procedural-prototype.tsx";

export const Route = createFileRoute("/flat-proto")({
  component: FlatProtoScreen,
});

/**
 * THROWAWAY PROTOTYPE (#89): bake-off lane 4 — flat low-poly 3D with
 * procedural animation. Separate route from `/match-proto` so this lane
 * never collides with the other three lanes' surfaces.
 */
function FlatProtoScreen() {
  const capture = globalThis.location !== undefined
    && new URLSearchParams(globalThis.location.search).get("capture") === "1";

  if (capture) {
    return (
      <main className="grid min-h-screen place-items-center bg-shell">
        <FlatProceduralPrototype />
      </main>
    );
  }

  return (
    <main className="hp-noise flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b-2 border-line bg-panel px-5 py-3">
        <div className="flex items-baseline gap-4">
          <h1 className="font-display text-2xl leading-none font-extrabold tracking-[0.06em] text-ink uppercase">
            Flat
            <span className="text-accent"> procedural</span>
          </h1>
          <span className="font-data text-[10px] tracking-[0.1em] text-ink-dim uppercase">
            /// bake-off lane 4 · thronefall register
          </span>
        </div>
        <div className="flex items-center gap-4 font-data text-[10px] uppercase">
          <StatusChip tone="acid">three.js</StatusChip>
          <Link
            to="/"
            className="border border-line px-2 py-1 text-ink-dim hover:bg-panel-2 hover:text-ink"
          >
            back to overworld
          </Link>
        </div>
      </header>

      <div className="flex-1 p-8">
        <FlatProceduralPrototype />
      </div>
    </main>
  );
}
