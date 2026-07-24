# Cold critique — pixel-control lane, ROUND 2 (provenance-cold)

> Advisory only — the human taste gate rules. I saw the round-2 captures
> (still-wide, framing compare, 4× medic loupe, facing sheet, and the six
> filmstrips), the round-1 cold critique as my baseline, and the reference
> board README. I never saw the generation transcript, the code, or the
> author's reasoning. I judge the pixels, not the intent.

## Axis verdicts (round-1 rubric)

**1. Gritty / lived-in vs toy-like — BORDERLINE (improved).** The figure still
passes on its own: muted sage/teal suit, respirator with a lighter mask plate,
a rust-orange back pack, and — new this round — a red chest pouch with a white
cross pip and a diagonal chest strap. The board has moved off the round-1
"vector playset": in still-wide there are raised crate/machinery volumes with
proper side-shading, a curved perimeter cable, manhole discs, hazard chevrons,
and a floor grid — more of a grime-market than a poster. But the large surfaces
are still immaculate flat facets and the floating diamond decals survive
untouched, so it has not fully left graphic-staging territory. Grain + vignette
+ the crate massing are still what keep it out of the toy bin.

**2. Silhouette + equipment readability at combat zoom — BORDERLINE.** This must
now be judged at the NEW wide-tactical zoom, and the zoom-out costs identity.
In still-wide the unit reads as a hunched dark mass with one reliable read — the
orange pack — plus a tiny injector sliver; the medic-specific cross faces away
in that pose, so "medic" is again carried by the HUD caption, not the pixels.
The facing sheet (at 4×) shows the kit is now distributed better across facings
— front has the chest cross-pouch and a low injector, the back is a bold
red-pack-with-white-cross (still the single strongest identity read) — but at
the actual on-map size those cues are 2–4px and marginal. Silhouette-as-a-unit:
fine. Silhouette-as-a-medic at this distance: shaky.

**3. Material separation — BORDERLINE (improved).** More material zones than
round 1: sage suit, darker teal shadow blocks, rust pack with a lighter label
patch, red pouch, white cross pips, grey injector with a cyan tip, black boots,
mask plate. That is real added variety. Two round-1 gaps persist: the hood,
jacket, sleeves and legs still read as one rubberized material with no texture
break, and the injector's metal-vs-glow split is still marginal — I think I can
see a lighter segment adjacent to the cyan tip in the loupe, but at this scale I
can't confirm it as a deliberate specular rather than another glow pixel.

**4. Character / environment cohesion — BORDERLINE (improved).** Good: the unit
now casts a distinct dark contact shadow on the floor in every filmstrip and in
still-wide, which grounds it far better than round 1; shared pixel grid and
shared plum/orange palette roles hold. The environment carries more fine detail
now (grid lines, crate edge-shading), so the medic is less of a lone fine object
on a flat poster. The round-1 float tells remain: surfaces are still big flat
facets, and the diagonal light shaft still passes behind the unit without
spilling any light onto its shading.

**5. Motion readability — PASS (with caveats).** This is the axis that moved the
most. In round 1 the attack was an invisible non-event; here the attack reads as
a thrust — the body leans into it and (in the programmatic and hybrid strips) a
bright horizontal smear punches out along the injector line at extension, giving
the Katana-ZERO/Magic-Pack-9 punctuation the board asks for. The idle reads as a
weapon-hand sway. Caveats: the authored strip is stepped and can read choppy;
the programmatic strip's motion is a rigid card-tilt; and at the new wide zoom
the amplitude is small enough that the bright smear cluster is doing most of the
"something happened" work.

**6. Deliberate pixel art vs noisy illustration — BORDERLINE (treatment-dependent).**
The static sprite and the authored frames stay clean at 4×: 1px ink contour,
flat cel clusters, on-grid. But the programmatic treatment is built on
"lean/shear + sub-pixel offsets," and sub-pixel positioning by definition puts
edges off the pixel grid — which produces anti-aliased/blurred contours and edge
shimmer, the exact thing that separates deliberate pixel art from a filtered
illustration. I can't measure the fringing precisely at filmstrip scale, but the
technique guarantees some, and the hybrid inherits it in its interpolated
in-betweens. Authored = PASS; programmatic = the pixel-purity risk lives here.

## 7. Round-2 priority — does the animation ACT WITH THE WHOLE BODY? — BORDERLINE.

The round-1 mannequin failure is **closed from the waist up, not fully closed.**

- **Attack:** In round 1 only the forearm swiveled while torso/head/legs were
  pixel-identical. That is genuinely fixed for the upper body: across all three
  attack strips the hood/head dips and the torso leans forward into the thrust as
  a mass, not just the arm. The hybrid adds the impact smear on top. So the
  head-and-torso mannequin is broken — this is a real, visible improvement.
  **But the legs betray it:** in every treatment the boots stay planted and the
  leg pixels are essentially unchanged frame-to-frame — no front-foot step, no
  visible weight transfer, no hip drop. In the programmatic strip the legs are
  literally the pivot of the shear, so they cannot articulate at all. A thrust
  with a leaning torso over two dead feet is a half-committed body.
- **Idle:** Weaker than the attack. All three idle strips read as the injector
  hand drifting/swinging outward with only a slight torso sway (a clearer
  whole-body lean in the programmatic idle). The legs and stance are static; this
  is closer to round-1's "correct pixels, no attitude" than the attack is. If
  that outward arm drift does not retract within the loop it will pop on repeat —
  I can't verify the return from a one-directional strip, so I flag it, not fail
  it.

Net: the whole-body directive is half-answered. Torso/head now act; legs and
idle-stance do not.

## Treatment comparison (against the board's pose-vocabulary requirement)

