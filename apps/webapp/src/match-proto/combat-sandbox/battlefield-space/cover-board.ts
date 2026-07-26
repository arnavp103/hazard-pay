/**
 * THROWAWAY PROTOTYPE (#100): variant B's cover layer, in the flat register.
 *
 * Draws the authored half of `cover-model.ts`'s manifest. The retrofit half is
 * deliberately **not** drawn — those props are `board.ts`'s existing set
 * dressing and are already on screen in both variants; variant B only gives
 * them a footprint. So the pixels that differ between the two galleries are
 * exactly the props that had to be authored for cover to exist, which is the
 * comparison #64 needs.
 *
 * Same rules as `board.ts`: no outlines, colour blocking only, everything into
 * one `FlatBatch` so the whole cover layer is one lit draw call plus one unlit
 * one. Deliberately drab — the board keeps the quiet 70 % of the value budget
 * and the units keep the saturation. This is not art direction; it is the
 * cheapest thing that lets a silhouette be judged.
 */

import * as THREE from "three";

import { box, facet, FlatBatch, quad, taper, wedge } from "../flat.ts";
import {
  type BoardProp,
  boardFor,
  cellEdge,
  type CoverDensity,
  GRID,
  RETROFIT_KINDS,
  TILE,
  walkable,
  worldRectOf,
} from "./cover-model.ts";

const CONCRETE = "#4a4459";
const CONCRETE_TOP = "#565064";
const STEEL = "#414a5c";
const STEEL_TOP = "#4c5568";
const CRATE = "#5a4c4a";
const CRATE_TOP = "#695955";
const SACK = "#544c46";
const SACK_TOP = "#615850";
const RUST = "#5b463f";
const DARK = "#33303f";
const HAZARD = "#c8874c";
const SIGNAL = "#4aa79c";
/** Contact patch under a prop. Sits a band under the floor, never at INK. */
const SHADOW = "#332c40";

const GRID_LINE = "#6d6480";
const GRID_BLOCKED = "#7a4a52";
const GRID_ROOF = "#4a6a72";

interface Slab {
  /** Centre, world. */
  cx: number;
  cz: number;
  /** Extent, world. */
  sx: number;
  sz: number;
}

function slabOf(prop: BoardProp): Slab {
  const rect = worldRectOf(prop.cells);
  return {
    cx: (rect.x0 + rect.x1) / 2,
    cz: (rect.z0 + rect.z1) / 2,
    sx: rect.x1 - rect.x0,
    sz: rect.z1 - rect.z0,
  };
}

type Builder = (batch: FlatBatch, prop: BoardProp, at: Slab) => void;

/** Inset so a prop reads as sitting *on* its tiles rather than tiling them. */
const INSET = 0.82;

