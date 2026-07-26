# Rain World creature AI, and what transfers to a 40-body auto-battler

Research date: 2026-07-26

Context: [combat mechanics and unit AI #95](https://github.com/arnavp103/hazard-pay/issues/95).
Companion to `unit-ai-crowd-combat.md`, which surveys steering, utility AI, behaviour
trees and the auto-battler prior art. This document covers Rain World specifically —
what it adds that those did not.

## Recommendation

Take **four** mechanisms and leave the rest.

1. **Cost-field coordination.** Let each unit price the space it is considering moving
   through, and let fear, packmates and threat all enter as *resistance* rather than as
   behaviour states. This is a direct answer to the formation problem measured in
   `unit-ai-crowd-combat.md` — rank depth s.d. climbing 0.785 → 2.08 with no restoring
   force — and it composes with a formation-slot layer rather than competing with it.
   Slots decide where the line is; repulsion decides how bodies distribute around a
   contact point.
2. **Target commitment as a per-archetype float.** Rain World ships exactly the
   mechanism our own measurements call for, including the deliberately-flighty case.
3. **Personality derived from unit id**, feeding both motion jitter and silhouette.
   Costs a seeded hash, buys visible individuality, and stays deterministic — which the
   slice model requires.

4. **Causal visibility.** Whichever channels stay legible at our scale — gait, tempo,
   facing, spacing — must be driven by the AI's own state, not by a decorative layer
   parameterised separately. A committed unit should *move* committed. This is the whole
   of what Rain World's legibility reduces to at 28px, and it costs nothing beyond wiring
   the right variables together.

Leave the AI map, the belief system, social memory, and the entire
abstraction/LOD apparatus. Each is load-bearing on something Hazard Pay does not have.

**The framing worth stealing wholesale**, from the GDC 2016 talk: *"AI is animation in
Rain World. You cannot really draw a line between the two."* Its necessary counterpart,
from the 2024 post-mortem: *"the AI very rarely — I tried to make it never — queries the
actual physics simulation."* Locomotion fused to AI; deliberation firewalled from the
body.

**One thing to get the right way round:** Rain World's famous clumsiness is a *tolerated
byproduct*, not an authored effect. Do not budget for expressive failure as a feature.

## How it actually works

Five layers. Two baked offline, three live.

### 1. The AI map (baked)

Every room ships with navigation data precomputed and Base64'd into line 11 of the
room file. Baking is a separate authoring step — the modding docs describe it as
"computationally-intensive… minutes for larger rooms that add up to hours for an entire
region."

Each tile carries an **accessibility class** in a total order —
`OffScreen > Floor > Corridor > Climb > Wall > Ceiling > Air > Solid` — plus floor
altitude, smoothed floor altitude (fall risk), terrain proximity, a narrow-space flag,
water class, and a **visibility** count: how many of the surrounding 101×101 tiles have
unobstructed line of sight to it.

Tiles link by **movement connections**, generated from geometry by local stencil tests
and never hand-authored. There are 24 types, including `ReachOverGap`, `DoubleReachUp`,
`DropToWater`, `LizardTurn`, `OpenDiagonal`, `ShortCut`, `BigCreatureShortCutSqueeze`,
`SkyHighway`, `SeaHighway` and `RegionTransportation`.

### 2. One graph, many locomotions

This is the elegant part, and the answer to how a scavenger, a lizard and a vulture
share one map. They share the graph. They differ only in a **resistance vector over
edge types**.

`CreatureTemplate` takes `List<TileTypeResistance>` and `List<TileConnectionResistance>`
at construction, expanded into `pathingPreferencesTiles[]` (indexed by accessibility
class) and `pathingPreferencesConnections[]` (indexed by movement type). The lizard
template's actual values:

| Connection | Resistance |
| --- | ---: |
| `Standard` | 1 |
| `ReachUp` / `ReachDown` | 2 |
| `Climb` | 2.5 |
| `OpenDiagonal` / `ReachOverGap` | 3 |
| `BetweenRooms` | 10 |
| `DropToFloor` | 20 |
| `NPCTransportation` | 25 |

A vulture's vector makes `SkyHighway` cheap and `Corridor` unusable. Same graph,
completely different route topology, zero duplicated map data.

`PathCost` is a **pair**, not a scalar:
`struct PathCost { Legality legality; float resistance; }` with
`Legality ∈ {Allowed, Unwanted, IllegalConnection, IllegalTile, SolidTile, Unallowed}`.
Concatenation sums resistance and takes the *worst* legality; comparison is
lexicographic, legality first. "Legal but long" always beats "short but illegal", and
the pathfinder degrades to a best-effort illegal path rather than failing.

### 3. Pathfinding, and emotion as terrain

Goal-outward flood fill; Dijkstra with A\* heuristics, time-sliced across frames.
Jakobsson: *"as one path is being followed, the next is being calculated… optimized for
having several creatures chasing moving targets. Contrary to an RTS rain world will have
almost only moving targets."* A global `PathfinderResourceDivider` rations CPU across
creatures; cells carry a `pathGeneration` stamp so the grid is invalidated rather than
cleared.

Two details matter more than the algorithm.

**Accessibility is computed both ways** — "can I get to this tile?" *and* "if at this
tile, can I get back?"

**The pathfinder asks the AI to price each tile.**
`ArtificialIntelligence.TravelPreference(MovementConnection, PathCost)` is a virtual the
creature overrides. Jakobsson: *"If the tile is close to a creature the lizard is scared
of the AI will return a higher value, and the path finder will subsequently not favor
paths through that area… How scared the lizard is of rain at the moment is factored in,
as well as how scared it is in general, if it's angry."*

Emotion is a cost field, not a state machine. **This is the single most transferable
idea in the system.**

Its best demonstration: yellow lizards appear to flank. There is no formation system, no
roles, no plan. Non-leader pack members add
`InverseLerp[0,300,dist] · 200/(n−1)` resistance near packmates, plus `300/(n−1)` if a
packmate occupies the tile; the leader is exempt. Bodies spread around a target because
clustering is expensive, and players read encirclement.

### 4. Perception: ghosts

Each creature holds 5–10 `CreatureRepresentation`s. When line of sight breaks, the
tracker does not store a last-known position — it spawns **ghosts** that walk the
movement-connection graph as if they were the target, branching at junctions into child
ghosts (`generation + 1`, capped at 3, or 5 for lizards), avoiding the observer's line of
sight and refusing to backtrack. Colliding ghosts destroy the higher generation. If the
creature arrives and the target is absent, it "pushes" the ghost, which jumps away and
takes five immediate moves.

Jakobsson: *"The lizard AI is only ever able to ask for the ghost's position, never the
actual player's… if you're diverging from the path the lizard assume you'd take, you
have a chance to trick it."*

A branching particle filter over the nav graph. Confidence decays as `Find`: 100% while
visible, exponential for 4.25s, then 1/t.

Note the deliberate asymmetry: *"the creatures are always aware of the terrain layout,
though they are not omniscient as to where other creatures currently are."* Hidden
knowledge is spent only where it buys trickability.

### 5. Arbitration: modules and utility

`ArtificialIntelligence` is nearly empty — *"basically nothing going on in it except an
empty list of modules."* One subclass per species (~25 of them). `AIModule`'s entire
surface is `Update()`, `NewRoom()`, `Utility()`. Everything is a module, including the
pathfinder and the tracker.

Utility modules return 0–1 urgency and `UtilityComparer` picks the winner. Its
registration signature is the whole design:

```
AddComparedModule(AIModule module, FloatTweener.FloatTween smoother,
                  float weight, float continuationBonus)
```

Jakobsson: *"It also applies a conservative bias (ie whatever is currently being done
should get a little bonus, to keep the creature from flickering between behaviors)."*

