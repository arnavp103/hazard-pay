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
