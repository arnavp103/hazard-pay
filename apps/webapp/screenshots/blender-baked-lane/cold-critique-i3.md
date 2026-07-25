# Cold critique — i3 · Mara Voss on the grime-market board

```
SCORES i3: gritty 3/5 · silhouette 3/5 · material 2/5 · cohesion 4/5 · motion 3/5
SCORES i2: gritty 3/5 · silhouette 3/5 · material 2/5 · cohesion 4/5 · motion 3/5
SCORES i1: gritty 2/5 · silhouette 2/5 · material 2/5 · cohesion 3/5 · motion 2/5
```

**VERDICT: NOT YET** (bar: 4 or better on every axis — only cohesion reaches 4, for the second
iteration running)

The scores are identical to i2 and that is the finding. i3 did one thing, did it decisively, and
did it to the pipeline: **the contour pass stopped shredding the consolidation, and the number in
`atlas-cost.json` now describes the pixels that ship.** That was i2's #1 ranked problem and it is
genuinely fixed — the shipped atlas measures 0.134 islands/body-px against i2's 0.399, with
singletons down from 47.7% to 0.2%. Everything else on i2's ranked list — the cloth/metal
arithmetic (#2), the facing silhouettes (#4), the idle boil (#5), the medic marker on the shipped
pose (#7), the shared orange ramp (#8), the one-pixel impact (#12) — is untouched, and the
animation is frame-for-frame the same animation recoloured. The board's light moved from "none" to
"one value of amber at L 114", which is not yet light.

---

## Provenance

Looked at, and only at:

- `controlled-still-combatzoom.png` (480×270, 350 unique colours)
- `loupe-4x.png` (384×416 — re-verified as an exact 4× nearest crop of the still at native offset
  (200,124), **zero pixel error**, same offset as i1 and i2)
- `facing-sheet-4x.png` (1152×168 → exact 4× nearest of a 288×42 sheet, **zero pixel error**;
  8 tiles of 36×42; RGBA with alpha uniformly 255; **27 exact colours**)
- `filmstrip-idle.png` (2133×288 → 8 tiles), `filmstrip-attack.png` (3201×288 → 12),
  `filmstrip-turn-beat.png` (3201×288 → 12); all verified exact 3× nearest, 88×96 tiles
- `quantization-comparison.png` (800×976; five panels at rows 75–242, 255–422, 435–602, 615–782,
  795–962, x 194–641; every panel verified exact 4× of a 42×112 native, zero error)
- `atlas-cost.json`
- the three GIFs decoded to frames (`idle` 8 → 6 unique, `attack` 12 → 6 unique, `turn` 82 → 64
  unique)
- `cold-critique-i1.md`, `cold-critique-i2.md`
- `docs/art-direction/reference-board/README.md` and `exploration/warped-city-animation.png`
  (re-measured from scratch as the density benchmark)

No source, no history, no other screenshots directory.

**Units.** The still is a 240×135 native image at exact 2× nearest, phase (0,0): aligned 2×2 blocks
are **98.11%** internally uniform within 6 levels, versus 89.50 / 83.60 / 75.61% at the three offset
phases (mean internal spread 1.09 vs 4.15 / 6.28 / 9.29). Mara is a **22×32 native character**.
Luminance is Rec.709 on gamma-encoded bytes throughout, which reproduces i2's quoted values exactly
(`#3e4744` → 68.9, `#46414a` → 66.7), so every number below is directly comparable to i2's.

**A new extractor, and it is itself a finding.** The sprite is enclosed by a **closed 1-px
`#120b10` contour**. I extracted Mara from the composited board with no background plate at all —
take the largest connected ink component in a 46×46 window and flood-fill its interior — and it
reproduces facing 0 at **442 px, 22×32, at native (115,77), zero error**. A sprite you can lift off
a board by flood-filling its own outline is an authored sprite. I used this extractor for every
animation frame below, so all silhouette numbers are exact rather than background-differenced.

---

## 1. Gritty / dangerous / lived-in — 3/5 (held)

**The light finally moved, and it moved 22 luminance levels.**

i2's #3 problem was that the board had no light at all. There is now something: a new palette entry
`#a06a3e` (L **114.3**) in **two diamond floor pools of 42 px and 35 px**, at native x63–73/y110–115
and x170–181/y110–115 — one under each kiosk. i2's brightest board mass was `#8c5141` at L 92.4 and
its "window" was a painted `#1c5a55` panel at L 76.5. Board maximum L 92.4 → **114.3**.

**And then it stops.** Measured on the play field (native rows 11–124):

| | i1 | i2 | i3 |
|---|---|---|---|
| play field above L 128 | — | 0.09% | **0.267%** |
| play field above L 180 | 0.1% | 0.01% | **0.121%** |
| play field mean L | — | 30.4 | **31.6** |
| **board only, above L 128** (Mara and the "FIELD MEDIC" caption excluded) | — | — | **0 px** |
| board's own maximum luminance | — | ~92 | **114.3** |

The play-field improvement is not the board. Of the 73 native pixels above L 128, **48 are Mara's
own highlights and 25 are the chartreuse caption chrome on native rows 121–123**. Excluding the
character and the UI, **the board contains zero pixels above L 128** and 123 px (0.46%) above L 100.
The canon budget is "≤ ~5% bright emission and focal highlights"; the board spends **1/18th** of it,
on a single value, in two shapes that read as floor decals rather than sources — there is no lamp,
no emitter geometry, no falloff onto an adjacent surface, no colour cast on anything the pools touch.
REPLACED and Warped City buy menace with large near-black masses **against** localized saturated
light. i3 delivered a warm stain where the light should be.

**"Lived-in" has not moved in three iterations.** Native edge density on the play field, swept
across thresholds so the comparison is honest:

| ΔL threshold | horiz | vert |
|---|---|---|
| >4 | **10.8%** | **15.1%** |
| >6 | 10.8% | 15.0% |
| >8 | 9.0% | 12.5% |
| any colour change | 13.6% | 20.1% |

i2 reported 10.7 / 14.9, i1 10.9 / 15.4. At the threshold that reproduces their numbers, i3 is
**10.8 / 15.1 — unchanged to within noise for the third iteration running.** Featureless mid-plum
floor (L 28–62, S < 0.32) is **25.5%** of the play field (i2: 23.7% — marginally *worse*).
Fourteen non-floor structures, **eight of them under 30 px**. Nine colours cover 90% of the play
field. There are still no goods, no signage, no awning fabric, no crates, no cabling, no rust
streaks, no debris, no spill. It is a shuttered plaza at 3am with two puddles of streetlight now.

**One real credit that is not in the numbers above.** There is a **contact shadow** under Mara —
`#150d13`, 11–48 px, an ellipse pinned to native rows 104–108 across every frame of every
animation. It is the first thing in this artifact that says a person is standing on this floor
rather than in front of a picture of one. It is also the single best piece of new authoring in i3.

## 2. Silhouette + equipment readability at combat zoom — 3/5 (held)

**The interior massing went from confetti to clusters, and by a large margin.**

Measured on the shipped facing sheet, flat-colour 4-connected islands over body pixels:

| | i2 (f0) | i3 (f0) | i3 (whole sheet) |
|---|---|---|---|
| body px | 411 | **442** | 3,173 |
| islands | 164 | **67** | **426** |
| islands / body px | 0.399 | **0.152** | **0.134** |
| singleton share | 47.7% | **1.5%** | **0.2%** (1 singleton in 426) |
| largest island | 31 px (7.5% of body) | **139 px (31.4%)** | 150 px |

Per-colour, facing 0 is now clean everywhere: no colour exceeds 7 islands, and the **smallest island
in the entire 8-facing sheet that is not that single 1-px outlier is 2 px**. Cloth is a **single
50-px island** on f0 and a single 33-px island on f6. The merged orange accent is 5 islands of
18/13/7/6/2 on f0 and 3 islands of 26/20/6 on f7 — i2's own prescribed floor (≤4 orange islands,
none under 3 px) is now met or nearly met on 6 of 8 facings.

The **grayscale test the canon actually names** confirms it. Posterizing shipped f0 into four value
buckets:

| bucket | i2 | i3 |
|---|---|---|
| ink (<L 20) | — | 142 px, **3 islands**, largest 139 |
| low-mid (20–60) | 173 px in 13 islands, largest 94 | 161 px in **7 islands**, largest 83 |
| high-mid (60–128) | — | 91 px in 12 islands, largest 31 |
| light (>128) | 96 px in **39 islands**, largest 11 | **48 px in 8 islands**, largest 13 |

i2's fourth withheld point — "the bright reads are still confetti" — is **fixed**: 39 islands → 8.

The figure/ground strategy holds exactly where i2 left it. The rim is **91 of 91 pixels pure
`#120b10`** (L 12.85); the adjacent ground averages L 34.26; **Δ 21.4** (i2: 21.8). Of the 120
rim/ground contacts, none is below ΔL 3 and only 11.7% below ΔL 6. 0.09% of the play field is
darker than the rim.

**Why it is still a 3.**

1. **Facing is not in the silhouette, and it regressed again.** Full 8×8 IoU at best alignment:
   **0.656–0.870, mean 0.745** (i2: 0.64–0.85 / 0.74; i1: 0.62–0.80). The 180°-opposite pairs mean
   **0.743**; the 45°-neighbour pairs mean **0.768**. *Opposites are more similar to each other than
   neighbours are* — the third iteration in a row where this is true. The worst pair, f1/f6, went
   **0.85 → 0.870**. (Credit preserved: mirror-pair IoU 0.739 against an adjacent-pair control of
   0.768 — statistically indistinguishable, so these are still eight genuine renders, not four
   flips.)
2. **The shipped pose still carries no medic marker.** Running i2's own test (a cream island with
   ≥50% of its perimeter in the orange accent), the cross passes on **exactly 4 of 8 facings** —
   f1 (8 px, **86%**), f5 (6 px, 80%), f2 (6 px, 70%), f7 (3 px, 62%). Same count as i2.
   **Facing 0 — the pose in the controlled still, the loupe, the entire idle loop and the entire
   attack — still has none**: three cream islands of 8/7/6 px at 38% / 0% / 33% orange perimeter,
   reading as collar, hip and boot. The 5×4 cross on f1 is intact and still correct:

   ```
   O O W O O          W = #c8bda9 cream
   O W W W O          O = orange accent
   O W W W O
   O O W O O
   ```

   Half the roster's viewing angles, including every one a player sees in this artifact's own
   headline captures, show a hooded scavenger with a tool.
