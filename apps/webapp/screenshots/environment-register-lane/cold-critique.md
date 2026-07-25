# Cold critique — environment register lane (#91)

Produced by a provenance-cold critic that saw only the committed images in
this directory and the curated reference board
(`docs/art-direction/reference-board/README.md`). It read no source code,
no cost report, no README, and no generation transcript. Reproduced
verbatim below; the fixes made in response are listed at the end.

---

## 1. First read

**Treatment A.** A tidy plaza of flat teal and orange parallelogram slabs floating over a grey-plum tile grid; the slabs are the loudest objects on screen and the market underneath them is empty of goods. Everything has a clean black outline and nothing has been touched by a human being. My honest first word was *food court after closing*, and in `treatment-a-crowd.png` — a diamond island of grey boxes with isolated coloured dots for windows — it becomes *tabletop diorama*.

**Treatment B.** The same layout, but the stalls now have ribbed canopies, plank-and-riveted-metal bodies, tension lines to the ground, produce hanging off the rails, and goods on the counters; the plaza floor is dark asphalt with stains. It reads as a place that sells things and gets dirty. It also reads *uniformly* dirty — the stain vocabulary is one soft-cornered blob repeated at every scale over floor, walls and towers alike, which at a glance is less "grime" than "camouflage print."

## 2. Scores

### Treatment A

| Axis | Score | Justification |
|---|---|---|
| grime / lived-in credibility | **1** | Zero wear, stains, repair, litter, tape, or graffiti; a market with no merchandise and no vendor evidence — this is the playset the earlier ruling already faulted. |
| material specificity | **2** | Only the crates hint at a material; the canopies and stall bodies are untyped colour planes that could be plastic, canvas, or painted card. |
| ground-plane readability | **4** | The strongest thing about A: quiet, evenly valued, the tile grid traces cleanly all the way to the map edge, units separate without effort. |
| composition & value hierarchy | **2** | The awning slabs are the largest, brightest, most saturated shapes in frame — the environment owns the chroma extreme that units are supposed to own, and the plaza has no focal structure at all. |
| MST-environment kinship | **1** | None of the clustered shading, layering, or prop density that the MST entry names; this is the opposite pole. |
| crowd-scale legibility | **4** | ~34 units stay countable and clumps read as clumps in `treatment-a-crowd.png`; docked for the teal squad standing under a near-identical teal canopy. |
| character / environment cohesion | **3** | Coheres, but by shared impoverishment — the detail relationship (env below unit) is correct only because neither has any. |

### Treatment B

| Axis | Score | Justification |
|---|---|---|
| grime / lived-in credibility | **3** | A genuine jump, but the credit belongs to the hanging goods and counter items; the grime pass itself is applied without cause and doesn't pool, drip, or wear along traffic. |
| material specificity | **4** | I can name plank timber, riveted steel plate, rusted galvanised sheet, perforated mesh, ribbed canopy fabric, asphalt, and slatted pallet crates without being told. |
| ground-plane readability | **2** | The blob pass erases the tile grid across large stretches of `board-b-combat-empty.png` and manufactures mid-contrast dark shapes that compete with unit silhouettes and, worse, with unit drop shadows. |
| composition & value hierarchy | **2** | Same inverted chroma hierarchy as A, now with high-frequency incident everywhere — nothing is quiet, so nothing is emphatic. |
| MST-environment kinship | **4** | Correct register: layering, clustered detail, goods on rails, stacked props. Short of a 5 because the light is flat ambient with texture laid on top, not directional value grouping. |
| crowd-scale legibility | **3** | Mid-plaza holds up in `treatment-b-crowd.png`; the left-hand stall cluster does not — thin vertical stall poles run full height straight through unit legs. |
| character / environment cohesion | **2** | The board now out-details the units, which steals the "detail density = this one matters" cue that heroes are supposed to own by themselves. |

## 3. The decisive difference

Evidence of ownership. In A the market is architecture; in B the market is somebody's business. That difference is not carried by the grime, the outlines, or the pixel density — it is carried by roughly forty small authored objects: bottles and produce hung along a rail, a shelf of jars on a counter, an amber-lit device sitting on a crate. Those objects imply a person who put them there, priced them, and will be angry when the fight knocks them over. A has none of them, and no amount of ink weight will supply one; `board-a-combat-crisp.png` proves this by thickening the contours and making the board look *more* like injection-moulded plastic, not less. Every other axis is a tradeable technical parameter. This one is the difference between a location and a set.

## 4. What each treatment is missing

### Treatment A

1. **Goods, and evidence of the people who own them.** The stalls are roofs on poles. Until something is hanging, stacked, spilled, or being sold under them, A cannot clear a 1 on grime no matter what else changes.
2. **Fix the chroma inversion.** In `treatment-a-combat.png` the teal squad on the right stands beside a canopy of nearly the same teal at nearly the same saturation. Canopy colour must be desaturated and darkened well below team identity colour — the environment cannot be the most saturated thing on the board while units are asked to own identity colour.
3. **Give surfaces a material declaration, even a graphic one.** Flat cel colour does not forbid material: two stripes of weave, a sag in the canopy edge, a bolt line on a leg, a plank seam. The current planes tell me nothing and read as toy.