const builders: Partial<Record<BoardProp["kind"], Builder>> = {
  awningStall(batch, prop, at) {
    const legs = 0.09;
    const roofY = prop.roof?.lift ?? prop.height * 0.9;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        batch.add(box(legs, roofY, legs), DARK, {
          at: [at.cx + sx * (at.sx / 2 - 0.16), roofY / 2, at.cz + sz * (at.sz / 2 - 0.16)],
        });
      }
    }
    batch.add(box(at.sx * INSET, 0.62, at.sz * 0.7), CRATE, { at: [at.cx, 0.31, at.cz] });
    batch.add(box(at.sx * INSET * 0.9, 0.05, at.sz * 0.6), CRATE_TOP, { at: [at.cx, 0.64, at.cz] });
    // Roof spans the prop's own cells plus the row in front — the canopy claim.
    batch.add(box(at.sx * 1.02, 0.1, at.sz * 2.02), RUST, {
      at: [at.cx, roofY, at.cz + at.sz / 2],
    });
    batch.addEmit(box(at.sx * 0.5, 0.06, 0.05), HAZARD, {
      at: [at.cx, roofY - 0.18, at.cz + at.sz * 1.4],
    });
  },
  barrelPair(batch, _prop, at) {
    for (const [ox, oz] of [[-0.18, -0.1], [0.16, 0.14]] as const) {
      batch.add(taper(0.24, 0.26, 1.02, 8), STEEL, { at: [at.cx + ox, 0.51, at.cz + oz] });
      batch.add(taper(0.26, 0.26, 0.06, 8), DARK, { at: [at.cx + ox, 1.05, at.cz + oz] });
    }
  },
  cableSpool(batch, prop, at) {
    batch.add(taper(0.42, 0.42, 0.08, 8), CRATE_TOP, { at: [at.cx, prop.height - 0.04, at.cz] });
    batch.add(taper(0.42, 0.42, 0.08, 8), CRATE_TOP, { at: [at.cx, 0.04, at.cz] });
    batch.add(taper(0.24, 0.24, prop.height, 8), CRATE, { at: [at.cx, prop.height / 2, at.cz] });
  },
  canopySpan(batch, prop, at) {
    const roofY = prop.roof?.lift ?? prop.height * 0.9;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        batch.add(box(0.09, roofY, 0.09), DARK, {
          at: [at.cx + sx * (at.sx / 2 - 0.16), roofY / 2, at.cz + sz * (at.sz / 2 - 0.16)],
        });
      }
    }
    batch.add(box(at.sx * 1.02, 0.09, at.sz * 2.02), STEEL_TOP, {
      at: [at.cx, roofY, at.cz + at.sz / 2],
    });
  },
  chainFence(batch, prop, at) {
    const long = at.sx >= at.sz;
    const span = long ? at.sx : at.sz;
    const posts = 4;
    for (let i = 0; i < posts; i += 1) {
      const u = (i / (posts - 1) - 0.5) * span * INSET;
      batch.add(box(0.09, prop.height, 0.09), DARK, {
        at: [at.cx + (long ? u : 0), prop.height / 2, at.cz + (long ? 0 : u)],
      });
    }
    // Three thin bars, not a slab: a screen has to read as porous or the
    // whole `screen` cover class is a lie.
    for (const h of [0.28, 0.62, 0.94]) {
      batch.add(
        long ? box(span * INSET, 0.05, 0.04) : box(0.04, 0.05, span * INSET),
        STEEL,
        { at: [at.cx, prop.height * h, at.cz] },
      );
    }
  },
  container(batch, prop, at) {
    batch.add(box(at.sx * INSET, prop.height, at.sz * INSET), STEEL, {
      at: [at.cx, prop.height / 2, at.cz],
    });
    batch.add(box(at.sx * INSET * 1.02, 0.09, at.sz * INSET * 1.02), STEEL_TOP, {
      at: [at.cx, prop.height, at.cz],
    });
    for (const u of [-0.28, 0, 0.28]) {
      batch.add(box(0.07, prop.height * 0.86, at.sz * INSET * 1.01), DARK, {
        at: [at.cx + u * at.sx, prop.height / 2, at.cz],
      });
    }
    batch.addEmit(box(0.34, 0.06, 0.04), SIGNAL, {
      at: [at.cx - at.sx * 0.24, prop.height * 0.7, at.cz + at.sz * INSET / 2],
    });
  },
  crateStack(batch, prop, at) {
    batch.add(box(at.sx * 0.78, prop.height * 0.62, at.sz * 0.78), CRATE, {
      at: [at.cx, prop.height * 0.31, at.cz],
    });
    batch.add(box(at.sx * 0.6, prop.height * 0.38, at.sz * 0.6), CRATE, {
      at: [at.cx + 0.06, prop.height * 0.81, at.cz - 0.05],
      rot: [0, 0.28, 0],
    });
    batch.add(box(at.sx * 0.5, 0.05, at.sz * 0.5), CRATE_TOP, {
      at: [at.cx + 0.06, prop.height, at.cz - 0.05],
      rot: [0, 0.28, 0],
    });
  },
  dumpster(batch, prop, at) {
    batch.add(box(at.sx * INSET, prop.height * 0.85, at.sz * 0.72), RUST, {
      at: [at.cx, prop.height * 0.43, at.cz],
    });
    batch.add(wedge(at.sz * 0.4, at.sx * INSET), CRATE_TOP, {
      at: [at.cx, prop.height * 0.92, at.cz],
      rot: [0, 0, Math.PI / 2],
    });
  },
  hulk(batch, prop, at) {
    batch.add(box(at.sx * INSET, prop.height * 0.62, at.sz * 0.76), RUST, {
      at: [at.cx, prop.height * 0.31, at.cz],
    });
    batch.add(box(at.sx * 0.42, prop.height * 0.5, at.sz * 0.66), DARK, {
      at: [at.cx - at.sx * 0.22, prop.height * 0.72, at.cz],
    });
    batch.add(wedge(prop.height * 0.3, at.sz * 0.6), CRATE, {
      at: [at.cx + at.sx * 0.3, prop.height * 0.66, at.cz],
      rot: [Math.PI / 2, 0, 0.4],
    });
  },
  jerseyBarrier(batch, prop, at) {
    const long = at.sx >= at.sz;
    batch.add(
      long ? box(at.sx * INSET, prop.height, at.sz * 0.4) : box(at.sx * 0.4, prop.height, at.sz * INSET),
      CONCRETE,
      { at: [at.cx, prop.height / 2, at.cz] },
    );
    batch.add(
      long ? box(at.sx * INSET, 0.07, at.sz * 0.26) : box(at.sx * 0.26, 0.07, at.sz * INSET),
      CONCRETE_TOP,
      { at: [at.cx, prop.height, at.cz] },
    );
    batch.addEmit(
      long ? box(at.sx * 0.3, 0.05, 0.04) : box(0.04, 0.05, at.sz * 0.3),
      HAZARD,
      { at: [at.cx, prop.height * 0.62, at.cz + (long ? at.sz * 0.2 : 0)] },
    );
  },
  lampPost(batch, prop, at) {
    batch.add(taper(0.05, 0.11, prop.height, 6), DARK, { at: [at.cx, prop.height / 2, at.cz] });
    batch.add(box(0.42, 0.06, 0.06), DARK, { at: [at.cx + 0.2, prop.height - 0.1, at.cz] });
    batch.addEmit(box(0.3, 0.08, 0.14), HAZARD, { at: [at.cx + 0.36, prop.height - 0.17, at.cz] });
  },
  pillar(batch, prop, at) {
    batch.add(box(0.34, prop.height, 0.34), CONCRETE, { at: [at.cx, prop.height / 2, at.cz] });
    batch.add(box(0.46, 0.12, 0.46), CONCRETE_TOP, { at: [at.cx, prop.height, at.cz] });
    batch.add(box(0.46, 0.1, 0.46), DARK, { at: [at.cx, 0.05, at.cz] });
  },
  pipeRack(batch, prop, at) {
    const long = at.sz >= at.sx;
    for (const s of [-1, 1]) {
      batch.add(box(0.08, prop.height, 0.08), DARK, {
        at: [
          at.cx + (long ? 0 : s * at.sx * 0.36),
          prop.height / 2,
          at.cz + (long ? s * at.sz * 0.36 : 0),
        ],
      });
    }
    for (const h of [0.35, 0.62, 0.9]) {
      batch.add(
        taper(0.09, 0.09, (long ? at.sz : at.sx) * INSET, 6),
        STEEL,
        { at: [at.cx, prop.height * h, at.cz], rot: [long ? Math.PI / 2 : 0, 0, long ? 0 : Math.PI / 2] },
      );
    }
  },
  railing(batch, prop, at) {
    const long = at.sx >= at.sz;
    const span = long ? at.sx : at.sz;
    for (let i = 0; i < 4; i += 1) {
      const u = (i / 3 - 0.5) * span * INSET;
      batch.add(taper(0.05, 0.05, prop.height, 6), STEEL, {
        at: [at.cx + (long ? u : 0), prop.height / 2, at.cz + (long ? 0 : u)],
      });
    }
    for (const h of [0.55, 0.95]) {
      batch.add(
        taper(0.045, 0.045, span * INSET, 6),
        STEEL_TOP,
        { at: [at.cx, prop.height * h, at.cz], rot: [long ? 0 : Math.PI / 2, 0, long ? Math.PI / 2 : 0] },
      );
    }
  },
  rubble(batch, prop, at) {
    for (const [ox, oz, r] of [[-0.2, 0.12, 0.2], [0.16, -0.14, 0.24], [0.06, 0.22, 0.15]] as const) {
      batch.add(facet(r), CONCRETE, { at: [at.cx + ox, prop.height * 0.5, at.cz + oz] });
    }
  },
  sandbagLine(batch, prop, at) {
    const long = at.sx >= at.sz;
    const span = long ? at.sx : at.sz;
    for (let i = 0; i < 5; i += 1) {
      const u = (i / 4 - 0.5) * span * 0.78;
      const high = i % 2 === 0;
      batch.add(
        taper(0.2, 0.22, prop.height * (high ? 1 : 0.72), 6),
        i % 2 === 0 ? SACK : SACK_TOP,
        {
          at: [
            at.cx + (long ? u : 0),
            (prop.height * (high ? 1 : 0.72)) / 2,
            at.cz + (long ? 0 : u),
          ],
          rot: [0, i * 0.4, 0],
        },
      );
    }
  },
  signPylon(batch, prop, at) {
    batch.add(box(0.12, prop.height, 0.12), DARK, { at: [at.cx, prop.height / 2, at.cz] });
    batch.add(box(0.5, 0.62, 0.09), CONCRETE, { at: [at.cx, prop.height - 0.4, at.cz] });
    batch.addEmit(box(0.38, 0.44, 0.05), SIGNAL, { at: [at.cx, prop.height - 0.4, at.cz + 0.07] });
  },
};