3. **The consolidation was bought partly with ink.** `#120b10` is now **32.1–36.6% of the body** on
   every facing (142/442 on f0). The 139-px "largest coherent mass" that carries the island-density
   win *is the contour plus its shadow side* — a third of the character is a black hole. That is a
   defensible call at 22×32 and it is why the outline reads so well, but it means the flat-cluster
   number improved partly by deleting drawing, not only by ordering it.
4. **Highlight budget is still over canon on 5 of 8 facings.** L>150 body share 3.4 / 4.1 / 6.1 /
   7.0 / 7.5 / 7.7 / 9.2 / 9.3% against a ~5% ceiling; absolute counts 15–36 px, a **2.4× swing**
   (i2: 2.8×, i1: 2.6×) on the same character under a fixed light.

## 3. Material separation (cloth vs metal vs kit) — 2/5 (held, third iteration)

**The character palette is byte-identical to i1 and i2 on the numbers that cause this score.**

```
cloth  #3e4744   L 68.9   H 160°   S 0.127
metal  #46414a   L 66.7   H 273°   S 0.122      ΔL = 2.2      ΔE76 = 10.0      ΔL* = 1.0
```

The full ramps, recovered from the shipped 27-entry atlas:

```
cloth   #262a2e 41.4  →  #3e4744 68.9  →  #4c5752 84.3  →  #647167 109.5
metal   #46414a 66.7  →  #504b5e 77.4  →  #696477 102.4  →  #a5a4ab 164.7  →  #d4d2d3 210.5
```

