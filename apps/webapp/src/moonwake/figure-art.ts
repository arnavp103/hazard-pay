import { clamp, project, ramp } from "./timeline.ts";
import type { Pose, Soldier } from "./timeline.ts";
type C = CanvasRenderingContext2D;
function shape(c: C, points: number[], fill: string, stroke = "#172d32", width = 1.2) {
  c.beginPath();
  c.moveTo(points[0]!, points[1]!);
  for (let i = 2; i < points.length; i += 2) {
    c.lineTo(points[i]!, points[i + 1]!);
  }
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  c.strokeStyle = stroke;
  c.lineWidth = width;
  c.stroke();
}
function line(c: C, a: number[], color: string, width: number) {
  c.beginPath();
  c.moveTo(a[0]!, a[1]!);
  for (let i = 2; i < a.length; i += 2) {
    c.lineTo(a[i]!, a[i + 1]!);
  }
  c.strokeStyle = color;
  c.lineWidth = width;
  c.lineCap = "round";
  c.stroke();
}
function oval(c: C, x: number, y: number, rx: number, ry: number, fill: string) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
}
/** Four directional drawings: back hides face and shield front, reveals cape and straps. */
export function drawSoldier(c: C, s: Soldier, p: Pose, time: number) {
  const captainLeap = s.id === 22 && time > 33.45 && time < 34.33 ? Math.sin((time - 33.45) / 0.88 * Math.PI) * 27 : 0;
  const ground = project(p, captainLeap);
  const back = p.dy < -0.27;
  const sign = p.dx >= 0 ? 1 : -1;
  const fallen = p.died >= 0 ? ramp(time, p.died, p.died + 0.6) : 0;
  const phase = time * 10.5 + s.id * 1.7;
  const stride = p.moving * Math.sin(phase);
  const recoil = (1 - clamp((time - p.hit) / 0.42)) * 3.5;
  c.save();
  c.translate(ground.x, ground.y);
  c.scale(s.scale, s.scale);
  if (fallen) {
    c.rotate(sign * fallen * 1.4);
    c.scale(1, 1 - fallen * 0.30);
    c.globalAlpha = 1 - fallen * 0.18;
  }
  c.scale(sign, 1);
  c.translate(-recoil, -Math.abs(stride) * 1.1);
  const ivory = s.side === "ivory";
  const light = ivory ? "#efdfb9" : "#bbded3";
  const mid = ivory ? "#aea486" : "#588f96";
  const dark = ivory ? "#485d56" : "#264a58";
  const cloth = ivory ? "#b8c2a3" : "#244753";
  // Boots, knees and visible upper leg: walking is jointed, never a whole-sprite wobble.
  for (const leg of [-1, 1]) {
    const step = leg * stride * 4;
    line(c, [leg * 4, -14, leg * 4 + step * 0.5, -7, leg * 4 + step, -1], "#162b32", 5);
    line(c, [leg * 4, -13, leg * 4 + step * 0.5, -7], mid, 3.2);
    shape(c, [leg * 4 + step - 2, -3, leg * 4 + step + 4, -3, leg * 4 + step + 5, 0, leg * 4 + step - 2, 0], dark);
  }
  const swing = Math.sin(phase * 0.7) * (p.moving ? 2.5 : 0.8);
  if (ivory && (s.kind === 3 || back)) {
    shape(c, [-7, -31, 7, -30, 10 + swing, -8, 4, -10, -1 + swing, -5, -10 + swing, -11], s.kind === 3 ? "#688c91" : cloth);
  }
  if (!ivory) {
    // Drowned troops carry scalloped carapaces, thorn shoulders and trailing kelp.
    shape(c, [-8, -25, -12, -31, -7, -29, -5, -37, 0, -31, 5, -38, 8, -29, 12, -30, 8, -22], "#80adb0");
    for (let i = 0; i < 3; i++) {
      line(c, [-5 + i * 4, -19, -9 + i * 6 + swing, -9, -5 + i * 4 + swing, -4], "#477c77", 1.2);
    }
  }
  shape(c, [-7, -29, 5, -29, 8, -16, 2, -12, -7, -17], mid);
  shape(c, [-7, -29, 1, -32, 6, -28, -1, -25], light);
  shape(c, [-1, -25, 6, -28, 8, -16, 1, -14], dark);
  line(c, [-6, -18, 5, -19], ivory ? "#c8a15a" : "#88b7a6", 2);
  // Head has a visible top plane at the elevated camera angle.
  shape(c, [-5, -39, 3, -40, 7, -36, 5, -30, -3, -30, -6, -34], light);
  shape(c, [-5, -39, 0, -42, 6, -39, 7, -36, 1, -37], ivory ? "#fff0ce" : "#d2e7d8");
  if (back) {
    shape(c, [-5, -37, 6, -37, 5, -31, -3, -30], mid);
    line(c, [-1, -36, 0, -30], dark, 1.5);
  } else {
    shape(c, [1, -36, 7, -36, 6, -32, 1, -31], "#263d40");
    line(c, [2, -35, 5, -35], ivory ? "#f2c56f" : "#d3eaae", 1);
  }
  if (s.kind === 3) {
    shape(c, [-5, -40, -7, -47, -2, -43, 1, -48, 4, -42, 8, -45, 6, -38], ivory ? "#c9a667" : "#b7d4be");
    if (!ivory) {
      shape(c, [-7, -26, 6, -26, 10, -12, -10, -12], "#a19e70");
      line(c, [-7, -13, 8, -13], "#e0c286", 2);
      oval(c, 0, -13, 3, 2, "#263d42");
    }
  }
  // Back-facing units put their near arm over a visible shoulder strap.
  if (back) {
    line(c, [-6, -28, 5, -17], ivory ? "#5b6c59" : "#87a596", 2);
  }
  const shieldCall = s.side === "ivory" && s.kind !== 1 ? ramp(time, 9.5, 10.15) * (1 - ramp(time, 10.4, 11.1)) : 0;
  const choirCall = s.id === 66 ? ramp(time, 25.5, 27) * (1 - ramp(time, 27.4, 28.2)) : 0;
  const lanternDraw = s.side === "ivory" && s.kind === 1 ? ramp(time, 17.3, 18.3) * (1 - ramp(time, 18.4 + s.id * 0.03, 18.6 + s.id * 0.03)) : 0;
  const finalCut = s.id === 22 ? ramp(time, 33.6, 34.28) * (1 - ramp(time, 34.4, 35.0)) : 0;
  const attack = Math.max(p.attack, lanternDraw, finalCut);
  const handX = 8 + attack * 10;
  const handY = -23 - attack * 3 - shieldCall * 15 - choirCall * 25 - captainLeap * 0.6;
  line(c, [4, -28, 9 + attack * 4, -23, handX, handY], mid, 4);
  oval(c, handX, handY, 2.5, 2.5, light);
  if (s.kind === 1) {
    const bx = handX + 3;
    c.beginPath();
    c.moveTo(bx, handY - 15);
    c.quadraticCurveTo(bx + 12, handY, bx, handY + 14);
    c.strokeStyle = "#c6ab75";
    c.lineWidth = 2.2;
    c.stroke();
    line(c, [bx, handY - 15, bx - attack * 7, handY, bx, handY + 14], "#dfd7ad", 0.8);
    line(c, [bx - attack * 7, handY, bx + 16, handY - 2], ivory ? "#f6d185" : "#a4e3cd", 1.3);
    if (back) {
      shape(c, [-7, -33, -2, -32, -4, -15, -9, -16], "#455d55");
    }
  } else if (s.kind === 2) {
    line(c, [handX - 13, handY + 5, handX + 20, handY - 15], "#947f5d", 2);
    shape(c, [handX + 16, handY - 16, handX + 26, handY - 20, handX + 20, handY - 10], light);
    line(c, [-4, -25, 4, -21], light, 3);
  } else {
    line(c, [handX - 3, handY + 9, handX + 6 + attack * 8, handY - 19], "#877756", 2);
    shape(c, [handX + 3 + attack * 8, handY - 18, handX + 10 + attack * 8, handY - 24, handX + 8 + attack * 8, handY - 13], light);
    if (ivory) {
      const shieldX = back ? -9 : -7;
      const shieldY = -23 + attack * 2 - shieldCall * 12;
      shape(c, [shieldX - 7, shieldY - 7, shieldX + 5, shieldY - 10, shieldX + 8, shieldY + 3, shieldX + 1, shieldY + 11, shieldX - 6, shieldY + 7], back ? "#667469" : "#e0ce9f", "#475549", 1.5);
      if (!back) {
        line(c, [shieldX, shieldY - 7, shieldX + 2, shieldY + 7], "#a08b59", 1.6);
        oval(c, shieldX + 1, shieldY, 2.5, 3, "#bd995b");
      }
    } else {
      line(c, [-7, -26, -15, -18, -18 + attack * 8, -22], "#8db4b1", 3);
    }
  }
  if (time - p.hit < 0.15 && p.hp > 0) {
    c.globalAlpha = 0.6;
    line(c, [-10, -29, 10, -18], "#ffecb1", 2);
  }
  c.restore();
}
