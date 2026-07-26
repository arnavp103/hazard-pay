# #100 battlefield space, round 2 — measured

Round 1 measured one board and one roster. Round 2 varies the two things
the reopen note says were never varied: **prop density** and **who is
fighting**. Same seed, same opening layout, same camera, same 20 seconds
everywhere — see `measure.ts`'s header for how far each number can be
trusted, and for one correction to a round-1 number.

## The density axis

One knob — how many authored props survive, chosen farthest-point from each
other and from `board.ts`'s existing masses. `dense` is round 1's board
unchanged; the spacing columns are outcomes of the knob, not the knob.

| density | authored props | props total | closest authored pair (tiles) | mean floor to nearest prop (tiles) | blocked tiles | walkable | board blocked |
| --- | --- | --- | --- | --- | --- | --- | --- |
| dense | 32 | 42 | 0.00 | 0.50 | 132 | 268 / 400 | 33.0 % |
| spread | 16 | 26 | 0.00 | 0.73 | 102 | 298 / 400 | 25.5 % |
| sparse | 8 | 18 | 1.00 | 0.96 | 86 | 314 / 400 | 21.5 % |

## Question 1 — does the formation plateau survive lower density?

#97's rank-depth s.d. Round 1's finding was that the plaza climbs and never
recovers while cover plateaus. The question is whether the plateau is a
property of cover or of *that much* cover.

| variant | t=0 | t=2 | t=4 | t=6 | t=8 | t=10 | t=14 | t=20 | t=26 | t=32 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A — open plaza | 0.81 | 1.00 | 1.46 | 1.92 | 1.95 | 1.96 | 2.01 | 2.10 | 2.14 | 2.12 |
| B — cover, dense (round 1) | 0.90 | 1.21 | 1.53 | 1.72 | 1.79 | 1.79 | 1.79 | 1.79 | 1.79 | 1.79 |
| B — cover, spread | 0.89 | 1.27 | 1.56 | 1.68 | 2.05 | 2.08 | 2.00 | 2.00 | 1.99 | 2.01 |
| B — cover, sparse | 0.87 | 1.16 | 1.30 | 1.84 | 2.04 | 2.04 | 2.05 | 2.00 | 2.20 | 2.21 |

Spread along the line (rank s.d.), same runs:

| variant | t=0 | t=2 | t=4 | t=6 | t=8 | t=10 | t=14 | t=20 | t=26 | t=32 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A — open plaza | 4.09 | 4.07 | 4.01 | 3.91 | 3.95 | 3.96 | 3.96 | 3.97 | 3.98 | 4.02 |
| B — cover, dense (round 1) | 4.11 | 3.64 | 3.38 | 2.81 | 2.54 | 2.49 | 2.48 | 2.48 | 2.48 | 2.48 |
| B — cover, spread | 4.14 | 3.44 | 2.95 | 2.56 | 2.80 | 3.04 | 3.15 | 3.15 | 3.17 | 3.16 |
| B — cover, sparse | 4.13 | 3.23 | 2.54 | 2.48 | 2.58 | 2.76 | 2.86 | 2.96 | 2.72 | 2.74 |

### What density costs the fight

At t=20, mixed roster:

| variant | target in reach | mid-attack | shots fired, total | attempts denied by cover | hidden by board art | hidden by authored cover | hidden by bodies | bodies >50 % hidden | crowd bbox |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A — open plaza | 40/40 | 18 | 216 | 0.0 % | 11.7 % | 0.0 % | 2.2 % | 4 | 321x149 |
| B — cover, dense (round 1) | 21/40 | 9 | 109 | 6.8 % | 6.3 % | 10.8 % | 6.3 % | 4 | 318x181 |
| B — cover, spread | 35/40 | 13 | 168 | 3.4 % | 3.8 % | 6.3 % | 4.3 % | 2 | 263x148 |
| B — cover, sparse | 37/40 | 15 | 187 | 3.1 % | 0.0 % | 4.7 % | 7.0 % | 0 | 261x160 |

Bodies in reach over time — the number round 1 flagged as the cost of cover:

| variant | t=0 | t=2 | t=4 | t=6 | t=8 | t=10 | t=14 | t=20 | t=26 | t=32 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A — open plaza | 0/40 | 0/40 | 28/40 | 38/40 | 40/40 | 40/40 | 40/40 | 40/40 | 40/40 | 40/40 |
| B — cover, dense (round 1) | 0/40 | 0/40 | 6/40 | 14/40 | 21/40 | 21/40 | 21/40 | 21/40 | 21/40 | 21/40 |
| B — cover, spread | 0/40 | 0/40 | 14/40 | 25/40 | 32/40 | 33/40 | 33/40 | 35/40 | 34/40 | 34/40 |
| B — cover, sparse | 0/40 | 0/40 | 14/40 | 30/40 | 36/40 | 36/40 | 37/40 | 37/40 | 38/40 | 39/40 |

## Question 2 — ranged

Every body a shooter (4.7–6.2 unit standoff, 1.5–2.1 s cooldown). This is
the composition cover is *for*, and round 1 never isolated it.

| variant | in reach | at standoff (±25 %) | mean sightline occlusion | shots fired, total | attempts denied by cover | mid-attack | depth s.d. | bodies >50 % hidden |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ranged — open plaza | 40/40 | 40/40 | 40.3 % | 211 | 0.0 % | 12 | 0.61 | 0 |
| ranged — cover, dense | 30/40 | 22/40 | 52.8 % | 132 | 55.7 % | 8 | 1.24 | 4 |
| ranged — cover, spread | 40/40 | 29/40 | 37.1 % | 188 | 26.8 % | 20 | 1.25 | 2 |
| ranged — cover, sparse | 40/40 | 32/40 | 43.3 % | 206 | 0.5 % | 9 | 0.92 | 0 |

Formation decay, ranged roster:

| variant | t=0 | t=2 | t=4 | t=6 | t=8 | t=10 | t=14 | t=20 | t=26 | t=32 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ranged — open plaza | 0.81 | 0.79 | 0.62 | 0.39 | 0.45 | 0.46 | 0.59 | 0.61 | 0.60 | 0.59 |
| ranged — cover, dense | 0.90 | 1.12 | 1.31 | 1.20 | 1.20 | 1.24 | 1.21 | 1.24 | 1.37 | 1.38 |
| ranged — cover, spread | 0.89 | 1.14 | 1.32 | 1.01 | 1.04 | 1.14 | 1.23 | 1.25 | 1.20 | 1.17 |
| ranged — cover, sparse | 0.87 | 1.00 | 1.00 | 0.66 | 0.66 | 0.71 | 0.77 | 0.92 | 1.01 | 0.97 |

Shots actually released, cumulative — the thing a ranged fight is made of:

| variant | t=0 | t=2 | t=4 | t=6 | t=8 | t=10 | t=14 | t=20 | t=26 | t=32 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ranged — open plaza | 0 | 0 | 19 | 38 | 65 | 84 | 136 | 211 | 289 | 363 |
| ranged — cover, dense | 0 | 0 | 4 | 20 | 38 | 55 | 90 | 132 | 187 | 242 |
| ranged — cover, spread | 0 | 0 | 9 | 27 | 44 | 68 | 117 | 188 | 262 | 339 |
| ranged — cover, sparse | 0 | 0 | 8 | 36 | 52 | 82 | 129 | 206 | 283 | 357 |

### Ranged versus melee across cover

Side 0 all shooters, side 1 all swords. The asymmetric case.

| variant | shooters in reach | all bodies in reach | at standoff (±25 %) | mean sightline occlusion | shots fired, total | attempts denied by cover | depth s.d. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ranged vs melee — plaza | 20/20 | 31/40 | 10/20 | 0.0 % | 162 | 0.0 % | 2.84 |
| ranged vs melee — dense | 20/20 | 23/40 | 12/20 | 51.5 % | 112 | 25.8 % | 1.87 |
| ranged vs melee — spread | 20/20 | 32/40 | 9/20 | 8.5 % | 144 | 18.6 % | 3.52 |
| ranged vs melee — sparse | 20/20 | 36/40 | 6/20 | 0.0 % | 162 | 25.3 % | 3.22 |

## Round 3 — melee uses cover

Rounds 1 and 2 zeroed melee's cover appetite as a fix for clustering, so
half the army ignored cover by construction and the archetype comparison
was never run. Each pair below is the **same board, same roster, same
seed** with melee's covered approach off (r2) and on (r3).

### Do the two archetypes now do different things?