These are, level for level, i2's "cloth ramp runs L 41 → 69 → 84 → 110 and the metal ramp L 67 → 77
→ 102 → 165 → 210". **Nothing changed.** Saturations remain 0.115–0.174 (cloth) and 0.009–0.202
(metal) on an HSV S scale — i1's prescription was "part on luminance (2–3 stops) or on real
saturation (0.20+)", and for the third iteration neither happened. The separation that does exist is
**hue only** (green-cyan 134–210° versus violet 249–278°), which is worth ΔL* 1.0–2.9 and is
therefore **invisible in grayscale** — the value-readability test the canon explicitly names. In the
four-bucket posterization of f0, cloth and metal fall in the same two buckets and cannot be told
apart.

**Two things did improve, and both are spatial.**

- **Cloth consolidated.** 1–4 islands per facing (50 px in one island on f0, 61 in one on f3, 41 in
  one on f2, 33 in one on f6), where i2 already had f0 at one island but the rest scattered.
- **The families now meet.** Cloth pixels touching metal: **7–24%** per facing (i2: 6%). i2's
  observation that "the two families avoid each other rather than parting from each other" is
  half-answered — they meet now. What they meet with is a 2.2-level luminance step.

Metal is still the fragmented family: **5–11 islands per facing** against cloth's 1–4.

The genuinely good entries survive untouched: `#c8bda9` (L 190) reads as canvas/webbing on both
value and temperature and carries the cross; `#2f9e96` (L 133.8) remains the correct single signal
and appears on 6 of 8 facings at 2–8 px.

**This axis has now scored 2 three times because the two hexes that cause it have never been
edited.** Nothing else on this axis matters until they are.

## 4. Character / environment cohesion — 4/5 (held)

**Still the only axis at the bar, and the contact shadow strengthened it.**

The shadow (`#150d13`, pinned to native rows 104–108, present under every frame of every animation)
is a real cohesion gain that i2 did not have to weigh: it welds the character to the floor plane
instead of leaving her floating in front of it. Combined with one quantization discipline, one 2×
grid, one ink family, a closed contour and a shared dither vocabulary, this composites as one image.

**The exclusive accents hold:**

| character | L | nearest environment mass (≥20 px) | ΔRGB | ΔL |
|---|---|---|---|---|
| `#2f9e96` signal teal | 133.8 | `#1c5a55` (341 px) | **96.0** | **57.4** |
| `#fc7c5a` lit accent | 148.8 | `#a06a3e` (77 px) | **97.8** | 34.5 |

**The refusal of the UI accents holds absolutely.** Zero pixels in the 480×270 frame within
ΔRGB(sum) **30** of `#ff2e6c` or `#c8f031`. The only near-chartreuse pixels in the file are 8 px on
screen row 242 — the "FIELD MEDIC" caption chrome. UI, not asset. Line held for the third
iteration.

**The point withheld, unchanged, plus a new collision the light fix introduced.**

```
character #7e382f  ==  environment #7e382f   ΔRGB (0,0,0)   504 env px
character #5e2b28  ==  environment #5e2b28   ΔRGB (0,0,0)   583 env px
character #8c5141  ==  environment #8c5141   ΔRGB (0,0,0)   302 env px
```

**127 of the sheet's 278 orange pixels (46%), and 31 of facing 0's 46 (67%), sit in ramp steps the
environment owns in larger masses.** Byte-identical to i2's diagnosis. i2 ranked this #8 and asked
for the shadow steps to be reserved; they were not.

And **the fix for problem #3 created a problem on problem #4**. The new board light `#a06a3e`
(L 114.3) sits **ΔE76 21.2, ΔL\* 2.8, ΔL 1.2** from the character's dominant bright accent `#c46047`
(L 115.5). The one warm mid-orange the board gained is at the same lightness as the character's own
signature colour, in 77 px on the floor directly below her. It is small enough not to cost the point
yet; make those pools any larger and the accent camouflage i2 congratulated the artifact for
escaping comes back through the front door.

