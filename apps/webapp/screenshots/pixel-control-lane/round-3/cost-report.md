# Round 3 cost report — two tiers, two resolutions, and what zoom costs

Measured from the grids actually authored on this branch
(`apps/webapp/src/match-proto/pixel-control-lane/crowd-sprites.ts`), not
estimated. Every number below is derived by the module's own
`inkedCells` / `figureHeight` helpers, which the test suite pins.

## 1. Authored cells per tier per config

| Config | Unit | Canvas | Grid cells | Inked cells | Figure height | Palette roles used |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| SMALL | Breaker (melee fodder) | 16×24 | 384 | 225 | 22 px | 13 |
| SMALL | Stinger (ranged fodder) | 16×24 | 384 | 183 | 22 px | 15 |
| SMALL | **Mara Voss (hero)** | 20×30 | **600** | **326** | **28 px** | **18** |
| LARGE | Breaker (melee fodder) | 24×36 | 864 | 451 | 34 px | 11 |
| LARGE | Stinger (ranged fodder) | 24×36 | 864 | 350 | 34 px | 13 |
| LARGE | **Mara Voss (hero)** | 32×47 | **1 504** | **716** | **44 px** | **18** |
| — | Canon medic (#68, round 1–2) | 48×64 | 3 072 | 1 031 | 56 px | 22 |

Hero boost is held at **1.27× (SMALL)** and **1.29× (LARGE)** — inside the
cofounder's "slight" ruling in both configs, so the only thing that changes
between them is the absolute register.

Two facts worth reading off this table:

- The hero's *detail budget* is 1.56× the fodder's at SMALL and 1.74× at
  LARGE. That is the entire "higher detail density" lever, in cells — and
  §5 records what the artifact says about whether it is enough.
- The canon 48×64 sprite is **5.1×** the SMALL hero's canvas. Round 1 and 2
  were drawn in a register neither of these configs can afford.

## 2. Sprite count for a 20-unit roster

Assumptions, all inherited rather than invented:

- **Facings**: 3 authored (front / side / back), left mirrored — the
  round-1 ratification, still flagged as costing an asymmetric kit swap.
- **Animation**: the ratified **hybrid** path — authored key poses,
  programmatic in-betweens, drawn smear. Round 2's ratified frame counts
  are 4 idle keys and 6 attack keys; a walk adds 4.
- **Hero** = 3 facings + 14 side-facing action keys = **17 authored grids**.
- **Fodder** = pure-programmatic, the ratified cheap fallback for filler
  units: 3 authored facings, all motion from region transforms =
  **3 authored grids**. (An *acted* fodder unit with 2 keys per action
  would be 9 — 3× the cost, applied to the tier there are most of.)
- **Roster of 20** = 5 hero units + 15 fodder archetypes.

| Config | Authored grids | Authored cells | vs canon-only roster |
| --- | ---: | ---: | ---: |
| SMALL | 130 | **68 280** | 0.26× |
| LARGE | 130 | **166 720** | 0.64× |
| Canon 48×64, no fodder tier (5 heroes only) | 85 | 261 120 | 1.00× |

The grid *count* is identical between configs — the two-tier split is what
controls it, not the resolution. Resolution controls the **cells per grid**,
which is what actually costs drawing time: LARGE is **2.4×** the authoring
surface of SMALL for the same roster.

Bytes are not the constraint here and this report does not pretend they
are — the Blender lane already measured 208 cells at 28.6 KiB on
[#88](https://github.com/arnavp103/hazard-pay/pull/88). The constraint is
authored cells, i.e. human/agent drawing decisions.

## 3. What camera zoom costs

Pixel art scales cleanly only by whole numbers, so a tactical zoom control
is paid for in **authored LOD sets**, not in a scale factor.

This round measured that rather than asserting it. Config SMALL is *not*
a resample of config LARGE — it is a separate authoring pass. The
side-by-side is committed as `lod-resample-vs-authored.png`:

- point-resampling the LARGE hero to the SMALL figure height (63.6%)
  **breaks the continuous plum-black contour** the whole #79 synthesis
  rests on, drops the respirator and the injector's metal/emission
  separation, and turns the legs into two indeterminate columns;
- the authored SMALL hero at the same size keeps a closed silhouette and
  survives with a readable pack, hood and injector pip.

Cost of a zoom ladder, in whole authored LOD sets:

| Zoom ladder | LOD sets | Authored grids | Authored cells (20-unit roster) |
| --- | ---: | ---: | ---: |
| One fixed zoom (today) | 1 | 130 | 68 280 – 166 720 |
| Two steps (e.g. tactical + close) | 2 | 260 | ~235 000 |
| Three steps (wide / tactical / close) | 3 | 390 | ~350 000 |

Each step is a full re-authoring of **every grid, of every tier, of every
facing**. Nothing in the pipeline amortises it: the text-grid compiler
emits what was drawn, and the drawing is the cost. A 2× integer step is the
only "free" one, and it is free only in the upward direction (chunkier
pixels), which is a different look, not the same look bigger.

This is the sprite runtime's structural tax and it is unrelated to how
good the art is. A 3D runtime pays none of it.


## 5. The hero marking costs nothing

Marking was withheld while this round tested size + detail density on their
own; the cofounder has since approved a "thick border or highlight". It is
implemented as a **runtime dilation of the posed silhouette** — two bright
rings in the unit's own livery-highlight entry, seated on one ring of
plum-black — not as an authored decal.

That matters for this report: it adds **0 authored cells**, at any config,
for any unit, in any pose or facing, forever. It is the only tier-separation
lever measured here that does not multiply with the roster, and it survives
grayscale, which the detail-density lever did not.

Runtime cost is one multi-source dilation per hero per frame over the
sprite's own bounding box plus the ring radius — 2 px at SMALL, 3 px at
LARGE, the outermost ring always plum-black so the border carries its own
contour. It stops at the contact row rather than closing under the feet:
a closed capsule reads as a screen-space cartouche pasted over the board,
an open one reads as the unit's own outline.

With 1–2 heroes a side the runtime cost is nothing; it would matter if
every unit were marked, which is exactly why only heroes are.

## 4. What this round actually cost to author

6 grids, **4 600 authored cells**, hand-typed as text grids in one session,
including three revision passes: the first pass had fodder in
livery-dominant colour, which broke the 70/25/5 budget and — worse — would
have let colour composition smuggle in a tier read the experiment was
supposed to exclude; the last put the SMALL fodder on an ink diet after the
cold critic measured plum-black eating 54–68 % of those sprites (interior
ink was demoted to the darkest value of its surrounding material, leaving
the outer contour untouched: 103→77 and 85→69 ink cells).

Extrapolated at that rate, a 20-unit roster is 68 k–167 k authored cells.
That is the number to weigh against a 3D lane where a zoom step, a facing
and a frame all cost zero.
