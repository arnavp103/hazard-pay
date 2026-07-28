# Cold critique — round 5, Config SMALL (pixel control lane)

Provenance-cold. Steps 1–3 were written from the round-5 / round-4 / round-3 image
artifacts and the reference board only. `round-4/cold-critique-r4.md` was opened only
at step 4; `round-5/measurements.md` and `raw-*.txt` only at step 5. No source, no
diffs, no git history, no `gh`, no transcript.

Every number below is measured, with file and coordinates in the appendix. Anything
I could not measure is labelled **impression**. Three errors in my own instruments
were caught during the pass and are disclosed in §6 rather than quietly corrected.

---

## 1. Verdict

**Not shippable at SMALL — but this is the first round whose blockers are a short,
specific list rather than the whole picture.**

The environment is **bit-identical** to round 4: 0 pixels differ outside the crowd
band, and only 2011 pixels (1.55 % of the frame) changed in total. Every claim this
round makes therefore rests on a recolour of unchanged silhouettes plus a new idle
rig. Judged on that footing:

- **The livery move is real and the sprite work is disciplined.** Team colour left
  the coat and landed on helmet caps, pauldrons, shields and weapon housings. The
  authored palette is 17 colours, and the two factions' livery ramps are *exactly*
  matched — rust `#AA5E38`/`#E5A366`/`#67382B` at 223/50/20 px against blue
  `#1D4468`/`#4A7BA6`/`#12293F` at 223/50/20 px, on byte-identical silhouettes.
- **Symmetry holds in area and chroma; it fails in every contrast measure.** Rust
  separates from the shared coat at ΔE 50.0 and from the floor at ΔE 54.2; slate at
  ΔE 27.0 and ΔE 22.8 — **1.85× and 2.4× worse**. Whole-unit figure/ground contrast
  is 2.2× the floor grain for rust and only **1.2×** for slate.
- **Motion moved off FAIL but not to PASS.** Amplitude lock is broken and horizontal
  motion is new, but **91 % of units still have their dominant harmonic at exactly
  1600 ms** — the same single beat as round 4.
- **Tier separation regressed, measurably.** Hero livery density fell from 0.72× to
  0.59× of line-unit density. The most important units now carry the *least* team
  colour and are legible only via the HUD ring.

---

## 2. Eight-axis table

| # | Axis | Round 5 | Round 4 | Movement |
|---|------|---------|---------|----------|
| 1 | Crowd legibility | **BORDERLINE** | PASS | artifact unchanged — grading disagreement |
| 2 | Tier separation | **FAIL** | BORDERLINE | ↓ **measured regression** |
| 3 | Archetype separation (melee vs ranged) | **BORDERLINE** | PASS | artifact unchanged — grading disagreement |
| 4 | Gritty / dangerous / lived-in vs toy-like | **BORDERLINE** | BORDERLINE | → negative drift within grade |
| 5 | Character / environment cohesion | **BORDERLINE** | BORDERLINE | → negative drift within grade |
| 6 | Grayscale legibility | **PASS** | PASS | ↑ materially improved within grade |
| 7 | Motion | **BORDERLINE** | FAIL | ↑ **genuine improvement** |
| 8 | Deliberate pixel art vs noise | **BORDERLINE** | BORDERLINE | → unchanged (grain byte-identical) |

**Note on axes 1 and 3.** Silhouettes and geometry are unchanged from round 4 — 0
pixels of difference outside the recolour, which the author's own §6 also states and
which I verified independently. My lower grades there are a **disagreement with round
4's standard, not a regression in the artifact**, and I say so rather than laundering
it through the delta column.

---

## 3. Step 1 — blind sweep (recorded before any measurement)

Transcribed verbatim from the pre-measurement note.

### 3a. round-5 `crowd-small.png` / `crowd-small-unmarked.png`, true 1×

- **Heroes found, marked: 4 of 4.** Ring markers at roughly (100,133) and (128,119)
  amber, (233,120) and (285,146) cyan.
- **Heroes found, unmarked: 0–1 of 4.** I can talk myself into the unit near
  (233,120) reading as "bigger/brighter helmet", but I would not have called it a
  hero without having seen the marked plate. On the left I find nothing. Call it
  0 honest, 1 generous.
- **Archetype named for any individual unit: no.** Neither side, marked or unmarked.
  A vague sense that some front-row silhouettes carry a diagonal appendage; I cannot
  assign it to melee vs ranged and cannot do it per-unit.
- **Ranks per side: ~3 and ~3, low confidence.**
- **Two factions? Yes, by hue.** Left warm amber/rust, right cool teal/slate.
  Immediate, survives a squint.
- **Grey smear?** Neither is a full smear, but they are not equal. The left clump is
  hotter, brighter, more colour-dense; the right is dim and close to the plum ground
  in value. If either is smear-adjacent it is the right.
- **Expectations flagged for measurement to attack:**
  1. I expect the symmetry claim to FAIL — left looks like it carries more colour.
  2. I expect the left's warm to have gone *up* rather than the right coming up.
  3. Environmental confound: rust decals at ~x230–330 y40–70 and ~x345–395 y175–195
     are the same hue family as the LEFT team.
  4. The strongest eye-magnets in the frame are environment decals, not units.

### 3b. round-4 baseline

Marked 4 of 4; **unmarked 0 of 4**; archetype not nameable; ~3/~3 ranks. Faction read
weaker than r5: the left is mostly desaturated grey-brown with two or three hot
orange units near the back — warmth as a local hotspot, not a team property. The
right reads as a uniform dark teal mass, closer to a smear than anything in r5.
**r4 → r5 impression:** direction right, amount looks lopsided toward the left.

### 3c. Blind misses, recorded honestly

- **Miss 1 — "~3 ranks per side" was an invention.** There are no ranks. Helmet
  y-centroids form a continuous scatter from y106–169 (left) and y107–162 (right)
  with no periodicity. I perceived rows that are not in the data.
- **Miss 2 — expectation (2) was wrong.** The right team *did* come up: its livery
  chroma rose 0.143 → 0.255 (+78 %) while the left's stayed flat at 0.353. I
  predicted the lazy fix; the round did not take it. Credit where due.
