import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { paintBattle, paintLineup, WIDTH, HEIGHT, DURATION } from '../../../apps/webapp/src/velvet-siege/painting.ts';
const require = createRequire(import.meta.url);
const canvasModule = require(`${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/@napi-rs/canvas`);
Object.assign(globalThis, { Path2D: canvasModule.Path2D });
const out = new URL('.', import.meta.url).pathname;
const canvas = canvasModule.createCanvas(WIDTH, HEIGHT);
const c = canvas.getContext('2d');
const sheet = canvasModule.createCanvas(1600, 1350);
const sc = sheet.getContext('2d');
for (const [i, t] of [2, 10.9, 19.9, 27.9, 35.9, 42].entries()) { paintBattle(c, t); sc.drawImage(canvas, (i % 2) * 800, Math.floor(i / 2) * 450, 800, 450); }
writeFileSync(`${out}contact-sheet.png`, sheet.toBuffer('image/png'));
paintBattle(c, 27.9); writeFileSync(`${out}screenshot.png`, canvas.toBuffer('image/png'));
writeFileSync(`${out}battle.webp`, canvas.toBuffer('image/webp', 55));
paintLineup(c); writeFileSync(`${out}role-lineup.png`, canvas.toBuffer('image/png'));
for (const [i, t] of [17.5, 19, 19.7, 20.8, 23, 27.9].entries()) { paintBattle(c, t); sc.drawImage(canvas, (i % 2) * 800, Math.floor(i / 2) * 450, 800, 450); }
writeFileSync(`${out}regent-keyposes.png`, sheet.toBuffer('image/png'));
writeFileSync(`${out}setpiece.webp`, sheet.toBuffer('image/webp', 40));
if (process.argv.includes('--film')) {
 const film = canvasModule.createCanvas(1280, 720); const fc = film.getContext('2d');
 const ffmpeg = spawn('ffmpeg', ['-y', '-f', 'rawvideo', '-pixel_format', 'rgba', '-video_size', '1280x720', '-framerate', '24', '-i', '-', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${out}velvet-siege-25d-full.mp4`], { stdio: ['pipe', 'ignore', 'inherit'] });
 const completed = once(ffmpeg, 'close');
 for (let frame = 0; frame < DURATION * 24; frame++) { paintBattle(fc, frame / 24, 1280, 720); if (!ffmpeg.stdin.write(Buffer.from(fc.getImageData(0, 0, 1280, 720).data))) { await once(ffmpeg.stdin, 'drain'); } }
 ffmpeg.stdin.end(); const [code] = await completed; if (code !== 0) { throw new Error(`ffmpeg exited ${code}`); }
}