The question the round is for. `exposed` is the share of steps a body spent
with a clear line to the enemy — the thing a covered approach is supposed
to buy down, and the thing a firing position is supposed to *keep* on its
own terms. If the two columns move together, the archetypes still converge.

| variant | swords exposed | shooters exposed | swords in cover | sword steps spent closing | sword depth s.d. | shooter depth s.d. |
| --- | --- | --- | --- | --- | --- | --- |
| mixed, spread — r2 (melee ignores cover) | 61.8 % | 58.6 % | 3/20 | 11898 | 0.93 | 1.21 |
| mixed, spread — r3 (melee routes) | 52.6 % | 55.8 % | 2/20 | 10170 | 0.90 | 1.26 |
| split, spread — r2 | 61.4 % | 64.7 % | 3/18 | 16523 | 0.00 | 3.52 |
| split, spread — r3 | 65.3 % | 58.9 % | 3/18 | 15859 | 0.00 | 2.67 |
| mixed, dense — r2 | 33.7 % | 39.7 % | 8/20 | 18089 | 1.27 | 1.45 |
| mixed, dense — r3 | 42.8 % | 40.3 % | 7/20 | 16562 | 2.17 | 1.53 |
| mixed, sparse — r2 | 76.9 % | 62.5 % | 0/20 | 9234 | 0.85 | 1.12 |
| mixed, sparse — r3 | 61.2 % | 50.0 % | 0/20 | 7229 | 1.00 | 1.53 |
| mixed, plaza — no cover at all | 0.0 % | 0.0 % | 0/20 | 0 | 0.55 | 0.27 |

### The stances, and flanking

The directional ruling, counted. `ducked` and `peeking` are shares of all
steps; melee has no peek column because melee never peeks. `flanked` is
attacks that landed by arriving outside the target's protected arc — a
number that **could not exist** under the symmetric model rounds 1-2 used,
where going round the side of a crate changed nothing.

| variant | swords ducked | shooters ducked | shooters peeking | flanking hits | shots fired, total |
| --- | --- | --- | --- | --- | --- |
| mixed, spread — r2 (melee ignores cover) | 19.8 % | 28.5 % | 27.7 % | 61 | 168 |
| mixed, spread — r3 (melee routes) | 20.8 % | 25.6 % | 27.0 % | 49 | 178 |
| split, spread — r2 | 39.9 % | 20.8 % | 18.4 % | 66 | 144 |
| split, spread — r3 | 34.3 % | 18.8 % | 17.6 % | 57 | 145 |
| mixed, dense — r2 | 56.3 % | 18.8 % | 44.0 % | 87 | 109 |
| mixed, dense — r3 | 56.9 % | 36.4 % | 45.6 % | 71 | 126 |
| mixed, sparse — r2 | 8.2 % | 20.6 % | 20.1 % | 15 | 187 |
| mixed, sparse — r3 | 8.7 % | 16.1 % | 15.7 % | 19 | 205 |
| mixed, plaza — no cover at all | 0.0 % | 0.0 % | 0.0 % | 0 | 216 |

### Did the fight still happen?

Round 1's clustering bug, watched directly. `nearest friendly` is the
measurement that would have caught it: bodies converging on the same good
tiles collapse it. Attacks falling while that number falls is the bug
coming back; attacks holding while it holds is the fix working.

| variant | swords in reach | all bodies in reach | mid-attack | shots fired, total | attempts denied by cover | nearest friendly, swords |
| --- | --- | --- | --- | --- | --- | --- |
| mixed, spread — r2 (melee ignores cover) | 16/20 | 35/40 | 13 | 168 | 3.4 % | 0.94 |
| mixed, spread — r3 (melee routes) | 17/20 | 36/40 | 9 | 178 | 2.2 % | 0.90 |
| split, spread — r2 | 11/18 | 32/40 | 13 | 144 | 18.6 % | 0.85 |
| split, spread — r3 | 13/18 | 34/40 | 10 | 145 | 28.2 % | 1.00 |
| mixed, dense — r2 | 7/20 | 21/40 | 9 | 109 | 6.8 % | 0.71 |
| mixed, dense — r3 | 9/20 | 26/40 | 10 | 126 | 22.2 % | 1.15 |
| mixed, sparse — r2 | 17/20 | 37/40 | 15 | 187 | 3.1 % | 1.00 |
| mixed, sparse — r3 | 20/20 | 40/40 | 11 | 205 | 1.9 % | 1.01 |
| mixed, plaza — no cover at all | 20/20 | 40/40 | 18 | 216 | 0.0 % | 1.25 |

