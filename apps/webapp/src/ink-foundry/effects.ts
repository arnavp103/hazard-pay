import * as THREE from "three";

import { type Figure } from "./figure.ts";

/** Small reusable geometry, analytically sampled so scrubbing never accumulates particles. */
export function createEffects(scene: THREE.Scene) {
  const root = new THREE.Group();
  scene.add(root);
  const casing = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.07, 0.035), new THREE.MeshBasicMaterial({ color: "#d6b66a" }));
  const smokeMaterial = new THREE.MeshBasicMaterial({ color: "#e2d6b8", transparent: true, opacity: 0.4, depthWrite: false });
  const smoke = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 0), smokeMaterial);
  const tracer = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.015, 1, 4), new THREE.MeshBasicMaterial({ color: "#fff0b5" }));
  root.add(casing, smoke, tracer);
  const origin = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const side = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const quaternion = new THREE.Quaternion();
  return {
    update(figure: Figure, age: number) {
      root.visible = age >= 0 && age < 0.5;
      if (!root.visible) { return; }
      figure.muzzle.getWorldPosition(origin);
      figure.muzzle.getWorldQuaternion(quaternion);
      direction.set(0, 0, 1).applyQuaternion(quaternion);
      side.set(1, 0, 0).applyQuaternion(quaternion);
      casing.position.copy(origin).addScaledVector(direction, -0.4).addScaledVector(side, age * 2.1);
      casing.position.y += age * 1.5 - 4.9 * age * age;
      casing.rotation.set(age * 15, age * 9, age * 6);
      smoke.position.copy(origin).addScaledVector(direction, age * 0.4);
      smoke.position.y += age * 0.5;
      smoke.scale.setScalar(0.3 + age * 2.3);
      smokeMaterial.opacity = Math.max(0, 0.35 * (1 - age / 0.5));
      tracer.visible = age < 0.1;
      tracer.position.copy(origin).addScaledVector(direction, 0.8 + age * 15);
      tracer.quaternion.setFromUnitVectors(up, direction);
      tracer.scale.y = 0.65 + age * 4;
    },
  };
}
