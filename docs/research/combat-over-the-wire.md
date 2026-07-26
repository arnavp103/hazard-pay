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
one match event per slice (or a handful, chunked by second), whose payload is a
packed 10 Hz position/facing track plus the discrete outcomes at full time
resolution, with the client interpolating between samples and running the
existing procedural animation layers on top. Measured, that is **13.9 KiB
uncompressed, 12.2 KiB brotli, 18.6 KiB after the base64 that SSE's text-only
wire forces** for a 5-second 40-unit slice. Deterministic re-simulation from a
seed would be 173 bytes, but it buys a ~14 KiB saving in exchange for making
bit-identical floating point across Node and every browser engine a permanent
correctness requirement — and §6 shows this specific sim already depends on
`Math.hypot`, which ECMA-262 leaves implementation-approximated. **ADR 0004
survives**; nothing here pressures SSE, the atomic transaction, or the phase
state machine. What it does pressure is the unwritten assumption that a match
event is a small semantic record — §8.

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

What it buys: ~14 KiB per slice, ~0.16 MiB per match. See §5 for whether that
is worth anything.

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
3. **Compression does most of the remaining work on JSON, and almost none on
   packed binary.** JSON @10 Hz goes 171.7 → 21.5 KiB brotli (8.0×); packed
   binary goes 13.9 → 12.2 KiB (1.14×). The packed form is already near its
   entropy. So the *right* comparison is **21.5 KiB (JSON+brotli) vs 12.2 KiB
   (packed+brotli)** — packed binary wins by 1.8×, not by the 12× the raw
   column suggests. Given that SSE forces base64 on binary (below), JSON's
   simplicity is worth serious consideration.
4. **Everything below A2@10 Hz is noise.** The gap between the best enumerated
   form (12.2 KiB) and the seed (173 B) is ~12 KiB per slice. §7 puts that in
   context.

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

Measured end-to-end for the recommended shape: packed @10 Hz is 13.9 KiB
binary → 18.6 KiB base64 → **13.5 KiB gzipped on the wire**. Note gzip claws
back most of the base64 expansion (base64 of compressed-looking data still has
structure), so the final wire cost lands within ~10% of the brotli'd JSON at
the same rate. **The encoding choice barely matters; the sample rate is
everything.**

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
| A2 @10 Hz JSON, brotli | 21.5 KiB | 35 kbit/s | 258 KiB | 2.5 MiB |
| **A3 @10 Hz packed, b64+gzip** | **13.5 KiB** | **22 kbit/s** | 162 KiB | 1.6 MiB |
| C hybrid, brotli | 1.3 KiB | 2 kbit/s | 16 KiB | 156 KiB |
| B seed | 173 B | negligible | 2 KiB | 20 KiB |

The recommended option is **22 kbit/s sustained per viewer**. For reference that
is a fraction of a low-bitrate audio stream. There is no bandwidth problem here
— only a *record-count* problem, and batching solves that.

---

## 6. JavaScript determinism hazards

This section decides Option B, so it is the longest. It has two halves: what the
language guarantees, and what this specific sim actually does when you poke it.

### 6.1 What ECMAScript guarantees, and what it does not

*(Primary-source citations — spec clauses and V8 documentation — collected in
§10 and referenced inline.)*

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
produce for the same source. But note the second column — the *physical*
divergence is 3.1e-15 world units on a field ~30 units across. Invisible by
about 14 orders of magnitude.

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

### 6.3 The gap this research could not close

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

Two SSE facts constrain the design and are worth writing down: the wire is
UTF-8 text, so binary must be base64'd (§5); and `EventSource` cannot send
custom headers, so the resume cursor must travel in `Last-Event-ID` or the URL —
which the existing route already assumes.

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

**Adopt Option A at 10 Hz, packed, batched into ~1-second match events, with
discrete outcomes at full time resolution.**

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

*Collected below; each claim in §6.1 references one of these.*