### Time to contact

Seconds until half the swords have their target inside reach. `-1` means
it never happened inside the 20 s window — which is the failure mode a
covered approach risks, and the number that says whether it happened.

| variant | half the swords in reach at | sword depth s.d. @20 | swords exposed @20 |
| --- | --- | --- | --- |
| mixed, spread — r2 (melee ignores cover) | 6.67 s | 0.94 | 60.8 % |
| mixed, spread — r3 (melee routes) | 5.33 s | 1.19 | 49.2 % |
| split, spread — r2 | 13.15 s | 0.00 | 61.9 % |
| split, spread — r3 | 14.73 s | 0.00 | 64.1 % |
| mixed, dense — r2 | never | 1.27 | 33.9 % |
| mixed, dense — r3 | never | 2.18 | 43.6 % |
| mixed, sparse — r2 | 5.67 s | 1.04 | 80.3 % |
| mixed, sparse — r3 | 5.15 s | 1.00 | 61.2 % |
| mixed, plaza — no cover at all | 3.98 s | 0.59 | 0.0 % |

## Cost

| variant | sim ms per 4 s slice |
| --- | --- |
| A — open plaza | 15.3 |
| B — cover, dense (round 1) | 60.9 |
| B — cover, spread | 44.8 |
| B — cover, sparse | 36.7 |
| ranged — open plaza | 18.2 |
| ranged — cover, dense | 57.0 |
| ranged — cover, spread | 45.6 |
| ranged — cover, sparse | 38.5 |
| ranged vs melee — plaza | 14.5 |
| ranged vs melee — dense | 55.5 |
| ranged vs melee — spread | 41.1 |
| ranged vs melee — sparse | 39.1 |
| mixed, spread — r2 (melee ignores cover) | 42.4 |
| mixed, spread — r3 (melee routes) | 77.4 |
| split, spread — r2 | 45.2 |
| split, spread — r3 | 74.5 |
| mixed, dense — r2 | 56.5 |
| mixed, dense — r3 | 104.0 |
| mixed, sparse — r2 | 38.4 |
| mixed, sparse — r3 | 67.3 |
| mixed, plaza — no cover at all | 16.0 |
| mixed, spread — compact | 79.3 |
| split, spread — compact | 81.4 |
| mixed, plaza — compact | 14.8 |
| mixed, dense — compact | 110.9 |
| mixed, spread — broad | 79.1 |
| split, spread — broad | 71.3 |
| mixed, plaza — broad | 15.0 |
| mixed, dense — broad | 106.0 |
| mixed, spread — vast | 67.9 |
| split, spread — vast | 65.4 |
| mixed, plaza — vast | 14.7 |
| mixed, dense — vast | 87.3 |

## The board, unchanged from round 1

| fact | value |
| --- | --- |
| tile, world units | 1.1535 |
| tile vs SEPARATION_RADIUS (1.05) | 1.10x |
| grid | 20 x 20 (23.1 world units square) |
| retrofitted board.ts props (every density) | 10 |

`board.ts`'s props are free-placed. Giving them footprints means snapping,
and there is no free option — this is density-independent, because the
retrofits are never thinned:

| snap | tiles claimed | vs true footprint | cost |
| --- | --- | --- | --- |
| outward (safe) | 74.0 | +150 % | bodies stand off from walls they are nowhere near |
| nearest (honest floor) | 29.0 | -2 % | feet sink up to 0.52 world units into the art |
| tile-authored | exact | 0 % | the footprint IS the declaration |

## Round 4 — the area axis

Every round so far used the same 20x20 grid at the same crowd scale, so the
knob turned was prop *count*. Round 4 turns the **floor** instead, holding
prop density per unit of area and the army at 40 bodies. `spread` density,
`hitscan` fire and the covered approach are all as ruled — the only thing
that moves between these rows is how much room there is.

### Is prop density actually held?

The methodological precondition. If this table drifts, round 4 re-tested
prop count by accident and nothing below it means anything.

