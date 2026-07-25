# Cold critique — blender-baked-lane, round 5

Judged against `docs/art-direction/reference-board/README.md`.

## Scores

Bar for shipping is **4 on every axis**.

| Axis | Small | Mid | Large |
|---|:--:|:--:|:--:|
| 1. Crowd legibility | 2 | 3 | 3 |
| 2. Archetype separation | 1 | 2 | 3 |
| 3. Tier separation | 2 | 2 | 2 |
| 4. Crowd motion | 2 | 2 | 2\* |
| 5. Cohesion with the board | 3 | 3 | 2 |
| **Total (of 25)** | **10** | **12** | **12** |

\* No large-register filmstrip was supplied. Only `filmstrip-mid-*` and
`filmstrip-small-*` exist. The large score is extrapolated and flagged below.

## What I used for what

- **On-screen judgement** — `three-register-sidebyside.png`,
  `crowd-{small,mid,large}.png`, `crowd-*-mark-*.png` and the `-gray.png`
  variants, all read at native 480×270, 1:1. All legibility, archetype,
  tier-at-a-glance and side-reading calls come from these.
- **Craft inspection only** — `fodder-loupe-*`, `fodder-adjacent-mid-6x.png`,
  `tier-ladder-*` at 4×, and my own nearest-neighbour blowups in
  `/tmp/critic6/` (3×–9×). Nothing in the scores rests on a loupe read except
  where the loupe is the *only* evidence, which I say explicitly.
- **Measurement** — all numeric claims below are computed from the shipped PNGs
  with PIL/numpy. Method is stated inline with every number so it can be
  re-run. Luminance is Rec.709 on sRGB values scaled 0–1.

---

## Axis 1 — Crowd legibility

**Small 2 / Mid 3 / Large 3.**

The single fact that governs this axis: **the darkest 70% of every unit is
painted in the ground's own colours.** The sprites' darkest tone is
`(26,18,24)`, L = 0.079 — which is simultaneously the most-used colour in the
whole frame (20.1% of `crowd-small.png`). The next tone up, `(18,11,16)`,
L = 0.05, is another 14.2%. So what you actually see at 1:1 is not thirty-six
bodies; it is a few hundred loose bright fragments floating on black, and your
eye groups them by proximity rather than by shape.

Measured figure/ground contrast, sprite mean luminance against the lane floor
`(36,26,34)` L = 0.11, using `(L+0.05)/(Lg+0.05)`:

| | small | mid | large |
|---|:--:|:--:|:--:|
| melee | 1.97–2.10 : 1 | 1.79–1.86 : 1 | 2.01–2.17 : 1 |
| ranged | 1.84–1.85 : 1 | 1.79–1.86 : 1 | 1.80–1.88 : 1 |

Around 2:1 for a body against the ground it stands on is not a figure/ground
relationship; it is camouflage. Only the highlight pixels break out, and there
are very few of them (see Axis 2).

**Reading the two sides apart is entirely hue and carries zero value support.**
Mean sprite luminance, faction A vs faction B, from `tier-ladder-large-1x.png`:
melee 0.272 / 0.297, ranged 0.237 / 0.250, hero 0.314 / 0.329. A gap of
0.013–0.025 L is **3 to 6 levels out of 255**. The artifact ships the proof
itself: in `crowd-large-gray.png` and `three-register-sidebyside-gray.png` the
two armies are the same speckled grey texture and can only be told apart by
which side of the board they are standing on. Take the hue away and the match
becomes unreadable. That caps this axis at 3 in every register regardless of
size.

The front line is the one thing that works. There is a clean dark diagonal
no-man's-land between the masses at all three registers, and the board's
orange floor plates flank it. That read is genuinely good and it is the
strongest thing on this board after the palette.

Small is a 2 because individual units do not resolve at all — the left mass is
a dark clot with rust dashes, the right a grey clot. Mid and Large are 3s:
front-rank units resolve, interior ranks still merge into texture.

Crowd extent, x-range of the sprite-only cool tones
`{(165,164,171),(105,100,119),(70,65,74)}` in rows 105–270:
small 128–343 (216 px, 45% of frame width), mid 102–379 (278 px, 58%),
large 52–423 (372 px, **78%**). At Large, thirty-six units already consume
four-fifths of the board width with nothing else on screen.

## Axis 2 — Archetype separation

**Small 1 / Mid 2 / Large 3.**

