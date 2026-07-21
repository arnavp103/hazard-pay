import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen.ts";

/**
 * Same defaults as apps/webapp's makeQueryClient (ADR 0004 / Map #1):
 * stale-while-revalidate polling, no sockets. Admin surfaces will poll the
 * same agent-runtime state a leader's wake reads, once apps/api exists —
 * these are the defaults that tier inherits.
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
