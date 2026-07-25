# Cold critique — round 3, SMALL vs LARGE

Provenance-cold. Judged from the images only, plus pixel measurement of the
delivered PNGs. All coordinates are in the 480x270 1x renders unless stated.

## Overall verdict

Config LARGE is shippable-with-work; Config SMALL is not shippable at all, and
the reason is arithmetic, not taste — at 22 px the black contour consumes 54 %
of a melee fodder sprite and 68 % of a ranged fodder sprite, so what remains of
each unit is two or three flat clusters and an outline. The 22 px ranged unit
has 13 body-colour pixels left in it. But the more serious finding is that this
experiment did not test what it says it tested. The tier difference is **not**
carried by size and detail density; it is carried by three discrete authored
marks that no fodder unit has — a 6/14 px cream plaque (`#c8c2b8`), a warm tan
visor patch (`#a97055`) worn by heroes on *both* factions, and a single
near-white cyan specular (`#cdfcf2`) that occurs exactly four times in each
crowd render, once per hero, zero times across sixty-four fodder. Remove those
and SMALL has no tier read whatsoever; LARGE keeps a real one, from torso mass.
Separately, both configs fail motion for the same measurable reason: the crowd's
idle displacement envelope is synchronized — every unit is at rest in frame 0,
every unit peaks in frames 3-4, every unit is back at rest in frame 7 — which
is the synchronized-toy failure dressed up with per-unit direction variation.
And in both configs the hero silhouette is a featureless convex gumdrop on two
rectangular legs, which is the block-figure/toy proportion the canon explicitly
forbids, applied to the one unit class whose entire job is per-unit pose and
equipment.

## Per-axis verdicts

| # | Axis | SMALL | LARGE |
|---|------|-------|-------|
| 1 | Crowd legibility | **FAIL** | **BORDERLINE** |
| 2 | Tier separation | **FAIL** | **PASS** (on a confound — see D) |
| 3 | Archetype separation | **FAIL** | **PASS** |
| 4 | Gritty / dangerous / lived-in | **FAIL** | **BORDERLINE** |
| 5 | Character/environment cohesion | **BORDERLINE** | **PASS** |
| 6 | Grayscale legibility | **FAIL** | **BORDERLINE** |
| 7 | Motion | **FAIL** | **FAIL** |
| 8 | Deliberate pixel art vs noise | **BORDERLINE** | **PASS** |

### 1. Crowd legibility

**SMALL — FAIL.** In `crowd-small.png` at 1x both formations read as a mottled
green-and-orange patch, not as ranks. Adjacent torsos are separated by a single
ink pixel and fuse into one continuous green field across roughly x 80-160 in
the left clump; the rust helmets degrade into a scatter of 2x3 orange ticks
that read as speckle on that field rather than as heads. Facing is only
recoverable from the two or three ranged units trailing at the outer edge of
each clump — inside the mass you cannot tell which way anyone points. There is
no depth cue but overlap: every rank uses the identical body colour
`(73,86,82)`, so the clump is one flat plane.

**LARGE — BORDERLINE.** Individual figures resolve, ranks are countable, and
the two formations legibly face each other. Two things hold it back. In the
left clump the rust shield slabs of three stacked units line up at x~118-124,
y~120-165 into one continuous vertical rust column that reads as a crate or a
fence post, not as three shields. And depth is still carried by overlap alone —
no value shift, no saturation drop, no contrast falloff into the back rank — so
a 36-unit engagement is a flat wall rather than a body of troops.

### 2. Tier separation

**SMALL — FAIL.** I swept both clumps in `crowd-small.png` at 1x before doing
any measurement and could not locate a hero in either. Measured afterwards: the
28 px hero occupies 218 filled pixels against the 22 px melee fodder's 182 —
a 1.20x mass difference, because the fodder's shield slab gives it back most of
the area the height boost takes away. What eventually flagged the heroes for me
was the pale bar at (134,131) and (102,149) — a marking, not a size.

**LARGE — PASS, with a confound.** In `crowd-large.png` I did spot both rust-side
heroes unprompted: the large unbroken green masses at ~(125,126) and ~(75,153)
stand out as the only torsos that are one uninterrupted slab (273 body-colour
pixels each versus 120 for melee fodder). That is a genuine mass read and it is
the one thing this round proves. But on the slate-blue side what my eye actually
caught first at (278,125) and (330,153) was a warm orange dot in an entirely
cold formation — the hero-only tan visor. So the pass is partly bought with a
badge. See D.

