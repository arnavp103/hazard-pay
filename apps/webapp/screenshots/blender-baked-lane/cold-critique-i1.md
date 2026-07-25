# Cold critique — i1 · Mara Voss on the grime-market board

SCORES i1: gritty 2/5 · silhouette 2/5 · material 2/5 · cohesion 3/5 · motion 2/5

**VERDICT: NOT YET** (bar: 4 or better on every axis — nothing reaches 4)

## Provenance

Looked at, and only at:

- `controlled-still-combatzoom.png` (480×270)
- `loupe-4x.png` (384×416; verified to be an exact 4× nearest crop of the still at offset 200,124 — zero pixel error)
- `facing-sheet-4x.png` (1152×168; exact 4× nearest of a 288×42 sheet, 8 tiles of 36×42)
- `filmstrip-idle.png` (2133×288; exact 3× nearest → 8 tiles of 88×96 with 1px separators)
- `filmstrip-attack.png` (3201×288 → 12 tiles)
- `filmstrip-turn-beat.png` (3201×288 → 12 tiles)
- `quantization-comparison.png` (800×796; all four rows displayed at 4× native)
- `docs/art-direction/reference-board/README.md`, `anchors/direction-b-overview.png`,
  `exploration/warped-city-animation.png` (used as the numeric density benchmark the README
  itself names as the preferred side of the range)

Did not open the GIFs (the filmstrips carry the same frames), `atlas-cost.json`, any source,
any history, or any other screenshots directory.

## Measurement that reframes everything else

**The board is a 240×135 image displayed at 2×.** 94.4% of grid-aligned 2×2 blocks in the still
are internally uniform within 6 levels; at the three offset phases that figure collapses to
61.7% and the mean internal spread jumps from 3.19 to 25.3 / 25.5 / 46.4. The magnification is
exact nearest-neighbour, phase (0,0), no bilinear smear.

Consequence: **Mara Voss is a 21×32 pixel character.** Confirmed three ways — 21×32 body bbox in
the facing sheet, ~29px figure height in the quantization comparison at its 4×, and a 28×32
native figure recovered from the still by dropping every second pixel. The 480×270 aperture is
not showing a 42×64 sprite; it is showing a 21×32 sprite twice as big.

The reference board names Quasimorph as "the density-register anchor for the revised **48×64-at-1×
character baseline**." This artifact ships **half the linear resolution and a quarter of the pixel
budget**, and buys back the apparent size by magnifying. Almost every failure below is downstream
of that one decision: at 21×32 there is no room for a medic's kit, no room for a cloth/metal
break, and no room for an accent mass that survives being a mass.

---

## 1. Gritty / dangerous / lived-in — 2/5

**What is right.** The palette discipline is real and it is the artifact's best feature. Zero
pixels in the entire still fall within ΔRGB 10 of `#ff2e6c` or `#c8f031` — the UI accents have
been kept out of the assets exactly as canon demands. `#120b10` is a live palette entry, present
across 6.9% of the play field and 9.7% of the sprite's bounding box. The whole frame sits in the
warm plum-black family. **Nothing here is toy-like.** That is a genuine pass on the hardest-to-
recover failure mode.

**Why it still scores 2.** *Dim is not the same as dangerous.* Measured on the play field
(rows 22–248, UI chrome excluded):

- **68.7%** of the play area is featureless mid-plum floor (luminance 28–62, saturation < 0.32).
- **76.5%** of the play area sits inside a **40-level luminance window** (L 20–60) out of 255.
- **0.1%** of the play area is above L 180. **1.05%** of the whole frame is above L 128.

There is no light source anywhere in the scene. There is no key, no pool, no lamp, no window, no
emitter. The canon budget is "no more than ~5% bright emission and focal highlights"; this frame
spends **one fifth** of it. REPLACED and Warped City — both on the board — earn their menace from
*large near-black masses against localized saturated light*. This board has neither end: 6.1%
below L 20 and 0.1% above L 180. It is one grey-plum note held for 226 rows.

