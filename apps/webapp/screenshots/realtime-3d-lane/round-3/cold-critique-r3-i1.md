# Cold critique — round 3 (realtime-3d-lane) — crowd register

SCORES r3: gritty 3/5 · silhouette 4/5 · material 4/5 · cohesion 3/5 · motion 2/5 ·
tier separation — **unmarked far 1/5, unmarked near 2/5, marked far 3/5, marked near 4/5**
(round 2 final: 4·4·4·4·4, single hero at ~64–70 px)

**Provenance:** judged only from the 31 artifacts in this `round-3/` directory — the four
crowd stills and their four grayscale twins, four loupes, two lineups and their grayscale
twins, three filmstrips and their grayscale twins, `hero-still` / `gray-hero-still` /
`hero-loupe`, both contrast visualisations, and both crowd-motion GIFs (decomposed with
ffmpeg *and* parsed at the GIF-block level) — plus `measurements.json`, `COST-REPORT.md`,
the reference-board README, and the r2-i3 critique for score continuity. All pixel
values quoted below were sampled off these PNGs. No source file, no history, no issue,
no other directory was opened.

**How the test changed.** Round 2 judged one medic at 64–70 px on a board whose facades
had been deliberately dirtied for that round. Round 3 judges 40 units at 22 px and 35 px
on the untouched shared board. Three axes are being tested much harder and two of them
lose points for that reason alone; I say so at each one. Two findings, however, are not
scale artifacts and would be defects at any register: the crowd-motion GIFs contain no
motion, and the two factions' heroes are the same unit in the same palette.

---

## The blind hunt — reported honestly before anything else

I opened `crowd-far-unmarked.png` and `crowd-near-unmarked.png` at 1:1 before opening any
marked or lineup image.

**Pass 1, 1:1, no prior knowledge of what a hero looks like: 0 of 4 found, both registers.**
The eye goes straight to the bright helmet cubes — coral `#FF966C` on the crew mass,
ice-white `#D3FFFF` on the opfor mass. Those are *fodder*. Nothing in either frame said
"leader" to me. I did not have a candidate to even guess at.

**Pass 2, after studying `lineup-far/near.png` (fair — a player knows the roster), at 6–12×
nearest-neighbour magnification:**

- far: **3 of 4**, and only one of those three was an honest find.
- near: **3 of 4**, same breakdown.

The cue I used for the two opfor heroes at both registers was **warm-vs-cold colour, not
tier** — and that cue only exists because of a bug (see Tier separation). The one crew hero
I found at each register (far `x228–247,y98–128`; near `x222–251,y77–124`) I found by
*absence*: it is the only figure on the formation's right flank with no bright helmet cube,
so it reads as a dark gap at the edge of an orange mass. That is a negative-space cue, and
it works only because that unit stands alone outside the block.

**The fourth hero I could not find at either register, and the reason is not a readability
failure — it is a rendering failure.** Crew hero #1 (far `x159–178,y103–133`; near
`x113–141,y85–131`) is *completely occluded by the left building*. In
`crowd-near-marked.png` its orange ring is drawn as a closed humanoid loop across a flat
plum wall with **nothing inside it** — see the 5× crop of `x95–265,y60–145`: the right-hand
ring cleanly wraps a visible medic, the left-hand ring wraps masonry. The marking pass is
screen-space with no depth test. Four rings ship; one of them is a decal on a building.

**Grayscale (`gray-crowd-*`):** the marking survives as *shape* — all four loops are legible
closed contours at 1:1 — but not as *value*, and this is measurable:

| element | RGB | grayscale value |
|---|---|---:|
| crew hero ring | `#FF7310` | **138** |
| board roof / lit facade | `#D37E62` | 142 |
| crew brute helmet (fodder) | `#FF966C` | **169** |
| opfor hero ring | `#36C4FF` | **170** |
| opfor brute helmet (fodder) | `#D3FFFF` | **246** |

On both sides the ring is *darker* than the fodder it is meant to lift the hero above, and
the crew ring is darker than the architecture behind it. Worse: at 138 vs 170 the two
rings converge on the same light grey, so **in grayscale a hero has no faction at all.**
Faction identity for the hero tier is 100% hue-coded with no value backup.

---

## 1. Gritty / dangerous / lived-in — 3/5 (DOWN from 4)

