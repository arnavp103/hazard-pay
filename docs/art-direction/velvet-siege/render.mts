import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { paintBattle, paintLineup, WIDTH, HEIGHT } from '../../../apps/webapp/src/velvet-siege/painting.ts';
const require = createRequire(import.meta.url);
const canvasModule = require(`${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/@napi-rs/canvas`);
Object.assign(globalThis, { Path2D: canvasModule.Path2D });
const out = new URL('.', import.meta.url).pathname;
const canvas = canvasModule.createCanvas(WIDTH, HEIGHT);
const c = canvas.getContext('2d');
const times = [2, 8.3, 15.5, 22.9, 31.8, 36];
const sheet = canvasModule.createCanvas(1600, 1350);
const sc = sheet.getContext('2d');
for (const [i, t] of times.entries()) { paintBattle(c, t); sc.drawImage(canvas, (i % 2) * 800, Math.floor(i / 2) * 450, 800, 450); }
writeFileSync(`${out}contact-sheet.png`, sheet.toBuffer('image/png'));
paintBattle(c, 15.6); writeFileSync(`${out}screenshot.png`, canvas.toBuffer('image/png'));
paintLineup(c); writeFileSync(`${out}role-lineup.png`, canvas.toBuffer('image/png'));
for (const [i, t] of [12.5, 14, 14.75, 15.2, 16.7, 18.8].entries()) { paintBattle(c, t); sc.drawImage(canvas, (i % 2) * 800, Math.floor(i / 2) * 450, 800, 450); }
writeFileSync(`${out}regent-keyposes.png`, sheet.toBuffer('image/png'));
if (process.argv.includes('--film')) {
 mkdirSync(`${out}frames`, { recursive: true });
 for(let frame = 0; frame <= 864; frame++) { paintBattle(c, frame / 24); writeFileSync(`${out}frames/${String(frame).padStart(4, '0')}.png`, canvas.toBuffer('image/png')); }
}
