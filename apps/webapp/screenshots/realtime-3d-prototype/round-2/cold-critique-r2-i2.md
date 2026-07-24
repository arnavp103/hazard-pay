# Cold critique — round 2, iteration 2 (r2-i2)

SCORES r2-i2: gritty 3/5 · silhouette 4/5 · material 4/5 · cohesion 4/5 · motion 4/5
(r2-i1 was 3 · 4 · 3 · 4 · 3 — material and motion each +1; gritty improved within band)

**Provenance:** judged only the eight r2-i2 captures — two stills, one loupe, three
combat-zoom GIFs decomposed to frames with ffmpeg (idle 24f/20cs, turn 37f/10cs, attack
22f/~8cs) and measured with per-frame RMSE, orange-centroid and bbox vertical tracking, and
teal/bright-pixel counts — plus the two A/B boards, the r2-i1 critique, and the reference
board README. No source, history, or transcript consulted.

## 1. Gritty / dangerous / lived-in vs toy-like — 3/5 (improved within band)
Grit is now partially SHIPPED into the hero render, not just proposed: the zoom10 still
carries a broken grey debris chunk plus a floor spill bottom-left (litter + a stain), wooden
pallets, a brown crate stack right, an orange hazard chevron and dashed floor marks, and
overhead hanging panels. So problem #2 is addressed at the mechanism level. But the register
still reads "tidy dark warehouse with a few props," not "grime-market": the stall facades and
crates in the actual hero are still clean beveled boxes with no wear ON their surfaces, and
prop density stays well short of the Quasimorph anchor. Notably the A/B board carries MORE
grit than the shipped zoom10 render does. Real progress; register hasn't crossed into a 4.

## 2. Silhouette + equipment readability at combat zoom — 4/5 (held)
Identity cluster reads cleanly and separably: plum helmet, teal visor slit, orange pauldron,
orange cross patch, white injector with teal tip, orange mitt, and now bright white boot
toe-caps that anchor the base of the silhouette. Contact shadow grounds it; the turn frames
show every facing restating equipment. Deduction unchanged: the underlying shape is still a
stack of boxes; from behind it's a box with a pack, identity carried by color and the new
toe-cap value more than by outline.

## 3. Material separation — 4/5 (improved 3->4)
The metal read is delivered and SURVIVES combat zoom. At the loupe the boots carry near-white
steel toe-caps with a genuine value ramp (bright top edge -> mid-grey face -> dark under) and
a crisp specular-ish cap. In the 4x combat-zoom crop those caps still read as two bright
anchors at the feet. Four distinguishable material stories now: matte cel-banded olive cloth
(coat), rigid raised kit (orange cross-case), glossy poly/glass injector (white body + teal
emission + edge spec), and metal (steel toe-caps). Off 5: metal lives only at the toe-caps;
straps/buckles and the pack still read as one generic matte substance.

## 4. Character / environment cohesion — 4/5 (held)
One rendering language across unit and world; the unit keeps the chroma peak at combat zoom.
Held rather than improved because r2-i1 frictions persist and the new grit nudges them: the
warm awnings/stall facades top-left and the tall warm structure right still pull the eye, the
pulled-back 0.82 framing raises the furniture-to-unit ratio, and the added floor chroma
(orange hazard marks, and especially the saturated teal spill in the decal treatment) starts
to compete with the unit's own teal. Net neutral; background chroma discipline needs watching.

## 5. Motion readability — 4/5 (improved 3->4)
- IDLE: still alive (RMSE 400-1300, never static), injector sway and weight-shift, a beat ~f12-15.
- TURN: the headline fix. No longer a turntable. Torso bobs ~9px, feet excursion ~21px, dwell
  PLATEAUS at front (f01-06) and back (17-21) with fast motion through side transitions
  (RMSE holds 190/197 vs 2000+ swings). Genuine crouch/weight-shift step cycle: bent knees and
  lowered torso through side facings, tall at the back, brief settles at cardinals. Helmet
  reorients through the turn. Problem #1 substantially cleared.
- ATTACK: now lands. Coil + load (03-08), committed forward-pitched lunge with a pale motion
  SMEAR on the barrel at f09 (teal-tip pixels collapse 15->1 while bright pixels spike 78->134),
  full extension with small spatter (11-12), recoil and settle (14-22). Problem #3 present as
  smear/flash. Off 5: the turn's hop is a modest weight-shift not a pronounced vertical hop and
  head-lead is marginal; the attack has no hit-STOP hold or contact-point spark.

## Grit A/B recommendation — BOTH, chip-led (validated)
Decal-only leaves the pristine-bevel-with-a-sticker read. Chip does the structural work —
notches the stall's bottom edge and drops a fallen pipe/debris chunk that breaks the boxy
silhouette. BOTH is most convincingly worked-in. Caveats: LEAD WITH THE CHIP GEOMETRY, and
MUTE the teal floor spill (rivals the unit's teal).

## Verdict — NOT yet a full pass; one clear remaining gap (gritty)
Four of five axes now at 4, a two-axis lift from r2-i1. Lone laggard: grit at 3. Single
highest-value next fix: ship the both/chip-led density into the actual combat-zoom hero render
AND put wear ON the structures (stained/chipped stall facades, scuffed crates), pushing surface
history toward the Quasimorph register.

## Strongest problems
1. Grit shipped but sparse, structures stay clean — bake chip-led density in and stain/chip
   the surfaces themselves, not just the floor.
2. Mute the teal floor spill — keep floor decals dark/desaturated so the unit owns the emission.
3. The attack lands but doesn't STOP — add a 1-frame hit-stop hold + a small contact spark.
4. The turn's acting is present but shy — push a clearer 1-2px vertical hop + a 1-frame head-lead.

## Must not be lost
1. The metal read — near-white steel toe-caps with a value ramp that survive combat zoom.
2. The turn's new life — uneven dwell + crouch/weight-shift step cycle.
3. The attack's anticipation coil + committed pitch + injector smear; idle sway; unified
   rendering language with the unit owning the chroma peak.
