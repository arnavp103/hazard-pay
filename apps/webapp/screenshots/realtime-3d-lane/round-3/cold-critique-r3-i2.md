# Cold critique — round 3, iteration 2 (r3-i2) — realtime-3d-lane, crowd register

SCORES r3-i2: gritty 3/5 · silhouette 4/5 · material 4/5 · cohesion 4/5 · motion 4/5 ·
tier separation — **unmarked far 1/5, unmarked near 2/5, marked far 3/5, marked near 4/5**
(round 2 final: 4·4·4·4·4, single hero at ~64–70 px — r3-i1: 3·4·4·3·2, tiers 1/2/3/4)

**Provenance:** judged only from the 31 image artifacts in this `round-3/` directory plus
`measurements.json` and `COST-REPORT.md`; the reference-board README; and the two prior
critiques (`round-2/cold-critique-r2-i3.md`, `round-3/cold-critique-r3-i1.md`) for score
continuity only. Specifically opened: `crowd-{far,near}-{marked,unmarked}.png` and all four
`gray-crowd-*` twins, `contrast-{far,near}.png`, `lineup-{far,near}.png` + both gray twins,
`hero-still.png`, `hero-loupe.png`, `loupe-{far,near}-{marked,unmarked}.png`,
`filmstrip-{idle,attack,turn}.png`. Both `crowd-motion-*.gif` were decomposed with
`ffmpeg -i <file> /tmp/c2/%03d.png` (24 frames each) and analysed numerically. Every hex
value, pixel count, bbox and ratio below was sampled off these files with PIL/scipy. No
`.ts`/`.tsx` source, no git history, no issue or PR, no other directory was opened.

**How the test changed.** Round 2 judged one medic at 64–70 px on a board deliberately
dirtied for that round. Round 3 judges 40 units at 22 px and 35 px on the untouched shared
board. Where that scale change is what drives a number I say so rather than letting it
silently deflate the score.

---

## The blind hunt — reported before I opened anything marked

I opened `crowd-far-unmarked.png` and `crowd-near-unmarked.png` at 1:1 (480×270) first, with
no knowledge of what a hero looks like.

**Pass 1, 1:1, both registers: 0 of 4 found.** Not "found the wrong ones" — I had no
candidate to guess at. The eye is pulled immediately to the two helmet masses: coral
`#FF9D6E` (S=1.00, L=0.72) and ice `#D3FFFF` (S=1.00, L=0.91). Those are fodder. The only
thing in either frame that looked like a singular actor was a lone brown figure at far
`(302,132)` — I magnified it 16× and it is a scenery prop (a crate/bollard stack, no faction
colour). A distractor, not a hero.

**Pass 2, at 7–8× nearest-neighbour, still blind (no lineup, no marked image): near 4 of 4,
far 2 of 4 confidently.** Near candidates: `(184,108)`, `(238,71)`, `(250,170)`, `(288,137)`.
The rings later landed at `(185,124)`, `(235,76)`, `(246,186)`, `(291,140)` — all four
correct. **The cue I used was pure absence: a dark head where a bright helmet should be.**
Not size, not equipment, not stance.

**Pass 3, grayscale unmarked:** worse. The absence cue depends on the plum-vs-black hue
difference between a hero helmet and a shadow; grayscale removes it. In
`gray-crowd-near-unmarked.png` the orange formation's heroes are dark blobs among dark
bodies. I would not have found them cold.

**Pass 4, marked:** trivial at both registers in colour. This is the entire story of this
lane — the ring is doing 100% of the work, and I show the measurement for that under Tier
separation.

---

## 1. Gritty / dangerous / lived-in — 3/5 (held from i1, DOWN from r2's 4)

Unchanged, and unchanged for the reason i1 gave. `hero-still.png` shows flat salmon roof
planes, flat plum wall planes (`#43313E`), hard-edged near-black window slots (`#120B10`),
thin amber trim strips, and three clean cardboard crates with no dents, scuffs or stains.
None of the specific marks that moved this axis 3→4 in round 2 — rust streaks down the wall,
a lighter patched panel inset low, a darker base band at the wall/floor join — are on this
board. The floor is a tidy grid at `#332733` (L=47/255, 18%).

What holds it at 3 rather than 2 is genuine: the low-key palette discipline, the sagging
cable lines strung between the two buildings, the knocked-over drum, and above all the
formations themselves. Forty shield-and-rifle figures packed into a block is menacing in a
way one medic was not — massing is doing real dramatic work here.

