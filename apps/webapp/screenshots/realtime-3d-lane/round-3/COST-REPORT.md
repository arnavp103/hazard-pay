# Round-3 cost and measurement report — real-time cel-shaded 3D lane (#81)

Every figure here is produced by the capture surface at
`/match-proto?view=capture`, which builds all 29 artifacts in this directory
in one page load and writes its raw numbers to `measurements.json`. Nothing
is read off a screenshot.

## Scene: 40 units, 480×270, the unchanged grime-market board

18 fodder + 2 heroes per side, two sides. Heroes are the field medic; fodder
are the shield brute and the long-barrelled marksman.

| | draw calls | triangles |
|---|---:|---:|
| lit scene pass, 40 units | 1,447 | 19,200 |
| hero marking (depth prepass + 2 mask passes + dilate) | +1,784 | +23,538 |
| **total, marked** | **3,231** | **42,738** |

**Marking more than doubles the frame**, and most of that is one specific
thing: a full-scene depth prepass. Without it the mask target's depth buffer
is empty — the pass draws heroes *alone*, so nothing can occlude them, and a
hero standing behind a building stamped a ring across the wall with no unit
inside it. That was in the first round-3 capture set and a cold critic found
it. Correctness cost 1,447 of those 1,784 calls.

Two obvious ways to get most of it back, both deliberately unspent: render
the main pass into a target with a depth texture and share it with the mask
pass (removes the prepass entirely), and collapse the 3×12-tap dilate to a
separable two-pass max (~10 taps instead of 36).

### Frame time — read this caveat before quoting the number

Mean render ranged **17–128 ms** at 40 units across runs. **Do not put that
next to the sibling lane's 2.59 ms.** The capture browser reports:

    ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)

SwiftShader is a CPU rasteriser. The same scene re-measured 33 ms and 83 ms
minutes apart under varying machine load. Draw calls and triangle counts are
hardware-independent and are the numbers worth carrying forward; the
millisecond figures are evidence of nothing except that the marked config is
several times more fill-bound than the unmarked one.

Scaling is linear in units because each animated bone is its own mesh and
bones cannot merge. `InstancedMesh` + GPU skinning would collapse the scene
pass toward one call per archetype. Performance is not what decides this lane.

## Tier separation

Measured on rasterised screen silhouettes with all colour discarded. Fodder
rasterises at 22 rows and the hero at 22 × 1.25, so one cell is the same
number of screen pixels for both tiers and the filled-cell counts compare
directly.

| | bbox cols | filled cells | density | core width | meshes |
|---|---:|---:|---:|---:|---:|
| brute (fodder) | 15 | 252 | 0.764 | 13 | 24 |
| marksman (fodder) | 17 | 174 | 0.465 | 7 | 25 |
| hero (medic) | 12 | 238 | 0.708 | 10 | 84 |

- **Size boost: exactly 1.250×**, enforced on projected screen height rather
  than on an authored number that drifts when an archetype grows a helmet.
- **Detail density: 3.4×** the primitive count.
- **Screen mass: 0.94×.** The hero fills *fewer* cells than a shield brute
  despite standing 1.25× taller. Third independent pipeline to find that the
  size boost does not buy mass — #84 measured 1.20× in pixel — and the first
  to find the sign negative.

### Archetype separation is real, but not on bounding-box width

The marksman's barrel spans almost exactly the brute's shield width, so the
two archetypes have effectively the same bounding box (17 vs 15 cols) and
**bbox width is not a usable discriminator**. What parts them is where the
mass sits:

- **core width 1.86×** (13 vs 7 cells)
- **fill density 1.64×** (0.764 vs 0.465)

A brute is a solid block; a marksman is a thin vertical with a stick through
it. Both survive grayscale, which is how `crowd3d.test.ts` asserts them.

## Board contrast — measured, deliberately NOT fixed

The Blender lane escalated on #69 that **53% of silhouette-edge pixels sit
inside the floor's luminance band**, so units drawn at 22 px read at ~16 px.
Two edge definitions are measured here because only one is comparable:

| register | outer contour (comparable to #88) | all contour incl. unit-vs-unit | median contour-vs-ground ΔL |
|---|---:|---:|---:|
| fodder ≈ 22 px | **33.6%** of 646 px | 34.3% of 2,715 px | 22.0 / 255 |
| fodder ≈ 35 px | **24.6%** of 1,126 px | 27.5% of 4,625 px | 23.7 / 255 |

"Outer" is contour drawn against the ground — the Blender lane's metric.
"All" adds every unit-against-unit edge, which in a formation is **four times
as many pixels** as the outer boundary and is completely invisible to a
single-key mask. A first version of this measurement used one key colour for
the whole crowd and therefore measured only the outline of each clump; per-
unit id colours fixed it.

So this lane loses **roughly a third** of its contour to the floor rather
than the Blender lane's half — better, same order, same cause.
`contrast-far.png` / `contrast-near.png` show it rather than assert it: red
contour dissolves, green survives, over a dimmed frame.

**The board is untouched.** It is the control all four lanes are judged
against and re-valuing the walkable plane is a decision above this ticket.

### Method note

The floor band is the 10th–90th percentile of board luminance sampled in a
14 px collar around the units — the ground a contour is actually drawn
against — restricted to real board pixels. Sampling the whole frame instead
is wrong twice: it averages in roofs and walls the contour never touches, and
once the capture clears to the floor tone it folds in a large block of one
constant value, collapsing the band to a couple of luma steps and reporting a
fake 4.5%. That error was made and corrected during this round.

## Capture framing note

At the 22 px register the aperture covers 35.5 × 20 world units, but the
shared board's floor is a 30 × 30 plane whose dimetric projection is a
diamond — its corners fall short of a 16:9 frame. The capture clears to the
floor's own tone so this does not read as a hole. **The board is unchanged**;
this is a framing choice in the capture surface, and it is itself a data
point for the board-ownership decision already open on #69: the shared board
was authored for a tighter framing than a 40-unit battle needs.
