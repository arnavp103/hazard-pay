/**
 * THROWAWAY PROTOTYPE (#81): the crowd-fodder tier.
 *
 * The #69 ruling splits units into two tiers judged on different things —
 * fodder reads as mass, colour blocking and silhouette clumps; heroes read
 * per-unit. This file is the fodder half. It deliberately does NOT reuse the
 * hero medic's builder: the whole point of the tier is that it is a cheaper,
 * blockier object, and sharing a builder would have smuggled the hero's
 * primitive count into the crowd.
 *
 * Two archetypes, and the constraint on them is that they must part on
 * **silhouette alone** — in grayscale, at 22 px, with the colour thrown
 * away:
 *
 *   - `brute`     wide, low, and carrying a shield slab that roughly doubles
 *                 its screen width. Reads as a broad block.
 *   - `marksman`  narrow, tall, and carrying a barrel that projects a long
 *                 horizontal spike well past the body. Reads as a thin
 *                 vertical with a stick through it.
 *
 * The two are separated on the two axes a silhouette has — aspect ratio and
 * where the mass sits — rather than by kit detail, because kit detail is
 * exactly what does not survive to 22 px. `crowd3d.test.ts` asserts the
 * width ratio and the fill ratio rather than trusting the eye.
 *
 * Tier separation is size boost + detail density + marking (#69). This file
 * owns the first two: fodder is fitted to 1/1.25 of the hero's *projected*
 * height, and carries roughly a third of its primitive count. Marking lives
 * in `mark3d.ts` because it is a screen-space effect, not geometry.
 */

import * as THREE from "three";

import { cel, flat, inkBox, inkCylinder } from "./cel.ts";

export type FodderArchetype = "brute" | "marksman";
export type Faction = "crew" | "opfor";

/**
 * The cofounder's "slight" boost, inside the ruling's 1.2-1.3x band. Applied
 * to projected screen height, not to a nominal authored height.
 */
export const TIER_SCALE = 1.25;

/**
 * Fodder ink is authored thicker than the hero's `SHELL` so that after the
 * tier fit-scale shrinks it, the contour still lands at the same pixel width
 * the hero's does. Ink that thins with the unit would make the small tier
 * read as blurrier rather than as smaller.
 */
const SHELL = 0.028;

interface Palette {
  coat: string;
  coatDark: string;
  livery: string;
  liveryDark: string;
  metal: string;
  boot: string;
  signal: string;
  pale: string;
}

/**
 * Two factions separated by temperature rather than only hue, so the crowd
 * sorts into two armies in grayscale as well as in colour: the crew is a
 * warm rust identity on the medic's violet-grey body, the opfor a cold
 * pale-blue identity on a near-black body. Neither borrows the UI's magenta
 * or chartreuse.
 */
const PALETTES: Record<Faction, Palette> = {
  crew: {
    boot: "#221f26",
    coat: "#3f4b49",
    coatDark: "#333d3c",
    livery: "#a6533f",
    liveryDark: "#7d3d2f",
    metal: "#8b8f99",
    pale: "#cfc3b0",
    signal: "#2f9e96",
  },
  opfor: {
    boot: "#191722",
    coat: "#2b2935",
    coatDark: "#222029",
    livery: "#6f93b8",
    liveryDark: "#4d6b8c",
    metal: "#7d8391",
    pale: "#b8c4d0",
    signal: "#8fd0e8",
  },
};

export interface FodderJoints {
  root: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  hipL: THREE.Group;
  hipR: THREE.Group;
}

export interface FodderRig {
  root: THREE.Group;
  joints: FodderJoints;
  archetype: FodderArchetype;
  faction: Faction;
}

/**
 * Torso-local collar height. As on the hero, nothing but the head is allowed
 * above it — the defect the sibling lane hit was a pack rising past the
 * shoulder line and taking the top of the silhouette off the head, and a
 * crowd of forty units is the worst possible place to repeat it.
 */
const COLLAR_Y = 0.32;

function simpleLeg(palette: Palette, side: 1 | -1, spread: number, thigh: number): THREE.Group {
  const hip = new THREE.Group();
  hip.position.set(side * spread, 0.62, 0);
  const limb = inkBox(0.17, thigh, 0.18, cel(palette.coatDark), SHELL);
  limb.position.y = -thigh / 2;
  hip.add(limb);
  const boot = inkBox(0.21, 0.13, 0.3, cel(palette.boot), SHELL);
  boot.position.set(0, -thigh - 0.05, 0.05);
  hip.add(boot);
  return hip;
}

/** Low dome + brow bar. Wide and round: the brute's head is part of its block. */
function bruteHead(palette: Palette): THREE.Group {
  const head = new THREE.Group();
  head.position.set(0, 0.46, 0);
  const neck = inkBox(0.13, 0.14, 0.13, cel("#2a1f28"), SHELL);
  neck.position.y = -0.05;
  head.add(neck);
  const helmet = inkBox(0.32, 0.26, 0.3, cel(palette.livery), SHELL);
  helmet.position.y = 0.1;
  head.add(helmet);
  // Dark face plate with one bright slit, proud on +Z only: front and back
  // are different shapes in different values, so facing survives to 22 px.
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.03), flat("#1c141a"));
  plate.position.set(0, 0.07, 0.16);
  head.add(plate);
  const slit = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.02), flat(palette.signal));
  slit.position.set(0, 0.08, 0.18);
  head.add(slit);
  return head;
}

