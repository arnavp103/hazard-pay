# Cold critique — pixel-control lane (commit e9b92f0)

> Advisory only — the human taste gate on #69 rules. The critic saw the
> committed captures at commit `e9b92f0` and the reference board README,
> never the generation transcript.

## Axis verdicts

**1. Gritty / lived-in vs toy-like — BORDERLINE.** The character passes cleanly: muted sage hazmat suit, respirator snout with a teal pip, orange-tinted visor slit, a stain/wear cluster at the jacket hem, believable adult proportions (head roughly 1:5.5 of a ~59px figure — not block-figure). The board drags it down: rounded-corner slab volumes and floating diamond decals with immaculate flat fills read as graphic staging, not a place anyone bled on; only the grain overlay, vignette, and hazard-orange chevrons keep it out of playset territory.

**2. Silhouette + equipment readability at combat zoom — BORDERLINE.** At the true 1× still the unit reads instantly — the hooded hunch pops as a mid-value mass against the dark plum floor, and the rust pack sliver plus a thin tool protrusion register. But the medic identity is facing-dependent: the white cross is unambiguous only from the back facing, and the injector vanishes entirely in the front and back facings (visible in the turn frames — front facing has empty hands). Right now the HUD label is doing identification work the sprite should do.

**3. Material separation — BORDERLINE.** Separation exists as hue/value blocks: sage jacket vs. blue-grey pants vs. black boots vs. rust pack vs. grey tool with cyan emission pips. What's missing is a specular language — the tool has no white glint distinct from its cyan glow, so metal and emission blur into one 4-pixel cluster; hood, jacket, and sleeves read as a single rubberized material with no texture break; the pack could be canvas, plastic, or painted tin.

**4. Character/environment cohesion — BORDERLINE.** The good: everything sits on one pixel grid (environment diagonals stair-step at the same 1× resolution), outline language is shared dark ink, and palette roles are disciplined — plum-black field, character-local rust/cyan accents, chartreuse confined to the HUD exactly as the Direction B anchor demands. The float: the sprite is the only fine-pixel object in the scene — every environment surface is a giant flat facet, so the medic reads as a sprite laid on a poster; the diagonal light shaft passes directly behind the unit without touching its shading.

**5. Motion readability — BORDERLINE.** Idle: pass — a 1px arm/tool bob and hood shift, alive without flicker, though it is breathing at the minimum detectable amplitude. Turn: pass — the pan snaps through four facings with fully consistent identity (hood, strap, pack, cross), no teleport artifacts, sprite stays pixel-crisp. Attack: fail — across all six frames the torso, head, and legs are pixel-identical; only the forearm swivels. There is a technically correct micro-arc (pull-back, extension, 2px tip sparkle, recovery) but it is invisible as an *event* at 1×; the silhouette never changes.

**6. Deliberate pixel art vs noisy illustration — PASS.** At 6× the authoring is in control: clean 1px ink contour, flat cel clusters, restrained anti-aliasing on the hood's inner edge, no banding, no orphan-pixel mush. The only ambiguous cluster is the injector itself (grey + cyan + white fighting inside ~8px). The floor's uniform single-pixel grain is a post-process texture rather than placed clusters, but it stays subordinate.

## Overall read

This lane has found the right register. The medic sits exactly where the Quasimorph anchor points: a fine-pixel, 1:1-scale figure that carries identity through silhouette, stance, and local material palette instead of chunky magnified pixels — and it does so without inheriting Quasimorph's brown-grey oppression, because the Direction B palette roles are genuinely well handled. The four-facing consistency is real production evidence, not a lucky still: the pack, strap, visor, and hood survive every rotation, and the back facing's cross is the best single identity read in the set. Nothing here is cheerful, chibi, or toyetic. As a *drawing* lane, I would stake on it.

As an *acting* lane, not yet. The single biggest risk is that the attack reveals a mannequin: a completely static body with a rotating forearm. Every animation reference this project has selected — Warped City's pose vocabulary, Katana ZERO's punctuation, Magic Pack 9's anticipation/expansion/impact — is about the silhouette changing shape under force, and this attack changes roughly six pixels. If the lane's animation method can only move an attachment point, combat will read as lifeless no matter how good the stills are, and that failure compounds across every unit. The idle's neutral parallel-leg stance points the same direction: correct pixels, no attitude. The secondary risk is the board — it is still the "flat stage" the match-proto anchor explicitly says not to inherit, dressed in Direction B decals.

Strongest single asset: the character's density-and-palette discipline — a 48×64 figure whose identity, contour, and local accents survive 1× from four sides while respecting the world's color roles. That is the hard part, and it is done.

## Improvement notes

1. **Make the attack change the silhouette.** Anticipation: shift the torso 1px back and dip the hood 1px. Extension: step the front foot 2px forward and lean the torso 1px into the thrust. Impact: expand the tip emission to a 3–4px cyan flash cluster (or a 2px smear along the thrust line) and hold the extended pose for 2 frames as hit-pause. The body must participate, not just the forearm.
2. **Put the kit on every facing.** Front and back facings currently have empty hands — give each 2–3 pixels of injector in the right hand, and add a white-cross pip to the front chest strap so "medic" reads from all four sides without the HUD caption.
3. **Give the stance attitude.** Offset one foot 2px, drop one shoulder 1px, and let the spine curve into the hood's hunch. The current parallel-leg, plumb-vertical stand is the one paper-doll tell in an otherwise credible figure; Warped City's idles are asymmetric even at rest.
4. **Separate metal from glow on the tool.** Place a single white specular pixel adjacent to (not inside) the cyan emission pips, and darken the tool's underside by one step — that alone will split "machined object" from "energy" at this scale. Add 2 edge-lit pixels on the boot toes to break the suit's single-material read.
5. **Weather the board at the sprite's register.** Cracked-seam pixels along a few grid lines, scuffed edges on the diamond decals, and litter dashes near the character's plane would stop the medic being the only fine-detail object on a vector-clean stage — keep the graphic shapes, dirty their edges.
