import { crowdAt, poseAt, project, type Action, type ActorKind, type Joint, type Point, type Pose, type View } from "./motion.ts";

export const WIDTH = 1024;
export const HEIGHT = 608;
const C = {
  ink: "#121822", night: "#19232f", wall: "#36434d", wallLight: "#4b585e", edge: "#6c7b7c", pavement: "#35434a", pale: "#d3d4b8", rust: "#b95e46", rustLight: "#e39164", coat: "#668582", coatLight: "#b0c3ae", coatShadow: "#30454c", teal: "#73e2c6", metal: "#8c9d9c", metalLight: "#e0e7d0", skin: "#bc896c", shadow: "#22323a",
};

/** Integer scan conversion, including all outline polygons. No antialiased paths. */
class Pixels {
  constructor(readonly ctx: CanvasRenderingContext2D) {}
  rect(x: number, y: number, w: number, h: number, color: string) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  }

  poly(points: Point[], color: string) {
    const pts = points.map(([x, y]) => [Math.round(x), Math.round(y)] as Point);
    const min = Math.min(...pts.map((p) => p[1]));
    const max = Math.max(...pts.map((p) => p[1]));
    this.ctx.fillStyle = color;
    for (let y = min; y <= max; y++) {
      const intersections: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i]!;
        const b = pts[(i + 1) % pts.length]!;
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
          intersections.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
        }
      }
      intersections.sort((a, b) => a - b);
      for (let i = 0; i + 1 < intersections.length; i += 2) {
        const x = Math.ceil(intersections[i]!);
        this.ctx.fillRect(x, y, Math.max(1, Math.floor(intersections[i + 1]!) - x + 1), 1);
      }
    }
  }

  line(a: Point, b: Point, color: string, width = 1) {
    const steps = Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])));
    for (let i = 0; i <= steps; i++) {
      const t = steps ? i / steps : 0;
      this.rect(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, width, width, color);
    }
  }

  text(text: string, x: number, y: number, color = C.pale, size = 10) {
    this.ctx.font = `${size}px ui-monospace, SFMono-Regular, Consolas, monospace`;
    this.ctx.fillStyle = color;
    this.ctx.fillText(text, Math.round(x), Math.round(y));
  }
}

function box(p: Pixels, x: number, y: number, w: number, d: number, h: number, top: string, left = C.wall, right = C.shadow, base = 0) {
  const a = project(x, y, h), b = project(x + w, y, h), c = project(x + w, y + d, h), e = project(x, y + d, h);
  p.poly([e, c, project(x + w, y + d, base), project(x, y + d, base)], left);
  p.poly([b, c, project(x + w, y + d, base), project(x + w, y, base)], right);
  p.poly([a, b, c, e], top);
  p.line(a, b, C.edge);
  p.line(a, e, C.edge);
  p.line(e, c, C.ink);
  p.line(b, c, C.ink);
}
function diamond(p: Pixels, x: number, y: number, w: number, d: number, color: string, z = 0) {
  p.poly([project(x, y, z), project(x + w, y, z), project(x + w, y + d, z), project(x, y + d, z)], color);
}