He **considered behaviour trees and rejected them**, naming the reason: *"Rain World AI
is about Decision Making, not Problem Solving."* The goal was **trickability** — smart
enough that outsmarting it feels earned.

Smoothing is per-species and **asymmetric**, and that asymmetry *is* the temperament:

| Species | Threat utility response |
| --- | --- |
| Lizard | +50% of gap instantly, decay 0.0025/tick (~7s) |
| Scavenger | ±1/30 symmetric |
| Miros Bird | 0.9 × target, no smoothing |

`RelationshipTracker` routes perception into modules by relationship type:
`Eats/Attacks/Antagonizes` → `PreyTracker`, `Afraid` → `ThreatTracker`,
`AgressiveRival` → `AgressionTracker`. Changing one opinion re-routes a creature into a
different subsystem.

`PreyTracker` carries **explicit target commitment**: switch only if a challenger's
attractiveness exceeds the incumbent's × a per-species persistence bias.

| Species | Persistence bias |
| --- | ---: |
| Stowaway | 8.0 |
| Long Legs | 6.0 |
| Lizard, Big Spider | 2.0 |
| Scavenger | 1.0 |
| Firebug | 0.9 (deliberately flighty) |

### Memory and personality

**Three tiers.** A hand-authored directed species matrix (~65 species, ~4,200 ordered
pairs, managed through template inheritance so `LizardTemplate` covers 15 species at
once). A region × community **reputation matrix**. And per-individual social memory —
`like, tempLike, fear, tempFear, know`.