/** Narrow peaked cap. The marksman's head is a point, not a block. */
function marksmanHead(palette: Palette): THREE.Group {
  const head = new THREE.Group();
  head.position.set(0, 0.5, 0);
  const neck = inkBox(0.11, 0.15, 0.11, cel("#2a1f28"), SHELL);
  neck.position.y = -0.06;
  head.add(neck);
  const skull = inkBox(0.22, 0.22, 0.24, cel(palette.coatDark), SHELL);
  skull.position.y = 0.08;
  head.add(skull);
  const peak = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.17, 6), cel(palette.livery));
  peak.position.y = 0.26;
  head.add(peak);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.12, 0.03), flat("#1c141a"));
  plate.position.set(0, 0.06, 0.13);
  head.add(plate);
  const slit = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.02), flat(palette.signal));
  slit.position.set(0, 0.07, 0.15);
  head.add(slit);
  return head;
}

/**
 * Wide, low, shield-forward. Screen width is roughly double the marksman's
 * and the mass sits low, so the two archetypes differ in aspect ratio before
 * a single detail is drawn.
 */
function buildBrute(palette: Palette): FodderRig {
  const root = new THREE.Group();

  const torso = new THREE.Group();
  torso.position.set(0, 0.62, 0);
  root.add(torso);

  const chest = inkBox(0.56, 0.42, 0.36, cel(palette.coat), SHELL);
  chest.position.y = 0.13;
  torso.add(chest);
  // Livery band across the chest — the faction read at crowd distance is a
  // colour block on the body, not a detail.
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.02), flat(palette.livery));
  band.position.set(0, 0.16, 0.19);
  torso.add(band);

  const head = bruteHead(palette);
  torso.add(head);

  // Shield arm: a slab carried out to the -X side and ANGLED.
  //
  // The lineup view is what caught this: held flat and centred, the slab
  // projected face-on to the dimetric camera and covered the entire unit, so
  // a brute read as a floating square with a helmet behind it — no body, no
  // weapon arm, no stance. It measured fine (widest archetype, densest
  // silhouette) and looked fine in isolation. Only standing it next to its
  // siblings showed that the archetype had eaten itself. Third lane in a row
  // where the lineup caught what the single-subject loupe hid.
  //
  // Yawing the shield off the body plane and dropping it to chest height
  // keeps the wide, solid silhouette the archetype needs while leaving the
  // helmet, shoulder and mace arm outside its outline.
  const armL = new THREE.Group();
  armL.position.set(-0.3, 0.16, 0.02);
  armL.rotation.y = 0.62;
  torso.add(armL);
  // Sized against the hero rather than by eye: at 0.72 x 0.56 the shield made
  // a brute out-mass a hero by 281 filled cells to 238 at a shared cell size,
  // which inverts the tier it is supposed to sit under. Trimmed until the
  // brute is still unambiguously the widest thing on the field but no longer
  // the heaviest. The measurement is in `crowd3d.test.ts`.
  const shield = inkBox(0.1, 0.58, 0.46, cel(palette.metal), SHELL);
  shield.position.set(-0.13, -0.08, 0.1);
  armL.add(shield);
  const boss = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.16), flat(palette.liveryDark));
  boss.position.set(-0.19, -0.06, 0.1);
  armL.add(boss);

  // Weapon arm: a stubby mace, kept inside the body width so it never
  // competes with the shield for the silhouette.
  const armR = new THREE.Group();
  armR.position.set(0.31, 0.2, -0.02);
  torso.add(armR);
  const arm = inkBox(0.15, 0.3, 0.16, cel(palette.coatDark), SHELL);
  arm.position.set(0.05, -0.13, 0);
  armR.add(arm);
  const mace = inkBox(0.16, 0.16, 0.16, cel(palette.metal), SHELL);
  mace.position.set(0.09, -0.34, 0.04);
  armR.add(mace);

  root.add(simpleLeg(palette, -1, 0.15, 0.3), simpleLeg(palette, 1, 0.15, 0.3));

  return {
    archetype: "brute",
    faction: "crew",
    joints: {
      armL,
      armR,
      head,
      hipL: root.children[1] as THREE.Group,
      hipR: root.children[2] as THREE.Group,
      root,
      torso,
    },
    root,
  };
}

/**
 * Narrow, tall, and defined by a barrel that projects a long horizontal
 * spike past the body outline. The spike is what a 22 px silhouette keeps
 * when everything else has collapsed to a smudge.
 */