`COST-REPORT.md` line 105 says the board is the untouched control all four lanes are judged
against. I accept that as an explanation and not as a score; a viewer sees a clean graphic
diorama with dangerous shapes standing on it.

**Cap: POLISH, blocked on a scope decision.** Round 2 proves this lane knows how to dirty a
facade. Nothing structural prevents it. This axis cannot move until whoever owns the shared
board allows it to be dirtied.

## 2. Silhouette + equipment readability — 4/5 (held)

**The hero head rebuild is real and it verifies.** The brief said the rig was rebuilt to fix
a head occluded by its own chest and shoulders. Scanning `hero-loupe.png` row by row, the
non-background width goes 36 px at y=170, 34 at y=174, 42 at y=178, then 70 at y=182, 96 at
y=190, peaking at 114 at y=218. That is a clean narrow-mass-above-wide-mass step of
2.6–3.2×: the helmet cube reads as a separate volume sitting above the shoulder line, with
visible background between the head and the right pauldron. **Front-facing cue: present** — a
teal visor stripe on the helmet's forward-left face, plus the weapon held forward-low and the
asymmetric pauldron. `filmstrip-turn.png` confirms the silhouette is genuinely directional:
22% swing in unit-pixel area across 16 frames as the figure rotates, which cannot happen on a
radially symmetric rig.

**The fodder archetypes part cleanly**, and this remains the strongest result in the set.
Within one faction, silhouette IoU is 0.616 between the shield brute and the marksman and
0.640 between hero and marksman — genuinely different forms, not recolours. The
discriminators are a bright grey shield slab and a near-white barrel line, both high-value
marks that survive the downscale and survive grayscale untouched.

Held at 4, not 5, by two things. First, **there is no ink contour.** The reference board's
first comic-book bullet is "ink-like outer contours and clean internal separations"; the
units have only shading-derived edges, and the measured consequence is under Cohesion —
34.3%/27.5% of contour dissolving into the floor. Second, at 22 px the equipment read
collapses to "bright slab / bright line / dark body" — three tokens, which is honest but
thin. **Cap: POLISH for the missing contour** (a 1 px outline pass is cheap and does not
touch the shared board); **STRUCTURAL for the 22 px register itself.**

## 3. Material separation — 4/5 (held)

At loupe register the cel material vocabulary is real and separable. Sampled from
`hero-loupe.png`: plum armour `#43313E` (L=59) with lit face `#5E3E4B` (L=77) and top face
`#764F5D` (L=97); a distinctly separate sage-green pack/torso wrap family `#646D64` (L=103),
`#525A53` (L=85), `#383C3A` (L=58); rust-orange kit `#964332` (L=89); near-black shadow
`#120B10` (L=15); and bright metal in the boot caps and barrel. That is five families that do
not bleed into each other — flat cel clusters, which is what the board asks for.

At the crowd registers it compresses to value clusters: helmet, shield slab, barrel, dark
body. That is a register limit rather than an art failure, and I am not deducting for it
twice. Held at 4 because metal is thin outside the caps and barrel and the flat facets carry
no micro-detail. **Cap: STRUCTURAL at 22 px** — there are not enough pixels for a fourth
material to survive.

## 4. Cohesion — 4/5 (UP from i1's 3)

**The axis as posed passes decisively, and I measured it rather than eyeballing it.** I ranked
every pixel in both crowd stills by saturation × luminance. The top ten in each frame are all
unit pixels: `#FFFBFA`, `#D3FFFF` (S=1.00, L=0.91), `#C9F4FD`, `#BFE8FA`, `#FF9D6E` (S=1.00,
L=0.72), `#FF966C`, `#FE9E6F`, `#FF8F67`. The environment's dominant colour is `#332733` at
S=0.13, L=0.18, occupying 56,920 of 129,600 px (44%) of the near frame; the next seven most
common colours are all likewise desaturated plums at S≤0.24. There is no environmental mark
anywhere near the units' chroma. The units own the peak outright.

The counterweight, and the reason this is 4 and not 5: **roughly a third of the silhouette
dissolves.** `measurements.json` reports 34.29% of 2,715 contour px at the far register and
27.46% of 4,625 at near, and both numbers reproduce exactly off `contrast-*.png` (see the
defect table). Median contour-vs-ground ΔL is 22.0/255 far and 23.7/255 near. Units that own
the chroma peak but lose a third of their outline are cohesive in hue and leaky in shape.