The wear that earned round 2 its 4 is not on this board. `hero-still.png` at 4× (crop
`x0–140,y0–180`): the left market building is a flat salmon roof plane, a flat plum wall
plane, two hard-edged pure-black window slots, one 1-px amber trim strip, one small teal
sign, three thin vertical pipe lines. That is the entire surface treatment. No rust
streaks running down the wall, no lighter patched panel inset low, no darker base band
where wall meets floor — every one of the specific marks the r2-i3 critique cited as the
reason grit moved 3→4. The stacked crates at `x330–480` are three clean cardboard-brown
boxes with no dents, scuffs, or stains. The floor is a tidy grid with thin hazard strips
and a few flat darker rectangles.

What *is* doing work: the low-key palette (floor `#333327`, value 20%), the sagging cable
lines strung between buildings, a knocked-over drum, and — genuinely — the massed
formations themselves. Forty shield-and-rifle figures packed into a block is menacing in a
way one medic was not. That is worth something, and it is why this is a 3 and not a 2.

`COST-REPORT.md` says "The board is untouched. It is the control all four lanes are judged
against." I accept that as an explanation; I do not accept it as a score. I judge what a
viewer sees, and a viewer sees a clean graphic diorama with dangerous *shapes* on it.

**Cap: POLISH, blocked on a scope decision.** The lane demonstrably knows how to dirty a
facade — round 2 proves it. Nothing structural prevents this. Whoever owns the shared
board has to let it be dirtied, or this axis cannot move.

## 2. Silhouette + equipment readability — 4/5 (held, but a thinner 4, and only the fodder earns it)

**The two fodder archetypes part cleanly at both registers, including grayscale.** This is
the strongest result in the set. From `lineup-near-4x` and the 8× crowd crops:

- **brute** — a solid block: wide coral/ice cube helmet, broad torso, and a light-grey
  shield slab `#7D747C`-ish held across the chest. Mass sits in a compact column.
- **marksman** — a thin vertical with a stick through it: narrow body, small head cap, and
  a near-white barrel running horizontally past both sides of the body.

They read differently at 22 px because the discriminators are a *bright grey slab* and a
*bright white line* — both high-value marks that survive the downscale and survive
`gray-lineup-far.png` untouched. The COST-REPORT's own framing (bbox width is useless, 17
vs 15 cols; core width 1.86× and fill density 1.64× are what part them) matches what I see.
That is correct analysis and the art follows it.

**The two factions read as different armies — for fodder.** Coral helmet + sage torso vs
ice-white helmet + charcoal torso is a hue *and* value split (169 vs 246 in grayscale), so
it survives colourblindness. Good.

**The hero is where this axis bleeds.** At the near register (44 px) the medic reads well:
`crowd-near-marked` crop `x219–255,y74–128` at 10× shows a plum cube head clear above the
shoulder line, a teal visor slit, an orange shoulder pad, a dark chest panel carrying an
orange medkit block with a white cross, a teal-and-white injector at the hip, and white
toe-caps. Five separable pieces of equipment. At the far register (27 px) essentially all
of that is gone: the cross is 2 px, the injector is 2 px, the visor is a 3×1 dash, and the
head — see axis 4 — is the same luminance as the buildings. One of three archetypes stops
working at the far register.

**Cap: STRUCTURAL.** The hero's identity is carried by small equipment reads, and 27 px is
below the floor for them. The fix is not more detail, it is a *larger* identity mark.

## 3. Material separation — 4/5 (held, and it held for a good reason)

The material clusters were chosen at value separations wide enough to survive both the
downscale and the desaturation, which is the real test and it passes:

- **metal** — marksman barrel and brute shield read near-white/light-grey and are the
  brightest non-helmet marks on a fodder unit at 22 px; hero toe-caps `#FFFBFA` survive at
  both registers; they are still the brightest thing on the unit in `gray-lineup-far.png`.
- **cloth** — sage `#646D64` (grey 106) crew torso / charcoal opfor torso, matte, no
  specular.
- **kit** — coral `#FF966C`, medkit orange, teal injector body.
- **rubber/armour** — near-black legs and boots below the toe-cap.

Four clusters, four distinct grayscale bands, no collapse. That is a real carry-forward
from round 2.

Not 5 for two reasons. First, the round-2 cap stands: the flat facets carry no material
micro-detail, so "metal" is communicated by value alone, never by surface. Second, and
this is new, **the board has essentially no material differentiation at all** — concrete,
metal siding, and cardboard are all rendered as flat painted planes distinguished only by
hue. The units are materially specific; the world they stand in is not.

