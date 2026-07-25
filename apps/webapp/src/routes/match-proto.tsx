import { createFileRoute } from "@tanstack/react-router";

import { CrowdCapture } from "../match-proto/realtime-3d/crowd-capture.tsx";
import { Realtime3dPrototype } from "../match-proto/realtime-3d/realtime-3d-prototype.tsx";

/**
 * `?view=capture` swaps in the round-3 capture surface, which builds every
 * gallery artifact in one page load. Kept behind a query param on the
 * existing route rather than added as a new one, because a new route does
 * not typecheck until `vite build` regenerates `routeTree.gen.ts`.
 */
function MatchProto() {
  const view = globalThis.location === undefined
    ? null
    : new URLSearchParams(globalThis.location.search).get("view");
  return view === "capture" ? <CrowdCapture /> : <Realtime3dPrototype />;
}

export const Route = createFileRoute("/match-proto")({
  component: MatchProto,
});

/**
 * Prototype (#81): this branch repoints /match-proto at the real-time
 * cel-shaded low-poly 3D bake-off lane. The PixiJS hello-world screen
 * (#27) and its modules (../match-proto/stage.ts, sprites.ts, idle.ts)
 * are untouched — the pixel control lane (#74) still owns them on its
 * own branch. Neither prototype branch merges; the galleries are the
 * deliverable.
 */
