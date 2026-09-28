import { createFileRoute } from "@tanstack/react-router";

import { SignalPrint } from "../signal-print-prototype/signal-print.tsx";

export const Route = createFileRoute("/signal-print-prototype")({ component: SignalPrint });