The relevant canon is the Warped City animation sheet — "clear action
silhouettes readable across a large pose vocabulary" — reinforced by Katana
ZERO (key poses + slash trail + hit-pause) and Magic Pack 9
(anticipation/expansion/impact). The requirement is *distinct, readable
silhouettes*, not smooth motion.

- **AUTHORED** — best literal match to "pose vocabulary": each key is a
  genuinely different hand-shaped silhouette, on-grid and crisp, and it's the
  only treatment that could ever draw a stepped foot or a crouch. *Weakest
  thing:* it's sparse and stepped here — too few keys to feel fluid, it reads
  choppy, and it is the highest per-unit production cost, so coverage across many
  units is the open question it doesn't answer.
- **PROGRAMMATIC** — cheapest, and the lean/shear does buy whole-body motion for
  free. But it satisfies the pose-vocabulary requirement *worst*: it is one
  silhouette skewed, so it can never produce a new pose — no raised arm, no
  stepped leg, no crouch — and the lean is a rigid card-tilt that keeps the legs
  frozen as the pivot. *Weakest thing:* off-grid sub-pixel/shear AA that breaks
  pixel discipline (axis 6), plus the structural ceiling that it can't leave
  mannequin territory because it can't re-pose limbs.
- **HYBRID** — best answer to the production question. It keeps the authored key
  poses (the real silhouette vocabulary), interpolates between them to cut frame
  count, and lands the bright smear for impact punctuation — exactly the
  "authored keys for vocabulary, interpolation for cost, smear for punch" trade
  the board's animation references imply. *Weakest thing:* the interpolated
  in-betweens inherit the programmatic warp/mush between the crisp keys, it is
  the most complex pipeline, and right now the smear risks doing the acting while
  the underlying body (again, the legs) still under-moves.

**Recommendation:** HYBRID best answers "authored vs programmatic vs hybrid" —
it delivers the reference's pose vocabulary at lower frame cost than pure
authored, and avoids programmatic's fatal ceiling of never producing a new pose.
The condition on that recommendation is that the authored keys the hybrid
interpolates between must start including leg/stance changes; otherwise hybrid is
just a smeared version of the same half-body.

## Directive check

- **Dir 2 — more detailing / material history: PARTIAL.** Added chest cross-pouch,
  diagonal strap, pack label patch, and a back cross; that is real added history.
  The single-material suit and a confirmable metal-vs-glow specular on the tool
  are still open.
- **Dir 3 — shorten the legs / proportions: DONE (evident).** The loupe and
  facing sheet show a stockier figure with short legs and stubby boots; the
  round-1 "reads too tall" tell is gone, arguably now slightly bottom-heavy.
- **Dir 4 — zoom the combat camera out: DONE (evident).** The framing compare is
  unambiguous — the unit drops from a large hero-scale figure to a noticeably
  smaller (~40% shorter) tactical figure with much more board visible. The
  side-effect is the axis-2 identity cost noted above.

## Overall read

Would I stake on this as an *acting* lane now? **Cautiously, on the hybrid path
— not on the lane as it stands.** The core round-1 verdict is reversed for the
upper body: the attack is now a readable event with the torso committing and a
smear delivering the impact, and the treatment shootout gives the human gate a
genuine, legible basis to choose hybrid. That is real progress and the drawing
quality survived the changes intact.

The **single biggest remaining risk** is the **legs**: across all three
treatments the feet stay planted and the lower body never transfers weight, so
the animation is still a mannequin from the waist down. It is a quieter version
of the exact round-1 failure, and because the programmatic treatment *structurally
cannot* fix it, choosing the wrong treatment would bake the half-body in
permanently. Secondary risk: the wide-tactical zoom-out (a good tactical call)
has pushed medic identity back onto the HUD caption — at the new distance the
sprite alone does not say "medic" except from the back.

## Improvement notes

1. **Make the legs act.** The attack needs a front-foot step (2–3px forward) and
   a 1px hip/back-foot weight shift on the extension, with recovery back to
   stance. This is the one change that would close the mannequin verdict
   completely — and it is only reachable in the authored/hybrid paths, so treat
   it as the deciding test between them.
2. **Give the attack an anticipation and a hit-pause.** Add a pre-thrust frame
   where the torso and injector pull *back* (weight loads) before extending, and
   hold the extended+smear frame one extra beat as hit-pause. Right now the strip
   reads as extend-and-return with no wind-up.
3. **Re-earn medic identity at the wide zoom.** Since the camera is now further
   out, the 2–4px chest cross and injector are marginal. Bump the front chest
   cross to a higher-contrast 3–4px cluster and give the injector tip a 1px
   brighter cyan so the medic reads without the caption from the front/side, not
   only the back.
4. **Keep the programmatic frames on-grid.** If the programmatic or hybrid path
   is chosen, snap the sheared/offset sprite to whole-pixel positions per frame
   (accept the stepped look) rather than sub-pixel interpolating — otherwise the
   AA fringing will fail the deliberate-pixel-art axis at 1×.
5. **Differentiate the idle across treatments, and give it stance.** The three
   idle strips are nearly indistinguishable, which wastes the comparison. Give
   the idle a real breathing loop that involves the shoulders/hood and an
   asymmetric weighted stance (one foot offset, one shoulder dropped), and make
   the arm drift return within the cycle so it loops cleanly.
6. **Finish the two round-1 material carry-overs.** Place one white specular
   pixel adjacent to (not inside) the injector's cyan tip to split metal from
   glow, and break the single-material suit with 2 edge-lit pixels on the boot
   toes or the shoulder ridge.
7. **Dirty the board's flat facets at the sprite's register.** The added crates
   and manholes help; now scuff the diamond-decal edges and add a few
   cracked-seam pixels along grid lines so the environment stops out-cleaning the
   character it hosts.
