# @hazard-pay/admin

Dev-tooling console for humans and agents — never deployed. Same TanStack
Start SPA recipe as `apps/webapp` (read that package's AGENTS.md first for
the shared contract; this file only documents where admin deviates).

## Run

    pnpm --filter @hazard-pay/admin dev

Vite serves on http://localhost:3001 — one port up from webapp's 3000, so
both apps can run side by side under `pnpm dev` (repo root: `turbo run dev
--parallel`).

## Layout

Identical to webapp's: `src/routes/` (file-based, `__root.tsx` owns the
shell), `src/router.tsx` (exports `getRouter`, owns the QueryClient
defaults), `src/routeTree.gen.ts` (generated, committed, eslint-ignored,
never hand-edited), `src/styles/globals.css` (imports
`@hazard-pay/ui/globals.css` + `@source "../";`).

## Dense by default

Admin is a data-heavy surface — tables, lane rosters, eventually a full
lane-event trace — so it opts into `.hp-dense` (packages/ui/AGENTS.md, the
#13 ruling: grain and shadows turned down, not abandoned) at the document
root: the `<body>` in `__root.tsx` carries the `hp-dense` class alongside
the usual `bg-shell font-data text-ink antialiased`. Individual routes
don't need to re-apply it — unlike the Panel dense-scope Ladle story, which
wraps a single region because it's demonstrating the *contrast* against a
default-scope sibling, admin has no default-scope regions to contrast
against.

## The lane trace viewer (#24)

`/lanes` (index) and `/lanes/$laneId` (transcript) are the first real admin
surfaces: they render the agent runtime's lane event log from apps/api's
lane read routes. The split of knowledge is deliberate:

- `src/lib/api.ts` — the typed oRPC client over `@hazard-pay/api/contract`
  (pure inference, no codegen). Requests go same-origin through the
  `/hp-api` Vite dev proxy to the api on port 3000 — the api serves no CORS
  headers and admin is dev-only, so the proxy stays. Both `pnpm db:up` +
  `pnpm --filter @hazard-pay/api dev` must be running; the screens state it
  honestly when they aren't (never canned data on these routes).
- `src/lib/trace-format.ts` + `src/components/lane-event-chip.tsx` —
  envelope semantics (summaries, model turn parts). Summaries stay
  admin-local on purpose: the `@hazard-pay/ui` trace components
  (TraceChip, JsonInspector) stay payload-agnostic. Lane cross-links are
  NOT admin-local: they come from the contract's re-exported
  `builtinToolReceipt` (CONTEXT.md: Receipt) — never duck-type
  `output.laneId`.
- `src/lib/lane-filters.ts` + `src/components/lane-filters.tsx` — the
  `/lanes` index's filter chips (#58): `leader`/`kind`/`status`/
  `configHash`/`model`, the same optional fields `GET /lanes` accepts.
  `validateLaneSearch` is the route's `validateSearch` — the URL is the
  source of truth for filter state, so a filtered view survives a reload
  and is shareable by copying the link. `kind`/`status` chips are the
  fixed runtime vocab, always shown in full; `leader`/`model`/`configHash`
  chips are the distinct values seen in the currently-loaded (already
  filtered) rows — a simple faceted-search approximation, not a separate
  facets query.

`src/routes/index.tsx` is still the hello screen with a canned
leaders/lanes snapshot (labeled as such); its "Open lane trace" button now
links to `/lanes`.

## Tests

`pnpm --filter @hazard-pay/admin test` — vitest, node env, pure helpers
only (`trace-format.test.ts`); no Postgres, no DOM. The receipt narrowing
itself is tested in `packages/agent`'s lane suite.

## Query conventions

Same as webapp: `makeQueryClient` defaults (staleTime 15s, refetch on
focus, retry 1) live in `src/router.tsx`. Query keys here start with
`["admin", <surface>]`. Polling is overworld-tier and set per query site:
the lane index refetches every 15s, the transcript tail every 5s — no
realtime transport on admin surfaces (#24 ruling).

The transcript (#58) is two queries, not one: an infinite query paginates
the backlog only (`fetchNextPage` advancing a `seq > lastSeen` cursor, no
`refetchInterval`), and once it's caught up (`!hasNextPage`) a second plain
`useQuery` polls `after: lastSeenSeq` on its own 5s interval. A `useEffect`
manually appends whatever the tail query returns onto the infinite query's
cached last page (`queryClient.setQueryData`) rather than letting a
refetch re-run every loaded page — a long transcript's poll cost stays
flat in the number of lane events already loaded.

## Gotchas

Same as webapp: SPA mode still evaluates route modules during shell
prerender (keep module top levels browser-safe), and `vite dev`/`vite
build` regenerate `src/routeTree.gen.ts` — commit it alongside route
changes.