And it is not a market. Inventory of the entire "grime-market board": four dark box props, one
orange floor stripe, one teal floor pad, a thin antenna at upper right, two rectangular panel
insets. No stalls, no awnings, no signage, no cabling, no crates, no spill, no wear, no
rust streak, no debris, no trace that a person has ever stood there. Native edge density is 10.9%
horizontal / 15.4% vertical — the surfaces are unbroken planes. "Lived-in" is the axis word and
nothing in this frame has been lived in.

**The grain makes it worse, not better.** There *is* a noise pass — 2.9 levels mean spread *inside*
the 2×2 art blocks on a flat floor. That means the grit was applied at 480×270, i.e. **at half the
size of the art's own pixel**. It is invisible as texture (±3/255) and it costs the palette
everything: the shipped still contains **6,665 unique colours**. It reads as dirt on the lens,
not dirt in the world.

## 2. Silhouette + equipment readability at combat zoom — 2/5

**The figure has no value separation from the ground it stands on.**

| | luminance |
|---|---|
| coat `#262a2e` (the largest character mass) | **41.4** |
| floor immediately under the sprite | **41.5** |
| background ring around the sprite bbox | **45.6** |

Zero. The coat and the floor are the same value. The figure is held together **entirely by a
1-native-pixel ink line** (`#120b10`, L 12.8). At the shipping 2× that line is two screen pixels
wide — it survives on this particular still, and it dies the moment the unit steps onto any of
the 6.1% of the board already darker than L 20, or onto its own cast shadow.

Grayscale-converting the still confirms it: the hood/pack cap at the top reads, the boots read,
the weapon reads. The torso — the 60% of the figure between them — is an undifferentiated
mid-grey with speckle, indistinguishable from the floor behind it.

**Facing is not in the silhouette.** Full 8×8 silhouette IoU matrix (best horizontal alignment):
every off-diagonal pair falls between **0.62 and 0.80**. The 180°-opposite pairs — f0/f4 = 0.68,
f1/f5 = 0.74, f2/f6 = 0.74, f3/f7 = 0.62 — are *no more distinct* than the 45° neighbours
(0.69–0.80). The outline is the same hooded blob in all eight directions. Everything that tells
you which way Mara is facing lives in the interior colour scatter, which is precisely the
information channel that dies at combat zoom.

(To the artifact's credit: the facings are **not mirrored**. Mirror-pair IoU 0.66–0.78 is
indistinguishable from the adjacent-pair control 0.69–0.80, so these are eight genuine renders,
not four flipped. The gun stays in the same hand.)

**There is no medic.** Across all eight facings at 4×, and at 14× on the native still crop, I can
find: a plum hood, a dark coat, a light-grey forearm/sleeve, a cream 3×2 pouch at the left hip,
a cream 2×3 block mid-torso, white-grey boots, a light-grey sidearm with a 2px teal tip, and
orange confetti. No cross, no red-cross analogue, no satchel, no vial rack, no syringe, no drip,
no stretcher, no armband. The unit reads as *hooded scavenger with pistol*. If a second unit ships
with the same silhouette grammar, a player will not be able to tell them apart, and the canon
explicitly puts that load on silhouette and equipment profile.

## 3. Material separation (cloth vs metal vs kit) — 2/5

**The intent is right and the execution is below the noise floor.** There genuinely are three
authored hue families in the 26-entry character palette:

- cloth/coat ramp: `#262a2e` → `#3e4744` → `#4c5752` → `#647167`, hue 210→160→153→134
- metal/grey ramp: `#46414a` → `#504b5e` → `#696477` → `#a5a4ab` → `#d4d2d3`, hue 273→249
- kit: `#c8bda9`, hue 39, sat 0.22

That is a real designer's move — cool-green for fabric, cool-violet for hardware, warm neutral for
webbing. It fails on arithmetic. **Both ramps carry 2–11% saturation.** The two nearest neighbours
across the material boundary are:

```
cloth  #3e4744   L 68.9   sat 0.07
metal  #46414a   L 66.7   sat 0.06
```