## 5. Motion readability — 3/5 (held)

**The animation is the same animation.** Every timing signature I can compare is byte-identical to
i2's: idle hood tops in tile space **28, 28, 26, 24, 22, 22, 24, 26**; turn-beat hood tops **28, 28,
28, 26, 26, 24, 28, 30, 22, 24, 38, 30**; attack holds **2/3/1/3/2/1**; unique-frame counts 6/8,
6/12, 64/82. i3 recoloured these frames through the new consolidation pass; it did not re-time or
re-pose them.

### Idle — 8 frames, 6 unique, holds at f0=f1 and f4=f5. **2.5/5.**

- **Hood travel 3 native px** (77 → 74 → 77), a smooth 6-step rise and fall. Held from i2.
- **The bob is now correctly anchored and this is new information.** The contact shadow stays pinned
  at rows 104–108 while the body lifts, and its area grows **11 → 48 px** as she rises. Shadow
  bottom row is **108 in all eight frames**. That is a properly authored idle bob, not a float.
- **The boil is unchanged.** Changed pixels per step: **187–297 native (748–1,188 screen)** — i2
  measured 732–1,256 screen. That is **42–66% of the body every step** against a silhouette that
  changes by only 39–74 px (IoU 0.851–0.916). Ratio **4.0–4.8 interior pixels per silhouette pixel**.
- **She relights while standing still.** Body pixels above L 190 across one idle cycle:
  **8, 8, 4, 24, 19, 19, 7, 9** — a 6× swing, peaking on frame 3 for no dramatic reason. Above
  L 150: 33, 33, 30, 47, 43, 43, 28, 35.

The single worst combination i1 named — frozen outline, boiling interior — is exactly what the
player still sees. i2 asked for the interior to be quantized into a few authored states. It was not.

### Attack — 12 frames, 6 unique, holds 2/3/1/3/2/1. **3/5.**

The arc is intact and it is good: rest → windup with the injector raised (bbox shifts 2 px left,
hood up 1) → strike → **contact with the hood dropped 4 native px (77 → 80), the arm extended to
x140 and the body widened to 23 px** → recovery → settle. **The feet are planted throughout** —
bottom row 108 on all 12 frames. This reads as a medic driving an injector.

**The punctuation is still one pixel.** `#a8f0e4` (L 223.8, the brightest value in the artifact)
appears on frames 6, 7 and 8 at native (137,81) — **one native art pixel, four screen pixels, held
three frames**. Identical to i2. It is 0.2% of the body and roughly 0.08% of a 5% emission budget.

**And i2's one credited reversal reversed back:**

| body px | rest | windup (f2–4) | strike (f5) | **contact (f6–8)** | recovery |
|---|---|---|---|---|---|
| L>128 | 48 | 50 | 52 | **57** | 45 |
| L>150 | 33 | 42 | 39 | **36** | 34 |
| L>190 | 8 | **23** | 19 | **18** | 7 |

L>128 now rises into the hit — a small, genuine gain. But L>150 and L>190 both **peak on the windup
and fall through contact**. i2's finding was that "the specular energy finally peaks on the right
frame" (L>190 rising 12 → 28); it now peaks on the wrong one. There is still no arc, no dust, no
impact shape, no recoil frame.

### Turn — 82-frame GIF, 64 unique; 12-frame filmstrip beat, 9 unique. **3.5/5.**

Still the best thing in the artifact. The full turn visits all eight facings in order, each with a
**3-frame settle** (2 on f4) and **7–9 acted intermediates**. Every settle matches its atlas facing
at IoU 1.000 and 96.3–100.0% exact pixel identity, so the destinations are real atlas cells. During
the beat the outline genuinely acts: bbox width ranges **16–23 px** across the cycle and per-step
silhouette IoU falls to **0.441** (i2: 0.628).

**Two defects survive intact.**

1. **The destination is invisible.** Settle-to-settle IoU 0.656–0.870 (§2). After all that
   weight-shift acting, f1 and f6 are the same outline.
2. **The feet still float, and the shadow now covers for it.** All eight settles pin the sprite's
   **top row at 77**; the bottoms are **108, 108, 108, 107, 107, 106, 107, 107**. Atlas heights are
   32,32,32,31,31,30,31,31, so the compositor's residual still lands on the base — exactly i2's
   finding, unchanged. The shadow stays pinned at row 108 and **inflates from 11 px to 39 px**
   between the f0 and f5 settles to fill the gap. The result is that a unit standing still at eight
   angles appears to stand **2 native px (4 screen px) higher on some facings than others**, with a
   shadow that swells to explain it. The anchor was added at the right place and the sprite was not
   moved onto it.

---

## Deliberate pixel art, or a shrunken 3D render? — re-measured from scratch

**Answer: deliberate pixel art, decisively, in the static artifact — and still a render in the
light and in the animation's interior.** The line moved further than i2's "pixel art in everything
except the light", and it moved on the strength of one measurement.

### First — I re-measured the benchmark independently, and i2's correction of i1 stands

`warped-city-animation.png` is 250×179, fully opaque, and `#00003c` + `#00003b` are **90.0%** of it,
so i1's whole-image 0.21 islands/body-px measured an empty backdrop. Removing the two backdrop
navies leaves 4,472 sprite pixels in 16 blobs. Cleaning the file's 2,648-colour compression noise
and measuring per sprite:

