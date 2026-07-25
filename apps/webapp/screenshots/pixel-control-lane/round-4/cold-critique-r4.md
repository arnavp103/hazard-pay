# Cold critique — round 4, Config SMALL

Provenance-cold. I did not read `apps/webapp/src/`, git history, either
`cost-report.md`, or `round-3/cold-critique-r3.md` until after section 6 was
written. Everything numeric below comes from a measurement I ran on the PNGs
with PIL/numpy; file and coordinates are in the appendix. Where I could not
measure something I say "impression".

---

## 1. Overall verdict

**Config SMALL partially recovered. The specific thing this round set out to
fix — the archetype read — is genuinely fixed, and it is fixed by shape, not
by staging. That result is real and it is measurable. But it was bought by
dimming the whole render, and the bill landed on the hero tier, which
regressed.**

The one-line summary: round 4 turned two nearly identical fodder blobs into
two distinguishable soldiers, and turned four findable heroes into two
findable heroes and two that vanish.

Ship SMALL. LARGE is not a fallback — it is 2–3× flatter per pixel
(0.187–0.271 interior edges/px vs SMALL's 0.313–0.649) and its archetype read
is *more* positional than round-3 SMALL's was, not less.

*Added after step 4, without changing any grade:* the previous critic put
round-3 SMALL at six FAILs and two BORDERLINEs and called it "not shippable at
all." Against that baseline round 4 moves **six axes up, none down, two flat**
(§6). My "partially recovered" is the honest reading of the render in
isolation; it is more pessimistic than the delta. Both numbers are true and
the delta is the more useful one.

---

## 2. Eight-axis table

| # | Axis | Round 4 SMALL |
|---|------|---------------|
| 1 | Crowd legibility | **BORDERLINE** |
| 2 | Tier separation | **BORDERLINE** (regressed) |
| 3 | Archetype separation (melee vs ranged) | **PASS** |
| 4 | Gritty / dangerous / lived-in vs toy-like | **BORDERLINE** |
| 5 | Character / environment cohesion | **PASS** |
| 6 | Grayscale legibility | **BORDERLINE** |
| 7 | Motion | **FAIL** |
| 8 | Deliberate pixel art vs noise | **BORDERLINE** |

---

## 3. The blind sweep, recorded before any measurement

### 3a. `round-4/crowd-small.png`, marked, at true 1x

- **Heroes:** I found **2 of 4 with confidence** — one high in the left clump
  with an orange rim (I put it near x≈133, y≈115) and one low-left (x≈98,
  y≈140). On the right clump I saw *something* brighter around x≈237 and
  x≈285 but I would not have called them heroes if I had not been told there
  were four. Called it 2 confident / 2 guessed.
- **Melee vs ranged inside the clump:** **no.** At 1x I could see that some
  units had a thin light horizontal streak and some did not, but I read that
  as highlight noise, not as a weapon. I could not have named an archetype
  for any individual unit.
- **Ranks:** I counted **3, possibly 4** per side. (Measured later: 4.)
- Other cold impressions: the left clump reads warm and the right clump reads
  as a grey smear. I noticed that asymmetry before I measured anything, and
  it turned out to be the largest confound in the render.

### 3b. `round-4/crowd-small-unmarked.png`, at true 1x

- **Heroes: 0 of 4.** I could not pick out a single hero. I made two guesses
  from memory of the marked frame, which is not a finding.
- Archetype: no.
- Ranks: same 3–4.

### 3c. `round-3/crowd-small.png`, marked, at true 1x (same method)

- **Heroes: 4 of 4, immediately.** Two bright orange lit columns on the left,
  two cyan on the right. They read as lit tombstones — silly, but findable.
- **Melee vs ranged: no.** Same failure as round 4.
- **Ranks: 3.** The round-3 clump reads flatter.

**Recorded miss to hold myself to:** in the cold sweep I judged round 3 as
*better* on hero-finding and round 4 as better on "these look like soldiers."
The measurements below confirmed both halves of that, which is worth saying
because it means the round-4 change is not a strict improvement.

---

## 4. Per-axis reasoning, with measurements

### Axis 1 — Crowd legibility: BORDERLINE

Unit-vs-floor luminance separation, measured over the crowd band
(y 100–182), unit pixels selected as non-plum hue:

| | unit mean L | floor mean L | Δ |
|---|---|---|---|
| R4 SMALL left | 80.3 | 49.1 | **31.1** |
| R4 SMALL right | 70.9 | 48.1 | **22.8** |
| R3 SMALL left | 85.4 | 48.3 | 37.1 |
| R3 SMALL right | 75.3 | 47.8 | 27.5 |

Both sides got *less* separated from the floor than in round 3 (−6.0 left,
−4.7 right). The units are darker.

Fusion. Connected components of the unit mask, per clump, after a 2×2 opening:

| | unit px | comps | largest comp | largest as % of clump mass |
|---|---|---|---|---|
| R4 left | 2677 | 24 | 732 | 27% |
| R4 right | 1679 | 18 | **852** | **51%** |
| R3 left | 2459 | 25 | 477 | 19% |
| R3 right | 1501 | 27 | 443 | 30% |

The right clump in round 4 is the worst fusion number in any image I
measured: one blob holds **51%** of the side's visible mass. That is the grey
smear I saw cold. The melee got 4 px wider this round (13→17 px shoulder
span, see axis 3) and on the team with no accent colour the extra width fuses
neighbours instead of describing them.

**Depth shading is new and it works.** Mean unit luminance by screen-y band in
the left clump:

| band | R3 SMALL | R4 SMALL |
|---|---|---|
| y100–125 (back) | 84.0 | **67.0** |
| y125–140 | 84.7 | 74.4 |
| y140–155 | 83.6 | 78.7 |
| y155–182 (front) | 86.1 | **88.6** |

Round 3 was flat to within 2.5 luma across the whole clump depth — one plane.
Round 4 has a monotone **21.6-luma ramp** from back rank to front. That is a
real, new depth cue and it is the largest single reason the round-4 clump
reads as a body of troops rather than a decal. It also turns out to be the
mechanism behind the hero regression (axis 2), so it is not free.

At 6× the crowd is excellent (`/tmp/pixel-r4/r4-left-6x.png`); at 1× the left
side reads as a formation and the right side reads as one animal. That split
is why this is BORDERLINE and not PASS.

### Axis 2 — Tier separation: BORDERLINE, regressed

Hero geometry is unchanged by design: hero 28 px + 1 px marking halo = 30 px
tall vs fodder 22 px (`round-4/lineup-small.png`, hero y124–153, melee
y133–154, ranged y133–154). +27% height.

The marking is what changed. Measured on the marked/unmarked pair, taking the
bright stroke only (the marking is two-tone: a dark ink half at gray 13–18
and a bright half):

| | marking bright stroke, 75th pct / max gray | body gray | contrast |
|---|---|---|---|
| R4 SMALL left | 138 / **141** | ~56 | +85 |
| R4 SMALL right | 101 / **103** | ~59 | +44 |
| R3 SMALL left | 170 / **171** | ~64 | +107 |
| R3 SMALL right | 123 / **125** | ~56 | +69 |
| R3 LARGE left | — | — | (mean-based: 76.4) |

The marking's bright stroke lost **18% of its luminance on both sides**
(171→141, 125→103). Mean luminance change of a marking pixel against the
pixel it replaced: R4 right = **−0.2**. On the right team the marking is very
close to a pure hue rotation with no value change.

**But the marking colour itself was not changed — the depth shading dimmed
it.** Vertical scan through the hero crown in the lineups:
`round-3/lineup-small.png` (146, 127) = `#dea070`, L=169.7;
`round-4/lineup-small.png` (146, 125) = `#dda171`, L=170.3. Identical, within
grain. Both are seated correctly: `#160f14` (L=16.8) directly above the R3
band, `#181216` (L=19.6) above the R4 band — 1 px ink / 1 px bright / 1 px
ink in both rounds. (`round-3/lineup-large.png` x=145 gives the same
structure with a 2 px bright band.)

So the authored ring is unchanged and the drop is entirely the new depth
ramp. Crowd-to-lineup mean unit luminance ratio: **R3 0.953, R4 0.889**. Both
heroes on each side sit in the darker back/middle bands (marking bboxes at
y111–128 and y132–150 against a clump running to y182), so they take the
worst of the ramp. The round bought depth by darkening the back of the
formation and then left its two most important units back there.

Also note the ring lost pixels on the right team specifically: bright ring
pixel count (L≥90 marking pixels) fell **158 → 63** on the right versus
142 → 123 on the left. The right team's marking is 60% smaller *and* 18%
dimmer.

Unmarked, the hero is undetectable — 0/4 in my blind sweep. The measurable
reason is that the hero's identity is an *absence*: longest unbroken vertical
body run without an interior value break is **14 px** for the hero vs 7 px
(melee) and 5 px (ranged); interior edge density is **0.313 edges/px** for the
hero vs 0.566 (melee) and 0.649 (ranged). The elite unit is the least-drawn
object on the board. It is a blank slab wearing a 1 px outline.

And the outline is only half an outline: all four marking components measure
exactly **18 px tall × 22 px wide** on a 28 px sprite. The marking traces the
torso and arms and stops at the waist. "Grown from its silhouette" is true of
the top 64% of the silhouette.

### Axis 3 — Archetype separation: PASS. This is the round's win.

Silhouettes from `round-4/lineup-small.png`:

- **melee**, y133–154, x98–114: **17 px** shoulder span. Symmetric pale wedges
  at x98–100 (3 px) and x111–114 (4 px) on rows 140–142. Orange helmet band
  6 px wide (row 135), orange shoulder pads rows 137–139, orange belt 8 px
  (row 144). Body proper 10 px wide.
- **ranged**, y133–154, x176–190: body **7 px** wide (x178–184), plus a
  **1 px tall, 11–12 px wide** pale bar at row 141 (x178–188) — a levelled
  rifle. Helmet band only 4 px and broken (`OTOO`).

Round 3 by comparison: melee x101–116 (16 px), ranged x175–186 (12 px). No
protruding weapon on either. The round-3 discriminator was 4 px of body
width; the round-4 discriminator is a 12 px bar that is a different *kind* of
shape.

**Detection test.** A shape-only detector — a single-row run of ≥10 pale
pixels — finds exactly **16 rifles in `round-4/crowd-small-unmarked.png`, 8
per side, zero false positives.** The same detector finds **0** in
`round-3/crowd-small-unmarked.png` and 4 (all length 6) in
`round-3/crowd-large-unmarked.png`. The round-4 ranged cue is machine-legible
from silhouette alone; the round-3 one did not exist.

**Occlusion survival.** All 16 rifles appear at full 11–12 px length; none is
clipped. On the left team where I have a complete melee inventory, 6/8 melee
show wedges on both sides and 8/8 show at least one, with ≥11 wedge pixels
visible on 7/8. Both cues survive crowding.

I verified my whole left-team inventory visually by overlaying the detected
centres on a 6× crop (`/tmp/pixel-r4/r4-annotated.png`): 8 melee, 8 ranged,
2 heroes, every marker on the right unit.

### Axis 4 — Gritty / dangerous / lived-in: BORDERLINE

Improvements I can measure:

- Round 3's fodder wore a **solid 4×4 orange head block** (`round-3/lineup-
  small.png`, melee orange component n=18 at y138–142 x108–111; ranged n=14 at
  y138–141 x179–182). Round 4 replaced it with a dark helmet plus a 1 px
  orange band. The polka-dot look is gone. That is the single most visible
  step away from toy.
- Interior detail density rose: melee 0.500→0.566 edges/px, ranged
  0.608→0.649.
- Compared to the LARGE control (0.187 melee / 0.183 hero / 0.271 ranged),
  SMALL is 2–3× denser. LARGE is the block-figure failure; SMALL is not.

What still reads as prototype rather than as a dangerous world:

- No faces, no damage, no wear, no per-unit variation of any kind that I could
  measure. All 8 left-team melee have an identical 6 px orange helmet run and
  an identical 8 px belt run.
- Emission pixels (L ≥ 150) fell from 0.20% of the frame to **0.09%**, and
  peak luminance fell from **243 to 195**. Part of that is a *good* deletion —
  the round-3 hero-only near-white cyan `(207,254,242)`, L=241, is now **0 px
  in the entire round-4 render** (was 4, one per hero). Removing a badge is
  the right call. But nothing replaced it: the canon asks for a handful of
  emission pixels at ~5% and this board is at 0.09%. Nothing glows, nothing is
  hot, nothing is on fire. A board called Hazard Pay has no hazard light on it.
- Frame-level value budget is 92.8% quiet / 7.2% saturated-mid / 0.09% bright.
  Against a 70/25/5 target that is a badly under-lit board, and it is
  essentially unchanged from round 3 (92.7 / 7.1 / 0.20).

### Axis 5 — Character/environment cohesion: PASS

The ink is shared. Unit outline pixels sit at gray 13–18; the board's darkest
structural lines sit in the same band. Unit mean luminance (70–80) sits
cleanly above floor mean (48–49) without leaving the plum-black value world —
nothing floats or looks pasted.

Grain is applied to both board and sprites (board flat-patch per-channel sd
8.0/5.5/6.4; sprite torso adjacent-pixel |ΔL| mean 5.0), so the units are
inside the same atmosphere rather than sitting on top of it. This is the one
axis where I found nothing to complain about.

### Axis 6 — Grayscale legibility: BORDERLINE

The shipped grayscale is Rec709 luma (mean abs difference from
`crowd-small.png` luma = 0.52; Rec601 = 2.18), so it is a fair test.

**Equipment survives.** The rifle bar and the melee wedges are the brightest
things on a fodder sprite (gray 140–195 against a 55–60 body), and they are
separable in grayscale because the discriminator is *run length* (11–12 px vs
3–4 px), not hue. Good.

**Tier does not survive on the right team.** Marking bright stroke reaches
gray 103 against a 59 body (+44); on the left it reaches 141 against 56 (+85).
Mean luminance delta against the replaced pixels is −0.2 on the right. In
`r4-gray-right-5x.png` the two right heroes are the two units I have to hunt
for. Round 3's right-team marking was +20.0 mean / gray 125 peak.

The standing law says "important equipment must read in grayscale." Equipment
passes. Rank does not, on one of the two teams.

### Axis 7 — Motion: FAIL

16 frames, 100 ms each, 1600 ms cycle. Tracking individual units across
frames of `round-4/motion-small.gif`:

- Four cleanly isolated units (rifle-bar tracks at cx 133.5, 161.5, 220.5,
  246.5) bob by **2, 2, 1, 1 px** respectively.
- Independent tracking of orange livery components gives amplitudes
  **[1.43, 1.0, 2.74] px, mean 1.73**.
- Round 3, same method: 16 tracked components, amplitudes
  `[2.0, 2.0, 2.0, 3.71, 2.1, 2.0, 4.49, 1.8, 4.75, 2.0, 4.08, 2.0, 3.26, 2.0,
  2.0, 2.0]`, **mean 2.64, max 4.75**.

So the idle got **smaller**: 1.73 px vs 2.64 px mean amplitude, and peak
changed-pixel fraction in the crowd band fell from 14.3% to 12.0%.

On a 22 px sprite a 1–2 px bob over 1.6 s is a breathing artefact, not
motion. The legs are pinned, the rifles do not sway, there is no weight
shift and no secondary motion anywhere I could detect. Phases *are* offset
between units (cx 161.5 peaks at frames 6–9, cx 220.5 at frames 2–12,
cx 133.5 at frame 10), which is the one thing done right — the crowd does
not pulse in lockstep. But a formation of eighteen armed people standing
across from another formation of eighteen armed people should not be this
still. This is the axis I am hardest on, and it moved the wrong way.

### Axis 8 — Deliberate pixel art vs noise: BORDERLINE

The authored art is disciplined. Quantising sprite colours to 12-level bins
collapses each fodder sprite to **17 clusters** (melee and ranged both), hero
to 22. That is a real, small, intentional palette.

The render then dusts it. In the same melee sprite there are **119 distinct
raw RGB values across 159 body pixels**; an 8×5 torso patch that should be
two or three authored colours contains **34 unique colours in 40 pixels**. A
40×30 flat board patch (x300–340, y200–230) contains **331 unique colours**
with per-channel sd 8.0/5.5/6.4. Whole frame: **8677 unique colours** in
480×270.

The grain is not a dither — detrended lag-1 autocorrelation is 0.68
horizontal / 0.31 vertical, lag-2 0.28, so it is a horizontally streaked
film grain, not a pixel-locked pattern. Direction B explicitly asks for
grain, so this is canonical in intent. The problem is scale: at 1x, with a
board-grain amplitude of ±7.6 luma against sprite value steps of ~19–26
luma, the grain runs at roughly a third of a value step *at the same spatial
frequency as the drawing*. It is competing with the art rather than
texturing it. Sprites are grained more lightly than the board (adjacent |ΔL|
mean 5.0 vs 7.6; only 12% of adjacent sprite pairs differ by more than 4),
which is the right instinct — it just is not far enough.

---

## 5. The explicit questions

### 5a. Did Config SMALL recover?

**Partially — and the part that recovered is the part that mattered most.**

Recovered: archetype separation, decisively and by shape (axis 3, and the
correlation numbers in 5b). Also the toy-tell of the orange head block is
gone.

Still broken:

1. **The hero.** Unmarked: 0/4 findable. Marked: 2/4 findable at 1x. The
   marking lost 18% of its brightness on both teams and is close to
   isoluminant on the right (−0.2 mean luma change). And the hero's own
   silhouette is the emptiest object in the frame (0.313 interior edges/px;
   14 px unbroken torso run).
2. **The right team.** 0.0% warm-accent pixels vs the left team's 33.0%;
   51% of its mass in one fused blob; unit-floor contrast 22.8 vs 31.1;
   marking contrast +44 vs +85. Every legibility figure is 20–45% worse on
   the right. Half the render is not being evaluated by the same standard as
   the other half.
3. **Motion.** Regressed to a 1.73 px mean bob.
4. **Emission.** 0.09% of frame, peak L 195. Against a 5% budget the board
   has no heat in it at all.
5. **Individuality.** Zero measurable variation between same-archetype units.

### 5b. Is the archetype read now silhouettic or still positional?

**Silhouettic. The positional confound is gone, and this is the strongest
result in the round.**

Method: cluster every unit, classify by shape only (melee = symmetric pale
wedge pair with 8–12 px gap; ranged = single pale run ≥10 px; hero = marking
diff), then test whether archetype predicts position. Left teams, because
those are where I could build a complete or near-complete inventory.

| | melee n | ranged n | mean melee (x,y) | mean ranged (x,y) | Δ | Δx / clump sd | best linear separator accuracy |
|---|---|---|---|---|---|---|---|
| **R4 SMALL left (complete, 18/18)** | 8 | 8 | (114.6, 138.8) | (115.6, 140.4) | **(+0.9, +1.6)** | **0.04** | **62.5%** |
| R3 SMALL left (14/18) | 6 | 8 | (100.8, 141.2) | (118.6, 143.7) | (+17.8, +2.5) | 0.74 | 85.7% |
| R3 LARGE left (12/18) | 6 | 6 | (75.3, 142.3) | (107.2, 147.7) | (+31.8, +5.3) | 0.82 | 83.3% |
| R3 LARGE right (14/18) | 6 | 8 | (330.1, 143.8) | (300.2, 148.4) | (−29.9, +4.7) | 0.83 | 85.7% |

Read that bottom-line column. "Best linear separator accuracy" is the best
any straight line in screen space can do at splitting melee from ranged;
50% is chance for a balanced set. Round 3 sat at 83–86% — you could draw one
line and be right five times out of six. Round 4 sits at **62.5%**, which
for 8-vs-8 is two units better than a coin flip and is what you get from
random interleaving.

Mean-position separation collapsed from **17.8 px** to **0.9 px** — from
0.74 clump standard deviations to **0.04**. The formation no longer answers
the question for the viewer.

One correction to the framing in the brief. Round 3 did stage the archetypes,
but not at the *rear*: in both R3 SMALL and R3 LARGE the ranged sit toward
the **enemy** and toward the **camera**, +17.8 px and +31.8 px along screen-x
for the left teams and −29.9 px for the LARGE right team (same direction,
mirrored). Direction differs from the previous round's description; the
magnitude and the conclusion do not.

Caveat I will not hide: the round-4 left inventory is complete (18/18,
visually verified) but the round-3 inventories are 12–14 of 18, because
occluded melee are the ones my detectors lose. That bias would tend to *shrink*
a measured round-3 separation, not inflate it, so the comparison is
conservative.

### 5c. Is there a new confound? — six, and one of them is large

First, credit where the hunt came up empty: the round-3 hero badges are
substantially gone. The hero-only cyan emission `(207,254,242)` is **0 px** in
the whole round-4 render, and the 6 px cream plaque `(200,194,184)` — still
exactly four clusters — has moved **off** the heroes onto front-rank fodder
equipment (clusters at (105,163) (115,157) (264,155) (277,164); no hero centre
within 15 px of any of them). I went looking for those specifically and they
are not doing hero work any more.

What I did find, adversarially, in descending order of how much work each is
doing:

**C1. Faction-livery asymmetry. The left team has an accent colour; the right
team has none.**
Warm-accent pixels (hue <45° or >350°, sat ≥0.35) as a share of unit pixels:
left **33.0%**, right **0.0%**. Not one orange run of length ≥4 exists
anywhere in the right clump — my detector returns 58 in the left clump and 0
in the right. Cool accent on the right fell from 32.0% (R3) to **16.6%**
(R4). Per-unit-pixel value budget: left is 50/48/3, right is 74/24/2. The
right team is the only one anywhere near the 70/25/5 law, and it is the one
you cannot read. Every "does it work?" answer differs by side, and a critic
who looks mostly at the (nearer, warmer, better-lit) left clump will
over-report the render.

**C2. On the left team, orange run length is a perfect archetype badge.**
Orange runs of length ≥5 px occur exactly 8 times in the left clump, and each
one is a melee helmet band (6 px) or belt (8 px). Ranged orange never exceeds
4 px and is broken by a body pixel. So on the left team you can classify
melee vs ranged from a *colour run width* without ever resolving a
silhouette — and that is in fact how I built the left inventory. The right
team has no such cue at all. Which means the silhouette cue is only being
honestly tested on one of the two sides. It passes there (16/16 rifles found
by run length on both sides, colour-blind) — but the round would be more
convincing if the left team were not also handing out a badge.

**C3. "Pale" is a single universal equipment token.**
Melee wedges and ranged rifles are the same near-white. The archetypes differ
by *how long the pale run is* (3–4 px vs 11–12 px), not by material, shape
family, or silhouette break. It works, and it survives grayscale, which is
why axis 3 is a PASS. But it is one parameter, not two designs, and a third
archetype has nowhere to go.

**C4. The hero's identity is negative space, and the marking is covering for
it.** 0.313 interior edges/px vs 0.566/0.649 for fodder; 14 px unbroken
vertical body run vs 7 and 5. The render claims the hero reads by mass and
silhouette; measured, it reads by being the one shape with nothing drawn on
it, plus an outline. Turn the outline off and the tier disappears entirely
(0/4 in blind sweep). That is the definition of a crutch.

**C5. The marking is a torso halo sold as a silhouette border.** All four
marking components are exactly 18×22 px on a 28 px sprite; the outline stops
at the waist and never touches the legs. Defensible as a design choice (legs
are what gets occluded), but it is not what "grown from its silhouette"
describes, and it means the hero's most distinctive proportion — its height —
is the part the marking does not trace.

**C6. The hero's crown is still a shape badge.** The hero has a rounded,
bare crown; both fodder archetypes wear a helmet band (6 px orange on melee,
4 px broken on ranged). That is a silhouette-class marker outside the stated
"size and detail density" variable, and it is the same one the previous round
was told about. It is the only one of the four round-3 badges still standing.

### 5d. Which config would you ship now, and what does the other cost?

**Ship SMALL.**

LARGE is not a safe fallback. Measured on the round-3 control:

- Interior detail density **0.187** (melee) / **0.183** (hero) / **0.271**
  (ranged) edges per body pixel, against SMALL's 0.566 / 0.313 / 0.649.
  LARGE sprites are 2–3× flatter. Big empty capsules with a bright outline is
  precisely the "block-figure / toy proportions / clean playset" failure the
  canon forbids, and the 4× loupe
  (`round-4/loupe-compare-4x.png`, lower panel) shows it plainly: giant blank
  teal eggs with thick orange piping.
- Its archetype read is *worse* than round-3 SMALL's: separator accuracy
  83.3% left / 85.7% right, mean-x separation 31.8 px / −29.9 px. Fodder
  silhouette widths 20 px (melee) vs 16 px (ranged) — 4 px apart, and the
  long-pale-run detector finds only 4 weapons in the whole board.
- Its emission budget is the only one that reaches the canon (15.4% of left-
  team unit pixels at L≥140), which is a large part of why it looks
  "readable" — it is readable because it is loud, not because it is drawn.

**What taking SMALL costs.** Marking punch: LARGE's hero marking runs at
+76.4 / +45.0 mean grayscale contrast against +24.3 / +9.6 for SMALL. You
give up the instant hero find at 1x, and you give up the comfort of never
having to wonder whether a unit is occluded. Those are real, and they are
exactly the two things SMALL still has to fix.

### 5e. Single biggest remaining defect in SMALL

**The hero tier.** In one sentence: the elite unit is the only object on the
board with nothing drawn on it, and the 1 px outline that is supposed to
compensate got 18% dimmer this round and is near-isoluminant on the right
team.

Concretely — 0/4 found unmarked; 2/4 found marked at 1x; interior detail
0.313 edges/px (lowest of the three archetypes); 14 px of unbroken flat
torso; marking bright stroke 141 (left) and 103 (right) against round 3's 171
and 125; marking mean luma delta on the right team **−0.2**; marking bbox
18 px on a 28 px sprite.

The fix is not more marking. The fix is to draw something on the hero — the
fodder are more equipped than their commander, and no amount of outline will
make that read as rank.

---

## 6. Step 4 — against `round-3/cold-critique-r3.md`

Read only after everything above was written. I did not revise a score.

The previous critic graded round-3 SMALL: **FAIL, FAIL, FAIL, FAIL,
BORDERLINE, FAIL, FAIL, BORDERLINE** — six FAILs and two BORDERLINEs, and
recommended shipping LARGE with the verdict "Config SMALL is not shippable at
all."

| # | Axis | R3 SMALL (prev. critic) | R4 SMALL (me) | Move |
|---|------|------|------|------|
| 1 | Crowd legibility | FAIL | BORDERLINE | **up** |
| 2 | Tier separation | FAIL | BORDERLINE | **up** |
| 3 | Archetype separation | FAIL | PASS | **up (two steps)** |
| 4 | Gritty / dangerous | FAIL | BORDERLINE | **up** |
| 5 | Cohesion | BORDERLINE | PASS | **up** |
| 6 | Grayscale | FAIL | BORDERLINE | **up** |
| 7 | Motion | FAIL | FAIL | **flat** |
| 8 | Deliberate pixel art | BORDERLINE | BORDERLINE | **flat** |

**Net: six axes up, none down, two flat.** I did not expect that when I wrote
my scores — I graded round 4 in isolation and had, from my own cold sweep,
formed the impression that hero-finding had got *worse*, which it has. But
against the previous critic's actual baseline, round 4 is a broad and
one-directional improvement. I am not adjusting anything; I am reporting that
my "partially recovered" verdict is more pessimistic than the axis-by-axis
delta warrants, and the delta is the more useful number.

### What was fixed, verified

The previous critique's four named badges and its two headline structural
objections, checked one at a time:

| prev. finding | round-4 status | measurement |
|---|---|---|
| **Badge 3** — hero-only cyan emission `(207,254,242)`, 4 px/render, one per hero, never on fodder | **REMOVED** | `round-4/crowd-small.png`: **0 px** at tol ±6 (R3: 4 px). Frame peak L fell 243 → 195 as a direct result. |
| **Badge 2** — cream plaque `(200,194,184)`, 6 px, exactly 4 clusters, one per hero | **REASSIGNED OFF THE HEROES** | Still exactly 4 clusters of 6 px in R4, but at (105,163) (115,157) (264,155) (277,164). My measured hero centres are (133.5,125.5) (98.5,147.5) (245.5,125.5) (283.5,146.5) — none match. Sampling (105,163) shows the cream sitting on a front-rank melee's pale wedge. In R3 the same four clusters sat at (90,146) (122,128) (251,128) (286,146), i.e. on the four heroes. Cream is now an equipment highlight on fodder, not an insignia on heroes. |
| **Badge 4** — heroes hooded, fodder helmeted | **PARTIALLY PERSISTS** | Round-4 hero still has a rounded crown and no helmet band; melee and ranged both carry one. Still a shape marker outside the stated variable. |
| **Positional archetype staging** | **REMOVED** | Separator accuracy 85.7% → **62.5%**; mean-x separation 17.8 px → **0.9 px**; Δx/clump-sd 0.74 → **0.04**. |
| **"Ranged is a black stick" — 68% ink, 13 body pixels** | **LARGELY FIXED** | Measured the same way on both rounds (plate-diff silhouette, right-team lineup, ink = L<30): ranged ink share **49% → 31%**, body pixels **79 → 98** (+24%). Melee ink share **27% → 17%**, body 177 → 174. There is a drawing in there now. |
| **"No depth cue but overlap — the clump is one flat plane"** | **FIXED** | Left-clump unit luminance by depth band went from flat (84.0 / 84.7 / 83.6 / 86.1) to a **21.6-luma monotone ramp** (67.0 / 74.4 / 78.7 / 88.6). |

And of the marking follow-up's five recommendations: #2 (open the loop, kill
the bottom bar, die out at hip height) was implemented — all four round-4
markings are exactly 18 px tall on a 28 px sprite and stop at the waist, with
no bottom bar and no leg-gap thread. #5 (keep it at 2 px) held. #3 (drop the
highlight value) *appears* implemented in the crowd (bright stroke 171→141)
but is not: the authored ring is unchanged and the drop is the new depth
ramp. #1 and #4 were not implemented — see the disagreements below.

### Where I disagree with the previous critic, with the measurement

**1. The round-3 staging was not "rear-outer", it was front-toward-enemy.**
The previous critique locates round-3's ranged as "the splayed dark figures
at x 155–190 and x 300–330", i.e. trailing at the rear-outer edge. Measured,
round-3's ranged sit toward the **enemy** and toward the **camera**: left-team
ranged mean x is **+17.8 px greater** than melee mean x in R3 SMALL and
**+31.8 px greater** in R3 LARGE, and the LARGE right team mirrors it at
**−29.9 px**, which is the same direction once you flip the side. My eight
R3-SMALL left ranged sit at x-centres 84, 94.5, 103, 104, 128, 140, 141, 154
against six melee at 67.5, 79.5, 104.5, 117.5, 117.5, 118 — the ranged are
the outer *front* arc. The confound was real and its magnitude was exactly as
serious as described; the compass bearing was backwards. That matters,
because "pull the ranged out of the back rank" would have been the wrong
instruction, and it is not the instruction that was followed.

**2. "At Config SMALL the outer plum-black seat is missing" does not
reproduce.** The follow-up reports the R3 SMALL scan at x=146 as
`#372b36 ground → #d0855f → #cf855f → #170f15 ink`, with "0 of 118 pixels
outside the ring darker than L=30", and calls the missing seat "a bug, not a
taste call" and the number-one fix. I get, on the same file and the same
column: `round-3/lineup-small.png` (146,125) = `#372b36` ground, **(146,126) =
`#160f14`, L=16.8** — an ink pixel — then (146,127) = `#dea070` bright, then
(146,128) = `#170f15` ink. The seat was already there in round 3. Dilating
the whole ring by one pixel and counting: **81% of the pixels immediately
outside the R3 SMALL ring are darker than L=30, median L=19** (R3 LARGE 79%,
R4 SMALL 75%). Whatever produced the round-3 reading, the round-4 render did
not need this fix and did not receive one, and the "sticker" charge against
the SMALL marking should not have been carried on that number.

**3. The hero-only tan visor `(169,112,85)` does not reproduce at SMALL in
either round.** At tol ±6 both `round-3/crowd-small.png` and
`round-4/crowd-small.png` return exactly three clusters ≥3 px — at (149,206),
(185,214), (240,238), all in the bottom quarter of the frame, all floor
decals, byte-identical between rounds. Zero on any hero. It may hold at LARGE
(I get 7 clusters there, including four 4 px ones), but as a SMALL-register
badge it is not in these files.

**4. "Motion FAIL for synchronization" — the follow-up already retracted the
sync charge, and I confirm the retraction and the residual charge.** Phases
are genuinely offset in round 4 (cx 161.5 peaks at frames 6–9, cx 220.5 at
2–12, cx 133.5 at 10). But amplitude went the wrong way: median per-unit bob
**2.00 px → 1.43 px**, mean **2.64 → 1.73**. The follow-up called SMALL's
2.00 px on a 22 px figure "twitchy, 9.1% of height, backwards"; round 4
answered that by making it 6.5% of height. The complaint was that the smaller
register was *jitterier* than the larger one, not that it moved too much in
absolute terms, and reducing the amplitude has left the crowd with a 1–2 px
breathe and no vocabulary at all. This is the one place where a round-3
recommendation was followed and made the axis worse. I still grade it FAIL,
for a different reason than the previous critic did.

### The confound the previous round could not have caught

The side asymmetry. The right team now carries **0.0%** warm-accent unit
pixels against the left team's 33.0%, its cool accent **halved** (32.0% →
16.6%), **51%** of its visible mass sits in one fused blob, its unit-floor
contrast is 22.8 against the left's 31.1, and its hero ring lost **60% of its
bright pixels** (158 → 63). My reading of the mechanism: the round-3 critique
asked for less brightness and fewer badges, the fix was applied globally, and
the faction that had less accent to spend went under. Every legibility number
in this render differs by side, and a critic reading mostly the nearer,
warmer left clump — which is the one every comparison image puts first — will
over-report the result. That is what I would put at the top of the round-5
brief, ahead of the hero.