| board | cells | board side (world) | floor per body (world^2) | authored props | authored per 400 tiles | mean floor to nearest prop (tiles) | board blocked |
| --- | --- | --- | --- | --- | --- | --- | --- |
| compact | 20x20 | 23.1 | 13.3 | 16 | 16.0 | 0.73 | 25.5 % |
| broad | 28x28 | 32.3 | 26.1 | 31 | 15.8 | 1.17 | 18.4 % |
| vast | 40x40 | 46.1 | 53.2 | 64 | 16.0 | 0.96 | 12.3 % |

`authored per 400 tiles` is the held quantity and it holds. `board blocked`
still falls, and the reason is stated rather than tuned away: `board.ts`'s
free-placed masses are real art that exists exactly once, so they are not
tiled with the authored cover and their share of a bigger board shrinks.

### Does more floor delay the scrum?

`scrum` is the step at which a third of the army has an **enemy** for its
nearest neighbour — the two masses have interleaved and can no longer be
told apart. That is round 3's negative made mechanical, and it is not the
same thing as crowding: the deployment is already tight enough that a
crowding threshold fires at t=0.35 s on the compact board, before anyone
has moved.

A bigger board also means a longer walk, so **`legible window` is the column
to read**: scrum minus first contact, i.e. how long the fight stays readable
once it has actually started.

| variant | floor per body | first contact (s) | scrum (s) | legible window (s) | interleaved at t=20 | in reach at t=20 |
| --- | --- | --- | --- | --- | --- | --- |
| mixed, spread — compact | 13.3 | 5.33 | 28.22 | 22.89 | 22.5 % | 36/40 |
| split, spread — compact | 13.3 | 14.73 | 16.37 | 1.64 | 27.5 % | 34/40 |
| mixed, plaza — compact | 13.3 | 3.98 | 6.12 | 2.14 | 52.5 % | 40/40 |
| mixed, dense — compact | 13.3 | never | never | n/a | 20.0 % | 26/40 |
| mixed, spread — broad | 26.1 | 7.62 | 9.93 | 2.31 | 47.5 % | 37/40 |
| split, spread — broad | 26.1 | 13.75 | 14.92 | 1.17 | 30.0 % | 30/40 |
| mixed, plaza — broad | 26.1 | 5.52 | 8.15 | 2.63 | 52.5 % | 40/40 |
| mixed, dense — broad | 26.1 | 7.62 | 11.15 | 3.53 | 32.5 % | 29/40 |
| mixed, spread — vast | 53.2 | 8.78 | 10.97 | 2.19 | 42.5 % | 39/40 |
| split, spread — vast | 53.2 | 21.13 | 23.22 | 2.09 | 25.0 % | 26/40 |
| mixed, plaza — vast | 53.2 | 7.95 | 10.67 | 2.72 | 55.0 % | 40/40 |
| mixed, dense — vast | 53.2 | 8.70 | 11.30 | 2.60 | 32.5 % | 31/40 |

### Interleaving over time

Share of bodies whose nearest neighbour is an enemy. 0 % is two separate
armies, 50 % is one indistinguishable mass. The scrum threshold is 33 %.

| variant | t=0 | t=2 | t=4 | t=6 | t=8 | t=10 | t=14 | t=20 | t=26 | t=32 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mixed, spread — compact | 0.0 % | 0.0 % | 2.5 % | 15.0 % | 15.0 % | 20.0 % | 22.5 % | 22.5 % | 27.5 % | 37.5 % |
| split, spread — compact | 0.0 % | 0.0 % | 0.0 % | 2.5 % | 0.0 % | 10.0 % | 20.0 % | 27.5 % | 32.5 % | 42.5 % |
| mixed, plaza — compact | 0.0 % | 0.0 % | 15.0 % | 30.0 % | 52.5 % | 52.5 % | 52.5 % | 52.5 % | 52.5 % | 52.5 % |
| mixed, dense — compact | 0.0 % | 0.0 % | 2.5 % | 7.5 % | 7.5 % | 12.5 % | 15.0 % | 20.0 % | 22.5 % | 25.0 % |
| mixed, spread — broad | 0.0 % | 0.0 % | 0.0 % | 12.5 % | 27.5 % | 35.0 % | 40.0 % | 47.5 % | 50.0 % | 52.5 % |
| split, spread — broad | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 10.0 % | 30.0 % | 30.0 % | 40.0 % | 40.0 % |
| mixed, plaza — broad | 0.0 % | 0.0 % | 0.0 % | 12.5 % | 32.5 % | 47.5 % | 52.5 % | 52.5 % | 52.5 % | 52.5 % |
| mixed, dense — broad | 0.0 % | 0.0 % | 0.0 % | 15.0 % | 25.0 % | 32.5 % | 35.0 % | 32.5 % | 35.0 % | 35.0 % |
| mixed, spread — vast | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 15.0 % | 25.0 % | 35.0 % | 42.5 % | 47.5 % | 47.5 % |
| split, spread — vast | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 15.0 % | 25.0 % | 32.5 % | 32.5 % |
| mixed, plaza — vast | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 20.0 % | 25.0 % | 52.5 % | 55.0 % | 55.0 % | 55.0 % |
| mixed, dense — vast | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 10.0 % | 22.5 % | 32.5 % | 32.5 % | 42.5 % | 47.5 % |