Two luminance levels apart, six-to-eight RGB levels apart in chroma. That is not a material break;
that is the same grey twice. At 21×32, with 76% of the sprite's colour islands two pixels or
smaller (see the pixel-art-vs-render section), the viewer has no chance of integrating a 6-level
hue shift across scattered singletons into "that part is cloth and that part is steel."

**What does work:** `#c8bda9` (sat 0.22, L 190) is the only entry that separates on both value and
temperature, and it correctly reads as canvas/webbing at the hip. The `#5e2b28 → #7e382f → #8c5141
→ #c46047 → #fc7c5a` orange ramp is a properly constructed five-step accent (sat 0.37 → 0.96).
`#2f9e96` as a lone signal entry is exactly the right structural choice.

**The specific fix is not more colours, it is more contrast per colour.** Cloth and metal need to
part on *luminance* (2–3 stops) or on real saturation (0.20+), not on a 90° hue rotation at 6%
chroma that no downstream pixel can carry.

## 4. Character / environment cohesion — 3/5

The highest score, and it is earned on the structural half. Character and board are unmistakably
from the same world: same warm plum-black ink family, same muted register, same lighting logic,
same magnification grid. No accent leakage from the UI. Composited, the still hangs together as
one image rather than a sprite pasted onto a plate — which is the hard half and it is done.

**But the character owns none of its own colour.** Both of Mara's accents are duplicated by large
environment masses at values indistinguishable from hers:

| | character | environment | Δ |
|---|---|---|---|
| signal teal | `#2f9e96` | floor pad `#349e97` (1,084 px) | **5, 0, 1** |
| dominant orange | `#c46047` | hazard stripe `#c3634a` (638 px) | **1, 3, 3** |

The canon asks for ~25% character/faction identity colour and one dominant accent plus one small
signal accent. Mara has exactly that structure — and then the board wears both of them, in larger
masses, at the same values. Her teal pip and the teal floor pad are the same paint. Her orange
shoulder and the hazard stripe are the same paint. The result is cohesion achieved by
**camouflage**: the character disappears into the environment because it is literally made of the
environment's colours at the environment's luminance.

That is a colour-assignment bug, not a structural one, which is why this is a 3 and not a 2. Move
the world's saturated masses off the two hues the roster reserves and this axis goes to 4 without
touching a model.

## 5. Motion readability — 2/5

### Idle — 8 frames, all unique. **1/5.**

Topmost hood pixel per frame: **28, 28, 28, 30, 30, 28, 28, 28**.

That is **one native pixel** of vertical travel, occurring on **two of eight** frames. Centroid
travel across the whole cycle is 2.1 display px horizontally (≈1 native px) and 3.7 vertically
(≈2 native px). There is no breath. There is no weight shift. The silhouette is static.

Meanwhile, **25–33% of the sprite's pixels change on every single frame step** (442–767 changed
px per transition, no held frames anywhere in the cycle). So the idle is paying eight full frames
of atlas cost to produce *interior churn with a frozen outline* — the single worst combination
available. At combat zoom the player will see a shimmer, read it as compression noise or a render
artifact, and not read it as a living person. An idle that moved the hood 3 native px on a 2-frame
hold would cost less and read better.

### Attack — 12 frames, **6 unique poses**, held 2 / 3 / 1 / 3 / 2 / 1. **2.5/5.**

The timing structure is good and clearly authored: f0=f1, f2=f3=f4, f5, f6=f7=f8, f9=f10, f11.
That is animation on 2s and 3s with a snap on the contact — a hand decision, not uniform sampling.

The arc is real, too. Hood top: 28 → **26** (anticipation, body rises and pulls back, bbox
extends left to x=24) → **36** (contact, body drops 5 native px) → 30 → 28 (settle). Centroid x:
44.1 → 50.4 → **55.3** → 53.4 → 50.7, i.e. 5.5 native px of forward travel then a recovery.
Anticipation, strike, overshoot, settle. That is the correct shape.