- **Miss 3 — expectation (1) named the wrong quantity.** Livery *area* is
  near-symmetric and was already near-symmetric in round 4. My eye was reading
  contrast, which turned out to be the right thing to read — but I said "amount".
- **Hits — (3) and (4) were correct**, and turned out to matter more than I expected.
  See §5a.

---

## 4. Steps 2–3 — per-axis reasoning with measurements

### Axis 1 — Crowd legibility: BORDERLINE

Geometry is bit-identical to round 4, so nothing here is a round-5 regression.

- ~36 units total (~18/side), consistent with the author's stated 36. Total visible
  unit area 5155 px → **143 px/unit visible** against 154 px (stinger) / 220 px
  (breaker) authored, i.e. **~23 % of each unit is occluded**. That is moderate, not
  extreme — units are geometrically separable.
- The reason the crowd nonetheless does not resolve at 1× is **contrast, not
  overlap**. Whole-unit-vs-floor luma separation, expressed in units of the floor's
  own grain amplitude:

| | unit L | floor L | Δ | floor grain sd | **Δ / grain** |
|---|---|---|---|---|---|
| r4 left | 62.0 | 49.6 | 12.4 | 7.0 | 1.8 |
| r4 right | 58.4 | 50.5 | 7.9 | 8.0 | **1.0** |
| r5 left | 64.7 | 49.4 | 15.4 | 7.1 | 2.2 |
| r5 right | 60.2 | 50.3 | 9.9 | 8.0 | **1.2** |

**The slate team's silhouette stands only 1.2× above the noise floor it sits on.**
That is the measured form of my blind note that the right clump is smear-adjacent,
and it improved only marginally (1.0 → 1.2). The rust team is at 2.2 — nearly double.

The reference board's match-prototype anchor asks to "preserve **instant unit
separation** at the existing match-view scale". For one faction that is met; for the
other it is inside the grain. BORDERLINE. Round 4's second pass called the same
pixels PASS; I think that was generous to the slate side, and I am not going to
pretend the artifact moved.

### Axis 2 — Tier separation: FAIL

Four heroes, same four screen positions both rounds: (119,134), (140,98), (119,246),
(140,282). Blind unmarked recall: **0 of 4**.

The regression, measured inside the marker cores on the *unmarked* plates:

| | round 4 | round 5 |
|---|---|---|
| livery density, hero cores | 10.74 % | 11.81 % |
| livery density, rest of both clumps | 14.84 % | **19.90 %** |
| **hero / line ratio** | **0.72×** | **0.59×** |

Round 5 gave line units a 34 % livery increase and heroes a 10 % one. **The most
important unit on the field is now the least team-coloured thing in its own clump.**
`loupe-livery-4x.png` shows it directly: rust melee has bright pauldrons and a rust
helmet cap; rust hero is a large plain slate slab whose only saturated pixels are the
HUD ring.

The scale cue exists but is weak in situ: heroes give unbroken vertical unit runs of
17–26 px against a line-unit median of 6 px (p90 13) — but line-unit runs are chopped
by occlusion, so "tall column" competes with "less occluded", not with "smaller".

BORDERLINE → FAIL because the one thing that changed made it worse, and the tier is
now entirely dependent on a HUD overlay. `measurements.md` does not mention heroes in
its livery section at all.

### Axis 3 — Archetype separation: BORDERLINE

`idle-vocabulary-6x.png` names the archetypes: **breaker** and **stinger**. At native
resolution (recovered by 6× downsample; the plate is 98.1 % 6×6 block-uniform):

- breaker: 17 × 22 bbox, **220 px** filled — wide flaring shoulder mass.
- stinger: 15 × 22 bbox, **154 px** filled — narrow body, wide stance, and a
  1 px-tall × ~13 px-long horizontal rifle.
- silhouette **IoU 0.605**, XOR 92 px on a 233 px union.

The cue is objectively strong: the rifle highlight `#C9C3B8` sits at **ΔE 45.7 against
the coat** and ΔE 61.2 against the floor. The failure is *assignment*, not contrast —
at this crowd density a 13 px bar crosses neighbouring units and cannot be attributed
to one body. That is why my blind pass named no archetype while the 6× zoom showed
the bars instantly.

**The colour confound the brief asked about is real, and it is two confounds:**

- **Livery magnitude.** A breaker carries 37.6 native px of team colour on 220 px
  (17.1 %); a stinger 21.0 px on 154 px (13.6 %). In absolute area **1.79×** — and it
  sits exactly on the breaker's pauldrons, the feature that distinguishes the
  archetype. Helpful for reading, dishonest about what carries the read.
- **The bright teal `#2F9E96` is an archetype marker, not a faction marker.**
  Stingers carry exactly 1 native px; breakers carry 0 — identically on both
  factions. A single pixel of the frame's most saturated colour is doing archetype
  work. Unchanged from round 4 (crowd teal counts identical: 59 left, 14 right).

Silhouettes are unchanged from round 4, so this grade is a standard disagreement plus
a newly-quantified colour confound — which, to the author's credit, §4 of
`measurements.md` addresses head-on and honestly (see §7).

### Axis 4 — Gritty / dangerous / lived-in vs toy-like: BORDERLINE, drifting toward toy

The scene is still dark and quiet — 88.7 % of the frame below Y 0.25, 0.2 % above
Y 0.50. That holds the grade. The drift is measurable and is the cost of the livery
move:

- Saturated unit pixels (chroma ≥ 0.20) nearly **doubled**: 9.4 % → 18.3 % across
  both teams.
- The left team's **bright** budget went 4.5 % → **7.1 %** of unit pixels, 42 % over a
  5 % target; the excess is specifically the rust helmet `#C28D5B` at Y 0.58.
- The two factions' livery ramps are *exactly* matched, 293 px to 293 px, three tints
  each in identical proportion.

Perfect bilateral symmetry in matched kit colours reads as league livery, not a
lived-in war. Nothing was added in wear, damage, dirt or per-unit variation; the grit
in this frame still comes entirely from an environment that did not change.
**Impression:** pursued one more round without adding wear, this crosses into
toy-like.

