/**
 * THROWAWAY PROTOTYPE (#82): cluster consolidation — the step that turns a
 * palette-quantized render into something drawn.
 *
 * Quantizing a render does not create pixel clusters; it creates confetti in
 * approved colours. Measured on the first pass of this lane: 398 body pixels
 * split into 166 flat-colour islands, median island size 1 px, with the
 * character's dominant accent scattered across 24 separate islands. The
 * density reference the art board names sits at ~0.21 islands per body pixel;
 * that first pass measured 0.42.
 *
 * So: label the flat-colour islands, and let anything under the minimum
 * readable cluster size be absorbed by whichever neighbour it touches most.
 * Repeat until stable. It is a morphological open in palette space, and it is
 * the closest a pipeline can get to the decision a pixel artist makes when
 * they refuse to spend a lone pixel on a highlight that will not read.
 *
 * The scarce signal colours are exempt: a 2-px visor slit is deliberate, not
 * an artefact, and it is the one place a single pixel is allowed to mean
 * something.
 */

const PROTECTED = new Set([0x2f9e96, 0xa8f0e4]);

function key(rgba: Uint8Array | Uint8ClampedArray, i: number): number {
  return ((rgba[i * 4] ?? 0) << 16) | ((rgba[i * 4 + 1] ?? 0) << 8) | (rgba[i * 4 + 2] ?? 0);
}

export interface IslandStats {
  /** Opaque pixels considered. */
  pixels: number;
  /** Flat-colour 4-connected regions among them. */
  islands: number;
  /** Islands per opaque pixel — the density number worth reporting. */
  ratio: number;
  /** Share of islands that are a single pixel. */
  singletonShare: number;
}

/** Label 4-connected runs of identical colour among opaque pixels. */
function label(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): { ids: Int32Array; sizes: number[] } {
  const ids = new Int32Array(width * height).fill(-1);
  const sizes: number[] = [];
  const stack: number[] = [];

  for (let start = 0; start < width * height; start += 1) {
    if (ids[start] !== -1 || (rgba[start * 4 + 3] ?? 0) === 0) { continue; }
    const colour = key(rgba, start);
    const id = sizes.length;
    let size = 0;
    stack.length = 0;
    stack.push(start);
    ids[start] = id;
    while (stack.length > 0) {
      const at = stack.pop() ?? 0;
      size += 1;
      const x = at % width;
      const y = (at - x) / width;
      const neighbours = [
        x > 0 ? at - 1 : -1,
        x < width - 1 ? at + 1 : -1,
        y > 0 ? at - width : -1,
        y < height - 1 ? at + width : -1,
      ];
      for (const n of neighbours) {
        if (n < 0 || ids[n] !== -1) { continue; }
        if ((rgba[n * 4 + 3] ?? 0) === 0 || key(rgba, n) !== colour) { continue; }
        ids[n] = id;
        stack.push(n);
      }
    }
    sizes.push(size);
  }
  return { ids, sizes };
}

export function islandStats(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): IslandStats {
  const { sizes } = label(rgba, width, height);
  const pixels = sizes.reduce((sum, size) => sum + size, 0);
  const singletons = sizes.filter((size) => size === 1).length;
  return {
    pixels,
    islands: sizes.length,
    ratio: pixels === 0 ? 0 : sizes.length / pixels,
    singletonShare: sizes.length === 0 ? 0 : singletons / sizes.length,
  };
}

/**
 * Absorb every flat-colour island smaller than `minIsland` into the colour it
 * shares the most edge with. In place. Returns the number of pixels rewritten.
 */
export function consolidate(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  minIsland = 3,
  maxPasses = 4,
): number {
  let rewritten = 0;
  for (let pass = 0; pass < maxPasses; pass += 1) {
    const { ids, sizes } = label(rgba, width, height);
    let changedThisPass = 0;

    for (let i = 0; i < width * height; i += 1) {
      const id = ids[i];
      if (id === undefined || id < 0) { continue; }
      if ((sizes[id] ?? 0) >= minIsland) { continue; }
      if (PROTECTED.has(key(rgba, i))) { continue; }

      // Vote by shared edge, weighted by the neighbour island's size: a lone
      // pixel should join the mass beside it, not another lone pixel.
      const votes = new Map<number, number>();
      const x = i % width;
      const y = (i - x) / width;
      const neighbours = [
        x > 0 ? i - 1 : -1,
        x < width - 1 ? i + 1 : -1,
        y > 0 ? i - width : -1,
        y < height - 1 ? i + width : -1,
      ];
      for (const n of neighbours) {
        if (n < 0 || (rgba[n * 4 + 3] ?? 0) === 0) { continue; }
        const nId = ids[n];
        if (nId === undefined || nId === id) { continue; }
        const weight = sizes[nId] ?? 1;
        votes.set(key(rgba, n), (votes.get(key(rgba, n)) ?? 0) + weight);
      }
      if (votes.size === 0) { continue; }

      let best = -1;
      let bestVotes = -1;
      for (const [colour, weight] of votes) {
        // Ties break on the darker colour so consolidation never brightens a
        // figure — the emission budget must not grow by accident.
        if (weight > bestVotes || (weight === bestVotes && colour < best)) {
          bestVotes = weight;
          best = colour;
        }
      }
      if (best < 0) { continue; }
      rgba[i * 4] = (best >> 16) & 0xff;
      rgba[i * 4 + 1] = (best >> 8) & 0xff;
      rgba[i * 4 + 2] = best & 0xff;
      changedThisPass += 1;
    }

    rewritten += changedThisPass;
    if (changedThisPass === 0) { break; }
  }
  return rewritten;
}
