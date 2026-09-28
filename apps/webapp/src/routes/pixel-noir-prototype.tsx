import { createFileRoute } from "@tanstack/react-router";

import { PixelNoirPrototype } from "../pixel-noir-prototype/prototype.tsx";

export const Route = createFileRoute("/pixel-noir-prototype")({ component: PixelNoirPrototype });
