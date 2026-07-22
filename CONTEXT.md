# Hazard Pay

An online multiplayer auto-battler with offline progression, set in a
cyberpunk world. Players act in a persistent overworld and fight in live
matches; the in-game AI leaders are real LLM agents.

## Language

The bare word **"event"** is banned — always qualify: *lane event*,
*match event*, or *domain event*.

### People and personas

**Player**:
A human participant in the game world.
_Avoid_: user (the authentication identity, not the game participant)

**User**:
A player's authentication identity. Auth vocabulary only — game concepts
reference the player, never the user.

**Leader**:
An in-game AI character driven by a real LLM agent, with its own persona,
model, and toolset.
_Avoid_: agent (reserved for the runtime machinery and for coding agents),
bot, NPC

### World and time

**Overworld**:
The persistent world layer that advances on ticks; where players act
between matches.

**Tick**:
One scheduled advancement of the overworld. Exclusively an overworld
concept — a live match has no tick.
_Avoid_: using "tick" for match pacing or frame timing

**Offline progression**:
The overworld having advanced while a player was away. A consequence of
ticks, not a catch-up mechanism — there is nothing to replay on return.

**Technofantasy**:
Exceptional powers and mythic character archetypes expressed within the
cyberpunk setting, such as espers and specialized cyberarmor. Espers are
rare and command significant investment; their abilities may be genuinely
supernatural or deliberately ambiguous. Technofantasy does not imply a
separate medieval-fantasy world.

**Action**:
A game operation defined once and invokable two ways: by players and by
leaders (as a tool).
_Avoid_: command

### Match

**Match**:
A bounded live combat encounter that advances phase by phase, with no
clock of its own.

**Phase**:
One step of a match.

**Decision phase**:
The phase in which participants choose their moves within a window.

**Move**:
A participant's chosen option, submitted during a decision phase.
_Avoid_: command, intent

**Resolution**:
The computation of a phase's outcome, recorded as an ordered batch of
match events.

**Match event**:
One record in a resolution's outcome batch, animated by clients at their
own presentation pace.

### Agent runtime

**Lane**:
One thread of a leader's context: an append-only log of lane events.
_Avoid_: session, thread, run

**Foreground lane**:
A leader's single long-lived lane, carrying its persona's continuity.

**Mission**:
A bounded lane a leader spawns for a specific goal, closed when done.
_Avoid_: task, subtask, subagent

**Wake**:
One activation of a lane: pending inputs are gathered and the leader runs
until quiet.

**Lane event**:
One record in a lane's log — an input, model turn, tool result, or
compaction.

**Input**:
A lane event appended by anything other than the lane's own loop: tick
results, player messages, other lanes' messages.

**Model turn**:
One recorded model call within a lane.

**Fold**:
Deriving a lane's current state from its log.

**Compaction**:
A recorded summarization that later folds start from; the transcript
beneath stays inspectable.
_Avoid_: snapshot

**Leader config**:
The declarative definition of a leader's persona, model, toolset, and
wake policy.

### Telemetry

**Domain event**:
A past-tense fact about the game domain (e.g. "match completed"), emitted
for observers.
_Avoid_: bare "event", analytics event