On the **70/25/5** budget: I cannot recover the intended denominator from the images
alone, so I report both. Neither meets it — whole frame 88.7 / 11.1 / 0.2 (far too
quiet), unit pixels 46.4 / 48.1 / 5.5 (far too mid-heavy). The only figure near target
is combined unit bright at 5.5 %, split 7.1 % left against 3.7 % right.

### Axis 5 — Character / environment cohesion: BORDERLINE, drifting negative

The environment is **bit-identical** — 0 pixels differ outside y105–167, x62–318. The
grade cannot have improved through environment work and did not.

It got worse in a specific way. Per §5a, the set is 223 : 1 warm-to-blue, so round 5's
recolour pushed one faction *further into* the environment's own colour (left livery
14.29 % → 18.06 % of unit px) and the other *further away from* anything else in the
frame (blue chroma 0.143 → 0.255). One faction is now camouflaged, the other alien.
Both directions cost cohesion.

### Axis 6 — Grayscale legibility: PASS, materially improved

The supplied gray plates are honest: a true Rec709 conversion (mean abs error 0.52
levels, vs 2.18 for Rec601 and 4.31 for HSL lightness). Good practice, worth saying.

The value split on equipment is real and is the round's second genuine win:

| | round 4 | round 5 |
|---|---|---|
| livery-pixel gray separation, Cohen d | 0.98 | **1.03** |
| livery-pixel gray mean gap | 19.8 levels | **24.6 levels** |
| livery-pixel luma **histogram overlap** | 30.5 % | **7.3 %** |
| all-unit gray separation, Cohen d | 0.10 | 0.12 |

7.3 % overlap means the two factions' equipment values are near-fully separated in
grayscale. The claim holds.

Two caveats. First, the last row: **the crowd masses still do not separate** — 4.5
levels of 255, d = 0.12. The split lives on the 18–20 % of unit pixels that are
livery. At 1× on `crowd-small-unmarked-gray.png` I read two identical grey clumps; at
4× I read light caps versus mid caps.

Second, the split has a price nobody priced: it was achieved by putting rust in the
**bright** tier (gray mean 101.5, median 95) and blue in the mid (76.9, median 67).
The left team is 32 % brighter and carries 1.9× the bright-tier pixels. In a
competitive game one faction being systematically more salient is a defect, not a
neutral stylistic choice. `measurements.md` §1 acknowledges the emission gap and
argues the value split must win; it does not acknowledge that the same trade costs the
slate team its figure/ground read (Axis 1 table).

### Axis 7 — Motion: BORDERLINE (up from FAIL)

Measured by integer sprite offset via template matching — 83 tracked components in
r4, 70 in r5. `round-4/motion-small.gif` is 16 frames × 100 ms = 1600 ms;
`round-5/motion-small.gif` is 32 × 150 ms = 4800 ms, with **32/32 distinct frames** and
no sub-loop repetition (mean frame distance at lag 16 is 3198 px against an
off-diagonal mean of 2848).

**What genuinely improved:**

| | round 4 | round 5 |
|---|---|---|
| vertical p2p = exactly 2 px | 71.1 % (59/83) | **44.3 % (31/70)** |
| vertical p2p spread | 2 px dominant | 2 px 44 %, 3 px 33 %, 4 px 16 % |
| **zero** horizontal motion | 91.6 % | **35.7 %** |
| joint (ampY, ampX, turns) classes | 14, top class 57 % | **26, top class 14 %** |
| stagger, Rayleigh R of dominant phase | 0.153 | **0.113** |
| churn rate | 9 460 px/s | 10 507 px/s (+11 %) |

The amplitude lock is broken, horizontal motion exists where it essentially did not,
the class count nearly doubled while the dominant class collapsed from 57 % to 14 %,
and the crowd is well staggered (aggregate swing is 0.15× individual). Churn rate rose
only 11 %, so this is vocabulary, not amplitude — that part of the claim holds.
Round 4's outright FAIL is fixed.

**Why it is not a PASS — the claim overreaches in two places:**

1. **"Distinct idle beats per archetype" is not demonstrated.** The dominant harmonic
   in r5 is k = 3 over a 4800 ms loop for **64 of 70 tracks (91 %)** — which is
   4800/3 = **exactly 1600 ms, the same single beat as round 4** (r4: k = 1 for 72/83
   = 87 %). The longer loop buys per-cycle variation on an unchanged tempo. Minority
   beats exist (1200 ms ×13, 960 ms ×7, 800 ms ×4) but form a decaying tail
   consistent with per-unit jitter, not a small set of archetype classes. And the
   vocabulary plate gives **breaker and stinger the same five beat names**.
2. **The five beats are closer to three.** Pairwise column differences:
   `rest` vs `gear-adjust` = 612 plate px = **17 native px**, ~8 % of a 220 px sprite;
   `look` vs `weight-shift` = 2556 = 71 native px. Clusters are
   {rest ≈ gear-adjust}, {look ≈ weight-shift}, {settle}. A 17 px gesture will not
   survive to 1× in a crowd.

Also flagged: the effective frame rate **dropped** from 10 fps to 6.67 fps. Longer
loop, coarser sampling.

### Axis 8 — Deliberate pixel art vs noise: BORDERLINE (unchanged)

This axis splits cleanly, and the split is the whole finding.

**The art is deliberate.** The authored sprite palette is **17 colours over 3664
sprite pixels**, with the two factions' ramps exactly matched at 223/50/20 px each.
That is real discipline.

**The render is not.** The same sprites composited into the scene carry **1782 distinct
colours over 5155 unit pixels** — a ~105× palette explosion. The whole frame holds
8720 colours in 129 600 pixels. An unoccupied patch of floor (y120–160, x380–440)
contains **410 distinct colours in 2400 pixels**, per-channel sd ~6 levels.

- The grain is **baked**, not a capture artifact: per-pixel temporal SD across all 32
  GIF frames is **0.000**, and that patch is byte-identical between r4 and r5.