**What kills it is that nothing happens at the moment of impact.** Bright-pixel counts per frame:

| frame | L>150 | L>190 |
|---|---|---|
| f02–f04 (windup) | 169 | 48 |
| f05 (strike) | 136 | 42 |
| **f06–f08 (contact/hold)** | **127** | **25** |

**The frame gets darker at the hit.** Highlight energy drops 25% and specular energy drops 48%
exactly when the attack lands. There is no flash, no spark, no arc, no impact shape, no dust, no
recoil punctuation — nothing spends any part of the 5% emission budget on the one moment the
budget exists for. Combined with the contact pose being a forward hunch with the hood over the
shoulders, the attack reads as a **flinch**, not a strike. And it reads as no medical action at
all.

### Turn beat — 12 frames, hold tail + a 4-frame acted change. **3/5.**

The best animation in the artifact. The hold tail is genuinely held (f0=f1, f3=f4, and only
458–1,106 changed px through f2–f7), and then the change is *acted* rather than snapped:

hood top **28 → 20** (f8: rises 4 native px, plants) → 22 (f9) → **36** (f10: drops 8 native px
below the peak, the weight lands) → 28 (f11: settles).

A rise, a plant, a drop, a settle across four frames. That is real animation and it is the single
most character-carrying thing in the artifact. Keep it.

Two problems. First, **f10 is not legible as a body** — at 4× it is a hunched wedge with a dark
blob where the head should be and an orange arm sticking out to the left; you cannot find the
figure's axis in it. Second, because the eight facings share 0.62–0.80 silhouette IoU, the turn's
*outcome* barely registers: after all that weight-shift acting, what changed on screen is which
interior pixels are orange. The turn animates beautifully into a result the viewer cannot see.

---

## Deliberate pixel art, or a shrunken 3D render?

**In between — and the tilt is clear. This is a shrunken 3D render that has had the *colour* half
of a pixel-art conversion done properly and the *drawing* half not done at all.** A viewer at
combat zoom will call it a shrunken render, because clusters and silhouettes are read before
palette entries are.

### What tips it toward deliberate pixel art

1. **The atlas is hard palette-locked.** `facing-sheet-4x.png` contains **exactly 27 unique RGB
   values across 193,536 pixels** — 26 body colours plus the sheet ground `#1b1119`. Not 27
   families; 27 values. There is no antialiasing, no intermediate value, no ramp sample anywhere
   in the character atlas. This is not "quantized-looking," it is quantized.
2. **`#120b10` is a real entry doing a real job** — 5.99% of the sheet, forming a visible 1px rim
   along the hood crown, the left shoulder and the pack in all eight facings.
3. **Integer grid, exact 2× nearest, phase-locked.** Aligned 2×2 blocks: mean internal spread
   3.19. Offset phases: 25.3, 25.5, 46.4. No sub-pixel jitter, no resample mush, no rotated
   pixels.
4. **The quantization comparison earns its bottom row.** Row 1 ("1× render, no filter") has open,
   feathered contours — the hood edge dissolves into the plate and the boot has no bottom line.
   Row 4 ("+1px contour & seams") closes the hood rim and puts a hard seam between coat and boot.
   Unique colours in the tile band drop 4,475 → 2,919 from row 1 to row 3. That contour pass is
   the difference between a blob and a figure and it is genuinely authored.
5. **Animation holds.** f0=f1, f2=f3=f4, f6=f7=f8, f9=f10 in the attack; f0=f1, f3=f4 in the turn.
   Uniform render sampling does not produce 2s and 3s. Somebody chose timing.

### What tips it toward shrunken render — and these are the load-bearing pixels