### 3. Archetype separation

**SMALL — FAIL.** The 22 px ranged fodder is 68 % black contour: 130 sprite
pixels of which 88 are ink, leaving 13 body-colour and 11 livery pixels. It is a
black stick with an orange tick. It differs from melee only because melee carries
a solid rust rectangle; the stance, the lean and the rifle line that make it a
*ranged* unit at larger sizes are all gone. Worse, the scene stages every ranged
unit at the rear-outer edge of each clump (visible in `crowd-small.png`, the
splayed dark figures at x 155-190 and x 300-330), so the archetype read you get
from this image is positional, not silhouettic — the formation is answering the
question for you.

**LARGE — PASS.** At 34 px the ranged unit has a real splayed stance, a forward
lean and a horizontal light-grey rifle line crossing the body; melee reads as a
vertical raised mace plus a shield slab. Two clearly different silhouettes,
distinguishable in the packed clump and not only in the lineup. Still helped by
the same positional sorting, so treat the pass as a ceiling, not a floor.

### 4. Gritty / dangerous / lived-in vs toy-like

**SMALL — FAIL.** Flat colour fields, no material break, no wear, no grime, and
a continuous 1 px black outline around a 15x22 px figure. The result reads as
dark-bordered beads; the clump is cheerful-adjacent colour blocking (green mass,
orange dots) rather than a mob. Nothing in either formation looks like it has
been outdoors.

**LARGE — BORDERLINE, and the hero is the failing part.** The fodder pull it up:
the ranged unit's splayed stance and forward lean are genuinely aggressive, and
the melee's shield slab has weight. The hero pulls it down hard. Its 44 px torso
is 273 pixels of a single unbroken `(73,86,82)` with no internal value step at
all, wrapped in a convex contour that runs shoulder-to-crown with no neck, no
arm separation and no negative space, seated on two rectangular legs. That is a
chess pawn. It is the exact block-figure/toy proportion the canon rules out,
and it has been applied to the one unit class that is supposed to earn its
screen space on pose, equipment and material.

### 5. Character/environment cohesion

**SMALL — BORDERLINE.** The palette discipline is real and I want to credit it:
the darkest colour present in both renders is `(19,11,17)`, i.e. `#120b10` +/-1
grain, and a hue sweep finds **zero** hot-magenta and **zero** acid-chartreuse
pixels. Units and board share one ink anchor. What breaks cohesion is contour
weight: the units carry a hard continuous 1 px black outline and the environment
carries none — the board is built from soft value steps and thin unoutlined
lines. At 22 px, where that outline is 54-68 % of the sprite, the units read as
stickers dropped onto a painted board.

**LARGE — PASS, marginally.** Same contour mismatch, but the interior now wins
(32 % ink on the hero, 39 % on melee), so the units read as inhabitants. Scale
relationships are believable: a 34 px figure against the ~40 px orange floor
decals and the ~90 px building masses gives a plausible street rather than a
diorama.

### 6. Grayscale legibility

Measured luminances: body `(73,86,82)` -> 82; rust livery `(167,86,67)` -> 108;
slate livery `(81,99,119)` -> 96; floor -> 49; ink -> 14.

**SMALL — FAIL.** Livery sits 14-26 levels away from body out of 255. In
`crowd-small-gray.png` at 1x the clumps are grey speckle. The only equipment
that survives is the light-grey weapon pip and the hero's cream plaque; helmet
vs. hood, shield vs. torso, and both factions collapse into one value. The canon
law — important equipment readable in grayscale — is not met.

**LARGE — BORDERLINE.** Silhouettes survive, but on contour alone; the shield
reads as a rectangle because it is outlined, not because its value differs from
the torso it sits against. The helmet is invisible as a separate material.
Faction is entirely lost: rust 108 against slate 96 is a 12-level difference, so
the two armies are the same army in grayscale. Weapons and the hero plaque are
the only things doing real value work.

### 7. Motion — judged from the filmstrips