The archetype idea is sound and it is a silhouette idea, which is right:
melee is wide and hunched, ranged is narrow, upright, with a horizontal
weapon line. Width:height of the bounding boxes (from `tier-ladder-*-1x.png`,
cross-checked against the 4× versions which are exactly 4× these):

| | melee | ranged | ratio gap |
|---|:--:|:--:|:--:|
| small | 10×10 = 1.00 | 7×10 = 0.70 | 0.30 |
| mid | 12×12 = 1.00 | 8×13 = 0.62 | 0.38 |
| large | 15×16 = 0.94 | 10×20 = 0.50 | 0.44 |

But the read fails because the identifying feature has no pixels to live in.
Counting sprite pixels above L 0.30 and above L 0.45:

| | fill | L>0.30 | L>0.45 |
|---|:--:|:--:|:--:|
| ranged, small | 40 px | **4** | **0** |
| ranged, mid | 56 px | 5–6 | 2 |
| ranged, large | 93 px | 10–14 | 4 |
| melee, large | 162 px | 51–68 | 13 |

An entire ranged fodder unit at the small register is carried by **four
legible pixels, none of them bright**. In the clump this is not a hard read,
it is a missing archetype: `crowd-small.png` shows one kind of thing. Hence 1.

At Mid the rifle line is 4–5 px at L ≈ 0.28 against a floor at L 0.11 —
about 1.9:1 — so it disappears the moment another unit stands behind it. 2.

At Large the difference becomes an aspect-ratio difference rather than a
three-pixel width difference, and I can manage it in the clump for the front
two ranks. Interior ranks still fail. 3.

Note where the loupe flatters this: `fodder-adjacent-mid-6x.png` separates the
archetypes convincingly, and `fodder-loupe-small.png` at 4× separates them too.
Neither survives to 1:1. The loupe is not evidence for this axis.

## Axis 3 — Tier separation

**2 / 2 / 2.** The weakest axis, and the only one that does not improve with
size — it actually gets *worse*.

Hero-to-fodder height ratio:

| | hero : ranged | hero : melee |
|---|:--:|:--:|
| small | 13/10 = **1.30** | 13/10 = 1.30 |
| mid | 18/13 = **1.38** | 18/12 = 1.50 |
| large | 23/20 = **1.15** | 23/16 = 1.44 |

At the register the artifact most wants to ship, the hero is **15% taller than
a rifleman**. Three pixels. That is not a tier.

The hero's one categorical identity cue is the cyan `(47,158,150)`. Fodder
carry none of it — I checked, zero occurrences in `fodder-loupe-*.png` at every
register, which is a good decision. But the cue is **3 px (small), 2 px (mid),
4 px (large)**, and it is never contiguous: it sits at height-fractions 0.17
and 0.58 as isolated dots. Two pixels is not a rank insignia.

The hero also has 19–20% of its pixels above L 0.45 versus 4% for fodder — so
it *is* the brightest unit type — but those bright pixels are spread evenly
down the body (mean height-fraction 0.48) instead of clustering where the eye
lands, and faction B fodder carry the same bright grey `(165,164,171)`. Net
effect: unmarked, the hero reads as "a unit with a white skirt". I cropped
`crowd-mid.png` at 5× around the known hero positions and still could not pick
them out of the surrounding fodder. **Unmarked tier separation is a 1 in all
three registers.**

**What the marking contributes: everything, and that is the problem.** Diffing
`crowd-<reg>-mark-*.png` against `crowd-<reg>.png`, the ring is `(200,189,169)`
at L = 0.74 — brighter than any other pixel in the frame — costing

| | changed px | % of frame | ring area per hero | hero sprite fill | ratio |
|---|:--:|:--:|:--:|:--:|:--:|
| small outward | 760 | 0.59% | 190 px | 65 px | **2.9×** |
| mid outward | 1032 | 0.80% | 258 px | 116 px | 2.2× |
| large outward | 1316 | 1.02% | 329 px | 179 px | 1.8× |

At Small the identification badge has nearly **three times the visual mass of
the unit it identifies**. That is a HUD cursor, not art, and it is doing 100%
of the tier work. Marked, tier separation is instant at all three registers and
survives grayscale (L 0.74 clears everything else in the frame); with that
included the axis lands at 2, not higher, because a cue that must be three
times the size of its subject is not a tier design.

Outward beats inset clearly — inset eats the sprite's own pixels and the ring
fragments. But note a defect in outward at Mid: connected-component analysis of
the diff returns **3 components for 4 heroes** — two adjacent rings merge into
one 520 px blob, so you read one large marked thing instead of two heroes.

