# Cold critique — iteration 4, marking ring

Ten captures at 480×270, judged against the agent-artist reference board.

**Scope disclosure.** I opened only `/tmp/critique-r4b/*.png` and the reference-board
`README.md`. Nothing else was opened deliberately. The harness auto-injected the
worktree's `CLAUDE.md` / `AGENTS.md` into my context when I read the reference board;
they are build/lint instructions and contain no art information, and nothing in this
critique derives from them.

---

## Scores

| # | Criterion | Register A | Register B |
|---|---|---|---|
| 1 | Tier separation (with marking) | **3** | **4** |
| 2 | Crowd legibility | **2** | **4** |
| 3 | Cohesion with the board | **3** | **4** |

Bar is 4. **Register A fails on all three. Register B clears on all three.**

---

## Method

All measurements are reproducible from the supplied PNGs.

- **Ring isolation.** The ring is a single colour, `(200,189,169)`, relative luminance
  189.9. I isolate it as `|px − (200,189,169)|₁ ≤ 28` in the marked frame **minus** the
  same mask in the unmarked frame — the subtraction is necessary because that exact
  colour already exists on the hero sprites (40 px in A, 176 px in B, all inside hero
  bounding boxes). Cross-checked against a plain exact-RGB diff of the with/without
  pair; both methods agree on pixel counts and component counts.
- **Luminance.** Rec.709 relative luminance, `0.2126R + 0.7152G + 0.0722B`, on 0–255.
- **Components.** 8-connected labelling of the ring mask.
- **Stroke width.** Median horizontal and vertical run length of ring pixels = **2 px**
  in both registers.
- **Hero height.** ring bbox height − 2 × stroke. Register A: 32 − 4 = **28 px**.
  Register B: bboxes 52/48/48/50 → **48/44/44/46 px**. Both match the stated registers
  (28 and 46), which validates the method and the 2 px stroke reading. Register B/A
  scale measures 45.5/28 = 1.63, consistent with the stated 46/28 = 1.64 and
  36/22 = 1.64.

**Retraction.** My first attempt to measure the heavier variant diffed the top and
bottom halves of the stacked PNG directly and reported ~40,000 differing pixels and
80–95 components. That is wrong and I withdraw it: the stacked files are 8-bit colormap
(`P` mode) and the two halves are quantised independently, so the raw diff is dominated
by quantisation noise. All heavier-variant figures below come from the colour-proximity
method instead. A residual consequence of the same quantisation: the unmarked half of
the stacked B file reads 868 px at L≥150 where the clean RGB file reads 928 — a 6 %
drift that changes no conclusion.

---

## 1. Tier separation — with marking

### Register A — 3

I found **three** marks, not four, at native size. Two on the left, and on the right a
single wide bright glyph. The read was instant — under a second — but the count was
wrong. Only at 6× magnification did the right-hand glyph resolve into two lobes sharing
a wall.

This is not a viewing failure, it is in the pixels. The ring mask in
`register-A-with-marking.png` yields **3 connected components for 4 heroes**:

| component | px | bbox |
|---|---|---|
| #1 | 392 | 46×44 at x[312–357] y[176–219] — **two heroes fused** |
| #2 | 220 | 26×32 at x[130–155] y[178–209] |
| #3 | 172 | 22×32 at x[162–183] y[192–223] |

Component #1 is the sum of two hero rings (392 ≈ 220 + 172) whose contours touch. The
two left-hand rings survive with a **7.0 px** minimum gap. Both the exact-RGB diff and
the colour-proximity mask return the same three components, so this is not a threshold
artefact.

There is a second, quieter failure underneath the count. Magnify A's marked heroes and
the ring encloses almost nothing: a dark cavity with two or three coloured specks in it.
The frame carries 708 px above L=100 across all 36 units in the combat band — about
**20 px of above-L100 detail per unit**. The ring therefore does not say *this is a
hero*; it says *this cell is selected*. You can locate the marks. You cannot see what
was marked. That is a marker doing a character's job.

Three, and generously: it does put a loud, instantly-visible object where a hero stands,
which is more than register A had before. It gets the wrong answer to the question it
was asked.

### Register B — 4

Four of four, immediately, no magnification, roughly one to two seconds — two per side,
and I could tell without effort which two were paired. Confirmed: the ring mask yields
**4 substantive components** (376, 360, 308, 252 px) plus one 8 px fragment where a
foreground unit occludes a ring.

Not a 5, for two reasons. First the margin is thin: minimum ring-to-ring distance for
the two right-side heroes is **3.2 px**, about 1.6 stroke widths. That works in this
frame; it is one pixel of formation change away from failing the way A fails. Second,
the separation is carried entirely by the ring. Compare `register-B-without-marking.png`
— the heroes are barely findable there. The tier reads because a marker was added, not
because a hero was designed to be more legible than a fodder unit. That is a real
result and I score it as one, but it is a prosthesis, not a cure.

---

## 2. Crowd legibility