1. **Cluster fragmentation. This is the decision.** Facing 0 (the pose shipped in the still) is
   **398 body pixels split into 166 flat-colour islands.** Median island size: **1 pixel.** 51% of
   islands are exactly one pixel; **76% are two pixels or smaller.** The largest island in the
   entire figure is 23px (the dark coat mass). The orange accent — the character's *dominant
   identity colour* — is **24 separate islands totalling 46 pixels, sixteen of which are lone
   pixels.**

   Benchmark: `warped-city-animation.png`, the reference the board explicitly names as the
   preferred density, measures **0.21 flat-colour islands per body pixel** (IQR 0.17–0.24, 198
   sampled 34×50 windows). Mara's facing 0 measures **0.42**. She is **twice as fragmented as the
   density target she is aiming at**. Facing 1 (front, the cleanest) is 0.30 with a 13px and a 9px
   orange mass, and is visibly the most readable tile on the sheet — which proves the fix is
   available and just has not been applied to the other seven.

   Palette-quantizing a render does not create clusters. It creates confetti in 26 approved
   colours. That is what the loupe shows: at 4×, the torso is a checkerboard of 1–2px orange /
   light-grey / dark-green with no coherent shape anywhere between the hood and the boots.

2. **The highlights are specular, not focal.** Bright pixels (L>150) span **rows 8 through 30 of a
   32-row body** — 70% of the figure's height — in every facing. And the count swings from **18px
   (facing 4) to 47px (facing 1)**, a 2.6× flicker on the same character under the same light.
   Canon says "focal highlights" at ≤5%; on the body this runs **5–13%** and it is smeared over
   most of the figure. A pixel artist puts the highlight in one place and nails it down. A
   turntable gives you whatever the normal happens to be facing.

3. **The silhouettes wobble.** Across the eight facings the body bbox measures
   32, 32, 33, 31, 31, 30, 31, 31 tall and 21, 16, 16, 21, 20, 16, 16, 21 wide. The same character,
   standing still, on flat ground, under a fixed camera, is **3px (10%) taller in one direction
   than another** and the width alternates in the exact 21/16/16/21 pattern a rotating body
   produces. That variation will be visible as a pop during the turn. No pixel artist ships eight
   facings that do not share a baseline.

4. **The grain is finer than the art's own pixel.** The board is 240×135 shown at 2× — yet a
   ±3-level noise varies *inside* those 2×2 blocks (mean internal spread 2.9 on flat floor). Real
   pixel art cannot do this; it is structurally impossible. It is the textbook signature of a
   post-process film grain applied to the composited output. It also detonates the palette: the
   shipped still holds **6,665 unique colours** where the character atlas holds 26.

5. **The environment was never quantized at all.** After removing the grain, the native 240×135
   frame still needs **339 colours to cover 90% of its pixels**. Its floor is seven near-identical
   plums rolling into each other — `#302630`, `#312630`, `#312a35`, `#302934`, `#2f2833`,
   `#382c38`, `#372b37`, all within 10 levels, all in the top ten masses. That is a render's
   continuous falloff banded only by 8-bit precision, not a dithered boundary between two chosen
   plums. And render AA survived the downscale: scanning y=215 across the teal pad's right edge
   gives `19× #339f96 | 2× #235f5a | 8× #424947` — a single half-tone sample sitting between two
   flats, exactly where a coverage-averaged edge pixel would land.

6. **Facing lives in the interior, not the outline** (IoU 0.62–0.80 across all 28 pairs; opposites
   no more distinct than neighbours). Renders put information in shading; pixel artists put it in
   contour. This puts it in shading.

**Where the line actually sits:** the *character atlas* is on the pixel-art side by palette and
contour and on the render side by cluster structure, silhouette discipline and highlight
placement. The *environment* is on the render side by every measure taken. Two of the four
conversion steps have been done — palette lock and contour — and the two that matter most at 21×32
have not: **cluster consolidation** and **silhouette authoring**.

---

## Strongest problems, ranked

1. **Cluster confetti.** 166 flat-colour islands in 398 body pixels; median island = 1px; the
   dominant accent is 24 islands totalling 46px. Target the reference's ~0.21 islands/px (≈85
   islands for this body), and impose a hard floor: **no accent island smaller than 3px, no more
   than 4 orange islands per facing.** Facing 1 already meets half of this — use it as the model.