## Axis 4 — Crowd motion

**2 / 2 / 2 (large unevidenced).** From the filmstrips only.

Method: each filmstrip is 4×3 tiles on 4 px gutters at x = 0/264/528/792 and
y = 0/144/288; every screen row and column is duplicated, so tiles de-2× to
native 130×70.

- **The twelve frames are eight.** Tiles 1–4 are byte-identical to tiles 9–12
  in all four filmstrips. The loop is 8 frames and the sampler wrapped.
- Consecutive-frame changed pixels (RGB L1 > 18): small 5.3–7.1%, mid 8.4–9.8%.
- The best whole-image integer shift matching frame 0 to frame 1 is (0,0) —
  better than any ±1 or ±2 offset. So units move individually and the crowd
  does not translate. Good: it is not one sprite sheet sliding.
- Sampling every moving 12×12 window across the 8 unique frames: roughly half
  show **4** distinct states and half show **8**. The entire motion vocabulary
  is a 4-frame and an 8-frame idle bob. No advance, no lunge, no attack, no
  reaction, no death, no weapon travel.

So: not copies of one toy — copies of two toys, each with an idle. Thirty-six
units drawn from an inventory of 2 archetypes × 2 factions × 5 facings, with no
per-unit variation in equipment, palette, height or build. That is exactly what
the board's Dwarf Fortress caption asks you not to do — "identity assembled
from hair, armor, equipment, body features, and material palettes" — and none
of that layer system is present.

**The phase-vs-variants comparison is a null result.** Frame-for-frame, the two
treatments differ by 3.1–4.4% of pixels, while consecutive frames within either
treatment differ by 8.4–9.8%. The delta between the two scheduling treatments
is under half the delta the animation produces on its own. Whatever the two
approaches mean in code, they are not visually distinguishable at 1:1, and no
choice between them should be made from this evidence.

Large scores 2 by extrapolation, not measurement: the bob amplitude is a
constant pixel or two, so at 23 px of hero height it is 1/23 of the figure
rather than 1/13, meaning motion reads *less* at Large. Not supplying a
large-register filmstrip while presenting Large as a candidate is a gap in the
submission.

## Axis 5 — Cohesion with the board

**Small 3 / Mid 3 / Large 2.**

Palette-wise this is genuinely disciplined and I want to say so plainly. The
entire 480×270 frame uses **36 / 43 / 44 colours**. The plum-black anchor is
respected and consistent. Chartreuse is nowhere — the board explicitly warns
against promoting it into every asset, and this artifact obeys. The teal
`(28,90,85)` on the shopfront sign and the brighter `(47,158,150)` on the hero
are a nice signal echo across environment and character. Units and board share
one pixel grid and one isometric footprint. On palette alone, this is one
world.

**On drawing language it is not one world at all, and blowing it up shows why.**

The environment is a correct comic-book pixel drawing: 1–2 px near-black ink
contours in `(18,11,16)` L = 0.05 against a brick facade `(86,48,61)` L = 0.22
— an outline **0.17 L below its own fill** — plus large flat planes, a hard
black offset shadow shape on the wall, crisp 2:1 isometric edges. It hits every
bullet of the style hypothesis.

The sprites do the opposite. Eroding the sprite mask by one pixel and comparing
the boundary ring to the interior, **the fodder's edge is brighter than its
interior in every case**: +0.009 to +0.081 L. The dominant edge tone at Large
is `(89,64,79)` L = 0.28 — 170 of 279 boundary pixels — which is a mid-value
plum that is itself 1.8% / 2.4% / 3.3% of the small/mid/large frame, i.e. a
world tone. So the units are not inked; they are rim-lit, in the same colour
family as the buildings, at a value *above* their own bodies. There is also no
contact shadow or ground occlusion under any unit at any register, so nothing
anchors a figure to the floor.

Zoomed to 7–9× (`/tmp/critic6/zoomA.png`, `zoomB.png`, `iso1.png`) the sprites
resolve into scattered 1–2 px fragments with no cel clusters, no clean internal
separations, and no anatomy — the signature of a 3D render downsampled to a
tiny footprint and quantized, not of a drawing made of deliberate pixel
clusters. The board reads as authored; the units read as baked.

Cohesion therefore *falls* as the register grows: at Small the sprite noise
passes for grime and belongs; at Large it is visibly a different production
process pasted onto a drawn stage.

## Palette law

