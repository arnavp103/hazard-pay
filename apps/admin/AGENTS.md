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
the lane index refetches every 15s, the transcript every 5s — no realtime
transport on admin surfaces (#24 ruling). The transcript's "load next
page" advances a `seq > lastSeen` cursor, but the interval refetch re-runs
every loaded page (TanStack infinite-query semantics); a true tail-only
poll is deliberate follow-up material.

## Gotchas

Same as webapp: SPA mode still evaluates route modules during shell
prerender (keep module top levels browser-safe), and `vite dev`/`vite
build` regenerate `src/routeTree.gen.ts` — commit it alongside route
changes.