**Cap: STRUCTURAL for the unit rig, POLISH for the board.**

## 4. Cohesion — 3/5 (DOWN from 4)

Round 2's principle was "the unit owns the chroma peak against the environment." At crowd
scale, on this board, that is no longer true in the way it was, for three separate reasons
— and I count them separately because they have different fixes.

**(a) The crew army and the architecture are the same colour.** Measured across
`crowd-near-unmarked.png` by S×V:

| | RGB | H | S | V | pixel count |
|---|---|---:|---:|---:|---:|
| brute helmet / hero shoulder | `#FF966C` | 17° | 0.58 | 1.00 | 355 |
| hero shoulder shade | `#FC7856` | 12° | 0.66 | 0.99 | 204 |
| **board roof + lit facade** | `#D37E62` | **14°** | **0.54** | **0.83** | **1538** |

The unit's identity coral and the market's architecture sit **3 degrees apart in hue** and
4 points apart in saturation, and the architecture covers 2.8× more screen. The crew wins
the *peak* on value, but only just, and loses the *mass* badly. In `crowd-far-unmarked.png`
at 1:1 the crew formation and the salmon roof above it read as one warm region.

The opfor side has no such collision — ice-white `#D3FFFF` against a warm-plum world is
clean, and the opfor mass is the more cohesive of the two armies by a wide margin. That
asymmetry is itself a cohesion failure: the two sides do not sit in the world equally well.

This is the same class of error round 2 flagged and did not fully close — the teal floor
spill sharing the medic's identity hue. Same mistake, different pair.

**(b) With marking on, the marking owns the chroma peak, not the unit.** `#FF7310` is
S=0.94; `#36C4FF` is S=0.79. The hottest colour a *unit* carries is S=0.66. The ring is
1.4–1.6× the saturation of anything on the figure it surrounds, and at the far register it
is a 2-px stroke on a 27-px unit — 7.4% of body height in pure saturated orange. It does
not read as part of the character; it reads as an overlay stamped on top of one.

**(c) Within the army, the chroma peak belongs to the wrong tier.** The single most
saturated, most valuable mark on any unit in the frame is the *brute's* helmet. The hero's
loudest element is a duller orange shoulder pad. Thirty-six fodder are louder than four
heroes. Tier and chroma are inverted.

**Cap: POLISH on all three.** (a) is a hue-shift on either the board's warm architecture or
the crew's identity colour. (b) is a saturation/thickness decision on the ring. (c) is a
straight swap of which tier gets the loud mark. None of them require rig or engine work.

## 5. Motion — 2/5 (DOWN from 4)

**The crowd-motion GIFs contain no motion.** This is not an interpretation. Parsing the
GIF image-descriptor blocks directly:

```
crowd-motion-far.gif  : 24 image descriptors — 1 × (0,0,480,270), 23 × (479,269,1,1)
crowd-motion-near.gif : 24 image descriptors — 1 × (0,0,480,270), 23 × (479,269,1,1)
```

Frames 2–24 are one-pixel patches in the bottom-right corner. Decomposed with
`ffmpeg -i <file> %03d.png`, all 24 rendered frames are **pixel-identical** (0 differing
pixels, temporal std = 0 across the whole 480×270 field). Frame 1 matches
`crowd-far-marked.png` to within 472 pixels of GIF palette quantisation. Both files are a
still image padded to 24 frames at ~8 fps. **The single deliverable that was supposed to
answer the "synchronized toys" question is empty, and I cannot answer that question at all.**

What the filmstrips *do* show — and this is genuinely good work that the broken GIFs are
burying:

- **Turn (16 frames, `filmstrip-turn.png`): the round-2 hop is now there.** Head top rises
  from y27 (f1) to y20–21 (f10–11) and returns to y27 (f16) — a 6–7 px lift on a ~50 px
  render, 13% of body height. The white toe-caps, which are unambiguous trackers, go from
  y63 (f1) to y45 (f7) and then **vanish entirely for f8, f9, f10** before reappearing at
  y51 (f11). The figure leaves the ground, shows its back mid-air, and lands. Round-2
  strongest-problem #3 is closed. Consecutive-frame deltas dip at f2→f3 (698) and f8→f9
  (706) against a 1000–1580 baseline, so there is some uneven dwell, though nothing like
  round 2's long front/back holds.