---

## 7. Appendix — every figure, with file and coordinates

Repo root for artifact paths:
`/home/arnav/Downloads/projects/hazard-pay/.worktrees/prototype/pixel-control-lane/apps/webapp/screenshots/pixel-control-lane/`

### Sprite geometry (from ASCII classification maps of the lineups)

| figure | value | source |
|---|---|---|
| R4 SMALL melee silhouette | y133–154 (22 px), x98–114 (17 px); body 10 px | `round-4/lineup-small.png` |
| R4 SMALL melee wedges | x98–100 (3 px) + x111–114 (4 px), rows 140–142, gap 10 px | same |
| R4 SMALL melee livery | helmet band 6 px x103–108 row 135; belt 8 px x101–108 row 144 | same |
| R4 SMALL ranged silhouette | y133–154 (22 px), body x178–184 (7 px) | same |
| R4 SMALL ranged rifle | row 141, x178–188, 11 px, 1 px tall | same |
| R4 SMALL right ranged rifle | row 143, x378–389, 12 px | same |
| R4 SMALL hero | y124–153 (30 px incl. 1 px halo), marking 18×22 px | same |
| R3 SMALL melee | y135–156 (22 px), x101–116 (16 px) | `round-3/lineup-small.png` |
| R3 SMALL ranged | y135–156 (22 px), x175–186 (12 px) | same |
| R3 SMALL orange head block (melee) | n=18, y138–142, x108–111 | same |
| R3 SMALL orange head block (ranged) | n=14, y138–141, x179–182 | same |
| R3 LARGE melee | x82–101 (20 px) | `round-3/lineup-large.png` |
| R3 LARGE ranged | x192–207 (16 px) | same |