- There is **no block structure at any scale** — 2×2, 3×3 and 4×4 uniformity all
  0.000. `crowd-small.png` is not a nearest-neighbour presentation of a small buffer.
- The reference board asks for "**flat, cel-shaded color clusters instead of smooth
  rendering**" and warns against "haze in place of clean value grouping". A baked
  ±6-level per-pixel grain over a 17-colour palette is precisely that.

`measurements.md` states the grain is "a CSS overlay on the page, not part of the
art". That is a fair account of *provenance* and it is why the harness-exact surface
exists — but it is not a defence of the artifact. The committed PNG is what ships and
what a player sees, and in it the grain is inside the sprites, not behind them: the
unit pixels themselves carry 1782 colours. **Impression:** this is a pipeline defect
sitting on top of good art, and it is the cheapest item on this list to fix.

---

## 5. Adversarial confound hunt

### 5a. The set is 223 : 1 in favour of one faction — the round's biggest unexamined problem

Outside the two clump windows:

- environment **warm** pixels (hue 10–55, S ≥ 0.15): **4460** (3.44 % of frame)
- environment **blue** pixels (hue 195–260, S ≥ 0.15): **20** (0.02 % of frame)
- ratio **223 : 1**

The environment carries **8.9× the left team's entire livery area** in the left team's
own hue. The four largest environment warm blobs are 1489, 999, 861 and 605 px; the
largest single livery blob on any unit is **26 px**. The frame contains four warm
shapes each 23–57× larger than anything a unit wears.

Both consequences are asymmetric:

- **Rust is camouflaged and out-competed** — the left clump sits between a rust floor
  decal and a maroon wall, in a frame whose loudest shapes are its own colour.
- **Slate is the only unique saturated hue on a unit**, so it reads as "the team
  colour" while rust reads as "more of the world".

This is invisible to any sprite-sheet-level measurement — which is the level at which
this round's symmetry was verified, on both the harness-exact and capture surfaces.
The author's own `faction-symmetry-4x.png` shows it plainly: the rust panel includes
the orange floor rhombus and the maroon wall; the slate panel is clean plum.

### 5b. The "neutral" coat is not neutral — it is cool, and it favours slate

Shared body `#46534F`: hue 161.5°, L* 34.1, a* −6.0, b* +0.6 — a slate-**green**.

| identity | hue distance to coat | ΔE vs coat | ΔE vs floor |
|---|---|---|---|
| rust mid `#AA5E38` | 142° | **50.0** | **54.2** |
| blue mid `#1D4468` | **47°** | **27.0** | **22.8** |

The slate team's identity colour is a saturated version of the shared body sitting 47°
away in hue; the rust team's is 142° away and complementary. **Rust separates from the
body 1.85× better and from the floor 2.4× better**, and whole-unit figure/ground is
2.2× grain vs 1.2× (Axis 1).

So the symmetry claim is true in the metrics the round chose (area, and now roughly
chroma) and false in the metric that governs perception. Confounds 5a and 5b push in
*opposite* directions — the environment favours slate's distinctiveness, the coat
favours rust's — which is probably why the frame still looks roughly balanced at 1×.
That is luck, not design, and it will break the moment the environment changes.

`measurements.md` §2 comes close to this: it reports slate `l` sitting −14.3 below the
coat against rust's +30.8 and calls the *direction* of separation the faction. That is
a good idea. What it does not report is that the two directions are not equally
strong: −14.3 against +30.8 is a 2.15× imbalance in exactly the sense that matters.

### 5c. Did anything that passed in round 4 regress?

- **Tier separation: yes, measurably** (0.72× → 0.59×). Axis 2.
- **Grayscale, motion: improved. Crowd legibility, archetype: geometry untouched.**
- **Grit and cohesion: negative drift within grade**, quantified in Axes 4 and 5.
- The bright-value budget is newly over on one side (7.1 % vs a 5 % target); round 4
  was under on both (4.5 % / 2.8 %).

### 5d. Is anything else doing work the round attributes elsewhere?

- **HUD marker rings** do 100 % of the hero read. Blind unmarked recall 0/4.
- **The bright teal pixel** does archetype work while looking like a shared accent.
- **Livery magnitude** does archetype work (breaker 1.79× stinger) while being
  presented as faction-only.
- **Occlusion (~23 %)** makes the mass read denser than its ~36 units.

---

## 6. Errors in my own instruments, disclosed

Three, all caught during the pass. They are listed because a critique that hides its
own corrections is not auditable.

1. **Warm mask leak.** My first warm window used hue ≥ 335, which swallowed a **203 px
   maroon wall** at y103–122, x62–73 (`#593541`, hue 337°) and reported it as
   left-team livery — inflating left warm from 18.06 % to 25.6 % of unit pixels. This
   is the same class of error the brief flagged for the floor decal. Every figure here
   uses warm = hue 10–55. **A naive warm detector over-reports the rust team by ~40 %
   in this frame.**
2. **Colour-space mismatch.** My first symmetry pass used **HLS** saturation where
   round 4 and `measurements.md` use **HSV**. At S ≥ 0.35 this made round 4's slate
   livery vanish entirely (`#3f5268` is HSV 0.394 but HLS 0.246), and I briefly had
   "r4 slate cool accent = 0.00 %". Everything in §7 is redone in HSV.
3. **Unit count.** I initially read 79 livery blobs ≥ 5 px as ~40 units per side. A
   breaker carries a helmet cap plus two pauldrons and a stinger a cap plus a weapon
   housing, so blobs over-count units ~2.2×. The true count is ~36 total, matching the
   author. **I therefore retract a "6.3 px unit pitch" figure from my step-2 notes**;
   the correct occlusion figure is ~23 %, and Axis 1's reasoning is rebuilt on
   unit/floor contrast instead. The grade did not change, but its reason did.

---

## 7. Step 4 — against `round-4/cold-critique-r4.md`

Read only after §§1–5 were written. **No score was revised.**

