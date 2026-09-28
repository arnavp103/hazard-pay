# Velvet Siege

An independent, original **vector art and authored animation prototype** for Hazard Pay. Route: `/prototype-velvet-siege`.

Violet lacquered insect engines attack an ivory fleet of swan, halo and ray machines on the Eclipse Causeway. The factions have separate silhouettes and original Canvas path drawings. There are 48 regular engines, three roles per faction, and two larger commanders. This is a deterministic, 36-second choreography study, not combat AI or a live match integration.

## Review files

- `velvet-siege-full.mp4`: complete 36-second sequence, 1600 × 900, H.264, 24 fps, 864 frames, no audio.
- `velvet-siege-teaser.gif`: seven seconds of the Regent's approach, deployment, strike and recovery, beginning at 12 seconds; 800 × 450, 12 fps.
- `screenshot.png`: full-size battlefield frame.
- `contact-sheet.png`: six battle chapters, including the final outcome.
- `regent-keyposes.png`: anticipation, deployment, strike, follow-through and recovery sampled at 12.5, 14, 14.75, 15.2, 16.7 and 18.8 seconds.
- `role-lineup.png`: actual runtime drawings of the eight role/commander silhouettes.
- `render.mts`: reproducible offline export entry point.

The images and film are **offline renders of the same painter used by the route**, not browser screenshots or recorded browser performance. No generated raster assets, external asset packs, old prototype art, or licensed game art are used.

## Choreography

| Time | Physical action and result |
| --- | --- |
| 0–5s | Fifty engines deploy in opposing ranks; an opening exchange includes source recoil and target stagger. |
| 5–10s | Mantle artillery braces and spreads, staggered curved shells strike the first ivory rank, and destroyed units leave broken shells. |
| 11.8–18.8s | Upper ranks close while the lower flank advances separately. The Regent plants its legs, fans its mantle, extends its split rail mechanism, winds back, swings into contact and recovers. The Matriarch's neck recoils. |
| 19.4–25s | The Matriarch lifts and whips its neck while the ivory flank unfolds and launches a converging counter-volley; eight Court engines are lost. |
| 27.5–34s | Court survivors encircle forward positions and converge their fire. Ivory engines collapse into role-specific debris; the Matriarch sheds a wing section and falls. |
| 34–36s | The Court holds the causeway: 17 survivors, zero opposing survivors. The completed timeline stops. |

Casualty times are authored impact beats. Projectile endpoints use actor positions at impact; wreck positions remain fixed after death. Additional authored skirmish beats fill the intervals between the major sequences. Motion is sampled from absolute time, so seeking and replaying reconstruct the same state.

## Source and controls

- Painter, original art paths, movement and timeline: `apps/webapp/src/velvet-siege/painting.ts`
- React lifecycle and controls: `apps/webapp/src/velvet-siege/prototype.tsx`
- Route: `apps/webapp/src/routes/prototype-velvet-siege.tsx`
- State invariants: `apps/webapp/src/velvet-siege/painting.test.ts`

Controls provide pause/play, replay, continuous seeking, chapter selection and three playback speeds. Reduced-motion preferences start the scene paused. The canvas has a text alternative. This study contains no network calls, gameplay controls or match persistence.

## Reproduce the exports

The renderer uses Node 24's native TypeScript support and the execution runtime's installed `@napi-rs/canvas`; it does not add project dependencies. Set `CODEX_PRIMARY_RUNTIME_NODE_MODULES` to the directory containing that runtime module.

```sh
node docs/art-direction/velvet-siege/render.mts --film
ffmpeg -y -framerate 24 -i docs/art-direction/velvet-siege/frames/%04d.png -t 36 -c:v libx264 -preset medium -crf 21 -pix_fmt yuv420p -movflags +faststart docs/art-direction/velvet-siege/velvet-siege-full.mp4
ffmpeg -y -ss 12 -t 7 -i docs/art-direction/velvet-siege/velvet-siege-full.mp4 -vf 'fps=12,scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4' docs/art-direction/velvet-siege/velvet-siege-teaser.gif
```

The intermediate `frames/` directory is excluded from git. Running without `--film` regenerates only the PNG review plates.

## Verification and limits

- Root type-check and lint passed.
- Webapp tests passed: 12 files, 137 tests, including finite movement, fixed wreck positions and final battle outcome.
- Webapp production build and SPA prerender passed; Vite generated the route tree.
- The full MP4 was decoded and its 36-second / 864-frame / 24-fps metadata checked.
- The existing combat-sandbox attack-bound test retains its checks and aggregates failures, avoiding tens of thousands of individual assertion calls.

Local browser interaction and browser frame rate have not been verified. The local Vite dev server encountered an environment `networkInterfaces` error. Full root database-backed integration tests were not run locally because the database is unavailable. The geometry and motion are deliberately reviewable prototype work; finished art quality and animation direction still require human judgment.

Recovery note: after the execution workspace was reset, the reviewed paths and timeline were reconstructed from retained source-writing tool inputs, and captures were regenerated. The reconstructed contact sheet was visually checked against the reviewed design.
