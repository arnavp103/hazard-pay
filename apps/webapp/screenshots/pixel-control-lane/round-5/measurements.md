# Round 5 — measurements

Config SMALL, the ratified config. Config LARGE is the frozen round-3 control
and was **not** re-captured: it is verified byte-identical across 24 render
configurations (`large` × lineup × marked × six clocks), so its round-3 files
stand.

Two measurement surfaces are used, and they are kept separate on purpose:

- **harness-exact** — the scene rendered headlessly with a per-pixel unit and
  role buffer, so "which unit owns this pixel" and "which palette role is it"
  are facts, not inferences. No film grain (the grain is a CSS overlay on the
  page, not part of the art), so it is the right surface for palette questions.
- **capture** — the committed browser PNGs, measured the way the cold passes
  measure them: a unit mask built by differencing against the board plate,
  inside the crowd band **y100–170**. y171+ is excluded because it admits the
  orange floor decal at y172–189 x76–135, which round 4's first cold pass
  swallowed into the left team's warm-pixel count.

Value bands, used identically on both rounds:

| band | rule |
|---|---|
| emission | L ≥ 150 |
| accent | S ≥ 0.35 and 25 ≤ L < 150 |
| quiet | everything else |

The L ≥ 25 floor exists for one reason: the plum-black world anchor `#120b10`
is nominally 0.39-saturated at luma 12.8, so without it every ink pixel in the
render counts as "accent" and the budget reads 44 % on both sides.

---

## 1. Value budget, per unit pixel

**Harness-exact**, marked, clock 0:

| | quiet | accent | emission | identity (accent+emis) | livery-role share |
|---|---|---|---|---|---|
| R4 rust | 80.4 | 13.6 | 6.0 | 19.6 | 13.4 |
| R4 slate | 83.0 | 15.7 | 1.4 | 17.1 | 11.1 |
| **R5 rust** | **78.1** | **15.3** | **6.6** | **21.9** | **15.4** |
| **R5 slate** | **79.5** | **18.8** | **1.8** | **20.6** | **14.2** |

**Capture**, marked, band y100–170:

| | unit px | quiet | accent | emission |
|---|---|---|---|---|
| R4 rust | 2925 | 76.3 | 17.3 | 6.4 |
| R4 slate | 2850 | 85.3 | 13.2 | 1.5 |
| **R5 rust** | 2841 | **73.4** | **19.5** | **7.1** |
| **R5 slate** | 2776 | **77.4** | **20.7** | **1.9** |

Frame level: R4 87.9 / 11.9 / 0.18 → R5 87.7 / 12.1 / 0.20, peak L 196 in both.

**Reading.** Moving the livery onto the gear did **not** break the budget. Per
unit pixel the identity band went 19.6 → 21.9 (rust) and 17.1 → 20.6 (slate),
which moves *toward* the 25 % target from below, not past it. Authored livery
cells rose 36 → 38 on the breaker and 18 → 21 on the stinger — the belt's nine
cells were spent on the helmet rather than added to it.

**Honest note on the emission asymmetry.** Rust's bright band is 6.6 % against
slate's 1.8 %, and that gap is not a defect to fix — it is the direct
consequence of the faction canon. If one faction is the light one and the other
the dark one at every ramp step, the light one's highlight `i` lands above
L 150 and the dark one's does not. Per-band symmetry and the value split cannot
both hold; the value split wins.

---

## 2. Faction symmetry

**Own-hue accent share** — each side measured with its own hue window (warm
< 45° or > 350° for rust, cool 180–260° for slate), S ≥ 0.35, L ≥ 25:

| | rust | slate | asymmetry |
|---|---|---|---|
| R4 harness-exact | 17.4 | 15.2 | 2.25 pts |
| **R5 harness-exact** | **19.3** | **18.3** | **0.98 pts** |
| R4 capture | 18.8 | 12.7 | 6.17 pts |
| **R5 capture** | **21.2** | **20.2** | **0.98 pts** |

Livery-role share (harness-exact, from the role buffer — immune to hue and
value entirely): R4 13.4 vs 11.1 (2.35 pts) → **R5 15.4 vs 14.2 (1.13 pts)**.

**The record's 37.1 % / 0.0 % figure.** That number is a **warm-only detector**
run on both clumps, and it reads 0.0 % on the cool faction in round 4 and 0.0 %
on the cool faction in round 5, because slate is blue. Re-running exactly that
detector here gives R4 18.8 / 0.0 and R5 21.2 / 0.0 — unchanged, and it will
stay unchanged for any faction pair that differs in hue. The asymmetry it was
pointing at is real, but the honest statement of it is the own-hue row above:
**6.17 pts → 0.98 pts on the capture, 2.25 → 0.98 harness-exact.**

**Why round 4's cool faction was hard to find at all**, and this is the
substantive part: its livery sat at luma 79.5 against a neutral coat at 76.6 —
a 2.9-luma separation, inside its own grain — and at saturation 0.39 against
the warm side's 0.68. It was neither a value event nor a saturation event.

