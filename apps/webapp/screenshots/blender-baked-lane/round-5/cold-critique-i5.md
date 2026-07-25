# Cold critique — round 5, three-register crowd

Judged against `docs/art-direction/reference-board/README.md`. No prior
exposure to this work. Stills judged at native 480×270 unless stated;
loupes used only for craft inspection, never for legibility scoring.

## Scores

Bar to ship is **4 on every axis**.

| Axis | Small | Mid | Large |
| --- | :---: | :---: | :---: |
| 1. Crowd legibility | 2 | 3 | 4 |
| 2. Archetype separation | 2 | 3 | 3 |
| 3. Tier separation | 2 | 3 | 3 |
| 4. Crowd motion | 2 | 3 | 3 |
| 5. Cohesion with the board | 3 | 3 | 2 |
| **total (of 25)** | **11** | **15** | **15** |

**No register clears the bar.** One axis on one register reaches 4.

## Headline verdict

This does not ship, and the gap is not a polish gap. The direction asks for
"medium-resolution illustrative pixel sprites" at the Warped City end of the
density range and explicitly forbids "dropping toward ultra-low-resolution
roguelike or icon-like rendering." What is on screen is a 240×135 image
presented at 480×270, in which a melee fodder unit occupies an 11-art-pixel
cell at the small register and 18 art pixels of standing height at the large
one — against the board's own stated "revised 48×64-at-1× character
baseline." That is a 3–6× linear shortfall, and every downstream failure
follows from it: half the sprite is contour, faction identity has nowhere to
live, and archetype reads as an aspect ratio rather than as a drawing. The
palette work is real — the plum-black anchor is coherent, the rim gives every
unit a clean lift off the floor, the board is a genuinely handsome piece of
environment art — but the units are baked 3D downsamples wearing a rim light,
not comic-book pixel art, and the closer you look the more the picture is one
good drawing (the board) with a crowd of small grey renders standing on it.
The single fact that ends the conversation: at the small **and** mid
registers, the ranged fodder sprite is **byte-identical between the two
factions**. Half of each army has no side.

## Which register I would ship

**Large — but conditionally, and not as-is.**

It is the only register where every archetype in the roster carries *any*
faction pixels at all. Measured on `fodder-loupe-<reg>.png` (rows 1 vs 3 =
melee A/B, rows 2 vs 4 = ranged A/B, five facings each, subtracted
pixel-for-pixel and divided by 16 to convert 4× loupe pixels back to art
pixels):

| register | melee A vs B | ranged A vs B |
| --- | --- | --- |
| small | 3.4 art px / facing (6.0%) | **0.0 art px (0 of 3360 loupe px — identical)** |
| mid | 8.8 art px / facing (9.8%) | **0.0 art px (0 of 56 art px on the tier ladder)** |
| large | 24.0 art px / facing (15.9%) | 11.4 art px / facing (11.0%) |

Cross-checked independently on `tier-ladder-<reg>-1x.png` (true art
resolution, 1 image pixel = 1 art pixel): small ranged A vs B differ in **0 of
39** unit pixels; mid ranged in **0 of 56**; large ranged in 5 of 93.

Mid and large tie on total score, so the tiebreak matters: mid's deficit is a
*resolution* deficit that no runtime tint, outline, or HUD can repair — you
cannot paint a faction onto a 13-art-pixel-tall stick figure whose two
versions are the same file. Large's worst axis (cohesion, 2) is a *palette*
deficit — three or four colour substitutions in the unit ramp — which is a
day of work, not a re-bake. Fix the palette and large plausibly reaches
4/3/3/3/4; mid cannot get past 3 on archetype or tier without becoming large.

Two costs you are buying with that choice, both from the artifact's own
`crowd-cost.json`, and I would not pretend they are small:

- **Bytes.** Large's shipped atlas is 83,894 indexed bytes vs 54,876 (mid) and
  33,279 (small). The 16-fodder + 4-hero roster projection is 242,998 bytes /
  410 Blender-seconds at large vs 92,348 / 215s at small — 2.6× for the same
  roster.
