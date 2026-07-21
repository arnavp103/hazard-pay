import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";

import "@hazard-pay/ui/fonts";
import appCss from "../styles/globals.css?url";

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Hazard Pay — Admin" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      {/*
       * hp-dense (packages/ui/AGENTS.md, #13 ruling): admin is a dense,
       * data-heavy dev surface end to end, so the scope wraps the whole
       * document rather than a single region the way the Panel dense-scope
       * story demonstrates it locally.
       */}
      <body className="hp-dense min-h-screen bg-shell font-data text-ink antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}
