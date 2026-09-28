# Ink Foundry — a cel / ink character and motion prototype

An original Three.js art study for Hazard Pay, in the lineage of the realtime
3D lane in PR #85 (`prototype/realtime-3d-lane`). This is a separate experiment,
not a replacement for the combat sandbox or a production art decision.

## Run and inspect

```sh
corepack pnpm --filter @hazard-pay/webapp dev --port 5174
```

- `/ink-foundry-prototype` — the medic character study.
- `?capture=1&view=hero&clip=attack&freeze=600` — deterministic release pose.
- `?capture=1&view=crowd&freeze=950` — forty independently phased bodies.
- `?capture=1&view=lineup&clip=idle&freeze=800` — three roles in both factions.

`freeze` is milliseconds. `clip` accepts `idle`, `walk`, `attack`, `turn`, or
`stagger`. The camera stays at 30° elevation and 45° azimuth (2:1 dimetric);
framing changes between the character, lineup and crowd views. The display uses
the available viewport, rather than the old lane's 480 × 270 raster aperture.

The visible controls support play/pause, a one-frame step of 1/12 second, arbitrary
backward/forward scrubbing, and switching between 12 fps held poses and smooth
evaluation. The stage reports time, draw calls, triangles and body count. A frozen
stage only redraws when its controls or viewport change.

## What this explores

- **Mara, a field medic with history.** An angular wrapped hood, exposed cheek,
  opaque respirator, asymmetric optics, ivory breastplate, dark split coat, cargo
  pouches, canister pack, repaired boot caps and a salvage injector. The large
  ivory/dark value break carries identity before small marks become visible.
  The revised sculpt uses a domed faceted cowl, an asymmetric respirator filter,
  sloped shoulder hulls, a narrower waist, tapered forearms, wedge boots, unequal
  flared coat hems and a large slung trauma bag. Attack poses widen and stagger
  the feet, shift the pelvis and brace the support arm against a longer tool.
- **Local faction color.** Muted teal salvage crews and rust security crews share
  the same neutral material vocabulary. The world does not tint everything neon.
- **Role contours.** The medic has an ivory chest marking; the breacher gains a
  scuffed forearm shield and heavier shoulder; the ranger adds a trailing scarf,
  scope and longer barrel. Heroes receive an 18% size lift and a thin ground mark.
- **A drawn 3D vocabulary.** Faceted sections, discrete toon ramps, geometry hull
  contours, small paint chips and flat scratched concrete. No image model assets,
  downloaded character packs, fonts, texture files or external runtime fetches.
- **Full-body motion.** Independent hip, torso, head, shoulder, elbow, thigh,
  knee, ankle and coat-tail transforms. Walking uses opposed strides and flexed
  swing knees; the head leads the turn; attacks have aim, release, recoil and
  recovery; stagger bends the whole body. Ankle counter-rotation and an analytic
  pelvis correction keep the supporting boot on the board.
- **Small combat effects.** A graphic muzzle shape, short tracer, a tumbling brass
  casing and a low-opacity faceted smoke puff are sampled from shot age, so the
  effects reproduce identically when the clock moves backward.

## Implementation

| File | Responsibility |
| --- | --- |
| `figure.ts` | Authored costume geometry, rig, joint batching, ground contact |
| `motion.ts` | Pure analytic pose sampling and clip durations |
| `effects.ts` | Stateless shot effects |
| `scene.ts` | Fixed camera, set dressing, 40-body choreography, lifecycle |
| `prototype.tsx` / `style.css` | Review workbench, timeline and capture controls |
| `motion.test.ts` | Scrub determinism, attack phases, finite joints and boot contact |
| `capture.mjs` | Browser-free depth-buffer rasterization of the same live scene meshes |

Costume marks are merged into vertex-colored meshes per joint, with one additional
contour draw per joint. This reduces the original medic from 119 mesh objects to
about 35 before the sculpt revision, without deleting its detail. No production instancing/LOD system is
claimed. Live draw and triangle counts are displayed because the actual renderer
cost, including the foundry set and effects, matters more than a primitive count.

## Honest limits

This is an art and animation prototype. The forty-body view is a **choreographed
pose field**, not a combat simulation; it has no targeting, collision, damage or
pathfinding. Walk previews include treadmill-style presentation and crowd travel
is a small oscillation; feet are vertically grounded but there is no planted-foot
world-space IK. Costume pieces are rigid joint attachments, not skinned cloth.
All three roles still share one body and head construction. Small costume chips
vanish at crowd distance by design. Shadows and per-joint draws still need real
device profiling before adopting this renderer for a large game battle.

## Validation

Root `corepack pnpm type-check` and `corepack pnpm lint` pass. The webapp Vitest
suite passes, including the prototype's deterministic pose and contact tests.
Root `corepack pnpm test` was attempted; unrelated database-backed suites cannot
reach the required development Postgres service at `localhost:5433` in this
workspace. Software-rendered animation captures are reviewed separately below.

## Software-rendered gallery and reproducible capture

See [the gallery](../../../../docs/art/ink-foundry-prototype/README.md).
The environment's browser security policy prevented connecting to the local dev
server. **The interactive WebGL route has not been verified in a browser.**
The committed previews are explicitly labeled software renders, not browser
screenshots. The capture program imports `buildFoundryScene`, `sampleFoundry` and
`frameFoundryCamera`, then projects the real Three.js meshes into a CPU triangle
depth buffer. It uses the same poses, joint matrices, faction colors and fixed
camera angle. Lighting is an approximation of the toon material; shadow maps,
WebGL antialiasing and ground-edge line primitives are omitted. Therefore these
captures verify geometry and animation readability, not exact WebGL pixels or GPU
performance. The larger detail plate and hero reel change only orthographic zoom.

```sh
node --import tsx apps/webapp/src/ink-foundry/capture.mjs
```

Offline-only dependencies used: `@napi-rs/canvas@0.1.100`, `sharp@0.35.4`, and
DejaVu Sans fonts from `/usr/share/fonts/truetype/dejavu/`. The script resolves
those optional modules from `CODEX_PRIMARY_RUNTIME_NODE_MODULES` when set, otherwise
from its normal Node dependency resolution path. These packages were already in
the execution runtime; they are not webapp dependencies and no lockfile changed.
To reproduce elsewhere, install these pinned packages in a scratch directory and
point `CODEX_PRIMARY_RUNTIME_NODE_MODULES` at its `node_modules`.

`motion-evidence.json` hashes only the art viewport, excluding both the changing
timestamp and the footer. It records distinct rendered frames for all five hero
clips and a two-second crowd animation. No intermediate frame dumps are committed.