Jakobsson: *"there is also a lasting memory which will persist for as long as that
lizard is alive… The 'know' parameter is a modifier to changes in the relationship…
your first impressions are most important."* Changes scale by `1 − 0.9·know`;
end-of-cycle decay applies only within ±50%, so strong opinions never fade, and
memories inside ±25% are discarded entirely.

**Personality** is six traits derived from the creature's entity id as RNG seed — three
independent (sympathy, energy, bravery), three derived (nervous, aggression, dominance).
Zero storage. The same seed drives cosmetics: *"Dominance has an impact on antler size
and general body size."* The dominant scavenger is *shaped* like one.

## Procedural animation, and how it couples to the AI

### The coupling runs one way, and there is a firewall

Two statements from Jakobsson, taken together, define the architecture.

Locomotion and AI are the same thing:

> "**AI is animation in Rain World. You cannot really draw a line between the two.**
> Basically the AI has like the overarching unit which will make decisions… where should
> I go, where should I move to. But then you also have the locomotion AI, and **the
> locomotion AI is equally animation as it is AI**… where to put my limbs, how to orient
> myself, how to basically move through the world, and **that entire thing is informed by
> the environment around the creature.**" — GDC 2016, ~13:34

Deliberation, however, is sealed off from the body:

> "**the AI very rarely — I tried to make it never — queries the actual physics
> simulation.** The AI is not able to just reach into the game code and grab your
> position; instead the AI is able to ask its internal model about where it believes you
> to be." — AI and Games Conference 2024, ~10:56

So: **locomotion fused to AI, deliberation firewalled from physics.** Position is
believed (via the ghosts), never read.

The same one-way rule governs the visual layer:

> "**These two systems have a one-way dependence. The complex cosmetics are dependent on
> the simple physics simulation but not the other way around.**… the dangly bits on the
> right hand side, those are fairly processor intensive… but they don't need to happen
> unless you're actually viewing it, because **they don't inform anything that has to do
> with how it interacts with other objects.**" — GDC 2016, ~09:36

Grip and contact logic are sim-side; tails, feathers and scales are the cullable layer.

### What the animation buys the AI: causal visibility

This is the load-bearing argument, and it is Therrien's:

> "With procedural animation we can create a scenario where **the AI behavior equals the
> behavior that you're seeing in the game.**… The player will say 'oh, this creature is
> mad at me.' Now that's not really the case, but because we have all of the ingredients
> visible, it makes this kind of effect of personality… It's different than if you were
> to have a blackbox scenario. **With procedural animation you have a visible cause and
> effect.**" — GDC 2016, ~06:34

