# Programmatic pixel-art authoring & sprite-sheet formats for the agent-artist kit

- **Date:** 2026-07-22
- **Question:** Which free/OSS programmatic pixel-art authoring approaches and tools should the artist kit build on, and which sprite-sheet/atlas format should assets ship in? (#65, part of map #64)
- **Context:** The artist is a **coding agent**, not a human — every candidate is weighed for scriptability, determinism, plain-file source formats, Node testability, and zero GUI dependence. Consumer is PixiJS v8 in the webapp match view via `Assets.load` + `Spritesheet` (the seam documented in `apps/webapp/src/match-proto/sprites.ts`, refs #26/#27). Map constraints: free/local/programmatic only; no paid APIs or licenses; direct image-model generation ruled out. Current state: characters are text grids (one char per pixel + palette) compiled to RGBA buffers in pure Node.
- **Method:** Primary sources only — official docs, GitHub repos, npm registry/downloads API. Versions checked 2026-07-22: sharp 0.35.3, pngjs 7.0.0, jimp 1.6.1, @resvg/resvg-js 2.6.2, free-tex-packer-core 0.3.8, image-q 4.0.0, pixelmatch 7.2.0, Aseprite v1.3.17.2, LibreSprite v1.1, Pixelorama v1.1.10.

---

## 1. Cross-cutting: what the consumer actually requires

The format target is fixed by PixiJS v8, so it anchors everything else.

- **`Assets.load('sheet.json')` fetches the JSON, loads the referenced atlas image, and calls `Spritesheet.parse()` automatically**; `sheet.textures[name]` feeds `Sprite`, `sheet.animations[name]` feeds `AnimatedSprite` ([Spritesheet API](https://pixijs.download/v8.0.0/docs/assets.Spritesheet.html); [sprite-sheet guide](https://pixijs.io/guides/basics/sprite-sheets.html)).
- **The JSON shape is small and fully documented** ([official PixiJS assets reference](https://github.com/pixijs/pixijs-skills/blob/main/skills/pixijs-assets/references/spritesheet.md)): `frames` (per-frame `frame` x/y/w/h, `rotated`, `trimmed`, `spriteSourceSize`, `sourceSize`, optional `anchor` and 9-slice `borders`), `animations` (name → ordered array of frame names), `meta` (`image`, `size`, `scale` — which "directly sets the texture source resolution" — and `related_multi_packs` for multi-atlas loading).
- **Per-frame durations are not part of the atlas format** — `animations` arrays play at a uniform `animationSpeed`. Non-uniform timing goes through `AnimatedSprite`'s `FrameObject` form: `{ texture, time }` in milliseconds ([AnimatedSprite API](https://pixijs.download/dev/docs/scene.AnimatedSprite.html)). Any per-frame-duration source (e.g. Aseprite's `duration` field) needs a ~10-line mapping to `FrameObject[]`, not a format change.
- **The docs name TexturePacker, Shoebox, and spritesheet.js as producers**, and note that default anchors, 9-slice borders, and animation grouping are "currently only supported by TexturePacker" ([Spritesheet API](https://pixijs.download/v8.0.0/docs/assets.Spritesheet.html)) — i.e. the *keys* are open and documented; only the GUI tools that emit them are proprietary. Nothing stops us emitting every key ourselves.

**Agent-fit criteria applied to every candidate below:** (1) drivable from a script with no GUI; (2) deterministic output (same input → same bytes, or at least same pixels); (3) source-of-truth in a plain diffable text format; (4) testable in plain Node; (5) free/local, no license or cloud dependency.

## 2. Candidates — programmatic authoring approaches

### 2.1 Text grids + in-repo compiler (the incumbent, extended)

The `sprites.ts` pattern — one char per pixel, `.` transparent, per-character palette, compiled to RGBA — already scores maximum on every agent-fit criterion: the source is a diffable text file the agent reads and writes natively, the compiler is ~40 lines of dependency-free TS, validation (row/column counts, palette coverage) is unit-tested in Node, and output is bit-deterministic. What it lacks today is only the *shipping* half: nothing packs frames into a PNG atlas or emits the Pixi JSON. That half is small: grid-pack N same-size frames into one sheet (no maxrects needed at 12×16-per-frame scale), encode with pngjs (§2.2), and hand-emit the documented JSON of §1 — `animations` included, which puts us ahead of most OSS exporters (§3). Frame *diffing* is also natural here: two frames of the same character diff as text, and the agent can see exactly which pixels a new animation frame changes before any raster exists.

Honest limitations: one-char-per-pixel caps palettes at ~90 printable chars per character (a non-issue at this art scale); grids get unwieldy above roughly 64×64 (a 32×32 frame is 32 lines — fine; a 320×180 environment is not); and there is no built-in notion of layers/onion-skinning — the agent's "preview" is a rendered PNG it screenshots or a scaled-up export it reads back.

### 2.2 Node image libraries (the compile/preview substrate)

- **sharp 0.35.3** (Apache-2.0; 74.3M weekly downloads — [npm downloads API](https://api.npmjs.org/downloads/point/last-week/sharp)): accepts raw RGBA input via `raw: { width, height, channels }` — a perfect match for `frameToRgba` buffers — composites, and resizes with `kernel: 'nearest'` for crisp integer upscales of previews ([constructor docs](https://sharp.pixelplumbing.com/api-constructor/); [resize docs](https://sharp.pixelplumbing.com/api-resize/)). Also rasterizes SVG via libvips with a `density` option ([constructor docs](https://sharp.pixelplumbing.com/api-constructor/)). It ships native binaries — deterministic per platform+version, but not guaranteed byte-identical across platforms, so prefer it for previews/upscales rather than the committed-asset emit path.
- **pngjs 7.0.0** (MIT; 47.1M weekly; **zero dependencies**, pure JS — [npm](https://registry.npmjs.org/pngjs/latest)): PNG encode/decode on plain buffers. Pure JS + pinned version = reproducible committed atlas bytes on any machine. The natural emit path for the compiler, and the standard decode partner for pixelmatch (§4).
- **jimp 1.6.1** (MIT; 3.4M weekly; pure JS — [npm](https://registry.npmjs.org/jimp/latest)): full image toolkit without native deps; its `@jimp/diff` plugin wraps pixel diffing. Viable pngjs+sharp substitute if we want one dependency instead of two; less used than either.
- **pureimage** (69k weekly — [downloads API](https://api.npmjs.org/downloads/point/last-week/pureimage)) and **node-canvas**: a pure-JS Canvas 2D and a native Canvas 2D respectively. Neither adds anything over the above for grid compilation; node-canvas adds native build friction for nothing.

### 2.3 SVG → raster

**@resvg/resvg-js 2.6.2** (MPL-2.0; 2.2M weekly): Rust resvg behind napi-rs, zero JS dependencies, WASM fallback, `new Resvg(svg, opts).render()` → PNG ([repo](https://github.com/yisibl/resvg-js)). Deterministic and fully local. Caveats: last release March 2024 — the Node-binding layer's cadence has stalled even though upstream resvg is alive; and at 12×16 the approach fights itself — anti-aliased vector rasterization is the opposite of placing individual pixels, so it only makes sense where art is bigger (environment/overworld panels) and even then needs `shape-rendering: crispEdges`-style discipline plus a quantization pass (§2.5) to stay on-palette. sharp's libvips SVG path (§2.2) covers the same lane with a maintained library. Verdict: a plausible *second lane* for large art, not a sprite-authoring tool.

### 2.4 Procedural generators

**pixel-sprite-generator** (MIT, 618 stars, 25 commits total, effectively unmaintained — [repo](https://github.com/zfedoran/pixel-sprite-generator)) generates sprites by randomizing and mirroring a 2D mask. Fun, but it produces *random* spaceship-shaped noise — the opposite of the map's requirement for on-direction, art-directed characters (Direction B "Street-Tech / Grime Market"). Same verdict for the genre generally: procedural generation replaces the agent's judgment, which is the one thing the kit is built around. Not a candidate; at most a mask-symmetry *technique* (mirror-half authoring) worth stealing into the grid compiler.

### 2.5 Palette / dither libraries

**image-q 4.0.0** (MIT; pure TS, no runtime deps; 3.5M weekly — [npm](https://registry.npmjs.org/image-q/latest)): color quantization and dithering in Node. Not needed while sources are palette-first text grids (the palette is enforced by construction), but it is the right tool the moment any raster enters the pipeline from a non-grid lane (SVG rasterization, screenshots reworked into assets): quantize to the shared roster palette and *mechanically verify* no off-palette pixels — a natural CI check for the verification loop.

### 2.6 Scriptable OSS pixel editors

- **Aseprite v1.3.17.2** — the industry benchmark and genuinely CLI-first: `-b` batch mode, `--sheet` + `--data` with `--format json-hash|json-array`, `--split-layers`, `--tag`, `--list-tags`, Lua `--script` with `--script-param` ([CLI docs](https://www.aseprite.org/docs/cli/)). Actively developed (127 releases; latest April 2026 — [repo](https://github.com/aseprite/aseprite)). The blocker is licensing: source-available under a proprietary EULA — binaries are paid, redistribution of compiled binaries is forbidden, and self-compiling (a C++/Skia build) is permitted for personal use only ([repo](https://github.com/aseprite/aseprite)). Under the map's "no paid licenses" constraint this sits in a gray zone at best, and the `.aseprite` binary project format is a poor source-of-truth for an agent regardless (opaque to diff, needs the tool to read). Its JSON export also isn't Pixi-ready as-is: animation tags land as `meta.frameTags` (`name`/`from`/`to`/`direction`) plus per-frame `duration`, not as the `animations` key Pixi parses ([aseprite/docs cli.md](https://github.com/aseprite/docs/blob/main/cli.md); [issue #1514](https://github.com/aseprite/aseprite/issues/1514)) — an adapter is needed either way.
- **LibreSprite v1.1** (GPLv2 fork of Aseprite's last GPL commit): scripting is JavaScript but **in-app only** — the documented API is built around the active document/UI, with no headless or CLI batch mode documented ([SCRIPTING.md](https://github.com/LibreSprite/LibreSprite/blob/master/SCRIPTING.md)); last release December 2023 ([repo](https://github.com/LibreSprite/LibreSprite)). No agent story.
- **Pixelorama v1.1.10** (MIT, Godot 4, active — 42 releases, latest April 2026 — [repo](https://github.com/Orama-Interactive/Pixelorama)): the strongest OSS editor surprise — a real headless CLI (`--headless`, `--export`, `--spritesheet`, `--json`, `--split-layers`, `--scale`, `--frames` — [CLI docs](https://pixelorama.org/user_manual/cli/)). But it exports *from `.pxo` project files*, which the agent would have to author blind (a binary-ish project format, not a plain-file source), its `--json` output is its own format with no documented Pixi/TexturePacker compatibility, and running it means shipping a Godot binary in the toolchain. As an *export backend* it works; as an *authoring surface for an agent* it inverts the plain-file criterion.

## 3. Sprite-sheet/atlas formats and what OSS can emit

| Producer | Emits Pixi `frames`? | Emits `animations`? | Per-frame timing | License / local? | Agent verdict |
|---|---|---|---|---|---|
| In-repo compiler (grids → pngjs + hand-emitted JSON) | yes — the format is documented (§1) | yes — trivially, from grid frame arrays | via `FrameObject` mapping we control | MIT-ish (ours), fully local | exact fit |
| free-tex-packer-core 0.3.8 | yes — dedicated Pixi exporter (JSON hash) among many (Phaser 3, Godot, Spine…), plus custom Mustache templates | no animation grouping | no | MIT, local (see caveat) | good packer, thin format brain |
| Aseprite CLI `--data` | close — same frame keys (`frame`, `rotated`, `trimmed`, `spriteSourceSize`, `sourceSize`) | no — tags are `meta.frameTags` | yes — per-frame `duration` (needs `FrameObject` adapter) | proprietary EULA | best tooling, license gray zone |
| Pixelorama `--json` | undocumented, own format | undocumented | n/a | MIT, local | export backend only |
| spritesheet.js | yes (listed by Pixi docs) | no | no | MIT but ~1k weekly downloads, stale | skip |
| TexturePacker | yes — reference implementation (anchors, 9-slice, animation grouping) | yes | no | **paid** | ruled out by map constraint |

Notes:

- **free-tex-packer-core** ([repo](https://github.com/odrick/free-tex-packer-core); 12.6k weekly downloads) is the one credible OSS packer: MIT, pure Node API (path+buffer in, files out), maxrects packing with trim/rotation/duplicate detection. Two caveats: it does not emit the `animations` key (we'd post-process the JSON, at which point we're most of the way to emitting it ourselves), and its dependency list includes `tinify` — the TinyPNG **cloud** API — which must simply stay unconfigured to honor the local-only constraint ([npm](https://registry.npmjs.org/free-tex-packer-core/latest)).
- **Multi-pack and scale are ours to control**: `meta.scale` mismatches silently render sprites at the wrong size, and `related_multi_packs` chains atlases ([PixiJS assets reference](https://github.com/pixijs/pixijs-skills/blob/main/skills/pixijs-assets/references/spritesheet.md)) — both easier to get right in a compiler we own than to audit in third-party output.
- **`Spritesheet` can also be constructed manually** (`new Spritesheet(texture, data)` then `parse()`), so the compiler's JSON is directly unit-testable against the real parser in a browser test, and the current no-asset RGBA path stays available for prototypes ([Spritesheet API](https://pixijs.download/v8.0.0/docs/assets.Spritesheet.html)).

## 4. Animation-relevant capabilities

- **Frame management:** in the grid approach, frames are entries in an array in a text file — add/remove/reorder is a text edit; ordering is explicit and reviewable in a PR diff. Aseprite is the only surveyed tool with richer frame semantics (tags with direction, per-frame durations, layers/cels); Pixelorama has frames/tags in-app but nothing an agent can reach except whole-project export.
- **Tagging:** the Pixi `animations` key *is* the tag system the renderer sees (name → frame list). The compiler emits it directly from named frame groups in the source spec. Aseprite `frameTags` map onto it 1:1 via `from`/`to` ranges if that lane ever opens.
- **Timing:** uniform-rate loops (idle flicker) need nothing beyond `animationSpeed`; anything with hold frames (attack anticipation) needs the `FrameObject` `{ texture, time }` path (§1) — worth building into the kit's loader from day one so the atlas format never has to change.
- **Diffing / verification:** **pixelmatch 7.2.0** (ISC, zero-dependency, ~8.7M weekly downloads — [repo](https://github.com/mapbox/pixelmatch); [downloads API](https://api.npmjs.org/downloads/point/last-week/pixelmatch)) with pngjs decode is the standard Node pixel-diff loop: compare compiled frames against committed baselines, quantify what an edit changed, and gate CI on unexpected pixel churn. Text-grid sources additionally diff as *text* — the agent (and the human reviewer) sees per-pixel changes in the PR itself, before any raster exists. This double-diff (text diff for review, pixel diff for CI) is unique to the grid approach; every raster-source tool only gets the second half.

## 5. Recommendation (ranked)

1. **Extend the text-grid pattern into the kit's canonical source format, and build the small in-repo compiler that emits packed PNG (pngjs) + hand-written Pixi spritesheet JSON (`frames` + `animations`, `FrameObject` durations supported).** It is the only candidate that maximizes every agent-fit criterion at once: plain diffable source the agent authors natively, bit-deterministic pure-JS output (pngjs, zero deps, pinned), Node-tested end to end with no GUI or native toolchain, and full ownership of the exact keys Pixi documents — including `animations`, which no OSS exporter emits. The format's documented smallness (§1) makes "just emit it" cheaper than adapting any third-party output.
2. **sharp as the preview/upscale substrate** (raw RGBA in, `kernel: 'nearest'` integer upscales out) for the verification loop's human- and agent-readable renders — kept out of the committed-asset path so cross-platform byte determinism rests on pngjs alone.
3. **pixelmatch + pngjs (and image-q when rasters enter from elsewhere) as the kit's mechanical-check layer**: baseline pixel diffs in CI, palette-conformance checks — the "mechanical checks" half of the map's verification note.
4. **free-tex-packer-core as the packing upgrade path**, adopted only when frame geometry outgrows naive grid packing (mixed sizes, trimming/rotation worth having) — MIT, Node-native, Pixi exporter; post-process its JSON to add `animations`, keep `tinify` off.
5. **SVG→raster (sharp/libvips first, resvg-js second) as a second lane for large art** (match environment, overworld panels) — deterministic and local, but unproven for on-palette pixel fidelity; requires an image-q quantization gate and must be validated before the kit commits to it.
6. **Aseprite CLI** — the best animation tooling surveyed (batch export, tags, durations, Lua scripting), but paid-or-self-compiled under a proprietary EULA, with a binary project format and a frameTags→animations adapter needed anyway. Only worth revisiting if human-artist interop becomes a requirement.
7. **Pixelorama** — healthy, MIT, real headless CLI, but authoring means generating `.pxo` projects blind and its JSON is not Pixi-shaped; wrong seam for an agent author. **LibreSprite** (no headless mode, stale) and **procedural generators** (randomness replaces direction) are ruled out.

**Kit shape this implies:** character sources live as text-grid spec files (grids + palette + named animation groups + optional per-frame ms) next to the code; a `compile` script emits `sheet.png` + `sheet.json` consumed verbatim by `Assets.load`; tests assert grid validity in Node, JSON-vs-`Spritesheet.parse` in the browser suite, and pixelmatch baselines in CI; sharp renders ×8 previews for PR galleries per the map's presentation norm.

## 6. Revisit triggers

- **Art outgrows grids** — frames beyond ~64×64 or environment-scale panels make one-char-per-pixel files unwieldy: activate the SVG→raster lane (rank 5) and validate its quantization gate, or split formats by asset class.
- **Frame geometry diversifies** — mixed frame sizes or enough waste that trimming/rotation pays: swap naive grid packing for free-tex-packer-core (rank 4) behind the same JSON emitter.
- **A human artist joins the loop** — GUI interop becomes a requirement: re-open Aseprite (license question and all) with the frameTags→animations adapter; Pixelorama becomes interesting again as the FOSS GUI whose exports the kit ingests.
- **TexturePacker-only features become load-bearing** — default anchors or 9-slice `borders` needed at scale: emit them from the compiler (documented keys, §1) before reaching for any external packer.
- **Byte-determinism breaks in practice** — if pngjs output ever varies across environments (zlib/version drift), pin harder or move CI equality from bytes to pixelmatch-zero-diff.
- **resvg-js stays frozen** — Node-binding release cadence has been stalled since March 2024; if the SVG lane is activated and it hasn't moved, standardize on sharp's libvips SVG path instead.
- **Roster scale exposes palette drift** — many units sharing Direction B palettes: promote image-q palette conformance from spot-check to a required CI gate, and centralize palettes as shared kit data.

---

## Source index

- PixiJS: https://pixijs.download/v8.0.0/docs/assets.Spritesheet.html · https://pixijs.download/dev/docs/scene.AnimatedSprite.html · https://pixijs.io/guides/basics/sprite-sheets.html · https://github.com/pixijs/pixijs-skills/blob/main/skills/pixijs-assets/references/spritesheet.md
- Node image libs: https://sharp.pixelplumbing.com/api-constructor/ · https://sharp.pixelplumbing.com/api-resize/ · https://registry.npmjs.org/sharp/latest · https://registry.npmjs.org/pngjs/latest · https://registry.npmjs.org/jimp/latest · https://api.npmjs.org/downloads/point/last-week/sharp · https://api.npmjs.org/downloads/point/last-week/pngjs · https://api.npmjs.org/downloads/point/last-week/jimp · https://api.npmjs.org/downloads/point/last-week/pureimage
- SVG→raster: https://github.com/yisibl/resvg-js · https://registry.npmjs.org/@resvg/resvg-js/latest · https://api.npmjs.org/downloads/point/last-week/@resvg/resvg-js
- Packers: https://github.com/odrick/free-tex-packer-core · https://registry.npmjs.org/free-tex-packer-core/latest · https://api.npmjs.org/downloads/point/last-week/free-tex-packer-core · https://api.npmjs.org/downloads/point/last-week/spritesheet-js · https://api.npmjs.org/downloads/point/last-week/spritesmith
- Editors: https://www.aseprite.org/docs/cli/ · https://github.com/aseprite/aseprite · https://github.com/aseprite/docs/blob/main/cli.md · https://github.com/aseprite/aseprite/issues/1514 · https://github.com/LibreSprite/LibreSprite · https://github.com/LibreSprite/LibreSprite/blob/master/SCRIPTING.md · https://github.com/Orama-Interactive/Pixelorama · https://pixelorama.org/user_manual/cli/
- Diff/palette: https://github.com/mapbox/pixelmatch · https://api.npmjs.org/downloads/point/last-week/pixelmatch · https://registry.npmjs.org/image-q/latest · https://api.npmjs.org/downloads/point/last-week/image-q
- Procedural: https://github.com/zfedoran/pixel-sprite-generator