### Detection

| figure | value | source |
|---|---|---|
| pale runs ≥10 px (rifles) | **16** (8/side): left y119 x118–128, y128 x156–167, y134 x89–100, y134 x117–128, y141 x76–87, y144 x128–139, y147 x117–128, y156 x80–91; right y120 x256–267, y128 x215–226, y133 x281–292, y134 x256–267, y142 x241–252, y142 x295–305, y150 x255–266, y155 x295–305 | `round-4/crowd-small-unmarked.png` |
| same detector | **0** | `round-3/crowd-small-unmarked.png` |
| same detector | 4 (len 6): y119 x284–289, y135 x66–71, y135 x306–311, y143 x337–342 | `round-3/crowd-large-unmarked.png` |
| hero markings (marked−unmarked, Δ>8) | 4 clean components, each 18×22 px: y111–128 x123–144; y133–150 x88–109; y111–128 x235–256; y132–149 x273–294 | `round-4/crowd-small.png` vs `-unmarked.png` |
| R3 hero markings | 9 fragments (heroes occluded), largest y115–132 x117–138 | `round-3/crowd-small.png` vs `-unmarked.png` |
| R4 left melee helmet/belt pairs (9 rows apart) | 8: (y106,x131–136), (y114,x145–150), (y121,x106–111), (y127,x144–149), (y135,x104–109), (y140,x67–72), (y142,belt y151 x105–110), (y157,x95–100) | `round-4/crowd-small-unmarked.png` |
| orange runs ≥4 px in right clump | **0** (58 in left clump) | same |
| melee wedge pixels visible per left melee | 18,18,18,18,11,16,2,42 (6/8 both sides) | same |