- **Attack (12 frames): anticipation and a real smear.** f2–f4 coil (head top rises 22→20,
  injector drops to hip), f5 is a committed lunge — head top drops to y38, an 18-px pitch —
  carrying a large pale-cyan injector smear shape off the unit's left. That smear is the
  most comic-book mark in the whole capture set and it should be protected.

And what the filmstrips show that is a **regression**:

- **The hit-stop is gone.** Round 2's 4 was earned partly on "the pitched-forward extension
  holds nearly identical across f12–15." Here the recovery is monotone with no hold: head
  top y38 → 32 → 29 → 26 → 24 → 22, consecutive deltas 1305, 1099, 1235, 1354 — no two
  adjacent frames are close. The sampler demonstrably *can* show identical frames (see
  next point), so a hold would have registered. The swing lands but does not stop.
- **A quarter of the attack clip is a hard freeze.** Frames 10, 11 and 12 are **exactly
  pixel-identical to frame 1** (0 differing pixels each). Not idling, not breathing —
  frozen. Three of twelve.
- **The idle is too small to survive the register.** Head top moves y23→y24 across all 12
  frames of `filmstrip-idle.png` — **1 px on a ~50 px render (2%)**. Boots flutter 2 px.
  Round 2 measured ~4 px on a ~70 px render (5.7%). Scale that 2% to the far register and
  the hero's breathing is 0.5 px. Even with working GIFs, a 22-px crowd built on this idle
  would read as a frozen diorama.

**Cap: POLISH, but the score has to be on the artifact.** Re-capturing the GIFs is a capture
fix, not an art fix; restoring the hold and raising the idle amplitude are hours of curve
work. On the filmstrips alone the single-unit motion is 4-level. As delivered, the lane
provides zero evidence of crowd motion and measurable evidence that its idle would not
survive the register, so it scores 2.

## 6. NEW — Tier separation

### unmarked, far (22 px fodder / 27 px hero) — 1/5

Reported in full above: 0/4 at 1:1 cold, 3/4 only at 6–12× magnification with the roster
memorised, and 2 of those 3 found via a faction bug. The mechanisms of failure are
measurable:

- **The 1.25× is worth ~5 px and the brute eats it.** `COST-REPORT.md` reports it honestly:
  the hero fills **0.94×** the screen cells of a shield brute despite standing 1.25× taller
  (238 vs 252 filled, 12 bbox cols vs 15). Downsampling `lineup-far.png` to its true
  register confirms it by eye — the brute's tall helmet cube brings its *total* height to
  within a couple of pixels of the hero's, and the brute is visibly wider and heavier.
  A taller, narrower, dimmer figure does not read as a bigger one.
- **The hero's head is the same luminance as the buildings.** Hero head lit plum `#764F5D`
  → grayscale **88**. Board facade plum `#834C56` → grayscale **88**. Identical. That is
  why crew hero #1 vanishes in front of the left market building — it is camouflaged by
  numeric coincidence, and it is why I looked directly at the `contrast-far.png` contour
  bulging around `x159–178` and could not see what it was enclosing.
- **The hero reads by absence.** Every positive high-energy mark in the tier system —
  brightest value, highest saturation, biggest single shape — is on the fodder. The hero is
  the figure *missing* the bright helmet cube. Negative space is a fragile cue in a mass
  and it disappears the moment a hero is not on the formation's edge.

**Cap: STRUCTURAL as currently designed** — you cannot recover a tier read from a 1.25×
height boost that buys 0.94× mass. It becomes POLISH the moment the hero is given a
positive mark (a crest, a taller/brighter head, a banner, a distinct shoulder profile).

### unmarked, near (35 px fodder / 44 px hero) — 2/5

Same failure, one point less severe. At 1:1 still 0/4 cold. At 6× with the roster known,
3/4 — the crew hero on the right flank (`x222–251`) is genuinely findable because the plum
head is a clear dark hole in a field of coral cubes, and at 44 px the equipment silhouette
(extended arm, injector, boots) is distinct. But it is still the *only* crew hero found,
still by absence, still on the flank.