Classifying every pixel of each frame by HSV — world = V < 0.55 and not
saturated-bright; identity = (S ≥ 0.5 and V ≥ 0.3, warm hues) or
(V ≥ 0.55 and S < 0.2); signal = S ≥ 0.5, V ≥ 0.3, non-warm hue:

| | world | identity | signal |
|---|:--:|:--:|:--:|
| small | 93.0% | 5.9% | 1.1% |
| mid | 92.5% | 6.4% | 1.1% |
| large | 92.5% | 6.9% | 0.6% |
| **target** | **~70%** | **~25%** | **~5%** |

The plum-black anchor is right and the discipline against chartreuse is right.
But identity is running at roughly a quarter of its budget and signal at
one-fifth. The world is not "muted" here, it is *everything*, and the units are
part of the world rather than sitting on it. This is the same finding as Axis 1
and Axis 5 expressed in percentages: the artifact has confused palette
restraint with palette planning.

---

## Headline verdict

**It does not clear the bar. No register scores 4 on any axis, and the best
total is 12 of 25.** What is here is a real, disciplined environment drawing —
correct plum anchor, 36–44 colours, black ink contours, flat planes, a clean
no-man's-land, no chartreuse creep — with a crowd of units that were not drawn
in the same language and are too small to be drawn in any language. The board's
own density anchor states a "revised 48×64-at-1× character baseline"; the
largest sprite in this artifact is a 13×23 hero, which is **9.7% of that
baseline by area**, and the smallest is a 7×10 rifleman at **2.3%**. The
reference board says in as many words: "Avoid dropping toward
ultra-low-resolution roguelike or icon-like rendering." Every one of the three
registers is below that line; the three registers only argue about *how far*
below. The units carry no ink contour, are painted from the ground's own
palette, separate the two armies on hue with a 3-to-6-level value gap, mark the
hero with two cyan pixels and a 15% height step, and move with a 4-or-8-frame
idle bob. The honest reading is that 480×270 with thirty-six units is not a
presentation scale for this direction — it is roughly a quarter-scale preview
of one — and the artifact has been solving legibility inside a frame that
cannot hold the brief.

## Which register I would ship

**Large — and only as the floor, not as the answer.**

Large is the only register where a unit is a *shape* instead of a speck. Melee
goes from 61 filled pixels at Small to 162 at Large, and the pixels that
actually carry the read (L > 0.30) go from 13–19 to **51–68**. Ranged goes from
4 legible pixels to 10–14. Most importantly, Large is the only register where
melee-vs-ranged is an aspect-ratio difference (0.94 vs 0.50) rather than a
three-pixel width difference, and it is the only register where I can manage
the archetype in the clump rather than in the loupe.

Small is the choice to refuse outright. A ranged fodder unit there has **four
pixels above L 0.30 and zero above L 0.45**. Every fix this artifact needs —
an ink contour, a faction value split, a hero insignia — has to be spent in
pixels, and Small has none left to spend. You cannot re-colour four pixels into
a legible soldier. Mid is a compromise that inherits Small's pixel poverty
(ranged: 5 legible pixels) without buying Large's silhouette clarity.

Two things Large costs you, and they should be priced in now rather than
discovered later. First, tier separation gets *worse*: the hero:ranged height
ratio drops from 1.38 at Mid to **1.15** at Large, so shipping Large makes the
hero problem more urgent, not less. Second, thirty-six units at Large already
span **372 of 480 px (78%)** of the board width and occupy at least 13.3% of
the frame — with no projectiles, no effects, no damage numbers and no HUD on
screen yet. Shipping Large therefore means one of two decisions must be made
explicitly: fewer units on screen, or a presentation wider than 480×270.

Also: pick **outward** marking, not inset. It is the same cost (1316 vs 1216 px
at Large) and it does not eat the sprite. Fix the merge case first — at Mid,
outward produced 3 connected ring components for 4 heroes.

Finally, ship Large knowing it is the register that *exposes* the craft
problems rather than hiding them. That is the correct property for a prototype.
Small makes this artifact look better than it is; Large tells you what to fix.

## The two things most worth fixing next

### 1. Give the units a value plan — an ink contour, and a faction value split

Right now the value plan does no work in either direction: not between figure
and ground, and not between the two armies.