### Position / correlation

| figure | value |
|---|---|
| R4 SMALL left melee centres | (133.5,114.5) (147.5,122.5) (108.5,129.5) (146.5,135.5) (106.5,143.5) (69.5,148.5) (107.5,150.5) (97.5,165.5) |
| R4 SMALL left ranged centres | (123,121.5) (161.5,130.5) (94.5,136.5) (122.5,136.5) (81.5,143.5) (133.5,146.5) (122.5,149.5) (85.5,158.5) |
| R4 SMALL left hero centres | (133.5,125.5) (98.5,147.5) |
| R4 mean melee / ranged | (114.6,138.8) / (115.6,140.4); Δ (+0.9,+1.6); Δx/sd 0.04 |
| R4 best linear separator | **62.5%** |
| R3 SMALL left | Δ (+17.8,+2.5); Δx/sd 0.74; separator **85.7%** |
| R3 LARGE left | Δ (+31.8,+5.3); Δx/sd 0.82; separator **83.3%** |
| R3 LARGE right | Δ (−29.9,+4.7); Δx/sd 0.83; separator **85.7%** |
| formation mirror IoU (left vs flipped right) | R4 0.389, R3 SMALL 0.341, R3 LARGE 0.396 — not mirrored, independently jittered |

### Contrast, value, colour

| figure | value | source |
|---|---|---|
| unit/floor luma Δ | R4 L 31.1, R4 R 22.8, R3 L 37.1, R3 R 27.5 | crowd unmarked, band y100–182 |
| clump fusion (largest comp %) | R4 L 27%, **R4 R 51%**, R3 L 19%, R3 R 30%, R3L L 16%, R3L R 44% | same |
| warm accent share of unit px | R4 L **33.0%** / R4 R **0.0%**; R3 L 37.9 / R3 R 0.2; R3L L 40.5 / R3L R 0.3 | crowd marked |
| cool accent share | R4 R 16.6%, R3 R 32.0%, R3L R 30.9% | same |
| per-unit-pixel budget (quiet/accent/emission) | R4 L 50.2/48.0/3.03, R4 R 73.6/24.0/2.35 | same |
| frame budget | R4 92.8/7.2/0.09, max L 195; R3 92.7/7.1/0.20, max L 243 | `crowd-small.png` |
| grayscale conversion | Rec709 (|Δ| 0.52) not Rec601 (2.18) | `round-4/crowd-small-gray.png` |
| marking bright stroke peak gray | R4 L 141, R4 R 103, R3 L 171, R3 R 125 | marked vs unmarked gray |
| marking mean Δ vs replaced px | R4 L +20.3, **R4 R −0.2**, R3 L +41.3, R3 R +20.0 | same |
| marking mean contrast vs 5×5 surround | R4 L +23.3, **R4 R +9.9**, R3 L +48.7, R3 R +26.6 | same |