Jakobsson's shorter version, from the 2024 post-mortem: *"Is the lizard angry, or is the
A\* flipping out?"*

The strongest evidence that this produces projection rather than perception:

> "Many people have mentioned seeing the slugcat claw at a ledge to get up — **a behavior
> I have in fact never specifically implemented.**" — devlog p.072, 2015-10-22

### The clumsiness is tolerated, not designed

Worth stating plainly, because it is easy to get backwards. The famous awkwardness is an
accepted byproduct, not an authored effect:

> "It's difficult to get the creatures to move… gracefully. **The reason is that the
> animation isn't animated frame-by-frame, instead it's all AI driven, and I can only
> make those AI behaviors so good.** My animation technique could probably hardly be
> applied to a horse, dog or human for this reason." — devlog p.077, 2016-01-19

The dragging-limb look often cited as characterful was a bug fought over several devlog
updates. The one imperfection claimed as a positive is narrow — randomness in the grip
search: *"you might not always get the absolute ideal position, but you will get a
goodish one. And I actually think that that little bit of randomness to it adds some
character."* The rest is covered by a fiction dodge: *"No one has seen them in real life.
So you don't know what they are supposed to move like… you have to give them the benefit
of the doubt."*

**Do not budget for expressive failure as a feature.** It is what you tolerate, plus a
licence bought with creature design.

### Limbs and terrain

`Limb.FindGrip` probes room geometry directly, but the animation/navigation boundary is
drawn **per species**, not once. Daddy Long Legs tentacles use two layers, the outer one
in tile space:

> "Those tentacles are composed of two main components, the semi-transparent 'ghost
> tentacles' which **work in tile space and make sure that they never overlap terrain**,
> and the jointed physics tentacles on top… The creature **ray-traces from its body
> downwards** trying to find a good grip position, and when it does so **path-finds a way
> to it in tile space**… **The elbow bends are accomplished with a simple inverse
> kinematic formula.**" — devlog p.066, 2015-07-28

The grip search itself is **random-sample hill-climbing on a scored position field**:

> "I have a method that can assign a score for each position in the room… **Each frame the
> leg locomotion algorithm picks a random position in the room. If the random position
> has a higher score than the current temp position the temp position is moved to the
> random position.**" — devlog p.080, 2016-03-21

> "Why not just check every position and then pick the best one? Because that's very
> intense on the processor." — GDC 2016, ~19:38

**One RNG draw per limb per frame, by design.** Note this directly for our purposes.

And the payoff is admitted illusion:

> "the fewer tentacles that are contacting terrain, the more the body is affected by
> gravity… the more tentacles, the faster the body is allowed to move towards its goal…
> It actually looks like this creature is supporting itself by the tentacles, **which is
> not at all the case. It's just floating through the air.**" — GDC 2016, ~21:38

### What this means at 28px

The mechanism is **not fidelity, it is causal visibility**: the state the AI acts on is
the state the body visibly expresses, so attribution is available to the player. At 28px
a limb is invisible — but **gait, tempo, facing and spacing** are not.

So the transferable rule is one line: **whichever channels stay legible at our scale must
be driven by the AI's own state, not by a decorative layer parameterised separately.** A
unit that is committed should *move* committed; a unit whose stuck-counter is climbing
should *move* like it. Cheap, and it is the whole of what Rain World's legibility reduces
to at our scale.

Two constraints to carry:

- **The grip search's per-limb-per-frame RNG draw is a determinism hazard.** Our slice
  model requires bit-reproducibility across a boundary. Any Rain-World-style stochastic
  solver must draw from a per-unit seeded stream (`(seed, unitId, purpose)`), never a
  shared generator, or slices will not reproduce.
- **Physics-driven bodies do not automatically survive the scale drop.** Rain World spends
  its budget on a body that reads at a zoom we do not have; we already have a procedural
  layer stack (`bind → cycle → attack → aim → lean → reactions → root → weapon IK`), and
  the finding here is not "add physics" but "make sure the channels that survive are
  wired to AI state."

