# Emberwatch — elevated pixel battlefield

Open `/prototype-emberwatch` after running `corepack pnpm --filter @hazard-pay/webapp dev`.

![Ninety combatants in the copper garden](poster.webp)

This rebuild follows the spatial reading of Hero’s Hour: small upright pixel actors on a full-frame, elevated battlefield. There is no horizon or side-on stage. Salvage crews and cobalt chitin creatures move across both world axes, pass around raised masonry, and flank through a railway clearing. The camera remains fixed over the whole army.

The 44-second encounter contains 90 combatants. Four irregular breaches form around broken foundations, a branching quarry road, trees, copper tanks, and a disused railway. Infantry, shields, rocketeers and Captain Rook have new hand-authored native raster sprites; directional rows distinguish front, rear, left and right. Props and live actors share one footpoint depth sort. Shadows use projected ground positions, so Rook’s airborne Hammerfall separates visibly from its shadow.

The sequence includes walking spore artillery, a northern encirclement, a rocket-assisted Hammerfall that scatters and kills southern brood, and a diagonal matriarch charge answered by converging rockets. Fallen bodies, shell craters and the queen’s wreck remain while survivors advance.

![Eight moments including the settled aftermath](contact-sheet.webp)

## Assets and controls

- `author_sprites.py` authors the 640 × 360 terrain, sortable prop atlas, six roles × six poses × four directional rows × eight frames, and the queen atlas using Pillow. These are original pixel masks and discrete poses, without generated imagery.
- `apps/webapp/public/emberwatch/` contains the actual PNG atlases loaded by the route. Troops are roughly 18–24 native pixels high inside 32px atlas cells.
- `apps/webapp/src/emberwatch/scene.ts` owns deterministic XY choreography, obstacle clearance and rendering. This is an authored battle study, not a new autonomous combat solver.
- Pause, replay, seek and chapter jumps work without a server. Reduced-motion preference starts paused.
- State tests cover repeatable seeking, XY travel, directional facing, obstacle clearance throughout the full battle (including the queen), airborne height and reactions, and persistent casualties.

## Reproduce

Use Node 24+ for TypeScript stripping, Pillow, `@napi-rs/canvas`, and FFmpeg:

```sh
python docs/art-direction/emberwatch/author_sprites.py
node docs/art-direction/emberwatch/render.mjs --film
```

`@napi-rs/canvas` can live in a separate tooling environment via `CODEX_PRIMARY_RUNTIME_NODE_MODULES`; no project dependency or lockfile changes are required. The capture imports the exact runtime painter. Outputs go to `docs/art-direction/emberwatch/captures/`, or `EMBERWATCH_CAPTURE_DIR`.

The full film is 44 seconds, 1320 frames at 30 fps, rendered at native 640 × 360 and nearest-neighbor enlarged to 1280 × 720. The movie is delivered separately; compressed WebP review stills are committed here. The runtime uses original PNG assets. Offline capture verifies rendering and encoded frames; it does not claim browser performance or interaction coverage.
