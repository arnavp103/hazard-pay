/**
 * THROWAWAY PROTOTYPE (#81): hero marking, as a screen-space silhouette
 * border.
 *
 * #69 lifted the marking ban and made marking load-bearing rather than
 * supplementary: size boost plus detail density were measured, in two
 * pipelines, to be insufficient to pick a hero out of a fodder mass at
 * crowd angular size. So this is not decoration — it is the tier-separation
 * mechanism, and it is built to the sibling lane's hard-won spec rather
 * than reinvented.
 *
 * ## What NOT to build, learned from PR #90
 *
 * That lane first shipped an **inverted-hull shell** and threw it away.
 * Being per-bone, the hull traces every limb and draws a border at every
 * limb/torso crossing, so a marked hero ends up carrying *more* internal
 * contour than an unmarked fodder unit and reads as busier rather than as
 * more important — it inverts the hierarchy it exists to create. It also
 * drags the look into an ink-shell register, which this lane already
 * occupies with its geometry outlines; a hero would have been outlined
 * twice in the same visual language.
 *
 * ## What is built instead
 *
 * A mask-and-dilate ring, entirely outside the unit:
 *
 *   1. Heroes are tagged onto a mark layer, one per faction.
 *   2. The scene is re-rendered, layer-filtered to heroes only, with every
 *      material overridden to a flat channel colour, into an offscreen
 *      target. Two renders share one target: crew writes red, opfor writes
 *      green, so faction survives into the composite without a second
 *      buffer.
 *   3. A full-screen pass dilates that mask and keeps `dilated AND NOT
 *      original`, which is a ring strictly OUTSIDE the silhouette. Nothing
 *      is drawn over the unit, so per-limb contour cannot happen by
 *      construction.
 *
 * ## Width is in pixels, deliberately
 *
 * `MARK_PIXELS` is a screen measurement, not a world one. A marker whose
 * job is to be findable has to stay findable when the camera pulls back —
 * a world-space ring shrinks with the unit and stops working at exactly the
 * zoom where tier separation gets hard. This is the reason marking survives
 * the zoom argument that #69 raised in the runtime fork.
 */

import * as THREE from "three";

/** Layer ids for the two factions' hero masks. Fodder is never tagged. */
export const MARK_LAYER_CREW = 1;
export const MARK_LAYER_OPFOR = 2;

/** Ring half-width in SCREEN PIXELS. */
export const MARK_PIXELS = 2.2;

/** Ring colours: each faction's signal, pushed hot enough to read at 22 px. */
export const MARK_COLORS: Record<"crew" | "opfor", string> = {
  crew: "#ffb347",
  opfor: "#7fe3ff",
};

/** Tag every mesh under `object` onto its faction's mark layer. */
export function enableMark(object: THREE.Object3D, faction: "crew" | "opfor"): void {
  const layer = faction === "crew" ? MARK_LAYER_CREW : MARK_LAYER_OPFOR;
  object.traverse((node) => { node.layers.enable(layer); });
}

/** 3 rings x 12 taps. Same tap budget as the sibling lane, for comparability. */
const TAPS = 12;
const RINGS = 3;

const VERTEX = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAGMENT = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D uMask;
uniform vec2 uTexel;
uniform float uRadius;
uniform vec3 uCrew;
uniform vec3 uOpfor;