- **Headroom, which is the real one.** At large, 36 units already span art-px
  x = 18..219 of a 240-wide board (84% of the width) and y = 58..129 of 135,
  with a **7-art-pixel corridor** between the two armies. (Measured by
  differencing `crowd-large.png` against the per-pixel median of the three
  register captures, then halving coordinates to art space.) There is no room
  for a 50-unit fight at this register. If the design needs more than ~36
  units on the board, large is not available and the honest answer is that
  none of these three registers works and the camera needs rethinking.

## The one measurement that matters

**Faction identity occupies between 0.24% and 2.38% of the frame, against a
palette law that budgets ~25% for identity.**

How I got it, so it can be checked:

1. Unit coverage of the frame. The artifact reports `unitPixels` of 9,136 /
   14,020 / 22,188 out of 480×270 = 7.05% / 10.82% / 17.12%. I verified the
   order of magnitude two ways: stacking the three register captures and
   masking pixels identical in all three gives a union-of-coverage upper bound
   of 26.3%; differencing each capture against the per-pixel median of the
   three gives 8.9% / 10.4% / 20.1%. Both bracket the reported numbers.
2. Identity share *within* a unit — defined operationally as "pixels that
   change if this unit switches faction" — from the loupe subtraction above:
   ~3.4% (small, melee/ranged averaged), ~10.3% (mid), ~13.9% (large).
3. Product: **0.24% / 1.11% / 2.38% of the frame carries faction identity.**

The luminance corollary, from `tier-ladder-<reg>-1x.png` with the background
colour masked out: the mean luminance difference between faction A and
faction B is **at most 3.9 of 255** (large melee, 63.2 vs 67.1); mid melee is
0.1; small and mid ranged are exactly 0. In `-gray.png` the two armies are
not two armies. Every faction cue in this artifact is chroma, applied to
under a sixth of a sprite that is itself under a sixth of a percent of the
frame. That is why the crowds only read apart in these stills at all: they
are standing 7 pixels apart in separate blobs. The first frame in which they
interpenetrate, the picture loses the ability to say who is whom.

Second measurement, same family: **30.2% of all unit pixels sampled across
the three tier ladders are the single flat rim colour `#59404f`.** Add the
ink and the artifact's own interior counts (small ranged: 19.1 interior px of
a 39-px sprite) and the small ranged fodder is **51% contour**. That is the
board's definition of icon-like rendering, arrived at by measurement rather
than by taste.

## Axis notes

**1. Crowd legibility.** At small, `crowd-small.png` at 1:1 is a texture of
dark specks; I cannot resolve individual figures, only two clouds. At mid the
right-hand mass resolves into countable units and the left does not. At large
both resolve, and the rust-vs-pale-lavender melee accent genuinely reads
across the board — this is the one axis that reaches 4, and it does so on the
easy case. There is no *drawn* front line at any register: the front line is a
7-px hole in the formation. Facings help, but a facing is 1–2 pixels of
asymmetry at this size.

**2. Archetype separation.** In the loupe the two archetypes are honestly
distinct — melee is a wide hunched mass with a pauldron, ranged is a thin
vertical with an outstretched arm; the artifact's own IoU drops 0.605 → 0.554
→ 0.528 and aspect ratio between them rises 1.31 → 1.37 → 1.44 with register.
But the separation is entirely *aspect ratio*, which is exactly the cue that
dies in a clump: a thin ranged unit standing behind a wide melee unit reads
as part of the melee unit's silhouette. In `crowd-large.png` I can find melee
units easily and I mostly cannot find ranged units — they read as vertical
gaps between the broad ones. Ranged needs a positive shape (a long weapon
line that breaks the silhouette, a different head mass), not a narrower one.
The large loupe does give the marksman a visible gun and an orange head; that
is the right instinct and it is not surviving the crowd.

**3. Tier separation.** Unmarked, the hero is 33% taller than fodder at every
register (bodyArtPx 12/16/21 vs 9/12/16) and carries a cream torso `#c8bda9`
and a cyan accent. I could not find a single hero in `crowd-mid.png` without
diffing it against the marked plate; at large I found two of four. That is a
fail on "at a glance."

