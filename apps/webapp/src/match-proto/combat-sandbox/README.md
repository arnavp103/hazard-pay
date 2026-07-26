# Combat sandbox

**Throwaway scaffolding.** This directory exists so the combat-vocabulary
prototypes on [map #95][map] — #99 match rhythm, #100 battlefield space, #101
death, #102 hero tiers — each start from the same substrate instead of
rebuilding one. It is ported from the flat low-poly + procedural-animation
bake-off lane ([PR #90][lane]), which was chosen for **iteration speed only**.

> It is **not** an art-direction commitment and must not be presented as one.
> Choosing a look is [#64][art]'s job. Do not "improve" the art here; polishing
> it wastes the reason this lane was picked. It will under-sell authored
> quality, and that is expected.

Nothing here goes in `packages/assets` — [#71][assets] governs the real asset
home. Nothing here touches `match-proto/sprites.ts` or `stage.ts`. The
neighbouring `/match-proto` prototype is PixiJS ([#27][pixi]); this one is
Three.js. They answer different questions — keep them separate.

## Run it

```
pnpm --filter @hazard-pay/webapp dev
```

Then open <http://localhost:5173/combat-sandbox>. The default is the ~40-body
fight (18 fodder + 2 heroes a side) under the fixed 2:1 dimetric camera.

Useful query parameters — the full list is in
`combat-sandbox-prototype.tsx`:

| Parameter | Does |
| --- | --- |
| `view=crowd\|hero\|lineup` | the battle, one unit, or every archetype in a row |
| `seed=<n>` | battle seed. Same seed, same fight, forever |
| `start=<s>&slice=<s>` | open at sim second `s` and hold after `slice` seconds — the slice window |
| `anim=idle\|attack\|walk\|march\|turn` | hero/lineup clip |
| `base=none\|stance\|pair\|quad` | authored-key rung, 0/1/2/4 keys per clip |
| `layers=none\|all\|phase,stride,aim,ik,lean,react` | procedural layer ablation |
| `space=plaza\|cover` | #100: continuous space, or the tile grid with footprints and sightlines |
| `density=dense\|spread\|sparse` | #100 round 2: 32 / 16 / 8 authored cover props. `dense` is round 1's board |
| `roster=mixed\|ranged\|split` | #100 round 2: the bake-off mix, all shooters, or shooters vs swords |
| `fire=none\|hitscan\|bolt` | #100 round 2: how a ranged attack is drawn. **A prototype stand-in** — read `battlefield-space/fire-render.ts` first |
| `grid=1` | #100: debug overlay — tiles, blocked and roofed cells |
| `zoom=`, `scale=`, `motion=1`, `mark=0` | framing, pixel density, camera pan, hero border |
| `freeze=<ms>` | one deterministic frame, then stop |
| `strip=<n>&fps=&from=&cols=` | tile n deterministic frames into a filmstrip |
| `capture=1` | hide dev chrome |

## Capture (per [#67][loop])

The ruling is `agent-browser` over WebGL (ANGLE/SwiftShader), **not** WebGPU.
`capture.mjs` implements it, so a downstream prototype can post a PR gallery
without re-solving capture:

```
pnpm --filter @hazard-pay/webapp dev          # in one terminal
node apps/webapp/src/match-proto/combat-sandbox/capture.mjs --out /tmp/gallery
```

That writes the default gallery: crowd still, crowd GIF, filmstrip, lineup,
and `cost-report.json`. Custom shots:

```
node capture.mjs --out /tmp/g \
  --shot hero-strike='view=hero&anim=attack&scale=2&freeze=1400' \
  --gif slice='view=crowd&start=6' --frames 60 --fps 15
```

Captures drive `window.__combatSandbox.renderAt(seconds)` — the same
fixed-step integrator the live page runs — so a capture cannot drift from what
a human sees, and the same command produces the same pixels tomorrow.

## The three extension points

Each downstream ticket needs exactly one of these. They are the only places
you should have to touch.

### 1. A new animation state → `animation-states.ts`

Discrete poses: a death, a stagger, a cheer. `idle` and `walk` are *not*
states — they are the always-on cycle layer, blended by speed.

1. add a field to `SimUnit` in `state.ts` (`deathStep: number`, `-1` while
   alive). An integer step count, never accumulated seconds;
2. drive it from an `act` behaviour (extension point 3), so it is part of the
   deterministic sim rather than a renderer-side guess;
3. add an `AnimationState` to `ANIMATION_STATES` that reads it. Declare
   `suppresses: ["aim", "cycle", "ik", "lean"]` if the state owns the whole
   body, and `priority` above 10 to outrank the built-in attack.

The built-in `attackState` is a complete worked example.

### 2. A new unit archetype → `archetypes.ts`

Add one entry to `ARCHETYPES`. `Archetype` is derived from its keys, so
TypeScript finds anything that has not kept up. An entry owns the combat
profile, the headgear, the torso tell, the hero kit, the weapon, the rest
posture and three flags. Nothing else in the sandbox branches on an archetype
name, and the `lineup` view is generated from the registry, so a new archetype
appears in the roster shot for free.

### 3. A new combat behaviour → `behaviours.ts`

Add a `Behaviour` to `BEHAVIOURS`. Three phases run per step, in ascending
unit-id order: `acquire` (targeting, on retarget steps), `steer` (contribute
desired velocity, before anything moves), then the fixed integrator, then
`act` (attacks and stamps, on post-move positions).

Determinism rules for a new behaviour are listed at the top of the file. The
short version: draw from `nextRandom(unit)`, compare step indices not seconds,
and keep state on plain-number `SimUnit` fields.

## The slice API — read this before building on `sim.ts`

Map #95 rules that a match advances in **slices**: the server resolves a few
seconds of continuous battle, the player steers at the boundary, repeat.

```ts
import { battleAt, createBattle, sliceBattle, stepsFor } from "./sim.ts";

// A still at a known moment. Pure function of (seconds, options).
const shot = battleAt(6.5, { seed: 42 });

// A match advancing. Keep the state; do NOT call battleAt again.
let slice = sliceBattle(createBattle({ seed: 42 }), stepsFor(5), { record: true });
// ... store slice.end, ship it, come back to it ...
slice = sliceBattle(slice.end, stepsFor(5), { record: true });
```

- `battleAt(seconds, options)` is time-indexed and therefore replays from the
  seed. It is O(seconds) by construction. Use it to open a match or shoot a
  still — never to advance one.
- `sliceBattle` / `advanceBattle` **resume**. Total cost is linear in
  simulated time however many slices you cut it into.
- `slice.end` is plain data. `JSON.stringify` it, store it, send it, resume
  from it — `sim.test.ts` asserts the round trip is exact.
- `slice.frames` (with `record: true`) is one snapshot per step, which is what
  a scrubbable slice-boundary UI wants.
- Slice lengths are **integer step counts**, not seconds, so consecutive
  slices tile the timeline exactly. `stepsFor(seconds)` converts.

## What changed relative to the lane it was ported from

The port is faithful to the lane's geometry, materials, camera and animation
layers. The sim was restructured, on findings from the #97 and #98 research:

- **`SimState` is serialisable.** The lane carried its PRNG as a closure
  (`random: () => number`), which made a battle replay-only. It is now
  `randomState: number` plus a free `nextRandom` — that is what makes a slice
  boundary storable and resumable.
- **Time is an integer.** `step` is the clock; `t` is derived and never
  compared. The two knife-edge float comparisons #98's perturbation testing
  found (`attackPhase >= 1`, margin 1.67e-15; `t >= retargetAt`, margin
  exactly 0) no longer exist. `attackStep`, `cooldownSteps`, `firedAtStep` and
  `hitAtStep` are step counters; `attackPhaseOf(unit)` gives the animator its
  0..1 phase.
- **`stepBattle(state)` takes no `dt`.** An arbitrary timestep makes the slice
  boundary its own drift source.
- **Units are visited in id order, and steering is double-buffered** — every
  unit steers off the same start-of-step positions. Array order no longer
  affects the result at all, and removing a unit mid-fight is safe (which
  #101 will need). The renderer keys rigs by unit id for the same reason.
- **Per-unit random streams**, derived from `(seed, id)` via `mixSeed`, so
  adding a draw for one unit cannot shift another unit's sequence.
- Archetypes, behaviours and animation states moved into the three registries
  above.

Because of the double buffering and the integer clock, this sandbox does
**not** reproduce PR #90's captures frame-for-frame. Same fight, same
emergent behaviour, different float trajectory.

## Known gaps (owned by the prototype tickets, not by this directory)

Nothing dies (#101). No projectiles **in the sandbox proper** — `fire=` draws
one, but that lives in `battlefield-space/` as a #100 prototype stand-in and is
a renderer over a hitscan sim, not a projectile the sim knows about. No HUD, no health bars, no damage numbers. The
animation vocabulary is `idle`, `attack`, `turn`, `walk`/`march`. PR #90's own
retro concedes that *"two contact poses is the point at which the procedural
layers stop being able to fake an animator"* — a state that needs specific
contact timing wants authored keys in `authored.ts`, not more sine waves.

## Files

| File | Owns |
| --- | --- |
| `sim.ts` | the front door: `createBattle`, `stepBattle`, `battleAt`, `advanceBattle`, `sliceBattle` |
| `state.ts` | `SimUnit` / `SimState` / `BattleOptions`. Plain numbers only |
| `behaviours.ts` | **extension point 3** — the unit-AI pipeline |
| `archetypes.ts` | **extension point 2** — per-archetype combat numbers and geometry |
| `animation-states.ts` | **extension point 1** — discrete poses |
| `animator.ts` | the layer stack: bind → cycle → state → aim → lean → reactions → IK |
| `procedural.ts` | pure animation math and the PRNG. Tested in node, no renderer |
| `authored.ts` | the 0/1/2/4-key authored ladder |
| `figure.ts` | the parametric rig. `figure.test.ts` locks the head-readability fix |
| `flat.ts` | materials and the low-poly primitive vocabulary |
| `board.ts` | the environment, 2 draw calls |
| `scene.ts` | mount/teardown, the fixed camera, the cost meter, the capture hook |
| `capture.mjs` | the #67 capture path |

[map]: https://github.com/arnavp103/hazard-pay/issues/95
[lane]: https://github.com/arnavp103/hazard-pay/pull/90
[art]: https://github.com/arnavp103/hazard-pay/issues/64
[assets]: https://github.com/arnavp103/hazard-pay/issues/71
[pixi]: https://github.com/arnavp103/hazard-pay/issues/27
[loop]: https://github.com/arnavp103/hazard-pay/issues/67
