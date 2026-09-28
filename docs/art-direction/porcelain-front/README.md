# Porcelain Front

A new Blender art and animation lane for Hazard Pay: 49 articulated ceramic machines on a snow-covered basalt canal. Ivory lancers, cobalt mortars, bulwarks and a six-vane conductor confront vermilion furnace claws. All geometry, materials, hierarchy rigs, animation, lighting and camera work are original procedural authoring. No imported or generated image assets.

Open `/prototype-porcelain-front` for the film, five chapter controls and scene downloads. This is an editable prerender study, not a real-time browser 3D implementation.

## Encounter

| Time | Setpiece |
| --- | --- |
| 0–8 s | Articulated procession into the canal |
| 8–17 s | Three staggered mortar volleys with arcs, recoil and persistent fragments |
| 17–24 s | Shield-and-claw countercharge and fallen units |
| 24–30 s | The conductor's crown relay, travelling wavefronts and breakable central crossing |
| 30–36 s | Ranks reform around persistent casualties |

The scene timeline contains 864 frames at 24 fps. Rendering on twos produces 432 distinct frames at 12 fps; the delivered 24 fps film duplicates each rendered frame. This cadence is intentional and is not a 24-distinct-fps claim.

## Reproduce

Use Blender 4.5.3 and FFmpeg. The source defaults to EEVEE, 16 samples, 960×540, a fixed random seed and four threads. Build an editable scene and poster:

```sh
blender -b -t 4 --python docs/art-direction/porcelain-front/build_scene.py -- --output /tmp/porcelain-front --frame 467
```

Render all frames (or split the inclusive range 1–431 and 433–863 between two processes):

```sh
LP_NUM_THREADS=4 OMP_NUM_THREADS=4 blender -b /tmp/porcelain-front/porcelain-front.blend -t 4 --python docs/art-direction/porcelain-front/render_frames.py -- --output /tmp/porcelain-front/frames --start 1 --end 863
ffmpeg -y -framerate 12 -pattern_type glob -i '/tmp/porcelain-front/frames/frame_*.png' -vf fps=24 -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -movflags +faststart /tmp/porcelain-front/porcelain-front-full.mp4
```

Copy the scene and film to `apps/webapp/public/porcelain-front/`. Convert `art-frame-0467.png` to `poster.webp` in the same directory. Source is mirrored there so it can be downloaded from the prototype. Frame caches are intermediate output and should not be committed.

## Limits

This branch is an art-direction study, with authored choreography rather than simulation-driven combat. Mechanical object hierarchies provide the rigs; it does not claim skeletal character animation. Geometry is instanced across ranks. The preview is deliberately 540p; a production asset pipeline would need LODs, runtime materials, collision integration and a separate performance pass.
