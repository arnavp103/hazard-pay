/**
 * Idle-animation math for the match-proto render (#27) — pure, Node-tested.
 *
 * SEAM (real match view): presentation-pace animation state (interpolators,
 * animation state machines driven by match events) belongs in plain TS
 * modules like this one, per the #26 research §3 — the render layer only
 * projects it. The ticker in stage.ts calls this every frame.
 */

/** Milliseconds per radian of the breathing cycle. */
const BOB_PERIOD_MS = 480;
/** Sine amplitude in art pixels, pre-rounding. */
const BOB_AMPLITUDE = 1.2;

/**
 * Vertical idle-bob offset in *art pixels* (integer, in {-1, 0, 1}),
 * quantized so sprites move a whole art pixel at a time and never land
 * between device pixels. Multiply by the stage's integer scale to get
 * screen pixels.
 */
export function idleBobArtPixels(elapsedMS: number, phase: number): number {
  return Math.round(Math.sin(elapsedMS / BOB_PERIOD_MS + phase) * BOB_AMPLITUDE);
}