Also worth knowing: the coupling is tight enough to be a design constraint in itself —
*"No other creatures than the slugcat will be playable. The locomotion is intimately
connected to the AI, so it's not easy to just turn the AI off and hook it up to an
input."* (devlog p.076). And the camera trade was deliberate: *"I decided that a lot of
games had moving cameras, but few had procedural animation and complex AI"* (p.031),
which is the same trade a fixed dimetric camera already makes.

**No per-creature CPU figure exists** in any developer statement — no ms/frame, no chunk
counts by species, no profiler output. The physics tick is confirmed at 40 Hz with
graphics interpolated above it. Their stated posture: *"write the easiest, cleanest
solution, and then if there is a performance problem optimize it."*

## What is myth

Rain World's AI has accumulated a lot of folklore. Four corrections, each sourced:

- **"Fully simulated offscreen."** False. Abstract rooms are node graphs, traversed on a
  timer; predation reduces to *"4% risk of eating per tick while they occupy the same
  node."* A true whole-world simultaneous sim was built and abandoned: *"We did a test
  where we tried to put 4 regions together… It worked, but with really bad performance."*
  All non-abstract state is destroyed on abstractization.
- **"Many creatures with deep AI."** False. `RoomRealizer.performanceBudget = 1500`,
  constant. Leviathan 300, Scavenger 300, Rain Deer 200, Vulture 100, Lizard 50,
  Dropwig 20, default 10. **The entire realized world is roughly 30 lizards, or 5
  scavengers, across all loaded rooms.** Rain World runs a handful deeply and abstracts
  aggressively.
- **"That lizard remembers me."** True and precisely specified, but bounded: opinions
  inside ±25% are wiped at cycle end, and a killed creature respawns with a **new entity
  id** — new personality, no memory. Persistence lives at the den, not the individual.
- **"The ecosystem is emergent."** Overstated. Room attraction, dens, spawn counts,
  lineages, kill-squad timers and the species matrix are all hand-authored. Jakobsson
  concedes: *"we eventually gave in and created a tool where certain rooms could be
  assigned as more attractive to certain creatures, to give a bit of cohesion."*

And on the reputation itself — Therrien at GDC, on players reading emotion: *"the player
will say 'oh, this creature is mad at me.' Now, that's not really the case, but because
we have all of the ingredients visible, it makes this kind of effect of personality."*
Jakobsson: *"I'm very much aware that these individual personality traits probably never
will become evident to the player."*

That is **good news**. The projection is cheaper than the simulation.

## What transfers to Hazard Pay

### Transfers

- **Cost-field coordination.** The strongest import, and it attacks a measured problem:
  depth s.d. rises monotonically to 2.08 because nothing represents the line. A
  packmate-repulsion term in movement cost supplies a restoring force *without* a
  coordinator, and composes with slots rather than competing.
- **Target commitment as a per-archetype float.** Directly the 12.4% → 0% mid-swing-flip
  result in `unit-ai-crowd-combat.md`, and the Firebug case (0.9) shows how to author a
  deliberately flighty unit with the same knob.
- **Utility with a continuation bonus and per-archetype asymmetric smoothing.** A
  20-consideration utility pass measured at ~26 ms per 4-second slice for 40 units, so
  cost is not a constraint. Take the shape — the continuation bonus especially.
- **Personality from one seed, driving motion and silhouette.** At 22–48px, stats are
  unreadable and silhouette is not.
- **Lexicographic `PathCost`.** Useful anywhere "prefer legal, never fail" is wanted.

### Does not transfer

- **The AI map.** Its entire value is encoding heterogeneous locomotion through
  hand-authored 2D geometry — poles, tubes, shortcuts, ceilings. A flat plaza collapses
  24 connection types to one. Do not build a tile graph; there is no terrain to encode.
- **Ghosts.** Load-bearing on a free camera, occlusion, and a player who can hide. A
  fixed camera with no fog of war and no avatar makes belief trivially exact — pure cost,
  zero visible output.