### Detail density, palette, grain

| figure | value | source |
|---|---|---|
| interior edges/body px | R4: melee 0.566, hero 0.313, ranged 0.649 | `round-4/lineup-small.png` |
| | R3: melee 0.500, hero 0.288, ranged 0.608 | `round-3/lineup-small.png` |
| | R3 LARGE: melee 0.187, hero 0.183, ranged 0.271 | `round-3/lineup-large.png` |
| longest unbroken vertical body run | R4 melee 7, hero 14, ranged 5; R3 melee 9, hero 14, ranged 6; R3L melee 11, hero 24, ranged 9 | lineups |
| quantised palette clusters / raw colours | R4 melee 17 / 119 (159 body px); hero 22 / 169; ranged 17 / 63 | `round-4/lineup-small.png` |
| torso patch uniqueness | 34 unique colours in 40 px (x103–110, y139–143) | same |
| board flat patch | 331 unique colours in 1200 px; per-channel sd 8.01/5.53/6.35 (x300–340, y200–230) | `round-4/crowd-small.png` |
| whole-frame unique colours | 8677 (R4), 8140 (R3) | crowd unmarked |
| grain autocorrelation (detrended) | lag-1 h 0.677, v 0.308; lag-2 h 0.282; residual sd 7.61 (x295–345, y205–235) | `round-4/crowd-small.png` |

### Depth shading, badges, marking seat (added after step 4)

| figure | value | source |
|---|---|---|
| left-clump unit mean L by depth band | R3: 84.0 / 84.7 / 83.6 / 86.1 (flat); R4: **67.0 / 74.4 / 78.7 / 88.6** (21.6-luma ramp), bands y100–125 / 125–140 / 140–155 / 155–182 | crowd unmarked |
| crowd/lineup mean unit L ratio | R3 0.953, R4 **0.889** | crowd vs lineup |
| hero-only cyan `(207,254,242)` | R3 SMALL 4 px, R3 LARGE 4 px, **R4 SMALL 0 px** (tol ±6) | crowd marked |
| cream `(200,194,184)` clusters | R3 SMALL 4×6 px at (90,146) (122,128) (251,128) (286,146) = the 4 heroes; R4 SMALL 4×6 px at (105,163) (115,157) (264,155) (277,164) = **not** heroes (front-rank fodder wedges) | crowd marked/unmarked (identical) |
| tan `(169,112,85)` clusters ≥3 px | R3 SMALL and R4 SMALL both: (149,206) 11 px, (185,214) 19 px, (240,238) 4 px — all floor decals, none on a hero | crowd marked |
| marking crown scan | R3 (146,125)=`#372b36` L46 → (146,126)=`#160f14` **L16.8** → (146,127)=`#dea070` L169.7 → (146,128)=`#170f15` L17.1 | `round-3/lineup-small.png` |
| | R4 (146,123)=`#312a34` L44 → (146,124)=`#181216` **L19.6** → (146,125)=`#dda171` L170.3 → (146,126)=`#191417` L21.3 | `round-4/lineup-small.png` |
| ring seating (3×3 dilation, fraction darker than L=30) | R3 SMALL lineup **81%**, R4 SMALL lineup 75%, R3 LARGE lineup 79%; crowds 82% / 70% / 78%; median outside L=19 throughout | lineups + crowds |
| bright ring px (L≥90 marking pixels) | R3 left 142 → R4 left 123; **R3 right 158 → R4 right 63** | crowd marked vs unmarked |
| ring saturation | R3 left 0.49 / right 0.44; R4 left 0.47 / right 0.42 — faction saturation gap unchanged | same |
| sprite ink share (plate-diff silhouette, right-team lineup, ink = L<30) | R4: melee **17%** (174 body px), ranged **31%** (98), hero 49% (179); R3: melee 27% (177), ranged **49%** (79), hero 50% (201); R3 LARGE: melee 17% (224), hero 30% (613) | lineups |

### Motion

| figure | value | source |
|---|---|---|
| cycle | 16 frames × 100 ms = 1600 ms | `round-4/motion-small.gif` |
| per-unit bob (isolated rifle tracks) | 2, 2, 1, 1 px at cx 133.5, 161.5, 220.5, 246.5 | same |
| per-unit bob (livery-component tracks) | [1.43, 1.0, 2.74], mean **1.73** px | same |
| R3 per-unit bob | 16 components, mean **2.64**, median 2.0, max 4.75 px | `round-3/motion-small.gif` |
| peak changed-pixel fraction, crowd band | R4 **12.04%** (frame 5), R3 **14.30%** (frame 5) | both GIFs |
| phase | offset between units (cx 161.5 peaks fr. 6–9; cx 220.5 fr. 2–12; cx 133.5 fr. 10) | `round-4/motion-small.gif` |

### Working images I generated (nearest-neighbour, no resampling of content)

`/tmp/pixel-r4/`: `r4-left-6x.png`, `r4-right-6x.png`, `r3-left-6x.png`,
`r4-annotated.png` (verified inventory overlay), `r4-gray-right-5x.png`,
`r4-gray-left-5x.png`, `mask-r4.png`, `plate-median.png`, `r4-strip.png`,
`r3-strip.png`.

---

## 8. Re-verification after the marking fix

Second provenance-cold pass, new critic. I read sections 1–7 above and
`round-3/cold-critique-r3.md` in full before touching a pixel — those are the
record I am checking against. I did not read `apps/webapp/src/`, git history,
or either `cost-report.md`. Sections 1–7 are unedited.

Everything below is re-measured on the **re-captured** `round-4/` set.
`round-3/` is unchanged, so I use it as a **calibration standard**: where my
code reproduces the previous pass's round-3 figure, its round-4 figure is
directly comparable to mine. Where it does not reproduce, I say so and report
my own consistent series instead. Files and coordinates in §8g.

### 8a. Blind sweep, recorded before any measurement

#### `round-4/crowd-small.png`, marked, true 1x

- **Heroes: 4 of 4.** Left clump: two orange arches, immediate, no hunting —
  one high-right of the clump near x≈133 y≈118, one low-left near x≈98 y≈141.
  Right clump: two pale steel arches, found on a deliberate second look rather
  than instantly — one at x≈240 y≈118, one at x≈285 y≈142. Called it
  **2 instant / 2 found-on-purpose, 0 missed, 0 guessed.**
- **Melee vs ranged inside the clump: no.** Same as the previous pass. I could
  see that some units carried a thin light horizontal streak and some did not,
  but at 1x I read it as highlight noise and could not have named an archetype
  for a named unit.
- **Ranks: 3, possibly 4** per side. (Measured later: 4.)
- Cold impressions: the left clump still reads warm and the right clump still
  reads grey — the faction asymmetry is the first thing I noticed, before any
  measurement, exactly as the previous critic reported. I did **not** this time
  read the right clump as a single smear; it read as a group of figures.

#### `round-4/crowd-small-unmarked.png`, true 1x

- **Heroes: 0 of 4.** Nothing. I made no guess I would stake anything on. My
  memory of the marked frame is contamination, not a finding.
- Archetype: no. Ranks: same 3–4.

#### `round-3/crowd-small.png`, marked, true 1x, same method

- **Heroes: 4 of 4, immediate on all four.** Two orange, two cyan.
- Melee vs ranged: no. Ranks: 3.

**Recorded misses, to hold myself to.** (1) I found the round-4 right-hand pair
more slowly than the round-3 right-hand pair, and I expected the measurement to
show the round-4 right ring dimmer. **It does not** — measured, the round-4
right ring is at round-3's exact value and has *more* contrast against its own
unit than round 3's did (§8b). My slower find is not corroborated by any
number I can produce, and I am recording it as an impression I could not
substantiate. (2) I counted 3–4 ranks and could not resolve archetype at 1x,
which is unchanged and which the numbers confirm is a genuine 1x limitation,
not a rendering defect.

### 8b. The marking dimming — reversed, and reversed to parity or better

My mask reproduces the previous pass's marking geometry **exactly**: four clean
components, each 18×22 px, at y111–128 x123–144 / y133–150 x88–109 /
y111–128 x235–256 / y132–149 x273–294, 466 diff pixels total. Identical to its
appendix. So we are measuring the same object.

**Bright stroke.** My code reproduces its round-3 figures to within 0.6 gray
(it: 170/171 left, 123/125 right; me: 170.3/171.7 and 123.8/125.9), so its
round-4 column is directly comparable to mine.

| | 75th pct / peak gray | prev. pass, first r4 build | round 3 |
|---|---|---|---|
| **R4 SMALL left** | **170.1 / 172.1** | 138 / 141 | 170.3 / 171.7 |
| **R4 SMALL right** | **123.8 / 125.2** | 101 / 103 | 123.8 / 125.9 |

The 18% loss on both teams is **gone**. Per hero, the peak is at the authored
ring value and does not vary by rank:

| hero (marking bbox) | ring peak L | round-3 counterpart |
|---|---|---|
| left back, y111–128 x123–144 | **171.6** | 171.7 (y115–130 x117–134) |
| left front, y133–150 x88–109 | **172.1** | 171.6 (y134–153 x85–106) |
| right back, y111–128 x235–256 | **125.7** | 125.7 (y115–132 x238–256) |
| right front, y132–149 x273–294 | **124.9** | 125.4 (y133–150 x270–291) |

**Mean luma delta against the pixel each marking pixel replaced** — the figure
that read **−0.2** on the right in the first build:

| | this build | prev. pass | round 3 (my code / its code) |
|---|---|---|---|
| left | **+35.1** | +20.3 | +37.6 / +41.3 |
| right | **+16.3** | **−0.2** | +23.7 / +20.0 |

Per hero on the right: **+12.2** (back) and **+17.8** (front). The right-team
marking is no longer a hue rotation. Confirmed on the **shipped** grayscale
pair, which is the fairer test: `round-4/crowd-small-gray.png` vs
`crowd-small-unmarked-gray.png` gives left mean Δ **+39.5**, peak 172; right
mean Δ **+14.7**, peak 125, with 124 and 127 pixels ≥ gray 90 — near-symmetric.

