# Combat over the wire: getting a resolution from the server to an animating client

Research date: 2026-07-26 — for [hazard-pay#98](https://github.com/arnavp103/hazard-pay/issues/98)
(wayfinder map [#95](https://github.com/arnavp103/hazard-pay/issues/95)).

> Vocabulary note. `CONTEXT.md` bans the bare word "event" and reserves **move**
> for a participant's submission ("command" and "intent" are both banned there).
> This file therefore says **match event** for a record in a resolution's batch,
> and **steering target** where a game-networking paper would say "intent".

## Question

How does several seconds of continuous 40-body combat get from an atomic server
resolution to a client that animates it — and does [ADR 0004](../adr/0004-match-transport-and-tick-architecture.md) survive contact with it?

## Recommendation in one paragraph

**Ship the slice as a small number of match events carrying quantised sampled
motion — not one match event per unit per frame, and not a seed.** Concretely:
a handful of match events per slice (chunked by second), whose payload is a
10 Hz position/facing track plus the discrete outcomes at full time resolution,
with the client interpolating between samples and running the existing
procedural animation layers on top. Measured on the real sim, a 5-second
40-unit slice costs **11.1 KiB on the wire as quantised-integer JSON under
brotli**, or **8.6 KiB** if you delta-code it into base64'd binary. Either is
under 20 kbit/s sustained, and about 133 KiB for a whole match.

Deterministic re-simulation from a seed would be **173 bytes** — but it buys
that ~10 KiB in exchange for making bit-identical floating point across Node
and every browser engine a permanent correctness requirement. §6 shows this
specific sim already calls `Math.hypot` (which ECMA-262 marks
implementation-approximated) in three hot paths; that Mozilla has stated
outright that Firefox does not use the same `sin`/`cos`/`tan` implementation as
V8; and that the two teams who have actually shipped deterministic JavaScript
both had to override the `Math` library wholesale to do it. **The 10 KiB is not
worth it.**

**ADR 0004 survives.** Nothing here pressures SSE, the atomic transaction, the
phase state machine, or the no-payload NOTIFY rule — the last of which turns
out to have been exactly right. What it does pressure is the unstated
assumption that a match event is a small semantic record (§8).

### At a glance

| | Wire/slice | Records/slice | Rows/slice | Demands |
| --- | ---: | ---: | ---: | --- |
| **A** naive (one match event per unit-frame @60 Hz) | 903 KiB | 12,040 | 12,000 | nothing |
| **A** recommended (10 Hz JSON ints, per-second chunks) | **11.1 KiB** | **5** | **5** | client interpolation |
| **B** seed + re-simulation | 173 B | 1 | 1 | bit-identical floats in every engine, forever |
| **C** outcomes + keyframes | 1.3 KiB | 5 | 5 | client must *reach* the outcomes — collapses into A |

Contents: [1 the sim](#1-what-the-sim-actually-produces) ·
[2 Option A](#2-option-a--enumerate-the-motion-as-match-events) ·
[3 Option B](#3-option-b--deterministic-re-simulation-from-a-seed) ·
[4 Option C](#4-option-c--the-hybrid) ·
[5 arithmetic](#5-payload-arithmetic) ·
[6 determinism](#6-javascript-determinism-hazards) ·
[7 SSE](#7-does-sse-fit-and-what-happens-on-a-mid-slice-resume) ·
[8 findings vs ADR 0004](#8-findings-that-pressure-adr-0004) ·
[9 recommendation](#9-recommendation-and-what-it-costs) ·
[10 sources](#10-sources)

---

## 1. What the sim actually produces

The substrate is `apps/webapp/src/match-proto/flat-procedural/sim.ts` on
`prototype/flat-procedural-lane` ([PR #90](https://github.com/arnavp103/hazard-pay/pull/90)). Its shape is already a slice resolution:

```
createBattle(options) -> SimState        // seeded layout, 40 units
stepBattle(state, dt) -> void            // mutates in place
battleAt(seconds, options) -> SimState   // fixed 1/60 step, N steps, done
```

`battleAt` is literally "resolve a slice": pure function of `(seed, options,
seconds)`, no I/O, no clock. It runs happily under Node — I ran every experiment
in this document against it with `node --experimental-strip-types`.

A `SimUnit` carries 21 fields. For animation, only some are load-bearing:

| Field | Needed by the client? | Why |
| --- | --- | --- |
| `x`, `z` | **yes** | world position, the whole point |
| `facing` | **yes** | the rig's yaw; not derivable from velocity when planted |
| `attackPhase` | **yes** | drives the attack clip; `-1` or `0..1` |
| `speed` | **yes** | stride matching in the `cycle` layer |
| `ax`, `az` | **yes** | the `lean` layer's input (low-passed acceleration) |
| `firedAt`, `hitAt` | **yes** | recoil and flinch spring impulses |
| `aimX/Y/Z` | derivable | it is the target's position; send `targetId` instead |
| `targetId` | **yes** (cheap) | lets the client derive aim and re-derive `aimY` from tier |
| `vx`, `vz` | derivable | finite-difference of sampled positions |
| `angularVelocity` | derivable | finite-difference of `facing` |
| `cooldown`, `retargetAt` | **no** | pure sim bookkeeping, invisible |
| `id`, `side`, `tier`, `archetype` | once per match | static roster, not per frame |

That table is the first real saving and it is free: **9 dynamic fields, not 21**,
and four of the nine are static-per-match. Measured below as "render fields".

One structural note that matters for every option: `stepBattle` mutates units
**in place while iterating** (`target.hitAt = state.t` inside the loop, and the
separation pass reads `other.x` for units that have already moved this step).
That is Gauss–Seidel rather than Jacobi integration — correct and deterministic
given a stable array order, but it means the result depends on unit ordering.
Any future parallelisation, or any change to unit ordering (which death and
removal will force — §8), changes the outcome. Worth a comment in the sim.

---

## 2. Option A — enumerate the motion as match events

The literal reading of ADR 0004 §3: "persists as an ordered batch of match
events the client animates at its own presentation pace." If each sampled unit
state is a match event, a 5-second slice at the sim's own 60 Hz step is
40 × 301 = **12,040 records**. That is the "thousands of records" the ticket
worries about, and it is real — but it is an artefact of *sampling rate and
record granularity*, not of the approach.

Three dials collapse it:

1. **Field selection** (21 fields → 9, above).
2. **Sample rate.** The client interpolates; it does not need the sim's
   integration rate. Units move at ≤1.6 world units/s, so at 10 Hz a unit moves
   ≤0.16 units between samples — well under the 1.05-unit separation radius, so
   Catmull-Rom through the samples cannot visibly cut a corner.
3. **Encoding.** JSON numbers at 3 decimal places, versus 7 packed bytes per
   unit per sample (`int16` x and z in millimetres, `uint16` facing, `uint8`
   attack phase).

Crucially, the discrete outcomes — attack released, hit landed, target changed —
stay at **full time resolution** in all variants. They are only 162 records for
the whole slice (§5), so there is no reason to quantise *when* they happen.

### What a batch must contain for crowd motion to reconstruct

- **Sampled position and facing** at a fixed rate, per unit, with the client
  interpolating. Facing must be sent, not derived: `stepBattle` switches facing
  between travel direction and aim direction at `speed > 0.25`, so a client
  deriving facing from velocity would snap wrongly every time a unit plants.
- **Discrete outcomes with exact timestamps** — `firedAt`, `hitAt`, target
  changes. These are impulse inputs to the spring layers; a sample-rate-rounded
  hit time makes recoil and flinch drift out of sync with the contact pose.
- **Speed and low-passed acceleration**, or a client-side reconstruction of
  them. Finite-differencing 10 Hz positions gives speed accurately enough for
  stride matching, but the `lean` layer wants the *low-passed* acceleration the
  sim computed (`unit.ax`), which is deliberately not the raw derivative. Either
  send 2 more `int16`s per sample (+4 bytes/unit/sample, ~57% larger) or run the
  same low-pass on the client over interpolated velocity. **Prefer the latter**:
  it is the same one-line filter and it costs nothing on the wire.
- **The static roster once**, at slice zero: id, side, tier, archetype.

Pure "steering targets the client interpolates" — sending only "unit 7 is moving
toward unit 22" and letting the client integrate — is *not* a separate option.
It is Option B with extra steps: the client would be running the sim's steering,
separation and clamping code to turn steering targets into positions, which is
re-simulation and inherits every determinism requirement in §6, while giving up
the seed's tiny payload.

---

## 3. Option B — deterministic re-simulation from a seed

Send `{seed, roster, moves, seconds}` and let the client run the same
`battleAt`. Measured payload: **173 bytes**.

```json
{"seed":20890724,"fodderPerSide":18,"heroesPerSide":2,"standoff":6.4,
 "spacing":1.42,"dt":0.016666666666666666,"steps":300,
 "moves":[{"p":1,"m":"advance"},{"p":2,"m":"hold"}]}
```

What it demands:

- **A fixed timestep**, already true (`battleAt` uses `1/60`).
- **A userland PRNG**, already true — `makeRandom` is a seeded
  `Math.imul`-based integer generator using only 32-bit integer ops, which are
  exactly specified. This part is genuinely safe.
- **Bit-identical floating point** between the server's Node/V8 and every
  browser engine a player might use — including engines that do not exist yet.
  This is the hard part, and §6 is entirely about it.
- **Identical iteration order** — true today (array order), but see the death
  caveat in §8.
- **Version lockstep between server and client code.** A player on a stale
  bundle does not render a slightly wrong fight; they render a *different*
  fight, silently, with no error. This is the operational cost nobody budgets
  for: every deploy becomes a potential silent desync until every open tab
  reloads.

What it buys: ~10 KiB per slice, ~0.13 MiB per match. See §5 for whether that
is worth anything, and §6.3 for what two teams who actually shipped
deterministic JavaScript had to do to get there — the short version is that
both replaced `Math.random`, overrode the `Math` transcendentals wholesale, and
pinned sort and iteration order, and one of them rounds every arithmetic result
through `Math.fround` to force agreement.

What it also buys, and this is the honest argument for it: **scrubbing and
replays for free**. `battleAt(seconds)` is time-indexed, so a client that
re-simulates can seek anywhere in the slice instantly, and a whole match's
replay is a few hundred bytes. Option A can do scrubbing too, but only within
the samples it was sent.

---

## 4. Option C — the hybrid

Server is authoritative on **outcomes** (who attacked whom, when, what landed,
who died); client invents the **motion** between them with its own local
steering, and is corrected at every slice boundary by an authoritative keyframe.

Measured: outcomes (129 records) + a 40-unit end-of-slice keyframe =
**8.2 KiB raw, 1.3 KiB brotli**; with a start keyframe too, 11.1 KiB / 1.6 KiB.

The seam is clean and it is the classic one: the server owns the *state
transitions the rules care about*, the client owns *presentation*. Because
`stepBattle` already separates "where everyone is" from "who hit whom", the
split is close to free architecturally.

The failure mode is specific and ugly: the client's invented motion has to
*arrive* at the authoritative outcomes. If the server says unit 7 attacked
unit 22 at t=2.35s, the client's freely-invented unit 7 must be within melee
range of unit 22 at t=2.35s, or it plays a melee swing at empty air. So the
client's motion is not free at all — it is constrained to hit ~31 position
constraints per slice, which means either running the same steering (→ Option B)
or solving an inverse-kinematics-for-crowds problem that nobody wants to write.

The variant that *does* work is Option C with position keyframes at intervals —
which is Option A with a low sample rate. **The hybrid is not a third point on
the line; it is a name for the middle of it.** That is a genuine finding: the
interesting axis is sample rate, and "outcomes only" is just sample rate zero.

---

## 5. Payload arithmetic

All numbers below are **measured**, not estimated: the real `sim.ts` run for
5 seconds at its own `1/60` step, 40 units (18 fodder + 2 heroes per side),
serialised and compressed with Node's `zlib` at gzip level 9 and brotli
quality 11.

### The slice

```
40 units, 5s, 300 steps @ 60Hz, 301 frames
discrete occurrences in the window: 162
  { target-change: 67, swing-start: 33, attack-released: 31, hit-landed: 31 }
```

### Wire size per slice

| Variant | Records | Raw | gzip | brotli |
| --- | ---: | ---: | ---: | ---: |
| A1 full `SimUnit` JSON @60 Hz | 12,040 | 5253.1 KiB | 1251.5 KiB | 903.5 KiB |
| A1b render fields, 3 dp, @60 Hz | 12,040 | 1016.3 KiB | 174.7 KiB | 93.4 KiB |
| A2 render fields, 3 dp, @30 Hz | 6,040 | 509.5 KiB | 92.9 KiB | 52.3 KiB |
| A2 render fields, 3 dp, @20 Hz | 4,040 | 340.5 KiB | 63.8 KiB | 37.8 KiB |
| **A2 render fields, 3 dp, @10 Hz** | 2,040 | 171.7 KiB | 33.8 KiB | **21.5 KiB** |
| A2 render fields, 3 dp, @5 Hz | 1,040 | 87.3 KiB | 17.9 KiB | 12.2 KiB |
| A3 packed 7 B/unit @60 Hz | 12,040 | 82.3 KiB | 73.0 KiB | 68.2 KiB |
| A3 packed 7 B/unit @30 Hz | 6,040 | 41.3 KiB | 37.0 KiB | 35.2 KiB |
| **A3 packed 7 B/unit @10 Hz** | 2,040 | 13.9 KiB | 12.7 KiB | **12.2 KiB** |
| A4 discrete outcomes only | 162 | 5.7 KiB | 0.7 KiB | 0.6 KiB |
| C hybrid: outcomes + end keyframe | 169 | 8.2 KiB | 1.7 KiB | 1.3 KiB |
| C′ hybrid + start keyframe | 209 | 11.1 KiB | 2.1 KiB | 1.6 KiB |
| **B seed + slice params** | 1 | **173 B** | — | — |

Four things fall out of that table:

1. **The naive reading of ADR 0004 is 5 MiB per slice.** Full `SimUnit` JSON at
   60 Hz is genuinely unshippable — 1.2 MiB even gzipped, per slice, per viewer.
   The ticket's alarm is justified against *that* reading.
2. **Field selection alone is a 5.2× win** (5253 → 1016 KiB raw), before any
   other change. Most of the "thousands of records" problem is that `SimUnit`
   has 12 fields the client cannot see.
3. **Compression does most of the remaining work on JSON, and much less on
   packed binary.** JSON @10 Hz goes 171.7 → 21.5 KiB brotli (8.0×); packed
   binary goes 13.9 → 12.2 KiB (1.14×). The packed form is already near its
   entropy, so the raw column badly overstates binary's advantage. The
   shoot-out below settles it properly.
4. **Everything below A2@10 Hz is noise.** The gap between the best enumerated
   form and the seed is ~10 KiB per slice. §7 puts that in context.

### Encoding shoot-out at the recommended sample rate

Same 2,040 samples (40 units × 51 frames at 10 Hz), every encoding measured
end-to-end. `br5`/`br11` are brotli qualities.

| Encoding | raw | gzip -9 | brotli q11 |
| --- | ---: | ---: | ---: |
| packed binary, 7 B/unit | 13.9 KiB | 12.7 KiB | 12.2 KiB |
| ↳ base64'd (SSE-legal) | 18.6 KiB | 13.5 KiB | 13.4 KiB |
| **packed binary, delta-coded per unit** | 13.9 KiB | 8.2 KiB | **6.9 KiB** |
| ↳ **base64'd (SSE-legal)** | 18.6 KiB | 10.1 KiB | **8.6 KiB** |
| JSON floats 3 dp, tuple rows | 54.8 KiB | 17.8 KiB | 11.4 KiB |
| **JSON quantised integers, tuple rows** | 40.9 KiB | 16.9 KiB | **11.1 KiB** |

Three conclusions, and the third is the one that should drive the decision:

- **Delta coding is the single biggest encoding win.** Storing each unit's
  track as first-difference `int16`s takes brotli from 12.2 → 6.9 KiB (1.8×),
  because a unit moves ≤16 mm between 10 Hz samples so nearly every delta is a
  small number. This costs about ten lines of code.
- **base64 is a real but survivable tax on compressibility, not just size.**
  Encoding to base64 misaligns byte boundaries and hurts the compressor:
  measured **+10% for the packed track and +24% for the delta-coded track**
  under brotli. (A general benchmark on *random* binary shows base64 can cost
  3×; that does not reproduce here, because this payload is highly structured
  either way. Worth knowing that the penalty is payload-dependent.)
- **Plain quantised-integer JSON is within 30% of the elaborate option.**
  11.1 KiB versus 8.6 KiB, for no binary packing, no base64, no delta codec,
  and a payload a human can read in devtools. On a 5-second slice that
  difference is 2.5 KiB. **Ship the JSON; keep delta-coded binary in the back
  pocket for when 40 units becomes 200.**

One caveat inherited from a published benchmark: brotli quality is not always
monotonic in output size. It *is* on this payload (q4 → 16.5 KiB, q11 →
11.1 KiB for JSON integers, decreasing throughout), but the effect is real
enough elsewhere that the compression level should be picked by measuring the
actual payload rather than assuming q11 wins.

### SSE framing overhead — the tax for one-record-per-match-event

SSE is a text field format: each dispatched message costs `id: N\n`, `data: …\n`
and a blank line at minimum.

| | Records | Framing alone |
| --- | ---: | ---: |
| Minimal `id:` + `data:` + blank line, 5-digit id | 1 | 18 B |
| With `event: match_event` | 1 | 37 B |
| A1 one match event per unit-frame @60 Hz | 12,000 | **210.9 KiB** |
| A2 @10 Hz | 2,000 | 35.2 KiB |
| A4 discrete only | 162 | 2.8 KiB |
| One framed batch per slice | 1 | ~37 B |

**Framing overhead alone, at one-match-event-per-unit-frame, exceeds the entire
packed payload by 15×.** This is the single strongest argument in the document
for *batching*: whatever the content, do not put one unit-sample in one match
event.

### base64 — the tax for binary over a text transport

The SSE wire is UTF-8 text, so a packed binary track must be base64'd
(4 bytes out per 3 in):

| Binary | base64 | Overhead |
| ---: | ---: | ---: |
| 84,275 B (@60 Hz) | 112,368 B | +33.3% |
| 42,137 B (@30 Hz) | 56,184 B | +33.3% |
| 14,045 B (@10 Hz) | **18,728 B** | +33.3% |

The 4/3 ratio is exact (RFC 4648 encodes 24-bit groups as 4 characters, padded
to a 4-character quantum). But the size expansion is not the real cost —
the compressibility loss is, and it is payload-dependent: measured **+10% for
the packed track, +24% for the delta-coded track** under brotli (shoot-out
above). The takeaway is not "avoid binary" but **"the encoding choice is worth
2.5 KiB out of 11; the sample rate is worth an order of magnitude."**

### Postgres storage — the tax for one-row-per-match-event

A heap tuple costs a 23-byte header MAXALIGNed to 24, plus ~46 bytes of fixed
columns (`bigint` seq, `uuid` match_id, `int2` phase, short `text` type,
`timestamptz`), plus a 4-byte varlena header on the `jsonb`, plus ~24 bytes for
one btree entry on `(match_id, seq)`.

| Row granularity | Rows/slice | Bytes/slice | Over a 12-slice match |
| --- | ---: | ---: | ---: |
| One row per unit-frame @60 Hz | 12,000 | 1851.6 KiB | **21.70 MiB** |
| One row per unit-frame @10 Hz | 2,000 | 308.6 KiB | 3.62 MiB |
| One row per discrete outcome | 162 | 21.8 KiB | 0.26 MiB |
| **One row per slice (batched)** | 1 | 13.8 KiB | **0.16 MiB** |

At one row per unit-frame, the per-row overhead (~158 B) is **2.6× the payload
it carries** (~60 B). ADR 0004 §5 says the table is the truth and SSE re-queries
it — so row count is not just storage, it is the size of every resume query.
Batching turns a 12,000-row `SELECT … WHERE seq > $1` into a 1-row one.

### Bandwidth, in the shape that actually matters

A 5-second slice animated over ~5 seconds of wall clock:

| Approach | Per slice (wire) | Sustained | 12-slice match | ×10 spectators |
| --- | ---: | ---: | ---: | ---: |
| A1b @60 Hz JSON, brotli | 93.4 KiB | 153 kbit/s | 1.1 MiB | 11 MiB |
| A2 @10 Hz JSON floats, brotli | 11.4 KiB | 19 kbit/s | 137 KiB | 1.3 MiB |
| **A2 @10 Hz JSON integers, brotli** | **11.1 KiB** | **18 kbit/s** | 133 KiB | 1.3 MiB |
| A3 @10 Hz delta-packed, b64+brotli | 8.6 KiB | 14 kbit/s | 103 KiB | 1.0 MiB |
| C hybrid, brotli | 1.3 KiB | 2 kbit/s | 16 KiB | 156 KiB |
| B seed | 173 B | negligible | 2 KiB | 20 KiB |

The recommended option is **18 kbit/s sustained per viewer** — a fraction of a
low-bitrate audio stream, and about 133 KiB for a whole match. There is no
bandwidth problem here. There was only ever a *record-count* problem, and
batching solves it.

---

## 6. JavaScript determinism hazards

This section decides Option B, so it is the longest. It has two halves: what the
language guarantees, and what this specific sim actually does when you poke it.

### 6.1 What ECMAScript guarantees, and what it does not

The headline is better than folklore suggests: **basic float arithmetic is
exactly specified and bit-identical everywhere.** The hazard is narrower and
sharper than "floats are unreliable" — it is a specific, enumerable list of
library functions the spec deliberately leaves loose.

#### Guaranteed — safe to rely on

- **`+ - * /` are correctly-rounded IEEE 754-2019 binary64.** ECMA-262
  [Number::add](https://262.ecma-international.org/16.0/index.html#sec-numeric-types-number-add)
  §6.1.6.1.7: "It performs addition according to the rules of IEEE 754-2019
  binary double-precision arithmetic." Same wording for
  [multiply](https://262.ecma-international.org/16.0/index.html#sec-numeric-types-number-multiply)
  and [divide](https://262.ecma-international.org/16.0/index.html#sec-numeric-types-number-divide).
  The Number type *is* binary64
  ([§6.1.6.1](https://262.ecma-international.org/16.0/index.html#sec-ecmascript-language-types-number-type)).
- **Therefore no FMA contraction and no x87 80-bit intermediates.** Because
  each operation is individually specified to round to binary64, an engine may
  not fuse `a*b+c` into one rounding or keep intermediates wide. The classic
  C/C++ cross-platform float hazard does not apply to JavaScript. This is a
  spec guarantee, not a platform accident.
- **`Math.sqrt` is correctly rounded.**
  [§21.3.2.33](https://262.ecma-international.org/16.0/index.html#sec-math.sqrt)
  returns "𝔽(the square root of ℝ(n))" — an exact real mapped through
  round-to-nearest. It is conspicuously *absent* from the approximated list
  below.
- **Own-property key order is fully specified.**
  [OrdinaryOwnPropertyKeys](https://262.ecma-international.org/16.0/index.html#sec-ordinaryownpropertykeys)
  §10.1.11.1: array-index keys ascending numerically, then string keys in
  creation order, then symbols. This backs `Object.keys`/`entries`/`values`
  and `JSON.stringify`.
- **`Map`/`Set` iterate in insertion order.**
  [§24.1.3.5](https://262.ecma-international.org/16.0/index.html#sec-map.prototype.foreach):
  "in key insertion order." Prefer these over plain objects for sim state — an
  object keyed by numeric unit id silently reorders keys numerically.
- **`Array.prototype.sort` is stable, since ES2019.**
  [SortIndexedProperties](https://262.ecma-international.org/16.0/index.html#sec-sortindexedproperties)
  §23.1.3.30.1 requires `π(j) < π(k)` when the comparator returns 0 — "i.e.,
  the sort is stable." V8 implemented this by replacing QuickSort with TimSort
  in v7.0 / Chrome 70 ([v8.dev/blog/array-sort](https://v8.dev/blog/array-sort),
  which states the old algorithm "is not a stable algorithm").
- **`Number` → string → `Number` is lossless.**
  [Number::toString](https://262.ecma-international.org/16.0/index.html#sec-numeric-types-number-tostring)
  §6.1.6.1.20 requires the shortest representation that round-trips exactly
  ("𝔽(s × radix^(n−k)) is x… k is as small as possible"). JSON numbers are
  therefore an exact wire format for doubles — relevant to Option A, not just
  Option B.

#### Not guaranteed — the actual hazard list

- **`Math.random` is unusable and unseedable.**
  [§21.3.2.28](https://262.ecma-international.org/16.0/index.html#sec-math.random):
  values are chosen "using an implementation-defined algorithm or strategy",
  and — decisively — "Each `Math.random` function created for distinct realms
  must produce a distinct sequence of values." The spec *mandates* divergence.
  V8 switched from MWC1616 to xorshift128+ in v4.9 / Chrome 49
  ([v8.dev/blog/math-random](https://v8.dev/blog/math-random)), confirming the
  algorithm is an implementation detail. **The sim already does the right
  thing**: `makeRandom` is a userland seeded generator built from `Math.imul`
  and 32-bit integer ops, all exactly specified.
- **A long list of `Math` functions is explicitly approximated.**
  [§21.3.2 Note](https://262.ecma-international.org/16.0/index.html#sec-function-properties-of-the-math-object):
  the behaviour of "**acos, acosh, asin, asinh, atan, atanh, atan2, cbrt, cos,
  cosh, exp, expm1, hypot, log, log1p, log2, log10, pow, random, sin, sinh,
  tan, and tanh** is not precisely specified here… some latitude is allowed in
  the choice of approximation algorithms." fdlibm is "recommended (but not
  specified by this standard)". "Implementation-approximated" is a defined term
  meaning "defined in whole or in part by an external source"
  ([§4.4.1](https://262.ecma-international.org/16.0/index.html#sec-terms-and-definitions-implementation-approximated)).
- **`Math.hypot` is on that list** —
  [§21.3.2.19](https://262.ecma-international.org/16.0/index.html#sec-math.hypot)
  step 7 returns "an implementation-approximated Number value". **The sim calls
  `Math.hypot` in three hot paths.** §6.2 measures what that costs.
- **The `**` operator is on that list too, and this is the easy one to miss.**
  `Math.pow` is defined as `Number::exponentiate`
  ([§6.1.6.1.3](https://262.ecma-international.org/16.0/index.html#sec-numeric-types-number-exponentiate)),
  which "returns an implementation-approximated value" — and the `**` operator
  uses the same abstract operation. So **`x ** 2` is not guaranteed to equal
  `x * x`**. `retarget()` in the sim uses `(other.x - unit.x) ** 2`.
- **Engines genuinely differ, and this is confirmed by the engine teams.**
  V8 ships its own fdlibm port
  ([`src/base/ieee754.cc`](https://chromium.googlesource.com/v8/v8/+/refs/heads/main/src/base/ieee754.cc),
  "adapted from fdlibm… modified significantly by Google Inc."). Mozilla states
  that **Firefox deliberately does not**: "For performance reasons, Firefox
  currently doesn't use the cross-platform fdlibm for `Math.cos`, `Math.sin`,
  and `Math.tan`… and instead chooses to use the local, platform-supplied math
  library", noting that "Chromium/V8 uses fdlibm for these functions"
  ([Mozilla dev-platform](https://groups.google.com/a/mozilla.org/g/dev-platform/c/0dxAO-JsoXI/m/eEhjM9VsAgAJ)).
  SpiderMonkey later added fdlibm "to get consistent results across platforms"
  as an *option*, not a default
  ([spidermonkey.dev newsletter](https://spidermonkey.dev/blog/2021/09/10/newsletter-firefox-92-93.html)).
- **Even the same engine family drifts across versions and operating systems.**
  V8 replaced its custom `tanh` with `std::tanh`
  ([commit c1486295ae5](https://chromium.googlesource.com/v8/v8/+/c1486295ae5)),
  which means `Math.tanh` now reads the host libm — so the *same* V8 can return
  different last bits on macOS and Linux. **"Server and client both run V8" is
  not a determinism argument**: version skew and OS skew each break it.
- **`for...in` order is not specified.**
  [§14.7.5.9](https://262.ecma-international.org/16.0/index.html#sec-enumerate-object-properties):
  "The mechanics and order of enumerating the properties is not specified."
  Use `Object.keys` or `Map`.
- **Sort stability only holds for a *consistent* comparator.** §23.1.3.30.1:
  "The sort order is implementation-defined if SortCompare is not a consistent
  comparator." A comparator returning 0 for distinct elements is fine; one that
  is non-transitive, or returns NaN (silently coerced to +0), makes the whole
  sort implementation-defined. Always tiebreak on a stable unique id.
- **`-0` does not survive JSON.**
  [Number::toString](https://262.ecma-international.org/16.0/index.html#sec-numeric-types-number-tostring)
  step 2 returns `"0"` for −0𝔽, so `JSON.parse(JSON.stringify(-0))` is `+0`.
  `structuredClone` *does* preserve it
  ([HTML structured data](https://html.spec.whatwg.org/multipage/structured-data.html)),
  so the two are not interchangeable. Easy to produce accidentally via `x * -1`.
- **NaN bit patterns are implementation-defined.**
  [§6.1.6.1](https://262.ecma-international.org/16.0/index.html#sec-ecmascript-language-types-number-type):
  the many IEEE NaNs are "represented in ECMAScript as a single special NaN
  value", and the bit pattern observable through an ArrayBuffer is "not
  necessarily the same as the internal representation". **Directly relevant to
  the state-hashing technique in §6.2** — hashing a `Float64Array`'s bytes is
  only sound if NaN can never enter state. Assert against it.
- **`Date.now()` and `localeCompare` must never touch the sim.**
  [§21.4.3.1](https://262.ecma-international.org/16.0/index.html#sec-date.now)
  is wall-clock; `localeCompare` is "implementation-defined locale-sensitive"
  ([§22.1.3.12](https://262.ecma-international.org/16.0/index.html#sec-string.prototype.localecompare))
  and depends on ICU build options that genuinely differ between Node
  (`small-icu` builds exist) and browsers.

#### The enforcement point

That hazard list is mechanically checkable. If Option B is ever pursued, the
sim package should carry an ESLint `no-restricted-properties` /
`no-restricted-syntax` rule banning the §21.3.2 list plus the `**` operator,
`Math.random`, `Date.now` and `localeCompare` — because the failure mode is a
silent 1-ULP divergence that appears only under cross-runtime load, which is
precisely the kind of bug that never shows up in the test suite. This repo
already centralises rules in `packages/config`, so it is a natural fit.

### 6.2 What this sim actually does under perturbation — measured

Everything here is a real run of `sim.ts`, 40 units, fixed `1/60` step.

**Baseline.** Two runs, same seed, same module: **bit-identical** at 1 s and
5 s. The sim is internally deterministic; the question is only cross-runtime.

**Swapping one under-specified builtin for an exactly-specified one.** The sim
calls `Math.hypot(dx, dz)` in three hot paths. Replacing it with
`Math.sqrt(dx*dx + dz*dz)` — mathematically identical, and `Math.sqrt` *is*
exactly specified where `Math.hypot` is not — changes the answer:

```
Math.hypot(dx,dz) !== Math.sqrt(dx*dx+dz*dz):  176,626 / 468,000 pairs (37.74%)

t=0.5s  max position delta 8.882e-16   units bit-differing  9/40   different target 0/40
t=1s    max position delta 1.332e-15   units bit-differing 15/40   different target 0/40
t=2s    max position delta 9.155e-16   units bit-differing 25/40   different target 0/40
t=5s    max position delta 3.140e-15   units bit-differing 40/40   different target 0/40
```

So: **37.7% of distance computations in this sim differ in the last bit
depending on which spelling you use**, and within 5 seconds every unit's state
differs bit-wise. That is exactly the class of difference two engines can
produce for the same source, and it is not hypothetical — §6.1 has Mozilla
saying in writing that Firefox uses a different `sin`/`cos`/`tan` than V8. But
note the second column: the *physical* divergence is 3.1e-15 world units on a
field ~30 units across. Invisible by about 14 orders of magnitude.

The companion test is the `**` operator. `retarget()` computes
`(other.x - unit.x) ** 2`, and `Number::exponentiate` is
implementation-approximated (§6.1), so `x ** 2` is *not guaranteed* to equal
`x * x`. Measured in V8:

```
dx ** 2 !== dx * dx:  0 / 468,000 pairs (0.00%)
t=1s and t=5s with `** 2` replaced by `d * d`: bit-identical
```

V8 happens to agree. **That agreement is luck, not a guarantee** — it is
exactly the kind of thing that silently differs on another engine, and it is
the single easiest hazard on the list to miss, because `** 2` looks like
arithmetic rather than a library call. Replace it with `d * d` regardless of
which option wins; it is free.

**Is the system chaotic or contracting?** This is the question that decides
whether tiny divergence matters, and the answer is the surprise of this
research. Nudging one unit's starting `x` and measuring the worst-case position
delta over time:

```
nudge 1e-6:  t=0.5s 9.724e-7   t=1s 9.328e-7   t=2s 8.445e-7
             t=3s 7.400e-7     t=4s 6.360e-7   t=5s 4.152e-7
             t=8s 4.453e-7     t=12s 4.460e-7  t=20s 4.460e-7
```

**The perturbation shrinks.** It does not grow. `stepBattle`'s steering is a
damped first-order approach (`accel = (desired - v) * 6`, plus explicit
low-pass filters on `ax`/`az` and `angularVelocity`, plus a hard speed clamp),
and the separation force is a restoring force. The whole system is
*contracting*: it dissipates error faster than the nonlinearity amplifies it.
That is the opposite of the classic RTS lockstep horror story, and it is a
property of *this* dynamics, not of lockstep in general.

**How big must a difference be to change behaviour?** Sweeping the nudge:

```
nudge 1e-15 .. 1e-3   ->  identical targets, identical attack times, identical swing set
nudge 1e-2            ->  attack times DIFFER (targets still the same)
nudge 1e-1            ->  attack times DIFFER
```

There are **13 orders of magnitude of headroom** between last-bit float noise
(~1e-15) and the smallest perturbation that changes any discrete outcome
(~1e-2 world units). For a 5-second slice, this sim's continuous dynamics are
not the risk.

**Where the risk actually is: knife-edge comparisons.** Contracting dynamics do
not protect a boolean. Measuring how close every float comparison in the sim
came to its threshold, over one 5-second slice:

| Comparison | Evaluations | Min margin | Within 1e-12 |
| --- | ---: | ---: | ---: |
| `cooldown <= 0` | 12,000 | 1.89e-4 | 0 |
| `distance <= attackRange` | 11,960 | 3.39e-4 | 0 |
| `speed > 0.25` (facing mode switch) | 12,000 | 2.35e-4 | 0 |
| nearest-target vs runner-up | 12,000 | 4.19e-5 | 0 |
| `distance > SEPARATION_RADIUS` | 468,000 | 1.11e-5 | 0 |
| `attackPhase >= RELEASE_AT` | 2,131 | 3.33e-3 | 0 |
| **`attackPhase >= 1`** | 2,131 | **1.67e-15** | **19** |
| **`state.t >= state.retargetAt`** | 300 | **0.00e+0** | **10** |

Two of the eight are knife-edges, and for the same reason: both compare an
**accumulated float sum against a round number**. `attackPhase` accumulates
`dt / 1.2` and lands *exactly* on 1.0; `state.t` accumulates `dt` and is
compared against `t + 0.45`. Both are hitting exact equality by accident. **29
knife-edge evaluations per 5-second slice** is 29 chances per slice for two
engines to disagree about *behaviour* rather than about the 15th decimal.

Both are trivially fixable and should be fixed regardless of which option wins:

- Count attack progress in **integer steps** (`phaseStep / PHASE_STEPS`), not
  accumulated float.
- Derive time as `step * dt` from an integer step counter, not `t += dt`. The
  current accumulation drifts measurably: after 300 steps `state.t` is
  `4.999999999999988` (error −1.24e-14); after 3,600 steps,
  `59.999999999997875` (error −2.13e-12). Deterministic, but it means `t` is
  never the number anyone thinks it is, and it is what makes
  `t >= retargetAt` land on exact ties.

**How load-bearing is the PRNG?** Less than expected, in this prototype:

```
state.random() draws during a 5s slice: 19   (vs 120 draws at layout time)
freeze every in-slice draw to 0.5  -> max position delta 0.000e+0, 19/40 cooldowns differ
seed +1 (different layout jitter)  -> max position delta 1.325e+0,  11/40 different target
```

In-slice randomness only sets attack cooldowns, which do not feed motion, so
today the PRNG stream can diverge completely without moving a single unit. **Do
not read that as safety.** It is a property of a prototype where nothing dies
and there are no damage rolls. The moment death, crits, or randomised target
selection exist — and #95 puts death explicitly in scope — the PRNG becomes
load-bearing, and a single flipped comparison reorders the entire stream. The
layout draws already show what that looks like: a different seed moves units
1.3 world units apart and changes 11 of 40 targets.

**Does V8's own tiering perturb results?** Comparing a SHA-256 of the full
float64 state:

```
default (Ignition -> Sparkplug -> Maglev -> TurboFan):  t=5s c2ce74550044a3b7   t=20s 23f104a43f535d9c
--no-opt (interpreter only, no optimising compiler):    t=5s c2ce74550044a3b7   t=20s 23f104a43f535d9c
```

Identical. V8's optimising tiers do not change float results here, which is what
the spec requires — but it only rules out one of several hazards, and it is one
V8 version on one platform.

### 6.3 What shipped games actually learned

Deterministic lockstep is a well-documented technique with thirty years of
published postmortems. Four of them bear directly on this decision, and one of
them inverts in our favour.

**The founding argument for lockstep is a bandwidth argument — and it was made
against a 28.8 kbit/s modem.** Bettner and Terrano's
["1500 Archers on a 28.8"](https://www.gamedeveloper.com/programming/1500-archers-on-a-28-8-network-programming-in-age-of-empires-and-beyond)
(GDC 2001, Ensemble Studios) is the canonical source, and its central
calculation is *exactly Option A*:

> "Just passing X & Y coordinates, status, action, facing and damage would have
> limited us to **250 moving units** in the game at the most."

That is the same field list this document measured, and Ensemble rejected it.
But their budget was a 28.8 kbit/s modem on a 16 MB Pentium 90 shared between
8 players, and they needed 1,500 units. **We need 40 units and we measured
18 kbit/s.** The arithmetic that forced Ensemble to lockstep in 1997 comes out
the other way at our scale on a modern connection — which is not a refutation
of their reasoning, it is their reasoning applied to different numbers.
Glenn Fiedler's
["Deterministic Lockstep"](https://gafferongames.com/post/deterministic_lockstep/)
states the general form: "bandwidth is proportional to the size of the input,
not the number of objects." True, and irrelevant when the objects cost 11 KiB.

The other end of the scale confirms the shape. Forrest Smith, who worked on
both Supreme Commander (lockstep) and Planetary Annihilation (client-server
state streaming), reports PA's
[state streaming](https://www.forrestthewoods.com/blog/tech_of_planetary_annihilation_chrono_cam/)
costing "**1 Mbit per connected player**" against lockstep's "a few kilobytes
per second" — but PA streams a solar system. At 40 bodies we measure 55× less
than PA's figure.

**The cost of determinism is paid in engineering, and the postmortems are
unanimous that it is the worst bug class on the project.** Ensemble again:

> "The Microsoft product manager… said 'In every project, there is one stubborn
> bug that goes all the way to the wire — I think out-of-sync is going to be
> it' — he was right." … "**Synchronization debugging was probably at the top
> of this list**" of things they should have front-loaded.

Their description of the failure mode is worth quoting because it is precisely
what §6.2's knife-edge comparisons would produce: "A deer slightly out of
alignment when the random map was created would forage slightly differently —
and minutes later a villager would path a tiny bit off, or miss with his spear
and take home no meat." Note also their observation that programmers "were not
used to having to write code that used **the same number of calls to random
within the simulation**" — the exact hazard §6.2 flagged around
`state.random()` inside a conditional.

For a magnitude: NetherRealm's
["8 Frames in 16ms"](https://media.gdcvault.com/gdc2018/presentations/Stallone_Michael_8FramesIn16ms.pdf)
(GDC 2018) reports **"roughly 7-8 man years"** and "4-12 concurrent engineers
for 9 months" to add rollback to Mortal Kombat X — *starting from an already
bit-deterministic engine* — converging on a "**final desync rate less than
0.1%**." Factorio, which documents its determinism work more openly than
anyone, chose to
[drop 32-bit builds entirely](https://www.factorio.com/blog/post/fff-158)
rather than "deal with desync reports related to 32 versus 64 bit systems," and
runs [a whole-map CRC every tick](https://www.factorio.com/blog/post/fff-47) in
a debug mode that costs all but "units of FPS" to find the first divergent
tick. Gas Powered Games did ship bit-exact float determinism to over a million
customers — so it is achievable — but by "setting the CPU to strictly follow
the IEEE754 standard," a lever a JavaScript program does not have.

**JavaScript specifically is named as a losing case.** David Salz (CTO,
Sandbox Interactive) shipped Albion Online's cross-platform deterministic
simulation and put the conditions plainly in
["Deterministic Simulation"](https://media.gdcvault.com/gdceurope2016/presentations/Salz_David_Deterministic_Simulation.pdf)
(GDC Europe 2016):

> "IEEE standard: only **+, –, \*, /, sqrt** guaranteed to give same results
> everywhere — not: sin, cos, tan etc."
> "**You are in trouble if…** you need to support **a JIT environment**… you
> need to target different CPUs… you need to use different compilers."

His guaranteed-operations list is *identical* to what §6.1 derives independently
from ECMA-262, which is a satisfying convergence. His recommendation when those
conditions hold is **fixed-point integers throughout the simulation**. That is
the real price of Option B: not "be careful with `Math.hypot`", but "rewrite the
sim's arithmetic layer."

Two projects have actually done deterministic simulation in JavaScript, and
both converged on the same mitigations:

- **[Rune](https://developers.rune.ai/blog/making-js-deterministic-for-fun-and-glory)**
  runs the same JS game logic on mobile clients and servers. They monkey-patch
  **31 `Math` operations to round through `Math.fround`** — deliberately
  throwing away precision to buy cross-engine agreement — replace `Math.random`
  with seeded mulberry32 (tracking the seed *per step* so rollback can rewind
  it), patch `Array.prototype.sort`'s comparator, and ship an ESLint plugin.
  Their [rules](https://developers.rune.ai/docs/how-it-works/server-side-logic)
  additionally ban `async`/`await`, `Date`, `fetch`, regular expressions, and
  `this` inside game logic, and they maintain an allowlist of third-party
  libraries because "many external libraries contain code with unintended side
  effects that does not comply with determinism constraints."
- **[0 A.D.](https://wildfiregames.com/forum/topic/24731-question-deterministic-javascript/)**
  runs its RTS simulation layer in JavaScript on SpiderMonkey. They replaced
  `Math.random` with a seeded Boost RNG and override `Math` functions in
  `globalscripts/Math.js` "for platform consistency", and warn that
  `for...in` order is implementation-dependent.

This is the strongest evidence in the document: it is **possible**, two teams
have done it, and the shape of what they had to do is fully known. It is a
platform-level commitment, not a tactical choice.

**One caveat that is usually decisive against lockstep does not apply to us.**
Fiedler [recommends](https://gafferongames.com/post/snapshot_interpolation/)
"deterministic lockstep for 2-4 players at most", because "you can't simulate
frame n until you receive input from *all* players for that frame, so players
end up waiting for the most lagged player" — and Factorio
[notes](https://www.factorio.com/blog/post/fff-147) that under lockstep
"everyone needs to have the same latency". **Neither applies here.** ADR 0004
already puts all resolution on the server in one transaction, with no
client→server input during a slice; the client is a viewer, not a peer. Option
B in this codebase is not peer lockstep — it is *server-authoritative replay*,
which is strictly easier. The honest version of the argument against Option B
is therefore only the cross-runtime float requirement, not the classic lockstep
latency problem. That is worth stating so nobody re-litigates it with the wrong
objection.

**One last warning that maps exactly onto the deploy-skew risk in §3.** Shawn
Hargreaves (Microsoft, MotoGP), quoted in Fiedler's
["Floating Point Determinism"](https://gafferongames.com/post/floating_point_determinism/):

> "If you store replays as controller inputs, they cannot be played back on
> machines with different CPU architectures, compilers, or optimization
> settings… **if we ever released a patch, we had to build it using the exact
> same compiler as the original game.**"

Substitute "browser engine version" for "compiler" and that is the operational
tax Option B levies on every deploy, forever.

**Two useful corroborations for the recommendation, not against it.** Supreme
Commander and Planetary Annihilation both run their **simulation at 10 fps
while rendering at 60** — the same 10 Hz this document arrives at from payload
arithmetic. And every shipped lockstep game stores replays as seed-plus-input
log, which is why keeping the 173-byte seed alongside the tracks (§9.6) is
cheap insurance rather than a hedge.

### 6.4 The gap this research could not close

I could not run the browser side. Everything above is Node/V8 on x86-64 Linux.
The claim that matters for Option B — "V8-in-Node and JavaScriptCore-on-iOS
agree bit-for-bit on this sim" — is untested and, per §6.1, unguaranteed for
`Math.hypot`, `Math.sin`, `Math.cos`, `Math.atan2` and `Math.exp`, all of which
the sim uses. **If Option B is ever revisited, the first deliverable is a
conformance harness**: run `battleAt(20)` in Node, Chrome, Firefox and Safari
in CI, and compare a state hash. That is a day of work and it converts this
entire question from argument to fact.

---

## 7. Does SSE fit, and what happens on a mid-slice resume?

### The seam already exists

`apps/api/src/routes/tick-stream.ts` and
`apps/webapp/src/lib/use-tick-stream.ts` already implement ADR 0004 §2 and §5
for the overworld tick, and the match stream is the same shape. The server side
already does the things that are easy to get wrong: `reply.hijack()` with
`content-type: text/event-stream`, `x-accel-buffering: no` for buffering
reverse proxies, a `:hb\n\n` comment frame every 60 s that doubles as
keep-alive and safety re-poll, single-flight pumping so a NOTIFY landing
mid-pump queues exactly one follow-up, and cursor resume parsed straight from
the `last-event-id` header. The client side is a native `EventSource` with
`Last-Event-ID` handled by the browser.

**Nothing in the payload arithmetic asks that seam to change.** At 22 kbit/s
sustained, SSE is not remotely stressed.

### Mid-slice resume is a client-side concern, not a transport one

This is the one genuinely new consequence of batching, and it is worth stating
plainly.

ADR 0004 resumes by *cursor over rows*: "query the match-events table after a
sequence id". If a slice is one row, then a client that disconnects 3 seconds
into a 5-second slice cannot resume at 3 seconds via the cursor — the cursor's
granularity is the slice. Two options, and the second is better:

1. **Chunk the slice into ~1-second match events** (5 rows instead of 1). The
   cursor then resumes at 1-second granularity, at a cost of 4 extra rows and
   ~150 B of framing. Cheap, and it also lets the client start animating before
   the whole slice has arrived — which matters if a resolution is ever slow.
2. **Let the client re-fetch the slice and seek.** Playback position is client
   state (ADR 0004 already decouples server time from presentation time — "a
   0ms resolution can render as an 8-second fight"). On reconnect the client
   sends `Last-Event-ID` = the last slice it *completed*, receives the current
   slice whole, and seeks its own playhead to where it was. Re-sending 13.5 KiB
   is nothing.

**Do both.** Chunk per second (it is free and it bounds re-send), and have the
client own its playhead (it must anyway, because presentation pace is its
choice). Note that resume then *replays* the current slice from its chunk
boundary, so the client's animation layer must be idempotent about re-seeing a
chunk — worth a note wherever that hook is written.

### SSE facts that constrain the design

From the [WHATWG HTML Living Standard, Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html):

- **Text only, UTF-8 only.** "Event streams in this format must always be
  encoded as UTF-8." There is no binary framing; `MessageEvent.data` is a
  string. This is what forces base64 on any packed track (§5).
- **The spec guarantees resume of the *cursor*, not of the *data*.** The client
  side is normative — "Set (`Last-Event-ID`, lastEventIDValue) in request's
  header list", and "The buffer does not get reset, so the last event ID string
  of the event source remains set to this value until the next time it is set
  by the server." But there is no normative requirement anywhere in the section
  that a server replay anything. **Replay is entirely the application's job.**
  ADR 0004 §5's "the table is the truth" is precisely the right answer to this,
  and the existing route already implements it.
- **An event with `id:` but no `data:` advances the cursor without dispatching
  a message.** Dispatch sets the last event ID *first*, then returns early if
  the data buffer is empty. That is a free checkpoint primitive — useful if
  slice chunks are ever large enough that you want finer-grained resume points
  than actual payloads.
- **Anything pending at end-of-stream is discarded.** A partially transmitted
  match event is lost in full; there is no partial resume *within* an event.
  This is a second, independent argument against very large single events, and
  it bounds how big a slice chunk should be.
- **A non-200 status or a wrong `Content-Type` kills the stream permanently.**
  "fail the connection" sets `readyState` to CLOSED and fires `error`, and the
  UA "does not attempt to reconnect". A 502 from a proxy during a deploy is a
  dead `EventSource` that will not come back on its own — **the client hook
  needs app-level re-instantiation on `error`, not just the browser's automatic
  retry.** The current `use-tick-stream.ts` sets status to `"reconnecting"` on
  `onerror` but never re-creates the `EventSource`; for a transient network
  drop the browser handles it, but for a failed connection it will sit in
  `"reconnecting"` forever. Worth fixing when the match stream is written.
- **`EventSource` cannot send custom headers.** The constructor takes only
  `EventSourceInit { withCredentials }`. Auth must be a cookie or a query
  parameter, and the resume cursor must travel in `Last-Event-ID` — which the
  existing route already assumes.
- **HTTP/1.1 caps ~6 connections per origin.** The spec itself warns about it;
  the number is not in any RFC (RFC 9112 §9.4 deliberately removed a fixed
  ceiling) but is a browser constant — Chromium's
  `client_socket_pool_manager.cc` sets `g_max_sockets_per_group = {6}` for
  normal connections, with WebSocket exempted at 255 and **SSE not exempted**.
  HTTP/2 removes the problem (RFC 9113 recommends `SETTINGS_MAX_CONCURRENT_STREAMS`
  ≥ 100), but only if HTTP/2 runs end-to-end including the reverse proxy hop.
  A player with the game open in several tabs is a realistic way to hit this.
- **Keepalive cadence matters and 60 s is too slow.** nginx `proxy_read_timeout`
  defaults to **60 s** and closes the connection if the upstream "does not
  transmit anything within this time"; AWS ALB's idle timeout also defaults to
  60 s; Cloudflare's proxy read timeout is 125 s (error 524). The HTML spec's
  own advice is a comment line "every 15 seconds or so". **The existing route's
  `:hb\n\n` fires on the 60-second safety re-poll — exactly at nginx's and
  ALB's default limit, which is a race.** Recommend dropping the heartbeat to
  15–30 s (it can stay decoupled from the 60 s re-poll). Note also that ALB's
  `client_keep_alive` defaults to 1 hour and terminates even perfectly active
  streams, so periodic forced reconnects must be treated as normal operation.
- **`proxy_buffering` is on by default in nginx** and breaks SSE; the fix is
  either `proxy_buffering off` or the `X-Accel-Buffering: no` response header.
  The existing route already sends the header — good, and worth keeping when
  the match stream is written.
- **Compression works and is transparent.** `Content-Encoding` is a property of
  the representation, orthogonal to `Transfer-Encoding: chunked`
  ([RFC 9110 §8.4](https://www.rfc-editor.org/rfc/rfc9110#section-8.4)), and
  `Accept-Encoding` is a forbidden request header, so the browser negotiates
  and decodes without any client code. The catch is flushing: a compressor
  buffers, so each match event needs an explicit `Z_SYNC_FLUSH` /
  `BROTLI_OPERATION_FLUSH` or it sits in the deflate window. Measured cost of
  flushing per event rather than once: **+16.7%**. At 11 KiB per slice that is
  ~1.8 KiB — pay it.
- **There is no spec-imposed message size limit.** Stated as an argument from
  absence: the parsing algorithm appends to an unbounded data buffer and
  dispatches on a blank line, with no bound on field, event or stream size. The
  real limit is client-side — the whole event is buffered as one JS string and
  `JSON.parse`d on the main thread. Another vote for per-second chunks over
  one-blob-per-slice.

---

## 8. Findings that pressure ADR 0004

Per the map's out-of-scope rule, these are recorded as findings, not redesigns.
**None of them contradicts a numbered clause of ADR 0004.** All three are
pressure on things the ADR left implicit.

### Finding 1 — "match event" now has two very different sizes

`CONTEXT.md` defines a match event as "one record in a resolution's outcome
batch, animated by clients at their own presentation pace". The word "record"
reads as a small semantic thing: *unit 7 hit unit 22 for 9*. The arithmetic says
the batch should instead be ~5 match events per slice, each carrying a packed
multi-kilobyte motion track for all 40 units.

That is still "an ordered batch of match events the client animates at its own
pace" — ADR 0004 §3 is satisfied literally. But a reader of `CONTEXT.md` would
not expect a 3 KiB match event. **Recommendation: `/domain-modeling` should
either widen the definition or coin a second term** (a *motion track* carried by
a match event, vs. an *outcome* match event). Left unresolved, someone will
implement one row per unit-frame — the 21.7 MiB, 12,000-row-per-slice version —
because that is what the current wording suggests.

### Finding 2 — the atomic resolution transaction now writes a blob, not rows

ADR 0004 §3 says resolution "is computed atomically in one transaction and
persists as an ordered batch". With batching that transaction writes ~5 rows
totalling ~14 KiB rather than thousands of small ones — strictly better for the
transaction, but it puts a multi-kilobyte `jsonb`/`bytea` per row, which will
TOAST (Postgres out-of-lines varlena values above ~2 KiB). That is fine and
normal, but it means the payload column should be `bytea` with explicit
`EXTERNAL`/`EXTENDED` storage considered, not naively `jsonb` — and it means
`NOTIFY` payload limits are irrelevant only because ADR 0004 §5 already ruled
notifications carry no payload. **That ruling is load-bearing here and was
right.**

### Finding 3 — the client now needs the sim's *types*, and one filter

Under Option A the client does not run the sim, but it does need to know what a
motion track means, and it needs to re-derive `ax`/`az` with the same low-pass
constant the sim uses. That is a small shared-code surface — a
`packages/`-level module of slice-payload types plus a couple of pure helpers —
and it is a boundary worth drawing deliberately rather than by copy-paste. It is
*much* smaller than Option B's requirement (the entire sim, bit-identical), but
it is not zero.

### Finding 4 — two latent bugs in the existing transport seam

Not caused by this research, but found while reading `tick-stream.ts` and
`use-tick-stream.ts` against the spec, and both will bite harder on a match
stream than on a tick stream:

- **The heartbeat cadence races the default proxy timeouts.** The `:hb\n\n`
  comment frame is emitted on the 60-second safety re-poll, and nginx's
  `proxy_read_timeout` and AWS ALB's idle timeout both default to exactly 60 s.
  The HTML spec recommends ~15 s. Decouple the heartbeat from the re-poll and
  send it every 15–30 s.
- **A failed connection is never re-established.** Per spec, a non-200 or a
  wrong `Content-Type` makes the UA "fail the connection" and *not* retry.
  `useTickStream` sets status to `"reconnecting"` on `onerror` but never
  re-creates the `EventSource`, so a 502 during a deploy leaves the tab
  permanently dark with a hopeful-looking status. Needs an explicit
  re-instantiation with backoff.

These are worth their own small ticket rather than being folded into the match
work.

### Non-finding, recorded deliberately

The ticket's premise that "enumerated as match events that is potentially
thousands of records per slice" is **correct but not fatal**. It is thousands of
records only under one specific choice — one match event per unit per sim step.
Field selection, sample rate and batching each independently remove an order of
magnitude, and the three together take 5.2 MiB / 12,040 records down to 13.5 KiB
/ 5 records. **ADR 0004 does not need to change. The thing that needed to change
was an unstated assumption about record granularity.**

---

## 9. Recommendation, and what it costs

**Adopt Option A at 10 Hz, as quantised-integer JSON, batched into ~1-second
match events, with discrete outcomes at full time resolution.** 11.1 KiB per
slice on the wire, 5 rows per slice in Postgres, 18 kbit/s per viewer.

### Consequences for the sim's architecture

1. **`stepBattle` gains a sampler, not a rewrite.** The resolution loop runs at
   `1/60` and emits a sample every 6th step. `battleAt` already has the loop;
   it needs to accumulate a track instead of discarding intermediate states.
2. **Fix the two knife-edge accumulators anyway** (§6.2): integer step counter
   for time, integer phase steps for `attackPhase`. This is worth doing under
   *every* option — it removes 29 exact-tie comparisons per slice, and it makes
   `state.t` an exact number, which the client's timestamps will thank you for.
3. **Do not adopt bit-identical cross-runtime determinism as a requirement.**
   That is the load this recommendation refuses to take on. The sim stays free
   to use `Math.hypot`, to be refactored, and to be deployed without lockstep
   between server and client bundles.
4. **Keep the sim pure and time-indexed.** `battleAt(seconds, options)` is
   exactly the right signature for an atomic resolution and should survive.
5. **Unit ordering becomes a documented invariant** once death exists. The
   in-place Gauss–Seidel update means removal order changes outcomes; prefer
   tombstoning (mark dead, skip) over splicing the array, so ordering is stable
   across a match.
6. **Keep the door open on Option B cheaply**: because the payload is derived
   from a seeded sim, a replay format that stores `{seed, moves}` alongside the
   tracks costs 173 bytes and lets a future determinism harness diff a
   re-simulation against the recorded track. That is the cheap version of
   keeping the option alive.

### Consequences for the animation budget

1. **The client interpolates, always.** At 10 Hz the renderer draws 6 frames per
   sample at 60 fps. Catmull-Rom on `(x, z)` and shortest-arc slerp on `facing`;
   a unit travels ≤0.16 world units between samples, so no visible corner-cutting.
2. **The procedural layers keep working unchanged.** The `bind → cycle → attack
   → aim → lean → reactions → root → weapon IK` stack takes speed, acceleration,
   an aim target and impulse timings — all of which survive sampling. `speed`
   comes from finite-differencing interpolated positions; `ax`/`az` from
   re-running the sim's low-pass on that; aim from `targetId` plus the
   interpolated target position.
3. **Impulses stay exact.** `firedAt` and `hitAt` arrive at full time resolution,
   so recoil and flinch springs fire on the exact frame — which is what the
   contact pose needs, and the thing sample-rate rounding would have wrecked.
4. **Presentation pace stays the client's.** ADR 0004's decoupling is preserved:
   a 5-second slice can render over 5 seconds, 3 seconds, or be scrubbed, as
   long as the client's playhead maps to track time.
5. **Budget headroom.** 22 kbit/s and 13.5 KiB per slice leaves room to *raise*
   the sample rate if 10 Hz proves visibly wrong for a specific motion (fast
   pivots are the likeliest offender). 30 Hz is 35.2 KiB — still cheap. **Treat
   sample rate as a tuning dial, not an architectural commitment**, and pick it
   against the animation lanes in [#69](https://github.com/arnavp103/hazard-pay/issues/69) rather than in the abstract.
6. **The thing to prototype next** is not the wire: it is 10 Hz sampled motion
   fed through the procedural layers, rendered next to the same battle at 60 Hz,
   to confirm the interpolation is invisible. That is a small addition to the
   existing flat-procedural harness.

---

## 10. Sources

Primary sources only — specifications, engine source, and first-party engine
team statements. Every claim in §6.1 and §7 links to one of these inline.

### Specifications

- [ECMA-262 (ES2025), Number type — IEEE 754-2019 binary64](https://262.ecma-international.org/16.0/index.html#sec-ecmascript-language-types-number-type) — §6.1.6.1; also the implementation-defined NaN bit-pattern note.
- [ECMA-262, Number::add / multiply / divide](https://262.ecma-international.org/16.0/index.html#sec-numeric-types-number-add) — "according to the rules of IEEE 754-2019 binary double-precision arithmetic".
- [ECMA-262, Number::exponentiate](https://262.ecma-international.org/16.0/index.html#sec-numeric-types-number-exponentiate) — §6.1.6.1.3, "implementation-approximated"; backs both `Math.pow` and the `**` operator.
- [ECMA-262, Number::toString](https://262.ecma-international.org/16.0/index.html#sec-numeric-types-number-tostring) — shortest round-tripping representation; `-0` renders as `"0"`.
- [ECMA-262, Function properties of the Math object](https://262.ecma-international.org/16.0/index.html#sec-function-properties-of-the-math-object) — §21.3.2 Note, the definitive list of 23 approximated functions and the fdlibm recommendation.
- [ECMA-262, Math.sqrt](https://262.ecma-international.org/16.0/index.html#sec-math.sqrt) · [Math.hypot](https://262.ecma-international.org/16.0/index.html#sec-math.hypot) · [Math.random](https://262.ecma-international.org/16.0/index.html#sec-math.random) · [Math.fround](https://262.ecma-international.org/16.0/index.html#sec-math.fround)
- [ECMA-262, "implementation-approximated" (definition)](https://262.ecma-international.org/16.0/index.html#sec-terms-and-definitions-implementation-approximated) — §4.4.1.
- [ECMA-262, OrdinaryOwnPropertyKeys](https://262.ecma-international.org/16.0/index.html#sec-ordinaryownpropertykeys) · [EnumerateObjectProperties (`for...in`, unspecified order)](https://262.ecma-international.org/16.0/index.html#sec-enumerate-object-properties) · [Map.prototype.forEach (insertion order)](https://262.ecma-international.org/16.0/index.html#sec-map.prototype.foreach)
- [ECMA-262, SortIndexedProperties](https://262.ecma-international.org/16.0/index.html#sec-sortindexedproperties) — stability, and the consistent-comparator precondition.
- [ECMA-262, Date.now](https://262.ecma-international.org/16.0/index.html#sec-date.now) · [String.prototype.localeCompare](https://262.ecma-international.org/16.0/index.html#sec-string.prototype.localecompare)
- [WHATWG HTML Living Standard — Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html) — wire format, `Last-Event-ID`, `retry:`, fail-the-connection, EOF discard, the ~15 s comment-frame advice, and the per-origin connection warning.
- [WHATWG HTML — Structured data](https://html.spec.whatwg.org/multipage/structured-data.html) — `structuredClone` preserves `-0` where JSON does not.
- [WHATWG Fetch Standard](https://fetch.spec.whatwg.org/) — `Accept-Encoding` is a forbidden request header; content-coding decode is automatic.
- [RFC 9110 §8.4 — Content-Encoding](https://www.rfc-editor.org/rfc/rfc9110#section-8.4) — orthogonal to `Transfer-Encoding`, so compressed SSE is well-formed.
- [RFC 9112 §9.4 — Concurrency](https://www.rfc-editor.org/rfc/rfc9112#section-9.4) — no normative per-origin connection ceiling.
- [RFC 9113 §5.1.2 — HTTP/2 stream concurrency](https://www.rfc-editor.org/rfc/rfc9113#section-5.1.2) — recommended ≥ 100 concurrent streams.
- [RFC 4648 — base64](https://www.rfc-editor.org/rfc/rfc4648) — 24-bit groups to 4 characters; exactly 4/3.

### Engine source and engine-team statements

- [V8 `src/base/ieee754.cc`](https://chromium.googlesource.com/v8/v8/+/refs/heads/main/src/base/ieee754.cc) — V8's fdlibm port, covering `sin/cos/tan/atan2/exp/log/pow/cbrt` and more.
- [V8 commit c1486295ae5 — "[math] Replace custom tanh with std::tanh"](https://chromium.googlesource.com/v8/v8/+/c1486295ae5) — a transcendental delegated to the host libm, making the same V8 OS-dependent.
- [v8.dev — "There's Math.random(), and then there's Math.random()"](https://v8.dev/blog/math-random) — the MWC1616 → xorshift128+ switch.
- [v8.dev — "Getting things sorted in V8"](https://v8.dev/blog/array-sort) — unstable QuickSort → TimSort in V8 v7.0 / Chrome 70.
- [Mozilla dev-platform — Intent to implement: fdlibm for Math functions](https://groups.google.com/a/mozilla.org/g/dev-platform/c/0dxAO-JsoXI/m/eEhjM9VsAgAJ) — Firefox does **not** use fdlibm for `sin`/`cos`/`tan` by default; V8 does. The clearest single statement that two shipping engines disagree.
- [SpiderMonkey newsletter, Firefox 92/93](https://spidermonkey.dev/blog/2021/09/10/newsletter-firefox-92-93.html) — fdlibm added as an *option* for cross-platform consistency.
- [Chromium `net/socket/client_socket_pool_manager.cc`](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/net/socket/client_socket_pool_manager.cc) — `g_max_sockets_per_group = {6 /* kNormal */, 255 /* kWebSocket */}`.

### Shipped-game postmortems and developer talks

- [Bettner & Terrano, "1500 Archers on a 28.8: Network Programming in Age of Empires and Beyond"](https://www.gamedeveloper.com/programming/1500-archers-on-a-28-8-network-programming-in-age-of-empires-and-beyond) (GDC 2001, Ensemble Studios) — the 250-unit state-streaming calculation, 200 ms turns, and out-of-sync as the project's worst bug class.
- [Michael Stallone, "8 Frames in 16ms: Rollback Networking in Mortal Kombat and Injustice 2"](https://media.gdcvault.com/gdc2018/presentations/Stallone_Michael_8FramesIn16ms.pdf) (GDC 2018, NetherRealm) — 7–8 man-years, <0.1% desync rate, and the state/visual separation rules.
- [David Salz, "Deterministic Simulation: What modern online games can learn from the Game Boy"](https://media.gdcvault.com/gdceurope2016/presentations/Salz_David_Deterministic_Simulation.pdf) (GDC Europe 2016, Sandbox Interactive / Albion Online) — "only +, –, \*, /, sqrt guaranteed"; JIT environments named as a losing condition; fixed-point recommendation.
- [Forrest Smith, "Synchronous RTS Engines and a Tale of Desyncs"](https://www.forrestthewoods.com/blog/synchronous_rts_engines_and_a_tale_of_desyncs/) and [part 2](https://www.gamedeveloper.com/business/opinion-synchronous-rts-engines-2-sync-harder) (Gas Powered Games) — 10 fps sim tick, per-second state hashing, IEEE-754 strict mode, 50–200 MB state saves.
- [Forrest Smith, "The Tech of Planetary Annihilation: ChronoCam"](https://www.forrestthewoods.com/blog/tech_of_planetary_annihilation_chrono_cam/) (Uber Entertainment) — why they left lockstep, and the ~1 Mbit/player state-streaming figure.
- [Patrick Wyatt, "The making of Warcraft part 3"](https://www.codeofhonor.com/blog/the-making-of-warcraft-part-3/) (Blizzard) — the earliest first-party account of sending commands rather than state.
- Factorio Friday Facts, first-party: [#47 CRC fun](https://www.factorio.com/blog/post/fff-47) (whole-map CRC per tick), [#147 Multiplayer rewrite](https://www.factorio.com/blog/post/fff-147) (O(n²) → O(n); shared-latency penalty), [#158 The end of the 32 bit era](https://www.factorio.com/blog/post/fff-158) (dropping a platform to avoid cross-architecture desyncs), [#188 Bug, Bug, Desync](https://factorio.com/blog/post/fff-188), [#340 Deep desyncs](https://www.factorio.com/blog/post/fff-340) (iteration order and recomputed derived state as root causes). Also the [Desynchronization](https://wiki.factorio.com/Desynchronization) and [Replay system](https://wiki.factorio.com/Replay_system) wiki pages.
- [Glenn Fiedler, "Deterministic Lockstep"](https://gafferongames.com/post/deterministic_lockstep/) · ["Floating Point Determinism"](https://gafferongames.com/post/floating_point_determinism/) (including the Hargreaves/MotoGP and Pandemic Studios quotes) · ["Snapshot Interpolation"](https://gafferongames.com/post/snapshot_interpolation/) (the 2–4 player recommendation) · ["Fix Your Timestep!"](https://gafferongames.com/post/fix_your_timestep/).
- [GGPO](https://www.ggpo.net/) — rollback requires "a fully deterministic peer-to-peer engine".
- [Blizzard `s2protocol`](https://github.com/Blizzard/s2protocol) — StarCraft II replays as init data plus an event log.

### Deterministic simulation in JavaScript specifically

- [Rune, "Making JS deterministic for fun and glory"](https://developers.rune.ai/blog/making-js-deterministic-for-fun-and-glory) — 31 patched `Math` operations via `Math.fround`, seeded mulberry32, patched sort comparator, ESLint plugin.
- [Rune, server-side logic determinism rules](https://developers.rune.ai/docs/how-it-works/server-side-logic) — the banned list (`async`/`await`, `Date`, `fetch`, regexes, `this`) and the library allowlist.
- [0 A.D. / Wildfire Games — "Question: deterministic JavaScript"](https://wildfiregames.com/forum/topic/24731-question-deterministic-javascript/) — a shipped RTS with a JavaScript simulation layer; seeded RNG, overridden `Math`, `for...in` order warnings.

### Infrastructure documentation

- [nginx `ngx_http_proxy_module`](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_buffering) — `proxy_buffering` default on, `X-Accel-Buffering`, `proxy_read_timeout` default 60 s.
- [AWS — Application Load Balancer attributes](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/edit-load-balancer-attributes.html) — 60 s idle timeout default, 1 h `client_keep_alive`, HTTP/2 PING frames do not reset the idle timer.
- [Cloudflare — connection limits](https://developers.cloudflare.com/fundamentals/reference/connection-limits/) — 125 s proxy read timeout, error 524.
- [Node.js `zlib` documentation](https://nodejs.org/api/zlib.html) — buffering behaviour and `Z_SYNC_FLUSH` / `BROTLI_OPERATION_FLUSH`.

### Repository sources

- [`docs/adr/0004-match-transport-and-tick-architecture.md`](../adr/0004-match-transport-and-tick-architecture.md) — the committed transport model.
- [`CONTEXT.md`](../../CONTEXT.md) — ratified vocabulary (**match event**, **resolution**, **phase**, **move**).
- `apps/api/src/routes/tick-stream.ts`, `apps/webapp/src/lib/use-tick-stream.ts` — the existing SSE seam.
- `apps/webapp/src/match-proto/flat-procedural/sim.ts` on `prototype/flat-procedural-lane` ([PR #90](https://github.com/arnavp103/hazard-pay/pull/90)) — the sim measured throughout.

### Reproducing the measurements

Every number in §5 and §6.2 came from running the real `sim.ts` under
`node --experimental-strip-types` (Node 22.23.1, V8, x86-64 Linux), with
`node:zlib` at gzip level 9 and brotli quality 11. The harnesses are small and
were deliberately not committed — they are throwaway measurement scripts
against a throwaway prototype. What they do is described precisely enough in
each section to rebuild in an hour, and the conformance harness proposed in
§6.4 is the version worth actually committing.
