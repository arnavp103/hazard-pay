import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import "@hazard-pay/ui/fonts";
import { ensureBrowserTelemetry } from "../lib/telemetry.ts";
import appCss from "../styles/globals.css?url";

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Hazard Pay" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
  // Browser telemetry starts with the document, not a screen (ADR 0005 §6).
  useEffect(() => ensureBrowserTelemetry(), []);
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-shell font-data text-ink antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}
