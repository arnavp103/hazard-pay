import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen.ts";

/**
 * Overworld realtime tier (ADR 0004 / Map #1): stale-while-revalidate
 * polling over TanStack Query — no sockets for the overworld. Queries are
 * fresh for half a typical polling window and refetch on focus, so a
 * returning player sees the advanced world without a manual reload. Real
 * endpoints arrive with apps/api; these are the defaults they inherit.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: true,
        retry: 1,
      },
    },
  });
}

export function getRouter() {
  const queryClient = makeQueryClient();
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    scrollRestoration: true,
    Wrap: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}
