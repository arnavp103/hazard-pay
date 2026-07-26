import { createFileRoute, Link } from "@tanstack/react-router";

import { StatusChip } from "@hazard-pay/ui";

import { CombatSandboxPrototype } from "../match-proto/combat-sandbox/combat-sandbox-prototype.tsx";

export const Route = createFileRoute("/combat-sandbox")({
  component: CombatSandboxScreen,
});

/**
 * THROWAWAY SCAFFOLDING (#96): the combat sandbox — the shared substrate the
 * combat-vocabulary prototypes on map #95 build on.
 *
 * Three.js, deliberately separate from `/match-proto` (PixiJS, #27) and from
 * the bake-off lane routes. Keep them separate; they answer different
 * questions and nothing is served by unifying them.
 */
function CombatSandboxScreen() {
  const capture = globalThis.location !== undefined
    && new URLSearchParams(globalThis.location.search).get("capture") === "1";

  if (capture) {
    return (
      <main className="grid min-h-screen place-items-center bg-shell">
        <CombatSandboxPrototype />
      </main>
    );
  }

  return (
    <main className="hp-noise flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b-2 border-line bg-panel px-5 py-3">
        <div className="flex items-baseline gap-4">
          <h1 className="font-display text-2xl leading-none font-extrabold tracking-[0.06em] text-ink uppercase">
            Combat
            <span className="text-accent"> sandbox</span>
          </h1>
          <span className="font-data text-[10px] tracking-[0.1em] text-ink-dim uppercase">
            /// throwaway scaffolding · not an art ruling
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
        <CombatSandboxPrototype />
      </div>
    </main>
  );
}
