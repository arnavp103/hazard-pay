# Round 4 cost report — the ink budget, measured before and after

Config SMALL only. **Config LARGE is the control and was not touched**: it
renders byte-identical to round 3 across twelve configurations (crowd and
lineup × marked and unmarked × four clock phases), so its committed round-3
captures remain valid evidence.

Every number below comes from `crowd-sprites.ts` / `crowd-scene.ts` as
committed, measured on the authored grids and on the composited 480×270 stage
with a per-pixel ownership buffer, so "which unit owns this pixel and what
palette role is it" is exact rather than sampled by colour.

---

## 0. A correction to the premise, stated first

The brief for this round, inherited from the round-3 critique, is that the
22 px ranged fodder is **130 sprite pixels of which 88 are contour ink (68 %)**,
leaving 13 body-colour pixels.

That describes a **superseded revision**. The ink diet recorded in §4 of the
round-3 cost report landed later in the same round (interior ink demoted to
the darkest value of its own material: 103→77 and 85→69 ink cells). Measured
on round 3's *final* committed state, `4314ea9`:

| authored grid | filled | ink | ink share | coat-body px |
| --- | ---: | ---: | ---: | ---: |
| breaker-small (round 3) | 225 | 77 | **34 %** | 63 |
| stinger-small (round 3) | 183 | 69 | **38 %** | 25 |
| mara-small (round 3) | 326 | 100 | 31 % | 113 |

So the headroom entering round 4 was 34–38 % ink, not 68 %. The 68 % figure is
correct about the artifact the first cold pass judged and wrong about the code
this round started from. Everything below is measured against the 34/38 %
baseline, which is the harder comparison.

---

## 1. The measurement that changed the plan

The director's mid-round note — the Blender lane losing 53 % of its silhouette
edges into the floor's luminance band — was tested here before any ink was cut.

**It does not reproduce in this lane.** An edge pixel is defined as a unit
pixel with at least one four-neighbour belonging to no unit; dL is the luma
difference against that neighbour, on the composited stage:

| round 3, Config SMALL | edge px | median dL | dL < 12 | dL < 20 |
| --- | ---: | ---: | ---: | ---: |
| breaker | 524 | 28.1 | **4 %** | 7 % |
| stinger | 633 | 32.8 | **7 %** | 18 % |
| hero | 80 | 28.1 | 0 % | 0 % |

The reason is palette, not luck: this lane's contour is plum-black `#120b10`
at luma **12.8**, and the board under the units sits at median luma **40.9**
(p10 33, p90 54). That is a 28-level gap by construction. The baked lane's
contour is a quantised render of a lit 3D edge and lands *inside* the floor's
band; a hand-authored ink anchor does not.

**Two consequences, and the second is the one that mattered:**

1. A uniform 1 px contour was spending most of its pixels on a figure/ground
   problem this lane does not have.
2. What the ink *was* buying is unit-versus-unit separation. **53 % of all
   silhouette-boundary pixels abut another unit rather than the board.** That
   is this lane's version of "half the outline is not doing what you think",
   and it is a crowd-density problem, not a board-contrast problem.

**Reported as a first-class negative:** board contrast is *not* the dominant
term for the pixel lane, and nothing here argues for changing the shared
grime-market board. The environment lane's finding may still be right on its
own terms; it is not what is limiting Config SMALL.

## 2. Why the obvious fix was wrong, measured

The first implementation cut contour by *direction*: ink the contact edge and
undersides, rim-light the lit edge, leave the shadow edge to value contrast.
It cut ink hard — breaker 34 % → 16 %, stinger 38 % → 25 % — and it made the
drawing worse:

| dissolving edges (dL < 12) | round 3 | blind selective contour |
| --- | ---: | ---: |
| breaker | 4 % | **26 %** |
| stinger | 7 % | **20 %** |

Cutting ink by direction removes the pixels that were working alongside the
ones that were not. The rule the evidence actually implies is the opposite,
and it is exactly the director's: **ink only where the unit meets a
similar-value background.**

## 3. What shipped: a background-aware contour

The SMALL grids are now authored as *material only* — zero contour cells. The
contour is a paint step (`contouredRows`) that compares every silhouette edge
against the **composited** pixel it lands on:

- separated by ≥ `CONTOUR_MIN_CONTRAST` (22 luma) → keep the material;
- too close and the unit is the lighter of the two → rim-light it one step up
  its own material ramp, lit edges only, so light direction still reads;
- too close otherwise → plum-black ink;
- the contact zone (bottom 18 %) is always inked — that edge is grounding, not
  separation;
- focal roles (metal highlight, emission, wear) are never inked.

