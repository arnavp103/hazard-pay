/**
 * THROWAWAY PROTOTYPE (#82): deterministic shelf packing for the baked atlas.
 *
 * `free-tex-packer-core` was the option the #65 research left open. It is not
 * worth its weight here: every cell is the same 44x44 source rect, so the only
 * packing decision that actually saves bytes is trimming to the alpha bbox and
 * shelving the results by height — about forty lines, fully deterministic, and
 * unit-testable without a fixture. A MaxRects packer would buy a few percent
 * on top and cost a dependency plus non-obvious output stability.
 *
 * Determinism matters beyond taste: the atlas is committed to the branch and
 * the gallery is SHA-pinned, so two bakes of the same rig must produce the
 * same bytes. Ties therefore break on name, never on input order.
 */

export interface PackItem {
  name: string;
  width: number;
  height: number;
}

export interface PackPlacement extends PackItem {
  x: number;
  y: number;
}

export interface PackResult {
  width: number;
  height: number;
  placements: PackPlacement[];
  /** Opaque area over atlas area — how much of the sheet is actually sprite. */
  occupancy: number;
}

/** 1 px of transparent gutter: cheap insurance against edge sampling. */
const GUTTER = 1;

export function packShelves(items: readonly PackItem[], maxWidth: number): PackResult {
  const sorted = [...items].sort(
    (a, b) => b.height - a.height || b.width - a.width || a.name.localeCompare(b.name),
  );

  const placements: PackPlacement[] = [];
  let shelfY = GUTTER;
  let shelfHeight = 0;
  let cursorX = GUTTER;
  let usedWidth = 0;

  for (const item of sorted) {
    if (item.width + GUTTER * 2 > maxWidth) {
      throw new Error(`sprite "${item.name}" is wider (${String(item.width)}) than the atlas`);
    }
    if (cursorX + item.width + GUTTER > maxWidth) {
      shelfY += shelfHeight + GUTTER;
      shelfHeight = 0;
      cursorX = GUTTER;
    }
    placements.push({ ...item, x: cursorX, y: shelfY });
    cursorX += item.width + GUTTER;
    usedWidth = Math.max(usedWidth, cursorX);
    shelfHeight = Math.max(shelfHeight, item.height);
  }

  const width = align4(usedWidth + GUTTER);
  const height = align4(shelfY + shelfHeight + GUTTER);
  const area = items.reduce((sum, item) => sum + item.width * item.height, 0);

  return {
    width,
    height,
    occupancy: area / (width * height),
    placements: placements.sort((a, b) => a.name.localeCompare(b.name)),
  };
}

function align4(value: number): number {
  return Math.ceil(value / 4) * 4;
}

/**
 * Best shelf atlas across a set of candidate widths. Shelving is sensitive to
 * the row width it is given, so trying a handful and keeping the smallest
 * total area costs microseconds and reliably beats one guess.
 */
export function packBest(items: readonly PackItem[], candidateWidths: readonly number[]): PackResult {
  let best: PackResult | undefined;
  for (const candidate of candidateWidths) {
    const widest = items.reduce((max, item) => Math.max(max, item.width), 0);
    if (candidate < widest + GUTTER * 2) { continue; }
    const result = packShelves(items, candidate);
    if (best === undefined || result.width * result.height < best.width * best.height) {
      best = result;
    }
  }
  if (best === undefined) {
    throw new Error("no candidate atlas width can hold the widest sprite");
  }
  return best;
}