- **Social memory and reputation.** Need a persistent world across cycles *and* a player
  avatar to hold opinions about. A bounded match has neither. Note also that reputation
  existed to solve a **difficulty-tuning** problem, not to simulate anything.
- **Denning, migration, abstract space, lineage, the LOD budget.** All exist to decide
  what to *stop* simulating in a persistent open world. One plaza, 40 bodies, all on
  camera, 0.067 ms/step — there is nothing to LOD.

### The honest tension

Rain World's legibility assumes a player-controlled camera watching **one** creature for
several seconds. A 7-second fear decay is readable under those conditions and invisible
across 40 bodies at 28px — `unit-ai-crowd-combat.md` measured the general form of this
already: 42% of the army is mid-wind-up at any instant, so 17 simultaneous telegraphs is
no telegraph.

**Slow smoothed utility curves are therefore the least transferable of Rain World's
mechanisms, despite being the most architecturally central.** Prefer what expresses
instantly and structurally: commitment, cost-field spreading, silhouette variation.

## Not verified

- **Method bodies.** No public source for `ArtificialIntelligence.Update()`,
  `UtilityComparer.Update()` or `AbstractCreatureAI.AbstractBehavior()`. Doxygen gives
  signatures only; how `weight`, `exponent` and `continuationBonus` combine is inference.
  Only the *names* are confirmed.
- **Abstract tick interval.** "Every few frames" per the modding wiki; no constant found.
- **Quantified creatures.** `CreatureTemplate.quantified` and
  `AbstractRoom.quantifiedCreatures` exist, and batflies were described as *"a bat is a
  fly is a bat"* — but the modding wiki annotates the field "what the hell is this 2d
  array." Semantics unconfirmed.
- **Where social memory is serialized.** Cross-cycle persistence is certain (there is a
  decay law, and a jetfish is reported remembering across a save). Save format not found.
- **GDC 2016 quotes are ASR-derived**, not certified verbatim; GDC Vault gates the video.
- **Lizard resistance numbers** come from a MonoMod patch reproducing vanilla
  `StaticWorld` — high confidence, but secondhand.
- **All video quotes are ASR-derived** and carry timestamps so they can be checked before
  being quoted anywhere public. GDC Vault's copy is paywalled, so the free YouTube version
  cannot be confirmed unedited — though it is on GDC's own channel.
- **A February 2025 Dublin talk** billed as covering "procedural animation, creature AI,
  and the intersection between the two" could not be confirmed to have happened at all —
  no recording, no archive, no Wayback capture, and the organiser's event pages 404. The
  AI and Games 2024 post-mortem is the substitute and is the better source.
- **The Anifilm 2019 redelivery** reportedly contains lizard-leg material absent from the
  GDC version, but its auto-captions are unusable; it would need a human transcription
  pass.
- **No per-creature CPU cost** is stated anywhere by the developers. The only quantity
  offered is *"there might be many creatures active at the same time. Sometimes
  hundreds"* — hedged in the talk itself, and reconcilable with the 1500 budget only if
  "active" means abstract-space creatures.

## Sources

Primary, developer:

