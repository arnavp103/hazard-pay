# Unit AI for ~40-body crowd combat

Research date: 2026-07-26. For [#97](https://github.com/arnavp103/hazard-pay/issues/97),
on wayfinder map [#95](https://github.com/arnavp103/hazard-pay/issues/95).

Scope filter applied throughout: **~40 bodies, fixed 2:1 dimetric camera (30° elevation /
45° azimuth, never rotates), 480×270 aperture, figures 28–53 px tall, and a match that
advances in bounded resumable slices.** Material that does not survive that filter has
been cut rather than summarised — see [What did not survive the filter](#what-did-not-survive-the-filter).

---

## Recommendation

**Adopt a two-level model: a formation layer that owns where a unit should be, and a
steering layer that only handles the last couple of metres.** Keep `sim.ts`'s continuous
motion and its per-unit procedural desynchronisation; replace its *decision* layer.
Concretely, the sandbox should move from

> every unit independently seeks the nearest live enemy, re-chosen every 0.45 s, with
> separation as the only thing keeping bodies apart

to

> every unit holds an assigned **slot** in its side's formation; the formation advances as
> a unit; a unit leaves its slot only to engage a **committed** target, and returns to it
> when that target dies.

This is Millington's two-level steering with a Company of Heroes slot layer — not the boids
model. It is the only shape in the surveyed literature built for roughly this unit count
with an overhead camera, and Millington names *both* of the bake-off's failure modes as the
things it exists to avoid: emergent formations give "controlled disorder … of little
practical use", and naive leader-following makes every body "lurch sideways" in unison.

Three specifics from Bannerlord's shipped formation code carry most of the legibility and
cost almost nothing: **slot index selects the pose** (front rank, edge and interior are
visibly different), **alternate ranks are brick-offset** so the block is not a lattice, and
**formation identity lives in tempo** — a shield wall moves at 0.3× speed, and tempo is one
of the few channels that survives 28 px.

Three supporting choices, each measured or sourced below:

1. **Commit to targets.** Never switch target mid-swing; require a challenger to be
   materially better than the incumbent. Measured effect on the current sim: attacks that
   wind up at one enemy and release on another drop from **12.4 % to 0 %**.
2. **Keep the decision layer cheap and dumb, and spend the budget on legibility instead.**
   Measured: a 20-consideration utility evaluation for a whole 4-second slice of 40 units
   costs **~26 ms**. Per-unit decision cost is not a constraint and must not drive the
   choice.
3. **Fix ordering and PRNG discipline now.** These are the real determinism hazards, and
   they are structural rather than numerical. Floating point is currently the *least*
   of them.

**The single most consequential art finding:** the current model has no restoring force
toward formation, so rank structure decays monotonically and never recovers. Only the
first slice of a match has a distinct visual identity; every slice after ~6 s looks like
the same undifferentiated scrum. A formation layer is what gives slice 4 a different
silhouette from slice 2.

**The choice that cannot be deferred to the art lane:** committing to a target means a
unit finishes its swing at a body that has already died. That reads as follow-through if
corpses linger, and as swinging at thin air if they do not. Target commitment and corpse
persistence are one decision, not two.

---

## What the substrate actually does — measured, not assumed

Every number in this section was produced by running the lane's own `sim.ts`
(`origin/prototype/flat-procedural-lane`) unmodified under Node 22, default seed
`20890724`, 40 units, fixed `dt = 1/60`.

### Screen scale — the filter everything else passes through

From `scene.ts`: `PX_PER_UNIT = 40`, `CROWD_ZOOM = 0.55`, `COMBAT_ZOOM = 0.82`; the
dimetric up-vector's Y component is `0.86603`.

| | crowd zoom | combat zoom |
|---|---|---|
| fodder (1.48 world units) | **28.2 px tall** | 42.0 px |
| hero (1.85 world units) | **35.2 px tall** | 52.6 px |
| 1 world unit, horizontal | 22.0 px | 32.8 px |
| `SEPARATION_RADIUS` = 1.05 | **23 px** | 34 px |

A fodder unit is 28 px tall and its personal-space bubble is 23 px wide: bodies at rest
sit less than one body-width apart on screen. Anything that must be read per-unit gets
roughly **28 × 14 px and no camera assistance** — the camera never rotates, never cuts,
and never pushes in.

### The engagement dissolves the ranks, monotonically

Standard deviation of side 0's depth along the approach axis — the numeric form of "are
these still ranks?":

| t (s) | 0 | 2 | 4 | 6 | 10 | 14 | 20 |
|---|---|---|---|---|---|---|---|
| depth s.d. | 0.785 | 0.991 | 1.464 | 1.874 | 1.935 | 1.998 | **2.084** |

The starting layout is two ranks 1.55 units apart (s.d. 0.785). By t=6 s it is 1.87, and
it never comes back — nothing in the model represents the line, so nothing restores it.
The crowd's screen bounding box contracts to 287×120 px at contact (t≈4 s), then swells
back to 324×158 px as the scrum diffuses. Nine to thirteen unit pairs sit within 12 px of
each other horizontally at any moment.

**ART-VISIBLE, and the most important single finding here.** Under this model the fight
has exactly two looks: "two lines closing" for about four seconds, and "scrum" forever
after. A slice-based match will show the second one over and over.

### Attacks do not affect the simulation

`desiredVx`/`desiredVz` depend only on target position and separation. `attackPhase`,
`cooldown`, `firedAt` and `hitAt` are write-only as far as motion is concerned. Proof:
drawing one extra number from the shared PRNG at t=3 s shifts unit cooldowns by up to
**1.62 s** and moves **nobody** — max position delta after ten further seconds is exactly
`0.000000`.

The substrate is therefore two decoupled systems: a movement solver converging to a static
standoff lattice, and a decorative attack system layered on top. It cannot answer "does
the fight look different when combat matters", because in it, combat does not matter.

### Targeting looks stable only because nothing dies

As shipped, over 20 s:

- target changes: **0.07 per unit per second**, against 2.22 retarget opportunities per
  second. The nearest-enemy choice is almost never revisited.
- attacks releasing damage on a *different* unit than the one they wound up against:
  **4 of 224 (1.8 %)**.

Add the one mechanic this map owns — units dying and leaving the field (3 HP fodder / 6 HP
hero, spliced out on death):

- target churn: **0.24 per unit per second** — 3.4× higher.
- wind up at A, land on B: **15 of 121 attacks (12.4 %)** — 6.9× higher.
- first death at t=3.87 s; 31 of 40 dead by t=20 s.

**ART-VISIBLE:** roughly one attack in eight telegraphs at one enemy and resolves against
another. The strike-arm IK in `animator.ts` visibly snaps mid-swing, because `applyIk`
aims at `unit.aimX`/`unit.aimZ`, which retargeting has already moved. The substrate's
apparent targeting stability is an artifact of a battle in which nobody dies. **It has
never been tested against the thing this map exists to add.**

### Commitment fixes the flip, and buys a new art problem

A minimal commitment rule — never switch target mid-swing, and otherwise only switch if
the challenger is 25 % closer than the incumbent — against the same death rule:

| | churn / unit / s | wind up at A, land on B | aimed at a corpse |
|---|---|---|---|
| nearest enemy every 0.45 s (as shipped) | 0.24 | **12.4 %** of attacks | 5.3 % of unit-frames |
| + commitment | 0.16 | **0.0 %** | **13.7 %** |

Mid-swing flips go to exactly zero. In exchange, time spent aimed at something already
dead rises from 5.3 % to 13.7 %.

This is where AI design and art direction meet, and it is not avoidable. Commitment means
a unit finishes its swing at a body that has already died — follow-through if a corpse
persists for the ~700 ms of attack recovery, whiffing at air if it does not. **Decide
corpse persistence and target commitment together.**

### Per-unit decision cost is not a constraint. It is not close.

Wall-clock, one 4-second slice, Node 22:

| units | ms per 4 s slice | ms per step |
|---|---|---|
| 20 | 5.2 | 0.022 |
| **40** | **15.1** | **0.067** |
| 80 | 55.7 | 0.232 |
| 200 | 358.0 | 1.492 |

A deliberately heavy utility layer — 20 weighted considerations, each with a polynomial
response curve, scored against every enemy × 4 candidate actions, re-evaluated every
0.45 s — costs **~26 ms for an entire 4-second slice** on top of that 15 ms. JIT variance
between runs exceeded the difference between 4 considerations and 20.

So a full utility AI for four seconds of 40-unit battle costs on the order of **40 ms of
server CPU to produce four seconds of fight** — about 1 % of the wall-clock time it
depicts. The ticket asks about per-unit cost "at 40 bodies where per-unit cost matters".
**It does not matter.** Choose on legibility, authorability and determinism.

---

## The options, and what each one looks like

### 1. Pure steering / boids — what the substrate does today

Reynolds' 1987 model is **prioritized, not a weighted sum**, and this is the most commonly
misremembered fact about it. He lists three urges in decreasing precedence — collision
avoidance, velocity matching, flock centering — and explicitly rejects averaging them,
because if requests "lie in approximately opposite directions, they will largely cancel
out". His arbitration is *prioritized acceleration allocation*: requests queue by
priority against an acceleration budget, and whatever overruns it is trimmed. By GDC 1999
he reports that a simple weighted sum "has proved sufficient" in practice, while still
naming the shortcoming: "component behaviors may cancel each other out at inopportune
times."

Two more things from GDC 1999 that bear directly on the substrate:

- **Seek without arrival produces orbiting** — "motion a bit like a moth buzzing around a
  light bulb". Arrival ramps desired velocity to zero inside a stopping radius. `sim.ts`
  has this: `drive = clamp(gap * 1.6, -0.8, 1)` is an arrival term, which is why the
  substrate does *not* swirl.
- Flocking as specified is **nine parameters** — weight, distance and field-of-view angle
  for each of separation, cohesion, alignment. Reynolds gives no defaults anywhere.

`sim.ts` uses separation only — no cohesion, no alignment — which is the right subset.
Cohesion has no equilibrium; Reynolds' own later PS3 work notes that a traditional flock
"tends to eventually produce one large flock", merging until "all individuals are swept
together into one large group".

**What it gives:** cheap, no interpenetration, and mass motion that reads as bodies rather
than a decal. **What it costs:** nothing represents the formation, so the ranks dissolve
(measured above); and a unit's decision is unreadable because it is the sum of forces
rather than a choice.

One documented dial, characterised in visual terms — the avoidance time horizon `tH`
(Guy & Karamouzas): at **0.1 s** "agents do not show any anticipation … and can even
overlap"; at **4 s** "agents avoid all collisions while following their goals and show
clear anticipatory motion"; at **20 s** they "separate out much more than necessary".
Crucially, `tH` can vary per agent — "aggressive or impulsive" agents get a small horizon
and "will perform many last minute avoidance maneuvers"; "shy or tense" agents get a large
one. Their tuned constants: goal force `F = k(v_goal − v)` with **k = 2**, avoidance
magnitude `(tH − τ)/τ` capped at **20**, integration **Δt = 20 ms**.

**ART-VISIBLE and free:** per-tier time horizons are a characterisation channel that costs
no art. Give heroes a small `tH` so they bull through the press and fodder a large one so
they scatter around them. That difference is legible at 28 px because it changes *when*
the silhouette breaks path, not how it is drawn — and it does real work on the #69 problem
of finding the hero in a crowd.

**Verdict: KEEP as the bottom layer, DEMOTE from being the whole model.**

### 2. Formation and role-based AI — the recommended spine

Millington names **both** of the bake-off's failure modes, in one chapter, seventeen years
ago. On purely emergent (flocking-style) formations: "The overall effect is often one of
controlled disorder, rather than formation motion. For military groups, this characteristic
disorder makes emergent formations of little practical use." That is the illegible-mush
end. And on naive slot-following with a *visible* leader:

> If the leader needs to move sideways to avoid a tree, then all the slots in the formation
> will also lurch sideways and every other character will lurch sideways to stay with the
> slot. This can look odd because the leader's actions are mimicked by the other
> characters.

That is the 40-synchronised-toys end. His documented middle is **two-level steering**:
"first the leader steers the formation pattern, and then each character in the formation
steers to stay in the pattern" — where the leader is not a body but an **anchor point**,
"a separate steering system that is controlling the whole formation, but none of the
individuals". Because each body *arrives* at its slot with its own steering, the
correlated jerk never propagates.

TaleWorlds states the same split for Bannerlord: the AI is "three separate categories:
individual, formation, and tactical", and "the orders issued by the formation AI only
determine what is expected of each individual agent, but it doesn't directly make them do
anything."

#### The Company of Heroes mechanism

The most transferable single source is Company of Heroes' squad formations (Jurney, *AI
Game Programming Wisdom 4*), because it targeted squads under an overhead camera and used
**no flocking at all**. Its mechanism, and what each part buys:

| Technique | What it buys on screen |
|---|---|
| Hierarchical slots (squad → core / left / right flank, each with a leader) | Silhouette separation **by construction**, not by hoping emergent separation delivers it |
| Followers target the leader's position "roughly two seconds ahead" along its path | The line bends *before* the corner, so it reads as a line rather than a queue |
| Offsets applied as a **speed modifier along the leader's axis of motion**, not a steering force | Units drop back and catch up instead of sidling; no lateral wobble |
| Per-unit **drift** — a random offset floating within a maximum radius, added to the formation offset | Without it, the formation "will look a bit robotic". This is the same job `unitJitter` already does in `procedural.ts` |
| **Stable** role reassignment on death (minimum swaps) | Explicitly because "it looks awkward when a soldier randomly runs from the left side of a squad to the right when a reinforcement arrives" |
| Destination reservation — each soldier marks its target spot | Stops two units stacking on the same melee target |
| Repath throttling to every 0.5–0.75 s | Near-identical to the substrate's existing 0.45 s retarget cadence |

Note what is absent: no cohesion force, no alignment force, no reciprocal avoidance.
Separation is achieved by **assignment**, which is deterministic, artifact-free, and free.

**ART-VISIBLE:** stable slot assignment is the difference between a line that thins as it
takes casualties and a line that reshuffles itself every time someone dies. The second one
is unreadable at 28 px.

#### What Bannerlord's shipped formation code adds

Bannerlord runs formations of dozens to a few hundred at a camera distance where
individuals are readable — much closer to this problem than Total War is. Reading the
decompiled `TaleWorlds.MountAndBlade` tree, six things transfer almost unchanged:

1. **Slot index drives pose.** In `ArrangementOrder.GetShieldDirectionOfUnit`, a unit's
   grid coordinate selects its animation: rank 0 gets `DefendDown`, a unit with no left
   neighbour gets `DefendLeft`, no right neighbour `DefendRight`, everyone interior gets
   shield-up. **You do not animate a shield wall; you let each body's slot pick a pose and
   the wall emerges.** At 28 px this is one of the very few pose distinctions that still
   reads, because it changes the silhouette's outline rather than its interior.
2. **Ranks are brick-offset by default.** `GetLocalPositionOfUnit` shifts odd ranks by half
   an interval when `IsStaggered`, and `ArrangementOrder.GetArrangement` returns a
   staggered line for the default case. A perfect rectangular lattice at 28 px reads as a
   texture; half-offsetting alternate ranks breaks the vertical alignment while preserving
   the horizontal line.
3. **Formation identity lives in tempo, not geometry.** Per-arrangement run restrictions:
   shield wall and square **0.3×**, circle 0.5×, line 0.8×, loose/scatter 0.9×. The shield
   wall does not read as a shield wall because of the shields — it reads because it moves
   at 30 % speed. **This is the best news in the whole report for a 28 px figure: tempo
   survives the downscale and geometry mostly does not.**
4. **A measured integrity number closes the loop.** `FormationQuerySystem` computes RMS
   displacement of each agent from its slot, with outlier rejection, against an
   `IdealAverageDisplacement` of a quarter of the block's diagonal. Each behaviour declares
   a coherence demand — Regroup 1.0, Advance 0.8, Charge 0.5 — and `BehaviorRegroup`'s
   weight is a lerp of demand × measured deviation. **This is the direct answer to the
   monotonic rank decay measured above.** The scrum is *allowed* (a charging block may
   spread to roughly twice an advancing one's mess), but it is measured, and once it
   exceeds tolerance Regroup outbids everything and the block visibly re-forms.
   **ART-VISIBLE: the fight gains a breathing rhythm — form, charge, dissolve, re-form —
   instead of one monotonic slide into soup.** That rhythm is exactly what a slice boundary
   can be hung on.
5. **Casualties close gaps forward.** `FillInTheGapsOfFileAux` moves the man behind into a
   dead man's slot; `Shorten()` drops an emptied rear rank. At 28 px this is one of the few
   readable melee events — a dark gap opens in the line and closes a beat later — and it
   makes a side's health legible *without a health bar*: the block gets narrower and
   shallower rather than sparser.
6. **A reserved centre-front slot for the hero.** `ReserveMiddleFrontUnitPosition` holds
   open the first slot in the centre-out order. With 1–2 heroes per side this is the
   mechanism: the block forms *around* a held-open hole, and the hole is legible even
   before the hero fills it.

Two more patterns worth copying wholesale. Slot fill order in
`LineFormation.GetOrderedUnitPositionIndexAux` is pure arithmetic — rank 0 from the centre
outward alternating left/right, then rank 1 — so a thinned block stays a *centred* block,
and assignment is deterministic for free. And `FormationAI` phase-offsets each block's
2 Hz decision tick by `0.1 × formationIndex + 0.05 × teamIndex`: **desynchronisation
derived from indices, not from RNG.** That is the same trick `procedural.ts` already uses
in `unitJitter`, applied one level up.

#### Role as a legibility device, and the hero

Isla's Halo 3 objectives system frames the whole problem from the encounter side: "An
encounter is a complicated dance with lots of dancers", and "the dance is about the
illusion of strategic intelligence — designer provides the strategic intelligence, AI acts
smart within the confines of the plan." Two specifics transfer:

- **Staged, not unified, engagement.** Isla's canonical encounter is a two-stage fallback:
  hold a territory → pushed to a fallback point → pushed to a last stand → break → finish.
  A unified charge has *one* state transition and therefore one readable moment; a staged
  engagement has four, each announced by a visible mass movement. Bannerlord encodes the
  same instinct numerically, standing a reserve formation off at 40 m + depth.
- **Leaders as structure.** "Leaders provide structure to encounter / Leader death 'breaks'
  followers", implemented as a leader filter on the core task plus a "broken" state that
  blocks redistribution. **ART-VISIBLE, and the strongest hero-legibility finding in this
  document: the hero is readable not because it is bigger, but because the fodder's
  behaviour is organised around it and visibly changes when it dies.** One global change in
  crowd motion carries more readable information at 28 px than any amount of per-body
  detail. This is a cheaper and better answer to #69's "can you find the hero" test than
  the outline ring.

Slot assignment itself is NP-complete in general (Millington: 20 characters into 20 slots
is "nearly 2500 trillion" assignments), and the standard heuristic is greedy
most-constrained-first. **Determinism trap:** that heuristic is greedy over a *sorted*
list, and with 18–20 near-identical fodder the sort keys tie constantly. Every comparator
must be total — break ties on a stable unit id, never on insertion order or float bit
patterns. Bannerlord sidesteps the problem entirely by making slot order pure arithmetic on
a linear index, which is the cheaper and more deterministic design and the one to adopt.
Reserve cost-based assignment for the few role-constrained bodies where it earns its keep.

**Verdict: ADOPT as the spine.** Slots for the approach and for re-forming; steering only
for the last couple of metres.

### 3. Decision architecture — utility vs. behaviour tree vs. FSM

Since cost is a non-issue at 40 units (measured above), the axes that remain are
authorability, legibility, and determinism. The decisive property is not the architecture
but **inertia**, and the primary literature is unambiguous that this is a *visual* concern.

David "Rez" Graham, *Game AI Pro* ch. 9, has a section titled Inertia:

> If your AI agent is attempting to decide something every frame, it's possible to run into
> oscillation issues, especially if you have two things that are scored similarly. […] The
> AI might shoot the player a couple times, start to run away, then shoot again, then
> repeat. **Oscillations in behavior such as this look very bad.**

He gives three fixes, and the recommended commitment rule above is two of them:

1. "add a weight to any action that you are already currently engaged in. This will cause
   the AI to tend to remain committed until something truly better comes along" — the
   incumbent bonus.
2. cooldowns, where "the weighting for remaining in that action is extremely high", then
   reverting or decaying.
3. "stall making another decision — either for a period of time or until such time as the
   current action is finished". On *The Sims Medieval* a Sim decided only when its
   interaction queue was empty.

He also gives the variety technique that matters for a crowd: rather than always taking
the argmax, take "a subset of the highest scoring actions and choosing one of those with a
weighted random … choosing from among the top five scoring actions, or … percentile
based where you take the highest score and also consider things that scored within, say,
10% of it."

**ART-VISIBLE:** argmax targeting makes 20 units facing the same direction pick the same
kind of target at the same moment. Weighted-random among near-ties is what breaks a
crowd's decisions apart visually — and drawn from a seeded per-unit stream it stays fully
deterministic.

**Verdict:** the architecture is close to irrelevant at this scale; **inertia is not.** A
scored-options layer (utility-shaped) is the easiest of the three to give an incumbent
bonus to, and the easiest to add a top-N weighted random to, which is why it is the mild
preference. An FSM with an explicit `committed` state would also work. Do not adopt a
behaviour tree for the extra machinery alone — there is no complexity here to manage.

### 4. Legibility as an AI property

At 28 px the viewer cannot read a pose; they can read **timing, facing, and whether a
silhouette committed**. That makes legibility mostly an AI property, not an animation one.

What the substrate already gets right:

- **Wind-up length.** `ATTACK_DURATION = 1.2 s` with `RELEASE_AT = 0.42` gives a **504 ms**
  wind-up (30 frames at 60 fps) and 696 ms of recovery. That is generous — comfortably
  above human simple-reaction time — and it is not the problem.
- **Desynchronisation.** `unitJitter` derives phase, rate and amplitude from three
  independent hashes of the unit id specifically because reusing one hash "makes rate and
  amplitude correlate and the crowd re-synchronises into visible bands". Cooldown reset
  jitters by `0.75 + random() * 0.5`. Measured result: over 20 s of battle, of the 190
  frames containing a damage release, **168 contained exactly one** and only 4 contained
  three. The crowd does not fire in volleys.

What is missing, in priority order:

1. **Commitment is invisible.** Nothing on screen distinguishes "this unit has chosen you"
   from "this unit happens to be facing your way". Facing is the only channel and it is
   shared with travel direction — `sim.ts` switches facing from travel to aim at
   `speed > 0.25`, and units are above that threshold only **26.2 % of the time**. So for
   three-quarters of the fight, facing means "aiming", but there is no separate cue for
   *at whom*.
2. **The wind-up is inside the attack, not before the decision.** The attack begins the
   instant `cooldown <= 0 && distance <= attackRange`. There is no anticipation of the
   *choice*, only anticipation within the swing.
3. **Nothing draws the eye.** A mean of **13.1 of 40 units are mid-attack at any moment**,
   peaking at 28. When a third of the crowd is always swinging, no swing is an occasion.
   This is the argument for hero attacks being categorically different in timing, not just
   in scale.

**ART-VISIBLE:** the fix for (3) is an AI decision, not an art one — heroes should attack
*rarely and slowly* relative to fodder, so their wind-up is the only long silhouette
change on screen. Current profiles have hero melee cooldown 1.6 s against fodder 1.9 s,
i.e. heroes attack *more* often. That is backwards for legibility.

### 5. Physics-driven AI (Totally Accurate Battle Simulator)

Landfall's approach, per their developers: torque on ragdoll legs driven by animation
curves produces a walk; a step handler decides when a step may begin; a standing handler
raycasts down from the head and applies upward force "like a marionette's strings"; a
balance script adds force to legs and feet — "if both feet are in front of the bodies
center of mass one of them needs to move backwards." It began as a constraint, not a
choice: Landfall had no animator. Above the physics there *is* a real per-unit AI layer
with distance-keeping modifiers, so TABS is not pure physics.

**What it buys:** individuality for free. Every body's gait is a different solution to the
same balance problem, so you never get lockstep and never get two identical deaths. This
is a genuine and complete answer to "40 synchronised toys".

**What it costs, and why it is decisive here:**

1. **No legibility of decisions.** A unit that stumbles, one that is knocked back, and one
   that is *retreating* look identical. The wobble is a noise floor that swamps whatever a
   unit is trying to do — there is no front line, flank or reserve to read.
2. **No determinism.** Active ragdoll on a general solver leaks through iteration order,
   contact ordering and float accumulation. Not reproducible from a seed, which breaks
   slice resumption outright.
3. **It does not survive the downscale.** TABS' comedy is *legible detail* — the flailing
   arm, the buckling knee. At 28 px the flail is 3–5 px of jitter. **You pay the full
   determinism and legibility cost and receive almost none of the benefit.**

**Verdict: CUT.** But steal the principle: per-body variation should come from a cheap
continuous system rather than authored variants. Per-body phase offsets, per-body
micro-jitter on the *slot target* rather than the body, per-body idle amplitude — all
seeded from a stable unit id, all reproducible, and all readable at 28 px because they
show up as **timing** differences rather than **pose** differences. `procedural.ts`'s
`unitJitter` is already exactly this; the two-level formation model gives it a second place
to act.

### 6. Paired animation — does contact need to be authored?

Matched combat is one authored clip driving two skeletons, so a blade actually lands
rather than passing through. Creative Assembly's Simon Mann: *"Matched combat is a single
animation with two entities."* CA's art director attributes the technique's adoption
directly to **readability**, and their remedy for making it work was to make it *"a bit
more theatrical."*

The cost is combinatorial and does not shrink with figure size. Jonathan Cooper's GDC 2013
Animation Bootcamp talk on Assassin's Creed III cites **3,200 fight animations**, with
"hundreds of animations just for the wrist-blade assassination move, in a detailed matrix
including all the possible start and end states."

**Assessment against this project's filter** (argued, not cited — no source measures this
directly): at 28 px a figure is roughly 8–16 px shoulder to shoulder. A paired animation's
payload is limb-level registration, which lives at 1–3 px. **It will not read.** What does
read is silhouette change, gross timing, and whether two bodies converge and hold station
— and the last of those is a movement-system property, not an animation one.

**Verdict: buy paired animation for heroes only.** For fodder use **synced, not matched**:
one attacker clip plus N independent recoil/death reactions. No combinatorial matrix, and
at 28 px the recoil is the entire readable payload anyway. This is the progression CA
itself made — matched infantry combat in Medieval II, then synced multi-target reactions in
Warhammer, then reserving full paired duels for heroes.

---

## Determinism

The lane's `sim.test.ts` asserts `snapshot(advance(6)) === snapshot(advance(6))` — same
process, same engine, same build. That is the weakest useful form of determinism and it
does not cover what a slice-based match needs.

Credit where due: `scene.ts` already drives the sim with a fixed-step accumulator
(`STEP = 1/60`, `advanceTo` consuming whole steps), which is exactly Fiedler's
prescription. But `stepBattle(state, dt)` still *accepts* an arbitrary `dt`, so the
discipline lives at the call site rather than in the type. Fiedler's warning applies:
"It's utterly unrealistic to expect your simulation to correctly handle *any* delta time
passed into it."

Hazards, ranked by measured risk rather than by folklore:

**1 — Array-order coupling (large, structural).** `stepBattle` updates units in place, in
array order, single pass: unit 1 computes separation against unit 0's *already-updated*
position. That is Gauss–Seidel, not Jacobi. Measured:

- same battle, array order reversed → **0.018 world units** of divergence in 3 s;
- remove one unit from the array → **24 of 39 untouched survivors move**, by up to
  **4.94 world units (109 px, a fifth of the frame)** within 20 s.

Splicing is exactly how death will be implemented if nobody thinks about it, and every
death then silently re-orders the update of every unit after it. The fix is standard and
appears in both reference crowd implementations: **double-buffer** (read old, write new),
which is order-independent by construction, and **iterate by stable unit id** rather than
by storage position.

**2 — The PRNG is not serialisable (blocking for slices).** `SimState.random` is a closure
over private state; `JSON.parse(JSON.stringify(state))` yields `random: undefined`. There
is no way to persist a slice boundary and resume the same stream, so the only available
strategy today is `battleAt(seconds)`, which replays from t=0 on every call:

| slice | 1 | 5 | 10 |
|---|---|---|---|
| `battleAt(4n)` from zero | 72.6 ms | 86.5 ms | 156.6 ms |

A ten-slice, 40-second match costs **957 ms** of server CPU under replay-from-zero versus
roughly 174 ms if each slice resumed from stored state, and the gap widens with match
length. ADR 0004 resolves a phase atomically in one transaction; a resolution whose cost
grows with match length is the wrong shape for that.

Age of Empires solved this the obvious way: they describe "saving and re-seeding the
pseudo-random number generator with the last random number". **Make the PRNG state a
plain integer field on `SimState`.**

**3 — One shared RNG stream.** `state.random()` is consumed only at attack-cooldown reset,
so *the order in which units finish attacking determines who gets which number*. Terrano
and Bettner name this exact discipline as the thing their programmers found hardest:

> programmers were not used to having to write code that used the **same number of calls
> to random** within the simulation

Their amplification story is the one to keep in mind as this map adds mechanics: "A deer
slightly out of alignment when the random map was created would forage slightly
differently — and minutes later a villager would path a tiny bit off." The fix is
per-unit streams derived from `(seed, unitId, purpose)`, so a draw for unit 7 cannot
perturb unit 8.

**4 — Implementation-approximated math (real, but currently the smallest).** `sim.ts`
calls `Math.hypot` about 42 times per unit per step — ~101 000 calls/second at 40 units and
60 Hz — plus `Math.atan2`. Per ECMA-262, `Math.sqrt` is exactly rounded, while `Math.hypot`,
`Math.atan2`, `Math.sin`, `Math.cos` and `Math.exp` are *implementation-approximated*
(ECMA-262 §4.4.1, §21.3), so two engines may legitimately disagree. Measured: on this
sim's own distance queries, `Math.hypot(dx,dz)` differs from `Math.sqrt(dx*dx+dz*dz)` in
**37.7 % of calls**, by up to `4.12e-16` relative.

How much does that matter here? Less than the usual scare story:

- perturbing a unit by 1e-12 to 1e-6 world units leaves divergence at ~4.5e-13 to ~4.5e-7
  and **plateauing** — the movement solver is a damped attractor and contracts error;
- with the death rule added, perturbations from 1e-12 up to **1e-3 world units (0.02 px)**
  produce an **identical survivor set**.

The branch points are live — the smallest observed margin between a unit's nearest and
second-nearest enemy over 20 s was **4.55e-6 world units**, and 46 of 1800 sampled
retargets were within 0.01 units of a tie — but that is still nine orders of magnitude
above float noise. It is safe *by accident*, because attack outcomes do not feed back into
motion. Knockback, body-blocking, or death-with-collision all close that loop.

There is also a category difference worth recording. Force-based steering is **continuous
in its inputs**: a 1-ULP difference gives a 1-ULP output, and drift accumulates slowly.
Constraint-solver and sampled-argmin avoidance (ORCA's linear program, Unreal's
DetourCrowd velocity sampling) are **discontinuous** — a float comparison flips which
half-plane or which of 33×33 samples wins, and the output velocity changes completely.
That is a determinism cliff, not drift. If cross-machine reproducibility is ever required,
stay with force-based steering.

**Ranking: fix ordering (1) and the PRNG (2, 3) now — they are cheap and structural. Treat
cross-engine float parity (4) as a decision owed only once "whether the client
re-simulates or replays" is settled**, which map #95 still lists as unspecified. If the
client only replays a persisted batch of match events, `Math.hypot` never becomes a
problem.

---

## What this changes about `sim.ts`

In rough dependency order. None of this is large; the file is ~260 lines.

1. **Make `SimState` serialisable.** Replace the `random: () => number` closure with
   `randomState: number` plus a free function, so a slice can be persisted and resumed.
   Removes the `battleAt`-replays-from-zero cost curve entirely.
2. **Give each unit its own RNG stream.** Derive from `(seed, unitId, purpose)` so draws
   cannot couple across units. `procedural.ts` already has `hash01` for exactly this shape.
3. **Double-buffer the integration.** Compute all desired velocities from the old
   positions, then write. Removes the Gauss–Seidel order bias, and makes death-by-removal
   safe.
4. **Iterate by stable id, never by array position.** Deaths must not reorder the update
   sequence. Swap-with-tombstone rather than `splice`.
5. **Add target commitment.** Two rules, both from Graham's Inertia section: do not
   re-decide while `attackPhase >= 0`; require a challenger to beat the incumbent by a
   margin rather than by any amount. Measured to take mid-swing target flips from 12.4 % to
   0 %.
6. **Add a formation layer above targeting.** A per-side anchor point plus slot
   assignment; `desiredV` seeks the slot unless a committed target is within engagement
   range. Make slot order pure arithmetic on a linear index, filled centre-out, with odd
   ranks brick-offset by half an interval. This is the change that stops the rank s.d.
   climbing from 0.785 to 2.08.
6a. **Measure formation integrity and act on it.** RMS displacement of each unit from its
   slot, against an ideal of a quarter of the block's diagonal; when it exceeds the current
   behaviour's coherence tolerance, re-form. This turns the measured monotonic decay into a
   form / charge / dissolve / re-form rhythm, which is the visual difference between slice
   4 and slice 2.
6b. **Close gaps forward on death.** When a front-ranker dies, the unit behind takes the
   slot; drop an emptied rear rank. This is what makes a side's losses legible without a
   HUD — the block narrows and shallows rather than going sparse.
7. **Separate the separation radius from the engagement radius.** `SEPARATION_RADIUS`
   (1.05) is currently larger than melee fodder standoff (0.9), so an attacker is pushed
   out of its own standoff by the target it is attacking. Separation should apply between
   allies at full strength and between engaged enemies at reduced strength, and should
   scale with tier — a hero is 1.25× taller and currently claims the same 23 px of personal
   space as fodder.
8. **Make the attack a decision with a wind-up, not a clip with a wind-up.** Give the
   attack an explicit committed target captured at the moment it starts, so damage cannot
   land on a unit the swing never addressed.
9. **Fix the hero cadence.** Hero melee cooldown 1.6 s vs fodder 1.9 s makes heroes the
   *most* frequent attackers on screen. Invert it: heroes should be the rarest and
   longest-telegraphed motion in the frame.
10. **Bind the timestep.** `stepBattle` should not accept an arbitrary `dt`.

Items 1–4 are determinism hygiene and are cheap. Items 5–9 are the ones with pictures
attached.

---

## Art-visible choices, consolidated

Every item here changes what appears on screen and therefore belongs in the conversation
with [#64](https://github.com/arnavp103/hazard-pay/issues/64) and
[#69](https://github.com/arnavp103/hazard-pay/issues/69).

| Choice | Visible consequence |
|---|---|
| Formation layer vs. pure nearest-enemy | Whether slices 2–10 look different from each other, or all look like the same scrum |
| Target commitment | Whether a wind-up predicts where the damage lands — and whether corpses must persist ~700 ms to cover the follow-through |
| Corpse persistence | Directly coupled to the above; also whether the crowd visibly thins |
| Stable vs. re-solved slot assignment on death | Whether a line thins gracefully or reshuffles after every casualty |
| Per-tier avoidance time horizon | Heroes bull through the press, fodder scatter around it — hero findability for free |
| Hero attack cadence | Whether the hero is the eye's anchor or just another swinging body among 13 |
| Separation radius scaled by tier | Whether a hero has visible personal space or is jostled like fodder |
| Weighted-random among near-tied targets | Whether 20 units make visibly different choices or all lunge the same way |
| Engagement staggering | Whether contact is one wall-meets-wall moment or a rolling series of readable duels |
| Quantised vs. continuous facing | Quantised facing plus hysteresis hides sub-degree steering jitter that continuous facing exposes |
| Slot index driving pose | Front rank, edge and interior become visibly different shapes — one of the few pose distinctions that survives 28 px |
| Brick-offset vs. lattice ranks | Whether a block reads as bodies or as a texture |
| Formation tempo per arrangement | The strongest formation-identity channel at this figure size; a wall reads because it is slow |
| Regroup driven by measured integrity | Whether the fight breathes (form / dissolve / re-form) or slides once into scrum |
| Gaps closing forward on death | Whether losses are legible without a HUD — the block narrows rather than going sparse |
| Hero death breaking fodder organisation | The cheapest and strongest hero-legibility cue available; one global motion change beats any per-body detail |
| Matched vs. synced attack animation | Heroes can carry paired contact; fodder cannot, and should get one clip plus N independent reactions |

---

## What did not survive the filter

Cut, with the reason and the scale each source was actually addressing.

- **Flow-field tiles.** Emerson's technique exists to move "hundreds to thousands of
  individual agents across massive maps" and he closes by recommending it "in RTS games
  with hundreds to thousands of agents". Its whole architecture — portal graph, merging
  A*, flow-field cache — amortises *one path across many agents sharing a destination*. In
  an auto-battler each unit closes on a different enemy, so amortisation is zero. The one
  transferable detail is his line-of-sight shortcut: agents that can see the goal "ignore
  the Flow field results altogether and just steer toward the exact goal position" — which
  in an open arena is 100 % of the time, i.e. "just seek the target". **Cut.**
- **Continuum Crowds.** Disqualifies itself in its own introduction: "Our formulation is
  designed for large groups with common goals, **not for scenarios where each person's
  intention is distinctly different**." Reported performance was 2–5 fps for 1 000–2 000
  people. 40 units with 40 distinct goals is the worst case for the technique. **Cut** —
  except for one observation kept above: a vortex forms wherever dense flows cross, as a
  property of the configuration rather than of any algorithm.
- **ORCA / RVO2 as the movement system.** Built and benchmarked at 1 000–5 000 agents; the
  reference config uses `maxNeighbors 10` at a 4 Hz timestep. At 40 units the guarantees
  are free but unnecessary, and the linear program introduces a determinism cliff (above)
  plus documented global deadlock in dense packing — 40 units freezing mid-melee is
  catastrophic here. **Cut as the system; a small-time-horizon force-based avoidance layer
  is kept as a safety net.**
- **Neighbour-count optimisation.** Recast's `DT_CROWDAGENT_MAX_NEIGHBOURS` is **6**;
  Reynolds' PS3 crowd considered the **5 nearest** at 15 000 agents. At 40 units the
  question does not arise, and nobody has demonstrated visual gain above ~8. **Cut.**
- **Total War's model, mostly.** Its hierarchy — decide at block level, resolve at body
  level — is the right *idea* and survives as the formation recommendation above. Its
  execution does not. A ~100-man unit's legibility rests on the block being large enough
  that its silhouette is an unambiguous shape at distance; at 18–20 fodder per side you
  have roughly *one Total War unit's worth of men in total*, so formation legibility has to
  come from spacing, tempo and pose instead of from mass. Its rendering and LOD work
  (instancing, imposters, order-independent transparency) targets thousands of skinned
  meshes; at 40 bodies there is per-body animation budget CA never had. **Idea kept,
  implementation cut.**
- **Deep formations.** Under a fixed 30° elevation camera, ranks three and beyond are
  largely occluded — depth costs bodies and buys almost no read. The interesting axis is
  the one across the screen. **Go wide and shallow.**
- **Nested formations-of-formations.** Real and correct at army scale; at 4–6 blocks per
  side the second level of hierarchy has nothing to organise. **Cut.**
- **Matched (two-skeleton) combat animation for fodder.** Combinatorial authoring cost that
  does not shrink with figure size, payload that does not survive the downscale. Synced
  reactions instead. **Cut for fodder, kept for heroes.**
- **Behaviour trees for their own sake.** BTs manage authoring complexity. There is no
  authoring complexity here — a fodder unit has perhaps four states. **Cut.**
- **Every performance-motivated technique.** Measured above: 40 units cost 15 ms per
  4-second slice, and a heavy utility layer adds 26 ms. LOD-ing AI updates, bucketing
  agents across frames, spatial hashing, and SIMD crowd solvers all solve a problem this
  project does not have. **Cut.**

---

## Sources

Primary sources, in order of usefulness to this question.

- Jurney, C. "Company of Heroes Squad Formations Explained." *AI Game Programming Wisdom 4*,
  §2.1, Charles River Media, 2008.
  [PDF](https://forum.arongranberg.com/uploads/short-url/rWod3K2KhNWcOEdjewnsLXQKU6A.pdf)
- Graham, D. "An Introduction to Utility Theory." *Game AI Pro*, ch. 9, CRC Press, 2013 —
  §9.7 Inertia in particular.
  [PDF](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter09_An_Introduction_to_Utility_Theory.pdf)
- Millington, I. and Funge, J. *Artificial Intelligence for Games*, 2nd ed., Morgan
  Kaufmann, 2009 — §3.7 "Coordinated Movement", pp. 143–171 (two-level steering, anchor
  points, slot roles, the assignment problem).
- Isla, D. "Building a Better Battle: The Halo 3 AI Objectives System." GDC 2008.
  [Slides](https://web.cs.wpi.edu/~rich/courses/imgd4000-d09/lectures/halo3.pdf) ·
  [Recording](https://archive.org/details/GDC2008Isla)
- TaleWorlds Entertainment. *Mount & Blade II: Bannerlord* Combat AI dev blog, 2018
  ([mirror](https://www.gamebanshee.com/news/121465-mount-blade-ii-bannerlord-developer-blog-combat-ai.html)),
  read alongside the decompiled `TaleWorlds.MountAndBlade` 1.2.x tree
  ([mirror](https://github.com/iniznet/Bannerlord.Modules.Source/tree/1.2.x/Core/TaleWorlds.MountAndBlade))
  — `Formation.cs`, `LineFormation.cs`, `ArrangementOrder.cs`, `FormationQuerySystem.cs`,
  `BehaviorRegroup.cs`, `FormationAI.cs`.
- Cooper, J. "Animation Bootcamp: Animating *The 3rd Assassin*." GDC 2013.
  [Recording](https://archive.org/details/GDC2013Cooper)
- Mann, S. (Creative Assembly) on matched combat, in
  [PCGamesN's *Total War: Warhammer* reveal interview](https://www.pcgamesn.com/total-war-warhammer/total-war-warhammer-revealed-creative-assembly-unleash-a-beast).
- Francis, B. "How Landfall Games finds the fun in physics engines." *Game Developer* —
  quotes Wilhelm Nylund and Petter Henriksson on TABS' active-ragdoll implementation.
  [Article](https://www.gamedeveloper.com/design/how-landfall-games-finds-the-fun-in-physics-engines)
- Reynolds, C. "Steering Behaviors For Autonomous Characters." GDC 1999.
  [Paper](https://www.red3d.com/cwr/steer/gdc99/)
- Reynolds, C. "Flocks, Herds, and Schools: A Distributed Behavioral Model." SIGGRAPH 1987.
  [Paper](https://www.red3d.com/cwr/papers/1987/boids.html)
- Reynolds, C. "Big Fast Crowds on PS3." Sandbox Symposium 2006.
  [PDF](https://www.red3d.com/cwr/papers/2006/PSCrowdSandbox2006.pdf)
- Guy, S. and Karamouzas, I. "A Guide to Anticipatory Collision Avoidance."
  *Game AI Pro 2*, ch. 19, CRC Press, 2015.
  [PDF](https://www.gameaipro.com/GameAIPro2/GameAIPro2_Chapter19_Guide_to_Anticipatory_Collision_Avoidance.pdf)
- Terrano, M. and Bettner, P. "1500 Archers on a 28.8: Network Programming in Age of
  Empires and Beyond." GDC 2001.
  [PDF](https://zoo.cs.yale.edu/classes/cs538/readings/papers/terrano_1500arch.pdf)
- Emerson, E. "Crowd Pathfinding and Steering Using Flow Field Tiles." *Game AI Pro*,
  ch. 23, CRC Press, 2013.
  [PDF](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter23_Crowd_Pathfinding_and_Steering_Using_Flow_Field_Tiles.pdf)
- Treuille, A., Cooper, S. and Popović, Z. "Continuum Crowds." ACM TOG 25(3) / SIGGRAPH
  2006, pp. 1160–1168.
  [PDF](https://grail.cs.washington.edu/projects/crowd-flows/continuum-crowds.pdf)
- van den Berg, J., Guy, S., Lin, M. and Manocha, D. "Reciprocal n-Body Collision
  Avoidance." ISRR 2009 / *Springer Tracts in Advanced Robotics* 70, pp. 3–19.
  [PDF](https://gamma.cs.unc.edu/ORCA/publications/ORCA.pdf)
- Fiedler, G. "Fix Your Timestep!" gafferongames.com.
  [Article](https://gafferongames.com/post/fix_your_timestep/)
- Mononen, M. et al. `DetourCrowd/Source/DetourCrowd.cpp`, recastnavigation.
  [Source](https://github.com/recastnavigation/recastnavigation)
- ECMA-262, §4.4.1 (*implementation-approximated*) and §21.3 (*The Math Object*).
  [Spec](https://tc39.es/ecma262/)

Measurements in this document were produced against
`origin/prototype/flat-procedural-lane:apps/webapp/src/match-proto/flat-procedural/`
(`sim.ts`, `animator.ts`, `procedural.ts`, `figure.ts`, `scene.ts`) as of 2026-07-26.

### Not verified

- **StarCraft II unit movement.** Anhalt, Kring and Sturtevant presented it at GDC 2011
  ("AI Navigation: It's Not a Solved Problem — Yet"), but the talk is behind GDC Vault and
  could not be checked. Secondary accounts describe a constrained-Delaunay navmesh with
  boids-style steering; treat as unverified.
- **Total War's "individual soldiers are slaved to formation slots".** No Creative Assembly
  primary states this in so many words. It is a well-founded inference from Mann's
  matched-combat quote and from the moddable `descr_formations_ai.txt` /
  `config_ai_battle.xml` data files — treat as inference, not fact. The widely-repeated
  three-layer description of Total War's AI, and the neural-network claim for unit
  movement, come from Tommy Thompson's *AI and Games* write-ups rather than from CA.
- **The 28 px paired-animation assessment.** No source measures animation readability at a
  specific pixel height. §6's conclusion is argued from figure geometry plus the
  silhouette-first principles CA and Blizzard both state, not cited.
- **TABS' internal AI layer.** The distance-keeping modifier types are visible to modders
  and documented in community modding guides, not by Landfall.
