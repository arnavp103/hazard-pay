# Cold critique — register A vs register B, playback 1/2/3

Judged against `docs/art-direction/reference-board/README.md` (comic-book pixel art;
Warped City density; "avoid dropping toward ultra-low-resolution roguelike or
icon-like rendering"; Direction B palette as comparison baseline).

Stills judged at the shipping presentation (480×270, viewed 1:1). Motion judged
from the filmstrips first, then cross-checked frame-by-frame against the 36-frame
GIFs numerically rather than by watching cadence.

---

## Scores

| Axis | Register A | Register B |
|---|---|---|
| 1. Crowd legibility | **2** | **3** |
| 2. Archetype separation | **2** | **3** |
| 3. Tier separation | **2** | **3** |
| 4. Crowd motion (best treatment) | **2** | **4** (playback 3 only) |
| 5. Cohesion with the board | **3** | **4** |

Bar is 4 everywhere. **Register A clears nothing. Register B clears two axes.**

## Headline verdict

**Ship at register B — and do not ship yet.** B is the only register where a unit
is a figure rather than a mark, and it is the only register where the playback-3
work is visible. But B as drawn misses the bar on three of five axes, and all
three misses have the same root cause: faction, archetype and tier are carried by
a handful of low-contrast *colour* pixels instead of by silhouette. Register A is
not a smaller version of the same problem — it is below the floor of the stated
direction and cannot be rescued by any playback treatment.

If the choice is forced today: **register B + playback 3.** If the choice can wait
one iteration, B + playback 3 + a silhouette pass is the cheap fix, because the
motion system is already right and the palette/board integration is already right.

---

## Measured sizes (this contradicts the brief — read this first)

The brief states A fodder ~22 px / heroes ~28 px, B fodder ~36 px / heroes ~46 px.
Measured drawn heights in the 480×270 viewport:

| | melee fodder | ranged fodder | hero |
|---|---|---|---|
| Register A | **10×16 px** (5×8 art px) | **6×16 px** (3×8 art px) | **12×24 px** (6×12 art px) |
| Register B | **18×34 px** (9×17 art px) | **14×32 px** (7×16 art px) | **20×44 px** (10×22 art px) |

Drawn (non-transparent) area and colour count per unit, ladder pose:

| | drawn screen px | distinct colours |
|---|---|---|
| A melee | 104 (26 art px) | **5** |
| A ranged | 60 (15 art px) | **2** |
| A hero | 152 (38 art px) | 8 |
| B melee | 396 (99 art px) | 13–14 |
| B ranged | 260 (65 art px) | 11–13 |
| B hero | 528 (132 art px) | 14–17 |

Two consequences:

1. **Register B is within 2 px of its stated size; register A is 6 px short of
   its stated size.** The real ratio between the registers is **2.13×**
   (34 px ÷ 16 px), not the 1.64× the stated numbers imply. This is not a modest
   step between two nearby options; it is a doubling, and the two registers should
   not be discussed as neighbours.
2. **A register-A ranged fodder is 15 art pixels drawn in 2 colours.** That is an
   icon. The reference board names icon-like rendering as the thing to avoid by
   name, and names Warped City as the density floor. Register A is below that
   floor by a wide margin; register B is at the low edge of it.

---

## Axis 1 — Crowd legibility

**Register A — 2.** The armies are separable, but only because they are staged
apart: faction-1 colour pixels stop at x=221 and faction-2 colour pixels start at
x=266, a 45 px empty gap. Nothing in the drawing does that work. Inside each mass,
36 units resolve into **18** separable mid-tone clusters — one readable shape per
two units. The filmstrips confirm it: at 2× magnification the units are still dark
lozenges with white and cyan specks on them. This is texture with sparkle, not a
crowd. It reads as grime on the floor plane.

**Register B — 3.** Individuals work: 36 units produce **36** separable clusters.
I can count bodies, see who is in front of whom, and see the shape of each
formation. The army boundary is the weak half — the gap between the two colour
populations is 59 px, so again the staging is doing it. Interpenetrate these two
armies (which an auto-battler will) and the only remaining cue is a torso colour
difference of ΔE76 = 10.0 with a 2.2/255 luminance difference. Not a 4.

## Axis 2 — Archetype separation

**Register A — 2.** Melee is 10 px wide, ranged is 6 px wide, and they are the
same 16 px tall. A 4 px width difference on a 16 px figure, at a density where the
ranged unit has 2 colours. On the grayscale still I could not separate them
anywhere in the mass; I could not do it in colour either without going to the
magnified ladder.

**Register B — 3.** This does start to work. Melee reads as a wider, blockier
column with a bright blob at the weapon hand; ranged reads as narrower with a
horizontal bright spur (the barrel/muzzle highlight) breaking the silhouette
sideways. On the grayscale still I can make the call on unoccluded units. But the
heights are near-identical (34 vs 32 px), so the entire cue is width plus a held
object — and the held object is the first thing to disappear under occlusion. Only
**7–9 of 36 units** in a given frame have a silhouette unoccluded enough to match
exactly against the reference sheet; for the other ~75% the archetype cue is
partly hidden behind a neighbour.

## Axis 3 — Tier separation

State it plainly: **at register A it does not work; at register B it works only if
you go looking.**

The hero is +8 px tall at A and +10 px at B. In an isometric crowd that cue is
structurally compromised — a unit one depth-row further back is *also* drawn
higher on screen, so "taller top edge" and "standing further back" are the same
signal. The parts count barely helps either: hero-vs-fodder drawn area is 1.46×
at A and 1.33× at B; hero-exclusive colours account for 56 screen px at A and
160–220 at B.

What actually finds the heroes is a bright teal accent (RGB 47,158,150 /
168,240,228) that no fodder carries. In the crowd stills that accent totals
**28 px over 4 heroes at A (7 px each)** and **76 px over 4 heroes at B
(19 px each)**. A 7-pixel spark is not a tier; it is a marker light. At B, 19 px
is enough to catch the eye on a sweep, which is why B gets a 3 rather than a 2 —
but that is a colour cue doing a job the brief assigned to size and parts, and it
will be swamped the moment esper effects put other saturated sparks on the field.

## Axis 4 — Crowd motion

Scored per treatment, then rolled up.

| Treatment | Register A | Register B | Ship? |
|---|---|---|---|
| playback 1 | 1 | 1 | **No** |
| playback 2 | 3 | 3 | No |
| playback 3 | 3 | **4** | **Yes, at register B** |

**playback 1 — lockstep, measurably.** Mean pairwise correlation between per-unit
motion signals is **+0.46 (A)** and **+0.857 (B)**; **76%** (A) and **93%** (B)
of unit cells peak on the same sampled interval. The aggregate changed-pixel
signal is a repeating pulse (A: 3128 → 2008 → 2024 → 1552 → 2008 → 2024 → 1552 —
the second half is *numerically identical* to the first). This is the toy-soldier
failure exactly as described. It reads as one animated object stamped 36 times.
Not shippable at either register.

**playback 2 — desynchronised, but one loop.** Per-unit correlation collapses to
**+0.01 (A)** and **−0.02 (B)**; the aggregate motion goes flat (frame-to-frame
change CV 1.8–1.9% on the filmstrip). The stepping-together artefact is gone. But
the whole scene still repeats **exactly every 8 frames** — best global repeat lag
= 8, residual 0.91% (A) / 2.73% (B) of pixels, and 66/102 unit cells have an
8-frame dominant period. At the GIF's ~12 fps that is a **0.67-second loop worn by
every unit on the field**. It survives a screenshot; it does not survive thirty
seconds of watching. And **27% (A) / 36% (B)** of unit pairs still move together
at r > 0.5, because phase collision is inevitable when everyone shares one cycle.

**playback 3 — this is the one.** No repeat inside the 36-frame window at all:
per-cell dominant period is 35 (i.e. the full sample) for **89% (A)** and **93%
(B)** of cells, versus 8 for two-thirds of cells in playback 2. Correlated pairs
drop from 27%→4% (A) and 36%→6% (B). Total motion rises **+59% (A)** and **+60%
(B)** in changed pixels per frame; the static fraction of the frame falls from
89.2% to 79.1% at B.

**Is the playback 2 → playback 3 difference visible to me? At register B, yes —
clearly.** In the B/pb3 filmstrip I can see weapons raised in some frames and
lowered in others on the same unit, cyan muzzle flashes and orange bursts
appearing and dying at staggered times, and units in visibly different postures
side by side. **At register A, no — I would not have called it without the
numbers.** On 8-art-pixel figures the second idle and the bursts arrive as extra
speckle flicker on a dark blob; more of the frame is changing, but nothing more is
*happening*. That asymmetry is itself an argument for B: register A cannot cash
the cheque playback 3 writes.

One watch item on playback 3: the aggregate motion still swings 3.6× across the
loop (3204 to 11560 changed px at B, CV 22%). Per-unit correlation is ~0, so this
is bursts clustering by chance, not units syncing — but with 36 units it will
occasionally read as the whole crowd surging. Worth a jitter check on burst
scheduling, not a blocker.

**Roll-up: A = 2** (the register's best available treatment still only reaches 3,
and the treatment's gains are largely invisible at that size). **B = 4, on
playback 3 only.**

## Axis 5 — Cohesion with the board

**Register A — 3. Register B — 4.**

The integration itself is genuinely good, and I want to say so before the
complaint:

- **One pixel size.** The whole frame is on a single 2× grid: 100% of unit-covered
  2×2 blocks and 98.7–100% of board blocks are internally uniform at offset (0,0).
  Effective art canvas 240×135, board and sprites alike. No mixed-resolution seam.
- **One palette.** Units share 10+ colours with the board out of a 17-colour
  (A) / 22-colour (B) unit palette. Plum-black, mauve, rust, teal. No chartreuse
  has been promoted into the sprites — the board's instruction on that point was
  followed.
- **Grounded.** Units cast contact shadows: floor luminance directly under the
  feet is 11–29 (of 255) darker than nearby floor. Nothing looks pasted on.

The complaint, and it is the reason B is a 4 and not a 5: the sprites' two darkest
clusters — RGB (44,37,48) at luminance 39.3 and (23,19,27) at 20.4 — sit within
ΔE76 = 2.6–2.8 of colours the *floor* uses. **53% (A) and 40% (B) of every
sprite's silhouette-edge pixels have a luminance inside the ground's luminance band
[16, 46].** Roughly half the outline dissolves into the floor. For a direction
whose first stated tool is "ink-like outer contours and clean internal
separations", the contour is being spent on a colour the ground already owns.

At register A this stops being a nuance and becomes the whole problem: a 5-colour,
26-art-pixel figure whose outline matches the floor is indistinguishable from
board grime. That is why A scores 3 here — it is cohesive in the sense that it has
stopped being a separate class of object.

---

## The strongest thing I can say against shipping

**The two factions are the same army.**

Across both registers, all eight animation frames of faction 2 have **pixel-identical
silhouette masks** to faction 1 (8/8 for melee, 8/8 for ranged, in both the A and B
sheets). The only difference between the armies is a palette swap, and that swap is
thin and asymmetric:

- The primary torso distinction — green (62,71,68) vs grey-purple (70,65,74) — is
  **ΔE76 = 10.0** with a luminance difference of **2.2/255 (0.9%)**. In grayscale
  it is nothing. I confirmed this on the grayscale stills: I cannot find the army
  boundary there by colour at either register, only by the staging gap.
- Faction 1 spends 24% (melee) / 20% (ranged) of its pixels on its identity colour
  at register B. Faction 2 spends **9% and 5%** — its ranged fodder carries its
  faction in **10 pixels**. At register A those numbers are 28/8 px and 12/**2** px
  per unit. Faction 2 is not a faction; it is the absence of green.
- Across the entire 480×270 frame, all faction-identity pixels for all 36 units
  total **396 px (0.31% of the frame) at register A** and **1556 px (1.2%) at
  register B**.

So the crowd is 36 instances of two silhouettes, tinted. Register B does not fix
that — it makes each instance twice as large and therefore twice as obviously a
repeat. Everything the reference board asks for on this front is silhouette work:
"exaggerated silhouettes and key poses that read before small detail",
"caricatured silhouette", "punchy character-local accents". The current art is
doing the opposite: identical geometry, discriminated by a 10-ΔE tint.

Second-strongest, and cheaper to fix: **~75% of units are occluded enough at any
instant that their archetype cue is unavailable** (only 7–9 of 36 units per frame
matched a reference pose exactly). Whatever silhouette work happens must survive
being half-hidden — which argues for a cue at the *top* of the figure (headgear,
shoulder line) rather than at the weapon hand, where it currently lives.

---

## Measurements and methods

Every number above, with how to check it. All pixel arithmetic on the supplied
files; no source code, git history, or other repository files were read.

1. **Unit sizes.** The sheets and ladders are magnified plates. `unit-sheet-*.png`
   sprite bounding boxes are 100% uniform under 2×2 blocking aligned to the sprite
   bbox, and the *result of halving them* is again 100% uniform under 2×2 blocking
   — so the plates are 4× the art grid. Halving a sheet sprite once and searching
   for it in `crowd-still-register-A.png` gives an **exact match, score 1.000**, at
   (y=198, x=210) for a 16×8 template — confirming the scene draws one art pixel as
   a 2×2 screen block and fixing screen sizes at the values tabulated above.
   Cross-checked against `unit-ladder-both-registers.png`, which is a 2.5× plate
   (plate 40 px ÷ 2.5 = 16 screen px fodder, 60 ÷ 2.5 = 24 px hero at A;
   85 ÷ 2.5 = 34 and 110 ÷ 2.5 = 44 at B), and against the 2× grayscale ladders.
   Three independent plates agree.
2. **Faction silhouette identity.** Extracted all 32 sprites per sheet, banded into
   4 rows, compared the alpha/foreground masks row 1 vs row 3 and row 2 vs row 4:
   **8/8 exactly equal in both registers.**
3. **Faction colour distance.** ΔE76 in CIELAB and Rec.709 luminance on the
   swapped palette entries: (62,71,68)↔(70,65,74) ΔE 10.0, Δlum +2.2;
   (100,113,103)↔(117,80,90) ΔE 25.7, Δlum +20.9.
4. **Faction pixel budget.** Counted faction-exclusive colours per sprite at screen
   scale (sheet ÷ 2) and summed the same colours over the crowd stills:
   A 160 green + 236 mauve = 396 px; B 832 + 724 = 1556 px.
5. **Separable-cluster count.** Built a mask of the 12 unit-palette colours that sit
   ≥ ΔE 10 from every ground colour, closed it 3×3, and counted connected
   components ≥ 30 px in each crowd still: **A = 18, B = 36** (36 units present).
   Method caveat: this mask covers mid and high tones only, not the dark contour,
   so it is a proxy for "separable shape", not an exact silhouette count.
6. **Contour/ground collision.** Ground luminance band taken as the six dominant
   floor colours, [16.1, 46.4]. Eroded each sprite mask by 3×3 to get its edge ring;
   fraction of edge pixels whose luminance lies inside that band: **A 918/1728 =
   53%, B 1492/3736 = 40%.**
7. **Army staging gap.** Extreme x of faction-1 colour pixels vs extreme x of
   faction-2 colour pixels in each still: A 221→266 (45 px), B 215→274 (59 px).
8. **Motion.** Filmstrip cells found by autocorrelation: pitch **648×308 px** in the
   2592×616 file, i.e. 324×154 at 1×, so each cell is a **2×-magnified 320×150 crop**
   of the 480×270 viewport (a filmstrip patch at (10,10) matches the still at
   (y=120, x=88) with 82% exact-pixel agreement). Per-treatment: split into 8 frames,
   tiled into unit-sized cells (12 px at A, 20 px at B), took each cell's
   changed-pixel count between consecutive frames as its motion signal, and computed
   mean pairwise Pearson correlation plus peak-interval agreement. GIF cross-check
   used all 36 frames at true 480×270 (durations 80/90 ms, ≈12 fps); global and
   per-cell repeat periods found by minimising mean pixel difference over lag.
9. **Contact shadow.** Rec.709 luminance of the 3 rows directly beneath a matched
   sprite vs the same rows offset laterally by 1–3 sprite widths: −11 to −29 on
   4 of 5 probes (the fifth was occluded by a neighbouring unit).
10. **Occlusion rate.** Exact-pose template matching (threshold 0.85, non-max
    suppressed) against GIF frame 0: **7–9 of 36 units** per frame. A companion test
    — counting distinct animation poses on screen — was **inconclusive and I am not
    relying on it**: with only 7–9 units matchable, the pose count saturates at 5–7
    of 32 regardless of treatment, so it cannot discriminate playback 2 from 3.

### Retraction

Earlier in this pass I recorded register-A fodder as **16 art pixels** tall, on the
assumption that the ladder plates were 2× the art grid. That was wrong. The plates
are 4× the art grid and the scene renders each art pixel as a 2×2 screen block, so
the correct figures are **8 art pixels / 16 screen pixels**. Every size claim above
uses the corrected values. The error does not change any verdict — it makes the
case against register A stronger, not weaker.