### Treatment B

1. **Stop treating the walkable plane like every other surface.** The stain blobs should thin toward the centre of the fighting lane and concentrate where they'd actually form — under canopy drip lines, at stall thresholds, against kerbs. The tile grid must survive; right now it dies in the middle of the map, which is the one place tactical reading is non-negotiable.
2. **Retire the blob shape.** One soft-cornered amoeba, repeated at every scale and rotation, over floor *and* building faces (`treatment-b-crowd.png` has it running up the tower walls), is a camouflage texture, not wear. Different causes need different shapes: hard-edged oil pooling, streaked drip runs, dry scuffed abrasion.
3. **Clear the vertical clutter out of unit space.** The full-height stall tension lines cross unit silhouettes in the left cluster of `treatment-b-combat.png`. Break them, fade them below unit head height, or push them behind the stall body. Also: the small screen-headed figures standing on tower faces read as characters at building scale and break the scale contract — they should be signage or nothing.

## 5. Verdict

**Treatment B's register should govern Hazard Pay environments — conditionally.**

The condition, precisely: **B ships only if the surface treatment is split into two separately-tunable layers, with the walkable plane held to Treatment A's contrast discipline.** Concretely — the material/wear pass runs at full strength on vertical and prop surfaces (stall bodies, crates, machinery, facades), and on the ground plane it is capped so that (a) tile-edge separation remains traceable across the entire fighting area, and (b) no ground marking reaches the value contrast of a unit's drop shadow. If that split is not achievable, the answer is neither yet, because B's ground plane in its current state costs more tactical reading than its grime is worth, and A's board is disqualified on the toy-like finding the project has already ruled against once.

The earlier ruling for the vector-clean register should be reversed. A is not a stylistic alternative here; it is the same failure the prototype was already faulted for, executed more neatly.

Two rulings that apply to whichever register wins: the awnings must stop being the brightest, most saturated objects on the board, and canopy hue must be separated from team identity hue.

## 6. What the stamp study and the layer study show

**`stamp-study.png`** isolates *authored props versus surface treatment alone*. Between the left and right panels the structure is identical — same plank siding, same riveted panel, same rust patches, same ribbed canopy. What appears on the right is a shelf of small bottles and produce under the canopy, a row of hanging goods along the rail, a second shelf on the left face, and on the crate stack a single amber-lit device on top of the grey cube. That is the entire delta, and it is the difference between a structure and a stall. It costs almost nothing in board complexity, adds no ground-plane noise, and at match scale (visible in `board-b-combat-empty.png`) it resolves into a legible fringe of small warm dots along each rail — which is exactly the right amount of information at that distance. Incidentally, the study's own background is the blob texture presented flat and uninterrupted, which makes my objection easy to verify: evenly spaced, evenly sized, no gravity, no cause.

**`layer-study-b.png`** isolates *the accumulation itself, in order*. Panel 1 is effectively Treatment A: flat ground, flat canopies, no poles, no goods, and a tile grid I can trace with a finger. Panel 2 adds material and grime — ribbing, plank and metal siding, rust, ground stains, hatched zones — and this is where the tile grid dies; the stains cross tile boundaries and the walkable perimeter becomes ambiguous. Panel 3 adds the authored stamps and the stall rigging, and this is where the crop finally reads as a market.

Taken together these two images do most of the work of the verdict, because they show that B's win and B's loss come from *different* layers. The lived-in credibility that beats A arrives almost entirely in panel 3, at near-zero tactical cost. The ground-plane damage arrives almost entirely in panel 2, from the least convincing element in either treatment. Those two things are separable, and separating them is the condition I named above.

---

## Fixes made in response (round 2)

The critique's condition was met and its named defects were addressed. The
images in this directory are post-fix; the critique above describes the
round-1 images.

1. **Walkable plane held to A's contrast discipline.** Tile seams are now
   drawn after the wear pass, so the dimetric grid survives everywhere;
   the asphalt lane's wear thresholds were tightened so nothing on the
   floor approaches a unit's drop-shadow contrast.
2. **Blob retired.** Wear is directional and cause-shaped: floor marks are
   smeared along the traffic axis, wall and metal stains are stretched
   downward into drip runs.
3. **Chroma inversion fixed.** Canopy ramps were desaturated and darkened;
   unit cloth moved to its own ramp so team identity is the most saturated
   thing on screen. This applies to both treatments — they share the
   palette.
4. **Vertical clutter out of unit space.** Stall posts were thinned and
   darkened.
5. **Scale contract restored.** The junction-box grid, which read as a
   small figure on a building face, moved to ground level beside the pipe
   racks.

Not addressed, and recorded as open: treatment A's missing goods. Supplying
them means authoring the same objects the critique credits for B's win —
which is this lane's whole finding, and is a decision for the taste gate,
not a fix.