### Crowding over time

Share of bodies with no personal space left — reported alongside because it
is what round 3 was eyeballing, and it is **saturated by the deployment**:
32.5 % of the compact army is inside `SEPARATION_RADIUS` at t=0, before
anyone has moved. That is why the scrum is timed on interleaving instead.

| variant | t=0 | t=2 | t=4 | t=6 | t=8 | t=10 | t=14 | t=20 | t=26 | t=32 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mixed, spread — compact | 32.5 % | 60.0 % | 82.5 % | 82.5 % | 90.0 % | 92.5 % | 92.5 % | 87.5 % | 85.0 % | 85.0 % |
| split, spread — compact | 32.5 % | 77.5 % | 85.0 % | 82.5 % | 85.0 % | 85.0 % | 85.0 % | 77.5 % | 87.5 % | 82.5 % |
| mixed, plaza — compact | 0.0 % | 27.5 % | 77.5 % | 72.5 % | 75.0 % | 60.0 % | 65.0 % | 65.0 % | 60.0 % | 65.0 % |
| mixed, dense — compact | 37.5 % | 67.5 % | 75.0 % | 82.5 % | 77.5 % | 80.0 % | 80.0 % | 77.5 % | 80.0 % | 80.0 % |
| mixed, spread — broad | 15.0 % | 47.5 % | 40.0 % | 45.0 % | 60.0 % | 80.0 % | 75.0 % | 90.0 % | 85.0 % | 85.0 % |
| split, spread — broad | 15.0 % | 40.0 % | 60.0 % | 50.0 % | 50.0 % | 57.5 % | 62.5 % | 75.0 % | 72.5 % | 72.5 % |
| mixed, plaza — broad | 0.0 % | 10.0 % | 15.0 % | 80.0 % | 72.5 % | 72.5 % | 60.0 % | 55.0 % | 55.0 % | 55.0 % |
| mixed, dense — broad | 15.0 % | 30.0 % | 42.5 % | 40.0 % | 67.5 % | 85.0 % | 82.5 % | 82.5 % | 82.5 % | 82.5 % |
| mixed, spread — vast | 0.0 % | 22.5 % | 37.5 % | 32.5 % | 45.0 % | 77.5 % | 85.0 % | 82.5 % | 77.5 % | 62.5 % |
| split, spread — vast | 0.0 % | 25.0 % | 37.5 % | 52.5 % | 65.0 % | 70.0 % | 50.0 % | 62.5 % | 75.0 % | 87.5 % |
| mixed, plaza — vast | 0.0 % | 10.0 % | 15.0 % | 20.0 % | 42.5 % | 80.0 % | 70.0 % | 55.0 % | 55.0 % | 60.0 % |
| mixed, dense — vast | 0.0 % | 20.0 % | 37.5 % | 22.5 % | 40.0 % | 70.0 % | 85.0 % | 77.5 % | 70.0 % | 70.0 % |

### The confound, bounded

Holding authored props per 400 tiles does not hold **total occlusion**:
blocked fraction falls 25.5 % to 12.3 % across the axis, because
`board.ts`'s free-placed masses exist exactly once and are not tiled. So an
effect attributed to floor could be an effect of less cover. The `dense`
rows are the closest control this manifest allows.