Because it samples the composited stage rather than the board, it also settles
unit fusion: a near unit landing on a same-value neighbour inks itself against
it, and one landing on a darker back rank does not spend the pixel at all. A
separate overlap halo was built first and then deleted as redundant.

### Ink budget, before and after

**Authored grids** (what a human or agent draws):

| grid | filled | ink | ink share | coat-body px |
| --- | ---: | ---: | ---: | ---: |
| breaker-small round 3 | 225 | 77 | 34 % | 63 |
| breaker-small **round 4** | 220 | **0** | **0 %** | **81** |
| stinger-small round 3 | 183 | 69 | 38 % | 25 |
| stinger-small **round 4** | 154 | **0** | **0 %** | **48** |

**As rendered on the stage**, per unit, occluded pixels excluded — the honest
number, because the runtime contour has to be counted:

| kind | drawn/unit | ink/unit | ink share | material/unit |
| --- | ---: | ---: | ---: | ---: |
| breaker round 3 | 120.4 | 40.8 | **34 %** | 79.7 |
| breaker **round 4** | 164.5 | 33.6 | **20 %** | **130.9** |
| stinger round 3 | 160.3 | 58.8 | **37 %** | 101.5 |
| stinger **round 4** | 124.2 | 37.5 | **30 %** | 86.7 |
| hero round 3 | 412.5 | 148.3 | 36 % | 264.3 |
| hero **round 4** | 398.5 | 141.0 | 35 % | 257.5 |

Read this honestly. The melee unit gained **+64 % material pixels** at a
14-point lower ink share. The ranged unit's ink share fell 7 points but its
*total* mass fell too, because the archetype contract required it to get
narrower — its coat-body count still nearly doubled (25 → 48 authored), which
is the "13 → ~50" the brief predicted, but it bought that by giving up bulk
rather than by converting ink. The ranged unit is the weaker half of this
result and it is fair to say so.

### And the dissolve check, after

| dissolving edges (dL < 12) | round 3 | round 4 |
| --- | ---: | ---: |
| breaker | 4 % | **1 %** |
| stinger | 7 % | **0 %** |
| hero | 0 % | 0 % |

Median edge contrast rose from 28.1 → 29.6 (melee) and 32.8 → 37.5 (ranged).
Unit-to-unit contact fell from **53 % → 40 %** of boundary pixels.

## 4. Shape language — the archetype contract

| | round 3 | round 4 |
| --- | ---: | ---: |
| melee widest run / figure height | 0.68 | **0.77** |
| ranged widest run / figure height | 0.64 | 0.68 |
| melee median body run | 11 px | 11 px |
| ranged median body run | 9 px | **8 px** |
| **body-mass width ratio** | **1.22×** | **1.38×** |
| ranged weapon protrusion beyond body | 5 px | **7 px** |
| aligned silhouette Jaccard distance, SMALL | 0.361 | **0.395** |
| aligned silhouette Jaccard distance, LARGE | 0.451 | 0.451 (control) |

Melee lost its shield slab (now a 3 px buckler boss) and gained shoulder span;
ranged narrowed and gained a 14 px rifle line that breaks the outline on both
sides. SMALL closed roughly a third of its gap to LARGE on mask overlap and
gained more than that on the cue that actually survives 22 px inside a clump,
which is body-mass proportion plus one protrusion.

**A measurement correction worth recording.** Round 3's committed Jaccard test
compared the two masks in raw grid coordinates. That is only valid while both
archetypes share a canvas width; SMALL's melee canvas widened from 16 to 18 in
round 4, and the un-aligned metric then reports **0.498** for SMALL — a pure
artifact of the grids no longer lining up. The test now aligns both masks on
the painter's own anchor (grid-width centre, contact row). The 0.395 above is
the aligned number and it is the one to quote.

Also on record: the director's correction to [#69](https://github.com/arnavp103/hazard-pay/issues/69)
noted the "Jaccard 0.36 vs 0.45" figure could not be located in any committed
artifact. It is in a committed artifact — `crowd-sprites.test.ts`, as an
executable assertion — just not in the screenshots directory. Round 3's agent
was quoting a real, test-pinned measurement.

## 5. Depth, staging, marking, motion

| | round 3 | round 4 |
| --- | ---: | ---: |
| distinct coat-base values on stage | **1** | **3** |
| archetype mean-x separation (0–1 within a clump) | **0.20** | **0.01 / 0.02** |
| marking pixels per hero | 151 | **121** |
| marking area / fodder unit area | 0.74× | **0.57×** |
| ring share of all bright (L>140) pixels | **54 %** | **21 %** |
| hero visible mass / melee fodder, unmarked | 1.33× | **1.41×** |
| max fodder bob, peak-to-peak | 1 px + lean | **1 px**, damped lean |