**Both FAIL, same cause.** Frame-to-frame difference from frame 0, over the
eight 1600 ms filmstrip panels (changed pixels, threshold 30):

- SMALL: 0 -> 4 797 -> 10 548 -> **13 284** -> **13 131** -> 11 925 -> 8 109 -> 3 420
- LARGE: 0 -> 7 839 -> 15 822 -> **19 560** -> **19 236** -> 17 733 -> 11 682 -> 5 715

That is one clean hump in both configs. A tile-by-tile vertical-displacement
analysis shows individual units do move in *different directions* at the same
instant (+2 and -2 source px simultaneously across the formation), so the phase
sign is varied — but the *amplitude envelope is shared*: at frames 0 and 7
almost every tile measures zero displacement, at frames 3-4 almost every tile is
at its +/-2 px extreme. The whole formation inhales and exhales on one clock. An
empty background tile measures 0.0 change across all eight frames, so this is
unit motion, not a camera bob — the lockstep is real. A properly de-phased crowd
would produce a roughly flat energy curve, not a 4-6x swing.

Second motion defect: the bob amplitude is a fixed 2 source pixels in *both*
configs. On a 22 px figure that is a 9 % jolt per step and reads as a mechanical
tick; on a 34 px figure it is 6 % and reads closer to a breath. SMALL is
therefore the twitchier of the two, which is the opposite of what you want from
the smaller register.

### 8. Deliberate pixel art vs noise

**SMALL — BORDERLINE.** It is not mush. Every figure is a single connected
component with a closed continuous contour, there is no stray dither, and there
are no orphan pixels. But controlled is not the same as drawn: with 54-68 % of
each sprite spent on outline, what survives is two to four flat clusters. That
is deliberate *icon* making, not deliberate pixel art, and it sits well below
the Warped City density register the board asks for.

**LARGE — PASS.** Clusters are large and intentional — the shield is one flat
slab, the helmet one lozenge, the visor a 1x3 teal run, the rifle a clean
diagonal light-grey line. Contours are closed and consistent. The one place it
degrades is the packed crowd, where stacked shield slabs merge into unintended
columns (see axis 1).

*Pipeline note, not a score:* the flat torso does not sample as a single value —
it returns `(73,85,81)`, `(73,86,82)`, `(72,86,82)`, `(74,86,83)` and so on. A
+/-2 grain is being applied over the sprites as well as the board. It is
imperceptible at these values, but the shipped frame is not palette-indexed, so
any later pass keyed on exact colour (palette swap, outline extraction, team
recolour) will not work on this output.

*Pipeline note 2:* `lod-resample-vs-authored.png` is convincing. Point-resampling
the 32x47 hero to 63.6 % breaks the contour, smears the visor into an
indeterminate 2 px blur and merges the legs; the authored 20x30 keeps a closed
silhouette. Correctly read, this means SMALL is **not** a cheap LOD of LARGE —
choosing it is a separate full authoring pass, so it buys no production savings
over LARGE beyond raw cell count.

---

## A. At Config SMALL, does higher detail density actually express tier separation?

**No.**

At 22 px vs 28 px the hero is six pixels taller and occupies 218 filled pixels
against melee fodder's 182 — 1.20x, because the fodder's shield slab returns most
of the area the height boost adds. That is inside the noise of a packed clump. I
swept both formations in `crowd-small.png` at 1x before measuring anything and
found no hero.

What is actually separating them at SMALL, in descending order of effect:

1. **A 6 px cream plaque** `(200,194,184)` on the hero's livery panel. Clustering
   every cream pixel in `crowd-small.png` returns exactly four clusters of size
   >=3 — at (89,146), (121,128), (251,126) and (286,145). Those are the four
   heroes. No fodder unit has a cream cluster larger than 2 px.
2. **A hero-only near-white cyan specular** `(207,254,242)`. Exactly four pixels
   in the entire render, one per hero, at (134,131), (102,149), (239,130),
   (274,149). Zero on sixty-four fodder.
3. **A warm tan visor patch** `(169,112,85)`. Exactly four clusters, one per hero,
   on both factions.
4. **Silhouette class** — heroes are hooded with a round crown; both fodder
   archetypes wear a hard helmet lozenge.
