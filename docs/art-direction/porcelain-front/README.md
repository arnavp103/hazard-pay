# Porcelain Front

A new Blender art and animation lane for Hazard Pay: 49 articulated ceramic machines on a snow-covered basalt canal. Ivory lancers, cobalt mortars, bulwarks and a six-vane conductor confront vermilion furnace claws. All geometry, materials, hierarchy rigs, animation, lighting and camera work are original procedural authoring. No imported or generated image assets.

Open `/prototype-porcelain-front` for the film and five chapter controls. The original authoring script builds an editable Blender scene. This is an editable prerender study, not a real-time browser 3D implementation.

## Encounter

| Time | Setpiece |
| --- | --- |
| 0–8 s | Articulated procession into the canal |
| 8–17 s | Three staggered mortar volleys with arcs, recoil and persistent fragments |
| 17–24 s | Shield-and-claw countercharge and fallen units |
| 24–30 s | The conductor's crown relay, travelling wavefronts and breakable central crossing |
| 30–36 s | Ranks reform around persistent casualties |

The scene timeline contains 864 frames at 24 fps. Rendering on twos produces 432 distinct frames at 12 fps; the 24 fps quality master duplicates each rendered frame. The compact WebM chapters retain the native 12 fps. This cadence is intentional and is not a 24-distinct-fps claim.

## Reproduce

Use Blender 4.5.3 and FFmpeg. The scene source defaults to EEVEE, 16 samples, 960×540, a fixed random seed and four threads. The full film uses the render helper’s 8-sample 768×432 settings; browser chapters are compressed to 576×324. Build an editable scene and poster:

```sh
blender -b -t 4 --python docs/art-direction/porcelain-front/build_scene.py -- --output /tmp/porcelain-front --frame 467
```

Render all frames (or split the inclusive range 1–431 and 433–863 between two processes):

```sh
LP_NUM_THREADS=4 OMP_NUM_THREADS=4 blender -b /tmp/porcelain-front/porcelain-front.blend -t 4 --python docs/art-direction/porcelain-front/render_frames.py -- --output /tmp/porcelain-front/frames --start 1 --end 863
ffmpeg -y -framerate 12 -pattern_type glob -i '/tmp/porcelain-front/frames/frame_*.png' -vf fps=24 -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -movflags +faststart /tmp/porcelain-front/porcelain-front-full.mp4
```

The complete 768×432 master and editable scene accompany the review as separate files. Five compact WebM chapters are committed to `apps/webapp/public/porcelain-front/` for immediate playback. They join at 8, 17, 24 and 30 seconds; chapter switching can produce a brief browser decoding pause. Source is mirrored there so it can be downloaded from the prototype. Frame caches are intermediate output and should not be committed.

Run `python3 docs/art-direction/porcelain-front/encode_film.py /tmp/porcelain-front/frames /tmp/porcelain-front` to encode the master and all five chapters. Copy `chapter-*.webm` into the public directory. The encoder checks for all 432 input frames and uses two-pass VP9 for compact, complete clips.

## Limits

This branch is an art-direction study, with authored choreography rather than simulation-driven combat. Mechanical object hierarchies provide the rigs; it does not claim skeletal character animation. Geometry is instanced across ranks. The film master is deliberately 432p and the compact player is 324p; residual EEVEE sampling grain and video compression remain visible. A higher-quality 540p poster is included. A production asset pipeline would need LODs, runtime materials, collision integration and a separate performance pass.
