# Cold critique — i2 · Mara Voss on the grime-market board

```
SCORES i2: gritty 3/5 · silhouette 3/5 · material 2/5 · cohesion 4/5 · motion 3/5
SCORES i1: gritty 2/5 · silhouette 2/5 · material 2/5 · cohesion 3/5 · motion 2/5
```

**VERDICT: NOT YET** (bar: 4 or better on every axis — only cohesion reaches 4)

## Provenance

Looked at, and only at:

- `controlled-still-combatzoom.png` (480×270)
- `loupe-4x.png` (384×416; verified exact 4× nearest crop of the still at offset 200,124 — zero
  pixel error, same offset as i1)
- `facing-sheet-4x.png` (1152×168; exact 4× nearest of a 288×42 sheet, 8 tiles of 36×42)
- `filmstrip-idle.png` (2133×288 → 8 tiles), `filmstrip-attack.png` (3201×288 → 12),
  `filmstrip-turn-beat.png` (3201×288 → 12); all verified exact 3× nearest → 88×96 native tiles
- `quantization-comparison.png` (800×976 — **five** rows now, was four; all verified 4× native)
- `atlas-cost.json`
- the three GIFs, decoded to frames (`idle` 8, `attack` 12, `turn` **82**)
- `cold-critique-i1.md`
- `docs/art-direction/reference-board/README.md` and
  `exploration/warped-city-animation.png` (re-measured as the density benchmark — see below,
  because **i1's use of it was wrong**)

No source, no history, no other screenshots directory.

**Units.** The still is a 240×135 image at exact 2× nearest, phase (0,0): aligned 2×2 blocks are
98.1% internally uniform within 6 levels per channel, versus 89.7 / 83.9 / 76.2% at the three
offset phases. Mara is a **22×32 native character** — her atlas cell round-trips into the still at
**100.0% exact pixel match** at native (115,77). Filmstrip tiles are in that same 2× space, so I
report filmstrip travel in native art pixels (half the tile numbers).

---

## 1. Gritty / dangerous / lived-in — 3/5

**What genuinely moved, and it is the biggest single improvement in the artifact.**

i1's most damning finding was that the board was a render with grain sprinkled on top: 6,665
unique colours in the shipped still, 339 colours needed to cover 90% of the native frame, and a
±3-level noise varying *inside* the 2×2 art blocks. All of that is gone.

| | i1 | i2 |
|---|---|---|
| unique colours, shipped still | 6,665 | **344** |
| unique colours, play field only | — | **162** |
| colours to cover 90% of the play field | 339 | **8** |
| aligned 2×2 block uniformity | 94.4% | **98.1%** |

And the grain was not merely deleted — it was **replaced with a real dither at the art's own pixel
size**. The open floor is a two-colour checker of `#241a22` and `#211820` in 2×2 blocks; 49% of
`#241a22` pixels touch a `#211820` pixel. Island density on the floor plums is 0.004–0.026
islands/px with a single largest island of **5,379 px**. That is authored flat massing, not banded
falloff.

The board also gained content. Eight discrete non-floor structures now occupy 12% of the play
field, including a 53×41 kiosk with a rust `#5e2b28` awning, a 58×20 lit-teal `#1c5a55` panel, a
70×17 counter mass, an overhead rail spanning 72 px, an antenna, and two floor stains. i1's
"featureless mid-plum floor" share drops **68.7% → 23.7%**, and near-black massing rises
**6.1% → 15.6%** of the play field below L 20.

**Why it is a 3 and not a 4.**

*Still no light source, and the frame is dimmer than i1's.*

| | i1 | i2 |
|---|---|---|
| play field above L 128 | — | **0.09%** |
| play field above L 180 | 0.1% | **0.01%** |
| whole frame above L 180 | — | 0.08% |
| play field mean L | — | 30.4 |

The canon budget is "≤ ~5% bright emission and focal highlights." This frame spends **1/50th** of
it. REPLACED and Warped City buy menace with *large near-black masses **against** localized
saturated light*. i2 delivered the near-black masses and skipped the light. The teal panel that
looks like a window is L 76.5 — it is a dark painted surface, not an emitter. Half of the formula,
executed well, reads as *quiet*, not *dangerous*.

*And it is still not lived-in.* Native edge density is **10.7% horizontal / 14.9% vertical** —
i1 measured 10.9 / 15.4. **Unchanged to within noise.** The new structures are bigger and better
massed but their surfaces are still unbroken planes: no goods, no signage, no awning fabric, no
crates, no cabling, no rust streaks, no debris field, no spill. 88% of the play field is bare floor
plane. It now reads as a shuttered plaza at 3am. "Grime market" is the brief and there is nothing
on sale.

## 2. Silhouette + equipment readability at combat zoom — 3/5

**The figure/ground failure is fixed, and it is fixed properly.**

i1's core measurement was that the coat (L 41.4) and the floor (L 41.5) were the same value and the
whole figure hung on a single 1-px ink line. i2 inverts the strategy: the ink is now the dominant
character mass and the ground is lit around it.

| | i1 | i2 |
|---|---|---|
| figure rim luminance | (coat) 41.4 | **12.8** |
| adjacent ground luminance | 41.5–45.6 | **34.7** |
| **Δ** | **~0** | **21.8** |
| `#120b10` share of the sprite bbox | 9.7% | **21.9%** |
| play field darker than the rim | 6.1% below L 20 | **0.06%** |

Grayscale-converting the shipped pose confirms the read. Posterized into four value buckets, the
midtone band is **173 px in 13 islands with a 94-px largest island** — a coherent body, where i1
found "an undifferentiated mid-grey with speckle." The hood cap, the extended weapon arm and the
boots all separate.

**There is now a medic.** Facing 1 carries an unmistakable cream-on-orange cross at the chest,
5×4 native px, with 80% of its perimeter in the orange accent:

```
rows 19–22, x 17–21     4 4 W 4 4        W = #c8bda9 cream
                        4 W W W 4        4 = #c46047 orange
                        4 W W W 4
                        4 4 W 4 4
```

Cream kit is present in **all eight** facings (6–18 px), and the hand prop now reads as an injector
with a teal `#2f9e96` needle tip rather than i1's "light-grey sidearm." i1's problem 7 said there
was no cross, no satchel, no vial, no armband anywhere. There is now.

**Why it is a 3 and not a 4.**

1. **The pose the artifact actually ships carries no medic marker.** The cross survives the
   `>=50% orange perimeter` test on facings 1, 2, 5 and 6 only. **Facing 0 — the pose in the
   controlled still, the loupe, and the whole idle loop — has none.** Its cream is three islands of
   7 / 6 / 4 px scattered at the collar, hip and boot. Half the roster's viewing angles show a
   hooded scavenger with a pistol.
2. **Facing is still not in the silhouette, and it got marginally worse.** Full 8×8 IoU matrix at
   best alignment: **0.64–0.85** (i1: 0.62–0.80), mean 0.74. The 180°-opposite pairs mean **0.74**;
   the 45° neighbours mean **0.77**. Opposites are *no more distinct than neighbours*, exactly as
   in i1. f1/f6 is 0.85 and f5/f6 is 0.84 — those are the same outline.
   (Credit preserved: mirror-pair IoU 0.72 vs the adjacent-pair control 0.77 — still eight genuine
   renders, not four flips.)
3. **The feet float.** The compositor anchors the sprite's **top** row: all eight facings place at
   board y=77. Atlas heights are 32,32,32,31,31,30,31,31, so the residual variation lands on the
   base. Across the eight settled facings in the turn GIF the **feet row moves 108 → 106** (2
   native px) and the **foot centroid wanders 120.7 → 125.0** (4.3 native px). A unit standing still
   on a floor should not rise 4 screen pixels off it when she turns her back. The one end that must
   be nailed down is the end that moves.
4. **The bright reads are still confetti.** Light + highlight buckets together are **96 px in 39
   islands, largest 11 px.** The dark and mid structure consolidated; the light did not.

## 3. Material separation (cloth vs metal vs kit) — 2/5 (held)

**The character palette is unchanged from i1 — 26 body entries plus the sheet ground `#1b1119`,
and every hex i1 quoted is still present.** The single arithmetic failure i1 named is untouched:

```
cloth  #3e4744   L 68.9
metal  #46414a   L 66.7      dL = 2.2      <- identical to i1
```

i1's prescription was explicit: *"cloth and metal need to part on luminance (2–3 stops) or on real
saturation (0.20+)."* Neither happened. The cloth ramp runs L 41 → 69 → 84 → 110 and the metal ramp
L 67 → 77 → 102 → 165 → 210; they overlap across their whole working range, and their saturations
are 0.12–0.13 and 0.12–0.20 on an HSV S scale. Two greys, still.

**What did improve is spatial, not chromatic.** On facing 0 the cloth is now **45 px in a single
island**, where i1 found it scattered. That is a real readability gain. But metal is still **63 px
in 12 islands, largest 14**, and — critically — only 6% of metal pixels touch cloth, so the two
families now mostly avoid each other rather than parting from each other. You cannot demonstrate a
material break between two masses that never meet, and where they do meet they are 2 luminance
levels apart.

The genuinely good entries survive: `#c8bda9` (L 190) still reads as canvas/webbing on both value
and temperature, and it is now doing identity work as the cross. `#2f9e96` remains the correct
single-signal choice.

This axis scores exactly what it scored in i1 because the file that causes the score was not
modified.

## 4. Character / environment cohesion — 4/5

**This axis clears the bar.** i1's diagnosis was cohesion-by-camouflage: both of Mara's accents
were duplicated by larger environment masses at indistinguishable values. Measured against the
environment of the shipped still:

| | i1 Δ | i2 nearest environment colour | i2 Δ |
|---|---|---|---|
| signal teal `#2f9e96` (L 134) | (5, 0, 1) | `#1c5a55` (L 76.5, 341 px) | **(19, 68, 65)**, ΔL **57** |
| bright accent `#c46047` (L 116) | (1, 3, 3) | `#8c5141` (L 92, 278 px) | **(56, 15, 6)**, ΔL **23** |
| lit accent `#fc7c5a` (L 149) | — | nothing within ΔRGB 160 | **exclusive** |

The teal camouflage is gone outright, and the top two steps of the orange ramp are now the
character's alone. **Structural cohesion is also stronger than i1's**: character and board now share
one quantization discipline, one 2× grid, one ink family, and one dither vocabulary. Composited,
this is one image.

**The one point withheld.** The *base* of the character's orange ramp is still environment paint,
and not approximately — exactly:

```
character #7e382f  ==  environment #7e382f   dRGB (0,0,0)   795 env px
character #5e2b28  ~~  environment #5e2b28                  607 env px
character #8c5141  ~~  environment #8c5141                  278 env px
```

**39 of facing 0's 57 orange pixels (68%) sit in ramp steps the environment owns in larger masses.**
The bright tips are exclusive; the mass underneath them is shared. Move the shadow steps of the
roster's accent ramp off the kiosk awning and this is a 5.

**The refusal of the UI accents holds.** Zero pixels within ΔRGB 10 of `#ff2e6c` or `#c8f031`
anywhere in the frame. The only near-chartreuse pixels in the file (5 of them, `#b6d92d` /
`#accd2b` / `#a0bf29`) are all on native row 121 inside the "FIELD MEDIC" caption chrome — UI, not
asset. Line held.

## 5. Motion readability — 3/5

### Idle — 8 frames, **6 unique**, holds at f0=f1 and f4=f5. **2.5/5.**

i1's ask was verbatim: *"Move the hood 3 native px, hold frames, cut the interior churn."* Two of
three delivered.

- **Hood travel: 1 native px → 3 native px.** Tile-space tops are 28, 28, 26, 24, 22, 22, 24, 26 —
  a smooth 6-step rise and fall, not i1's two-frame blip.
- **Holds exist**: 6 unique frames of 8, where i1 had 8 of 8.
- **The churn went up, not down.** Changed pixels per step are **732–1,256** (i1: 442–767), which
  is **40–68% of the body every step**. Consecutive-frame silhouette IoU is **0.88–0.95** — the
  outline barely moves — while the churn-to-silhouette ratio runs **5.5 to 7.3**: for every
  silhouette pixel that changes, six to seven interior pixels change.

Rendering the per-pixel change count over the cycle produces a body that is bright almost
everywhere. The single worst combination i1 identified — *frozen outline, boiling interior* — is
still what the player sees, and the boil is now louder. The hood rise is a genuine improvement
sitting on top of an unresolved defect.

### Attack — 12 frames, 6 unique, holds 2 / 3 / 1 / 3 / 2 / 1. **3/5.**

The timing structure and the arc are preserved intact — hood 26 → 34 in tile space (**4 native px**
of drop at contact), centroid **6 native px** of forward travel then recovery, bbox widening 42 → 49
as the arm extends. Read as key poses, it is now legible as a medic driving an injector: rest →
windup with the injector raised → strike with the arm high → forward lunge on contact → settle. i1
called the contact "a flinch"; it no longer is.

**Impact punctuation now exists — and it is one pixel.** A new palette entry `#a8f0e4` (L **223.8**,
the brightest value in the whole artifact) appears on frames 6, 7 and 8 at coordinates
(36–37, 70–71) — the injector tip. That is **4 screen px = 1 native art pixel**, held 3 frames.

And the frame *still gets darker at the hit*:

| | i1 L>150 | i2 L>150 | i2 L>190 |
|---|---|---|---|
| windup (f2–f4) | 169 | **172** | 12 |
| strike (f5) | 136 | **132** | 8 |
| **contact (f6–f8)** | 127 | **128** | **28** |

The L>150 curve is statistically identical to i1's. The one real reversal is L>190, which now
**rises 12 → 28** at contact instead of falling 48 → 25. So the specular energy finally peaks on the
right frame — but the total light still drops, and there is no arc, no dust, no impact shape, no
recoil frame. One native pixel of cyan is a hint, not comic-book punctuation, and it is spending
0.08% of a 5% budget.

### Turn — 82-frame GIF, 64 unique; 12-frame filmstrip beat, 9 unique. **3.5/5.**

Still the best animation here, and it grew. The full turn visits all eight facings in order, each
with a **3-frame settle hold** (atlas match 0.89–0.93) and 7–8 acted intermediate frames between
settles. That is a real turn cycle, not a snap.

The acted beat is stronger than i1's: hood tops 28, 28, 28, 26, 26, 24, 28, 30, **22**, 24, **38**,
30 in tile space — a **3-native-px rise to a plant, then an 8-native-px drop, then a settle**. And
unlike i1, the turn now **changes the outline**: bbox width narrows 44 → 40 → 33 → 39 → 35 across
the back half, and per-step silhouette IoU falls to **0.628**. i1's complaint that "the turn
animates beautifully into a result the viewer cannot see" is partly answered *during* the beat.

It is still not answered at the *destination*. The eight settled facings share 0.64–0.85 IoU, so
after all that weight-shift acting the reader still cannot distinguish f1 from f6 (0.85) or f5 from
f6 (0.84). And the 2-native-px foot float lands on every one of these settles.

---

## Deliberate pixel art, or a shrunken 3D render? — re-measured

**Answer: deliberate pixel art in everything except the light. The environment crossed the line
completely; the character's dark and mid values crossed it; the character's highlights did not.**
That is a clear move from i1's "in between, tilting render."

### First — i1's deciding measurement was wrong, and I have to say so

i1 ranked cluster confetti #1 on the strength of this: *"`warped-city-animation.png` measures 0.21
flat-colour islands per body pixel … Mara's facing 0 measures 0.42. She is twice as fragmented as
the density target she is aiming at."*

`warped-city-animation.png` is 250×179 and **fully opaque — there is no alpha channel**. `#00003c`
and `#00003b` (which differ by one level and are the same navy) together are **90.0% of the image**.
Measuring "islands per body pixel" over the whole image measures the flatness of an empty backdrop,
not the sprites. i1 got 0.21; I reproduce 0.206 with the same method. It is the same wrong number.

Measured **on the sprite pixels only**, with the file's compression noise (2,648 colours in a
250×179 pixel-art sheet) cleaned off first:

