# Cold art-direction critique

The critic received only the four final stills, synchronized motion capture,
and the curated local Direction B reference board. It did not receive the
implementation source, issue history, generation transcript, or the
generator's assessment.

The pixel characters can read as belonging to the sharp comic environment
without collapsing both asset kinds into one rendering style. The successful
bridge is shared contour weight, value grouping, palette, and hard-edged
lighting—not identical pixel density.

| Treatment | Assessment |
| --- | --- |
| **A — Contour-first** | **Mood:** worn and combat-ready, though not heavily grimy. **2×:** strongest silhouette; legs and side-mounted equipment remain distinct, although the busy chest does not unequivocally say “medic” without the label. **Materials:** rust body, muted gear, pale metal, and teal emitter separate well. **Cohesion:** the dark contour and clustered cel colors translate the environment’s comic grammar convincingly into pixels. **Detail:** mostly descriptive; the rust/teal center is near the noise threshold in motion. |
| **B — Hard two-band** | **Mood:** cleanest and most toy-like—closer to a board token or compact robot than a dangerous worker. **2×:** exceptionally stable body mass, but the equipment collapses into small lateral nubs. **Materials:** readable as color zones, not tactile substances; everything feels similarly plastic. **Cohesion:** formally close to the flat environment, but oversimplification makes the character feel lower-resolution rather than deliberately pixel-authored. **Detail:** no noise, but insufficient information. |
| **C — Material three-band** | **Mood:** somewhat industrial, still comparatively clean. **2×:** broad body and left/right equipment cues survive; thin legs and head/body connection are weaker than A. **Materials:** best explicit separation of painted shell, shadow, metal edge, and signal color. **Cohesion:** a credible cel-shaded bridge, though sparse white highlights are sharper and brighter than most environmental accents. **Detail:** generally clarifies form; isolated highlight pixels pop or flicker across poses. |
| **D — Grit hybrid** | **Mood:** clearly the grittiest, most dangerous, and most lived-in. **2×:** the broken perimeter and mottled center weaken both silhouette and equipment recognition. **Materials:** wear is present, but the common dither treatment partially homogenizes the substances. **Cohesion:** mood matches the world, rendering density does not—the sprite appears noisy over the environment’s quiet planes. **Detail:** crosses into crawling texture in motion and competes with pose changes. |

## Ranking

1. **A — Contour-first**
2. **C — Material three-band**
3. **B — Hard two-band**
4. **D — Grit hybrid**

**A clearly clears the cohesion bar.** C is a borderline pass and a useful
material-lighting direction, provided highlights are quieter and contour
continuity improves. B is cohesive only in a narrow graphic sense; it misses
the desired danger and character specificity. D has the right emotional
temperature but does not clear the gameplay-readability bar at 2×.

## Strongest evidence against this conclusion

- The sprite grid remains conspicuously chunkier than the environment’s long,
  clean diagonals; broader character and pose variety could expose the seam
  more strongly.
- The common plum/rust/teal palette is doing substantial unifying work in this
  controlled test.
- None of the equipment reads unequivocally as “field medic” without the
  accompanying label.
- A already approaches internal texture noise, while D demonstrates how
  quickly a per-kind lane can look like a separate compositing layer.
- C’s cleaner bands suggest that collapsing toward a shared cel language could
  improve scalability, even if a full stylistic collapse is unnecessary.

## Recommendation

**KEEP PER-KIND LANES.**

Use A’s contour-first grammar as the baseline: continuous dark silhouette,
large material-local clusters, and texture reserved for focal wear or
equipment. Borrow C’s third value band selectively for materially important
surfaces. Avoid B’s toy-like reduction and D’s all-over broken contour/dither.

This is advisory visual evidence, not the human taste ruling.
