# Cold critique — round 2, iteration 1 (r2-i1)

SCORES r2-i1: gritty 3/5 · silhouette 4/5 · material 3/5 · cohesion 4/5 · motion 3/5
(round 1 was 3 · 4 · 3 · 4 · 3 — held on every axis)

**Provenance:** judged only the nine r2-i1 captures (two stills, one loupe, three
combat-zoom GIFs decomposed to frames via ffmpeg, two A/B boards) plus the round-1
critique and the reference board README. No source, history, or transcript consulted.

---

## 1. Gritty / dangerous / lived-in vs toy-like — 3/5
Real progress on staging, not yet on surfaces. The round-1 dev-sandbox graph-paper grid
is gone — the floor now reads as tiled panels with a muted hazard chevron, faint
scuff-streaks, and a light shaft; overhead cables, awnings, and a crate prop furnish the
board. But in the two hero captures the stalls are still clean beveled boxes with painted
stripes — no stains, chips, litter, or signage baked in where it counts. The lived-in wear
that earns "grime" exists mostly as the A/B/C proposal, not shipped at the zoom the player
sees. Stronger 3 than round 1 (grid removal + props are real), but grit still leans on the
plum-dark field.

## 2. Silhouette + equipment readability at combat zoom — 4/5
At true combat zoom the identity cluster reads cleanly: plum helmet, teal visor slit,
orange cross patch, bone-white injector with teal tip, orange mitt, grey boots — all
separable with a grounding contact shadow. New pauldron and injector arm add silhouette
interest. Deduction unchanged: the shape itself is still boxy; from the back it's a box
with an antenna and pack cross, identity carried by color not outline. Pulled-back zoom08
(~50px) pushes injector and cross toward their legibility floor — fine as map framing, but
keep validating combat identity at zoom10.

## 3. Material separation — 3/5
Three genuine material reads at the loupe now: matte cel-banded coat (cloth), the rigid
raised cross-case (kit), and the injector — the one real material story, a harder white
cylinder with an edge-highlight/specular hint and teal-emission tip. But nothing reads as
METAL: no steel value-ramp, no spec discipline on buckles/boot caps; pack, coat, mitts,
boots share one matte substance distinguished only by hue. At combat zoom it collapses to
color-led. Clears "three materials" at the loupe by a hair; holds at 3.

## 4. Character / environment cohesion — 4/5
Still the strongest axis. One rendering language — plum-black ink contour, flat cel
banding, ortho-crisp edges, contact shadow, light shaft across the character. The
pulled-back framing is a net win for hierarchy: wraps the unit in a larger quiet dark floor
plane; the character keeps the chroma peak. Round-1 friction softened but not gone: salmon
awnings top-left and the tall warm building right still pull the eye, and the pulled-back
frame raises the furniture-to-unit ratio. 4 holds.

## 5. Motion readability — 3/5
- IDLE — genuinely fixed, best improvement in the set: real weight-shift cycle, injector
  sway, visor look-around beat; reads as alive at 64px.
- TURN — unaddressed, still a mechanical turntable. Frame delays essentially uniform on
  all 24 frames, base stays at constant vertical (no hop), no anticipation, no head-lead,
  no settle. Facings themselves clean (feet restate, injector swaps sides, pack cross on
  back) but it's a model rotating in even steps.
- ATTACK — improved acting (real coil anticipation, committed lunge, settles instead of
  terminal freeze) but still no landing: no impact accent at the stab.
One clear yes (idle), one clear no (turn), one partial (attack) = high 3, dragged by turn.

## Grit A/B recommendation — BOTH (panel C), chip-led
Decal-only leaves the round-1 read: a pristine bevel with a sticker on it. Chip-only kills
that read — the notched panel and ground crate/debris break the boxy silhouette and put
history into the geometry. Both is most convincingly worked-in and doesn't blow the palette
budget (wear stays dark/muted, unit keeps the chroma peak). Recommend C but LEAD WITH THE
CHIP GEOMETRY and keep decals restrained/character-free of chartreuse.

## Strongest problems (most actionable first)
1. The turn is still a uniform-timing turntable — the #1 round-1 motion ask, untouched.
   Give it uneven timing (quick through mid facings, held on cardinals), a 1-2px
   anticipation dip + a small hop/weight-shift on the settle, and let the helmet lead the
   torso by one frame at each facing change.
2. Grit history is designed but not shipped — bake the chosen treatment into the actual
   match render; hero stills still show clean bevels.
3. The attack doesn't land — add one 1-frame impact punctuation (2px squash, smear, or a
   single-frame flash on the teal tip).
4. Material still hue-led at combat zoom — add one metal value-accent (steel edge-highlight
   on a pack buckle or boot toe-cap) so cloth-vs-metal survives past the loupe.

## Must not be lost in the next iteration
1. The idle's new life (weight-shift + injector sway + visor beat) at 64px.
2. The attack's anticipation coil + committed lunge silhouette, and the unified rendering
   language (ink contour, cel banding, ortho crispness, contact shadow, light shaft).
3. The pulled-back framing's quiet dark combat plane and the grayscale-surviving identity
   cluster (orange cross, teal visor, glowing injector tip at ~1% emission).
