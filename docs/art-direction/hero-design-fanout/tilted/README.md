# Hero-medic fanout — the tilted redraws, in camera

Four hero-medic designs were redrawn with a **true dimetric down-angle** and
authored **natively at both hero registers** (44 px and 28 px figure height,
on 32×44 / 21×28 canvases). This directory is those redraws standing on the
real grime-market board, under the real fixed 2:1 dimetric camera, at 1x —
one sprite pixel to one screen pixel, no resampling anywhere.

Everything here is produced by [`render-tilted.py`](./render-tilted.py).
Re-run it from this directory with no arguments to regenerate.

## Start here

| Image | What it answers |
| --- | --- |
| [`before-after-44px.png`](./before-after-44px.png) | **The headline.** Flat front elevation vs dimetric redraw, per design, at the large register. |
| [`before-after-28px.png`](./before-after-28px.png) | The same at the small register. |
| [`before-after-both-registers.png`](./before-after-both-registers.png) | Both of the above in one image at 2x. |
| [`contact-sheet-44px.png`](./contact-sheet-44px.png) | All four redraws plus the lane's own Mara as the control, large register. |
| [`contact-sheet-28px.png`](./contact-sheet-28px.png) | The same, small register. |
| [`tilt-report.json`](./tilt-report.json) | Every number quoted on the sheets. |

## What changed from the previous round, and why

The previous in-camera pass
(`../in-camera/`) inherited the pixel lane's own camera, `(-178, -92)`. That
camera parks its anchor on the **open middle of the walkable plane**, so every
hero was photographed standing on a bare dark patch with no scene in it. You
cannot judge whether a silhouette survives a board from a picture with no
board in it, and the cofounder correctly refused to.

This pass keeps the projection, the aperture (480×270), the scale (1x), the
anchor (214, 196), the contact-shadow rule and the painter's order **exactly
as the lane defines them**, and changes one constant:

```
CAMERA = (-30, -62)      # was (-178, -92)
```

That slides the same window over the **populated corner of the same board**:
the left market stack's lit and shadow faces directly behind the squad and
its 4 px ink contour, the teal and ochre floor decals underfoot, ground
clutter and grime clusters, the overhead cable and canopy panels above, and
the open plane falling away to the right. Roughly half of each silhouette
lands on structure and half on the plane — which is the condition the game
will actually read them in, and the condition that makes a figure/ground
failure visible.

Nothing about the board itself was touched. It is read out of
`origin/main` with `git show`, per the standing "do not change the shared
control board while the bake-off is open" rule.

## Method

Scene constants come from `prototype/pixel-control-lane` (read-only, via
`git show` — the branch is never checked out):

- `crowd-scene.ts` — 480×270 stage, `halfW/halfH` 18/9 (large) and 13/7
  (small), fodder 34 px / 22 px, contact shadow
  `ellipse(x, y+1, w/2, max(2, w/6)) @ rgb(18 11 16 / .42)`, blit anchor
  `(round(x - w/2), round(y - bottomRow))`, painter's order by contact row.
- `crowd-sprites.ts` — `maraLargeRows` / `maraSmallRows` and the rust
  livery, carried in as the **control**. Mara is the only figure in these
  sheets the lane itself authored for this camera.
- `style-cohesion-assets/grime-market-board.prototype.png` — the board.

Deliberately **not** applied, so each sprite is judged as authored: the
approved hero marking ring (it masks silhouette), the background-aware
contour pass (it rewrites authored pixels), depth palettes, and the idle
(clock frozen at 0 — no bob, no lean).

Each redraw carries its **own authored ground shadow** in its grid
(`,` `.` for flat-graphic, `n` `o` for chunky-silhouette, `o` `O` for
quasimorph-grime, `O` `J` for metal-slug-tactics). Those glyphs are excluded
from the figure bounding box, so the anchor is taken from the **body** and a
design with a longer cast shadow does not silently stand further left and
higher than its peers. The shadow still renders; the lane's own contact
ellipse is drawn underneath every unit including the heroes, so grounding is
identical treatment across the tier as the lane requires.

The six fodder placeholders are byte-identical to the previous round's:
neutral grey, featureless, 1 px contour, no chroma borrowed from any design.
Three of the six stand **one rank behind** the hero — one of them dead astern,
where a figure with real volume should hide it.

## Per-design captures

`44px/` and `28px/`, five images per design:

- `<design>-<reg>-1x.png` — the full 480×270 stage, true 1x
- `<design>-<reg>-3x.png` — 3x nearest loupe on the hero
- `<design>-<reg>-crowd.png` — the same stage with the six placeholders
- `<design>-<reg>-crowd-3x.png` — 3x nearest loupe on the group
- `<design>-<reg>-gray.png` — value structure, 1x over 3x