**Staging.** The round-3 critique's sharpest methodological catch was that
every ranged unit was staged at the rear-outer edge of its clump, so the
archetype read was positional rather than silhouettic. The SMALL formation is
now built so archetype is *exactly* decorrelated from both screen axes: melee
and ranged each occupy 8 slots with rank sum 8 and file sum 20, and a unit's
screen position is `(rank − file)·halfW` across and `(rank + file)·halfH` down,
so equal sums make the two archetypes' means identical by construction. A test
pins the construction, not the consequence.

**LARGE keeps the round-3 staging**, because it is the control and must stay
byte-identical. The test asserts both facts — SMALL's separation < 2 px, LARGE's
> 6 px — so the leak is *recorded* rather than quietly fixed. The consequence
for the SMALL-vs-LARGE side-by-side is that LARGE still has the positional
crutch and SMALL does not, which biases that comparison **against** SMALL.

**Control repair.** The round-3 critique found three hero-only colours doing
the tier separation the experiment attributed to size and density. At SMALL the
hero's palette is now a strict subset of its own faction's fodder palette (the
tan visor takes the faction highlight, the cyan specular takes the teal that
stinger fodder carry), pinned by test. This is confound removal, not a
redesign — the hero sprite remains the throwaway placeholder, unpolished, per
direction. **LARGE still leaks** (`M P s u w` are hero-exclusive there); it is
the control, so the leak is stated rather than fixed.

## 6. Authoring cost

| | round 3 SMALL | round 4 SMALL |
| --- | ---: | ---: |
| authored cells, 3 grids | 734 | 700 |
| of which contour | 246 | **0** |
| runtime contour cost | — | one edge walk + one luma compare per edge pixel |

The two SMALL fodder grids were fully re-authored: **374 cells redrawn**, plus
the runtime policy. Against the round-3 roster extrapolation the per-grid cost
is essentially unchanged (700 vs 734 cells), so the 20-unit roster figures in
the round-3 report still stand: **SMALL ≈ 68 k authored cells against LARGE's
≈ 167 k, a 2.4× difference**. Nothing in round 4 moves that ratio — the ink
budget was re-spent, not enlarged.

The contour moving to runtime is a genuine authoring saving that this report
deliberately does **not** bank: it removes 246 cells of drawing per three
grids, but it also means the outline is no longer a thing an artist controls
per pixel, and that trade has not been tested on a unit whose silhouette needs
a deliberate broken contour.

## 6b. A regression this round shipped, found by the cold pass, and fixed

The first round-4 build shipped the depth ramp and the marking together, and
the ramp ate the marking. The cold critique measured it: the marking's bright
stroke down 18 % on both sides (171 -> 141 and 125 -> 103), the cool faction's
ring down **60 %** in pixel count (158 -> 63), and hero finding at 1x down from
round 3's 4-of-4 to **2-of-4**. Both heroes sit in the back depth bands, so
they took the worst of a change that was supposed to help the crowd.

The bug is conceptual rather than arithmetic. Depth falloff is aerial
perspective applied to *material*; the marking is not material, it is an
affordance drawn on top of the world the way a health bar is, and it should
read at the same strength wherever the unit stands. `markingPalette` now
returns the undimmed faction palette and the ramp applies to the unit's own
pixels only.

Two smaller corrections went in with it, both from the same critique:

- the depth mix softened from `[0, 0.20, 0.36]` to `[0, 0.16, 0.28]`, because
  the ramp had also cost the whole crowd unit-versus-floor separation
  (31.1 -> measured back up after the change);
- the idle gain raised from 0.62 to 0.82. The brief asked for the SMALL bob to
  be damped because it was eating the hero's 6 px height advantage; the cold
  pass measured that the damping over-shot, taking mean per-unit amplitude
  from 2.64 px to 1.73 px and leaving "a 1-2 px breathe and no vocabulary at
  all". With the marking carrying the tier read, the height cue no longer has
  to be protected that hard. Motion is still the weakest axis and the real
  complaint - no weapon sway, no weight transfer, no secondary motion - is a
  vocabulary problem this round did not attempt.

After the fix the ring carries **21 %** of the frame's bright pixels, against
round 3's 54 % - present again, no longer monopolising the top of the value
range.

## 7. Known pipeline artifact, unchanged on purpose

The captures are not palette-indexed: `hp-noise` on the prototype page is a CSS
`::after` film-grain overlay that lands on the canvas, which is where the
round-3 critique's "±2 grain" came from. It is a *page* artifact, not a render
artifact — the headless renderer produces exact palette values. It was left in
place so round 3 and round 4 are captured under identical conditions, which the
side-by-side depends on. Any later pass keyed on exact colour should capture
from the renderer, not the page.
