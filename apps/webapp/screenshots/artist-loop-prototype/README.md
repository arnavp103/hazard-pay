# Artist inner-loop prototype

Throwaway evidence for the question in [Wayfinder ticket 67](https://github.com/arnavp103/hazard-pay/issues/67): can a cold critic, shown only rendered artifacts and Direction B references, discriminate on-direction work from planted faults?

## Run it

Start the existing match route with:

```sh
pnpm --filter @hazard-pay/webapp dev --host 127.0.0.1
```

Open `/match-proto?variant=A` and use the floating arrows or keyboard left/right keys to move through A–E. Add `capture=1` to hide the switcher.

## Capture path

The prototype forces PixiJS to WebGL. Captures use `agent-browser` with ANGLE's SwiftShader software backend:

```sh
agent-browser --session artist-loop-67 \
  --args '--use-angle=swiftshader,--enable-unsafe-swiftshader' \
  open 'http://127.0.0.1:5173/match-proto?variant=A&capture=1'
agent-browser --session artist-loop-67 set viewport 1000 650
agent-browser --session artist-loop-67 wait --text 'RENDER LOOP LIVE'
agent-browser --session artist-loop-67 screenshot variant-a.png
```

The live WebGL debug extension reported `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device …), SwiftShader driver)` during capture. This makes software WebGL the pinned headless path for the proposed harness; WebGPU is not needed for asset screenshots.

## Sealed plant manifest

This manifest was withheld from the cold critic until after its first verdict.

| Variant | Plant |
| --- | --- |
| A — Plum Relay | On-direction control: Direction B plum, magenta, acid, ink contours, hazard marks, restrained lights. |
| B — Rust Circuit | On-direction control: allowed rust/slate/teal palette experiment with the same value hierarchy and contour language. |
| C — Ultraviolet Rain | Wrong palette ramp: blue/purple midtones and saturated neon compete across the whole environment. |
| D — Soft Signal | Missing contour/value discipline: outlines collapse into the environment and the scene loses separation. |
| E — Hex Exchange | Off-world vocabulary: otherwise on-direction rendering carries literal runes, a cross-like shield, and a sword. |

## Regeneration pass

The [round-one cold critique](cold-critique-round-1.md) exposed a shared placeholder-anatomy confound and misread the abstract medieval plant as valid technofantasy. `round-2/` applies the critic's smallest common fix—distinct courier and armored-enforcer silhouettes, stronger cel-shaded separations, and more material marks—to every variant while preserving the palette, contour, and world-vocabulary plants.

The [fresh round-two critique](cold-critique-round-2.md) again caught the palette and contour faults, but passed the world-vocabulary plant. The repeated result does not clear the ticket's reliable-separation proof bar.
