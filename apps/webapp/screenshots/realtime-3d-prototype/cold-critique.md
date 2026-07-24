# Cold critique — real-time 3D lane captures

**Provenance:** I judged only the six committed captures downloaded to `/tmp/cold-critique/` (two stills, four GIFs, decomposed to frames via ffmpeg) and the reference board at `docs/art-direction/reference-board/` (README plus its anchor images). No source, PRs, issues, or branches were consulted.

---

## 1. Gritty / dangerous / lived-in vs toy-like — **3/5**

The mood layer is doing real work: the board sits in a muted plum-dark field anchored by near-black ink shadows, a diagonal light shaft crosses the mid-board, overhead cable lines cut the top of frame, there is a floor hazard chevron mid-stage, and a fine film grain rides over everything. Measured on a 480×270 frame, ~88% of pixels are muted, ~12% carry saturated identity color, ~1% is emission — the 70/25/5 budget is respected with room to spare. That is the opposite of toyetic brightness, and it is a large step past the block-figure match-proto anchor.

But the *surfaces* are still a clean playset. At 4× the stall closeup shows perfectly beveled boxes with zero history: no stains, chips, decals, litter, puddles, or signage — the market stalls are empty crates with one teal strip and two orange smears standing in for goods. Worse, the entire ground plane carries a faint graph-paper grid that reads as a dev-sandbox overlay, not a floor. And the 3× loupe reveals the rig is literally rectangular volumes — box head, box torso, mitt hands — the forbidden block-figure anatomy, rescued at match scale only by its dressing. Right now the darkness and grain are carrying grit that the geometry refuses to state.

## 2. Silhouette + equipment readability at combat zoom — **4/5**

Judged in the 480×270 panel and the 2× stage still. The idle body occupies ~38×57 px, extending to ~80 px tall in the attack. The figure separates cleanly from the floor: dark ink contour plus a lighter sage torso against the dark plum ground, with a contact shadow grounding it. In my grayscale conversion of the full stage, the medic identity cluster survives: the cross patch reads as a light square with a lighter cross even without color, the visor reads as a light band, and the injector reads as a bright stick during the attack (unmistakable at native scale in attack frame 8). The rust-patch-plus-teal-visor combination is a genuinely working 64-px identity.

The deduction: the *shape* itself is not distinctive. In idle the legs fuse into one column and head/torso/pack merge into a lumpy rectangle; from the back facings (turn frames 12–14) the figure is nearly a box with an antenna. Identity is carried by the color patch, not the silhouette — swap the patch and this could be any unit.

## 3. Material separation — **3/5**

Zones are cleanly separated by hue and value: sage coat with two cel bands, plum helmet, grey pack boxes, rust patch with white cross, dark boots, orange mitt and knee patch, bone-white injector with teal fluid. Emission is exemplary — teal visor slit, vial tip, and one waist-case dot, measuring ~1.2% of frame, and every glow is on the medic's *tool*, which is exactly what "meaningful emission" should mean.

But this is hue separation, not material separation. Nothing reads as metal versus cloth versus rubber: no edge-highlight discipline, no specular hint anywhere, boots and trousers sit in the same value, and the pack boxes could equally be steel or cardboard. The environment has the same problem — salmon stall roofs, floor chevron, and pallets are all the same matte substance in different colors. At 64 px full material rendering is not required, but one or two value accents that say "this edge is metal" would be cheap and are absent.

## 4. Character/environment cohesion — **4/5**

This is the set's quiet strength. Figure and board share one rendering language: the same plum-black ink contour weight, the same flat cel banding, the same grain overlay, the same ortho pixel-crisp edge, and the character sits *inside* the scene light — the shaft falls across it and it casts a contact shadow. Palette roles are shared too: muted body colors, salmon/orange accents, scarce teal on both sides of the seam. Nobody would call the figure imported.