2. **21×32 native against a stated 48×64 baseline.** The 2× magnification buys screen size, not
   information. Every other problem on this list gets cheaper at 48×64 and stays expensive at
   21×32. Decide this before another iteration.
3. **Zero value separation between character and ground.** Coat L 41.4 vs floor L 41.5–45.6. The
   figure is held up by a single 1px ink line that dies on 6.1% of the board. Either drop the coat
   2–3 stops, or darken the ground plane under units, or both. This is the difference between a
   unit and a stain.
4. **Both character accents are duplicated by larger environment masses at identical values**
   (teal Δ 5,0,1; orange Δ 1,3,3). Reserve the roster's accent hues; repaint the floor pad and the
   hazard stripe into hues no unit will claim.
5. **The idle has no silhouette motion** — 1 native px of head travel on 2 of 8 frames, while
   25–33% of interior pixels churn every step. Costly and unreadable. Move the hood 3 native px,
   hold frames, cut the interior churn.
6. **The attack has no impact.** Bright pixels *drop* from 169 → 127 (and L>190 from 48 → 25) at
   contact. Spend the emission budget there — a 2-frame flash, an arc shape, a dust puff — and give
   the contact pose an extended limb instead of a hunch. Right now it reads as a flinch.
7. **No medic identity in any of eight facings.** No cross, no satchel, no vial, no drip, no
   armband. At 21×32 this must be a large silhouette-breaking shape (a shoulder-slung kit that
   changes the outline), not a colour patch.
8. **Output-resolution grain below the art's pixel size**, producing 6,665 colours in the shipped
   still. Either move the grain into the 240×135 layer as a real 2-value dither, or delete it — it
   is invisible as texture and it costs the palette lock.
9. **The board is empty and unlit.** 68.7% featureless floor, 76.5% of the play field inside a
   40-level luminance window, 0.1% above L 180, no light source, no market. Add near-black massing
   and one or two localized warm sources; the character has nothing to be read against.
10. **Facing is not in the silhouette** (IoU 0.62–0.80 across all pairs, opposites included). Give
    the front and back facings distinct outline events — a pack that only reads from behind, a
    hood profile that only reads from the side.
11. **Highlight budget over and unstable** — 5–13% of body pixels above L 150, swinging 2.6×
    between facings, smeared across 70% of the figure's height. Pick one focal highlight and lock
    it across all eight facings.
12. **Body height varies 30–33px across the facings** (10%). Fix a shared baseline and a fixed
    height before any of the above is worth doing.

## Must not be lost

- **The 26-entry character palette.** Six coherent material families — plum-black ink
  (`#120b10 → #2c2530`), green-grey cloth ramp, violet-grey metal ramp, cream `#c8bda9`, a
  five-step orange ramp, and `#2f9e96` as a single signal — inside 26 entries is genuinely good
  palette design. The ramps need more contrast, not replacement.
- **`#120b10` as a live ink entry** at 5.99% of the sheet, and the 1px contour pass in row 4 of the
  comparison. That contour is the only reason the figure is a figure. Keep it and close it all the
  way around the legs.
- **The refusal of the UI accents.** Zero pixels within Δ10 of `#ff2e6c` or `#c8f031` in the whole
  still. Hold that line.
- **The hood/pack cap at the top of the figure** — the one shape that survives grayscale
  conversion intact. Build the rest of the silhouette out from it.
- **The turn beat's weight shift** — rise 4 native px at f8, drop 8 at f10, settle at f11. This is
  real acting and the most character-carrying thing in the artifact. Whatever changes, this
  survives.
- **The attack's hold structure** (2/3/1/3/2/1) and its anticipation→strike→settle arc (5 native
  px of drop, 5.5 of forward travel). The timing is right; only the punctuation is missing.
- **Eight genuine facings, not four mirrored.** Mirror-pair IoU is indistinguishable from the
  adjacent-pair control; the sidearm stays in the same hand all the way around. Do not regress to
  flipping.
- **Exact 2× integer presentation, phase-locked, no bilinear smear.** Whatever else changes, the
  pixel grid stays honest.