| clean | median isl / body-px | range |
|---|---|---|
| quantize to 16 | **0.520** | 0.297–0.580 |
| quantize to 24 (closest to Mara's 27-entry atlas) | **0.580** | 0.341–0.603 |
| quantize to 32 | 0.613 | 0.346–0.653 |

i2 got 0.498 / 0.556 / 0.600 with the same approach. Reproduced.

### Second — Mara is now four times flatter than the benchmark, not equal to it

| | i1 | i2 | **i3** | warped-city |
|---|---|---|---|---|
| isl/body-px, shipped f0 | 0.417 | 0.399 | **0.152** | 0.52–0.61 |
| isl/body-px, whole sheet | — | 0.335 | **0.134** | |
| singleton share | — | 47.7% | **0.2%** | ~85% ≤2 px |
| largest island as % of body | — | 7.5% | **31.4%** | ~9% |

She has gone from *at* the reference to **3.4–4.5× flatter than it**. That is the pixel-art answer
and it is also a caution: the board asks for "the Warped City side of the density range" and "sprite
detail and pose readability", and i3 overshot toward the Kingdom-Rush end of large flat zones — 32%
of the body is now a single ink mass. At 22×32 that is the readable choice, but it is a choice, and
the next iteration should spend the recovered clarity on drawing (a facing-breaking pack, a bigger
cross), not on more flatness.

### What now tips it firmly to pixel art

1. **A closed 1-px ink contour.** I lifted facing 0 off the composited board by flood-filling the
   sprite's own outline: 442 px, 22×32, at (115,77), **zero error against the atlas cell**. The rim
   is **91/91 pure `#120b10`**. No renderer produces that; a contour pass does.
2. **The atlas is hard palette-locked.** 27 exact RGBA values across the 4× sheet, alpha uniformly
   255, no antialiasing anywhere, and it round-trips into the shipped still at **100.0% exact pixel
   match** (`atlasRoundTripMismatchedPixels: 0` is honest).
3. **Cluster consolidation survives the final pass** (above). Row 1 of the comparison sheet — the
   naive 8× box shrink — measures **0.871 isl/px and 95.5% singletons**; the shipped artifact is at
   0.134. That is the full distance from render to flat art, not part of it.
4. **The environment is fully quantized with no AA.** 163 colours in the play field, 9 covering 90%,
   floor island densities 0.0038–0.0274 with a 4,791-px largest mass, a two-plum dither
   (`#241a22` / `#211820`, 40% cross-adjacency). Horizontal scans give clean flat runs separated by
   hard seams — `3× #6e413c | 11× #a06a3e | 2× #8c5141 | 5× #6e413c | 2× #120b10 | 18× #332733 |
   58× #1a1218` — with **no intermediate coverage samples anywhere I scanned**.
5. **Exact 2× integer presentation, phase-locked**, 98.11% aligned-block uniformity, and a loupe
   that is a zero-error 4× crop.
6. **A planted contact shadow** at a fixed base row across all 102 animation frames.
7. **Authored timing**: 2s and 3s in the attack, held pairs in the idle, 3-frame settles inside an
   82-frame turn.

### What still tips render

1. **Highlight placement tracks the camera.** L>150 body share 3.4–9.3% across eight facings, a
   **2.4× count swing** (15–36 px) on the same character under a fixed light. A pixel artist puts
   the highlight in one place and nails it down. This is a turntable, marginally slower than i2's.
2. **The idle relights instead of moving.** 42–66% of the body changes per step against 8.4–14.9%
   silhouette change (ratio 4.0–4.8), and L>190 swings **4 → 24 px inside a single idle cycle**.
   Recomputed shading is what varies; drawn form is not.
3. **Facing lives in the interior.** Settle IoU 0.656–0.870; opposites (0.743) *less* separated than
   45° neighbours (0.768).
4. **Head-anchored compositing.** Top row 77 on all eight settles, bottom 106–108, shadow inflating
   11 → 39 px to absorb the error. The baseline is still derived, not authored.
5. **Ramp interiors are still render-shaded on the shipped facings.** Internal adjacencies jumping
   ≥3 ramp steps: orange **f0 11%, f1 12%, f2 7%** against **f3/f4/f5/f6 0%** and f7 1%; cloth
   **f4 19%**. f7 remains the model and f0 — the facing in every headline capture — remains the
   worst.

**Where the line sits now:** the still, the atlas and the board are on the pixel-art side by every
static measure I took. The character is on the render side only where light and time are involved.
It reads as pixel art at a glance, as pixel art in the loupe, and as a render the moment it moves.

---

## Resolution of i2's ranked problems

### The headline: is `clusterDensity` now describing the shipped pixels? — **YES for the JSON, NO for the comparison sheet**

I verified this three ways and it splits.

**(a) The pass is fixed.** The shipped facing sheet measures **0.1343 isl/body-px, 0.2% singletons
(1 in 426), largest island 150 px**. The contour no longer slices the interior — it is a closed
outline drawn *around* the consolidated masses, which is why my flood-fill extractor works at all.
Per facing: 0.100–0.152, singletons 0.0% on seven of eight facings.

**(b) `atlas-cost.json` is now honest about what it names.** The field was renamed from `after` to
`shipped` and reads `0.131` / `singletonShareShipped 0.012`. My independent measurement of the eight
visible rest facings: **0.1343** (+2.5%) and 0.002. The JSON covers all 208 cells and I can only see
8, so the small residual is expected. `paletteEntriesUsed: 27` matches the sheet exactly.
`atlasRoundTripMismatchedPixels: 0` is confirmed at 100.0%. **This was i2's #1 finding and it is
fixed.**

**(c) But `quantization-comparison.png` row 5 is now the file that lies.** Its caption reads
`+ 1PX CONTOUR & SEAMS / WHAT SHIPS IN THE ATLAS`. It is not what ships:

| | comparison row 5 | shipped atlas (same three facings) |
|---|---|---|
| body px | 1,265 | 1,265 (identical) |
| silhouette IoU vs atlas | **1.000** | — |
| **isl/body-px** | **0.270** | **0.140** |
| **singleton share** | **46.2%** | **0.2%** |
| exact-pixel match to the atlas | **86.2 / 90.4 / 86.2%** | — |
| round-trip into the shipped still | **86.2%** | **100.0%** |

The three cells have exactly the right silhouettes and body counts (385 = f2, 438 = f4, 442 = f0)
but differ from the shipped atlas on **53, 42 and 61 body pixels**. The differences run
overwhelmingly one way — the shipped atlas has **more** ink (`#120b10` 142 px on f0 vs 123 px in the
panel) and larger merged masses (largest island 139 vs 120). **The last row of the audit sheet
understates the artifact it audits by 2× on the metric the sheet exists to show.** i2 praised this
sheet as "how I found problem #1"; it is now the one document that misdescribes the pixels. Fix the
row or the caption — do not ship a five-row provenance argument whose conclusion row is a fourth
artifact.

The five rows as measured (all verified exact 4×, body pixels only):

| row | body px | colours | islands | isl/px | singletons | largest |
|---|---|---|---|---|---|---|
| 1 · 8× render, box-downsampled | 1,064 | 818 | 927 | 0.871 | 95.5% | 20 |
| 2 · 1× render, no filter | 912 | 166 | 594 | 0.651 | 74.2% | 17 |
| 3 · + Direction B palette | 912 | 24 | 196 | 0.215 | 34.7% | 32 |
| 4 · + cluster consolidation | 912 | 24 | 120 | 0.132 | 0.0% | 38 |
| 5 · + 1px contour & seams — *claims to ship* | 1,265 | 26 | 342 | 0.270 | 46.2% | 130 |
| **— what actually ships** | **1,265** | **26** | **177** | **0.140** | **0.2%** | **150** |

**One more arithmetic problem in the cost file.** `cells: 208` at `cellWidth: 64` × `cellHeight: 48`
requires 638,976 px of cell area, but `uniformGrid` is 420 × 518 = **217,560 px — 2.9× too small to
hold them**. Either the cell dimensions are quoted at 2× while the grid is native (in which case a
32×24 native cell cannot contain a 22×32 sprite), or the block is wrong. Separately, three different
palette sizes are published across the artifact: `paletteSize: 34`, `paletteEntriesUsed: 27`, and
the comparison sheet's row-3 caption "33 ENTRIES". Only 27 is checkable, and it is correct. The
number i2 demanded be fixed was fixed; the block around it was not audited.

### i2's twelve ranked problems

| # | i2 problem | status | deciding measurement |
|---|---|---|---|
| 1 | Contour pass discards consolidation; cost file publishes the pre-contour number | **FIXED (pass + JSON) / new defect (comparison sheet)** | Shipped sheet **0.1343 isl/px, 0.2% singletons, largest 150 px** (i2: 0.399 / 47.7% / 31). `clusterDensity.shipped 0.131` verified within 2.5%. But comparison row 5, captioned "what ships", measures **0.270 / 46.2%** and differs from the shipped atlas on 10–14% of body pixels. |
| 2 | Cloth and metal are the same grey | **NOT ADDRESSED** | `#3e4744` L 68.9 vs `#46414a` L 66.7, **ΔL 2.2, ΔE76 10.0, ΔL\* 1.0** — byte-identical to i1 and i2. Full ramps unchanged (41/69/84/110 vs 67/77/102/165/210). Indistinguishable in grayscale. Third iteration untouched. |
| 3 | The board has no light | **PARTLY** | New `#a06a3e` L **114.3** in two pools of 42 + 35 px. Board maximum L 92 → **114.3**. But **0 board px above L 128** once Mara and the caption are excluded, 0.46% above L 100, no emitter, no falloff, no cast. 1/18th of the ~5% canon budget. |
| 4 | Facing is not in the outline | **NOT ADDRESSED / REGRESSED again** | IoU **0.656–0.870**, mean 0.745 (i2: 0.64–0.85 / 0.74). Opposites **0.743** vs neighbours **0.768**. Worst pair f1/f6 **0.85 → 0.870**. |
| 5 | The idle boils | **NOT ADDRESSED** | Churn **748–1,188 screen px/step** (i2: 732–1,256) = **42–66% of the body**, against silhouette change of 39–74 px; ratio **4.0–4.8**. Hood tops identical to i2's list. Same frames, recoloured. |
| 6 | Feet float 2 native px across the turn | **PARTLY — anchor added, sprite not moved onto it** | Settle bottoms **108,108,108,107,107,106,107,107** with all eight tops pinned at 77 — identical to i2. New: a contact shadow pinned at row 108 that **inflates 11 → 39 px** to cover the gap. The idle bob is now correctly anchored (shadow 11 → 48 px while the body rises 3 px); the turn settles are not. |
| 7 | The shipped pose has no medic marker | **NOT ADDRESSED** | Cross passes the ≥50% orange-perimeter test on **4 of 8** facings (f1 86%, f5 80%, f2 70%, f7 62%) — same count as i2. **Facing 0 still has none** (38 / 33 / 0%). |
| 8 | 68% of the character's orange is environment paint | **NOT ADDRESSED** | `#7e382f`, `#5e2b28`, `#8c5141` are still **exact ΔRGB (0,0,0) duplicates** over 504 / 583 / 302 env px. 67% of f0's orange and 46% of the sheet's still sit in shared steps. |
| 9 | Highlight flicker 2.8×; light+highlight 96 px in 39 islands | **PARTLY** | Flicker **2.8× → 2.4×** (15–36 px). Light bucket **39 islands → 8 islands**, 96 px → 48 px, largest 11 → 13. Placement still unlocked; budget still over ~5% on 5 of 8 facings. |
| 10 | Ramp interiors still render-shaded on half the facings | **PARTLY** | Orange ≥3-step jumps: f0 **11%**, f1 12%, f2 7%, f3–f6 **0%**, f7 1% (i2: f0 9–12%, f7 0–4%). Five of eight facings are now clean; the shipped facing is not. |
| 11 | The board is still not lived-in | **NOT ADDRESSED** | Edge density **10.8% / 15.1%** at the threshold that reproduces i2's 10.7 / 14.9 and i1's 10.9 / 15.4 — unchanged three times. Featureless floor 23.7% → **25.5%**. 8 of 14 non-floor structures are under 30 px. No goods, signage, cabling, crates, wear or spill. |
| 12 | The attack's punctuation is one native pixel | **NOT ADDRESSED / partly REGRESSED** | `#a8f0e4` still **1 native px** held 3 frames. L>128 now rises 48 → 57 into contact (small gain), but L>150 falls 42 → 36 and **L>190 falls 23 → 18** — i2's credited "specular peaks on the right frame" is reversed; it now peaks on the windup. |

**Tally: 1 fixed (with a new defect of the same family), 5 partly, 6 not addressed, 2 of those
regressed.**

---

## VERDICT

**NOT YET.** Bar is 4 or better on every axis. Cohesion is 4; gritty, silhouette and motion are 3;
material is 2.

i3 is a real iteration with a narrow footprint. It fixed the pipeline defect that i2 ranked first,
and it fixed it properly rather than by editing the number — the shipped atlas is now 2.6× more
consolidated than i2's and 3.4× flatter than the density reference, with a closed ink contour I
could verify by flood-filling it. That is the strongest single piece of evidence in three
iterations that this is authored pixel art. But it spent its whole budget there. The material
palette has not been edited in three iterations. The animation is the same animation. The board's
light went up 22 luminance levels and stopped below L 128. And the truthfulness problem did not
disappear — it moved from `atlas-cost.json` to the last row of the comparison sheet, which now
undersells the artifact by 2× on the exact metric the sheet exists to prove.

Where a fix traded one problem for another:
- **The light fix cost cohesion headroom.** `#a06a3e` (L 114.3) landed ΔE76 21.2 from the
  character's `#c46047` (L 115.5) — the board's only bright colour is now a near-match for the
  character's signature accent, in 77 px on the floor beneath her.
- **The consolidation was bought partly with ink.** 32–37% of the body is now pure `#120b10`, and
  the 139-px island that carries the density win is the contour, not a drawn mass. The number
  improved partly by deleting information.
- **The base anchor was added without moving the sprite onto it.** The shadow is pinned; the feet
  are not. The residual is now expressed as a shadow that swells 11 → 39 px between facings, which
  reads as hovering rather than as a compositing error.

## Strongest remaining problems, ranked

1. **Cloth and metal are still the same grey — third iteration, same two hexes.** `#3e4744` L 68.9
   vs `#46414a` L 66.7, ΔL 2.2, ΔL\* 1.0, invisible in grayscale. Part them 2–3 luminance stops or
   push one family past 0.20 saturation. This is a two-line palette edit and it is the only thing
   standing between this axis and a 3–4. Nothing else on axis 3 matters.
2. **Facing is not in the outline, and f1/f6 got worse.** IoU 0.656–0.870; opposites (0.743) less
   distinct than 45° neighbours (0.768). Give the back facings a pack or a hood profile that breaks
   the crown line. The turn beat is excellent acting arriving at an invisible result — that is the
   single biggest waste of authored work in the artifact.
3. **The board still has no light.** Zero board pixels above L 128; brightest board value L 114.3 in
   77 px, on a ~5% emission budget. The near-black massing landed two iterations ago and still has
   nothing to be dramatic against. One or two localized saturated sources with visible falloff —
   and pick a hue that is not within ΔE 21 of the character's accent.
4. **The comparison sheet's "what ships" row does not ship.** 0.270 vs 0.140 isl/px, 46.2% vs 0.2%
   singletons, 86.2% pixel identity with the atlas, 86.2% round-trip into the still where the real
   atlas hits 100.0%. Regenerate row 5 from the shipped PNG, or relabel it. Also fix the
   `uniformGrid` / `cells` × `cellWidth` × `cellHeight` contradiction (2.9×) and reconcile
   `paletteSize 34` / `paletteEntriesUsed 27` / the sheet's "33 ENTRIES".
5. **The idle boils, unchanged.** 42–66% of body pixels change per step against 8–15% silhouette
   change, ratio 4.0–4.8, and L>190 swings 4 → 24 px inside one cycle. Quantize the idle interior
   into two or three authored shading states and let the hood and shadow carry the motion — the
   3-px bob and the planted shadow are already right.
6. **The shipped pose has no medic marker.** Cross on 4 of 8 facings, none on facing 0 — the still,
   the loupe, the whole idle and the whole attack. Propagate it to every angle or move the identity
   into a shoulder-slung kit that also fixes problem 2.
7. **46% of the character's orange is environment paint**, including three exact ΔRGB (0,0,0)
   duplicates over 1,389 environment pixels. Reserve all five steps of the roster accent ramp.
8. **The turn settles still float 2 native px** with the top row pinned at 77 and the shadow
   inflating 11 → 39 px to hide it. Anchor the composite on the base row; the shadow already knows
   where the floor is.
9. **The attack contact is one pixel and the specular peaks on the wrong frame.** L>190 23 (windup)
   → 18 (contact). Give the hit a 2-frame shape — arc, spray, dust — and move the brightest frame
   onto the contact.
10. **The board is still not lived-in.** Edge density 10.8 / 15.1%, unchanged three times; 25.5%
    featureless floor; 8 of 14 structures under 30 px. Break the plane surfaces.
11. **Highlight placement is still unlocked**: 2.4× count swing across eight facings, over the ~5%
    budget on five of them. Pick one focal highlight and fix its position.
12. **Ramp interiors on the shipped facings.** f0 and f1 still jump ≥3 orange ramp steps on 11–12%
    of internal adjacencies while f3–f6 are at 0%. The pass can already do this; make it do it on
    facing 0.

## Must not be lost

- **The consolidation, and the contour that no longer destroys it.** 0.1343 isl/body-px sheet-wide,
  0.2% singletons, no island smaller than 2 px, largest mass 150 px, every colour family in ≤7
  islands. This is the biggest thing i3 did and it must never regress.
- **The closed 1-px `#120b10` contour.** 91/91 rim pixels pure ink, and a sprite that can be lifted
  off the composited board by flood-filling its own outline to a zero-error 442-px match. This is
  the strongest single piece of pixel-art evidence in the artifact.
- **`atlas-cost.json`'s `clusterDensity.shipped`.** It measures the shipped pixels now, verified
  independently to within 2.5%. Keep it measuring the PNG, and extend the same discipline to the
  geometry block.
- **The contact shadow.** `#150d13`, pinned to native rows 104–108 across all 102 animation frames,
  growing 11 → 48 px as the idle body lifts. This is the first authored ground contact in the
  artifact and it is correct.
- **The figure/ground strategy.** Rim L 12.85 against adjacent ground L 34.26, Δ 21.4, no contact
  below ΔL 3, 0.09% of the play field darker than the rim.
- **The environment quantization and dither.** 163 play-field colours, 9 covering 90%, floor island
  density 0.0038–0.0274 with a 4,791-px largest mass, a real two-plum dither, and zero intermediate
  AA samples on any edge I scanned.
- **The consolidated bright bucket.** 39 islands → 8, largest 11 → 13. The confetti in the
  highlights is gone.
- **Cloth as a single mass.** 50 px in one island on f0, 61 on f3, 41 on f2, 33 on f6. The ramps
  need contrast, not replacement — the shapes are now right.
- **The 26-entry character palette's structure** — plum-black ink, green cloth ramp, violet metal
  ramp, cream `#c8bda9`, five-step orange ramp, `#2f9e96` as a single signal. Unchanged since i1 and
  still good design *except* for the cloth/metal luminance collision.
- **The medic cross** — 5×4 cream on orange, 86% orange perimeter on f1. Correct scale, placement
  and colour assignment. Propagate it; do not shrink it.
- **The turn cycle.** 82 frames, 64 unique, eight settles in order at 96–100% atlas identity, 7–9
  acted intermediates, per-step IoU down to 0.441, bbox width acting 16–23 px. Best animation here
  for the third iteration running.
- **The attack's hold structure** (2/3/1/3/2/1), its anticipation → strike → settle arc, and its
  planted feet (bottom row 108 on all 12 frames).
- **The idle's 3-px hood rise, its two held pairs, and its correctly anchored bob.**
- **Eight genuine facings, not four mirrored.** Mirror-pair IoU 0.739 against an adjacent-pair
  control of 0.768.
- **Exact 2× integer presentation, phase-locked** — 98.11% aligned-block uniformity, 100.0% atlas
  round-trip, a zero-error 4× loupe and a zero-error 4× facing sheet. The presentation has been
  honest for three iterations.
- **The refusal of the UI accents.** Zero pixels within ΔRGB(sum) 30 of `#ff2e6c` or `#c8f031`
  anywhere in the frame; the only near-chartreuse pixels are 8 px of caption chrome.
- **The five-row quantization comparison as a practice.** Row 1's naive 8× shrink (0.871 isl/px,
  95.5% singletons) is what makes the shipped 0.134 mean something. Keep publishing it — and make
  row 5 be the file it claims to be.