**Mean contrast against a 5×5 surround** (its round-3 calibration +48.7/+26.6
vs my +53.8/+32.9, so my scale runs ~5 high):

| | this build | prev. pass | round 3 (mine) |
|---|---|---|---|
| left | **+47.7** | +23.3 | +53.8 |
| right | **+26.8** | +9.9 | +32.9 |

Both sides go from roughly half (left) and one-third (right) of round 3 to
within ~12% and ~18% of it.

**Ring pixel count — the one figure that does not reproduce.** The previous
appendix gives round-3 left 142 / right 158, i.e. the right team's ring *larger*
than the left's, which contradicts every other number in both critiques. I
cannot reproduce it under any of three diff-mask definitions (max-channel > 8,
ΔL > 8, |ΔL| > 8); all three give round-3 left 165 / right 132–135. So I report
my own consistent series: bright ring pixels (L ≥ 90) are **left 140 / right
111** this build against round-3's **165 / 135** — down 15% and 18%, not the
60% collapse reported on the right.

And that residual 15–18% is **not dimming, it is a deliberate shape change**.
The round-3 ring is a closed capsule with a solid bar under the feet; the
round-4 ring is an open loop that runs over the crown and down the flanks and
**dies at the waist** — visible directly in `/tmp/pixel-r4/r5-left-stack.png`
and `r5-right-stack.png` (round 3 top, round 4 bottom, 5x). That is
recommendation #2 of the round-3 marking follow-up, implemented. Fewer bright
pixels is the intended cost of returning the contact shadow, and the round-4
markings are four unbroken loops where round 3's were fragmented (15 components
≥ 8 px, because its heroes are occluded).

**How the fix actually works, and it is not what the label says.** The ring was
not brightened — it is at round-3's value to within 0.5 gray. What changed is
that **the ring was exempted from the depth shading** while everything around
it still obeys it. Ring peak versus the hero's own body luminance:

| | ring peak | own body mean L | contrast | round-3 counterpart |
|---|---|---|---|---|
| left back | 171.6 | **72.4** | **+99.2** | +80.4 |
| left front | 172.1 | 80.0 | +92.1 | +80.3 |
| right back | 125.7 | **69.9** | **+55.8** | +39.7 |
| right front | 124.9 | 76.7 | +48.2 | +38.1 |

All four heroes now have **more** ring-to-body contrast than their round-3
counterparts — the left pair by 12–19 luma, the right pair by 10–16. The board
did not raise the ring; it lowered the floor. That is why hero finding came
back, and it is also a new defect (§8e, NC1).

**Ink seating held.** Crown scan, `round-4/lineup-small.png` x=146:
(146,123) `#312a34` L44.2 → (146,124) `#181216` **L19.6** → (146,125) `#dda171`
**L170.3** → (146,126) `#191417` L21.3. Byte-identical to the previous pass's
reading, and the same 1 px ink / 1 px bright / 1 px ink structure as round 3
(x=146: L16.8 → L169.7 → L17.1). In the crowd, **81%** of the pixels
immediately outside the dilated ring are darker than L=30, median L=19 (round 3
88%, median 19). The ring is ink-bound. No regression.

### 8c. Unit-vs-floor separation, fusion, depth ramp

**Separation** (band y100–182, unit = non-plum hue, floor = plum hue; my code
reads ~2–5 luma high against the previous pass's, so read the columns
relatively):

| | unit L | floor L | Δ | prev. pass Δ | my round-3 Δ |
|---|---|---|---|---|---|
| R4 left | 82.5 | 47.5 | **35.0** | 31.1 | 39.5 |
| R4 right | 75.3 | 46.8 | **28.5** | 22.8 | 32.3 |

The units are still darker than round 3's — the gap is **−4.5 left / −3.8
right**, against the first build's **−6.0 / −4.7**. Partially recovered, not
recovered. This is the one axis-1 number still pointing the wrong way.

**Fusion — fixed, and the previous pass's left-clump numbers were contaminated.**
My 8-connected implementation reproduces round-3 to within one pixel on the
right clump (largest component 442 px / 31% against its 443 px / 30%), so the
method is its method. But the y100–182 band includes the **orange floor decal at
y172–189 x76–135**, which the non-plum mask swallows and which merges with the
left clump's front rank. Restricting to y100–170 removes it:

| | unit px | comps | largest | largest % | prev. pass | round 3 |
|---|---|---|---|---|---|---|
| R4 left | 1840 | 28 | 264 | **14%** | 27% (decal-contaminated) | 17% |
| R4 right | 1576 | 21 | 419 | **27%** | **51%** | 31% |

**The 51% single-blob smear on the right team is gone — 27%, below round-3's
31%.** The largest right-clump component is now 419 px at y136–168 x259–291,
i.e. about two overlapping units, not half a formation. Left is 264 px at
y147–170 x90–116, one unit plus a neighbour, and better than round 3.

**Depth ramp — survived, on both sides, and now correctly signed.** Mean unit
luminance by screen-y band (y100–125 / 125–140 / 140–155 / 155–182):

| | back → front | ramp |
|---|---|---|
| R3 left | 89.4 / 86.2 / 84.4 / 86.2 | **−3.2** (flat) |
| R3 right | 86.0 / 79.4 / 77.7 / 74.5 | **−11.5** (inverted) |
| **R4 left** | **73.0 / 78.1 / 81.8 / 88.9** | **+15.9** |
| **R4 right** | **67.9 / 73.6 / 77.1 / 83.8** | **+15.9** |

The previous pass measured the first build's left ramp at +21.6 (67.0 → 88.6).
The front band is essentially untouched (88.6 → 88.9) and the **back band was
lifted 67.0 → 73.0** — which is precisely the mechanism that returned the
marking's punch, since both heroes on each side sit in the back/middle bands.
The cue survived: monotone across all four bands, on both teams, +15.9 each.
Round 3 had no depth cue on the left and a **backwards** one on the right.

### 8d. Motion — the reported regression does not survive a larger sample; the axis still fails

16 frames × 100 ms = 1600 ms, unchanged. Tracking warm-livery components
frame-to-frame by nearest centroid (≤4 px gate), keeping only tracks present in
all 16 frames:

| | tracks | mean | median | p90 | max |
|---|---|---|---|---|---|
| **R4 SMALL** | **45** | **1.70** | **2.00** | 2.05 | **2.74** |
| R3 SMALL | 25 | 1.98 | 2.00 | 3.04 | 5.46 |
| R4, prev. pass | 3 | 1.73 | 1.43 | — | 2.74 |
| R3, prev. pass | 16 | 2.64 | 2.00 | — | 4.75 |

The previous pass's headline — 1.73 vs 2.64, "the wrong direction" — rests on a
3-component round-4 sample against a 16-component round-3 sample. At 45 vs 25
tracks the **median is identical at 2.00 px** and the mean gap is 1.70 vs 1.98,
a 14% shortfall, not a 34% one. The isolated rifle-bar tracks it named have also
moved up: cx 133.5 / 161.5 / 220.5 / 246.5 now bob **2, 2, 2, 2 px** against its
**2, 2, 1, 1**. Peak changed-pixel fraction in the crowd band is 6.95% (frame 6)
against round 3's 7.91% (frame 5).

So motion is at round-3 parity, and round-3 motion was already a FAIL. **The
axis still fails, for a sharper reason than amplitude:** of 45 tracked
components, **28 sit at exactly 2.00 px** and the entire distribution is clamped
between 0 and 2.74 px. Round 3 at least had a tail (3.26, 4.49, 5.46). Round 4
has one amplitude, applied 28 times. On a 22 px sprite that is a 9% breathe with
no weight shift, no weapon sway, no secondary motion, and now no amplitude
variety either. Phase offsets remain genuine and remain the one thing right.

### 8e. Nothing that passed has regressed — and the new confounds

**Archetype separation: verified intact, byte-for-byte.** The ≥10 px pale-run
detector (S ≤ 0.10, L ≥ 80) finds **exactly 16 runs, 8 per clump, zero false
positives**, at a stable plateau across Lmin 55–90 and Smax 0.10–0.12; the same
detector finds **0** in `round-3/crowd-small-unmarked.png`. Fifteen of the
sixteen coordinates match the previous appendix exactly; one unit sits one row
higher (its y134 x89–100 → my y133 x89–100). All runs 11–12 px, all exactly
1 row thick. Lineup cue rows are unchanged: melee wedges at x98–100 (3 px) and
x111–114 (4 px) on rows 140–142, helmet band 6 px at x103–108 row 135, belt at
row 144; ranged rifle row 141 x178–188, 11 px. Position test rebuilt from
scratch on the left team: melee mean **(115.8, 138.2)**, ranged **(115.6,
140.2)**, Δ **(−0.2, +2.0)**, Δx / clump-sd **0.01**, best linear separator
**62.5%** — reproducing its (+0.9, +1.6) / 0.04 / 62.5%. **PASS holds.**

**Marking ink seating: verified intact** (§8b). **Badges: verified still
removed.** Hero cyan `(207,254,242)` is **0 px** in the whole render (round 3:
4 px). Cream `(200,194,184)` is still exactly four 6 px clusters and still
**not** on heroes — (263,154) (115,156) (105,161) (276,163), all ≥ 20 px from
the nearest hero centre, against round-3's (121,127) (251,127) (286,145)
(89,146) which *are* the four heroes. Tan `(169,112,85)` still returns 0
clusters ≥ 3 px at SMALL in either round. **Grain and palette unchanged**: flat
board patch x295–345 y205–235 gives 318 unique colours, per-channel sd
7.64/5.02/5.54, against round-3's 327 and 7.58/5.00/5.53; whole-frame unique
colours 8715 (R3 8175). **Grayscale is still Rec709** (|Δ| 0.52 vs Rec601 2.18).
**Interior detail density unchanged**: melee 0.604, hero **0.274**, ranged 0.700
edges/body px; longest unbroken flat vertical run melee 7, hero **14**, ranged 5
— identical to the previous pass's 7 / 14 / 5.

