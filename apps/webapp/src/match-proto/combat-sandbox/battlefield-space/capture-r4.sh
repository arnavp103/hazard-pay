#!/usr/bin/env bash
# THROWAWAY PROTOTYPE (#100 round 4): the exact gallery, as a command.
#
#   pnpm --filter @hazard-pay/webapp dev --port 5194     # in another terminal
#   AGENT_BROWSER_SESSION=hp-100-r4 \
#     apps/webapp/src/match-proto/combat-sandbox/battlefield-space/capture-r4.sh
#
# **`AGENT_BROWSER_SESSION` is not optional.** `agent-browser` is one shared
# session per machine; in round 1 two agents capturing at once overwrote each
# other's page mid-shot and both galleries came back silently wrong in a way
# that looked plausible. Set it to something nobody else will pick.
#
# Round 4's matrix is **board size x camera treatment**, everything else held at
# the ruled configuration (`spread` density, `hitscan` fire, covered approach
# on). Two questions, and the shots are grouped by which one they answer:
#
#   1. does more floor make the covered approach visible? The filmstrips are the
#      only artifact that can answer this — a route is not a still.
#   2. what does each camera treatment cost? `fit` pulls back and the figures
#      shrink out of the 22-48 px band; `pan` holds figure size and loses the
#      whole-board view. Both, at every size, so the crossover is visible rather
#      than argued.
#
# The strips are windowed on **first contact per size**, not on a fixed clock:
# a vast board is a longer walk (contact at 8.78 s versus 5.33 s), so a fixed
# instant would compare the approach on one board against the melee on another.
# Each strip is the last 4 seconds before contact — which is also exactly one
# one-way pan traverse, so the pan strips show a complete sweep.
#
# Stills mislead about ranged fire — at 40 shooters roughly one tracer is live
# per frame. Judge fire on the strips.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CAPTURE="${HERE}/../capture.mjs"
OUT="${OUT:-${HERE}/../../../../screenshots/battlefield-space-r4}"
URL="${URL:-http://localhost:5194}"
: "${AGENT_BROWSER_SESSION:?set AGENT_BROWSER_SESSION to a unique value first}"
export AGENT_BROWSER_SESSION

# The ruled configuration. Not reopened by round 4 — only the floor moves.
HELD="space=cover&density=spread&fire=hitscan"

# --- 1. the size x camera still matrix, at TRUE pixel size ------------------
# scale=1 is the honest read: this is how big a body actually is on screen under
# each treatment. The `fit` row is what "pull back and show the whole board"
# costs, and it is meant to be uncomfortable to look at.
node "${CAPTURE}" --out "${OUT}" --url "${URL}" \
  --shot "fit-compact-1x=view=crowd&${HELD}&size=compact&camera=fit&freeze=6330" \
  --shot "fit-broad-1x=view=crowd&${HELD}&size=broad&camera=fit&freeze=8620" \
  --shot "fit-vast-1x=view=crowd&${HELD}&size=vast&camera=fit&freeze=9780" \
  --shot "pan-compact-1x=view=crowd&${HELD}&size=compact&camera=pan&freeze=6330" \
  --shot "pan-broad-1x=view=crowd&${HELD}&size=broad&camera=pan&freeze=8620" \
  --shot "pan-vast-1x=view=crowd&${HELD}&size=vast&camera=pan&freeze=9780"

# --- 2. the same matrix at 2x, so a reader can actually inspect it ----------
# `scale` multiplies the canvas AND the pixels per world unit, so framing is
# identical and only the sampling density changes. These do NOT show the
# legibility loss — they exist so the arrangement of bodies is readable in a PR.
node "${CAPTURE}" --out "${OUT}" --url "${URL}" \
  --shot "fit-compact-2x=view=crowd&${HELD}&size=compact&camera=fit&scale=2&freeze=6330" \
  --shot "fit-broad-2x=view=crowd&${HELD}&size=broad&camera=fit&scale=2&freeze=8620" \
  --shot "fit-vast-2x=view=crowd&${HELD}&size=vast&camera=fit&scale=2&freeze=9780" \
  --shot "pan-compact-2x=view=crowd&${HELD}&size=compact&camera=pan&scale=2&freeze=6330" \
  --shot "pan-broad-2x=view=crowd&${HELD}&size=broad&camera=pan&scale=2&freeze=8620" \
  --shot "pan-vast-2x=view=crowd&${HELD}&size=vast&camera=pan&scale=2&freeze=9780"

