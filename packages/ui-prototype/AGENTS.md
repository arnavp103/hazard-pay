# @hazard-pay/ui-prototype

**PROTOTYPE — THROWAWAY.** This package answers issue #13: "what does
Hazard Pay's component style actually look like?" It is a Ladle playground
holding two competing art directions for the same component set. It is NOT
the real `packages/ui` — the accepted direction seeds that scaffold (#16),
and this package is then deleted or kept as a reference branch. Do not
import it from any app or package.

## Run

```
pnpm --filter @hazard-pay/ui-prototype dev
```

Ladle serves on http://localhost:61000.

## Layout

- `src/direction-a/` — Direction A: "Terminal HUD / Signal Discipline"
- `src/direction-b/` — Direction B: "Street-Tech / Grime Market"
- `src/lib/cn.ts` — shadcn-style class merge helper (clsx + tailwind-merge)
- `src/styles/globals.css` — Tailwind v4 entry; semantic tokens via
  `@theme inline`, direction scopes `.hp-a` / `.hp-b` set the raw values
- `.ladle/` — Ladle provider (fonts + global CSS) and config

Each direction implements the same set — button, panel, stat readout,
list row, trace chip — deliberately WITHOUT shared abstractions, so the
two directions can be compared and one thrown away cheaply.

## Conventions that carry to the real packages/ui (#16)

- Tailwind v4 CSS-first config (`@theme inline`), no tailwind.config.js
- shadcn patterns: cva variants + `cn()` helper; Base UI for unstyled
  primitives (Meter is exercised here)
- ESLint preset `@hazard-pay/config/eslint-tailwind` with the default
  `src/styles/globals.css` entry point