5. Only then, distantly, the torso mass — 84 body-colour pixels versus melee's
   47. This is the one legitimate cue, and in a packed clump it fuses with the
   neighbouring torsos and stops working.

Strip items 1-4 and Config SMALL has no tier read at all.

## B. Which config would you ship, and what would you lose by taking the other?

**Ship LARGE.**

Taking SMALL instead you lose, concretely: the ranged archetype (68 % ink, 13
body pixels — there is no drawing left to read); any tier separation that is not
a badge; all internal material detail, permanently, since 22 px cannot hold a
value break inside a torso; and grayscale equipment legibility, which is a
standing canon law that SMALL simply does not meet.

What LARGE costs you, honestly: board capacity. In `crowd-large.png` the two
36-unit formations already occupy x 40-175 and x 235-400 with only ~60 px of
open ground between them, and the left clump is touching the building mass at
x~45. LARGE cannot hold a meaningfully bigger engagement without panning, and
"crowd fodder, many on screen" is the whole premise of the tier. It is also
roughly 2.4x the authoring surface per unit. Neither of those is a reason to
take SMALL — SMALL is not readable, and it is not a resample of LARGE, so it is
not even a cheap fallback.

## C. Single biggest defect in the winning config

**The hero silhouette.** At 44 px the hero is the largest, most conspicuous
object on the board, and it is a featureless convex gumdrop: one unbroken contour
from shoulder to crown with no neck, no arm break and no negative space, filled
with 273 pixels of a single flat green with zero internal value step, standing on
two rectangular legs. It reads as a bollard or a chess pawn. The result is
inverted — the 34 px *ranged fodder*, with its splayed stance, forward lean and
weapon line, is a more dangerous and more characterful drawing than the 44 px
hero standing next to it. The tier that is supposed to earn attention through
pose, equipment profile and material currently has the least of all three.

## D. Did something sneak in that functions as a badge?

**Yes. Four things, three of them decisive.**

1. **A hero-only warm tan `(169,112,85)` visor patch, worn on both factions.**
   Clustering that colour returns exactly four clusters per crowd render — one
   per hero — plus one stray environment pixel at (382,185). The rust side's
   *fodder* helmets are the deeper `(167,86,67)`; this tan is a different entry.
   The consequence is severe on the slate-blue side: a scan for rust-family
   pixels inside the slate formation returns nothing but the floor decal and two
   3 px clusters, at (332,136) and (279,108) in `crowd-large.png` — the two
   slate heroes. A warm dot inside an entirely cold formation is a beacon. This
   directly contradicts "heroes wear the same faction livery ramp as their own
   fodder" and "no hero-only colour."

2. **A cream `(200,194,184)` plaque on the hero's livery panel** — 6 px at SMALL,
   14 px at LARGE, contiguous, sitting inside the highest-chroma patch on the
   unit. It is the largest high-value cluster carried by any unit on the board,
   and in `crowd-large-gray.png` it is the *only* thing that identifies a hero.
   That is a badge in the literal sense: an insignia-shaped bright rectangle on
   the chest.

3. **A hero-exclusive emission colour `(207,254,242)`** — four pixels per render,
   one per hero, never on fodder. It is the brightest pixel on either unit mass.
   Whatever the intent, one exclusive colour and one exclusive pixel position per
   hero is a marker.

4. **A silhouette-class difference**: heroes are hooded/round-crowned, both fodder
   archetypes are helmeted. Legitimate as art, but it is a shape marker, not
   "size and detail density," and it should be named as a variable rather than
   left in as a control.

Corroboration, from the cost report shipped alongside these images: the hero
grids use **18 palette roles** against fodder's **11-13**. The five-to-seven
extra entries are exactly the tan visor, the cream plaque and the cyan emission
ramp found above. So the tier read in this round is substantially colour-coded,
and the experiment's stated control — size and detail density only — did not
hold.

A clean rerun would require: heroes drawn from a palette that is a strict subset
of their own faction's fodder palette (no tan, no cream, no exclusive cyan), the
hood removed or given to fodder too, and ranged/melee units interleaved through
the formation rather than sorted into ranks.

---

### Appendix — measured figures cited above