function buildMarksman(palette: Palette): FodderRig {
  const root = new THREE.Group();

  const torso = new THREE.Group();
  torso.position.set(0, 0.68, 0);
  root.add(torso);

  const chest = inkBox(0.32, 0.44, 0.24, cel(palette.coat), SHELL);
  chest.position.y = 0.12;
  torso.add(chest);
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.02), flat(palette.livery));
  band.position.set(0, 0.16, 0.13);
  torso.add(band);

  const head = marksmanHead(palette);
  torso.add(head);

  // Both arms forward on the weapon: the narrow body stays narrow.
  const armL = new THREE.Group();
  armL.position.set(-0.19, 0.16, 0.04);
  torso.add(armL);
  const foreL = inkBox(0.12, 0.11, 0.34, cel(palette.coatDark), SHELL);
  foreL.position.set(0.02, -0.06, 0.16);
  armL.add(foreL);

  const armR = new THREE.Group();
  armR.position.set(0.19, 0.16, 0.02);
  torso.add(armR);
  const foreR = inkBox(0.12, 0.11, 0.26, cel(palette.coatDark), SHELL);
  foreR.position.set(-0.02, -0.06, 0.11);
  armR.add(foreR);

  // The long barrel. Runs +Z (the authored front) so it reads as a spike out
  // of the chest on every facing the renderer derives.
  const barrel = inkCylinder(0.045, 0.92, cel(palette.metal), SHELL);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(-0.02, -0.02, 0.42);
  armL.add(barrel);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.06), flat(palette.liveryDark));
  sight.position.set(-0.02, 0.07, 0.18);
  armL.add(sight);

  root.add(simpleLeg(palette, -1, 0.1, 0.36), simpleLeg(palette, 1, 0.1, 0.36));

  return {
    archetype: "marksman",
    faction: "crew",
    joints: {
      armL,
      armR,
      head,
      hipL: root.children[1] as THREE.Group,
      hipR: root.children[2] as THREE.Group,
      root,
      torso,
    },
    root,
  };
}

/** Rest pose. Weight forward, knees soft, weapon carried — never a T-pose. */
const BIND: Record<FodderArchetype, Partial<Record<keyof FodderJoints, [number, number, number]>>> = {
  brute: {
    armL: [0.06, -0.1, 0.05],
    armR: [-0.22, 0, -0.12],
    head: [0.05, 0, 0],
    hipL: [0.12, 0, 0],
    hipR: [-0.1, 0, 0],
    torso: [0.05, 0.12, 0],
  },
  marksman: {
    armL: [-0.05, 0.04, 0],
    armR: [-0.05, -0.04, 0],
    head: [0.03, 0, 0],
    hipL: [0.14, 0, 0],
    hipR: [-0.12, 0, 0],
    torso: [0.03, -0.06, 0],
  },
};

export function buildFodder(archetype: FodderArchetype, faction: Faction): FodderRig {
  const palette = PALETTES[faction];
  const rig = archetype === "brute" ? buildBrute(palette) : buildMarksman(palette);
  rig.faction = faction;
  return rig;
}

/** Every mass on a fodder unit must cap below the collar except the head. */
export { COLLAR_Y as FODDER_COLLAR_Y };

/**
 * Crowd motion. A bake gets playback phase offset and nothing else; this
 * runtime gets phase, rate AND amplitude per unit, which is the lane's
 * structural argument at crowd scale, so all three are jittered here rather
 * than only the phase.
 */
export function applyFodderPose(rig: FodderRig, tRaw: number, jitter: number): void {
  // Held poses per second — the lane's stepped clock, kept at crowd scale.
  const rate = 8 + (jitter % 3);
  const t = Math.floor(tRaw * rate) / rate;

  const phase = jitter * 0.7331;
  const speed = 0.85 + ((jitter * 0.137) % 0.4);
  const amp = 0.8 + ((jitter * 0.211) % 0.5);

  const breath = Math.sin((t * speed) / 2.2 * Math.PI * 2 + phase);
  const sway = Math.sin((t * speed) / 4.4 * Math.PI * 2 + phase * 1.7);
  // A scan beat that lands at a different moment for every unit, so the
  // crowd never blinks in unison.
  const loop = (t * speed + phase * 3) % 5.2;
  const scan = loop > 1.6 && loop < 2.4 ? 0.34 : (loop > 3.9 && loop < 4.4 ? -0.28 : 0);

  const bind = BIND[rig.archetype];
  const set = (name: keyof FodderJoints, x: number, y: number, z: number): void => {
    const base = bind[name] ?? [0, 0, 0];
    rig.joints[name].rotation.set(base[0] + x, base[1] + y, base[2] + z);
  };

  set("torso", 0.045 * breath * amp, 0.035 * sway * amp, 0.05 * sway * amp);
  set("head", 0.03 * breath, scan, 0.03 * sway);
  set("armL", -0.05 * breath * amp, 0, 0.03 * sway);
  set("armR", -0.05 * breath * amp, 0, -0.03 * sway);
  set("hipL", 0, 0, 0);
  set("hipR", 0, 0, 0);

  rig.joints.root.position.y = -0.03 * (0.5 - 0.5 * breath) * amp;
}