# --- 3. THE artifact: is the covered approach visible? ----------------------
# 24 frames at 6 fps = the last 4 seconds before first contact. If melee bounds
# prop to prop while shooters hold firing positions, it is in these or it is
# nowhere. Round 3 could not produce this at `spread` on the compact board.
node "${CAPTURE}" --out "${OUT}" --url "${URL}" \
  --shot "strip-fit-compact=view=crowd&${HELD}&size=compact&camera=fit&strip=24&fps=6&from=1330&cols=6" \
  --shot "strip-fit-broad=view=crowd&${HELD}&size=broad&camera=fit&strip=24&fps=6&from=3620&cols=6" \
  --shot "strip-fit-vast=view=crowd&${HELD}&size=vast&camera=fit&strip=24&fps=6&from=4780&cols=6" \
  --shot "strip-pan-compact=view=crowd&${HELD}&size=compact&camera=pan&strip=24&fps=6&from=1330&cols=6" \
  --shot "strip-pan-broad=view=crowd&${HELD}&size=broad&camera=pan&strip=24&fps=6&from=3620&cols=6" \
  --shot "strip-pan-vast=view=crowd&${HELD}&size=vast&camera=pan&strip=24&fps=6&from=4780&cols=6"

# --- 4. the asymmetric fight, where the two postures separate most ----------
# Shooters vs swords. Contact is much later here (21.1 s at `vast`), so these
# are windowed on their own contact times.
node "${CAPTURE}" --out "${OUT}" --url "${URL}" \
  --shot "strip-split-compact=view=crowd&${HELD}&roster=split&size=compact&camera=fit&strip=24&fps=6&from=10730&cols=6" \
  --shot "strip-split-vast-fit=view=crowd&${HELD}&roster=split&size=vast&camera=fit&strip=24&fps=6&from=17130&cols=6" \
  --shot "strip-split-vast-pan=view=crowd&${HELD}&roster=split&size=vast&camera=pan&strip=24&fps=6&from=17130&cols=6"

# --- 5. what a pan actually shows -------------------------------------------
# A full one-way traverse, phase-aligned (the sweep restarts every 8 s, so
# from=8000 is the left edge). This is the shot that answers "can you see who is
# winning when you cannot see the whole fight".
node "${CAPTURE}" --out "${OUT}" --url "${URL}" \
  --shot "traverse-broad=view=crowd&${HELD}&size=broad&camera=pan&strip=24&fps=6&from=8000&cols=6" \
  --shot "traverse-vast=view=crowd&${HELD}&size=vast&camera=pan&strip=24&fps=6&from=8000&cols=6"

# --- 6. the boards themselves ----------------------------------------------
# The grid overlay, so the tiled prop field and the held density are inspectable
# rather than taken on trust from a table.
node "${CAPTURE}" --out "${OUT}" --url "${URL}" \
  --shot "grid-compact=view=crowd&${HELD}&size=compact&camera=fit&grid=1&scale=2&freeze=0" \
  --shot "grid-broad=view=crowd&${HELD}&size=broad&camera=fit&grid=1&scale=2&freeze=0" \
  --shot "grid-vast=view=crowd&${HELD}&size=vast&camera=fit&grid=1&scale=2&freeze=0"

# --- 7. the plaza control ---------------------------------------------------
# No cover at all, at the largest board. If crowding rather than cover is what
# collapses the fight, this should hold together too.
node "${CAPTURE}" --out "${OUT}" --url "${URL}" \
  --shot "strip-plaza-vast=view=crowd&space=plaza&fire=hitscan&size=vast&camera=fit&strip=24&fps=6&from=3950&cols=6"

# --- 8. motion, for a cold reader ------------------------------------------
node "${CAPTURE}" --out "${OUT}" --url "${URL}" --frames 48 --fps 12 \
  --gif "gif-fit-vast=view=crowd&${HELD}&size=vast&camera=fit&start=4" \
  --gif "gif-pan-vast=view=crowd&${HELD}&size=vast&camera=pan&start=4"

echo "gallery written to ${OUT}"