Adversarial hunt, this build:

**NC1 (new, and it is the fix's own bill). The hero marking is now the only
object on the board exempt from the scene's depth lighting.** The rifle bars —
also bright authored equipment — step cleanly with depth: mean L **106** at
y119–128, **120–122** at y133–150, **139–141** at y155–156, Pearson
r(y, mean L) = **0.871** over all 16. The hero rings do not move at all:
y118.9 → 171.6 and y140.4 → **172.1**; y119.1 → 125.7 and y140.0 → **124.9**.
Correlation with depth: zero, and on the right team the *farther* ring is
0.8 luma brighter than the nearer one. Consequence: the back-rank hero now
out-contrasts the front-rank hero (+99.2 vs +92.1 left, +55.8 vs +48.2 right).
The loudest object in the frame reads as pasted over the world rather than lit
by it, and the depth cue the round bought is inverted on precisely the four
units that matter most. In round 3 the ring was flat *and so was the body*, so
this did not exist; it is a product of this fix.

**NC2. The faction-livery asymmetry has not moved at all.** Warm-accent share
of unit pixels: left **37.1%**, right **0.0%** (previous pass: 33.0 / 0.0).
Orange runs ≥ 4 px: **68** in the left clump, **0** in the right. Cool accent on
the right recovered only to **20.0%** from round-3's **33.8%** — still down 41%.
This was the previous pass's largest confound and its top round-5 item, and the
re-render did not touch it. Every legibility figure in this render still differs
by side.

**NC3. The hero is still the emptiest object on the board.** 0.274 edges/px
against melee 0.604 and ranged 0.700; 14 px of unbroken flat torso against 7 and
5; marking still exactly **18 px tall on a 28 px sprite**, tracing the torso and
stopping at the waist. Unmarked: **0 of 4** in my blind sweep. The tier read is
100% ring, and the ring now works by an exemption (NC1). Unchanged from the
previous pass, and unaddressed.

**NC4. Zero individuality, and it is now measurable at three levels.** All 8
left-team melee helmet runs are exactly **6 px**; all belts exactly **8 px**;
all 16 rifles are exactly **1 px tall** and 11–12 px long (13 at 12 px, 3 at
11 px). The only variation between same-archetype units anywhere in the frame is
the depth ramp changing their luminance. These are stamps, not drawings.

**NC5. Emission is still absent.** Pixels at L ≥ 150: **0.18%** of frame (first
build 0.09%, round 3 0.20%); peak L **196** (round 3 243, from the deleted hero
cyan). Total L ≥ 140 is 316 px = 0.24%, of which the four rings contribute
**39%** — better than round 3's 55% monopoly, but against a ~5% canon budget the
board still has no heat anywhere on it.

**NC6. No new hero-only colour.** Quantising to 8-step bins, exactly 4 bins have
≥ 4 hero pixels and 0 pixels on any other unit — and all four are dark
ink/shadow bins (≈`#100810`, `#101010`, `#181018`, `#180810`), not badges. The
hunt came up clean.

**Formation still not mirrored**: best left-vs-flipped-right IoU over ±12 px is
0.361 (round 3 0.330). Independently jittered, as before.

### 8f. Verdict

**Restated eight-axis table.** Round-3 grades are the round-3 critic's; the
middle column is the previous pass on the first round-4 build; the last is mine
on the re-captured build.

| # | Axis | R3 SMALL | R4 SMALL (prev. pass) | **R4 SMALL (this pass)** | move |
|---|------|---|---|---|---|
| 1 | Crowd legibility | FAIL | BORDERLINE | **PASS** | **up** |
| 2 | Tier separation | FAIL | BORDERLINE (regressed) | **BORDERLINE** | flat, regression undone |
| 3 | Archetype separation | FAIL | PASS | **PASS** | flat |
| 4 | Gritty / dangerous / lived-in | FAIL | BORDERLINE | **BORDERLINE** | flat |
| 5 | Character / environment cohesion | BORDERLINE | PASS | **BORDERLINE** | **down** |
| 6 | Grayscale legibility | FAIL | BORDERLINE | **PASS** | **up** |
| 7 | Motion | FAIL | FAIL | **FAIL** | flat |
| 8 | Deliberate pixel art vs noise | BORDERLINE | BORDERLINE | **BORDERLINE** | flat |

The three grades that moved, and the measurement that moved each:

- **Axis 1 up to PASS.** The previous pass stated its reason for withholding
  PASS explicitly: "the right side reads as one animal", 51% of clump mass in
  one component. Measured clean of the floor decal, that is **27%**, below
  round-3's 31%; the left is **14%**, below round-3's 17%. All four of the
  round-3 critic's stated reasons for its FAIL are now measurably addressed
  (fusion, helmet speckle, facing recoverable only from outliers, no depth cue).
  This is the weakest of the three passes: unit-floor separation is still 4.5 /
  3.8 luma short of round 3.
- **Axis 6 up to PASS.** Its stated reason for BORDERLINE was "tier does not
  survive on the right team", mean luma delta −0.2. On the shipped grayscale the
  right team now reads **+14.7** mean delta, peak 125, and **+48.2 to +55.8**
  against its own hero bodies — better than round-3's +38.1/+39.7. Equipment
  contrast in the shipped gray is **+54.2 left / +58.1 right**, near-symmetric,
  and the discriminator is run length, not hue. Both halves of the standing law
  now hold on both teams.
- **Axis 5 down to BORDERLINE.** The previous pass called it "the one axis where
  I found nothing to complain about." NC1 is a complaint on exactly this axis and
  it is arithmetic: equipment tracks depth at r = 0.871; the four hero rings
  track it at zero, holding 171.6 / 172.1 / 125.7 / 124.9 regardless of rank
  while their own bodies run 72.4 → 80.0 and 69.9 → 76.7. An object that does
  not obey the world's light is not cohesive with it, and this one is the
  brightest thing in the frame.

Axis 2 does not move. The regression is undone — 4/4 marked, ring at authored
value, right team no longer isoluminant — but PASS is unavailable while the
unmarked sweep is 0/4 and the hero remains the least-drawn object in the render
(0.274 edges/px, 14 px flat torso, marking covering 18 px of a 28 px sprite).
Axes 3, 4, 7, 8 were re-measured and nothing moved a grade.

**Is hero finding restored?** **Restored to round-3 parity on the blind sweep
(4 of 4 in both), and measurably better than round 3 on contrast.** Every one of
the four rings is at its authored value to within 0.5 gray of round 3, and all
four have *more* contrast against their own unit than their round-3 counterparts
(+92 to +99 vs +80 on the left, +48 to +56 vs +38 to +40 on the right). It is
worse than round 3 on exactly one number — bright ring pixels per side, 140/111
against 165/135 — and that is the intended cost of opening the loop at the
waist, not dimming. The previous pass's 2-of-4 is fixed.

**Does my overall verdict on Config SMALL change? Yes.** The previous pass said
"partially recovered" and named three defects: the marking dimming, the right
clump's 51% fused smear, and a motion regression. Re-measured on the new build:
the dimming is **reversed to parity or better**, the smear is **gone (27%, below
round 3)**, and the motion "regression" **does not survive a larger sample**
(median 2.00 px, identical to round 3). Nothing that passed regressed. **Config
SMALL is shippable** — a stronger verdict than the previous pass's. **Ship
SMALL.** LARGE remains the untouched round-3 control and remains not a fallback:
2–3× flatter per pixel (0.187–0.271 edges/px), and its archetype read is more
positional than round-3 SMALL's (separator 83–86%, mean-x separation 29.9–31.8
px). Nothing in this round changes that.

**What is still broken, ranked:**

1. **The hero itself.** 0/4 unmarked. 0.274 interior edges/px — the lowest of
   the three archetypes; 14 px unbroken flat torso; marking traces 18 px of a
   28 px sprite. The fodder are better equipped than their commander. The ring
   is now working well; it is working *instead of* a drawing.
2. **The faction-livery asymmetry (NC2).** Left 37.1% warm-accent unit pixels
   vs right 0.0%; 68 orange runs ≥ 4 px vs 0; right cool accent 20.0% against
   round-3's 33.8%. Completely unmoved. The previous pass put this at the top of
   the round-5 brief and it was not touched.
3. **The depth exemption (NC1).** The fix bought hero finding by decoupling the
   brightest object in the frame from the scene's light, and inverted the depth
   cue on the four units that matter most. Correct fix: shade the ring with the
   rank like everything else, and buy back the lost punch by drawing the hero
   (item 1) rather than by exempting its outline.
4. **Motion.** Median 2.00 px, 28 of 45 tracked components at exactly 2.00,
   nothing above 2.74. One amplitude, one clock, no secondary motion.
5. **Emission.** 0.18% of frame at L ≥ 150, peak 196, against ~5% canon.
6. **Individuality.** 8 identical 6 px helmets, 5 identical 8 px belts, 16
   identical 1 px × 11–12 px rifle stamps.
7. **Unit-floor contrast.** Still 4.5 (left) / 3.8 (right) luma short of round 3.

### 8g. Appendix — every new figure, with file and coordinates

Artifact root as in §7.

#### Marking