*Figure/ground.* Erode each sprite mask by one pixel and compare the boundary
ring's mean Rec.709 luminance to the eroded interior, on
`tier-ladder-<reg>-1x.png`. Every fodder sprite comes back with the edge
**brighter** than the interior: +0.009 to +0.081 L. The dominant boundary tone
at Large is `(89,64,79)` L = 0.28 (170 of 279 edge pixels) — a mid plum that is
also 2.4% of the mid frame in its own right. Meanwhile the environment inks its
brick facade with `(18,11,16)` L = 0.05 against `(86,48,61)` L = 0.22, a
**−0.17 L** contour. And the sprites' own darkest tone is `(26,18,24)` L = 0.079
— the single most-used colour in `crowd-small.png` at 20.1% of the frame, i.e.
the ground.

**Target:** a dedicated contour tone at least **0.10 L below the sprite's own
mean** on every unit, and `(26,18,24)` and `(18,11,16)` forbidden inside a unit
body. Re-run the erosion test; the edge/interior delta must go negative on all
six sprites. Add a contact shadow so figures stop floating.

*Faction/faction.* Mean sprite luminance at Large: A 0.272 / B 0.297 (melee),
A 0.237 / B 0.250 (ranged), A 0.314 / B 0.329 (hero) — a 0.013–0.025 gap, 3–6
levels of 255. **Target: ≥ 0.15 L separation between the two factions' mean
sprite luminance,** with the acceptance test being the artifact's own
`crowd-<reg>-gray.png` — the two armies must read as two different masses in
the grayscale export. Today they do not; you can only tell them apart by which
side of the board they stand on.

This one fix moves Axis 1, Axis 2 and Axis 5 simultaneously, and it is the
fix that makes every other fix affordable.

### 2. Build a real tier, not a ring

Tier separation is the only axis that scores 2 in all three registers and the
only one that degrades with size. Three numbers define the problem:

- Hero height advantage over a rifleman: **1.30× / 1.38× / 1.15×** (13 vs 10,
  18 vs 13, 23 vs 20 px). At the register I recommend shipping, that is three
  pixels.
- Hero-only accent `(47,158,150)`: **3 / 2 / 4 pixels**, never contiguous,
  scattered at height-fractions 0.17 and 0.58. Fodder carry zero of it, which
  is the right instinct executed at 2% strength.
- The white ring is `(200,189,169)` L = 0.74 and costs 190 / 258 / 329 px per
  hero against hero sprite fills of 65 / 116 / 179 px — **2.9× / 2.2× / 1.8×
  the unit it identifies.**

**Targets:** (a) hero silhouette ≥ **1.5× fodder height at every register**,
including Large — that means 30 px at Large, not 23, and a silhouette event
(headgear, shoulder line, banner) that breaks the fodder profile rather than
just scaling it; (b) the hero-only accent as a **contiguous cluster ≥ 12% of
the hero's filled pixels** — 14 px at mid, 21 px at Large, not 2 and 4 — placed
in the **top third** of the sprite, where fodder highlights are sparse; today
the hero's bright pixels average height-fraction 0.48, dead centre, competing
with thirty-five other units' highlights; (c) re-run the same 5× crop test on
the unmarked frame afterwards — the hero must be findable in
`crowd-mid.png` with the marking off. Then the ring becomes reinforcement
instead of the whole signal, and it can shrink to ≤ 1× the unit's area.

*Runner-up, deliberately not in the top two because it is a direction decision
rather than an art fix:* resolve the conflict between the board's stated
48×64-at-1× character baseline and thirty-six units at 480×270. Holding both
requires roughly a 3–4× wider presentation (the Large crowd spans 372 px at a
15 px melee; at 48 px melee it spans ~1190 px). Somebody has to decide which of
the three — the baseline, the unit count, or the 480×270 frame — is wrong.

## What the artifact is flattering itself about

**1. That "three registers" is a trade-off study.** It is not. The linear range
from Small to Large is only **1.73×** (crowd span 216 → 372 px; hero height
13 → 23 px), and all three sit inside the same failing band — the largest is
still an order of magnitude below the board's own 48×64 baseline by area. This
framing turns "we are far too small everywhere" into "which of our three good
options?" The real question — does the drawing survive at the density the board
actually asks for — is never tested, because no register in this set reaches it.

**2. That the grayscale exports demonstrate value discipline.** They
demonstrate the opposite, and the artifact appears not to have read its own
evidence. `crowd-large-gray.png` shows two armies as one indistinguishable
texture. Shipping that image as supporting material rather than as a defect
report is the clearest sign the value plan was never checked.

**3. That phase-vs-variants is a meaningful fork.** Frame-for-frame the two
treatments differ by 3.1–4.4% of pixels; consecutive frames within either
differ by 8.4–9.8%. The A/B is inside its own noise floor. Presenting two
scheduling treatments implies the motion work has reached the point where
scheduling matters. It has not — the vocabulary is one idle bob on a 4- or
8-frame loop, with no attack, advance, reaction or death in evidence.

