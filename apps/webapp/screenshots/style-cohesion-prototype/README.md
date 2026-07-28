# Style cohesion prototype

Throwaway evidence for [Prototype: style cohesion — pixel characters over
cartoon environments](https://github.com/arnavp103/hazard-pay/issues/74).

## Question

Do deliberate pixel-cluster characters read as one game over sharp
comic/vector-cartoon environments, or should character and environment
authoring collapse to one style?

This prototype compares four treatments of the same field medic over the
same grime-market board:

| Key | Treatment | Deliberate variable |
| --- | --- | --- |
| A | Contour-first control | Flat local clusters, selective plum-black edge, minimal form shadow |
| B | Hard two-band cel | One hard shadow band per material |
| C | Material three-band cel | Shadow/base plus sparse material highlights, less outer ink |
| D | Grit hybrid | Two-band structure plus restrained wear, dither, and broken contours |

The map, subject, 24×32 authored canvas at 2×, pose, palette roles, light
direction, and camera path are held constant. The 6× sprite panel is
inspection-only; the 480×270 stage is the match-scale proof surface.

## Gallery

- [`variant-a-contour-first.png`](variant-a-contour-first.png)
- [`variant-b-two-band.png`](variant-b-two-band.png)
- [`variant-c-three-band.png`](variant-c-three-band.png)
- [`variant-d-grit-hybrid.png`](variant-d-grit-hybrid.png)
- [`four-treatment-motion.gif`](four-treatment-motion.gif) — synchronized
  camera pan and visible character turn for all four treatments
- [`cold-critique.md`](cold-critique.md) — provenance-blind advisory report

## Run

```sh
pnpm --filter @hazard-pay/webapp dev
```

Open `http://localhost:5173/match-proto?variant=A`. Use the floating arrows,
the keyboard arrow keys, or `?variant=A|B|C|D`. Add `&motion=1` for the
camera-pan/turn rig and `&capture=1` to hide prototype controls.

## Source boundary

- Character: programmatic 24×32 material grid in
  `src/match-proto/style-cohesion-prototype.tsx`, rendered with crisp integer
  scaling.
- Environment: agent-authored
  `grime-market-board.prototype.svg`, browser-rasterized 1:1 to the committed
  PNG used by the route.

The browser raster is intentional. ImageMagick's local SVG delegate dropped
parts of the stroke and pattern vocabulary, while Chromium matches the
actual review surface.

## Ruling status

Pending the human taste gate. Cold critique is advisory evidence only; it
cannot resolve the ticket.