- [TIGSource devlog "Project Rain World"](https://forums.tigsource.com/index.php?topic=25183.0)
  — JLJac (Joar Jakobsson), 1,078 posts 2012–2018. Key posts by id: `msg1037321`
  (accessibility both ways), `msg1039525` (incremental moving-target pathfinding),
  `msg1041985` (abstract node space), `msg1044428` ("4% risk of eating per tick"),
  `msg1062284` (baked per-species Dijkstra maps), `msg1064243` (relationship framework),
  `msg1095345` (emotion-weighted travel preference), `msg1104223` (module/utility
  architecture), `msg1131567` (three simulation resolutions), `msg1210078` (personality
  stats), `msg1235841` (social memory and reputation matrix). The live site is
  Cloudflare-gated; recoverable via the Wayback `printpage` snapshot, or the page mirror
  at `https://raw.githubusercontent.com/CandleSign/Rain-World-Devlog/main/Pages/NNN.html`
  (branch `main`, pages 001–096). Animation-relevant pages: **031** (the camera trade),
  **058** (chunks and `ConnectChunks`, with actual C#), **066** (ghost tentacles and IK),
  **072** (the never-implemented ledge claw; 40 Hz physics tick), **076** (why only the
  slugcat is playable), **077** (why graceful motion is hard), **080** (the grip
  algorithm, written because the GDC video was paywalled).
- [GDC 2016, "The Rain World Animation Process"](https://www.youtube.com/watch?v=sVntwsrjNe4)
  — Jakobsson and Therrien. ASR captions.
- [AI and Games Conference 2024, "Rain World: An AI Post-Mortem"](https://www.youtube.com/watch?v=7wZmOEovSdc)
  — London, November 2024. The source for the AI-never-queries-physics firewall and the
  "is the lizard angry, or is the A\* flipping out?" framing.
- [AnimState pre-GDC interview, March 2016](https://www.youtube.com/watch?v=D2r7bfaJmYc)
- [IGDA Italy "Dev on Air", January 2021](https://www.youtube.com/watch?v=vlMTnuGGNxM)
  — the best spoken account of the utility architecture and the
  they-don't-know-where-you-are design. ASR captions.
- [Crafting the complex, chaotic ecosystem of Rain World](https://www.gamedeveloper.com/design/crafting-the-complex-chaotic-ecosystem-of-i-rain-world-i-)
  — Game Developer, 2017.
- [Exploring procedural design in Rain World](https://unity.com/blog/exploring-procedural-design-rain-world)
  — Unity, 2025. Note its AI-module list is stated by Akupara Games, not Videocult.

Code-level:

- [Doxygen dump of decompiled `Assembly-CSharp`](https://mszegedy.github.io/rw-api-doc/html/)
  — `ArtificialIntelligence`, `AIModule`, `UtilityComparer`, `DenFinder`, `Tracker`,
  `RelationshipTracker`, `AImap`, `AItile`, `CreatureTemplate`, `PathCost`,
  `AbstractCreatureAI`.
- Rain World modding wiki:
  [Room File Format](https://rainworldmodding.miraheze.org/wiki/Room_File_Format),
  [Baking](https://rainworldmodding.miraheze.org/wiki/Baking),
  [LOD](https://rainworldmodding.miraheze.org/wiki/Rain_World_Code_Structure/LOD),
  [World](https://rainworldmodding.miraheze.org/wiki/Rain_World_Code_Structure/World).
- alphappy's reverse-engineering wiki (serve with a browser UA, `?action=raw`):
  [Movement connections](https://rainworld.miraheze.org/wiki/User:Alphappy/Live/AI_map/Movement_connections),
  [AI map](https://rainworld.miraheze.org/wiki/User:Alphappy/Live/AI_map),
  [Pathfinder](https://rainworld.miraheze.org/wiki/User:Alphappy/Live/Modules/Pathfinder),
  [Basic tracker](https://rainworld.miraheze.org/wiki/User:Alphappy/Live/Modules/Basic_tracker),
  [Prey tracker](https://rainworld.miraheze.org/wiki/User:Alphappy/Live/Modules/Prey_tracker),
  [Threat tracker](https://rainworld.miraheze.org/wiki/User:Alphappy/Live/Modules/Threat_tracker),
  [Social memory](https://rainworld.miraheze.org/wiki/User:Alphappy/Live/Social_memory),
  [Personality](https://rainworld.miraheze.org/wiki/Behavior/Personality),
  [Entity ID](https://rainworld.miraheze.org/wiki/Technical_Glossary/Entity_ID),
  [Abstractization](https://rainworld.miraheze.org/wiki/Technical_Glossary/Abstractization),
  [Yellow Lizard travel preference](https://rainworld.miraheze.org/wiki/Yellow_Lizard/Travel_Preference).
