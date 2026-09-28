import { createFileRoute } from "@tanstack/react-router";

import { VelvetSiegePrototype } from "../velvet-siege/prototype.tsx";

export const Route = createFileRoute("/prototype-velvet-siege")({
  component: VelvetSiegePrototype,
});