**The two opfor heroes are found instantly at both registers, and this is a bug, not a
win.** `crowd-near-unmarked.png` at the opfor ring positions samples `#FF966C` — the exact
crew coral — on the packs of both opfor heroes, plus the crew's sage torso and plum head,
with **no ice-blue anywhere on either figure**. `lineup-far.png` confirms it at the source:
masking out the two rings, hero-crew and hero-opfor share 287 of their colours, including
every identity colour (`#342A2A` and `#764F5D` head, `#525A53`/`#646D64` torso, `#FF966C`
and `#FC7856` kit, `#FFFBFA` boots). **The two factions' heroes are the same model in the
same palette; the ring is the only thing that differs.** So an opfor hero is a warm orange
smudge inside a cold blue army — visible for the wrong reason, and unreadable as to which
side it is on.

### marked, far — 3/5

At 1:1 the four rings read instantly; that is the point of them and they achieve it. The
score is held down by four things, all visible:

1. **One of four rings has no unit inside it.** Crew hero #1's loop is drawn over the left
   building's facade. The pass ignores depth.
2. **The ring out-shouts the unit.** S=0.94, 2 px on a 27 px figure, and the most saturated
   mark anywhere in the frame. What the eye locks onto is the annotation, not the
   character. That is a HUD element, not a marking.
3. **It does not trace a clean outer silhouette.** `loupe-far-marked.png` at 3× around the
   hero: the loop follows the concavity *between* the extended arm and the torso, producing
   an orange hook that cuts into the body, with the arm hanging off as a separate lobe on a
   ~2 px isthmus. The result is lumpier and busier than any fodder silhouette in the frame
   — the opposite of "a hero reads as a clearer shape."
4. **Grayscale value inversion.** Crew ring grey 138 < roof grey 142 < brute helmet grey
   169. In grayscale the ring is dimmer than both the fodder it distinguishes from and the
   architecture behind it. It survives only as a closed contour.

### marked, near — 4/5

The best result in the set. Three of the four rings (`x222–251,y77–124`;
`x235–264,y149–194`; `x340–368,y140–184`) trace the outer silhouette cleanly at 3 px on a
44 px figure, reading as an outline of the character rather than an object beside it. All
four are unmissable at 1:1. Same four deductions as above apply but each is milder at this
size — except the occluded fourth ring, which is identical and just as wrong. The small
detached-looking lobe around the raised injector on the opfor heroes adds a little noise
but does not break the read.

**Cap on both marked scores: POLISH.** Depth-test the pass, drop the saturation, dilate off
a convex-ish hull instead of the raw silhouette, and give the ring a value that beats the
fodder in grayscale. All four are shader-and-parameter work.

---

## Checking the builder's claims against the images

**Register and 1.25× — CONFIRMED.** Ring bounding boxes are 20×31 px far and 30×47 px near.
Subtracting the ~2 px outset gives hero silhouettes of ~27 px and ~43 px against claimed
22×1.25 = 27.5 and 35×1.25 = 43.75. The size boost is exactly what is claimed.

**`contrast-*.png` reproduce `measurements.json` exactly — CONFIRMED, but they measure the
wrong contour.** Counting red and green pixels in the visualisations: far = 292 red + 340
green = **632 total, 46.2% red**; near = 417 + 680 = **1097 total, 38.0% red**. Those match
`edgePixels` / `dissolvedPct` to the digit. The visualisation is honest about its own
number. But **632 contour pixels across 40 units is ~16 px per unit**, far below a single
22 px figure's perimeter — and the images show why: the traced contour is the **outer
boundary of each crowd blob**, one closed loop per side, not per-unit silhouettes. Every
unit-vs-unit interior edge is excluded, and interior edges are exactly the ones that decide
whether a player can count a mass. If the Blender lane's 53% was measured on per-unit
silhouettes, the two figures are not comparable and should not be tabled against each other.

**"The shadowed lower-left sides of every unit dissolve, the key-lit upper-right sides
survive" — NOT SUPPORTED.** At 6× (`contrast-far.png`, crop `x150–260,y85–150`) red and
green interleave in runs of 1–4 px all the way around the loop, on all four sides. Centroids
are red (237,133) vs green (253,145) — a 16-px offset on a ~90-px-wide blob, and red sits
*above* green, not below-left. It is a dither, not a side split. The number is real; the
stated pattern is not what the image shows.