function environment(ctx: CanvasRenderingContext2D) {
  const p = new Pixels(ctx);
  p.rect(0, 0, WIDTH, HEIGHT, C.night);
  // Skyline made of chipped clusters, not a noise overlay.
  for (let i = 0; i < 18; i++) {
    const x = i * 63 - 20;
    const h = 68 + ((i * 37) % 91);
    p.rect(x, 130 - h, 57, h + 150, i % 3 === 0 ? "#22303c" : "#202a35");
    p.rect(x + 6, 126 - h, 20, 4, "#2b3944");
    for (let j = 0; j < 3; j++) { p.rect(x + 10 + j * 13, 105 - h + 60, 4, 9, j === i % 3 ? "#6b796e" : "#33414a"); }
  }
  // Dimetric plate: x and y travel two pixels horizontally for each vertical pixel.
  diamond(p, -280, -70, 600, 490, C.ink, -10);
  diamond(p, -280, -70, 600, 490, C.pavement);
  diamond(p, -268, -54, 580, 162, "#414d50");
  diamond(p, -268, 108, 580, 12, "#596268", 1);
  diamond(p, -260, 126, 575, 290, "#2b3941");
  // Stone planes, gutter, road paint and angular wet reflections.
  for (let i = 0; i < 14; i++) {
    const x = -260 + i * 43;
    p.line(project(x, -50), project(x, 103), "#35444b");
    p.line(project(x, 103), project(x + 35, 103), "#72807a");
    diamond(p, x, 110, 26, 6, "#202c36");
  }
  for (let y = -20; y < 110; y += 36) { p.line(project(-263, y), project(306, y), "#35444b"); }
  for (let i = 0; i < 7; i++) { diamond(p, -245 + i * 82, 277, 38, 4, "#7c8173"); }
  for (let i = 0; i < 17; i++) {
    const x = -244 + (i * 137) % 550;
    const y = 138 + (i * 83) % 245;
    diamond(p, x, y, 16 + i % 4 * 12, 3 + i % 7, i % 3 === 0 ? "#455c60" : "#32434c");
    p.line(project(x, y), project(x + 9, y), "#52686a");
  }
  // Left tenement and clinic occupy the back rim; stage remains readable.
  box(p, -262, -46, 187, 109, 142, "#66716e", "#465456", "#2c3c43");
  box(p, -256, -43, 177, 105, 145, "#596667", "#36464d", "#263741", 142);
  for (let floor = 0; floor < 2; floor++) {
    for (let win = 0; win < 4; win++) {
      const x = -239 + win * 37;
      const z = 45 + floor * 57;
      p.poly([project(x, 64, z), project(x + 25, 64, z), project(x + 25, 64, z + 37), project(x, 64, z + 37)], "#1e2b33");
      p.poly([project(x + 3, 65, z + 3), project(x + 21, 65, z + 3), project(x + 21, 65, z + 31), project(x + 3, 65, z + 31)], win === 1 ? "#b6a26d" : "#506267");
      p.line(project(x + 12, 66, z), project(x + 12, 66, z + 35), "#25353d", 2);
      p.line(project(x, 67, z + 17), project(x + 25, 67, z + 17), "#293a42", 2);
      p.line(project(x - 2, 69, z), project(x + 26, 69, z), "#718078", 2);
    }
  }
  // Rooftop ventilation, plumbing, uneven coping stones.
  box(p, -231, -14, 49, 27, 173, "#65716e", "#4d595c", "#2d3f45", 145);
  for (let j = 0; j < 5; j++) { p.line(project(-227, 14, 148 + j * 4), project(-189, 14, 148 + j * 4), "#26373d", 2); }
  p.line(project(-101, 69, 130), project(-101, 69, 6), "#a28b70", 3);
  p.line(project(-98, 69, 130), project(-98, 69, 6), "#495354");
  // Clinic facade has a carved awning, luminous sign and shutter slats.
  box(p, -54, -56, 211, 108, 118, "#58656a", "#394951", "#23343e");
  box(p, -47, -48, 190, 95, 122, "#475961", "#33444c", "#23323c", 118);
  p.poly([project(-31, 54, 5), project(80, 54, 5), project(80, 54, 82), project(-31, 54, 82)], "#23353d");
  for (let z = 10; z < 79; z += 7) { p.line(project(-27, 55, z), project(78, 55, z), "#4b6167", 2); }
  box(p, -49, 43, 183, 25, 87, "#677878", "#465f65", "#2c464e", 82);
  for (let i = 0; i < 9; i++) { p.line(project(-44 + i * 20, 44, 89), project(-44 + i * 20, 68, 89), "#9aa68e", 2); }
  const sign = project(22, 69, 105);
  p.rect(sign[0] - 71, sign[1] - 20, 134, 24, C.ink);
  p.rect(sign[0] - 68, sign[1] - 17, 128, 18, "#29464b");
  p.text("N I G H T  C L I N I C", sign[0] - 63, sign[1] - 4, "#a2d0bc", 9);
  // Tall cross at the wall edge; brighter than the windows but dimmer than the hero's tool.
  const cross = project(145, 46, 124);
  p.rect(cross[0] - 11, cross[1] - 10, 25, 34, "#172b32");
  p.rect(cross[0] - 1, cross[1] - 4, 6, 21, "#6da998");
  p.rect(cross[0] - 8, cross[1] + 3, 20, 6, "#6da998");
  // Right-side terminal, water tank and practical vertical clutter.
  box(p, 208, -47, 84, 79, 156, "#3c4e55", "#31424a", "#20323c");
  box(p, 221, -22, 52, 45, 180, "#657772", "#3c565b", "#29454d", 156);
  for (let i = 0; i < 5; i++) { p.line(project(223, 24, 164 + i * 3), project(269, 24, 164 + i * 3), "#2e464e"); }
  // Static facade notices: social detail stays above the quiet combat floor.
  for (const [x, z, color] of [[94, 48, "#a0a990"], [111, 37, "#9c826a"], [89, 25, "#6e9690"]] as const) {
    p.poly([project(x, 55, z), project(x + 13, 55, z), project(x + 13, 55, z + 21), project(x, 55, z + 21)], color);
    for (let line = 0; line < 3; line++) { p.line(project(x + 3, 56, z + 5 + line * 4), project(x + 10, 56, z + 5 + line * 4), "#405255"); }
  }
  const district = project(238, 33, 111);
  p.text("09", district[0] - 20, district[1], "#72837c", 26);
  p.text("WATER", district[0] - 19, district[1] + 12, "#70837c", 8);
  for (let i = 0; i < 3; i++) {
    p.line(project(220 + i * 13, 34, 9), project(220 + i * 13, 34, 66), "#263b44", 4);
    p.line(project(220 + i * 13, 34, 9), project(220 + i * 13, 34, 66), "#5c716f", 1);
  }
  box(p, -249, 73, 30, 29, 28, "#687469", "#495b53", "#344740");
  box(p, -211, 81, 21, 24, 20, "#907563", "#6d574d", "#443d3c");
  const bags = [[-160, 79], [-146, 82], [105, 78]] as Point[];
  for (const [x, y] of bags) {
    const a = project(x, y);
    p.poly([[a[0] - 13, a[1]], [a[0] - 11, a[1] - 13], [a[0] - 4, a[1] - 20], [a[0] + 7, a[1] - 17], [a[0] + 12, a[1] - 4], [a[0] + 6, a[1] + 4]], "#253338");
    p.line([a[0] - 8, a[1] - 11], [a[0] - 2, a[1] - 16], "#465453", 2);
  }
  // Overhead cable, with deliberately stepped sag and ceramic insulators.
  const cable: Point[] = [[85, 82], [220, 118], [395, 147], [560, 152], [728, 141], [951, 99]];
  for (let i = 1; i < cable.length; i++) { p.line(cable[i - 1]!, cable[i]!, C.ink, 2); }
  for (const [x, y] of [[220, 118], [728, 141]] as Point[]) { p.rect(x, y, 5, 11, "#788577"); }
  p.text("SECTOR 09  /  AFTER THE SHIFT", 29, 582, "#778b8a", 10);
  p.text("2:1 DIMETRIC   ·   NIGHT CLINIC", 726, 582, "#778b8a", 10);
}