| Measure | SMALL melee | SMALL ranged | SMALL hero | LARGE melee | LARGE ranged | LARGE hero |
|---|---:|---:|---:|---:|---:|---:|
| Bounding box (px) | 15x22 | 14x22 | 16x28 | 22x34 | 21x34 | 25x44 |
| Filled sprite px | 200 | 130 | 266 | 395 | 261 | 600 |
| Ink px (share) | 109 (54 %) | 88 (68 %) | 114 (43 %) | 156 (39 %) | 141 (54 %) | 195 (32 %) |
| Body-colour px | 47 | 13 | 84 | 120 | 55 | 273 |
| Cream `(200,194,184)` px | 1 | 2 | 6 | 1 | 4 | 16 |
| Hero cyan `(207,254,242)` px | 0 | 0 | 1 | 0 | 0 | 1 |

Scene-level, both crowd renders: darkest colour `(19,11,17)`; bright pixels
(V > 0.72) 0.23 % SMALL / 0.29 % LARGE — well under the 5 % emission cap, in fact
so far under that the board has no focal punch at all; identity-saturation
pixels 13 % of frame; hot magenta 0 px; acid chartreuse 0 px.

## Follow-up — the approved hero marking (second cold pass)

Provenance-cold again. Judged from the delivered images plus pixel measurement.
All coordinates are in the 480x270 1x renders unless stated. Where a number
below contradicts the first pass, the first pass was measuring the previous
artifacts; this section describes what is in these files.

### 1. Does the marking work?

**Yes — decisively, and it is the only thing in this round that does.**

Blind sweep, "with" panels, 1x, before any measurement:

- `marking-with-without.png` panel 2 (SMALL / WITH): **4 of 4 heroes, under a
  second.** Two warm orange arches in the left clump, two pale steel arches in
  the right. I did not have to search — they arrive as shapes, not as a hunt.
- Panel 4 (LARGE / WITH): **4 of 4, same speed.** Slightly louder because the
  arch is taller.
- Same result on `crowd-small.png` and `crowd-large.png` independently.

Blind sweep, "without" panels, 1x:

- Panel 1 (SMALL / NO MARKING): **0 of 4.** Both formations are a mottled
  green field with orange or steel speckle. I gave it a genuine slow pass and
  came away with nothing I would have staked a claim on.
- Panel 3 (LARGE / NO MARKING): **0 of 4 on a cold sweep.** I registered "the
  clump is lumpy around x~110 and x~290" but could not have named a unit.

To be fair to the unmarked renders I then cropped the four known hero locations
out of `crowd-small-unmarked.png` / `crowd-large-unmarked.png` and viewed them
at 4x with the hero dead centre — i.e. handed the answer to myself:

- **LARGE, location known:** the hero *is* recoverable. It is the one figure in
  the formation with **no helmet** — every fodder unit on both sides wears a
  coloured helmet lozenge (`#a05040` rust, `#506078` slate) and the hero wears
  none — plus a bone-white chest tab. So the LARGE hero read, unmarked, is
  carried by an *absence* plus a badge. That is exactly what the first pass
  called and the marking does not repair it, it covers it.
- **SMALL, location known:** still not recoverable. Even centred and 4x-magnified
  with the answer in hand, the 28 px hero is a slightly taller green mass among
  22 px green masses. There is nothing there.

So the marking is doing real work at both configs, and at SMALL it is doing
*all* the work.

### 2. Is it over- or under-done?

**Neither, exactly — it is mis-shaped, and at SMALL it is under-built.**

Measured geometry (`lineup-large.png`, vertical scan x=145):
`#160e13` ink -> `#d08560` -> `#cf8561` -> `#161015` ink. That is
**1 px plum-black / 2 px faction highlight / 1 px plum-black**, a 4 px total
ring. The identical scan on `lineup-small.png` (x=146) returns
`#372b36` ground -> `#d0855f` -> `#cf855f` -> `#170f15` ink.

**At Config SMALL the outer plum-black seat is missing.** Of the 118 pixels
immediately outside the ring hull in `lineup-small.png`, **0** are darker than
L=30; median luminance outside the ring is 57, i.e. bare ground. The same holds
in the crowd: in `crowd-small.png` the rust hero's arch at y=115, x=121-124 has
raw mauve ground directly above the orange. At LARGE the equivalent count is
166/166 dark. So the brief's "two bright rings seated on one ring of plum-black"
is true at LARGE and false at SMALL. Also, the bright band measures **2 px at
both configs** — the stated 3 px at LARGE is not in the file. The marking does
not scale with the register; it is a fixed 4 px screen-space object.

