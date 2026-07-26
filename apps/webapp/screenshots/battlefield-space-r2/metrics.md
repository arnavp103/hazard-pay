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

| variant | t=0 | t=2 | t=4 | t=6 | t=8 | t=10 | t=14 | t=20 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A — open plaza | 0.81 | 1.00 | 1.46 | 1.92 | 1.95 | 1.96 | 2.01 | 2.10 |
| B — cover, dense (round 1) | 0.90 | 1.21 | 1.53 | 1.72 | 1.79 | 1.79 | 1.79 | 1.79 |
| B — cover, spread | 0.89 | 1.27 | 1.56 | 1.68 | 2.05 | 2.08 | 2.00 | 2.00 |
| B — cover, sparse | 0.87 | 1.16 | 1.30 | 1.84 | 2.04 | 2.04 | 2.05 | 2.00 |

Spread along the line (rank s.d.), same runs:

| variant | t=0 | t=2 | t=4 | t=6 | t=8 | t=10 | t=14 | t=20 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A — open plaza | 4.09 | 4.07 | 4.01 | 3.91 | 3.95 | 3.96 | 3.96 | 3.97 |
| B — cover, dense (round 1) | 4.11 | 3.64 | 3.38 | 2.81 | 2.54 | 2.49 | 2.48 | 2.48 |
| B — cover, spread | 4.14 | 3.44 | 2.95 | 2.56 | 2.80 | 3.04 | 3.15 | 3.15 |
| B — cover, sparse | 4.13 | 3.23 | 2.54 | 2.48 | 2.58 | 2.76 | 2.86 | 2.96 |

### What density costs the fight

At t=20, mixed roster:

| variant | target in reach | mid-attack | shots fired, total | attempts denied by cover | hidden by board art | hidden by authored cover | hidden by bodies | bodies >50 % hidden | crowd bbox |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A — open plaza | 40/40 | 18 | 216 | 0.0 % | 11.7 % | 0.0 % | 2.2 % | 4 | 321x149 |
| B — cover, dense (round 1) | 21/40 | 8 | 105 | 32.3 % | 6.3 % | 10.8 % | 6.3 % | 4 | 318x181 |
| B — cover, spread | 35/40 | 12 | 155 | 51.9 % | 3.8 % | 6.3 % | 4.3 % | 2 | 263x148 |
| B — cover, sparse | 37/40 | 18 | 184 | 20.7 % | 0.0 % | 4.7 % | 7.0 % | 0 | 261x160 |

Bodies in reach over time — the number round 1 flagged as the cost of cover:

| variant | t=0 | t=2 | t=4 | t=6 | t=8 | t=10 | t=14 | t=20 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A — open plaza | 0/40 | 0/40 | 28/40 | 38/40 | 40/40 | 40/40 | 40/40 | 40/40 |
| B — cover, dense (round 1) | 0/40 | 0/40 | 6/40 | 14/40 | 21/40 | 21/40 | 21/40 | 21/40 |
| B — cover, spread | 0/40 | 0/40 | 14/40 | 25/40 | 32/40 | 33/40 | 33/40 | 35/40 |
| B — cover, sparse | 0/40 | 0/40 | 14/40 | 30/40 | 36/40 | 36/40 | 37/40 | 37/40 |

## Question 2 — ranged

Every body a shooter (4.7–6.2 unit standoff, 1.5–2.1 s cooldown). This is
the composition cover is *for*, and round 1 never isolated it.

| variant | in reach | at standoff (±25 %) | mean sightline occlusion | shots fired, total | attempts denied by cover | mid-attack | depth s.d. | bodies >50 % hidden |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ranged — open plaza | 40/40 | 40/40 | 40.3 % | 211 | 0.0 % | 12 | 0.61 | 0 |
| ranged — cover, dense | 30/40 | 22/40 | 52.8 % | 132 | 61.1 % | 3 | 1.24 | 4 |
| ranged — cover, spread | 40/40 | 29/40 | 37.1 % | 162 | 71.3 % | 7 | 1.25 | 2 |
| ranged — cover, sparse | 40/40 | 32/40 | 43.3 % | 162 | 76.1 % | 13 | 0.92 | 0 |

Formation decay, ranged roster:

| variant | t=0 | t=2 | t=4 | t=6 | t=8 | t=10 | t=14 | t=20 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ranged — open plaza | 0.81 | 0.79 | 0.62 | 0.39 | 0.45 | 0.46 | 0.59 | 0.61 |
| ranged — cover, dense | 0.90 | 1.12 | 1.31 | 1.20 | 1.20 | 1.24 | 1.21 | 1.24 |
| ranged — cover, spread | 0.89 | 1.14 | 1.32 | 1.01 | 1.04 | 1.14 | 1.23 | 1.25 |
| ranged — cover, sparse | 0.87 | 1.00 | 1.00 | 0.66 | 0.66 | 0.71 | 0.77 | 0.92 |

Shots actually released, cumulative — the thing a ranged fight is made of:

| variant | t=0 | t=2 | t=4 | t=6 | t=8 | t=10 | t=14 | t=20 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ranged — open plaza | 0 | 0 | 19 | 38 | 65 | 84 | 136 | 211 |
| ranged — cover, dense | 0 | 0 | 2 | 18 | 35 | 54 | 86 | 132 |
| ranged — cover, spread | 0 | 0 | 7 | 26 | 44 | 67 | 103 | 162 |
| ranged — cover, sparse | 0 | 0 | 8 | 32 | 43 | 68 | 108 | 162 |

### Ranged versus melee across cover

Side 0 all shooters, side 1 all swords. The asymmetric case.

| variant | shooters in reach | all bodies in reach | at standoff (±25 %) | mean sightline occlusion | shots fired, total | attempts denied by cover | depth s.d. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ranged vs melee — plaza | 20/20 | 31/40 | 10/20 | 0.0 % | 162 | 0.0 % | 2.84 |
| ranged vs melee — dense | 20/20 | 23/40 | 12/20 | 51.5 % | 92 | 74.4 % | 1.87 |
| ranged vs melee — spread | 20/20 | 32/40 | 9/20 | 8.5 % | 146 | 15.6 % | 3.52 |
| ranged vs melee — sparse | 20/20 | 36/40 | 6/20 | 0.0 % | 167 | 10.2 % | 3.22 |

## Cost

| variant | sim ms per 4 s slice |
| --- | --- |
| A — open plaza | 43.9 |
| B — cover, dense (round 1) | 73.0 |
| B — cover, spread | 68.6 |
| B — cover, sparse | 56.7 |
| ranged — open plaza | 29.1 |
| ranged — cover, dense | 64.2 |
| ranged — cover, spread | 62.3 |
| ranged — cover, sparse | 49.0 |
| ranged vs melee — plaza | 31.8 |
| ranged vs melee — dense | 69.3 |
| ranged vs melee — spread | 57.4 |
| ranged vs melee — sparse | 59.6 |

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

