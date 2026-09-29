import { drawSoldier } from "./figure-art.ts";
import { battleAt, chapterAt, clamp, DURATION, obstacles, project, soldiers } from "./timeline.ts";
import type { Point } from "./timeline.ts";
export const WIDTH = 1600;
export const HEIGHT = 900;
type C = CanvasRenderingContext2D;
function poly(c: C, points: number[], color: string, stroke?: string) {
  c.beginPath();
  c.moveTo(points[0]!, points[1]!);
  for (let i = 2; i < points.length; i += 2) {
    c.lineTo(points[i]!, points[i + 1]!);
  }
  c.closePath();
  c.fillStyle = color;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = 1;
    c.stroke();
  }
}
function line(c: C, pts: number[], color: string, width = 1) {
  c.beginPath();
  c.moveTo(pts[0]!, pts[1]!);
  for (let i = 2; i < pts.length; i += 2) {
    c.lineTo(pts[i]!, pts[i + 1]!);
  }
  c.strokeStyle = color;
  c.lineWidth = width;
  c.stroke();
}
function ellipse(c: C, x: number, y: number, rx: number, ry: number, fill: string) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
}
function random(n: number) {
  const k = Math.sin(n * 127.13 + 31.73) * 43758.5453;
  return k - Math.floor(k);
}
function ring(c: C, p: Point, radius: number, color: string, width = 1) {
  const q = project(p);
  c.beginPath();
  c.ellipse(q.x, q.y, radius * 0.91, radius * 0.60, 0, 0, Math.PI * 2);
  c.strokeStyle = color;
  c.lineWidth = width;
  c.stroke();
}
function groundPoly(c: C, points: Point[], fill: string, stroke?: string) {
  poly(c, points.flatMap((p) => {
    const q = project(p);
    return [q.x, q.y];
  }), fill, stroke);
}
function block(c: C, x: number, y: number, w: number, d: number, h: number, light = "#929c88") {
  const a = project({ x: x - w / 2, y: y - d / 2 });
  const b = project({ x: x + w / 2, y: y - d / 2 });
  const e = project({ x: x + w / 2, y: y + d / 2 });
  const f = project({ x: x - w / 2, y: y + d / 2 });
  poly(c, [f.x, f.y - h, e.x, e.y - h, e.x, e.y, f.x, f.y], "#536c69", "#294c50");
  poly(c, [e.x, e.y - h, b.x, b.y - h, b.x, b.y, e.x, e.y], "#354f53", "#294c50");
  poly(c, [a.x, a.y - h, b.x, b.y - h, e.x, e.y - h, f.x, f.y - h], light, "#b8bca055");
  for (let z = 13; z < h; z += 14) {
    line(c, [f.x, f.y - z, e.x, e.y - z], "#263f433d");
  }
}
let terrain: OffscreenCanvas | HTMLCanvasElement | undefined;
function paintTerrain(c: C) {
  const wash = c.createLinearGradient(0, 0, 1500, 900);
  wash.addColorStop(0, "#526b61");
  wash.addColorStop(0.4, "#374f4b");
  wash.addColorStop(1, "#223b43");
  c.fillStyle = wash;
  c.fillRect(0, 0, WIDTH, HEIGHT);
  // Ground covers the frame. Water occupies corners, not a distant horizon.
  for (let i = 0; i < 900; i++) {
    const x = random(i * 5) * 1750 - 80;
    const y = random(i * 5 + 1) * 1450 - 80;
    const q = project({ x, y });
    ellipse(c, q.x, q.y, 5 + random(i) * 37, 3 + random(i + 2) * 14, ["#5b6e5b38", "#192f343c", "#81907618"][i % 3]!);
  }
  groundPoly(c, [{ x: -100, y: -90 }, { x: 550, y: -90 }, { x: 510, y: 60 }, { x: 340, y: 170 }, { x: 230, y: 330 }, { x: 40, y: 385 }, { x: -100, y: 340 }], "#1b3c48", "#6d8e8066");
  groundPoly(c, [{ x: 1160, y: 1400 }, { x: 1150, y: 1170 }, { x: 1240, y: 1060 }, { x: 1330, y: 1000 }, { x: 1460, y: 1020 }, { x: 1540, y: 820 }, { x: 1700, y: 800 }, { x: 1700, y: 1400 }], "#173541", "#62867c77");
  // Branching, broken paths cross the field diagonally; no theatrical horizontal lanes.
  for (let trail = 0; trail < 3; trail++) {
    for (let col = 0; col < 39; col++) {
      for (let row = 0; row < 3; row++) {
        const x = col * 44 + (row % 2) * 17 - 55;
        const y = trail === 0 ? 1140 - col * 24 + Math.sin(col * 0.14) * 70 + row * 24 : trail === 1 ? 200 + col * 22 + Math.sin(col * 0.21) * 68 + row * 24 : 685 + Math.sin(col * 0.17) * 130 + row * 24;
        const n = col * 4 + row + trail * 197;
        if (random(n) < 0.25) {
          continue;
        }
        groundPoly(c, [{ x, y }, { x: x + 38, y: y + 2 }, { x: x + 36, y: y + 20 }, { x: x - 2, y: y + 19 }], ["#627568", "#6b7b6b", "#566d63", "#77816d"][Math.floor(random(n + 1) * 4)]!, "#304d49");
        if (random(n + 2) > 0.7) {
          const q = project({ x: x + 10, y: y + 6 });
          line(c, [q.x, q.y, q.x + 12, q.y + 4, q.x + 16, q.y + 13], "#344f4a", 0.8);
        }
      }
    }
  }
  // Drowned circular floor: broken tesserae, geometric emblem, moss seams.
  const centre = { x: 815, y: 655 };
  const q = project(centre);
  ellipse(c, q.x, q.y, 212, 143, "#647469");
  ring(c, centre, 225, "#a2a58a66", 5);
  ring(c, centre, 206, "#394f49", 2);
  ring(c, centre, 171, "#a2a58a66", 2);
  for (let i = 0; i < 28; i++) {
    const a = i * Math.PI / 14;
    const p = project({ x: centre.x + Math.cos(a) * 215, y: centre.y + Math.sin(a) * 215 });
    const p2 = project({ x: centre.x + Math.cos(a) * 172, y: centre.y + Math.sin(a) * 172 });
    line(c, [p.x, p.y, p2.x, p2.y], "#2b494855", 1);
  }
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    groundPoly(c, [{ x: 815, y: 655 }, { x: 815 + Math.cos(a - 0.11) * 128, y: 655 + Math.sin(a - 0.11) * 128 }, { x: 815 + Math.cos(a) * 167, y: 655 + Math.sin(a) * 167 }, { x: 815 + Math.cos(a + 0.11) * 128, y: 655 + Math.sin(a + 0.11) * 128 }], "#a3a78960");
  }
  for (const o of obstacles) {
    const p = project(o);
    ellipse(c, p.x + 17, p.y + 10, o.radius * 1.12, o.radius * 0.62, "#142d3655");
    if (o.kind === "ruin") {
      ellipse(c, p.x, p.y, o.radius * 0.91, o.radius * 0.60, "#244249");
      ring(c, o, o.radius, "#839384", 5);
      ring(c, o, o.radius - 15, "#4e706b", 2);
    }
  }
  for (let i = 0; i < 1700; i++) {
    const x = random(i * 7 + 9) * 1690 - 35;
    const y = random(i * 7 + 10) * 1380 - 20;
    const p = project({ x, y });
    if (i % 3 === 0) {
      line(c, [p.x - 3, p.y + 2, p.x - 1, p.y - 4, p.x + 1, p.y, p.x + 5, p.y - 3], "#81987542", 1);
    } else {
      ellipse(c, p.x, p.y, 1.5 + random(i + 11) * 2, 0.7, "#b4b89a23");
    }
  }
  for (let i = 0; i < 140; i++) {
    const x = random(i + 523) * 420;
    const y = random(i + 876) * 220;
    const p = project({ x, y });
    line(c, [p.x, p.y, p.x + 8 + random(i) * 30, p.y], "#80a49a30", 0.8);
  }
}
function background(c: C) {
  if (!terrain) {
    if (typeof OffscreenCanvas !== "undefined") {
      terrain = new OffscreenCanvas(WIDTH, HEIGHT);
    } else if (typeof document !== "undefined") {
      terrain = document.createElement("canvas");
      terrain.width = WIDTH;
      terrain.height = HEIGHT;
    }
    const tc = terrain?.getContext("2d") as C | undefined;
    if (tc) {
      paintTerrain(tc);
    }
  }
  if (terrain) {
    c.drawImage(terrain, 0, 0);
  } else {
    paintTerrain(c);
  }
}
function drawTree(c: C, p: Point, size: number) {
  const q = project(p);
  line(c, [q.x, q.y, q.x - 3, q.y - size * 0.7, q.x + 7, q.y - size], "#263e40", 9);
  for (let i = 0; i < 9; i++) {
    const x = q.x + Math.sin(i * 5) * 25;
    const y = q.y - size * 0.62 - random(i + p.x) * 30;
    poly(c, [x - 25, y + 9, x - 20, y - 9, x, y - 23, x + 20, y - 13, x + 31, y + 6, x + 7, y + 16], i % 2 ? "#708477" : "#496b64", "#264b4b");
    line(c, [x - 12, y - 4, x + 2, y - 11, x + 15, y - 5], "#a3b29a55", 1.5);
  }
}
export function paintMoonwake(c: C, time: number, width = WIDTH, height = HEIGHT) {
  time = clamp(time, 0, DURATION);
  c.save();
  c.setTransform(width / WIDTH, 0, 0, height / HEIGHT, 0, 0);
  background(c);
  const battle = battleAt(time);
  // All shadows remain on ground; feet determine sorting, never the head or airborne height.
  for (const s of soldiers) {
    const p = battle.units[s.id]!;
    const q = project(p);
    ellipse(c, q.x + 3, q.y + 2, (p.hp <= 0 ? 17 : 12) * s.scale, 4.3 * s.scale, "#0b27347a");
  }
  const events: { y: number; draw: () => void }[] = [];
  for (const o of obstacles) {
    if (o.kind === "tree") {
      events.push({ y: o.y, draw: () => drawTree(c, o, o.height) });
    } else if (o.kind === "pillar") {
      events.push({ y: o.y + 18, draw: () => {
        block(c, o.x, o.y, 50, 40, 12);
        block(c, o.x, o.y, 29, 27, o.height);
        block(c, o.x, o.y, 41, 35, o.height + 7, "#b7b79b");
        const p = project(o, o.height);
        line(c, [p.x - 8, p.y + 16, p.x - 6, p.y + 49, p.x + 5, p.y + 60], "#3d5553", 1.6);
      } });
    } else {
      for (let i = 0; i < 9; i++) {
        const a = i * Math.PI * 2 / 9;
        const x = o.x + Math.cos(a) * (o.radius - 7);
        const y = o.y + Math.sin(a) * (o.radius - 7);
        events.push({ y: y + 17, draw: () => {
          block(c, x, y, 40, 34, i % 3 === 0 ? o.height : i % 3 === 1 ? 28 : 48, i % 2 ? "#899480" : "#9ca38a");
          if (i % 3 === 0) {
            const p = project({ x, y });
            line(c, [p.x - 8, p.y - 20, p.x - 7, p.y - o.height + 11], "#294b4e", 4);
          }
        } });
      }
    }
  }
  for (const s of soldiers) {
    const p = battle.units[s.id]!;
    events.push({ y: p.y, draw: () => drawSoldier(c, s, p, time) });
  }
  events.sort((a, b) => a.y - b.y);
  for (const item of events) {
    item.draw();
  }
  // Three-company crescent pulse: it sweeps the ground plane, without a camera change.
  if (time > 10.2 && time < 14.7) {
    for (const y of [235, 650, 1090]) {
      const r = (time - 10.2) * 143;
      c.save();
      c.globalAlpha = clamp((14.7 - time) / 1.2) * 0.85;
      const p = project({ x: 545, y });
      c.beginPath();
      c.ellipse(p.x, p.y, r * 0.91, r * 0.60, 0, -0.83, 0.83);
      c.strokeStyle = "#e5d09c";
      c.lineWidth = 3;
      c.stroke();
      c.lineWidth = 1;
      c.strokeStyle = "#fcf0c466";
      c.stroke();
      c.restore();
    }
  }
  // Telegraph, impact rings, and split expanding tides remain readable among the troops.
  const volleyTargets = battleAt(21).units;
  for (let n = 0; n < 32; n++) {
    const hit = 20.8 + n * 0.052;
    const p = volleyTargets[44 + n % 44]!;
    const dt = time - hit;
    if (dt > -1.5 && dt < 0) {
      c.save();
      c.globalAlpha = 0.38;
      ring(c, p, 14, "#f5dfae", 1);
      c.restore();
    }
    if (dt >= 0 && dt < 0.9) {
      c.save();
      c.globalAlpha = 1 - dt / 0.9;
      ring(c, p, 9 + dt * 37, "#eed4a0", 2);
      const q = project(p);
      for (let k = 0; k < 5; k++) {
        const a = k * 1.25 + n;
        line(c, [q.x + Math.cos(a) * dt * 24, q.y + Math.sin(a) * dt * 14 - Math.sin(dt * Math.PI) * 26, q.x + Math.cos(a) * dt * 24 + 2, q.y + Math.sin(a) * dt * 14 - Math.sin(dt * Math.PI) * 26 + 4], "#ffddb0", 2);
      }
      c.restore();
    }
  }
  if (time > 27 && time < 32.7) {
    const source = battleAt(27).units[66]!;
    for (let n = 0; n < 3; n++) {
      const progress = time - 27 - n * 0.45;
      if (progress <= 0) {
        continue;
      }
      c.save();
      c.globalAlpha = clamp((32.7 - time) / 1.2) * 0.65;
      ring(c, source, progress * 106, "#94c8c1", 3 - n * 0.7);
      c.restore();
    }
    for (let i = 0; i < 44; i++) {
      const p = battle.units[i]!;
      if (p.hp <= 0) {
        continue;
      }
      const q = project(p);
      if (Math.sin(time * 9 + i) > 0.4) {
        line(c, [q.x - 9, q.y - 19, q.x - 14, q.y - 33], "#c5e0d4aa", 1.3);
      }
    }
  }
  const finalImpact = time - 824 / 24;
  if (finalImpact >= 0 && finalImpact < 1.2) {
    const p = battle.units[66]!;
    const q = project(p);
    c.save();
    c.globalAlpha = 1 - finalImpact / 1.2;
    ring(c, p, 12 + finalImpact * 75, "#f9e7ae", 2.5);
    for (let i = 0; i < 11; i++) {
      const angle = i * 2.4;
      const x = q.x + Math.cos(angle) * finalImpact * 58;
      const y = q.y + Math.sin(angle) * finalImpact * 30 - Math.sin(finalImpact / 1.2 * Math.PI) * 45;
      poly(c, [x, y, x + 5, y - 3, x + 8, y + 3, x + 2, y + 4], "#dcc285");
    }
    c.restore();
  }
  for (const arrow of battle.projectiles) {
    const t = arrow.progress;
    const ground = { x: arrow.from.x + (arrow.to.x - arrow.from.x) * t, y: arrow.from.y + (arrow.to.y - arrow.from.y) * t };
    const h = Math.sin(t * Math.PI) * (arrow.volley ? 135 : 60) + 25 * (1 - t);
    const p = project(ground, h);
    const shadow = project(ground);
    ellipse(c, shadow.x, shadow.y, 3, 1.3, "#112e3638");
    const dx = arrow.to.x - arrow.from.x;
    const dy = (arrow.to.y - arrow.from.y) * 0.60 - Math.cos(t * Math.PI) * (arrow.volley ? 190 : 80);
    const len = Math.hypot(dx, dy);
    line(c, [p.x - dx / len * 12, p.y - dy / len * 12, p.x, p.y], arrow.side === "ivory" ? "#e8c88e" : "#a3dfcf", arrow.volley ? 2 : 1.3);
    if (arrow.volley) {
      ellipse(c, p.x, p.y, 3.1, 3.1, "#ffddb3");
    }
  }
  // Small world-space standards, not screen-filling hero portraits.
  if (time < 7 || time > 36) {
    for (const id of [22, 66]) {
      const p = battle.units[id]!;
      if (p.hp <= 0) {
        continue;
      }
      const q = project(p);
      ring(c, p, 24, id === 22 ? "#d8bc77aa" : "#83b6b499", 1);
      line(c, [q.x, q.y - 78, q.x, q.y - 86], id === 22 ? "#e6cca0" : "#91c7c2", 2);
    }
  }
  // Compact HUD is outside the field's visual hierarchy.
  c.fillStyle = "#122d35e8";
  c.fillRect(24, 22, 361, 57);
  c.fillStyle = "#e4d7b0";
  c.font = "17px Georgia";
  c.fillText("MOONWAKE / THE DROWNED CLOISTER", 39, 46);
  c.fillStyle = "#a5b8a3";
  c.font = "10px sans-serif";
  c.fillText(`${soldiers.filter((s) => s.side === "ivory" && battle.units[s.id]!.hp > 0).length} IVORY  ·  ${soldiers.filter((s) => s.side === "tide" && battle.units[s.id]!.hp > 0).length} TIDE`, 39, 65);
  c.fillStyle = "#142e36e8";
  c.fillRect(1175, 23, 401, 55);
  c.fillStyle = "#dccdaa";
  c.font = "17px Georgia";
  c.fillText(chapterAt(time).name, 1191, 46);
  c.fillStyle = "#9cae9c";
  c.font = "10px monospace";
  c.fillText(`${time.toFixed(1).padStart(4, "0")} / 42.0`, 1191, 64);
  c.restore();
}