`lane-reference-mara-*` is the control, same four scene captures (no
grayscale — it is not a candidate).

## Measurements

`dissolvingEdgePct` is the lane's own figure/ground test: the share of
background-facing silhouette edge pixels sitting within 22 Rec.709 luma of
the board pixel they abut. Because the tilted redraws are **shorter** than
the flat elevations they replace, they stand against a different band of
background, so `dissolvingEdgePctFlatField` repeats the measurement against a
uniform field at the median luma of the visible board — a control no figure
can get lucky about.

`asternHiddenPct` is how much of the dead-astern placeholder the hero's body
actually covers, and `asternPokeAboveCrownPx` is how far that rear unit's
head clears the hero's crown. Together they are the depth-occlusion question:
a unit one rank back has to read as *behind*, not as *short*.

| design | reg | figure | ×fodder | dissolving edge (board / flat field) | astern hidden | poke |
| --- | --- | --- | --- | --- | --- | --- |
| flat-graphic | 44 | 30×41 | **1.21** | 6.7% / 0.0% (was 26.3% / 29.7%) | 66.0% (was 66.0%) | 11 px (was 8) |
| flat-graphic | 28 | 19×27 | **1.23** | 0.0% / 0.0% (was 43.1% / 46.9%) | 58.5% (was 60.6%) | 9 px (was 8) |
| chunky-silhouette | 44 | 29×42 | **1.24** | 18.3% / 17.8% (was 14.9% / 8.6%) | 72.0% (was 75.2%) | 10 px (was 8) |
| chunky-silhouette | 28 | 21×27 | **1.23** | 14.5% / 21.0% (was 34.1% / 39.9%) | 61.2% (was 60.6%) | 9 px (was 8) |
| quasimorph-grime | 44 | 26×33 | **0.97** | 7.6% / 11.4% (was 19.0% / 12.9%) | 43.8% (was 70.9%) | 19 px (was 8) |
| quasimorph-grime | 28 | 17×24 | **1.09** | 8.2% / 16.4% (was 52.7% / 55.4%) | 43.6% (was 59.0%) | 12 px (was 8) |
| metal-slug-tactics | 44 | 29×39 | **1.15** | 6.0% / 6.9% (was 30.4% / 19.6%) | 57.3% (was 68.8%) | 13 px (was 8) |
| metal-slug-tactics | 28 | 19×25 | **1.14** | 9.7% / 10.4% (was 50.7% / 35.5%) | 46.3% (was 58.5%) | 11 px (was 8) |
| **mara (lane control)** | 44 | 25×44 | **1.29** | 9.9% / 0.5% | 76.9% | 8 px |
| **mara (lane control)** | 28 | 18×28 | **1.27** | 1.0% / 1.0% | 63.8% | 8 px |

## The honest read

**The tilt bought figure/ground, and it cost the size tier.**

Three of the four redraws now separate from the board far better than their
flat elevations did, and the flat-field control says that is the artwork and
not luck about where they happen to stand. flat-graphic is the clearest win —
26.3% → 6.7% at the large register, 43.1% → 0.0% at the small one, because the
redraw put a hard pale hat crown and a lit shoulder plane at the top of the
silhouette where the previous version had mid-value cloth against mid-value
plane. metal-slug-tactics is nearly as good. quasimorph-grime's small register
went from a design that genuinely dissolved (52.7%) to one that reads.

The cost is real and it shows up in the same images. A down-angle spends
apparent height to buy top surfaces, and **the hero tier on this board is
carried by size**. Against 34 px of fodder, Mara is 44 px (1.29×). The redraws
land at 1.21× / 1.24× / **0.97×** / 1.15×. quasimorph-grime's large register
is now *shorter than its own fodder* — on the contact sheet you cannot pick
the hero out of the placeholder crowd at all, and its dead-astern unit's head
clears its crown by 19 px, so the rank behind reads as a taller unit standing
next to it rather than a unit behind it. metal-slug-tactics has a milder case
of the same thing.

chunky-silhouette is the one design where the tilt made figure/ground
**worse** at the large register (8.6% → 17.8% on the flat-field control): the
redraw traded its hard dark rim for broader mid-value top planes, and those
top planes sit in the board's own value band. It still has the best silhouette
mass of the four and the second-best occlusion behaviour, so this is a fixable
value problem rather than a structural one.

None of this is an argument against the tilt. It is an argument that the tilt
has to be drawn to the register rather than into it: the figure has to fill
the 44 px it was given after the foreshortening, not before. flat-graphic and
chunky-silhouette are within 4–5% of doing that; quasimorph-grime and
metal-slug-tactics gave away 5–11 px of hero and need the crown pushed back up
before this comparison means anything at the large register.