`cold-critique-r4.md` contains two passes. Its §2 first-pass grades were BORDERLINE /
BORDERLINE / PASS / BORDERLINE / PASS / BORDERLINE / FAIL / BORDERLINE; its §8f
re-verification by a second critic settled on PASS / BORDERLINE / PASS / BORDERLINE /
BORDERLINE / PASS / FAIL / BORDERLINE. The delta column in §2 above uses the §8f
column, which is the one the brief supplied.

### 7a. Delta table, with the measurement that moved each axis

| # | Axis | R4 (§8f) | R5 | Move | Measurement that moved it |
|---|---|---|---|---|---|
| 1 | Crowd legibility | PASS | BORDERLINE | — | *nothing moved*; slate figure/ground 1.0 → 1.2× grain, still inside noise |
| 2 | Tier separation | BORDERLINE | **FAIL** | ↓ | hero/line livery density 0.72× → **0.59×** |
| 3 | Archetype separation | PASS | BORDERLINE | — | *nothing moved*; silhouettes byte-identical, IoU 0.605 |
| 4 | Gritty | BORDERLINE | BORDERLINE | → | saturated unit px 9.4 % → 18.3 %; left bright 4.5 % → 7.1 % |
| 5 | Cohesion | BORDERLINE | BORDERLINE | → | environment byte-identical; left livery 14.3 % → 18.1 % into a 223:1 warm set |
| 6 | Grayscale | PASS | PASS | ↑ | livery luma histogram overlap **30.5 % → 7.3 %** |
| 7 | Motion | **FAIL** | **BORDERLINE** | ↑ | exactly-2 px 71 % → 44 %; zero-horizontal 92 % → 36 %; classes 14 → 26 |
| 8 | Deliberate pixel art | BORDERLINE | BORDERLINE | → | grain byte-identical; 17 authored colours → 1782 rendered |

Two axes moved up, one down, five flat — of which two are flat only because I decline
to award round 4's grade on unchanged pixels.

### 7b. Where my figures do not reproduce round 4's

**The 37.1 % / 0.0 % headline does not reproduce, and the "0.0 %" was never
informative.** Round 4 states its detector as *"warm-accent pixels (hue < 45° or
> 350°, sat ≥ 0.35) as a share of unit pixels"* on `crowd-small.png`, band y100–182.

- Run exactly as stated on my full-silhouette unit mask, round 4's left clump reads
  **16.48 %**, not 37.1 %. Reaching ~37 % requires a body-only denominator that drops
  the dark outline and leg pixels — I get 22.4 % / 23.5 % / 25.6 % as I raise the
  luminance floor. **The figure is denominator-inflated by roughly 2×.**
- Its window y100–**182** includes eleven rows of the orange floor decal. Of the 701
  warm pixels in that window, **197 are floor decal and 124 are HUD marker ring** —
  46 % of the raw warm count is not unit livery at all. Round 4's own §8 criticises
  its first pass for exactly this class of error and then repeats it.
- The **"0.0 %"** is a warm-only detector pointed at a blue faction. It cannot return
  anything else. Re-run unchanged on round 5 it still gives left 18.92 % / right
  **0.00 %**. `measurements.md` §2 makes the same point and is right to.
- Round 4 also reports right-team **cool** accent at 20.0 %, and compares it directly
  against the 37.1 % warm figure to claim a 1.85× asymmetry. Those two numbers come
  from differently-thresholded detectors on differently-scoped masks and **are not
  commensurable**. I cannot reproduce 20.0 % under any threshold I tried.
- Round 4's *"68 orange runs ≥ 4 px left vs 0 right"*: I get **48 vs 0** with its
  stated detector. Same conclusion, count differs by mask.

**Motion partly reproduces.** Round 4 reports 45 tracked components, median 2.00 px,
**28 of 45 at exactly 2.00**. My tracker finds 83 components (I track livery blobs on
both teams; round 4 tracked warm-livery components only, which is why its n is ~half)
and **59 of 83 = 71.1 % at exactly 2 px** against its 62 %. Same finding, larger
sample, and I confirm its diagnosis: 91.6 % of round-4 units had **zero** horizontal
motion. Its FAIL was correct.

**A caution about round 4's component count.** Tracking "warm-livery components" in a
window that reaches y182 and x55 picks up the floor decal and the maroon wall as
components — with a loose warm window I get blobs of 287 px and 232 px that are
environment, not units. Round 4's "45" may be partly environmental. My tracks are
restricted to y103–171 and to blobs of 4–45 px.

### 7c. Where I disagree with myself after reading round 4

One place, and I am recording it rather than acting on it. Round 4's §8f raised crowd
legibility to PASS on the stated ground that the right side no longer "reads as one
animal". My Axis-1 measurement supports that the *fusion* problem improved — but it
also shows the slate team sitting at 1.2× the floor grain, which the earlier passes
did not measure. Had I seen that number framed as round 4 framed it, I might have
written PASS in step 3 and then had to defend 1.2×. I prefer my BORDERLINE. I note
that this makes my column stricter than round 4's on two axes and that a reader
comparing rounds should read those two as "unchanged", not "worse".

---

## 8. Step 5 — audit of `round-5/measurements.md`

