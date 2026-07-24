import { createFileRoute } from "@tanstack/react-router";

import { Realtime3dPrototype } from "../match-proto/realtime-3d/realtime-3d-prototype.tsx";

export const Route = createFileRoute("/match-proto")({
  component: Realtime3dPrototype,
});

/**
 * Prototype (#81): this branch repoints /match-proto at the real-time
 * cel-shaded low-poly 3D bake-off lane. The PixiJS hello-world screen
 * (#27) and its modules (../match-proto/stage.ts, sprites.ts, idle.ts)
 * are untouched — the pixel control lane (#74) still owns them on its
 * own branch. Neither prototype branch merges; the galleries are the
 * deliverable.
 */
