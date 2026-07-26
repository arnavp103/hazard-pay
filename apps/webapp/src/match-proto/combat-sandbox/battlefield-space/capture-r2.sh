#!/usr/bin/env bash
# THROWAWAY PROTOTYPE (#100 round 2): the exact gallery, as a command.
#
# Round 1's gallery was captured from an ad-hoc command line, which means the
# only record of what a given PNG actually shows is its filename. This script
# is that record. Re-running it reproduces the gallery byte-for-byte, because
# every shot is a frozen sim second driven through `capture.mjs`.
#
#   pnpm --filter @hazard-pay/webapp dev --port 5183      # in another terminal
#   AGENT_BROWSER_SESSION=hp-100-r2 \
#     apps/webapp/src/match-proto/combat-sandbox/battlefield-space/capture-r2.sh
#
# **`AGENT_BROWSER_SESSION` is not optional.** `agent-browser` is one shared
# session per machine; in round 1 two agents capturing at once overwrote each
# other's page mid-shot and both galleries came back silently wrong in a way
# that looked plausible. Set it to something nobody else will pick.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CAPTURE="${HERE}/../capture.mjs"
OUT="${OUT:-${HERE}/../../../../screenshots/battlefield-space-r2}"
URL="${URL:-http://localhost:5183}"
: "${AGENT_BROWSER_SESSION:?set AGENT_BROWSER_SESSION to a unique value first}"
export AGENT_BROWSER_SESSION

# t=8 s: past the approach, into the steady state, and the moment round 1's
# gallery froze on — so a round-2 still is directly comparable to a round-1 one.
AT=8000
S2="scale=2&freeze=${AT}"

node "${CAPTURE}" --out "${OUT}" --url "${URL}" \
  --shot "a-plaza=view=crowd&space=plaza&${S2}" \
  --shot "b-dense=view=crowd&space=cover&density=dense&${S2}" \
  --shot "b-spread=view=crowd&space=cover&density=spread&${S2}" \
  --shot "b-sparse=view=crowd&space=cover&density=sparse&${S2}" \
  --shot "grid-dense=view=crowd&space=cover&density=dense&grid=1&${S2}" \
  --shot "grid-spread=view=crowd&space=cover&density=spread&grid=1&${S2}" \
  --shot "grid-sparse=view=crowd&space=cover&density=sparse&grid=1&${S2}" \
  --shot "r-plaza=view=crowd&space=plaza&roster=ranged&fire=bolt&${S2}" \
  --shot "r-dense=view=crowd&space=cover&density=dense&roster=ranged&fire=bolt&${S2}" \
  --shot "r-spread=view=crowd&space=cover&density=spread&roster=ranged&fire=bolt&${S2}" \
  --shot "r-sparse=view=crowd&space=cover&density=sparse&roster=ranged&fire=bolt&${S2}" \
  --shot "split-plaza=view=crowd&space=plaza&roster=split&fire=bolt&${S2}" \
  --shot "split-spread=view=crowd&space=cover&density=spread&roster=split&fire=bolt&${S2}"

# The fire question needs a strip, not a still. One tracer lives ~0.13 s and an
# all-shooter fight releases about one shot every seven steps, so a frozen frame
# holds roughly one streak — which says nothing about whether a ranged exchange
# reads. Three strips of the SAME two seconds, one per fire mode, is the
# comparison the question actually wants.
STRIP="strip=24&fps=12&from=${AT}&cols=6"
node "${CAPTURE}" --out "${OUT}" --url "${URL}" \
  --shot "strip-fire-none=view=crowd&space=cover&density=spread&roster=ranged&fire=none&${STRIP}" \
  --shot "strip-fire-hitscan=view=crowd&space=cover&density=spread&roster=ranged&fire=hitscan&${STRIP}" \
  --shot "strip-fire-bolt=view=crowd&space=cover&density=spread&roster=ranged&fire=bolt&${STRIP}" \
  --shot "strip-mixed-dense=view=crowd&space=cover&density=dense&${STRIP}" \
  --shot "strip-mixed-spread=view=crowd&space=cover&density=spread&${STRIP}"

# The strips above are at native pixel density, which is the register the
# question has to be answered in — but a cold reader also needs to see what the
# stand-in IS before judging whether it is enough. Same seconds, magnified.
CLOSE="zoom=1.5&scale=2&strip=8&fps=12&from=${AT}&cols=4"
node "${CAPTURE}" --out "${OUT}" --url "${URL}" \
  --shot "close-fire-hitscan=view=crowd&space=cover&density=spread&roster=ranged&fire=hitscan&${CLOSE}" \
  --shot "close-fire-bolt=view=crowd&space=cover&density=spread&roster=ranged&fire=bolt&${CLOSE}"

node "${CAPTURE}" --out "${OUT}" --url "${URL}" --frames 48 --fps 12 --from 8 --scale 1 \
  --gif "motion-mixed-spread=view=crowd&space=cover&density=spread" \
  --gif "motion-ranged-spread-bolt=view=crowd&space=cover&density=spread&roster=ranged&fire=bolt"

# Two shots that differ only in a query string coming back byte-identical is the
# exact failure round 1 hit and fixed in `capture.mjs`. Cheap to re-check, and
# a silently-duplicated gallery is worse than no gallery.
echo "--- duplicate check (any repeated hash is a capture bug) ---"
md5sum "${OUT}"/*.png | sort | awk '{ print $1 }' | uniq -d
echo "--- done: ${OUT} ---"
