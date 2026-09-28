import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { buildFigure, animateFigure } from "./figure.ts";
import { CLIPS, parseFreeze, poseAt } from "./motion.ts";
import { buildFoundryScene, frameFoundryCamera } from "./scene.ts";

describe("Ink Foundry deterministic motion", () => {
  it("bounds malformed capture times before they reach the rig", () => {
    expect(parseFreeze(null)).toBe(null);
    expect(parseFreeze("Infinity")).toBe(0);
    expect(parseFreeze("NaN")).toBe(0);
    expect(parseFreeze("-20")).toBe(0);
    expect(parseFreeze("600")).toBe(0.6);
    expect(parseFreeze("9999999999999")).toBe(600);
  });

  it("keeps every lineup and crowd root inside a narrow viewport", () => {
    for (const view of ["lineup", "crowd"] as const) {
      const stage = buildFoundryScene(view);
      frameFoundryCamera(stage, 360, 470);
      stage.camera.updateMatrixWorld(true);
      for (const unit of stage.roster) {
        const projected = unit.figure.root.position.clone().project(stage.camera);
        expect(Math.abs(projected.x)).toBeLessThan(0.92);
        expect(Math.abs(projected.y)).toBeLessThan(0.92);
      }
    }
  });
  it("can scrub backward without history leaking into the pose", () => {
    const rig = buildFigure("medic", "teal", true);
    const first = animateFigure(rig, "attack", 0.61);
    const shoulder = rig.arms[1]!.shoulder.rotation.x;
    animateFigure(rig, "stagger", 8.93);
    const scrubbed = animateFigure(rig, "attack", 0.61);
    expect(scrubbed).toEqual(first);
    expect(rig.arms[1]!.shoulder.rotation.x).toBe(shoulder);
    expect(rig.muzzle.visible).toBe(true);
  });

  it("gives the attack distinct anticipation, release and recovery poses", () => {
    const ready = poseAt("attack", 0);
    const anticipation = poseAt("attack", 0.4);
    const release = poseAt("attack", 0.6);
    const recovered = poseAt("attack", 1.55);
    expect(anticipation.rightShoulder).toBeLessThan(ready.rightShoulder - 0.8);
    expect(release.muzzle).toBe(true);
    expect(release.torsoX).toBeLessThan(anticipation.torsoX);
    expect(recovered.rightShoulder).toBeCloseTo(ready.rightShoulder);
    expect(recovered.muzzle).toBe(false);
  });

  it("maintains opposed leg motion and finite joints across every clip", () => {
    const stride = poseAt("walk", 0.2625);
    expect(stride.leftHip).toBeGreaterThan(0.5);
    expect(stride.rightHip).toBeLessThan(-0.5);
    expect(stride.rightKnee).toBeGreaterThan(0.7);
    for (const clip of CLIPS) {
      for (let frame = 0; frame < 180; frame++) {
        for (const value of Object.values(poseAt(clip, frame / 30))) {
          if (typeof value === "number") { expect(Number.isFinite(value)).toBe(true); }
        }
      }
    }
  });

  it("keeps both soles out of the floor while the supporting foot stays grounded", () => {
    const rig = buildFigure("medic", "teal", true);
    for (const clip of CLIPS) {
      for (let frame = 0; frame < 36; frame++) {
        animateFigure(rig, clip, frame / 12);
        rig.root.updateMatrixWorld(true);
        const soles = rig.legs.map((leg) => new THREE.Box3().setFromObject(leg.ankle).min.y);
        expect(Math.min(...soles)).toBeGreaterThanOrEqual(-0.005);
        expect(Math.min(...soles)).toBeLessThan(0.035);
      }
    }
  });
});