**"The capture clears to the floor tone so this does not read as a hole" — NOT TRUE OF THE
MARKED CAPTURES.** Diffing marked against unmarked: everything on the board is identical
except the four rings (good — the A/B *is* controlled). But off-board, the unmarked shots
clear to `#333327` and the marked shots clear to `#000000`, so 39% of the far pair's pixels
differ. `crowd-far-marked.png` ships with visible black corners outside the board diamond.
Capture hygiene, not art, but it is in the delivered set.

---

## What I would fix first, ranked

1. **Re-capture the two crowd-motion GIFs.** They contain one frame and 23 one-pixel
   patches. The round-3 brief's central motion question cannot be answered from the
   delivered set.
2. **Give the hero a positive tier mark and take the loud mark off the fodder.** The hero
   currently reads by absence of a bright helmet while 36 brutes carry the brightest,
   most saturated element in the frame. Invert that. A 1.25× height boost that buys
   0.94× screen mass is not a tier cue and no amount of polish will make it one.
3. **Depth-test the marking pass.** One ring in four is drawn over a building with the
   unit fully occluded behind it, at both registers.
4. **Give the heroes faction colour.** hero-crew and hero-opfor are the same model in the
   same palette; the ring is the sole differentiator, and grayscale destroys it (138 vs
   170). Right now an opfor hero is a crew-coloured figure standing in a blue army.
5. **Break the hue collision between the crew coral `#FF966C` (H17°) and the board's warm
   architecture `#D37E62` (H14°, 2.8× the screen area).** Round 2 raised the identical
   problem for the teal spill and it was only half-closed; it has recurred.
6. **Lift the hero's head off the architecture's luminance.** Head `#764F5D` and facade
   `#834C56` are both grayscale 88. Any value separation at all would have made crew hero
   #1 findable.
7. **Restore the attack hit-stop, delete the three frozen tail frames, and raise the idle
   amplitude.** A 1-px head bob on a 50-px render is sub-pixel at the far register.
8. **Retune the ring:** drop it below the units' own saturation ceiling, thin it at far
   (2 px on a 27 px unit is 7.4% of body height), and dilate off a smoothed hull so it
   stops tracing the arm-to-torso concavity and making the hero the busiest silhouette
   on the board.
9. **Put grime back on the facades** — or get a decision from whoever owns the shared
   board. This is the only reason gritty moved down.

## Must not be lost

1. The two fodder archetypes' silhouette split — solid block + bright shield slab vs thin
   vertical + bright white barrel line. It survives 22 px *and* grayscale. It is the
   cleanest thing in this round.
2. The fodder faction split as a hue **and** value pair (169 vs 246 in grayscale).
3. The turn's vertical hop — head +6 px, toe-caps gone for three frames. Round-2's #3 is
   closed and the fix should not be traded away.
4. The attack's pale-cyan injector smear at f5.
5. The hero head rebuild. In `hero-loupe.png` and in every frame of all three filmstrips
   the plum cube sits clearly clear of the shoulder line with a visible neck break, and the
   teal visor slit plus the medkit cross give an unambiguous front-facing cue at 44 px.
   **The round-3 head-occlusion fix landed and it holds through full rotation.** It fails
   at 22 px only on value, not on geometry.

---

## VERDICT — does not clear the round-2 bar

Round 2 passed on "all five axes at 4, no axis below 4." Round 3 has gritty at 3, cohesion
at 3, motion at 2, and the new tier axis at 1–2 unmarked. It fails that bar, and it would
fail it even if I discounted the register change entirely, because the two hardest findings
are register-independent: **the crowd-motion deliverable contains no motion**, and **the two
armies' heroes are the same unit in the same colours.**

Be equally precise about what did *not* fail. The unit-level craft is at or above round-2
level: the head rebuild landed, the turn hop that round 2 asked for landed, the attack smear
is the best single mark in the set, the fodder archetypes part at 22 px in grayscale, and the
material clusters survive both the downscale and the desaturation. The cost report is
unusually honest — it volunteers the 0.94× screen-mass finding that most damages its own
tier story, and it refuses to quote its own frame-time numbers.

The gap is not craft. It is three specific things: a broken capture, a marking pass that
does not respect the scene, and a hero silhouette designed around a height multiplier that
the measurements themselves show does not buy mass. Items 1, 3, 4, 6 and 7 on the fix list
are all a day's work. Item 2 — giving the hero tier a positive identity mark instead of an
absence — is a design decision, and it is the one that decides whether this lane can carry a
crowd at all.