That missing ink seat is the single biggest reason the SMALL marking reads as a
**sticker**. Everything else in these renders is ink-bound; the SMALL ring is
the one bright element allowed to touch the ground directly.

**Shape.** Rendered as a pixel map, the ring is a fully closed capsule with a
solid 2-row **flat horizontal bar across the bottom, under the feet** — at LARGE
it is 21 px of unbroken bright orange laid on the floor. At LARGE the contour
also threads a **1 px sliver up the gap between the legs**, so the border is 2 px
everywhere except a 1 px thread through the crotch. Two consequences:

- The flat bottom bar sits exactly where the contact shadow should be, so the
  marking severs the hero from the ground plane instead of seating it. In
  `lineup-small.png` the hero appears to be standing in a bright orange bathtub
  while the two fodder units beside it have proper dark contact wedges.
- A flat-bottomed closed capsule is **screen-space** furniture. On a fixed 2:1
  dimetric board, a marker that belonged to the world would be a ground-plane
  element skewed to the tile (a dimetric footprint diamond), or a light. This is
  a UI cartouche. That is why it reads as pasted-on even at LARGE, where the
  craft is fine.
- Third, subtler: the ring is a 2-3 px dilation of the silhouette, so it *rounds
  the silhouette off*. It does not reveal the hero's contour, it replaces it with
  a smoother fatter one. You are spending your loudest mark to hide the one
  channel the canon says must carry distinction.

**Emission budget.** Not broken by area, but effectively monopolised.
Scene mean luminance is 52. Ring colours are `#d0855f` (L=146) rust and
`#849ab4` (L=151) slate. Pixels above L=140:

| | frame total | added by ring | ring share of all bright px |
|---|---:|---:|---:|
| SMALL unmarked | 156 px (0.12 %) | — | — |
| SMALL marked | 768 px (0.59 %) | 617 px (0.48 % of frame) | **80 %** |
| LARGE unmarked | 272 px (0.21 %) | — | — |
| LARGE marked | 1 265 px (0.98 %) | 1 005 px (0.78 % of frame) | **79 %** |

0.5-0.8 % of frame is comfortably inside a 5 % cap. The problem is the other
column: **four idle-state UI rings now own four-fifths of every bright pixel on
the board.** Before the marking the scene had essentially no high-value content
at all. Whatever you want to spend brightness on later — a hit spark, an esper
discharge, a muzzle flash, a lit window — now has to out-shout a passive marker
that is on screen permanently. That is a value-hierarchy failure even though the
arithmetic passes.

**Mood.** No hot magenta, no acid chartreuse; both ring colours are legitimate
tints of their own faction ramp (rust hue 20 against fodder helmet hue 10; slate
hue 213 against fodder helmet hue 216). Palette law respected. But the two
markings are **not equally loud**: rust `#d0855f` is HSV S=0.54, slate `#849ab4`
is S=0.27 — the rust hero's marking is twice as saturated as the slate hero's.
In a symmetric PvP board that is an unfair read, and it is visible: the rust
arches pop harder than the steel ones in every panel.

**What I would change**, in order:

1. Give SMALL the outer plum-black seat it is missing. Non-negotiable — it is a
   bug, not a taste call.
2. **Kill the bottom bar and the leg-gap thread.** Open the loop: run the bright
   band over the crown and down the two outer shoulders/flanks only, and let it
   die out at hip height. That converts a cartouche into a rim-light, keeps the
   arch shape that is doing the actual finding work, and returns the contact
   shadow.
3. Drop the highlight value ~25 %, to roughly L=110-115. That puts it level with
   the existing livery accents (`#b06848` L=117, `#506078` L=94) instead of 3x
   the scene mean, and it hands the top of the value range back to effects. Test
   whether the arch still finds at 1x — I expect it does, because the finding cue
   is the *closed continuous contour in an otherwise broken field*, not the
   brightness.
4. Match the two factions' saturation. Lift slate to ~0.45 or drop rust to ~0.30.
5. Thickness is fine at 2 px. Do not make it thicker.

