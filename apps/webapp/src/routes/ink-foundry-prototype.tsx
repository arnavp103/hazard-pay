import { createFileRoute } from "@tanstack/react-router";

import { InkFoundryPrototype } from "../ink-foundry/prototype.tsx";

export const Route = createFileRoute("/ink-foundry-prototype")({ component: InkFoundryPrototype });