export interface CoverBoardBuild {
  group: THREE.Group;
  cost: { meshes: number; triangles: number };
  /** Authored props actually drawn (retrofits are `board.ts`'s already). */
  drawn: number;
}

export interface CoverBoardOptions {
  /** Draw the tile grid and the blocked/roofed cells. Debug overlay. */
  grid?: boolean;
  /** Which density to draw. Default `dense` — round 1's board. */
  density?: CoverDensity;
}

/** Thin bar along the world x axis at a fixed z, hugging the floor. */
function gridLine(batch: FlatBatch, along: "x" | "z", at: number, y: number): void {
  const span = GRID * TILE;
  const thin = 0.022;
  batch.addEmit(
    along === "x" ? quad(span, thin) : quad(thin, span),
    GRID_LINE,
    { at: [along === "x" ? 0 : at, y, along === "x" ? at : 0] },
  );
}

export function buildCoverBoard(options: CoverBoardOptions = {}): CoverBoardBuild {
  const board = boardFor(options.density ?? "dense");
  const batch = new FlatBatch();
  let drawn = 0;

  if (options.grid === true) {
    for (let cy = 0; cy < GRID; cy += 1) {
      for (let cx = 0; cx < GRID; cx += 1) {
        if (walkable(board, cx, cy)) { continue; }
        batch.add(quad(TILE * 0.96, TILE * 0.96), GRID_BLOCKED, {
          at: [cellEdge(cx) + TILE / 2, 0.028, cellEdge(cy) + TILE / 2],
        });
      }
    }
    for (const prop of board.props) {
      const roof = prop.roof;
      if (roof === undefined) { continue; }
      for (let cy = prop.cells.cy0 + roof.oy; cy < prop.cells.cy0 + roof.oy + roof.sy; cy += 1) {
        for (let cx = prop.cells.cx0 + roof.ox; cx < prop.cells.cx0 + roof.ox + roof.sx; cx += 1) {
          if (!walkable(board, cx, cy)) { continue; }
          batch.add(quad(TILE * 0.96, TILE * 0.96), GRID_ROOF, {
            at: [cellEdge(cx) + TILE / 2, 0.029, cellEdge(cy) + TILE / 2],
          });
        }
      }
    }
    for (let i = 0; i <= GRID; i += 1) {
      gridLine(batch, "x", cellEdge(i), 0.032);
      gridLine(batch, "z", cellEdge(i), 0.032);
    }
  }

  for (const prop of board.props) {
    if (RETROFIT_KINDS.has(prop.kind)) { continue; }
    const build = builders[prop.kind];
    if (build === undefined) { continue; }
    const at = slabOf(prop);
    build(batch, prop, at);
    drawn += 1;
    // A contact patch under every prop. Without it a prop that stands off the
    // floor (a canopy, a lamp) floats, which is round 1 of lane 5's complaint
    // arriving by a different route.
    batch.add(quad(at.sx * 0.86, at.sz * 0.86), SHADOW, { at: [at.cx + 0.06, 0.026, at.cz + 0.06] });
  }

  const group = new THREE.Group();
  let meshes = 0;
  for (const mesh of batch.bake()) {
    mesh.frustumCulled = false;
    group.add(mesh);
    meshes += 1;
  }
  return { cost: { meshes, triangles: batch.triangles }, drawn, group };
}