This is a good measurements document — better than round 4's. It separates a
harness-exact surface from the capture surface, states its value-band rules up front,
explains why the L ≥ 25 floor exists, flags the y171 decal trap explicitly, and labels
its own residual defects ("the residual 4-of-36 collision… is reported rather than
papered over"). Several of its claims are things I independently verified before
reading it. That is the standard.

It also overstates in three specific places.

### 8a. Reproduces — verified independently before reading

| Claim | Status |
|---|---|
| "Both fodder silhouette masks are byte-identical to round 4… every changed cell changes which palette role it carries, never whether it is filled" | **Confirmed.** 2011 changed px, 0 outside the crowd band, 0 silhouette mismatch in all 10 vocabulary-plate cells. |
| "The record's 37.1 % / 0.0 % figure is a warm-only detector… it will stay unchanged for any faction pair that differs in hue" | **Confirmed and then some** — see §7b. Its 18.8 / 0.0 → 21.2 / 0.0 vs my 16.48 / 0.00 → 18.92 / 0.00. Same finding, ~2 pt denominator offset. |
| "Round 4's cool faction… was neither a value event nor a saturation event" | **Confirmed.** r4 slate livery chroma 0.143 against rust 0.353 (2.47×); r5 closes it to 0.255 vs 0.353 (1.38×). This is the round's real win. |
| Grayscale: rust/slate gear apart 10.0 → 20.6 (2.06×) | **Substantially reproduces.** On its own mask (HSV S ≥ 0.35, L ≥ 25, unmarked) I get **13.5 → 24.2, 1.79×**. Direction and rough magnitude hold. |
| Ramp table `l`/`L`/`i` hex values and ΔL 22.8 → 45.1 | **Confirmed** against the authored palette recovered from `idle-vocabulary-6x.png`. |
| "36 distinct beat start times across 36 units" | **Confirmed** in effect — Rayleigh R of dominant phase 0.113, aggregate/individual sd ratio 0.151. Stagger is genuinely good. |
| Frame-level value budget 87.9/11.9/0.18 → 87.7/12.1/0.20 | **Reproduces** (I measure 88.5/11.3/0.2 → 88.7/11.1/0.2 on slightly different band edges). |
| "livery-role share… immune to hue and value entirely" 13.4/11.1 → 15.4/14.2 | **Consistent** with my area figures (14.32/14.39 → 18.09/19.79 on a different mask). Cannot verify the role buffer from images; **impression:** plausible. |

### 8b. Does not reproduce

**The headline symmetry number.** §2 claims capture-surface asymmetry **6.17 pts →
0.98 pts**. Running its own stated detector (own-hue windows, HSV S ≥ 0.35, L ≥ 25,
band y100–170) on my unit mask:

| | rust | slate | asymmetry |
|---|---|---|---|
| R4 marked | 15.37 | 11.84 | **3.54 pts** |
| R5 marked | 17.77 | 21.18 | **3.41 pts** |
| R4 unmarked | 14.05 | 9.63 | **4.42 pts** |
| R5 unmarked | 16.50 | 19.75 | **3.24 pts** |

I get **4.42 → 3.24 pts**, not 6.17 → 0.98. More importantly: **the asymmetry did not
close, it crossed over.** In round 4 rust led by ~4 pts; in round 5 slate leads by
~3 pts. The magnitude of imbalance is roughly unchanged; only its sign flipped. The
0.98 pt figure depends on the author's unit mask, which I cannot inspect.

This does not overturn the round — the *chroma* fix is real and large, and the
crossover means both teams are now visible, which round 4's was not. But "0.98 pts"
is a tighter claim than the capture supports.

### 8c. Stated in a way I consider misleading

1. **"Distinct posed frames the crowd can show: 55 → 288."** This is the document's
   most quotable motion number and it is a **capacity** figure, not an observation. It
   counts (unit × pose) combinations the program *could* emit. What a player sees is a
   32-frame loop in which **91 % of units bob at the same 1600 ms fundamental as round
   4**. A 5.2× rise in available states alongside an unchanged tempo should be
   presented as such. The document's own capture-side rows (peak changed px 2.89 % →
   4.89 %) are the honest measure, and they are +70 %, not +424 % — and even that
   overstates, because r5's frames are 150 ms apart against r4's 100 ms; per second
   the churn rate rises only **+11 %**.
2. **"Moving the livery onto the gear did not break the budget… which moves *toward*
   the 25 % target from below, not past it."** True for the identity band as
   aggregated. It elides that the **emission** band on rust went to 6.6 % harness /
   7.1 % capture against a 5 % ceiling, and is 3.7× the slate figure. §1's "honest
   note" defends the *gap* as canon but does not note that the rust side is over the
   ceiling in absolute terms. My independent figure: left bright 7.1 % of unit px.
3. **"No film grain (the grain is a CSS overlay on the page, not part of the art), so
   it is the right surface for palette questions."** Correct about provenance, and the
   harness surface is genuinely the right place to ask palette questions. But it is
   used to move the grain outside the frame of judgement, and the grain is in the
   committed PNG that this critique — and a player — sees: 17 authored colours become
   **1782** across the unit pixels themselves. Whether it lives in CSS or in the
   sprite sheet, it is what ships.

A fourth, smaller: §4 concludes the run-length archetype badge is "reduced, not
eliminated, and stated as such". That is fair and well-handled. But the badge that
matters more is not run length — it is **total livery area**, breaker 1.79× stinger,
which §4 reports as "the livery-pixel ratio between the archetypes fell 2.25× → 2.0×"
on isolated lineup units and does not carry through to the crowd. Colour still encodes
archetype at 2×.

---

## 9. Step 6 — the explicit questions

### 9a. Is round 5 shippable at SMALL?

**No — but for two blockers, not for the whole picture.** The faction work is close to
finished; a round 6 that fixes heroes and the rust/environment collision would be
shippable. What blocks it now:

1. **Heroes are invisible without the HUD** (0/4 blind, livery density regressed to
   0.59×). A tier that only exists in the overlay is not a tier.
2. **The slate faction sits at 1.2× the floor grain.** One of two factions has
   figure/ground contrast inside the noise.

### 9b. Did the cofounder's instruction land, or does it read as colour blocking?

**It landed, and it does not read as colour blocking.** Both halves are measurable.

*Landed:* colour left the coat. Round 4 carried a horizontal warm sash across the
torso (`#954D36` running x104–109 at y144); round 5 has coat colour at that address
and puts the warm on a helmet cap and pauldron instead. The authored ramps confirm it
— livery now sits on helmet, pauldron, shield and weapon housing, and the coat is a
single neutral `#46534F` shared by both factions.

*Not colour blocking:* livery is 18.1 % / 19.8 % of unit pixels, distributed across
~37–42 discrete blobs per side of median size 9–14 px, with the **largest single
livery blob on any unit at 26 px**. Colour blocking would be one large flat zone per
unit; this is many small ones on functional hardware. That is the difference between
livery and a jersey, and the round is on the right side of it.