| ramp step | R4 rust | R4 slate | ΔL | R5 rust | R5 slate | ΔL |
|---|---|---|---|---|---|---|
| `l` base | #ad5638 L102.3 S0.68 | #3f5268 L79.5 S0.39 | 22.8 | **#aa5e38 L107.4 S0.67** | **#1d4468 L62.3 S0.72** | **45.1** |
| `L` shadow | #63332a L60.6 S0.58 | #232f3f L45.6 S0.44 | 15.0 | **#67382b L65.1 S0.58** | **#12293f L37.7 S0.71** | **27.4** |
| `i` highlight | #e0a06f L170.1 S0.50 | #5c7ea8 L121.8 S0.45 | 48.3 | **#e5a366 L172.6 S0.55** | **#4a7ba6 L115.7 S0.55** | **56.9** |

Against the neutral coat `c` at L 76.6: rust `l` sits **+30.8** above it, slate
`l` **−14.3** below it. Round 4: +25.7 and **+2.9**. That is the design in one
line — the gear separates from the cloth on both sides, and *which direction*
it separates is the faction.

---

## 3. Grayscale — the canon test

Two liveries at matched luma collapse in grayscale, which is why the canon asks
for a value split as well as a hue split.

| | rust gear mean L | slate gear mean L | apart |
|---|---|---|---|
| R4 | 91.3 | 81.3 | **10.0** |
| **R5** | **98.7** | **78.1** | **20.6** |

Measured on `crowd-small-unmarked.png` (the hero rings are out of it), unit
mask ∩ S ≥ 0.35 ∩ L ≥ 25. The two factions are now 2.06× further apart in
grayscale than they were.

Gear against its own coat, per side: rust +18.5 → **+28.0**; slate +11.2 →
**+10.1**. The slate figure is measured as a *positive* number because the
mask's brightest members are the rim-lit `i` promotions; at the palette level
slate's base livery is 14.3 luma *below* the coat, and the grayscale loupes
(`loupe-livery-4x-gray.png`) show the slate helmet reading darker than the coat
and the rust helmet lighter.

---

## 4. Confound C2 — livery run length as an archetype badge

Round 4's cold pass: *"Orange runs of length ≥5 px occur exactly 8 times in the
left clump, and each one is a melee helmet band (6 px) or belt (8 px). Ranged
orange never exceeds 4 px."* Measured on the isolated lineup units, where
identity is not in doubt:

| | longest livery run | livery px |
|---|---|---|
| R4 rust melee | 8 | 36 |
| R4 rust ranged | 4 | 16 |
| R4 slate melee | 6 | 32 |
| R4 slate ranged | 3 | 16 |
| **R5 rust melee** | **6** | **38** |
| **R5 rust ranged** | **4** | **19** |
| **R5 slate melee** | **5** | **33** |
| **R5 slate ranged** | **4** | **19** |

In the clump, runs ≥ 5 px: R4 left 22 / right 3 → **R5 left 14 / right 12**.

**Reduced, not eliminated, and stated as such.** A ≥5 px threshold still
separates the archetypes (melee 6 and 5 against ranged 4 and 4), so the badge
has not been killed — the margin narrowed from 4 px to 2 px, the melee's second
badge (the 8 px belt) is gone entirely, the livery-pixel ratio between the
archetypes fell 2.25× → 2.0×, and the detector no longer cleanly enumerates one
side's melee while finding nothing on the other.

---

## 5. Motion

**Harness-exact**, 48 samples over one program:

| | R4 | R5 |
|---|---|---|
| distinct posed frames the crowd can show | **55** | **288** |
| — breaker | 21 | 117 |
| — stinger | 21 | 129 |
| — hero | 13 | 42 |
| distinct frames per unit (min / median / max) | 2 / 13 / 15 | 5 / 16 / 21 |
| **max units on an identical posed frame at once** | **6 of 36** | **4 of 36** |
| per-unit crown excursion | 36 × 1 px | 20 × 1 px, 3 × 2 px, 13 × 3 px |

Beat inventory across the roster: `gear-adjust` 20, `look` 20, `settle` 16,
`weight-shift` 16. **36 distinct beat start times across 36 units**, smallest
gap 133 ms against a 760 ms beat.

**Captured GIFs**, crowd band y95–190 x50–350:

| | R4 (16 frames / 1600 ms) | R5 (32 frames / 4800 ms) |
|---|---|---|
| peak frame-to-frame changed px | 2.89 % | **4.89 %** |
| mean frame-to-frame changed px | 1.92 % | **3.53 %** |
| pixels that move at all over the loop | 4740 (16.6 %) | **5958 (20.9 %)** |
| pixels that change by > 40 luma | 2726 | **4047** |

The residual 4-of-36 collision is a unit whose lean happens to cancel another
unit's static head offset. It is reported rather than papered over.

---

## 6. What did not change, verified

- **Both fodder silhouette masks are byte-identical to round 4.** Every changed
  cell changes which palette role it carries, never whether it is filled. The
  archetype separation that passed on shape in round 4 therefore cannot have
  regressed by construction, and the ranged unit's 12 px pale barrel run
  (x2–x13 on the stinger grid) is preserved exactly.
- **Config LARGE renders byte-identical** across 24 configurations.
- Contact rows stay planted through every beat, pinned by test.
- 127 webapp tests green; `pnpm type-check` and `pnpm lint` green.