| cleaning | warped-city median isl/body-px |
|---|---|
| quantize to 8 colours | 0.323 |
| quantize to 12 | 0.376 |
| quantize to 16 | **0.498** |
| quantize to 24 (closest to Mara's 26-entry atlas) | 0.556 |
| quantize to 32 | 0.600 |

Across 15 sprites the 16-colour clean gives median island **1 px**, **85%** of islands ≤2 px, and a
largest island that is **9% of the body**.

Mara i2: **0.335** sheet-wide, **0.399** on facing 0, median island 1–2 px, 73% ≤2 px, largest
island 31 px = **7.5% of the body**.

**She is at or below the reference on every one of those numbers.** The claim that she is twice as
fragmented as her stated density target does not survive re-measurement, at any cleaning setting.
Cluster confetti versus the reference board is not the deciding measurement, and i1 should not have
made it one.

### Second — the fragmentation finding that *does* survive is the pipeline's own

`quantization-comparison.png` now has five rows. Measured at native, body pixels only:

| row | body px | colours | islands | **isl/px** | singletons | largest island |
|---|---|---|---|---|---|---|
| 1 · 8× render, box-downsampled | 1,067 | 821 | 938 | 0.879 | 95.6% | 19 |
| 2 · 1× render, no filter | 912 | 179 | 584 | 0.640 | 76.4% | 14 |
| 3 · + Direction B palette | 912 | 24 | 199 | 0.218 | 35.7% | 48 |
| 4 · + cluster consolidation | 912 | 24 | 124 | **0.136** | **0.0%** | **51** |
| 5 · + 1px contour & seams — **SHIPS** | 1,165 | 26 | 447 | **0.384** | **47.7%** | 31 |

**The contour-and-seam pass throws away the consolidation it was just handed.** Island density goes
back up **2.8×**, singletons go from **zero to 47.7%**, and the largest consolidated mass is cut
from 51 px to 31 px — the seams carve straight through it.

And `atlas-cost.json` reports:

```json
"clusterDensity": { "after": 0.129, "singletonShareAfter": 0.0126 }
```

That is **row 4**. The shipped atlas is **row 5 — 0.384 isl/px and 47.7% singletons**. The cost file
is describing an intermediate buffer, off by 3× from the file it ships, and it is the single number
a reader would trust to decide this exact question. Fix the number or fix the pass; do not ship
both.

The consolidation is measurably real where the contour pass leaves it alone. Merged across the five
ramp steps, the orange accent on facing 0 is now **57 px in 5 islands of 22 / 18 / 9 / 5 / 3** —
against i1's *"24 separate islands totalling 46 pixels, sixteen of which are lone pixels."* i1's own
prescribed floor was *"no accent island smaller than 3px, no more than 4 orange islands per
facing"*; f0 hits 5 islands with a minimum of 3. f3, f5 and f7 hit 4 exactly.

### What still tips render

1. **The interiors of the consolidated masses are still ramp noise — and worst on the shipped
   facing.** The largest orange mass on f7 is banded like drawn shading (0–4% of internal
   adjacencies jump ≥3 ramp steps):
   ```
   f7:  33335        f0:  .33.
        35535             235553
        44422             111535
        ..44.             11112.
   ```
   Facing 0's equivalent mass runs 9–12% ramp jumps, alternating levels 1/2/3/5 between touching
   pixels. The confetti did not disappear; on half the facings it moved down one level, from the
   silhouette to the ramp. The outline of the mass is authored; the shading inside it is not.
2. **Highlight placement still tracks the camera, and the flicker got worse.** Body pixels above
   L 150 across the eight facings: **32, 34, 23, 16, 12, 18, 12, 29** — a **2.8× swing** on the same
   character under a fixed light (i1: 2.6×). Row span narrowed usefully (13–22 of 32 rows, i1: 23 in
   every facing) and the budget improved (3.0–9.3% of body, i1: 5–13%), but it is still over the ≤5%
   canon on four of eight facings, and a pixel artist puts the highlight in one place and nails it
   down. This is a turntable.
3. **Head-anchored compositing.** Feet 106–108, foot centroid 120.7–125.0 across eight settles. No
   pixel artist ships a standing character whose baseline is derived rather than authored.
4. **The idle relights instead of moving.** Churn-to-silhouette ratio 5.5–7.3 with consecutive IoU
   0.88–0.95. Recomputed shading is what varies; drawn form is not.
5. **Facing lives in the interior.** IoU 0.64–0.85, opposites (0.74) no more separated than
   neighbours (0.77).

### What now tips it firmly to pixel art

1. **The environment is fully quantized and dithered.** 162 colours in the play field, 8 covering
   90%, island density 0.004–0.026 with a 5,379-px largest floor mass, and a genuine 2-colour 2×2
   dither. **Render AA is gone from the edges** — i1 found `19× #339f96 | 2× #235f5a | 8× #424947`,
   a coverage half-tone sitting between two flats; scanning now gives clean flat runs separated by
   hard `#120b10` seams (`26× #1c5a55 | 6× #120b10 | 4× #6e413c | 5× #8c5141`). No intermediate
   samples anywhere I looked.
2. **The atlas is still hard palette-locked** — 27 exact RGBA values across the 4× sheet, no
   antialiasing, and it round-trips into the shipped still at **100.0% exact pixel match**
   (`atlasRoundTripMismatchedPixels: 0` is honest).
3. **`#120b10` is now doing structural work**, at 21.9% of the sprite bbox and 13.2% of the play
   field, holding a Δ21.8 luminance break against the ground.
4. **The comparison sheet earns its own argument.** Row 1's naive 8× shrink measures 0.879 isl/px
   and 95.6% singletons — that is what a shrunken render actually looks like, and the shipped row
   is 56% of the way from there to flat art.
5. **Animation timing is authored**: 2s and 3s in the attack, holds in the idle, 3-frame settles in
   an 82-frame turn.

**Where the line sits now:** the environment is on the pixel-art side by every measure I took. The
character is on the pixel-art side by palette, contour, ink, dark/mid massing and timing, and on the
render side by highlight placement, ramp-interior noise, baseline anchoring and idle churn. It
reads as pixel art at a glance and as a render the moment you look at where the light lands.

---

## Resolution of i1's twelve ranked problems

| # | i1 problem | status | deciding measurement |
|---|---|---|---|
| 1 | Cluster confetti (166 islands / 398 px) | **PARTLY — and the benchmark was wrong** | Shipped f0: 164 islands / 411 px = 0.399 vs i1's 0.417 — a 4% change. But the reference re-measured on sprite pixels only is **0.32–0.60**, not 0.21, so Mara was never 2× the target. Real defect that survives: contour pass re-fragments 0.136 → 0.384 and `atlas-cost.json` reports the pre-contour number. Orange accent 24 islands → **5 merged islands** (22/18/9/5/3) — i1's own floor met. |
| 2 | 22×32 native against a 48×64 baseline | **NOT ADDRESSED — but no longer a defect** | Still 22×32 at exact 2×, 100% atlas round-trip. The canon in this brief now names "integer 2× over a 24×32-class authored character," so the artifact is in spec by canon revision, not by change. Neutral; every other problem stays expensive at this budget. |
| 3 | Zero value separation character/ground | **FIXED** | Rim L 12.8 vs adjacent ground L 34.7, **Δ 21.8** (i1: ~0). Only **0.06%** of the play field is darker than the rim. Traded, not free: **15.6%** of the play field is now within 6 L of the ink, up from 6.1% below L 20 — the rim will thin on the new dark masses. |
| 4 | Both accents duplicated by the environment | **PARTLY** | Teal Δ(5,0,1) → **Δ(19,68,65), ΔL 57** — fixed. `#c46047` nearest env now Δ77, `#fc7c5a` exclusive — fixed. But `#7e382f` is an **exact (0,0,0) duplicate** over 795 env px; **68% of f0's orange** is in shared ramp steps. |
| 5 | Idle has no silhouette motion | **PARTLY** | Hood travel **1 → 3 native px** (i1's exact ask) and holds introduced (6 unique of 8). But churn rose **442–767 → 732–1,256 px/step** (40–68% of body), ratio 5.5–7.3, consecutive IoU 0.88–0.95. Frozen outline + boiling interior persists and is louder. |
| 6 | Attack has no impact | **PARTLY** | New emission entry `#a8f0e4` (L 223.8) on the 3 contact frames, and **L>190 rises 12 → 28** at contact (i1: fell 48 → 25). But it is **4 screen px = 1 native art px**, L>150 still **drops 172 → 128**, and there is no arc, dust or impact shape. |
| 7 | No medic identity in any facing | **PARTLY — identity exists, the shipped pose lacks it** | A 5×4 cream-on-orange **cross** now exists (f1 rows 19–22, 80% orange perimeter); cream kit in all 8 facings; injector with teal needle tip. But the cross passes the test on **4 of 8** facings, and **facing 0 — the still, the loupe, the entire idle — has none.** Still a colour patch, not the silhouette-breaking shape i1 asked for. |
| 8 | Output-resolution grain, 6,665 colours | **FIXED** | Still: **6,665 → 344** colours; play field 162; **8 colours cover 90%** (i1: 339). Grain replaced with a real 2-colour 2×2 dither (49% adjacency). 2× phase-(0,0) uniformity 94.4% → **98.1%**. |
| 9 | Board empty and unlit | **PARTLY** | Featureless floor **68.7% → 23.7%**; near-black massing **6.1% → 15.6%**; 8 real structures. But **no light source** (play field L>128 = 0.09%, L>180 = **0.01%**, *worse* than i1's 0.1%); edge density **10.7/14.9 vs 10.9/15.4 — unchanged**; 88% bare floor plane; no goods, signage, cabling or wear. |
| 10 | Facing is not in the silhouette | **NOT ADDRESSED / marginally REGRESSED** | IoU **0.62–0.80 → 0.64–0.85**, mean 0.74. Opposites 0.74 vs neighbours 0.77 — still indistinguishable. f1/f6 = 0.85. |
| 11 | Highlight budget over and unstable | **PARTLY** | Body share **5–13% → 3.0–9.3%**, row span 23 rows → **13–22 of 32** (more localized). But flicker **2.6× → 2.8×** (12–34 px) and light+highlight is still **96 px in 39 islands, largest 11**. |
| 12 | Body height varies 30–33 px | **PARTLY, and anchored at the wrong end** | Heights **30–33 → 30–32**, all eight atlas tops locked to row 8. But the compositor pins the **top**, so the residual lands on the base: **feet row 108 → 106** (2 native px) and **foot centroid 120.7 → 125.0** (4.3 native px) across the eight settles. |

Tally: **2 fixed, 8 partly, 1 not addressed (regressed), 1 neutralized by canon.**

---

## Strongest remaining problems, ranked

1. **The contour pass discards the cluster consolidation, and the cost file hides it.** 0.136 →
   0.384 isl/px, 0% → 47.7% singletons, largest mass 51 → 31 px, all in the last stage of the
   pipeline. `atlas-cost.json` publishes 0.129 / 1.26% — the row-4 numbers — for a row-5 artifact.
   Draw the contour without slicing the interior, and make the reported number measure the shipped
   PNG.
2. **Cloth and metal are still the same grey.** `#3e4744` L 68.9 vs `#46414a` L 66.7, ΔL 2.2 —
   byte-identical to i1, on the axis whose entire diagnosis was this arithmetic. Part them 2–3
   luminance stops or push one family past 0.20 saturation. Nothing else on this axis matters until
   that happens.
3. **The board has no light.** 0.09% of the play field above L 128, 0.01% above L 180, in a world
   whose canon budgets ~5% for emission and focal highlights. The near-black massing landed; put one
   or two localized warm/saturated sources against it. Right now the improvement in dark massing has
   nowhere to be dramatic.
4. **Facing is not in the outline.** IoU 0.64–0.85 with opposites no more distinct than neighbours.
   Give the back facings a pack that breaks the crown line and the side facings a hood profile that
   only exists in profile. The turn beat is now good acting arriving at an invisible result.
5. **The idle boils.** 732–1,256 changed px per step against 0.88–0.95 silhouette IoU; ratio 5.5–7.3.
   Keep the 3-px hood rise, keep the holds, and cut the per-frame relight — quantize the idle's
   interior to a small number of authored states rather than re-shading every frame.
6. **Feet float 2 native px across the turn.** Anchor the composite on the base row, not the top row.
   This is a one-line fix producing a visible pop on every turn.
7. **The shipped pose has no medic marker.** The cross reads on 4 of 8 facings and not on facing 0.
   Carry it to every angle, or move the identity into a shoulder-slung kit that changes the outline.
8. **68% of the character's orange is environment paint.** `#7e382f` is an exact duplicate over 795
   environment pixels. Reserve the roster's accent ramp — all five steps, not just the top two.
9. **Highlight flicker 2.8× across facings**, light+highlight 96 px in 39 islands. Pick one focal
   highlight and lock its position across all eight facings.
10. **Ramp interiors are still render-shaded on half the facings.** f0's largest orange mass jumps
    ≥3 ramp steps on 9–12% of its internal adjacencies; f7's jumps on 0–4%. f7 is the model — the
    consolidation pass needs to order the ramp, not just merge the outline.
11. **The board is still not lived-in.** Edge density unchanged at 10.7/14.9%. Break the plane
    surfaces: goods, signage, cabling, crates, wear, spill.
12. **The attack's punctuation is one native pixel.** Give the contact a 2-frame shape — an arc, a
    spray, a dust puff — that spends a visible fraction of the emission budget.

## Must not be lost

- **The environment quantization and the 2×2 dither.** 6,665 → 344 colours, 8 covering 90% of the
  play field, a real two-plum dither at the art's own pixel size, and render AA eliminated from
  every edge I scanned. This is the single biggest thing i2 did and it must never regress.
- **The `#120b10` figure/ground strategy.** Rim L 12.8 against ground L 34.7, Δ 21.8, ink at 21.9%
  of the sprite bbox. This is what turned a stain into a unit.
- **The 26-entry character palette's structure** — plum-black ink, green-grey cloth ramp,
  violet-grey metal ramp, cream `#c8bda9`, a five-step orange ramp, `#2f9e96` as a single signal.
  The ramps need contrast, not replacement. (Unchanged since i1, and still good design.)
- **The medic cross** — 5×4 cream on orange, 80% orange perimeter. Correct scale, correct
  placement, correct colour assignment. Propagate it; do not shrink it.
- **The injector read** — light-grey body with a `#2f9e96` needle tip, plus the attack pose reading
  as a jab rather than a flinch. That is character.
- **The merged orange accent masses** — 5 islands of 22/18/9/5/3 on f0, and the clean banded
  interiors on f7. This is what the whole figure should look like.
- **The turn cycle.** 82 frames, 64 unique, 3-frame settles at all eight facings, 7–8 acted
  intermediates, an 8-native-px weight drop, and a silhouette that actually narrows 44 → 33 during
  the beat. Best thing in the artifact for the second iteration running.
- **The attack's hold structure** (2/3/1/3/2/1) and its anticipation → strike → settle arc, now with
  L>190 peaking on the correct frame.
- **The idle's 3-native-px hood rise and its two held pairs.** Half of i1's ask, delivered.
- **Eight genuine facings, not four mirrored.** Mirror-pair IoU 0.72 against an adjacent-pair
  control of 0.77 — statistically indistinguishable, so these are still eight real renders.
- **Exact 2× integer presentation, phase-locked**, 98.1% aligned-block uniformity, 100.0% atlas
  round-trip into the shipped still, and a loupe that is a zero-error 4× crop at offset (200,124).
  The presentation is honest and stays honest.
- **The refusal of the UI accents.** Zero pixels within ΔRGB 10 of `#ff2e6c` or `#c8f031` in the
  whole frame; the only near-chartreuse pixels are caption chrome. Hold that line.
- **The five-row quantization comparison itself.** Adding the naive 8× shrink as row 1 (0.879
  isl/px, 95.6% singletons) and the consolidation stage as row 4 makes the pipeline auditable. It is
  how I found problem #1 above. Keep publishing it — and make row 4's number stop masquerading as
  row 5's.