| figure | value | source |
|---|---|---|
| marking mask | 466 px, 4 components each 18×22: y111–128 x123–144, y133–150 x88–109, y111–128 x235–256, y132–149 x273–294 | `round-4/crowd-small.png` vs `-unmarked.png`, max-channel diff > 8 |
| R3 marking mask | 531 px, 15 components ≥ 8 px, largest n=98 y134–153 x85–106 | `round-3/` same pair |
| bright stroke p75 / peak | R4 L **170.1 / 172.1**, R4 R **123.8 / 125.2**; R3 L 170.3 / 171.7, R3 R 123.8 / 125.9 | same |
| per-hero ring peak | R4 171.6 / 172.1 / 125.7 / 124.9; R3 171.7 / 171.6 / 125.7 / 125.4 | same |
| per-hero bright px (L≥90) | R4 64 / 58 / 64 / 63; R3 35 / 54 / 37 / 48 | same |
| bright ring px per side (L≥90) | R4 L **140** / R **111**; R3 L 165 / R 135 (prev. pass's 142/158 does not reproduce under 3 mask definitions) | same |
| mean Δ vs replaced px | R4 L **+35.1** / R **+16.3** (per hero right: +12.2, +17.8); R3 L +37.6 / R +23.7 | same |
| mean contrast vs 5×5 surround | R4 L **+47.7** / R **+26.8**; R3 L +53.8 / R +32.9 | same |
| shipped-grayscale marking | left n=233 peak 172 p75 170 meanΔ **+39.5** 124 px ≥90; right n=233 peak 125 p75 123 meanΔ **+14.7** 127 px ≥90 | `round-4/crowd-small-gray.png` vs `crowd-small-unmarked-gray.png` |
| ring peak vs own body L | L back 171.6/72.4 (+99.2), L front 172.1/80.0 (+92.1), R back 125.7/69.9 (+55.8), R front 124.9/76.7 (+48.2); R3 +80.4 / +80.3 / +39.7 / +38.1 | crowd pair |
| crown scan | (146,123) `#312a34` L44.2 → (146,124) `#181216` L19.6 → (146,125) `#dda171` L170.3 → (146,126) `#191417` L21.3 | `round-4/lineup-small.png` |
| R3 crown scan | (146,126) `#160f14` L16.8 → (146,127) `#dea070` L169.7 → (146,128) `#170f15` L17.1 | `round-3/lineup-small.png` |
| ring seating (3×3 dilation, frac < L30) | R4 crowd **81%** median 19; R3 crowd 88% median 19 | crowd pairs |

#### Separation, fusion, depth

| figure | value | source |
|---|---|---|
| unit / floor luma Δ, y100–182 | R4 L 82.5/47.5 = **35.0**; R4 R 75.3/46.8 = **28.5**; R3 L 85.9/46.4 = 39.5; R3 R 78.4/46.1 = 32.3 | crowd unmarked, x60–186 / x200–336 |
| fusion, band y100–170 (decal-free) | R4 L 264/1840 = **14%** (bbox y147–170 x90–116); R4 R 419/1576 = **27%** (bbox y136–168 x259–291); R3 L 279/1616 = 17%; R3 R 442/1440 = 31% | same, 2×2 opening + 8-connected |
| fusion, band y100–182 (decal-contaminated) | R4 L 788 = 31% bbox y147–**182** x75–136; R3 L 542 = 23% bbox y167–182 x75–136 | shows the orange floor decal at y172–189 x76–135 merging into the left clump |
| depth ramp, left | R4 **73.0 / 78.1 / 81.8 / 88.9** = **+15.9**; R3 89.4 / 86.2 / 84.4 / 86.2 = −3.2 | crowd unmarked, bands y100–125/125–140/140–155/155–182 |
| depth ramp, right | R4 **67.9 / 73.6 / 77.1 / 83.8** = **+15.9**; R3 86.0 / 79.4 / 77.7 / 74.5 = **−11.5** | same |
| crowd / lineup mean unit L | R4 0.825, R3 0.859 | crowd vs lineup |

#### Motion

| figure | value | source |
|---|---|---|
| cycle | 16 frames × 100 ms = 1600 ms | `round-4/motion-small.gif` |
| tracked bob, warm-livery components | R4 **45 tracks**, mean **1.70**, median **2.00**, p90 2.05, max **2.74**; 28 of 45 at exactly 2.00 | same |
| | R3 25 tracks, mean 1.98, median 2.00, p90 3.04, max 5.46 | `round-3/motion-small.gif` |
| isolated rifle-bar bob | cx 133.5 / 161.5 / 220.5 / 246.5 → **2 / 2 / 2 / 2 px** (prev. pass: 2/2/1/1); also cx 81.5, 85.5 → 2, 2 | `round-4/motion-small.gif` |
| peak changed-px fraction, crowd band y95–190 x50–350, thr 30 | R4 **6.95%** (frame 6); R3 7.91% (frame 5) | both GIFs |

#### Detection, badges, confounds

| figure | value | source |
|---|---|---|
| pale runs ≥ 10 px | **16**, 8 per clump, 0 false positives; stable across Lmin 55–90 × Smax 0.10–0.12; lengths 12×13, 11×3, all 1 row thick | `round-4/crowd-small-unmarked.png` |
| coordinates | left y119 x118–128, y128 x156–167, **y133 x89–100**, y134 x117–128, y141 x76–87, y144 x128–139, y147 x117–128, y156 x80–91; right y121 x256–267, y128 x215–226, y133 x281–292, y134 x256–267, y141 x295–305, y142 x241–252, y150 x255–266, y155 x295–305 | same (15/16 match §7; one row-shifted) |
| same detector | **0** | `round-3/crowd-small-unmarked.png` |
| rifle mean L vs depth | 106 (y119–128) → 120–122 (y133–150) → 139–141 (y155–156); **Pearson r = 0.871** | `round-4/crowd-small-unmarked.png` |
| hero ring peak vs depth | y118.9→171.6, y140.4→172.1, y119.1→125.7, y140.0→124.9; **r ≈ 0** | crowd pair |
| left-team inventory | melee 8, ranged 8; mean melee (115.8, 138.2), mean ranged (115.6, 140.2); Δ **(−0.2, +2.0)**; clump x sd 25.5; Δx/sd **0.01**; best linear separator **62.5%** | `round-4/crowd-small-unmarked.png` |
| warm accent share of unit px | R4 L **37.1%** / R **0.0%**; R3 L 42.3% / R 0.2% | `crowd-small.png`, band y100–182 |
| cool accent share | R4 R **20.0%**; R3 R 33.8% | same |
| orange runs ≥ 4 px in clump | R4 L **68** / R **0**; R3 L 87 / R 0 | same |
| left-clump livery run lengths ≥ 5 px (y100–171) | 6 px ×8 (helmets), 8 px ×5 (belts), 5 px ×9, 7 px ×1 | `round-4/crowd-small-unmarked.png` |
| hero cyan `(207,254,242)` | R4 **0 px**; R3 4 px | `crowd-small.png`, tol ±6 |
| cream `(200,194,184)` | R4 4×6 px at (263,154) (115,156) (105,161) (276,163) — all ≥ 20 px from a hero centre; R3 4×6 px at (121,127) (251,127) (286,145) (89,146) = the 4 heroes | same |
| tan `(169,112,85)` | 0 clusters ≥ 3 px in both rounds at SMALL | same |
| hero-exclusive quantised bins (8-step) | 4, all dark ink/shadow: ≈`#100810` (38 px), `#101010` (38), `#181018` (22), `#180810` (6) | `round-4/crowd-small-unmarked.png` |
| frame value budget | R4 94.0 / 5.8 / **0.18%** (L≥150), peak L **196**; R3 94.1 / 5.7 / 0.20%, peak 243 | `crowd-small.png` |
| emission and ring share | R4 unmarked 200 px (0.15%) → marked 316 px (0.24%), ring = **39%** of bright px; R3 118 → 256, ring = 55% | crowd pairs, L ≥ 140 |
| per-unit-px budget (quiet/accent/emission) | R4 L 53.1 / 43.9 / 8.65; R4 R **75.4 / 20.8 / 3.76**; R3 L 49.1/49.4/8.32; R3 R 62.8/35.1/2.13 | `crowd-small.png` |
| grayscale equipment contrast (shipped gray) | left equipment 127.1 vs body 72.8 = **+54.2**; right 126.3 vs 68.2 = **+58.1** | `round-4/crowd-small-unmarked-gray.png` |
| grayscale conversion | Rec709 (|Δ| 0.52) not Rec601 (2.18); round-3 identical (0.53 / 2.20) | shipped gray PNGs |
| interior edges / body px | melee **0.604**, hero **0.274**, ranged **0.700** | `round-4/lineup-small.png` |
| longest unbroken flat vertical run | melee 7, hero **14**, ranged 5 | same |
| lineup cue rows (unchanged) | melee wedges x98–100 + x111–114 rows 140–142; helmet 6 px x103–108 row 135; belt row 144; ranged rifle row 141 x178–188 (11 px) | same |
| board flat patch | R4 318 unique colours, sd 7.64/5.02/5.54; R3 327, sd 7.58/5.00/5.53 (x295–345, y205–235) | `crowd-small.png` |
| whole-frame unique colours | R4 8715, R3 8175 | same |
| formation mirror IoU | R4 0.361, R3 0.330 (best over ±12 px shift) | crowd unmarked |

#### Working images I generated (nearest-neighbour, no content resampling)

`/tmp/pixel-r4/`: `r5-left-stack.png` (round 3 over round 4, left clump,
crop x55–195 y95–185 at 5×), `r5-right-stack.png` (same for the right clump,
crop x200–340 y100–185 at 5×), `r5-r3-left-5x.png`, `r5-r4-left-5x.png`,
`r5-r3-right-5x.png`, `r5-r4-right-5x.png`. Measurement scripts: `lib.py`,
`sep.py`, `motion.py`, `arch.py`, `marking2.py`, `value.py`, `badges.py`,
`hunt.py`, `final.py`.

#### Previous-pass figures that did not reproduce

| figure | §7 value | mine | note |
|---|---|---|---|
| bright ring px, round 3 | left 142 / right 158 | left 165 / right 135 | §7's has the right ring *larger* than the left, contradicting every other figure in both critiques; no mask definition I tried reproduces it |
| left-clump fusion | R4 27%, R3 19% | 14% / 17% (decal-free) | §7's band y100–182 admits the orange floor decal at y172–189 x76–135; I reproduce §7's values when I include it |
| R3 left depth bands | 84.0 / 84.7 / 83.6 / 86.1 | 89.4 / 86.2 / 84.4 / 86.2 | both flat; front band agrees (86.1 / 86.2), back band does not |
| R3 marking mean Δ | L +41.3 / R +20.0 | L +37.6 / R +23.7 | small definitional offset; direction and magnitude agree |
| R3 per-unit bob | 16 tracks, mean 2.64 | 25 tracks, mean 1.98, median 2.00 | §7's median (2.00) agrees with mine; its mean is drawn from a smaller sample |