Two qualifications. It landed **unevenly on weapons** — the stinger's rifle gets a few
housing pixels while the metal barrel stays neutral, so "weapons in general" is
half-done. And it **did not land on heroes at all** (§Axis 2), which is where a
cofounder looking at a match would look first.

### 9c. Single biggest remaining defect

**The faction read is symmetric on the sprite sheet and asymmetric in the scene, and
every instrument the round used measures the sprite sheet.**

Livery area is symmetric (18.09 % vs 19.79 %) and chroma is nearly so (0.353 vs
0.255). But rust separates from the shared coat at ΔE 50.0 against slate's 27.0;
from the floor at ΔE 54.2 against 22.8; and whole-unit figure/ground is 2.2× the floor
grain against **1.2×**. Meanwhile the set carries **4460 warm pixels against 20 blue**
— 223 : 1 — so the rust team is camouflaged by an environment in its own hue while the
slate team is the only unique saturated thing on the field.

The two effects currently cancel to something that looks balanced at 1×. That is luck.
It will break the first time the environment changes, and nothing in the round-5
measurement surface would detect it, because both surfaces measure units in isolation.

### 9d. What round 6 should do, ranked

1. **Give heroes their livery back, and then some.** Target hero livery density at
   **≥ 1.5× line units** (currently 0.59×). A hero should be the most
   team-coloured thing in its clump, not the least. This is the one outright
   regression and the cheapest fix on the list. *Test: blind unmarked hero recall ≥
   3/4; hero/line density ratio ≥ 1.5.*
2. **Lift the slate faction's figure/ground above the grain.** Slate is at 1.2× the
   floor grain against rust's 2.2×. Either darken the slate coat's rendered value
   against the floor, or lift the floor away from it locally. *Test: both factions
   ≥ 2.0× floor-grain sd on unit-vs-floor luma delta.*
3. **Kill the render grain, or take it out of the sprites.** 17 authored colours
   become 1782 in the committed PNG; the board asks for "flat, cel-shaded colour
   clusters instead of smooth rendering". If the grain is a CSS overlay, mask it off
   the units. This is a pipeline change, not an art change, and it will improve
   axes 1, 6 and 8 at once. *Test: ≤ 40 distinct colours across unit pixels in the
   committed capture.*
4. **Break the rust/environment hue collision.** 4460 environment warm px against 20
   blue. Either shift the environment's decal family off the rust hue, or move the
   rust faction's hue away from the set dressing. Do not solve it by raising rust's
   saturation further — the bright budget is already at 7.1 % against a 5 % ceiling.
   *Test: environment warm : blue ratio under 10 : 1, or rust livery hue ≥ 40° from
   the nearest large environment decal.*
5. **Give the archetypes different tempi, not just different amplitudes.** 91 % of
   units share a 1600 ms fundamental. Put breakers on a slow beat and stingers on a
   fast one and the crowd will sort itself visually without any silhouette work.
   *Test: two beat clusters each holding ≥ 30 % of units, ≥ 1.5× apart in period.*
6. **Add wear.** Nothing in this frame is dirty, dented or non-uniform; the two
   liveries are exactly matched at 293 px each. Per-unit variation in the livery ramp
   would buy grit and crowd texture together, and is the only item on this list that
   addresses axis 4 directly.
7. **Stop letting one bright teal pixel carry archetype.** Either promote it into a
   real archetype cue or remove it; at present it is the most saturated colour in the
   frame doing invisible work.

---

## 10. Appendix — every figure with file and coordinates

Windows used throughout: **LEFT** y103–171 x62–169, **RIGHT** y103–171 x214–319,
derived from the motion mask (column runs 62–168 and 214–318, zero motion between).
Band y100–170 used where matching the author. Warm = hue 10–55°, blue/cool =
195–260°, unless a round-4 or author reproduction is stated, which uses hue < 45 or
> 350 with **HSV** S ≥ 0.35 and L ≥ 25. Unit mask = ¬(G ≤ R ∧ G ≤ B ∧ S < 0.25 ∧
0.135 ≤ L < 0.34). All zooms nearest-neighbour; no content resampled.

### Frame and geometry
| figure | value | source |
|---|---|---|
| canvas | 480 × 270 | all `crowd-small*.png` |
| r4→r5 changed px (Σ\|Δ\| > 12) | 2011 (1.55 %) | `round-{4,5}/crowd-small-unmarked.png` |
| change bbox | y105–167, x62–318; 0 px outside | same |
| change split | 816 left / 1195 right | same |
| block structure 2×2 / 3×3 / 4×4 | 0.000 / 0.000 / 0.000 uniform | `round-5/crowd-small-unmarked.png` |
| moving px over loop | r5 6026, r4 5012; bbox y103–175 x62–318 both | `motion-small.gif` |
| units | ~36 total (~18/side); 143 px/unit visible vs 154–220 authored → ~23 % occluded | LEFT+RIGHT windows |

### Colour and palette
| figure | value | source |
|---|---|---|
| authored sprite palette | **17 colours / 3664 px**; rust 223/50/20, blue 223/50/20 | `idle-vocabulary-6x.png` → native (98.1 % 6×6 uniform) |
| same sprites rendered | **1782 colours / 5155 unit px** | `round-5/crowd-small-unmarked.png`, both windows |
| whole frame | 8720 colours / 129 600 px | same |
| flat floor patch | 410 colours / 2400 px; sd 6.1/5.5/6.3 | y120–160, x380–440 |
| grain temporal sd | **0.000**; r4↔r5 max Δ = 0 | `round-5/motion-small.gif` same patch |
| coat `#46534F` | hue 161.5°, L* 34.1, a* −6.0, b* +0.6 | authored palette |
| rust `#AA5E38` vs coat / floor | ΔE **50.0** / **54.2**; hue dist 142° | derived |
| blue `#1D4468` vs coat / floor | ΔE **27.0** / **22.8**; hue dist 47° | derived |
| my false-positive | 203 px maroon wall `#593541` hue 337° | y103–122, x62–73 |

