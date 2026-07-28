import { createFileRoute } from "@tanstack/react-router";

import { CrowdPrototype } from "../match-proto/pixel-control-lane/crowd-prototype.tsx";
import { PixelControlPrototype } from "../match-proto/pixel-control-lane/pixel-control-prototype.tsx";

/**
 * The pixel control lane's harness. `?scene=crowd` swaps in the round-3
 * two-tier crowd stage; everything else keeps the round-2 single-subject
 * surface so the earlier gallery URLs still reproduce.
 */
function PixelControlRoute() {
  const scene = globalThis.location === undefined
    ? null
    : new URLSearchParams(globalThis.location.search).get("scene");
  return scene === "crowd" ? <CrowdPrototype /> : <PixelControlPrototype />;
}

export const Route = createFileRoute("/match-proto")({
  component: PixelControlRoute,
});
