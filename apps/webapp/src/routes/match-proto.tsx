import { createFileRoute } from "@tanstack/react-router";

import { BlenderBakedPrototype } from "../match-proto/blender-baked/blender-baked-prototype.tsx";

export const Route = createFileRoute("/match-proto")({
  component: BlenderBakedPrototype,
});

/**
 * Prototype (#82): this branch repoints /match-proto at the Blender-baked
 * bake-off lane — low-poly rendered headlessly by `bpy`, quantized onto the
 * Direction B palette, packed into one atlas, and played back by the same
 * PixiJS v8 runtime the hello-world screen uses. The #27 screen and its
 * modules (../match-proto/stage.ts, sprites.ts, idle.ts) are untouched; the
 * pixel control lane (#74) still owns them on its own branch. No prototype
 * branch merges; the galleries are the deliverable.
 */