interface StreetObject { depth: number; hero?: boolean; draw: (p: Pixels) => void }
function streetObjects(): StreetObject[] {
  const objects: StreetObject[] = ([[-211, 152], [186, 166], [-9, 370]] as Point[]).map(([x, y]) => ({
    depth: x + y + 53 + 18,
    draw(p) {
      box(p, x, y, 53, 18, 20, "#7b8176", "#576769", "#364b55");
      for (let j = 0; j < 3; j++) { p.line(project(x + 6 + j * 16, y + 19, 17), project(x + 14 + j * 16, y + 19, 6), "#b99962", 3); }
    },
  }));
  objects.push({ depth: 244, draw(p) {
    const terminal = project(174, 64);
    p.rect(terminal[0] - 13, terminal[1] - 58, 26, 55, C.ink);
    p.rect(terminal[0] - 10, terminal[1] - 55, 20, 43, "#626f69");
    p.rect(terminal[0] - 7, terminal[1] - 49, 14, 17, "#173338");
    p.rect(terminal[0] - 5, terminal[1] - 46, 9, 2, "#86bfab");
    p.rect(terminal[0] - 5, terminal[1] - 41, 5, 2, "#4c7f73");
    p.rect(terminal[0] - 5, terminal[1] - 23, 11, 5, "#2a3a3d");
  } });
  // Ration cart, folding stools and thermos: the clinic's overnight waiting place.
  objects.push({ depth: 687, hero: false, draw(p) {
    box(p, 253, 354, 55, 28, 35, "#82918a", "#605c50", "#3b4d51");
    box(p, 254, 353, 54, 30, 39, "#a3a88d", "#7d7e68", "#536662", 35);
    for (const [x, y] of [[257, 360], [302, 372]] as Point[]) {
      const wheel = project(x, y, 2);
      p.rect(wheel[0] - 4, wheel[1] - 3, 8, 9, "#14252e");
      p.rect(wheel[0] - 2, wheel[1] - 1, 4, 5, "#667974");
    }
    box(p, 270, 359, 9, 9, 55, "#bac3ad", "#849a92", "#516f70", 39);
    box(p, 288, 358, 11, 9, 48, "#ccb689", "#8c795e", "#5c655c", 39);
    const placard = project(270, 383, 31);
    p.rect(placard[0] - 13, placard[1] - 5, 37, 17, "#283e45");
    p.text("24H", placard[0] - 10, placard[1] + 7, "#b9b68e", 10);
    for (const [x, y] of [[232, 360], [289, 405]] as Point[]) {
      box(p, x, y, 15, 13, 17, "#807e69", "#2e454b", "#1c343e", 14);
      p.line(project(x + 2, y + 12, 14), project(x + 13, y + 12, 0), "#627675", 2);
      p.line(project(x + 13, y + 12, 14), project(x + 2, y + 12, 0), "#627675", 2);
    }
  } });
  return objects;
}

function limb(p: Pixels, a: Point, b: Point, width: number, color: string, light: string) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const shape = (w: number) => [[a[0] + nx * w, a[1] + ny * w], [b[0] + nx * w * 0.8, b[1] + ny * w * 0.8], [b[0] - nx * w * 0.8, b[1] - ny * w * 0.8], [a[0] - nx * w, a[1] - ny * w]] as Point[];
  p.poly(shape(width + 1.5), C.ink);
  p.poly(shape(width), color);
  p.line([a[0] - nx * width * 0.6, a[1] - ny * width * 0.6], [b[0] - nx * width * 0.5, b[1] - ny * width * 0.5], light, 2);
}

