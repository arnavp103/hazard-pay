/** Offline mesh rasterizer. No browser, WebGL, screenshot or external asset fetching. */
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as THREE from "three";

import { buildFoundryScene, frameFoundryCamera, sampleFoundry } from "./scene.ts";

const dependencies = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const requireRuntime = createRequire(dependencies ? path.join(dependencies, "package.json") : import.meta.url);
const { createCanvas, ImageData, GlobalFonts } = requireRuntime("@napi-rs/canvas");
GlobalFonts.registerFromPath("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "Ink Sans");
GlobalFonts.registerFromPath("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "Ink Bold");
const sharp = requireRuntime("sharp");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const output = path.join(root, "docs/art/ink-foundry-prototype");
await mkdir(output, { recursive: true });

const light = new THREE.Vector3(-5, 10, 5).normalize();
const normal = new THREE.Vector3();
const ab = new THREE.Vector3();
const ac = new THREE.Vector3();
const tint = new THREE.Color();
const vertex = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
const world = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
const edge = (a, b, x, y) => (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);

function renderMeshFrame(stage, width, height) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  const depth = new Float32Array(width * height).fill(Infinity);
  for (let i = 0; i < pixels.length; i += 4) pixels.set([198, 189, 167, 255], i);
  frameFoundryCamera(stage, width, height);
  stage.scene.updateMatrixWorld(true);
  stage.camera.updateMatrixWorld(true);
  stage.scene.traverseVisible((mesh) => {
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;
    const material = mesh.material;
    const positions = mesh.geometry.getAttribute("position");
    const colors = mesh.geometry.getAttribute("color");
    const index = mesh.geometry.index;
    const count = index ? index.count : positions.count;
    for (let tri = 0; tri < count; tri += 3) {
      const ids = [0, 1, 2].map((offset) => index ? index.getX(tri + offset) : tri + offset);
      for (let j = 0; j < 3; j++) {
        world[j].fromBufferAttribute(positions, ids[j]).applyMatrix4(mesh.matrixWorld);
        vertex[j].copy(world[j]).project(stage.camera);
        vertex[j].x = (vertex[j].x * 0.5 + 0.5) * width;
        vertex[j].y = (0.5 - vertex[j].y * 0.5) * height;
      }
      const [a, b, c] = vertex;
      const area = edge(a, b, c.x, c.y);
      if (Math.abs(area) < 0.00001 || (material.side === THREE.FrontSide && area >= 0) || (material.side === THREE.BackSide && area <= 0)) continue;
      const minX = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x)));
      const maxX = Math.min(width - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
      const minY = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y)));
      const maxY = Math.min(height - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
      tint.copy(material.color ?? new THREE.Color("white"));
      if (material.vertexColors && colors) tint.multiply(new THREE.Color(colors.getX(ids[0]), colors.getY(ids[0]), colors.getZ(ids[0])));
      if (!material.isMeshBasicMaterial) {
        normal.crossVectors(ab.subVectors(world[1], world[0]), ac.subVectors(world[2], world[0])).normalize();
        const illumination = Math.max(0, normal.dot(light));
        const shade = material.isMeshToonMaterial ? (illumination < 0.2 ? 0.48 : illumination < 0.6 ? 0.76 : 1.02) : 0.62 + illumination * 0.42;
        tint.multiplyScalar(shade);
      }
      tint.convertLinearToSRGB();
      const rgb = [tint.r, tint.g, tint.b].map((value) => Math.max(0, Math.min(255, Math.round(value * 255))));
      const alpha = material.opacity;
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const wa = edge(b, c, x + 0.5, y + 0.5) / area;
          const wb = edge(c, a, x + 0.5, y + 0.5) / area;
          const wc = 1 - wa - wb;
          if (wa < 0 || wb < 0 || wc < 0) continue;
          const z = wa * a.z + wb * b.z + wc * c.z;
          const offset = y * width + x;
          if (z > depth[offset] + 0.000001 || z < -1 || z > 1) continue;
          for (let channel = 0; channel < 3; channel++) pixels[offset * 4 + channel] = rgb[channel] * alpha + pixels[offset * 4 + channel] * (1 - alpha);
          if (material.depthWrite) depth[offset] = z;
        }
      }
    }
  });
  return new ImageData(pixels, width, height);
}