### Identity colour and symmetry
| figure | r4 | r5 | source |
|---|---|---|---|
| LEFT unit px / livery | 2961 / 424 = **14.32 %** | 2780 / 503 = **18.09 %** | windows, hue 10–55 |
| RIGHT unit px / livery | 2543 / 366 = **14.39 %** | 2375 / 470 = **19.79 %** | windows, hue 195–260 |
| livery mean chroma | L 0.353 / R **0.143** (2.47×) | L 0.353 / R **0.255** (1.38×) | same |
| saturated unit px (C ≥ 0.20) | L 14.9 / R 2.7 (5.5×) | L 18.2 / R **18.5** (1.02×) | same |
| own-hue share, HSV S ≥ 0.35, y100–170, unmarked | rust 14.05 / slate 9.63, **4.42 pts** | rust 16.50 / slate 19.75, **3.24 pts** | author's detector |
| r4-style warm-only detector | L 16.48 % / R 0.00 % | L 18.92 % / R **0.00 %** | marked, y100–182, x55–195 |
| decomposition of r4's 701 warm px | 197 floor decal + 124 HUD ring + 380 livery | `round-4/crowd-small.png` |
| environment warm : blue | — | **4460 : 20 = 223 : 1** | outside both windows |
| largest env warm blobs | — | 1489 / 999 / 861 / 605 px vs largest unit livery blob **26 px** | same |

### Value and grayscale
| figure | r4 | r5 | source |
|---|---|---|---|
| unit budget LEFT (quiet/mid/bright, Y thresholds .25/.50) | 46.9 / 48.6 / **4.5** | 45.2 / 47.7 / **7.1** | LEFT window |
| unit budget RIGHT | 45.2 / 51.9 / 2.8 | 47.7 / 48.6 / 3.7 | RIGHT window |
| unit budget BOTH | 46.1 / 50.1 / 3.7 | 46.4 / 48.1 / **5.5** | both |
| whole frame | 88.5 / 11.3 / 0.2 | 88.7 / 11.1 / 0.2 | full canvas |
| gray plate fidelity | — | Rec709 err **0.52** (Rec601 2.18, HSL-L 4.31) | `crowd-small-unmarked-gray.png` |
| livery gray mean L / R | 95.5 / 75.7, gap 19.8, d 0.98 | 101.5 / 76.9, gap **24.6**, d **1.03** | gray plate ∩ livery mask |
| livery luma histogram overlap | 30.5 % | **7.3 %** | same |
| all-unit gray sep | 3.6 levels, d 0.10 | 4.5 levels, d 0.12 | same |
| unit-vs-floor Δ / floor grain sd | L 1.8, R **1.0** | L 2.2, R **1.2** | both windows |

### Archetype and tier
| figure | value | source |
|---|---|---|
| breaker | 17 × 22 bbox, 220 px | `idle-vocabulary-6x.png` row 1, native |
| stinger | 15 × 22 bbox, 154 px | row 2, native |
| breaker vs stinger | IoU **0.605**, XOR 92 / union 233 px | derived |
| livery load | breaker 37.6 px (17.1 %) vs stinger 21.0 px (13.6 %) = **1.79×** | rows 1–2 vs 3–4 |
| faction silhouette mismatch | **0 px** in all 10 cells | rows 1↔3, 2↔4, all 5 beats |
| bright teal `#2F9E96` | stinger 1 native px, breaker 0, both factions | same |
| rifle `#C9C3B8` vs coat / floor | ΔE **45.7** / 61.2 | derived |
| hero markers | (119,134) (140,98) (119,246) (140,282), both rounds | marked − unmarked diff |
| hero livery density | r4 10.74 % vs line 14.84 % = **0.72×**; r5 11.81 % vs 19.90 % = **0.59×** | marker cores inset 3 px, unmarked |
| hero vertical run | 17–26 px vs line median 6 (p90 13) | LEFT/RIGHT windows |

### Motion
| figure | r4 | r5 | source |
|---|---|---|---|
| loop | 16 × 100 ms = 1600 ms | 32 × 150 ms = **4800 ms** | GIF delays |
| distinct frames | 16/16 | **32/32**, no sub-loop repeat | frame distance matrix |
| tracks | 83 | 70 | livery blobs 4–45 px, template-matched integer offsets |
| vertical p2p = exactly 2 px | **59/83 = 71.1 %** | **31/70 = 44.3 %** | same |
| vertical p2p spread | 1 px 18 %, 2 px 71 %, 3 px 6 % | 2 px 44 %, 3 px 33 %, 4 px 16 % | same |
| zero horizontal motion | **76/83 = 91.6 %** | **25/70 = 35.7 %** | same |
| joint (ampY,ampX,turns) classes | 14; top 47/83 = 57 % | **26**; top 10/70 = **14 %** | same |
| dominant harmonic | k=1 for 72/83 (87 %) → **1600 ms** | k=3 for 64/70 (91 %) → **1600 ms** | FFT of offset series |
| minority beats | — | 1200 ms ×13, 960 ms ×7, 800 ms ×4 | turns-per-loop |
| stagger, Rayleigh R | 0.153 | **0.113** | dominant-component phase |
| aggregate/individual sd | 0.165 | 0.151 | mean offset over units |
| churn | 946 px/frame = 9460 px/s | 1576 px/frame = **10 507 px/s** (+11 %) | consecutive-frame diff > 18 |
| beat distinctness | — | rest↔gear-adjust **17 native px**; look↔weight-shift 71 px | `idle-vocabulary-6x.png` columns |

### Working images generated (nearest-neighbour only)
`/tmp/zoom/r{4,5}-{left,right}-6x.png` (crops 150×75 at +50+98 and +195+98, 600 %) ·
`/tmp/zoom/r{4,5}-gray-4x.png` (270×80 at +55+98, 400 %) ·
`/tmp/zoom/r5-huemask-2x.png`, `r5-unitmask-3x.png`, `r5-unitfull-3x.png` (mask
overlays) · `/tmp/zoom/heroes.png` (30×30 at +120+105 and +232+105, 800 %) ·
`/tmp/zoom/vocab-native.png`, `loupe-native.png` (6× / 4× inverse, grid offset 0,0).