const actorCanvas = new Map<string, HTMLCanvasElement>();
/** Rasterize the articulated drawing at 1x first; upscaling never changes the pixel grid. */
function sprite(inputPose: Pose, kind: ActorKind): HTMLCanvasElement {
  const pose = { ...inputPose };
  if (kind === "guard") {
    pose.hand = [10, inputPose.hand[1] * 0.62, inputPose.hand[2] + 3];
    pose.elbow = [14, inputPose.elbow[1] * 0.7, inputPose.elbow[2] + 2];
    pose.otherHand = [-8, pose.hand[1] - 3, pose.hand[2] - 1];
    pose.lean *= 0.45;
    pose.stride *= 0.75;
  } else if (kind === "raider") {
    pose.hand = [16, inputPose.hand[1] * 0.8, inputPose.hand[2] - 3];
    pose.elbow = [17, inputPose.elbow[1] - 5, inputPose.elbow[2]];
    pose.otherHand = [-17, -13, 41];
  } else if (kind === "bruiser") {
    pose.lean *= 0.3;
    pose.hand = [14, inputPose.hand[1] * 0.55, 37];
    pose.elbow = [18, 6, 44];
    pose.otherHand = [-9, 16, 36];
  }
  const key = `${kind}/${JSON.stringify(pose)}`;
  const found = actorCanvas.get(key);
  if (found) { return found; }
  const canvas = document.createElement("canvas");
  canvas.width = 180;
  canvas.height = 116;
  const context = canvas.getContext("2d")!;
  const p = new Pixels(context);
  const angle = pose.facing;
  const forward: Point = [Math.cos(angle), Math.sin(angle) * 0.5];
  const side: Point = [-Math.sin(angle), Math.cos(angle) * 0.5];
  const at = (j: Joint, body = true): Point => [84 + j[0] * side[0] + (j[1] + (body ? pose.lean : 0)) * forward[0], 102 + j[0] * side[1] + (j[1] + (body ? pose.lean : 0)) * forward[1] - j[2] - (body ? pose.bob : 0)];
  const medic = kind === "medic";
  const raider = kind === "raider" || kind === "bruiser";
  const scout = kind === "scout";
  const bruiser = kind === "bruiser";
  const legWidth = bruiser ? 6.5 : scout ? 3.8 : medic ? 4.8 : 5.6;
  const coat = medic ? C.coat : raider ? "#926851" : "#5d697b";
  const light = medic ? C.coatLight : raider ? "#bf9470" : "#8d9da8";
  const shade = medic ? C.coatShadow : raider ? "#604534" : "#394553";
  const feet = [-1, 1].map((sign) => {
    const f = -pose.stride * sign;
    const lift = Math.max(0, pose.lift * sign) * (Math.abs(pose.stride) > 0 ? 5 : 0);
    return { sign, hip: at([sign * 7, 0, 31]), knee: at([sign * 8, f * 0.35, 17 + lift], false), foot: at([sign * 9, f, 4 + lift], false) };
  }).sort((a, b) => a.foot[1] - b.foot[1]);
  for (const leg of feet) {
    limb(p, leg.hip, leg.knee, legWidth, "#3d4851", "#667273");
    limb(p, leg.knee, leg.foot, legWidth - 0.8, "#34454d", "#455b61");
    const toe: Point = [leg.foot[0] + forward[0] * 6, leg.foot[1] + forward[1] * 6 + 2];
    limb(p, [leg.foot[0], leg.foot[1] - 5], toe, legWidth, "#263037", "#829086");
    if (medic || bruiser) { p.rect(leg.knee[0] - 3, leg.knee[1] - 3, 5, 3, medic ? "#8b8f7f" : light); }
  }
  const back = Math.sin(angle) < -0.25;
  const farShoulder = at([-10, 0, 53]);
  const farElbow = at([-13, pose.otherHand[1] * 0.5, 40]);
  const farHand = at(pose.otherHand);
  limb(p, farShoulder, farElbow, raider ? 4 : 5, raider ? "#b8825f" : shade, raider ? "#d6a77c" : coat);
  limb(p, farElbow, farHand, 4, shade, light);
  // Long split coat: a shaped hem with cut-ins and a clear leg aperture.
  const torso = (x: number, y: number, z: number) => at([x, y, z]);
  const bodyShape = medic
    ? [torso(-12, -4, 57), torso(9, -5, 57), torso(15, 4, 49), torso(12, 7, 32), torso(20, -pose.coat, 16), torso(6, 5, 20), torso(0, 4, 29), torso(-7, 2, 17), torso(-20, -pose.coat - 3, 21), torso(-13, -3, 39)]
    : raider
      ? [torso(-10, -4, 55), torso(8, -5, 54), torso(11, 4, 49), torso(8, 7, 32), torso(11, 4, 26), torso(3, 5, 29), torso(-4, 2, 27), torso(-11, -3, 30), torso(-10, -3, 39)]
      : [torso(-15, -6, 57), torso(12, -6, 57), torso(17, 5, 50), torso(14, 9, 34), torso(9, 8, 28), torso(-12, -3, 28), torso(-16, -4, 44)];
  // Contour is an offset silhouette, not a globally darkened sprite edge.
  for (const [ox, oy] of [[-1, 0], [1, 0], [0, 1], [0, -1]] as Point[]) { p.poly(bodyShape.map((q) => [q[0] + ox, q[1] + oy]), C.ink); }
  p.poly(bodyShape, coat);
  if (medic) {
    p.poly([torso(4, -4, 54), torso(14, 4, 48), torso(11, 7, 32), torso(19, -pose.coat, 18), torso(6, 5, 22), torso(0, 4, 31)], shade);
    p.poly([torso(-12, -4, 55), torso(-5, -4, 56), torso(-4, -1, 42), torso(-11, 0, 32), torso(-17, -pose.coat - 2, 21), torso(-19, -pose.coat - 2, 23)], light);
  } else if (raider) {
    p.poly([torso(-7, 3, 52), torso(5, 6, 51), torso(5, 8, 33), torso(-4, 5, 34)], "#493c35");
    p.line(torso(-9, 2, 50), torso(-9, 3, 30), "#cc9368", 2);
    p.line(torso(7, 6, 51), torso(7, 8, 29), "#cc9368", 2);
  } else {
    p.poly([torso(-12, 1, 52), torso(9, 7, 52), torso(12, 9, 43), torso(8, 9, 35), torso(-12, 2, 37)], "#82908f");
    p.poly([torso(4, 6, 51), torso(11, 8, 48), torso(10, 9, 38), torso(4, 7, 36)], "#536a70");
    p.line(torso(-11, 3, 47), torso(7, 8, 47), "#b3bda8", 2);
    const patch = torso(-5, 5, 44);
    p.rect(patch[0] - 3, patch[1] - 2, 7, 4, "#344b53");
    p.rect(patch[0] - 2, patch[1] - 1, 2, 2, "#bac7b4");
    for (const side of [-1, 1]) {
      const pouch = torso(side * 9, 7, 32);
      p.rect(pouch[0] - 3, pouch[1], 6, 7, C.ink);
      p.rect(pouch[0] - 2, pouch[1] + 1, 4, 4, "#87908a");
    }
  }
  // Ceramic collar, lapel, weathering confined to meaningful construction edges.
  p.poly([torso(-8, 1, 55), torso(0, 4, 49), torso(6, 5, 55), torso(1, 6, 45), torso(-4, 6, 47)], medic ? "#b7c4b4" : light);
  p.line(torso(-2, 7, 43), torso(-1, 7, 33), C.ink);
  p.line(torso(-9, 0, 30), torso(8, 7, 30), "#202c33", 3);
  const buckle = torso(3, 8, 31);
  p.rect(buckle[0], buckle[1], 3, 3, "#c6b989");
  if (medic) {
    // The cantilevered orange med-case changes the outline from every angle.
    const bag = at([16, -11, 37]);
    p.poly([[bag[0] - 10, bag[1] - 11], [bag[0] + 7, bag[1] - 13], [bag[0] + 12, bag[1] - 7], [bag[0] + 11, bag[1] + 15], [bag[0] - 7, bag[1] + 17], [bag[0] - 11, bag[1] + 11]], C.ink);
    p.poly([[bag[0] - 8, bag[1] - 9], [bag[0] + 6, bag[1] - 11], [bag[0] + 8, bag[1] - 6], [bag[0] + 7, bag[1] + 13], [bag[0] - 7, bag[1] + 14]], C.rust);
    p.poly([[bag[0] + 6, bag[1] - 11], [bag[0] + 10, bag[1] - 6], [bag[0] + 9, bag[1] + 13], [bag[0] + 6, bag[1] + 14]], "#763f35");
    p.line([bag[0] - 7, bag[1] - 8], [bag[0] + 4, bag[1] - 10], C.rustLight, 2);
    p.rect(bag[0] - 2, bag[1] - 3, 4, 12, "#d8d3b1");
    p.rect(bag[0] - 6, bag[1] + 1, 12, 4, "#d8d3b1");
    p.rect(bag[0] - 7, bag[1] + 11, 3, 2, "#edac76");
    p.line(at([-13, -7, 50]), at([6, 6, 35]), "#263339", 3);
    p.line(at([-12, -7, 50]), at([7, 6, 35]), "#9b8a69");
  } else if (raider) {
    const tank = at([-12, -5, 49]);
    p.rect(tank[0] - 6, tank[1] - 8, 9, 22, C.ink);
    p.rect(tank[0] - 4, tank[1] - 6, 5, 18, "#ad834f");
    p.rect(tank[0] - 4, tank[1] + 1, 5, 3, "#423733");
  }
  if (bruiser) {
    p.poly([torso(-18, 1, 56), torso(14, 6, 55), torso(18, 9, 34), torso(-16, 2, 33)], "#282f31");
    p.poly([torso(-16, 2, 53), torso(12, 7, 53), torso(15, 9, 37), torso(-14, 3, 36)], "#978165");
    p.line(torso(-13, 3, 49), torso(10, 8, 49), "#d0b58d", 3);
    p.line(torso(-12, 4, 42), torso(11, 8, 42), "#655644", 3);
  }
  if (scout) {
    p.poly([torso(-6, -3, 56), torso(-5, -12, 54), torso(-7, -28 - pose.coat, 49), torso(-1, -17 - pose.coat, 48), torso(1, -5, 51)], "#a0ac98");
  }
  const neck = at([0, 0, 57]);
  const head = at([0, 0, 66]);
  p.rect(neck[0] - 4, neck[1] - 4, 9, 7, "#283d42");
  const hx = head[0], hy = head[1];
  if (medic) {
    p.poly([[hx - 9, hy + 8], [hx - 12, hy + 2], [hx - 11, hy - 9], [hx - 5, hy - 15], [hx + 4, hy - 14], [hx + 11, hy - 7], [hx + 12, hy + 6], [hx + 5, hy + 12]], C.ink);
    p.poly([[hx - 8, hy + 6], [hx - 10, hy], [hx - 9, hy - 8], [hx - 4, hy - 13], [hx + 3, hy - 12], [hx + 9, hy - 6], [hx + 10, hy + 5], [hx + 4, hy + 9]], coat);
    p.poly([[hx - 8, hy - 6], [hx - 3, hy - 11], [hx + 2, hy - 10], [hx + 7, hy - 5], [hx + 1, hy - 7], [hx - 4, hy - 5], [hx - 7, hy + 1]], light);
    if (!back) {
      const faceX = hx + forward[0] * 4;
      p.poly([[faceX - 4, hy - 4], [faceX + 6, hy - 3], [faceX + 7, hy + 5], [faceX + 3, hy + 9], [faceX - 3, hy + 5]], "#253438");
      p.rect(faceX - 2, hy - 2, 6, 4, C.skin);
      p.rect(faceX + 2, hy - 1, 4, 1, C.ink);
      p.poly([[faceX - 3, hy + 2], [faceX + 7, hy + 2], [faceX + 5, hy + 8], [faceX - 1, hy + 7]], "#b5c0b1");
      p.rect(faceX + 3, hy + 3, 2, 3, "#476369");
      p.rect(faceX + 5, hy + 3, 2, 1, C.teal);
    }
  } else {
    p.poly([[hx - 8, hy + 6], [hx - 10, hy - 7], [hx - 6, hy - 12], [hx + 6, hy - 12], [hx + 10, hy - 5], [hx + 8, hy + 7]], C.ink);
    p.poly([[hx - 7, hy + 4], [hx - 8, hy - 6], [hx - 5, hy - 10], [hx + 5, hy - 10], [hx + 8, hy - 4], [hx + 6, hy + 5]], raider ? "#ad8060" : "#7b8990");
    p.rect(hx - 6, hy - 3, 14, 5, "#253941");
    p.rect(hx + 1, hy - 2, 6, 2, raider ? "#e7a965" : "#8eb5bc");
    if (raider && !bruiser) { p.poly([[hx - 6, hy - 10], [hx - 4, hy - 20], [hx, hy - 15], [hx + 5, hy - 19], [hx + 7, hy - 10]], "#733d38"); }
    if (bruiser) {
      p.poly([[hx - 12, hy - 9], [hx - 8, hy - 14], [hx + 8, hy - 14], [hx + 12, hy - 8], [hx + 11, hy + 8], [hx - 11, hy + 8]], C.ink);
      p.poly([[hx - 10, hy - 8], [hx - 6, hy - 12], [hx + 6, hy - 12], [hx + 10, hy - 7], [hx + 9, hy + 6], [hx - 9, hy + 6]], "#ae9a7d");
      p.rect(hx - 8, hy - 4, 17, 6, "#2a383a");
      p.rect(hx, hy - 2, 6, 2, "#b5c2a5");
    }
    if (scout) {
      p.poly([[hx - 12, hy - 7], [hx - 7, hy - 14], [hx + 6, hy - 13], [hx + 11, hy - 7], [hx + 18, hy - 5], [hx + 17, hy - 2], [hx - 12, hy - 3]], "#405762");
      p.line([hx - 6, hy - 11], [hx + 5, hy - 10], "#839589", 2);
    }
  }
  // Shoulder / forearm overlap provides an authored foreground plane.
  const shoulder = at([11, 1, 52]);
  const elbow = at(pose.elbow);
  const hand = at(pose.hand);
  limb(p, shoulder, elbow, bruiser ? 8 : raider ? 4.5 : medic ? 5.5 : scout ? 4.5 : 7, raider ? "#b77d5c" : coat, raider ? "#d6a77c" : light);
  if (!medic && !raider && !scout) {
    p.poly([[shoulder[0] - 9, shoulder[1] - 4], [shoulder[0] + 5, shoulder[1] - 5], [shoulder[0] + 10, shoulder[1] + 3], [shoulder[0] + 5, shoulder[1] + 9], [shoulder[0] - 8, shoulder[1] + 6]], C.ink);
    p.poly([[shoulder[0] - 7, shoulder[1] - 2], [shoulder[0] + 4, shoulder[1] - 3], [shoulder[0] + 7, shoulder[1] + 3], [shoulder[0] + 4, shoulder[1] + 6], [shoulder[0] - 6, shoulder[1] + 4]], "#9ba89b");
    p.line([shoulder[0] - 5, shoulder[1]], [shoulder[0] + 4, shoulder[1] + 1], "#d0d1b7", 2);
  }
  p.rect(shoulder[0] - 4, shoulder[1] + 1, 8, 4, medic ? C.rust : light);
  limb(p, elbow, hand, medic ? 4.8 : 4.1, medic ? C.metal : shade, medic ? C.metalLight : light);
  if (medic) {
    p.line([elbow[0] + 2, elbow[1]], [hand[0] + 2, hand[1] - 1], "#3c7774", 2);
    p.rect(hand[0] - 1, hand[1] - 3, 3, 2, C.teal);
  }
  const gunLength = scout ? 34 : bruiser ? 20 : medic ? 23 : raider ? 21 : 17;
  const gunDrop = pose.flash ? -2 : medic ? 1 : raider ? 9 : 5;
  const tip: Point = [hand[0] + forward[0] * gunLength, hand[1] + forward[1] * gunLength + gunDrop];
  limb(p, hand, tip, bruiser ? 4 : 2.5, medic ? "#8b9990" : "#33454c", pose.flash ? "#c7ccad" : medic ? "#a6b9a6" : "#728780");
  p.line([hand[0] + forward[0] * 5, hand[1] + forward[1] * 5 - 2], [hand[0] + forward[0] * 14, hand[1] + forward[1] * 14 - 2], medic ? C.teal : "#9ba28c", 2);
  p.rect(hand[0] - 2, hand[1] - 2, 5, 5, "#2c3d41");
  if (pose.flash) {
    const color = medic ? "#b1ffe1" : "#ffe3a2";
    const direction = forward[0] > 0 ? 1 : -1;
    p.poly([[tip[0], tip[1] - 3], [tip[0] + direction * 8, tip[1] - 8], [tip[0] + direction * 9, tip[1] - 2], [tip[0] + direction * 22, tip[1]], [tip[0] + direction * 10, tip[1] + 3], [tip[0] + direction * 9, tip[1] + 8], [tip[0] + direction * 2, tip[1] + 4]], color);
    p.line([tip[0] + direction * 19, tip[1]], [tip[0] + direction * 29, tip[1] + forward[1] * 6], color);
  }
  if (actorCanvas.size > 600) { actorCanvas.clear(); }
  actorCanvas.set(key, canvas);
  return canvas;
}