function plate(stage, clip, seconds, small = false) {
  sampleFoundry(stage, seconds, clip);
  const width = small ? 800 : 1200;
  const height = small ? 590 : 820;
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.fillStyle = "#e8e0ca";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#262d2d";
  context.font = `${small ? 30 : 42}px "Ink Bold"`;
  context.fillText("INK FOUNDRY", 26, small ? 43 : 57);
  context.fillStyle = "#a6533b";
  context.font = `${small ? 11 : 13}px "Ink Sans"`;
  context.fillText(`HAZARD PAY / ${stage.view.toUpperCase()} / ${clip.toUpperCase()} / ${seconds.toFixed(3)}s${stage.camera.zoom > 1 ? ` / DETAIL ${stage.camera.zoom}x` : ""}`, 28, small ? 64 : 82);
  const top = small ? 82 : 106;
  const renderHeight = height - top - 65;
  context.putImageData(renderMeshFrame(stage, width, renderHeight), 0, top);
  context.fillStyle = "#525d55";
  context.font = `${small ? 9 : 12}px "Ink Sans"`;
  context.fillText("SOFTWARE MESH PREVIEW — SAME GEOMETRY / POSES / CAMERA", 26, height - 35);
  context.font = `${small ? 8 : 10}px "Ink Sans"`;
  context.fillText("Approximate CPU lighting; no WebGL shadows. Browser runtime not verified.", 26, height - 17);
  return canvas;
}

const hero = buildFoundryScene("hero");
const stills = [
  [hero, "idle", 0.8, "hero-idle"],
  [hero, "attack", 0.6, "hero-attack"],
  [hero, "walk", 0.26, "hero-walk"],
  [hero, "stagger", 0.17, "hero-stagger"],
  [buildFoundryScene("lineup"), "idle", 0.8, "lineup"],
  [buildFoundryScene("crowd"), "attack", 0.95, "crowd"],
];
for (const [stage, clip, seconds, name] of stills) {
  await writeFile(path.join(output, `${name}.png`), plate(stage, clip, seconds).toBuffer("image/png"));
  process.stdout.write(`${name}.png\n`);
}
hero.camera.zoom = 1.75;
await writeFile(path.join(output, "hero-detail.png"), plate(hero, "attack", 0.6).toBuffer("image/png"));
hero.camera.zoom = 1.6;
const frames = [];
const motionEvidence = [];
for (const clip of ["idle", "walk", "attack", "turn", "stagger"]) {
  const duration = clip === "turn" ? 3.4 : clip === "walk" ? 1.05 : clip === "idle" ? 1.5 : clip === "attack" ? 1.65 : 1.4;
  const hashes = new Set();
  for (let frame = 0; frame < Math.ceil(duration * 12); frame++) {
    const canvas = plate(hero, clip, frame / 12, true);
    // Hash ONLY the art viewport: both changing timestamp and static caption are excluded.
    const art = canvas.getContext("2d").getImageData(0, 82, 800, 443).data;
    hashes.add(createHash("sha256").update(art).digest("hex"));
    frames.push(Buffer.from(canvas.getContext("2d").getImageData(0, 0, 800, 590).data));
  }
  motionEvidence.push({ clip, frames: Math.ceil(duration * 12), distinctArtFrames: hashes.size });
}
await sharp(Buffer.concat(frames), { raw: { width: 800, height: 590 * frames.length, channels: 4, pageHeight: 590 } })
  .gif({ loop: 0, delay: 83, effort: 3 }).toFile(path.join(output, "motion-study.gif"));
process.stdout.write(`motion-study.gif (${frames.length} frames)\n`);
const crowd = stills.at(-1)[0];
const crowdFrames = [];
const crowdHashes = new Set();
for (let frame = 0; frame < 24; frame++) {
  const canvas = plate(crowd, "attack", frame / 12, true);
  const context = canvas.getContext("2d");
  crowdHashes.add(createHash("sha256").update(context.getImageData(0, 82, 800, 443).data).digest("hex"));
  crowdFrames.push(Buffer.from(context.getImageData(0, 0, 800, 590).data));
}
await sharp(Buffer.concat(crowdFrames), { raw: { width: 800, height: 590 * crowdFrames.length, channels: 4, pageHeight: 590 } })
  .gif({ loop: 0, delay: 83, effort: 3 }).toFile(path.join(output, "crowd-motion.gif"));
motionEvidence.push({ clip: "crowd choreography", frames: 24, distinctArtFrames: crowdHashes.size });
await writeFile(path.join(output, "motion-evidence.json"), JSON.stringify({ method: "SHA-256 of art pixels only (0,82,800,443), excludes header timestamp and footer", clips: motionEvidence }, null, 2) + "\n");
process.stdout.write("crowd-motion.gif (24 frames)\n");