**4. That the filmstrips sample twelve frames.** They sample **eight**. Tiles
1–4 are byte-identical to tiles 9–12 in all four filmstrips. The presentation
overstates coverage by 50%.

**5. That outward-vs-inset is a design decision worth a pair of renders per
register.** The two differ by 0.06–0.1% of the frame. Meanwhile the real
finding hiding in those files — that the identification ring is 1.8–2.9× the
area of the unit it identifies, and that at Mid two rings merge into one
component — is not surfaced anywhere.

**6. That the loupes are craft evidence.** `fodder-adjacent-mid-6x.png` and the
4× loupes are the venue where these sprites look best, and they are exactly the
venue the direction tells the critic not to judge on-screen legibility from.
Zoom past them to 7–9× and the sprites stop being pixel art at all: scattered
1–2 px fragments, no cel clusters, no ink, no anatomy. The board asks for
"pixelation should shape the drawing, not erase the comic character." Here
there is no drawing under the pixelation to shape.

**7. That palette restraint equals cohesion.** 36–44 colours, a correct plum
anchor and no chartreuse creep are real achievements and I do not want them
undersold. But the artifact appears to be reading cohesion off the shared
palette while the actual break is the drawing language: black-inked flat planes
for the board, un-inked rim-lit render noise for the units, with no contact
shadow joining them. Sharing a palette with the ground is precisely why the
units disappear into it.

---

## Builder's verification, added after the fact (not by the critic)

Two checkable claims in this critique were checked. Both hold; one is sharper
than stated and one compares different pairs.

### 1. The tier-ratio regression is real, and it is worse than reported

The critique says hero:ranged height "drops from 1.38 at Mid to 1.15 at Large".
Measured on the sheet's own standing heights, that compares different pairs — the
1.38 is hero:melee, the 1.15 is hero:ranged:

| register | melee | ranged | hero | hero:melee | hero:ranged |
|---|---|---|---|---|---|
| small | 11 | 13 | 14 | 1.27 | **1.08** |
| mid | 14 | 16 | 19 | 1.36 | 1.19 |
| large | 18 | 21 | 24 | 1.33 | 1.14 |

The substance is right and the small register is worse than the critique found:
**the hero is 8% taller than the ranged fodder there.** This is a regression this
round introduced. Round 4 had both fodder archetypes at identical drawn height,
so `TIER_SIZE_BOOST = 1.28` produced a clean 1.27 against both. Round 5 lengthened
the marksman to part it from the brute on silhouette — and that height went
straight out of the hero's size boost. Archetype separation was bought with tier
separation, which is very likely why axis 3 scores 2 at every register.

The fix is arithmetic, not art: derive the hero's scale from the *tallest* fodder
archetype's measured height rather than from the tier's nominal one. Not done this
round; recorded rather than quietly left.

### 2. The marking ring fuses, at every register

Counting 4-connected components of the mark colour `#c8bda9` in the outward-marked
stills, with four heroes on screen:

| register | components | three largest |
|---|---|---|
| small | 10 | 336, 220, 172 |
| mid | 12 | 520, 284, 228 |
| large | 16 | 616, 368, 280 |

**Three large components for four heroes at every register**, plus a tail of small
fragments where a ring is broken by an occluding unit. Round 4 found this defect
at the small register and answered it with the inset mode; this measurement says
it is not a small-register problem, it is a *formation* problem, and it survives
at large. The inset mode does not fuse and both are baked, so the trade is still
visible in the gallery — but the outward ring should not be described as "fixed at
the large register", and round 4's implication that it was is corrected here.

### On comparing these scores with round 4's

Round 4's cold critique scored small 2/2/2/2/3 and large 3/3/3/4/4. This one
scores small 2/1/2/2/3, mid 3/2/2/2/3, large 3/3/2/2\*/2. The axes are the same
and the bar is the same, but **these are different critic instances reading
different image sets**, so the deltas are weaker evidence than the within-round
before/after measurements in `round-5-measurements.json`. Where the two agree —
that no register clears the bar, that the small register should be refused, that
the limit is angular size rather than authoring method — the agreement is worth
more than either score.

\* No large-register filmstrip was supplied to this critic; the motion score for
large is extrapolated and the critic flagged it. That is a gallery gap, not a
finding about the artifact.