One thing I am deliberately **not** double-counting here: within the unit set the hierarchy is
inverted — fodder owns the chroma peak and the hero owns the floor. That is a tier-separation
failure and it is scored there, at full weight. Judged strictly as "does the unit own the
chroma peak against the environment", this is a clean pass. **Cap: POLISH** — an ink contour
closes most of the dissolve without re-valuing the shared board.

## 5. Motion — 4/5 (UP from i1's 2)

i1 scored this 2 on a single finding: both GIFs were 24 pixel-identical frames. That is
comprehensively fixed, and the replacement is better than merely "not frozen".

- **Both GIFs are 24/24 pixel-distinct frames.** Inter-frame deltas run 889–1,265 px (far)
  and 2,240–3,056 px (near), every frame, no repeats.
- **The motion is desynchronised, not unison.** I tracked individual helmet-cube centroids
  across all 24 frames and took the FFT phase of each unit's dominant oscillation, then
  computed phase concentration R (1.0 = perfect unison, 0 = fully desynced). Near cyan
  formation, 13 tracked heads: **R = 0.09**. Far cyan: **R = 0.21**. Orange: R = 0.54 (near)
  and 0.70 (far) — more clustered, but nowhere near unison. Individual phases are scattered
  across the full circle (e.g. near cyan: −89°, −114°, −38°, +122°, +171°, +80°, −35°, −120°,
  +141°, +29°, +87°, +78°, −143°). These are not synchronized toys.
- **Every unit moves.** A per-pixel temporal standard-deviation map over the 24 frames lights
  up both formations completely — the moving region is a single cluster spanning
  x[149..262] y[56..147] (orange, near) and x[222..347] y[126..214] (cyan, near). No frozen
  units; four zero-amplitude tracks in my first pass were blob-merge artifacts in the tracker,
  not static geometry, and the variance map disproves them.
- **The attack is properly structured.** `filmstrip-attack.png`, 12 frames: wind-up f02–f04,
  a genuine **hold at f04/f05 (pixel-identical, vs_prev = 0)**, commitment f06, strike at f07
  where the centroid jumps 4.8 px left and 8.0 px down, then five frames of decaying recovery
  (deltas 1202 → 1010 → 1151 → 1006 → 1019). Anticipation, hold, strike, recovery — that is
  comic timing and the board asks for it.
- **The turn is genuinely acted**: 22% unit-area swing, 8.6 px centroid travel over 16 frames.

Held off 5 by three things, all concrete. **The idle is near-static** — over 12 frames of
`filmstrip-idle.png` the centroid travels 1.0 px vertically and 1.2 px horizontally, with a
7% area swing, on a figure rendered 134 px tall. At board scale that is a 0.7–1.9 px head bob
on a 22 px unit, i.e. sub-pixel shimmer. Idle is the state on screen for most of an
auto-battler match, and the reference board's own `match-proto-idle.gif` caption says
explicitly *do not inherit "minimal motion as an aesthetic target"*. **The loop is not
seamless** — frame 24 differs from frame 1 by 2,853 px (far) and 7,227 px (near), which is
~3× a normal inter-frame step, so the cycle visibly pops on wrap. **The strike has no impact
hold** — f07 is a single frame and recovery starts immediately, where round 2 was explicitly
credited for a hit-stop. **Cap: POLISH on all three** — amplitude curves, loop endpoints, and
one held frame.

**Capture gap:** both `crowd-motion-*.gif` are the **marked** variant (frame 1 contains 676
ring-orange and 473 ring-cyan px, and black corners). There is no unmarked motion capture in
the set, so whether the unmarked crowd reads as alive cannot be judged from these artifacts.

## 6. Tier separation — unmarked far 1 · unmarked near 2 · marked far 3 · marked near 4

**The root cause, measured.** This is the most important number in the critique:

| element | luminance (0–255) | vs ground |
|---|---:|---:|
| ground / board floor | 47 | — |
| **hero head, all four, both registers** | **44 – 69** | **≈ 0 – 22** |
| orange fodder helmet | 145 | 98 |
| cyan fodder helmet | 230 | 183 |

**The hero's identifying mark is that its head is the same value as the dirt.** Fodder
out-contrasts the hero against the board by 4–8×. The most important unit on the field owns
the lowest local contrast on the field, and is legible only as a hole in an otherwise bright
row of helmets. That is why the 1:1 blind hunt returns 0/4, and it is not a resolution
problem — it is a hierarchy that points the wrong way. It also means the cue is identical for
both armies, which is why it dies in grayscale.

