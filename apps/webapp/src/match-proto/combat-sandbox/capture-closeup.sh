#!/usr/bin/env bash
#
# THROWAWAY SCAFFOLDING (#101): the fall itself, close enough to price.
#
# The crowd sheets answer "what does the field look like". These two answer
# "what pose is an art lane being asked to author, and what does each exit
# actually look like on a body".
#
# The camera is NOT moved — map #95 fixes it and this ticket does not get to
# touch it. The frame is rendered at 3x pixel density and **cropped**. Both
# subjects are deterministic properties of the default seed, found with
# `probe-screen.mts`:
#
#   opfor fodder, unit 21, the first casualty, t = 3.98 s, canvas (361, 452) at 3x
#
# The exit sheet uses the FIRST death on purpose: up to that moment no body has
# been spliced under any treatment, so all four are still the same fight and
# the four exits are four exits from the same body rather than four fights.
#
#   URL=http://localhost:5173 ./capture-closeup.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../../../.." && pwd)"
URL="${URL:-http://localhost:5173}"
OUT="${OUT:-$REPO/apps/webapp/screenshots/combat-sandbox-attrition}"
RAW="${RAW:-$(mktemp -d)}"
FONT="${FONT:-/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf}"

FALL_CROP="crop=330:240:196:332"
FALL_TIMES=(3.93 3.98 4.05 4.12 4.18 4.25 4.35 4.55)
EXIT_CROP="crop=330:240:196:332"
EXIT_TIMES=(3.95 4.30 4.80 5.80)
EXITS=(downed fade debris removed)

mkdir -p "$OUT" "$RAW"

# See `capture-attrition.sh`: `agent-browser open` can return before the new
# page has replaced the old one, so a `png()` eval sometimes returns the
# PREVIOUS shot's canvas. One shot per invocation, and every frame here must be
# pixel-unique — two of these tiles being the same picture would invent a
# finding — so a repeat is retried rather than tiled.
SEEN=""
shoot() { # <name> <variant> <seconds>
  local name="$1" variant="$2" t="$3" ms hash
  ms=$(printf '%.0f' "$(echo "$t * 1000" | bc -l)")
  for attempt in 1 2 3 4; do
    rm -f "$RAW/$name.png"
    if node "$HERE/capture.mjs" --url "$URL" --out "$RAW" \
      --shot "$name=view=crowd&death=$variant&start=$t&freeze=$ms&scale=3"; then
      hash="$(sha256sum "$RAW/$name.png" | cut -c1-64)"
      case "$SEEN" in
        *"$hash"*) echo "  ($name repeats an earlier frame, attempt $attempt)" >&2 ;;
        *) SEEN="$SEEN $hash"; return 0 ;;
      esac
    fi
    agent-browser close >/dev/null 2>&1 || true
    sleep 2
  done
  echo "$name never captured cleanly" >&2
  return 1
}

tile() { # <in> <out> <crop> <text>
  ffmpeg -y -loglevel error -i "$1" -vf \
    "$3,drawtext=fontfile=$FONT:text='$4':x=8:y=6:fontsize=20:fontcolor=white:box=1:boxcolor=0x1b1220@0.75:boxborderw=5" \
    "$2"
}

echo "== the fall: the topple itself, 0.6 s either side of the killing blow"
SEEN=""
for t in "${FALL_TIMES[@]}"; do
  shoot "fall-$t" downed "$t"
done

tiles=()
for t in "${FALL_TIMES[@]}"; do
  tile "$RAW/fall-$t.png" "$RAW/t-fall-$t.png" "$FALL_CROP" "${t}s"
  tiles+=("$RAW/t-fall-$t.png")
done
inputs=()
for file in "${tiles[@]}"; do inputs+=(-i "$file"); done
ffmpeg -y -loglevel error "${inputs[@]}" -filter_complex \
  "[0:v][1:v][2:v][3:v]hstack=inputs=4[a];[4:v][5:v][6:v][7:v]hstack=inputs=4[b];[a][b]vstack=inputs=2[s];[s]drawtext=fontfile=$FONT:text='death-fall — the first casualty topples, t=3.93-4.55 s. 3x density, cropped, fixed camera':x=10:y=h-32:fontsize=22:fontcolor=white:box=1:boxcolor=0x1b1220@0.82:boxborderw=7[out]" \
  -map "[out]" "$OUT/closeup-fall.png"

# SEEN is reset per variant: at t=3.95 nothing has died yet, so the four
# treatments legitimately render the same pixels — that is the point of using
# the first casualty. Uniqueness only has to hold across TIMES within a row.
echo "== the exits: one body, four treatments"
for variant in "${EXITS[@]}"; do
  SEEN=""
  for t in "${EXIT_TIMES[@]}"; do
    shoot "exit-$variant-$t" "$variant" "$t"
  done
done

rows=()
for variant in "${EXITS[@]}"; do
  tiles=()
  for t in "${EXIT_TIMES[@]}"; do
    tile "$RAW/exit-$variant-$t.png" "$RAW/t-exit-$variant-$t.png" "$EXIT_CROP" "$variant   ${t}s"
    tiles+=("$RAW/t-exit-$variant-$t.png")
  done
  inputs=()
  for file in "${tiles[@]}"; do inputs+=(-i "$file"); done
  ffmpeg -y -loglevel error "${inputs[@]}" -filter_complex \
    "[0:v][1:v][2:v][3:v]hstack=inputs=4[out]" -map "[out]" "$RAW/row-$variant.png"
  rows+=("$RAW/row-$variant.png")
done
inputs=()
for file in "${rows[@]}"; do inputs+=(-i "$file"); done
ffmpeg -y -loglevel error "${inputs[@]}" -filter_complex \
  "[0:v][1:v][2:v][3:v]vstack=inputs=4[s];[s]drawtext=fontfile=$FONT:text='the same body leaving the field four ways — first casualty, t=3.95-5.80 s':x=10:y=h-32:fontsize=22:fontcolor=white:box=1:boxcolor=0x1b1220@0.82:boxborderw=7[out]" \
  -map "[out]" "$OUT/closeup-exits.png"

echo "close-ups in $OUT"
