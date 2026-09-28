# Moonwake — the Ivory Company

An original, throwaway illustrated art and animation direction for **Hazard Pay**. This is an intentionally separate fantasy exploration, not a change to the canonical cyberpunk setting, combat simulation, or existing art.

Run `corepack pnpm --filter @hazard-pay/webapp dev` from the repository root and open `/prototype-moonwake`. The dedicated page has pause, replay, a frame-accurate slider, chapter navigation, and a reduced-motion initial pause. The cinematic canvas scales to the available width.

## Encounter

The 36-second deterministic encounter contains 28 mercenaries, 28 tidal creatures, Captain Vey, and the drowned bell-keeper: **58 illustrated figures**. Three mercenary roles: shieldbearers, lantern archers, harpooners. Creatures have three carapace profiles and individual scale/position variations.

| Time | Authored action | Reaction / aftermath |
| --- | --- | --- |
| 0–6 s | Staggered advance with separate front and support formations | Front ranks meet; sword/claw skirmishes continue |
| 6–13 s | Three staggered bow flights from actual archer positions | Specific struck creatures recoil; impact crowns mark contact |
| 13–21 s | Articulated giant windup and downward slam; company braces before a tidal wall | Shieldbearers retreat, one fighter falls, company recovers |
| 21–29 s | Harpoons wrench the giant; captain plants, draws back, dashes and jumps | Troops advance, keeper holds a bound stagger, camera pushes in |
| 29–36 s | Crescent physically crosses the chest bell; giant collapses | Debris, fallen creatures, captain landing and recovery, settling ranks |

`timeline.ts` samples state from absolute time with no random state or forward-only integration. `figure-art.ts` contains anatomical pose tables with separate feet, knees, hips, torso, shoulders, elbows, hands and weapon rotations. Both hands stay on the shaft. Troops use planted feet, separate torso/weapon gestures and targeted recoil.

## Source and evidence

- `apps/webapp/src/moonwake/painter.ts`: layered environment, mercenaries, creatures, effects and composition.
- `apps/webapp/src/moonwake/figure-art.ts`: original captain and keeper illustration and poses.
- `battle.webp`, `finisher.webp`, `chapters.webp`: compact review plates committed here.
- `render.mjs`: exports full-resolution PNG plates and optionally the complete 36-second, 1280 × 720, 24-fps film. Generated PNG/MP4 files are local outputs, not checked into this branch.

![The tidal slam](battle.webp)

![Captain Vey's finishing strike](finisher.webp)

![Six encounter chapters](chapters.webp)

No image-generation model, stock art, inherited prototype figures, or traced assets were used. Every shape is authored in source.

These are **offline native Canvas renders of the exact runtime painter**, not browser screenshots. Browser capture was unavailable. The exported film is silent. Native render timings are not a production browser performance claim.

Recreate with existing runtime `@napi-rs/canvas`, Node and system ffmpeg:

```sh
node --import tsx docs/art-direction/moonwake/render.mjs --video
```

The renderer resolves Canvas via `CODEX_PRIMARY_RUNTIME_NODE_MODULES`, adding no project dependency.

## Validation and limits

Root typecheck, lint and the full test suite passed in [GitHub CI](https://github.com/arnavp103/hazard-pay/actions/runs/36469696511). Local validation also passed the production Vite build and all 140 webapp tests. Six timeline tests cover roster, backwards scrubbing, tidal displacement, targeted arrow recoil, aftermath and chapter boundaries. The existing combat-sandbox test adjustment retains every bounds check while aggregating failures instead of executing tens of thousands of costly assertions; no runtime art or behavior changes.

This is authored choreography, not emergent combat AI. It does not integrate persistence, damage rules, networking or audio. Minor troops share role anatomy. Narrow-phone readability and browser performance need live review. Crowded aftermath and a short airborne hang remain prototype limitations.