What marking contributes: everything, and it contributes it as UI rather than
as art. The mark is 760 / 1,032 / 1,316 changed screen pixels (0.59% / 0.80%
/ 1.02% of the frame), all a single flat `#c8bda9` at L=190 — brighter than
99% of the picture (frame p99 luminance is 92 / 102 / 165). With it on,
heroes are instant at all three registers. Outward and inset differ by only
~7–8% of ring mass and are the same decision visually; prefer **inset** at
large because outward grows the hero's footprint into its neighbours. At
small the ring is a lozenge whose bounding box (13×16 art px) is **larger than
the hero cell it surrounds** (11×14 art px) — you are marking a thing you
cannot see, which is a diagnosis of the register, not a defence of the ring.

**4. Crowd motion.** From `filmstrip-*` only. Both treatments read as one toy
duplicated and jiggled. The tell is in the artifact's own `motionLockedFacing`
block: with facing held constant — i.e. removing the variety that comes from
the 8-way facing set rather than from animation — the `phase` treatment
yields **28 distinct images across 36 units, mean identical multiplicity 2.77,
peak 7 units rendering the same image in the same frame.** `variants` improves
it to 42 / 1.99 / 7. Neither is an army. `motion-frame-diff.json` also reports
`distinctFrames: 24` of 36 for both treatments and `quietTicks: 0` — nothing
ever holds still, which is the opposite of how a crowd looks. The phase-vs-
variants comparison is a null at the image level: I subtracted the two
filmstrips and they differ in **3.66%** (mid) and **2.14%** (small) of pixels;
consecutive-frame change is 20.67% vs 20.70% (mid). If forced, ship
`variants` — the manifest's duplicate multiplicity is genuinely lower — but
the manifest already records `full` as better than both on every listed metric
(distinctCells 214 vs 100 vs 76; multiplicity 1.19 vs 1.31 vs 1.73), so this
A/B tested the second- and third-best of four known options. No large
filmstrip was supplied; since the motion block is byte-identical across all
three configs, I scored large from the mid strip, and note that at large the
repetition would be *more* visible, not less.

**5. Cohesion with the board.** This is the finding that inverts with size.
Sampling the 16-colour board palette (pixels identical across all three
register captures) against the 25-colour unit palette (tier ladders,
background masked): **0.80% of board pixels are cool (blue channel > red);
45.72% of unit pixels are.** The world is an entirely warm plum-black
construction; nearly half of every sprite is drawn from a cool neutral-grey
family (`#696477`, `#504b5e`, `#46414a`, `#a5a4ab`, `#d4d2d3`) that appears
essentially nowhere on the board. Seventeen of twenty-five unit colours are
not in the board palette. At small the units are too few pixels for this to
register; at large the pale-lavender faction-B pauldrons are the largest
bright shapes in the frame after the hero ring, and they look like sprites
from a different game standing on this one.

Second cohesion defect, smaller but real: the picture is not on one pixel
grid. The units are strictly on the 2× grid (the frame is a nearest-neighbour
double of 240×135), but the board carries edges and drop shadows that land on
the odd screen row — 350 non-uniform 2×2 blocks in `crowd-large.png`, 263 in
`crowd-small.png`, 39 in `crowd-mid.png`, all in the ground plane under the
crowds, alternating `#1a1218`/`#161014`. (Measured by reshaping each frame to
(135, 2, 240, 2, 3) and testing max == min per block.) So a viewer looking
hard sees half-height slivers in the floor next to units that can only ever
move in whole double-pixels.

Credit where it is due: the rim solves unit-vs-floor separation cleanly. The
board is legitimately good — the value grouping, the two big massing blocks,
the teal floor panel and the restrained orange hazard stripes are on-brief and
the chartreuse has correctly been kept out of it.

## What the artifact appears to be flattering itself about