**Unmarked far — 1/5. STRUCTURAL.** 0/4 at 1:1. At 8× the only cue is the dark-head absence.
Hero screen height is 1.25× fodder (`COST-REPORT.md`), but measured screen *mass* is 0.94× —
the hero fills fewer cells than a shield brute despite standing taller, so the size boost buys
nothing at this register.

**Unmarked near — 2/5. STRUCTURAL.** 0/4 at 1:1; 4/4 at 7×, blind, which is better than i1
managed (3/4, and only after studying the lineup). Credit where due: the improvement is real
and comes from the occlusion fix. But the axis is about the play register, and at the play
register it is still 0/4 on the same inverted cue.

**Marked far — 3/5. Held; correctness restored, legibility unmoved.** All four rings now
enclose a unit (see defect 3). But at 22 px a ring is a 16–22 px blob carrying no tier
information beyond "this one", and in grayscale the marking is weak-to-invisible: orange ring
= 137, which is **darker than the fodder helmet it is meant to lift the hero above (143)** and
indistinguishable from the lit facade behind it (135). i1 reported 138/142/169 for these; the
values are unchanged.

**Marked near — 4/5. Held.** At 35 px the rings read instantly in colour. On the ring-quality
question: **the ring traces the outer silhouette, not internal limb crossings** — it does not
make the hero read busier than fodder, which was the specific worry. It is a dilated outer
contour and it is a single closed loop in all eight cases. It is not clean, though: every ring
carries a lumpy protrusion where the weapon arm extends (clearest in `loupe-near-marked.png`,
a bulge-and-return on the hero's right around the cyan weapon element), so the outline reads
as a blob with a wart rather than a humanoid. In grayscale the cyan ring (168) survives
against charcoal bodies; the orange ring (137) largely does not.

---

## Verdict table — the four i1 defects

| # | Defect (i1) | Verdict | Evidence |
|---|---|---|---|
| 1 | Both `crowd-motion-*.gif` were 24 pixel-identical frames | **FIXED** | 24/24 pixel-distinct frames in both. Inter-frame deltas 889–1,265 px (far), 2,240–3,056 px (near). Desynchronised, not unison: per-head FFT phase concentration **R = 0.09** (near cyan, 13 heads), 0.21 (far cyan), 0.54/0.70 (orange); phases scattered across the full circle. Temporal-variance map shows every unit in both formations moving. Caveats: amplitude is small (1–3 px on 35 px units, 0.7–1.9 px on 22 px), the loop is not seamless (f24→f01 = ~3× a normal step), and both GIFs are the **marked** variant so no unmarked motion capture exists. |
| 2 | Both factions' heroes were the same model in the same palette | **PARTLY FIXED** | *Palette: fixed.* The heroes now carry clearly different accent families (orange pauldron/chest/knee vs pale-cyan), mean RGB difference **188.6** across the figure. *Model: not fixed.* Cross-faction hero silhouette **IoU = 0.939** — the same mesh. For contrast, within one faction hero-vs-fodder IoU is 0.640, so the *tiers* genuinely differ in form and the *factions* do not. *Grayscale: largely does not survive.* Mean grayscale difference is only 46.8/255 and it is a global value-key shift (faction A mid-grey, faction B near-black with white accents), so in `gray-lineup-near.png` they read as the same soldier under different lighting, not as two armies. At crowd scale it collapses further: both factions' heroes are marked by the identical cue, a dark head. |
| 3 | Marking ring had no depth test — ring drawn over a wall with nothing inside | **FIXED** | All 8 rings (4 per register) are single closed connected components; interiors are 75–83% non-ground content, so **every ring has a unit in it** and none falls on a building. The mechanism is verifiably live: the projection is orthographic — fully-visible fodder helmets measure a constant 11×10 px at y=145 and at y=172 alike — yet within one formation the front hero's ring is 32×47 px and the back hero's is 23×30 px. Under an orthographic camera that difference cannot be perspective, so the short rings are **occlusion-clipped to the hero's visible upper body**. *Caveats:* no hero in this set stands behind a building, so the exact i1 scenario is not re-staged, and the formations were re-placed between iterations. *Correction to my own first read:* I initially took the ring overdrawing nearer `#D3FFFF` fodder helmets as a depth failure; it is the outward dilation of an outline, which is correct behaviour. |
| 4 | Board-contrast measurement traced only the outer blob boundary | **FIXED** | `contrast-*.png` now traces every unit individually, and the reported numbers reproduce **exactly** off the pixels: far green 1,784 + red 931 = 2,715 = reported `edgePixels`, red share **34.29% = reported `dissolvedPct`**; near 3,355 + 1,270 = 4,625, **27.46%**. `edgePixels`/`outerEdgePixels` = 4.20× (far) and 4.11× (near), matching the report's "four times as many pixels" claim. Interior edges dissolve slightly worse than outer ones (34.3 vs 33.6 far; 27.5 vs 24.6 near), the expected direction. Cleanest fix in the set — honest and independently verifiable. |

### New defect found this iteration (not in i1)

**The marked and unmarked captures are not the same render.** The marked frames clear
off-board to pure `#000000` (49,743 black px in `crowd-far-marked.png`); the unmarked frames
clear to the floor tone `#332733`. In the far pair **39.0% of the frame differs** for this
reason alone. `COST-REPORT.md` line 123 states "The capture clears to the floor's own tone so
this does not read as a hole" — true of the unmarked captures, false of the marked ones, which
show hard black diamond corners that are exactly the hole the report says does not occur. It
also means the marked/unmarked A/B is not a controlled comparison: the marked frames get a
black surround that flatters their contrast.

## What I would fix first, ranked

1. **Invert the hero cue.** The hero head is L=44–69 against ground L=47 while fodder helmets
   are L=145/230. Give the hero the brightest, most saturated mark on the field — plume,
   emitter, banner, lit visor — so it owns the local contrast peak instead of the floor. This
   single change is what turns the 1:1 blind hunt from 0/4 into something, and it is the only
   fix on this list that moves *four* scores (both unmarked tiers, and it de-risks both marked
   tiers from total ring dependence). STRUCTURAL.
2. **Give the two factions' heroes different silhouettes.** IoU 0.939 is one mesh recoloured.
   The board asks for "exaggerated silhouettes" and identity "through silhouette, stance, and
   local material palettes"; the Kingdom Rush and Quasimorph captions both warn against exactly
   this. The tier meshes already differ (IoU 0.616–0.640) — the technique exists in the lane,
   it just has not been applied across factions.
3. **Add the ink contour.** The board's first comic-book bullet, absent, and directly
   responsible for 34.3%/27.5% of contour dissolving into the floor. A 1 px dark outline pass
   is cheap and, critically, **does not require touching the shared board** — so it is the one
   readability fix not blocked on the board-ownership decision.
4. **Give the ring a value backup.** Orange ring at grayscale 137 is darker than the fodder
   helmet (143) it is supposed to lift the hero above, and matches the lit facade (135). Add a
   dark inner halo or raise the ring's value so the marking survives desaturation.
5. **Fix the marked-capture clear colour, and ship an unmarked motion GIF.** Both are capture
   hygiene, both cheap, and until the first is fixed the A/B boards are not controlled.
6. **Raise the idle amplitude, seal the loop, hold the impact frame.** 1.0 px of centroid
   travel over 12 frames is the "minimal motion" the board explicitly says not to inherit; the
   cycle pops on wrap; the strike has no hit-stop where round 2 was credited for one.

## Does this lane clear the bar it cleared in round 2?

**Not on round 2's terms — but the comparison is not like-for-like, and the honest answer has
two halves.**

Round 2 passed with 4/4/4/4/4 and no axis below 4. This set has gritty at 3 and tier
separation at 1 and 2 unmarked, so on a strict reading it does not clear.

The half that deserves saying plainly: **on the four axes that are genuinely comparable —
silhouette, material, cohesion, motion — this lane holds 4/4/4/4, which is the round-2 result
delivered at 40× the unit count and a third of the unit size, on a board it was not allowed to
touch.** Grit is down for a reason that is documented, external, and explicitly out of this
ticket's scope. That is a real engineering and art achievement and it should not be buried
under the tier number.

The half that decides it: **round 3 introduced a bar round 2 never tested, and this lane does
not clear that one.** At the actual play register a player cannot find the hero without the
ring — 0 of 4, twice, at both registers — and the reason is not that 22 px is too few pixels.
It is that the hero is currently marked by *removing* its faction colour, so the unit the
player most needs to track is the darkest, lowest-contrast, lowest-chroma thing on the board,
identical in cue between the two armies, and invisible in grayscale. The ring is carrying the
entire tier read, and a marking overlay that costs +1,784 draw calls and more than doubles the
frame is compensating for an art decision, not enhancing one.

Three of the four i1 defects are genuinely fixed and the fourth is half fixed; the measurement
harness is now honest and independently verifiable, which is worth a lot. Fix the hero's value
and chroma and this lane clears comfortably at the next iteration — that one change is
upstream of almost everything still holding it back.