### 3. Grayscale

**Heroes vs fodder: emphatic pass — the marking's best axis.** In
`marking-with-without-gray.png` panels 2 and 4, and in both halves of
`crowd-compare-gray.png`, all four heroes are found instantly at 1x. The rings
sit at L=146/151 against a formation whose brightest sustained value is the
livery at L=94-96 and a body at L=82. The separation is roughly 55 levels; it is
not close. In `lineup-compare-4x-gray.png` the hero is unmissable.

**Factions vs each other: fail, and the marking made it worse.**

| | rust | slate | delta |
|---|---:|---:|---:|
| hero ring | 146 | 151 | **5** |
| fodder helmet | 96 | 94 | **2** |

Five levels out of 255 on the rings, two on the helmets. The two armies are the
same army in grayscale — the first pass already said this about the liveries, and
the marking has now repeated the error at the top of the value range. The new
brightest, most attention-grabbing object on each side is the same grey as the
enemy's. Anyone reading this board by value alone can find all four heroes and
tell you nothing about which side they fight for. If you keep the ring, the
faction difference has to move into value: e.g. rust ring at L~150 and slate at
L~110, or one solid and one dashed/broken.

### 4. Does the marking rescue Config SMALL?

**No. It rescues hero-finding at SMALL and rescues nothing else, and SMALL is
where the marking itself is least defensible.**

What is still broken at SMALL, judged as a shippable crowd register on its own
terms:

- **The marking is bigger than a soldier.** The SMALL ring's bounding box is
  22x32 px = 704 px of board. A SMALL melee fodder unit's bounding box is
  15x22 = 330 px. The affordance attached to one hero occupies **more than twice
  the board area of an entire fodder unit**. That is the definition of a marker
  overwhelming its register.
- **Idle motion now erases the size cue it was meant to supplement.** The hero
  advantage at SMALL is 6 px of height (28 vs 22). Tracking per-unit vertical
  displacement across the 16 frames of `motion-small.gif`, 17 % of fodder units
  swing 3 px or more peak-to-peak and the loudest swings 5.67 px. A bobbing
  fodder unit at the top of its arc is momentarily as tall as a hero at the
  bottom of its. The per-unit-amplitude change shipped alongside the marking has
  quietly consumed the size channel at SMALL. At LARGE the delta is 10 px against
  a 4.52 px maximum swing, so size still survives there.
- **Archetype separation is still gone.** Nothing in this round addressed it.
  Reduced interior black helps the fodder read as coloured masses rather than
  black ticks — that is a genuine improvement over the previous SMALL — but melee
  and ranged remain the same silhouette at 1x inside the clump. You can now find
  the two units that matter and still cannot read what the other sixteen are.
- **The ring lacks its ink seat at SMALL** (section 2), so the one new element is
  also the least-finished element in the config.
- Formation depth is unchanged: one flat body colour, overlap as the only depth
  cue.

Marking is a fair affordance. It is not a substitute for a register that can hold
a drawing, and SMALL still cannot.

### 5. Motion

I judged the filmstrips first, then went to the GIFs to settle the sync question
properly.

**The crowd reads as alive, and the "synchronized toys" charge from the first
pass no longer holds.** I want to be explicit that this is not the changed-pixel
hump argument, which proves nothing:

*Evidence that survives the shared-period objection.* I tracked each fodder
unit individually by its helmet blob (`#a05040` rust, `#506078` slate) through
all 16 frames of each GIF and took the vertical centroid per unit per frame,
then took the phase of the fundamental of each unit's own series.

- SMALL: 39 units with real motion. Circular phase concentration **R = 0.121**
  (0 = uniformly de-phased, 1 = lockstep). Phase histogram over 8 bins of the
  cycle: `[3 6 7 4 7 5 3 4]`. Rayleigh does not reject uniformity.
- LARGE: 54 units. **R = 0.120**. Histogram `[7 6 5 8 11 6 6 5]`.

