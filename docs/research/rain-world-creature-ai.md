# Rain World creature AI, and what transfers to a 40-body auto-battler

Research date: 2026-07-26

Context: [combat mechanics and unit AI #95](https://github.com/arnavp103/hazard-pay/issues/95).
Companion to `unit-ai-crowd-combat.md`, which surveys steering, utility AI, behaviour
trees and the auto-battler prior art. This document covers Rain World specifically —
what it adds that those did not.

## Recommendation

Take **three** mechanisms and leave the rest.

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

Leave the AI map, the belief system, social memory, and the entire
abstraction/LOD apparatus. Each is load-bearing on something Hazard Pay does not have.

**The framing worth stealing wholesale**, from the GDC 2016 talk: *"AI is animation in
Rain World. You cannot really draw a line between the two."*

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
- **A February 2025 Dublin talk** billed as covering "procedural animation, creature AI,
  and the intersection between the two" is potentially the best single source. No
  recording found.

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
  Cloudflare-gated; recoverable via the Wayback `printpage` snapshot.
- [GDC 2016, "The Rain World Animation Process"](https://www.youtube.com/watch?v=sVntwsrjNe4)
  — Jakobsson and Therrien. ASR captions.
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