The board's stated economy is explicit and repeated: *"small bright focal clusters"*
(Warped City), *"saturated effects stay localized against dark value masses"* (Hyper
Light Drifter), *"saturated color is reserved for units and effects"* (grey-purple
city), *"localized red/cyan/warm-white light"* (REPLACED). Bright is scarce and
reserved. So: how much of the frame's bright budget does the ring take?

| | px at L≥150, unmarked | with marking | ring's share of L≥150 | ring's share of L≥180 |
|---|---|---|---|---|
| Register A | 220 (0.17 % of frame) | 1004 | **78.1 %** | **91.6 %** |
| Register B | 928 (0.72 %) | 2228 | **58.3 %** | **81.7 %** |

### Register A — 2

The ring adds 784 px at L=189.9 to a frame whose *entire* pre-existing budget above
L=150 is 220 px. The mark is **3.6× the whole frame's existing bright content**, and 40
of those 220 pre-existing pixels are the heroes' own highlights, so against genuinely
non-hero brightness it is 4.4×. After marking, **four fifths of every bright pixel in
the picture is ring**, and above L=180 it is over nine tenths. The colour budget has not
been spent on scarce focal points; it has been spent on a permanent always-on overlay.

Does the ring help the crowd read? No, because there is no crowd read to help. In
`register-A-without-marking.png` and its grayscale sibling the sixteen-per-side fodder
are a speckled dark smear. I cannot separate melee from ranged. I cannot separate the
factions except by which half of the board they stand on. I cannot count them. Stack
that against `registers-A-over-B-with-marking.png` and the difference is not subtle:
A's armies are texture, B's are figures in formation. The frame carries 35 unique
colours in A against 46 in B; A's unit band holds 708 px above L=100 against B's 1944 —
**2.7× less unit detail**. Adding a bright ring to an unreadable mass does not make the
mass readable. It puts four lamps in a fog.

Two. The mark damages the frame's value economy outright and buys nothing for the
crowd.

### Register B — 4

The same 2 px ring costs 1304 px against a pre-existing 928, i.e. **1.4×** rather than
3.6×. It still ends up as 58 % of bright pixels, and that is a genuine cost I am not
waving through. But the difference in kind matters: B's units already occupy the upper
half of the value ladder — 1944 px above L=100, 928 above L=150 in the unit band — so
the ring reads as the **top rung of an existing ladder** rather than a foreign layer
dropped on a dark plate. Look at the B grayscale capture: the crowd survives value
abstraction. Bodies, legs, shouldered weapons and formation columns are all still there
with the rings present.

And here the ring does modestly help. Thirty-six near-identical dark figures is a lot of
undifferentiated mass; four anchors give the eye somewhere to enter and turn the field
into "two armies, two leaders each" instead of "grey soup, two clumps." Four.

---

## 3. Cohesion with the board — did marking change anything?

Marking changes less than I expected, and what it does change is form, not palette.

**What stays clean, both registers.** The ring introduces **no new colour**. Register A
holds 35 unique colours before and after; register B goes 46 → 45 (the ring covered the
last 6 px of `(52,25,27)`). `(200,189,169)` is already a hero-sprite highlight — 40 px
in A, 176 px in B, every one of them inside a hero bounding box, none in the
environment. The ring is also drawn hard-edged on the same 1:1 pixel grid as everything
else: no anti-aliasing, no sub-pixel softening, no second resolution. On "one palette,
one pixel size" the marking is faultless.

**Register A — 3.** What breaks is drawing convention. The ring is grown *outside* the
silhouette, which means it publishes a 2 px dilation of the figure, not the figure. At a
28 px hero, limbs are 3–4 px wide and gaps between arm and torso are 2–3 px; dilating by
2 px on each side more than doubles limb width and closes every one of those gaps. The
result measures **solidity 0.898** — the marked shape occupies 90 % of its own convex
hull. It is a rounded lozenge with a head bump. Against fodder that are at least
nominally articulated figures, the marked hero is a different *class of object*: an
icon among drawings. The board is pointed about this — *"Avoid dropping toward
ultra-low-resolution roguelike or icon-like rendering"* — and register A was already on
the wrong side of that line before marking. Marking pushes it further, because the thing
it adds is literally an icon.

Worth naming: the board's Quasimorph caption states a **"revised 48×64-at-1× character
baseline."** Register B's heroes measure 44–48 px tall — on the baseline. Register A's
measure 28 px, **58 % of it**. Register A is not a slightly smaller register; it is a
different density regime from the one the board says it wants.

**Register B — 4.** At 46 px the same 2 px dilation is a rim, not a redraw. Magnify the
B rings and the head, shoulder line, arm and weapon are all still legible through the
outline; the hero and the fodder are still recognisably the same species of drawing.
The palette and pixel-grid discipline noted above hold. The one thing marking costs B is
the ink convention (below), which keeps it off a 5.

---

## Plain answers

### Which register would you ship?

**Register B.** It is the only one that clears the bar, and it clears it on every axis:
4 of 4 heroes found instantly with no magnification, a crowd that survives grayscale and
still reads as formation, and a hero-to-fodder relationship that stays inside one
drawing language. It is also the register the board's own stated 48×64-at-1× character
baseline points at.