1. **"Fixed 480×270 presentation."** It is a 240×135 image doubled: 99.2% /
   99.9% / 98.9% of 2×2 blocks in the small/mid/large captures are uniform.
   Every "px" figure in `crowd-cost.json` is a screen pixel at 2×, so
   "fodder 22px · hero 28px on screen" is an 11×14 art-pixel cell holding a
   9-art-pixel body. Against the board's stated 48×64-at-1× baseline, the
   *largest* thing in the whole set — the hero at the large register, 24 art
   px standing — is 37.5% of the baseline height. The only asset in the
   pipeline authored near that baseline is a single 64×48 hero cell in
   `atlas-cost.json` that appears in none of these plates.
2. **"4× loupe."** It is 4× the *art* pixel, therefore 2× what you actually
   see. The loupes are half as magnified as they sound, which makes the
   craft look worse than the label implies, not better — but the label should
   say so.
3. **"faction B is a palette remap of faction A — it costs bytes, never
   renders."** Presented in `rosterProjection` as a cost win. It is the
   central failure of the artifact, and the manifest states it plainly
   without noticing.
4. **The contour improvement.** Median best ΔL is reported jumping 7.28 →
   **29.57**, and it is 29.57 to two decimals at *all three registers*. That
   is not drawn contrast; that is one constant rim colour against one constant
   floor. Meanwhile 32.6% / 29.7% / 23.0% of silhouette edge pixels still sit
   below ΔL 8 — a quarter to a third of every outline is still invisible,
   and it is invisible exactly where units touch each other.
5. **`quietTicks: 0`** is reported as if continuous motion were the goal. It
   means no unit is ever still. Armies have stillness; toys vibrate.
6. **`singletonShareShipped` 0.13–0.165** is framed as a win over the 0.42–0.61
   quantized figure. 13–17% single-pixel colour islands is still baked-render
   noise, not the "deliberate pixel clusters" the direction asks for. Related:
   `atlasRoundTripMismatchedPixels: 0` is a codec check presented among art
   metrics.
7. **The staging.** Every crowd plate has the two armies 7 art pixels apart
   and never touching, with the whole formation on one shared seed. Crowd
   legibility, archetype separation, and faction reading are all being scored
   on the one arrangement in which they cannot fail. Show me the frame where
   the two masses have interpenetrated.
8. **"Hero" tier.** One hero archetype exists (`medic`), and faction A's and
   faction B's heroes are the same medic differing by 7 / 16 / 32 pixels. Tier
   separation is being demonstrated with a sample size of one.

---

## Builder's note, added after the fact (not by the critic)

This critique was run against an earlier round-5 artifact and is kept because
its headline finding was correct and load-bearing. The claim was:

> at the small **and** mid registers, the ranged fodder sprite is
> **byte-identical between the two factions**.

**Verified, and corrected in one detail.** Diffing the two factions' idle cells
across all eight facings on the artifact the critic saw:

| register | archetype | byte-identical facings | faction-distinct pixels |
|---|---|---|---|
| small | melee | 3 of 8 | 43 / 629 (6.8%) |
| small | ranged | **7 of 8** | **4 / 502 (0.8%)** |
| mid | melee | 0 of 8 | 78 / 948 (8.2%) |
| mid | ranged | 3 of 8 | 57 / 726 (7.9%) |

So the claim is right about the small register and overstated about mid, where
the ranged unit differed on five facings of eight. The substance stands: at the
small register half the army had, for practical purposes, no side.

**Cause, measured.** On the small marksman — 199 opaque pixels across eight idle
facings — quantization produced 28 warm livery pixels and *cluster consolidation
deleted 15 of them* before the ink pass took most of the rest. A two-pixel
livery mark is below the minimum cluster size, so the pass that exists to remove
confetti was removing the only thing that said which army a unit belonged to.
Separately, CIEDE2000 put a share of the warm cloth on the `brick` ramp, which
is a world role and was not in the faction remap at all.

**Fixed**: the livery colours are now protected from consolidation exactly as
the scarce signal colours already were, and the brick ramp is in the remap.
After the fix, **zero facings are byte-identical at any register**, and
faction-distinct pixels are 14.1% / 7.2% (small), 15.0% / 13.2% (mid),
17.9% / 12.8% (large) for melee / ranged. The scores above therefore describe
the artifact *before* that fix; `cold-critique-i6.md` re-scores the one that
shipped.
