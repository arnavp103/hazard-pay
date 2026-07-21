# @hazard-pay/ui

The Hazard Pay design system: Direction B — "Street-Tech / Grime Market"
(accepted on #13; reference branch `prototype/ui-foundation`). Ladle is the
component workbench; apps consume the components, CSS, and fonts directly
as raw TypeScript/CSS — there is no build step.

## Run

```
pnpm --filter @hazard-pay/ui dev
```

Ladle serves on http://localhost:61000.

## Layout

- `src/components/` — one file per component (button, panel, sticker,
  hazard-meter, stat-readout, list-row, trace-chip)
- `src/stories/` — Ladle stories: one file per component + `overview`
- `src/styles/globals.css` — the single Tailwind v4 entry (tokens, scopes,
  custom classes)
- `src/lib/cn.ts` — shadcn-style class merge (clsx + tailwind-merge)
- `src/fonts.ts` — side-effect @fontsource imports (Big Shoulders,
  Space Mono)
- `.ladle/` — provider (fonts + global CSS + shell background) and config

## Consumer contract

An app consuming this package needs, in its own CSS entry:

```css
@import "@hazard-pay/ui/globals.css";
@source "../";
```

- The `@import` brings Tailwind itself — do not import `tailwindcss` again.
- The `@source` (path relative to the consumer's CSS file, pointing at the
  consumer's own source root) is REQUIRED: Tailwind's automatic source
  detection cannot be trusted across package boundaries, and this package's
  own `@source "../"` only covers `packages/ui/src`.
- Import `@hazard-pay/ui/fonts` once at the app entry for the self-hosted
  fonts.
- Components come from the package root: `import { Panel } from "@hazard-pay/ui"`.

## Tokens and theming

Semantic utilities only — never raw palette values in components:
`shell/panel/panel-2/line/line-2/ink/ink-dim/accent/accent-2/info/warn/danger`
as colors, `font-display`/`font-data` as fonts, and hard offset shadows as
`shadow-hard`/`shadow-hard-lg`/`shadow-hard-accent`.

Tokens are registered via `@theme inline` and resolve through `--hp-*`
custom properties declared on `:root`. A scope re-declaring those properties
retunes the whole tree under it — `.hp-dense` (grain and shadows turned
down for data-heavy surfaces, per the #13 ruling) is the first such scope;
full alternate themes would work the same way.

## Conventions

- Tailwind v4 CSS-first config; no `tailwind.config.js`.
- **Every custom class goes in `@layer components`** — un-layered CSS after
  `@import "tailwindcss"` silently beats all utilities (cascade layers).
- cva for variants, `cn()` for merging; Base UI for unstyled primitives
  (Meter today). Base UI is pinned at `1.0.0-rc.0` (caret-normalized).
- Signature custom classes: `hp-noise` (grain), `hp-clip` (clipped corner),
  `hp-hazard`(+`-anim`) (stripes), `hp-blink`, `hp-anim-stamp`.
- Story names use the domain vocabulary (CONTEXT.md): lanes, missions,
  wakes, ticks, phases, moves, leaders.

## Ladle quirks

- New story files need a Ladle server restart — HMR does not register them.
- Story slugs: title + export name, slugified; em-dashes in titles become
  `--` (the hierarchy separator) — use `/` for hierarchy deliberately.
- Ladle's Vite root is internal, hence the explicit `@source "../";` in
  `globals.css`.