Ship it with the reservation recorded above: B's tier separation is currently
manufactured by the ring, not earned by the hero art. Take the ring off and B is close
to where A was. The ring should be treated as a floor that buys time to make heroes
legible on their own terms, not as the solution.

### Does marking rescue register A?

**No.** It moves A from "clears nothing" to "clears something," and the previous 2
should probably be a 3 now — but 3 is not the bar, and the failure is specific rather
than marginal:

- It still gets the count wrong. Three marks for four heroes; two heroes fuse into one
  46×44 blob.
- It buys locating, not identifying. At 28 px the hero inside the ring carries roughly
  20 px of above-L100 detail. The ring surrounds a void.
- It leaves A's actual problem untouched. The previous reviewer's 2 was not really about
  hero-versus-fodder contrast; it was about there not being enough sprite. 35 colours in
  the frame, 2.7× less unit detail than B, no readable separation between melee and
  ranged or between factions. A cue cannot fix a shortage of information beneath it.
- It costs A the most. 78 % of the frame's bright pixels become ring, against 58 % in B,
  because A's frame had almost no bright content to begin with.

Marking is a label. Register A's problem is that the object being labelled is not
drawn yet.

### Is the ring the right weight?

**Ship the 2 px. Do not ship the heavier variant.** The heavier variant is decisively
wrong, and the measurement is unambiguous:

| | ring px | substantive components (4 heroes) | ring share of L≥180 |
|---|---|---|---|
| B, shipped 2 px | 1304 | **4** (376/360/308/252) | 82 % |
| B, heavier | 2512 (**1.93×**) | **2** (1228/1188) | **94 %** |

Doubling the stroke closes both same-side hero pairs. The left pair (gap 13.9 px at 2 px
stroke) and the right pair (3.2 px) both fuse into single blobs of 56×80 and 54×76 px.
The heavier ring reproduces, at register B, exactly the failure register A has at 2 px:
four heroes become two marks. It also takes the bright budget from 58 % to 77 % of
L≥150 and to 94 % of L≥180. The rejection was correct.

But I would not call 2 px *right* — I would call it the better of the two on offer. Its
worst-case same-side clearance is 3.2 px, 1.6 stroke widths. That is not a margin, it is
a coincidence of where these particular heroes are standing. If a third option is
available I would ask for either a 1 px stroke, or 2 px held at a 1 px dark inset so the
mark reads as a rim inside the sprite's own contour and stops growing the unit's
footprint. Between the two shown: **2 px, without enthusiasm.**

### What does the ring cost the picture?

Five specific things.

**1. It spends the entire bright budget, permanently.** After marking, 78 % (A) / 58 %
(B) of every pixel above L=150 is ring, and 92 % / 82 % of everything above L=180.
Anything the game later wants to make bright — a muzzle flash, an esper discharge, a hit
spark, a highlighted objective, the "punchy character-local accents" the board asks for
— now has to out-shout 1300 px of near-maximum value that is on in every frame of every
match. The board's environmental strategy is dark massing with selective saturated
light. The ring pre-spends the selective light before the fight begins.

**2. It replaces the hero's authored silhouette with a machine offset of it.** Grown
outside the contour, the ring publishes the figure dilated by 2 px per side, fattening
every limb and closing every gap narrower than 4 px. At B that softens the weapon and
arm gaps; at A it eats the figure whole (solidity 0.898). The board asks for
*"exaggerated silhouettes and key poses that read before small detail."* The ring
overwrites the read-before-detail layer at precisely the four units whose poses matter
most. Whatever the hero sprite says with its outline, the player sees the offset instead.

**3. It inverts the ink language for four units out of thirty-six.** Every other object
in this world is contoured dark — the frame's ink values are L=12.8, 16.1 and 20.1. The
heroes alone are contoured light. Two contour conventions in one frame reads as UI laid
over the scene rather than a figure standing in it, and it argues against the board's
*"ink-like outer contours"* hypothesis rather than testing it.

**4. It grows the unit's footprint, which is what breaks A.** The mark adds 4 px to each
axis: A's hero goes 22×28 → 26×32, a 35 % area increase. That is enough to fuse two
heroes at register A and, at 4 px stroke, to fuse both pairs at register B. Every
marking scheme grown outward buys visibility with space, and space is the one thing a
36-unit 480×270 frame does not have.

**5. It answers "where," not "who," at the price of "how loud."** Both factions' heroes
carry the identical neutral `(200,189,169)`. After marking you can find four heroes and
still cannot tell which faction or which archetype any of them is except from board
position. Meanwhile the ring contributes 758 of A's 2381 strong luminance edges
(dL>60) and 1246 of B's 4096 — **about 30 % of the frame's entire strong-contrast
structure, in both registers, to mark 11 % of the units.** Thirty percent of the
picture's contrast energy for a single bit of information is the ring's real cost. If
that colour were faction-tinted, or the stroke dashed for archetype, the same expenditure
would return three bits instead of one.