Two frictions. First, detail density: the figure packs eight-plus material zones into 38 px while the floor offers two values per hundred pixels plus a dev grid — a detailed miniature on an empty diorama. Second, and more damaging, focal hierarchy: the salmon stall roof (top-left in the pan frames, filling a quarter of some frames) and the saturated floor chevron are the loudest masses on screen. The environment is spending the identity-color budget that should belong to the unit; at combat zoom the eye goes to the furniture first.

## 5. Motion readability — **3/5**

The stepping is genuine, not keyframe-thinning: GIF decomposition shows duplicated hold frames (idle at ~8 poses/sec, attack ~11, turn 10, with true 1×1-pixel no-op frames confirming deliberate holds on twos and threes).

- **Attack** (the best of the three): a real action story — frames 3–6 the body squares up and reaches to the waist case (the chest cross rotating to camera is a nice free anticipation), frame 7 draws the injector up, frames 8–11 commit to a deep lunge with the arm fully extended, then a stepped recovery. The lunge silhouette is the strongest drawing in the entire set. But it never *lands*: there is no contact, no impact accent, no squash or smear at the stab — the lunge settles instead of snapping — and frames 16–20 are four identical frames that read as GIF padding rather than a held button.
- **Turn**: reads as a quantized turntable. Yaw advances in uniform increments with two-frame holds (frames 9–11 are near-identical); the facings themselves read well (pack cross on the back, injector swapping sides), and feet do restate at some steps, but there is no head-lead, no anticipation dip, no timing variation — a model rotating in steps, not a character deciding to turn.
- **Idle**: alive at 4× (breath, a weight shift, a visor look-around beat near frames 15–17, a vial fidget) but the changes are one or two pixels — at true match scale it hovers near the threshold of "static."
- **Pan**: smooth camera translation over held walk poses at ~7 fps; the stepped-character/smooth-camera split is the correct grammar and the framing keeps the unit readable throughout.

---

## Verdict

This prototype clears the bar it most needed to clear: it no longer looks like the block-figure match proto, it lives convincingly inside one rendering language, and the value/emission discipline is honestly on-budget rather than nominally so. The medic's identity cluster — rust cross patch, teal visor, glowing injector — survives grayscale at 64 px, which is the hardest single requirement here. What it has not yet earned is the word "grime": the world is a clean diorama shot at night with a grain filter, the material story is hue-only, and two of the four motion clips (turn, idle) expose that the stepped cadence has been applied to a rig rather than to acting. The attack proves the team can draw a pose; the rest of the set needs to catch up to it.

## Strongest problems (most actionable first)

1. **The environment outshouts the unit and reads as a sandbox.** The salmon stall roofs and floor chevron are the largest, brightest saturated masses on screen — identity color spent on furniture — and the graph-paper floor grid reads as a debug overlay. Knock the environment accents down a band, kill or heavily fade the grid, and let the medic own the saturation peak.
2. **No surface has a history.** Zero wear, stains, decals, litter, or signage anywhere; grit is currently rented from darkness and grain. Even three or four cheap marks — a stained tile, a scuffed stall edge, one piece of ground clutter, a painted stall sign — would move this from "playset at night" to "worked-in market."
3. **The turn is a turntable and the attack has no impact punctuation.** Give the turn a head-lead frame and uneven step timing (fast middle, held ends); give the attack one accent at the stab — a two-pixel squash, a smear, or a single-frame flash — and replace the four-frame terminal freeze with a deliberate settle.

## Must not be lost in iteration

1. **The attack's story beats and lunge silhouette** (frames 3–11): reach-to-case anticipation, draw, full-extension stab. This is the reference for every future action clip.
2. **The grayscale-surviving identity cluster and emission scarcity**: cross patch + teal visor + glowing tool at ~1% of frame. Do not let grime passes or new effects dilute either.
3. **The single rendering language**: shared plum-black ink, cel banding, grain, the light shaft falling across the character, and the contact shadow. Cohesion is currently a strength; iterate the board and the figure together or it will break.
