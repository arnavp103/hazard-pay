import { createFileRoute } from "@tanstack/react-router";

import { PixelControlPrototype } from "../match-proto/pixel-control-lane/pixel-control-prototype.tsx";

export const Route = createFileRoute("/match-proto")({
  component: PixelControlPrototype,
});
