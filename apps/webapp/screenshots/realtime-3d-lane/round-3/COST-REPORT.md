# Round-3 cost and measurement report — real-time cel-shaded 3D lane (#81)

All figures produced by the capture surface at `/match-proto?view=capture`,
which builds every artifact in this directory in one page load and writes its
raw numbers to `measurements.json`. Nothing here is read off a screenshot.

## Scene: 40 units, 480×270, the unchanged grime-market board

18 fodder + 2 heroes per side, two sides. Heroes are the field medic; fodder
are the shield brute and the long-barrelled marksman.

| | draw calls | triangles |
|---|---:|---:|
| lit scene pass, 40 units | 1,445 | 19,064 |
| hero marking (mask ×2 + dilate) | +337 | +4,338 |
| **total, marked** | **1,782** | **23,402** |

Marking costs **+23% draw calls and +23% triangles**, and both are
independent of the register — the ring is a screen-space pass, so pulling the
camera back does not make it cheaper or more expensive.

### Frame time — read this caveat before quoting the number

Mean render ranged **48–83 ms** across runs at 40 units. **That number is not
comparable to the sibling lane's 2.59 ms** and should not be put next to it.
The capture browser reports:

    ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)

SwiftShader is a CPU rasteriser. Wall-clock here measures a software
rasteriser under variable machine load — the same configuration re-measured
33 ms and 83 ms for the identical scene minutes apart. Draw calls and
triangle counts are hardware-independent and are the numbers worth carrying
forward; the millisecond figures are not evidence of anything.

### The unspent lever, same as the sibling lane

Scaling is linear in units because each animated bone is its own mesh and
bones cannot merge. Two known optimisations are deliberately unspent:
`InstancedMesh` + GPU skinning would collapse the scene pass toward one call
per archetype, and the marking's 36-tap dilate would drop to ~10 taps as a
separable two-pass max. Performance is not what decides this lane.

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
  than on an authored number.
- **Detail density: 3.4×** the primitive count (84 meshes vs 24–25).
- **Screen mass: 0.94×.** The hero fills *fewer* cells than a shield brute
  despite standing 1.25× taller. This is the third independent pipeline to
  find that the size boost does not buy mass — #84 measured 1.20× in pixel,
  and here the sign is negative.

### Archetype separation is real, but not on bounding-box width

The marksman's barrel spans almost exactly the brute's shield width, so the
two archetypes have effectively the same bounding box (17 vs 15 cols) and
**bbox width is not a usable discriminator**. What parts them is where the
mass sits:

- **core width 1.86×** (13 vs 7 cells)
- **fill density 1.64×** (0.764 vs 0.465)

A brute is a solid block; a marksman is a thin vertical with a stick through
it. Both survive grayscale, which is how they are asserted in
`crowd3d.test.ts`.

## Board contrast — measured, deliberately NOT fixed

The Blender lane escalated on #69 that **53% of silhouette-edge pixels sit
inside the floor's luminance band**, so units drawn at 22 px read at ~16 px.
The equivalent figure for this lane:

| register | contour pixels | dissolved into the floor band | median contour-vs-ground ΔL |
|---|---:|---:|---:|
| fodder ≈ 22 px | 632 | **46.2%** | 14.0 / 255 |
| fodder ≈ 35 px | 1,097 | **38.0%** | 14.6 / 255 |

A third of the contour (35.0% far, 32.3% near) sits within ΔL < 8 of the
ground directly beneath it.

`contrast-far.png` / `contrast-near.png` show the measurement rather than
just asserting it: red contour is dissolved, green survives, over a dimmed
frame. The pattern is legible — the shadowed lower-left sides of every unit
dissolve, the key-lit upper-right sides survive. This is a *lighting-vs-floor
value* problem, not a per-lane art problem.

**The board is untouched.** It is the control all four lanes are judged
against and re-valuing the walkable plane is a decision above this ticket.

### Method note

The floor band is the 10th–90th percentile of board luminance sampled in a
14 px collar around the units — the ground a contour is actually drawn
against — restricted to real board pixels. Sampling the whole frame instead
is wrong twice: it averages in roofs and walls the contour never touches,
and once the capture clears to the floor tone it folds in a large block of
one constant value, which collapses the band to a couple of luma steps and
reports a fake 4.5%. That error was made and corrected during this round.

## Capture framing note

At the 22 px register the aperture covers 35.5 × 20 world units, but the
shared board's floor is a 30 × 30 plane whose dimetric projection is a
diamond — its corners fall short of a 16:9 frame. The capture clears to the
floor's own tone so this does not read as a hole. **The board is unchanged**;
this is a framing choice in the capture surface. It is itself a data point
for the board-ownership decision already open on #69: the shared board was
authored for a tighter framing than a 40-unit battle needs.