| board | density | board blocked | sword exposure while closing | swords in cover | flanking hits | legible window (s) |
| --- | --- | --- | --- | --- | --- | --- |
| compact | spread | 25.5 % | 52.6 % | 2/20 | 49 | 22.89 |
| compact | dense | 33.0 % | 42.8 % | 7/20 | 71 | n/a |
| broad | spread | 18.4 % | 54.5 % | 1/20 | 15 | 2.31 |
| broad | dense | 21.9 % | 40.7 % | 4/20 | 90 | 3.53 |
| vast | spread | 12.3 % | 79.6 % | 0/20 | 21 | 2.19 |
| vast | dense | 19.1 % | 71.0 % | 1/20 | 32 | 2.60 |

### Does the covered approach survive the extra floor?

Round 3 bought -9.2 pp of sword exposure and contact 1.3 s sooner on the
compact board. The question is whether more floor helps that or dilutes it.

| variant | sword exposure while closing | swords in cover | swords in reach | melee depth s.d. | ranged depth s.d. | mean nearest neighbour | attempts denied by cover | flanking hits | ranged peeking |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mixed, spread — compact | 52.6 % | 2/20 | 17/20 | 0.90 | 1.26 | 0.97 | 2.2 % | 49 | 27.0 % |
| split, spread — compact | 65.3 % | 3/18 | 13/18 | 0.00 | 2.67 | 1.29 | 28.2 % | 57 | 17.6 % |
| mixed, plaza — compact | 0.0 % | 0/20 | 20/20 | 0.55 | 0.27 | 1.05 | 0.0 % | 0 | 0.0 % |
| mixed, dense — compact | 42.8 % | 7/20 | 9/20 | 2.17 | 1.53 | 1.02 | 22.2 % | 71 | 45.6 % |
| mixed, spread — broad | 54.5 % | 1/20 | 19/20 | 0.97 | 1.56 | 1.03 | 1.8 % | 15 | 24.7 % |
| split, spread — broad | 73.4 % | 1/18 | 10/18 | 0.00 | 2.89 | 1.59 | 25.7 % | 30 | 17.9 % |
| mixed, plaza — broad | 0.0 % | 0/20 | 20/20 | 0.54 | 0.44 | 1.12 | 0.0 % | 0 | 0.0 % |
| mixed, dense — broad | 40.7 % | 4/20 | 13/20 | 3.16 | 2.30 | 1.18 | 16.8 % | 90 | 47.7 % |
| mixed, spread — vast | 79.6 % | 0/20 | 20/20 | 0.61 | 0.95 | 1.29 | 2.1 % | 21 | 12.5 % |
| split, spread — vast | 81.4 % | 1/18 | 5/18 | 0.00 | 2.56 | 1.08 | 22.2 % | 23 | 11.1 % |
| mixed, plaza — vast | 0.0 % | 0/20 | 20/20 | 0.41 | 0.55 | 1.16 | 0.0 % | 0 | 0.0 % |
| mixed, dense — vast | 71.0 % | 1/20 | 18/20 | 1.20 | 2.59 | 1.17 | 4.3 % | 32 | 30.5 % |

### The camera collision, priced

A bigger board collides with the fixed 2:1 dimetric camera and there are
exactly two ways out. `fit` pulls back so the board keeps the same share of
frame; `pan` holds the figure size and translates instead. The band every
legibility finding on this map was measured in is **22-48 px**`,
so the fodder-height column is what decides whether a treatment is
admissible at all.

| board | floor per body | fit zoom | fit — fodder px | in band? | pan — fodder px | pan sweep (world) | board visible at once |
| --- | --- | --- | --- | --- | --- | --- | --- |
| compact | 13.3 | 0.550 | 28.2 | yes | 28.2 | 5.4 | 66.9 % |
| broad | 26.1 | 0.393 | 20.1 | **no** | 28.2 | 11.9 | 47.8 % |
| vast | 53.2 | 0.275 | 14.1 | **no** | 28.2 | 21.7 | 33.4 % |

**The crossover.** Pulling back leaves the band at **25.6 cells a side**
(29.6 world units, 22 world^2 of floor per body).
Past that a fodder figure is under 22 px and every legibility finding on
this map is outside the range it was measured in. That is below the first
step up the area axis, so the choice is forced immediately rather than
eventually.