void main() {
  vec2 here = texture2D(uMask, vUv).rg;
  float inside = max(here.r, here.g);

  vec2 grown = here;
  for (int ring = 1; ring <= ${RINGS}; ring++) {
    float r = uRadius * (float(ring) / float(${RINGS}));
    for (int i = 0; i < ${TAPS}; i++) {
      float a = 6.2831853 * (float(i) / float(${TAPS}));
      vec2 at = vUv + vec2(cos(a), sin(a)) * r * uTexel;
      grown = max(grown, texture2D(uMask, at).rg);
    }
  }

  // Strictly outside: the ring is what the dilation added, never the unit.
  float ring = max(grown.r, grown.g) * (1.0 - inside);
  if (ring <= 0.003) { discard; }
  vec3 tint = grown.r >= grown.g ? uCrew : uOpfor;
  gl_FragColor = vec4(tint, ring);
}
`;

export interface MarkPass {
  /** Render the ring for `scene` as seen by `camera`, over the current frame. */
  render: (renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) => void;
  setSize: (width: number, height: number) => void;
  /** Ring width in pixels; recomputed when the stage resizes. */
  dispose: () => void;
  /** Extra draw calls and triangles this pass costs, for the cost report. */
  lastCost: () => { calls: number; triangles: number };
}

export function createMarkPass(width: number, height: number): MarkPass {
  const target = new THREE.WebGLRenderTarget(width, height, {
    depthBuffer: true,
    magFilter: THREE.LinearFilter,
    minFilter: THREE.LinearFilter,
  });

  const maskMaterial = new THREE.MeshBasicMaterial({ color: "#ff0000", depthWrite: false });
  // Depth-only prepass material. Without it the mask target's depth buffer is
  // empty — the pass renders heroes ALONE, so there is nothing for a hero to
  // be occluded by, and a hero standing behind a building still stamped a
  // ring across the wall with no unit inside it. Priming depth from the full
  // scene first costs one extra scene pass and makes the ring obey the world.
  const depthMaterial = new THREE.MeshBasicMaterial({ colorWrite: false });

  const quadScene = new THREE.Scene();
  const quadCamera = new THREE.Camera();
  const uniforms = {
    uCrew: { value: new THREE.Color(MARK_COLORS.crew) },
    uMask: { value: target.texture },
    uOpfor: { value: new THREE.Color(MARK_COLORS.opfor) },
    uRadius: { value: MARK_PIXELS },
    uTexel: { value: new THREE.Vector2(1 / width, 1 / height) },
  };
  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      fragmentShader: FRAGMENT,
      transparent: true,
      uniforms,
      vertexShader: VERTEX,
    }),
  );
  quad.frustumCulled = false;
  quadScene.add(quad);

  let cost = { calls: 0, triangles: 0 };

  return {
    dispose: () => {
      target.dispose();
      quad.geometry.dispose();
      (quad.material as THREE.Material).dispose();
      maskMaterial.dispose();
      depthMaterial.dispose();
    },
    lastCost: () => cost,
    render: (renderer, scene, camera) => {
      // The caller owns `renderer.info.autoReset` and has turned it off, so
      // the counters accumulate across this pass's three renders instead of
      // each render silently wiping the last.
      const beforeCalls = renderer.info.render.calls;
      const beforeTris = renderer.info.render.triangles;

      const savedLayers = camera.layers.mask;
      const savedOverride = scene.overrideMaterial;
      const savedTarget = renderer.getRenderTarget();
      const savedAutoClear = renderer.autoClear;

      renderer.setRenderTarget(target);
      renderer.setClearColor("#000000", 0);
      renderer.clear();
      renderer.autoClear = false;

      scene.overrideMaterial = depthMaterial;
      camera.layers.set(0);
      renderer.render(scene, camera);

      scene.overrideMaterial = maskMaterial;
      maskMaterial.color.setRGB(1, 0, 0);
      camera.layers.set(MARK_LAYER_CREW);
      renderer.render(scene, camera);

      maskMaterial.color.setRGB(0, 1, 0);
      camera.layers.set(MARK_LAYER_OPFOR);
      renderer.render(scene, camera);

      renderer.setRenderTarget(savedTarget);
      scene.overrideMaterial = savedOverride;
      camera.layers.mask = savedLayers;
      renderer.autoClear = false;
      renderer.render(quadScene, quadCamera);
      renderer.autoClear = savedAutoClear;

      cost = {
        calls: renderer.info.render.calls - beforeCalls,
        triangles: renderer.info.render.triangles - beforeTris,
      };
    },
    setSize: (w, h) => {
      target.setSize(w, h);
      uniforms.uTexel.value.set(1 / w, 1 / h);
    },
  };
}
