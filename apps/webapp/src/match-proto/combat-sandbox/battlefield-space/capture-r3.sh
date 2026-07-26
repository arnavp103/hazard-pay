#!/usr/bin/env bash
# THROWAWAY PROTOTYPE (#100 round 3): the exact gallery, as a command.
#
#   pnpm --filter @hazard-pay/webapp dev --port 5193      # in another terminal
#   AGENT_BROWSER_SESSION=hp-100-r3 \
#     apps/webapp/src/match-proto/combat-sandbox/battlefield-space/capture-r3.sh
#
# **`AGENT_BROWSER_SESSION` is not optional.** `agent-browser` is one shared
# session per machine; in round 1 two agents capturing at once overwrote each
# other's page mid-shot and both galleries came back silently wrong in a way
# that looked plausible. Set it to something nobody else will pick.
#
# Round 3 has two questions and the shots are grouped by which one they answer:
#
#   1. do melee and ranged now visibly do DIFFERENT things? (`approach=0` is
#      rounds 1-2, where melee ignored cover; the default is round 3)
#   2. does the duck/peek ruling read at 28 px? Height is the channel it was
#      chosen for, so the strips are where it has to survive.
#
# Stills mislead about ranged fire — at 40 shooters roughly one tracer is live
# per frame. Judge fire on the strips.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CAPTURE="${HERE}/../capture.mjs"
OUT="${OUT:-${HERE}/../../../../screenshots/battlefield-space-r3}"
URL="${URL:-http://localhost:5193}"
: "${AGENT_BROWSER_SESSION:?set AGENT_BROWSER_SESSION to a unique value first}"
export AGENT_BROWSER_SESSION

# t=8 s, the same instant rounds 1 and 2 froze on, so a round-3 still is
# directly comparable to theirs.
AT=8000
S2="scale=2&freeze=${AT}"

# --- 1. the A/B: melee ignoring cover, versus melee routing through it -------
node "${CAPTURE}" --out "${OUT}" --url "${URL}" \
  --shot "ab-spread-r2=view=crowd&space=cover&density=spread&fire=hitscan&approach=0&${S2}" \
  --shot "ab-spread-r3=view=crowd&space=cover&density=spread&fire=hitscan&${S2}" \
  --shot "ab-dense-r2=view=crowd&space=cover&density=dense&fire=hitscan&approach=0&${S2}" \
  --shot "ab-dense-r3=view=crowd&space=cover&density=dense&fire=hitscan&${S2}" \
  --shot "ab-split-r2=view=crowd&space=cover&density=spread&roster=split&fire=hitscan&approach=0&${S2}" \
  --shot "ab-split-r3=view=crowd&space=cover&density=spread&roster=split&fire=hitscan&${S2}" \
  --shot "grid-spread-r3=view=crowd&space=cover&density=spread&grid=1&${S2}" \
  --shot "plaza=view=crowd&space=plaza&fire=hitscan&${S2}"

# --- 2. the archetype read, as motion --------------------------------------
# The artifact the ticket asks for: swords bounding prop to prop while shooters
# hold firing positions. A still cannot show a route.
STRIP="strip=24&fps=12&from=${AT}&cols=6"
node "${CAPTURE}" --out "${OUT}" --url "${URL}" \
  --shot "strip-split-r2=view=crowd&space=cover&density=spread&roster=split&fire=hitscan&approach=0&${STRIP}" \
  --shot "strip-split-r3=view=crowd&space=cover&density=spread&roster=split&fire=hitscan&${STRIP}" \
  --shot "strip-mixed-r2=view=crowd&space=cover&density=spread&fire=hitscan&approach=0&${STRIP}" \
  --shot "strip-mixed-r3=view=crowd&space=cover&density=spread&fire=hitscan&${STRIP}"

# --- 3. does duck/peek read at 28 px? --------------------------------------
# The ruling picked this model because a ducked body and a peeking body differ
# in HEIGHT. These are the shots that test that claim rather than assert it —
# early, while bodies are still approaching and the stance mix is widest.
EARLY="strip=24&fps=12&from=4000&cols=6"
node "${CAPTURE}" --out "${OUT}" --url "${URL}" \
  --shot "strip-stance-dense=view=crowd&space=cover&density=dense&roster=ranged&fire=hitscan&${EARLY}" \
  --shot "strip-stance-spread=view=crowd&space=cover&density=spread&roster=ranged&fire=hitscan&${EARLY}" \
  --shot "stance-dense-2x=view=crowd&space=cover&density=dense&roster=ranged&fire=hitscan&zoom=1.1&scale=2&freeze=4000" \
  --shot "stance-spread-2x=view=crowd&space=cover&density=spread&roster=ranged&fire=hitscan&zoom=1.1&scale=2&freeze=4000"

# --- 4. motion, for a cold reader ------------------------------------------
node "${CAPTURE}" --out "${OUT}" --url "${URL}" --frames 48 --fps 12 \
  --gif "gif-split-r3=view=crowd&space=cover&density=spread&roster=split&fire=hitscan&start=4" \
  --gif "gif-mixed-r3=view=crowd&space=cover&density=spread&fire=hitscan&start=4"

echo "gallery written to ${OUT}"