Individual units genuinely peak at different points in the cycle. Corroborating
this at the frame level: total changed pixels versus frame 0 for
`motion-small.gif` runs `0, 1148, 1956, 2921, 3381, 3707, 3761, 3539, 3614,
3686, 3953, 3980, 3700, 3416, 3146, 2707` — it **plateaus and never returns to
zero**, because there is no shared rest pose to return to. The first pass's
numbers dropped back to near-zero at the end of the cycle; these do not. The
filmstrip panels show the same thing more crudely: SMALL reads
`0, 7575, 11073, 12093, 9858, 11535, 8511, 5172` — a dip at panel 4 and a second
rise at panel 5, i.e. not one hump. Amplitude spread is real too: p10 0.65 px,
p50 2.00 px, p90 3.48 px at SMALL.

**What is still wrong.** Every unit is the *same* oscillator. The fundamental
at the 1600 ms cycle length holds a median **87 % (SMALL) / 79 % (LARGE)** of
each unit's AC power — each unit is close to a pure sine at one shared frequency,
differing only in phase and gain. One clock, many phases, no tempo variation, no
hold, no accent, no hitch. Median horizontal swing is 1.6-1.7 px and vertical
1.4-2.0 px, and that is the entire vocabulary: bob plus lean. No weapon sway, no
head turn, no weight transfer, no secondary motion, nothing that reads as a
person doing something. Over a long watch a 36-unit crowd on a single 1.6 s
heartbeat will resolve as a procedural shimmer rather than a mob holding a line.
That is a smaller charge than synchronization and it is the right next one.

Relative twitchiness is also still inverted: median swing is 2.00 px on a 22 px
figure at SMALL (9.1 % of height) against 1.40 px on 34 px at LARGE (4.1 %). The
smaller register is more than twice as jittery, which is backwards.

### 6. Which config to ship, now that marking exists

**Still LARGE.** The marking does not change the answer; it narrows the gap on
exactly one axis and widens it on another.

Taking SMALL you would lose: archetype separation entirely (melee vs ranged is
unreadable in the clump at 1x); the hero size cue, which per section 4 is now
being eaten by the idle bob; any internal material detail; and you would ship the
one config where the marking is a bare-bright decal with no ink seat and a
bounding box larger than a whole fodder soldier. The marking buys you hero
*location* at SMALL and nothing beyond it.

What LARGE costs you, honestly, and it is a real cost: **board capacity.** In
`crowd-large.png` the two formations plus their markings span x 50-356 of a 480 px
board — the rust left flank is at x=50 and touching the building mass, and the
open ground between the armies is down to roughly 60 px. LARGE cannot hold a
meaningfully bigger engagement without panning, and "many fodder on screen" is
the point of the tier. It is also ~2.4x the authoring surface per unit, and
`lod-resample-vs-authored.png` still shows SMALL is not a cheap downscale of
LARGE, so LARGE buys no fallback either. If the design needs 24+ fodder a side,
this decision reopens — but it reopens as "author a third register," not as
"take SMALL."

### 7. Biggest remaining defect in LARGE

**The hero silhouette, unchanged — and the marking has been used instead of
fixing it.**

Look at `lineup-compare-4x-gray.png`, which is the cleanest statement of the
problem. Three units, uncrowded, in value only. The melee fodder has a pack, a
raised weapon, a helmet lozenge and a braced stance. The ranged fodder has a
rifle line across the body, a visor and a splayed stance. The hero — the unit
whose entire justification is that it is individually meaningful — has **no
weapon at all**, no pack, no helmet, two stub arms and two rectangular legs under
one unbroken convex mass. It is the least characterful drawing of the three, and
it is the only unit on the board carrying no equipment. The canon says the tier
distinction comes from silhouette, colour mass, stance, equipment profile and
animation signature. The hero currently has the weakest silhouette, the flattest
colour mass, the most neutral stance, zero equipment profile, and the same
sine-bob idle as everyone else.

And the marking actively deepens this. It is a 2 px dilation of that silhouette,
so it traces the blob and smooths it further; then it wraps the result in the
brightest object on the board so the eye lands there first. You have built a very
effective spotlight and aimed it at the emptiest drawing in the scene. Fix the
hero — give it a weapon, a break between arm and torso, a real stance, one
internal value step in that 273-pixel torso — and then re-test whether the ring
is still needed at LARGE at all. My expectation is that at LARGE it would not be,
and the ring's honest home is SMALL, where nothing else can work.
