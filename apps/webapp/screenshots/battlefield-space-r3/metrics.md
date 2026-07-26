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
| B — cover, dense (round 1) | 21/40 | 9 | 109 | 6.8 % | 6.3 % | 10.8 % | 6.3 % | 4 | 318x181 |
| B — cover, spread | 35/40 | 13 | 168 | 3.4 % | 3.8 % | 6.3 % | 4.3 % | 2 | 263x148 |
| B — cover, sparse | 37/40 | 15 | 187 | 3.1 % | 0.0 % | 4.7 % | 7.0 % | 0 | 261x160 |

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
| ranged — cover, dense | 30/40 | 22/40 | 52.8 % | 132 | 55.7 % | 8 | 1.24 | 4 |
| ranged — cover, spread | 40/40 | 29/40 | 37.1 % | 188 | 26.8 % | 20 | 1.25 | 2 |
| ranged — cover, sparse | 40/40 | 32/40 | 43.3 % | 206 | 0.5 % | 9 | 0.92 | 0 |

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
| ranged — cover, dense | 0 | 0 | 4 | 20 | 38 | 55 | 90 | 132 |
| ranged — cover, spread | 0 | 0 | 9 | 27 | 44 | 68 | 117 | 188 |
| ranged — cover, sparse | 0 | 0 | 8 | 36 | 52 | 82 | 129 | 206 |

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
| mixed, spread — r2 (melee ignores cover) | 6.67 s | 0.93 | 61.8 % |
| mixed, spread — r3 (melee routes) | 5.33 s | 0.90 | 52.6 % |
| split, spread — r2 | 13.15 s | 0.00 | 61.4 % |
| split, spread — r3 | 14.73 s | 0.00 | 65.3 % |
| mixed, dense — r2 | never | 1.27 | 33.7 % |
| mixed, dense — r3 | never | 2.17 | 42.8 % |
| mixed, sparse — r2 | 5.67 s | 0.85 | 76.9 % |
| mixed, sparse — r3 | 5.15 s | 1.00 | 61.2 % |
| mixed, plaza — no cover at all | 3.98 s | 0.55 | 0.0 % |

## Cost

| variant | sim ms per 4 s slice |
| --- | --- |
| A — open plaza | 15.6 |
| B — cover, dense (round 1) | 51.9 |
| B — cover, spread | 37.1 |
| B — cover, sparse | 31.9 |
| ranged — open plaza | 15.2 |
| ranged — cover, dense | 50.9 |
| ranged — cover, spread | 37.5 |
| ranged — cover, sparse | 31.6 |
| ranged vs melee — plaza | 15.6 |
| ranged vs melee — dense | 49.8 |
| ranged vs melee — spread | 38.3 |
| ranged vs melee — sparse | 29.3 |
| mixed, spread — r2 (melee ignores cover) | 36.6 |
| mixed, spread — r3 (melee routes) | 69.6 |
| split, spread — r2 | 36.5 |
| split, spread — r3 | 76.2 |
| mixed, dense — r2 | 48.9 |
| mixed, dense — r3 | 101.0 |
| mixed, sparse — r2 | 31.2 |
| mixed, sparse — r3 | 72.4 |
| mixed, plaza — no cover at all | 16.3 |

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

