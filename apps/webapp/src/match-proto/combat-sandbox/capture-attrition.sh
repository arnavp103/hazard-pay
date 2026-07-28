#!/usr/bin/env bash
#
# THROWAWAY SCAFFOLDING (#101): the exact shot list behind the attrition
# gallery, so the pictures in the PR comment can be reproduced rather than
# trusted.
#
# It drives `capture.mjs` (the #67 capture path) and then tiles the results
# with ffmpeg. Every variant is shot at the SAME camera, the SAME default seed
# and the SAME sim seconds — the whole question is how the read changes as the
# numbers fall, so nothing else may move between two tiles.
#
#   pnpm --filter @hazard-pay/webapp dev                 # in another terminal
#   URL=http://localhost:5173 ./capture-attrition.sh
#
# Env: URL (dev server), OUT (gallery directory).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../../../.." && pwd)"
URL="${URL:-http://localhost:5173}"
OUT="${OUT:-$REPO/apps/webapp/screenshots/combat-sandbox-attrition}"
RAW="${RAW:-$(mktemp -d)}"
FONT="${FONT:-/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf}"

# The six treatments, plus the targeting ablation that shows what commitment is
# for. `loose` is `removed` with #97's commitment rule taken back out.
VARIANTS=(none downed fade debris removed ranks loose)
query_for() {
  case "$1" in
    loose) echo "death=removed&commit=0" ;;
    *) echo "death=$1" ;;
  esac
}
# Sim seconds. First death lands at ~4.0 s and a side is at half strength by
# ~11-16 s, so this spans "two lines closing" through "who is left".
TIMES=(0 4 8 12 16 20)

mkdir -p "$OUT" "$RAW"

label() { # <in> <out> <text>
  ffmpeg -y -loglevel error -i "$1" -vf \
    "drawtext=fontfile=$FONT:text='$3':x=10:y=8:fontsize=17:fontcolor=white:box=1:boxcolor=0x1b1220@0.72:boxborderw=6" \
    "$2"
}

grid() { # <out> <cols> <in...>
  local out="$1" cols="$2"
  shift 2
  local inputs=() filter="" n=$# row=0 i=0
  for file in "$@"; do inputs+=(-i "$file"); done
  while [ $i -lt "$n" ]; do
    local chain="" c=0
    while [ $c -lt "$cols" ] && [ $((i + c)) -lt "$n" ]; do
      chain="$chain[$((i + c)):v]"
      c=$((c + 1))
    done
    filter="$filter${chain}hstack=inputs=$c[r$row];"
    row=$((row + 1))
    i=$((i + cols))
  done
  local rows="" r=0
  while [ $r -lt "$row" ]; do
    rows="$rows[r$r]"
    r=$((r + 1))
  done
  if [ "$row" -gt 1 ]; then filter="${filter}${rows}vstack=inputs=$row[out]"; else filter="${filter}${rows}null[out]"; fi
  ffmpeg -y -loglevel error "${inputs[@]}" -filter_complex "$filter" -map "[out]" "$out"
}

# agent-browser over headless WebGL is flaky under load (#26 flagged it, and it
# shows up here as a failed `png()` eval or, worse, a stale frame from the
# previous shot). Retry the batch, and hash-check the results at the end — a
# duplicate PNG across two distinct sim times is a stale grab, not a still fight.
shoot() {
  for attempt in 1 2 3; do
    if node "$HERE/capture.mjs" --url "$URL" "$@"; then return 0; fi
    echo "  (capture attempt $attempt failed, retrying)" >&2
    agent-browser close >/dev/null 2>&1 || true
    sleep 2
  done
  echo "capture failed three times: $*" >&2
  return 1
}

# One shot per invocation, checked. `agent-browser open` can return before the
# new page has replaced the old one, so a `png()` eval sometimes grabs the
# PREVIOUS shot's canvas — a silent, plausible-looking wrong picture, which in a
# gallery whose whole argument is a comparison is the worst possible failure.
#
# Two properties catch it. At step 0 no treatment has done anything yet, so
# every variant's t=0 frame must be pixel-identical to the control's; and no two
# distinct shots may ever produce the same pixels. Violations are retried.
SEEN=""
hash_of() { sha256sum "$1" | cut -c1-64; }

checked() { # <name> <query> <expected-hash|"unique">
  local name="$1" query="$2" expect="$3" hash
  for attempt in 1 2 3 4; do
    rm -f "$RAW/$name.png"
    shoot --out "$RAW" --shot "$name=$query"
    hash="$(hash_of "$RAW/$name.png")"
    if [ "$expect" = "unique" ]; then
      case "$SEEN" in *"$hash"*) ;; *) SEEN="$SEEN $hash"; return 0 ;; esac
    elif [ "$hash" = "$expect" ]; then
      return 0
    fi
    echo "  ($name looks like a stale grab, attempt $attempt)" >&2
    agent-browser close >/dev/null 2>&1 || true
    sleep 2
  done
  echo "$name never captured cleanly" >&2
  return 1
}

echo "== stills: ${#VARIANTS[@]} variants x ${#TIMES[@]} moments"
# The control's own t=0, verified against itself before it is trusted as the
# reference every other variant's t=0 is checked against.
checked none-t0 "view=crowd&death=none&start=0&freeze=0000" unique
ZERO="$(hash_of "$RAW/none-t0.png")"
checked none-t0 "view=crowd&death=none&start=0&freeze=0000" "$ZERO"
for variant in "${VARIANTS[@]}"; do
  for t in "${TIMES[@]}"; do
    query="view=crowd&$(query_for "$variant")&start=$t&freeze=${t}000"
    if [ "$t" = "0" ]; then
      [ "$variant" = "none" ] || checked "$variant-t$t" "$query" "$ZERO"
    else
      checked "$variant-t$t" "$query" unique
    fi
  done
done

echo "== filmstrips: the fall itself, at the shared combat zoom"
for variant in "${VARIANTS[@]}"; do
  checked "strip-$variant" \
    "view=crowd&$(query_for "$variant")&zoom=0.82&strip=8&fps=8&from=3600&cols=8" unique
done

echo "== motion: 4 s from the first casualties"
for variant in "${VARIANTS[@]}"; do
  shoot --out "$OUT" --frames 48 --fps 12 --from 6 \
    --gif "motion-$variant=view=crowd&$(query_for "$variant")&start=6"
done

echo "== tiling"
for variant in "${VARIANTS[@]}"; do
  tiles=()
  for t in "${TIMES[@]}"; do
    label "$RAW/$variant-t$t.png" "$RAW/lbl-$variant-t$t.png" "$variant   t=${t}s"
    tiles+=("$RAW/lbl-$variant-t$t.png")
  done
  grid "$OUT/arc-$variant.png" 3 "${tiles[@]}"
done

for t in 8 12 20; do
  tiles=()
  for variant in "${VARIANTS[@]:0:6}"; do
    tiles+=("$RAW/lbl-$variant-t$t.png")
  done
  grid "$OUT/compare-t$t.png" 3 "${tiles[@]}"
done

for variant in "${VARIANTS[@]}"; do
  label "$RAW/strip-$variant.png" "$OUT/fall-$variant.png" "$variant   the fall, 3.6-4.5 s at 8 fps, combat zoom"
done

echo "== metrics"
"$REPO/node_modules/.bin/tsx" "$HERE/attrition-report.mts" > "$OUT/metrics.json"

echo "gallery in $OUT"