function actor(p: Pixels, x: number, y: number, scale: number, pose: Pose, kind: ActorKind, ring = false) {
  const w = 17 * scale;
  p.poly([[x - w, y], [x - w * 0.4, y - w * 0.3], [x + w, y - 1], [x + w * 0.4, y + w * 0.3]], "#172933");
  if (ring) {
    p.line([x - w - 8, y], [x - 5, y + 10], "#74a99d");
    p.line([x + 5, y + 10], [x + w + 8, y], "#74a99d");
  }
  const img = sprite(pose, kind);
  p.ctx.drawImage(img, Math.round(x - 84 * scale), Math.round(y - 102 * scale), Math.round(180 * scale), Math.round(116 * scale));
}

let background: HTMLCanvasElement | undefined;
export function paint(ctx: CanvasRenderingContext2D, seconds: number, view: View, action: Action, rain: boolean) {
  ctx.imageSmoothingEnabled = false;
  if (!background) {
    background = document.createElement("canvas");
    background.width = WIDTH;
    background.height = HEIGHT;
    environment(background.getContext("2d")!);
  }
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.drawImage(background, 0, 0);
  const p = new Pixels(ctx);
  const props = streetObjects();
  if (view === "crowd") {
    const drawables: StreetObject[] = [...props, ...crowdAt(seconds).map((unit) => ({
      depth: unit.x + unit.y,
      draw(pixels: Pixels) {
        const [x, y] = project(unit.x, unit.y);
        const scale = unit.kind === "medic" ? 1.08 : unit.kind === "bruiser" ? 0.9 : unit.kind === "scout" ? 0.74 : 0.8;
        actor(pixels, x, y, scale, poseAt(unit.phase, unit.action, unit.facing), unit.kind, unit.kind === "medic");
      },
    }))];
    for (const item of drawables.sort((a, b) => a.depth - b.depth)) { item.draw(p); }
    p.rect(24, 24, 243, 54, "#14212be8");
    p.text("THE STREET DOESN'T WAIT.", 38, 46, "#d3d4b8", 13);
    p.text("20 UNION  /  20 FREE CONTRACTORS", 38, 64, "#91aba7", 10);
  } else if (view === "lineup") {
    for (const prop of props) { prop.draw(p); }
    p.rect(26, 29, 972, 526, "#182730e8");
    p.text("SAME WORLD. DIFFERENT SILHOUETTES.", 52, 62, C.pale, 16);
    p.text("THE MEDIC'S KIT / THE GUARD'S ARMOUR / THE RAIDER'S SPIKE", 52, 83, "#88a2a0", 10);
    const kinds = ["medic", "guard", "raider"] as const;
    for (let i = 0; i < 3; i++) {
      const x = 205 + i * 308;
      p.line([x - 135, 443], [x + 134, 443], "#3b555b");
      actor(p, x - 10, 395, 3, poseAt(seconds + i * 0.17, action, 0.7), kinds[i]!);
      p.text(["01  /  PATCH", "02  /  UNION GUARD", "03  /  ASH RUNNER"][i]!, x - 127, 471, C.pale, 13);
      p.text(["OVERSIZED KIT + SPLIT HEM", "LOW HELMET + CLOSED CHEST", "HIGH CREST + AIR TANK"][i]!, x - 127, 495, "#8aa39e", 10);
      p.text(i === 0 ? "FIELD MEDIC · HERO" : "LINE TROOP · SUPPORT", x - 127, 518, i === 0 ? C.rustLight : "#718f91", 10);
    }
  } else {
    for (const prop of props) {
      if (prop.hero !== false) { prop.draw(p); }
    }
    // A portrait plate over the actual map; clearly labelled 3x so it is not a battle-scale claim.
    p.rect(27, 28, 320, 62, "#17252ce8");
    p.text("PATCH", 44, 58, "#e1dfc4", 26);
    p.text("FIELD MEDIC  /  SHIFT 09  /  STILL HERE", 46, 78, "#93afa5", 10);
    actor(p, 382, 443, 3.2, poseAt(seconds, action, 0.64), "medic", true);
    p.rect(32, 483, 562, 69, "#15232de8");
    p.text("RUST CASE. COLD HANDS. STEADY WORK.", 47, 507, "#d0d7c0", 13);
    p.text("HOODED VETERAN  /  CERAMIC FOREARM  /  INJECTOR CARBINE", 47, 527, "#84a7a1", 10);
    p.text("CHARACTER STUDY 3.2× · ORIGINAL PIXEL CLUSTERS", 47, 544, "#638a87", 9);
    p.rect(744, 23, 256, 528, "#17252cf2");
    p.line([761, 62], [982, 62], "#455b5c");
    p.text("MOTION NOTES", 764, 47, C.pale, 13);
    const timings = [0.333, 0.667, 1.0];
    const labels = ["01 / LOAD", "02 / CONTACT", "03 / RELEASE"];
    for (let i = 0; i < 3; i++) {
      const y = 173 + i * 157;
      actor(p, 859, y, 1.4, poseAt(timings[i]!, "attack", 0.64), "medic");
      p.text(labels[i]!, 765, y + 31, i === 1 ? C.teal : "#96aaa4", 10);
      p.text(["Shoulder back. Tool high.", "Plant, drive, hold 3 frames.", "Coat catches up. Settle."][i]!, 765, y + 46, "#648783", 9);
      if (i < 2) { p.line([763, y + 58], [982, y + 58], "#2e434b"); }
    }
  }
  if (rain) {
    const tick = Math.floor(seconds * 12);
    for (let i = 0; i < 95; i++) {
      const x = (i * 137 + tick * 3) % WIDTH;
      const y = (i * 79 + tick * 13) % 555;
      // Quiet background rain; hero and motion plate retain their shape hierarchy.
      if (view === "hero" && ((x > 230 && x < 555 && y > 185) || x > 742)) { continue; }
      if (view === "lineup") { continue; }
      p.line([x, y], [x - 2, y + 7], i % 5 === 0 ? "#678785" : "#405c64");
    }
  }
  p.rect(0, HEIGHT - 20, WIDTH, 20, "#111d25");
  p.text("PIXEL NOIR   /   ART & MOTION STUDY", 19, HEIGHT - 6, "#789792", 9);
  p.text(`${poseAt(seconds, action).phase}    FRAME ${Math.floor(seconds * 12).toString().padStart(4, "0")}`, 604, HEIGHT - 6, "#96b4a9", 9);
}
