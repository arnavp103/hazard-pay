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

## The #24 seam

`src/routes/index.tsx` is a hello screen, not a lane trace viewer. It shows
placeholder lanes and leaders through a real `useQuery` (canned data, same
pattern as webapp's overworld screen — see its AGENTS.md), clearly labeled
as canned, plus an inert "Open lane trace" button pointing at #24. **Do not
wire that button up or build a trace view here** — the session-log/lane-
trace viewer is scoped to #24 and depends on the agent event store shape,
which doesn't exist yet. This scaffold's job is the shell and the seam,
nothing more.

## Query conventions

Same as webapp: `makeQueryClient` defaults (staleTime 15s, refetch on
focus, retry 1) live in `src/router.tsx`. Query keys here start with
`["admin", <surface>]`. There is no live tick to poll yet, so the hello
screen doesn't set a `refetchInterval` — add one at the query site once a
surface actually needs to chase a tick.

## Gotchas

Same as webapp: SPA mode still evaluates route modules during shell
prerender (keep module top levels browser-safe), and `vite dev`/`vite
build` regenerate `src/routeTree.gen.ts` — commit it alongside route
changes.
