# Combat over the wire: getting a resolution from the server to an animating client

Research date: 2026-07-26 — for [hazard-pay#98](https://github.com/arnavp103/hazard-pay/issues/98)
(wayfinder map [#95](https://github.com/arnavp103/hazard-pay/issues/95)).

**Status: in progress — skeleton committed first, sections fill in as they are researched.**

## Question

How does several seconds of continuous 40-body combat get from an atomic server
resolution to a client that animates it?

## Sections

- Recommendation
- What the sim actually produces
- Option A: enumerated match events
- Option B: deterministic re-simulation from a seed
- Option C: hybrid — authoritative outcomes, invented motion
- Payload arithmetic
- JavaScript determinism hazards
- SSE fit and mid-slice resume
- Findings that pressure ADR 0004
- Sources
