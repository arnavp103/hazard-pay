#!/usr/bin/env node
/**
 * THROWAWAY SCAFFOLDING (#96): the capture path for the combat sandbox.
 *
 * Implements the inner-loop ruling from #67: `agent-browser` driving the page
 * over **WebGL** (ANGLE/SwiftShader supplies the software renderer in headless
 * Chromium). WebGPU is deliberately not used — #67 found it unnecessary for
 * the asset-side harness and #26 flagged headless-WebGL flakiness that this
 * path is known to survive.
 *
 * Frames come from `window.__combatSandbox.renderAt(seconds)` — the same
 * fixed-step integrator the live page runs — rather than from element
 * screenshots. So a capture is pixel-exact, cannot be scaled by CSS, and
 * cannot drift from what a human sees on the same URL.
 *
 * ## Use
 *
 *   pnpm --filter @hazard-pay/webapp dev            # in another terminal
 *   node capture.mjs --out /tmp/gallery
 *
 * With no --shot/--gif it writes the default gallery: crowd still, crowd GIF,
 * crowd filmstrip, lineup, and cost-report.json.
 *
 *   --out <dir>         output directory (default ./captures/combat-sandbox)
 *   --url <base>        dev server (default http://localhost:5173)
 *   --shot name=<qs>    one still; repeatable
 *   --gif name=<qs>     an animated GIF; repeatable
 *   --frames <n>        frames per GIF (default 48)
 *   --fps <n>           GIF frame rate (default 12)
 *   --from <s>          sim second a GIF starts at (default 0)
 *   --scale <n>         canvas multiplier applied to every shot (default 1)
 *   --keep-frames       keep the individual GIF frames on disk
 *
 * GIF assembly needs `ffmpeg` on PATH. Without it the frames are kept and the
 * GIF is skipped with a clear message — the stills still land.
 *
 * This is throwaway scaffolding, not a build step. Nothing imports it.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DEFAULTS = {
  fps: 12,
  frames: 48,
  from: 0,
  out: "./captures/combat-sandbox",
  scale: 1,
  url: "http://localhost:5173",
};

const DEFAULT_SHOTS = [
  ["crowd-still", "view=crowd&freeze=9000"],
  ["crowd-still-2x", "view=crowd&freeze=9000&scale=2"],
  ["lineup", "view=lineup&scale=2&freeze=2000"],
  ["filmstrip-crowd", "view=crowd&strip=24&fps=12&from=6000&cols=6"],
];

const DEFAULT_GIFS = [
  ["crowd-motion", "view=crowd"],
];

const USAGE = `node capture.mjs [options]

  --out <dir>         output directory (default ${DEFAULTS.out})
  --url <base>        dev server (default ${DEFAULTS.url})
  --shot name=<qs>    one still; repeatable
  --gif name=<qs>     an animated GIF; repeatable
  --frames <n>        frames per GIF (default ${DEFAULTS.frames})
  --fps <n>           GIF frame rate (default ${DEFAULTS.fps})
  --from <s>          sim second a GIF starts at (default ${DEFAULTS.from})
  --scale <n>         canvas multiplier (default ${DEFAULTS.scale})
  --keep-frames       keep the individual GIF frames on disk`;

const FLAGS = new Map([
  ["--out", (options, value) => { options.out = value; }],
  ["--url", (options, value) => { options.url = value; }],
  ["--frames", (options, value) => { options.frames = Number(value); }],
  ["--fps", (options, value) => { options.fps = Number(value); }],
  ["--from", (options, value) => { options.from = Number(value); }],
  ["--scale", (options, value) => { options.scale = Number(value); }],
]);

function parsePair(flag, raw) {
  const at = raw.indexOf("=");
  if (at < 0) {
    throw new Error(`${flag} wants name=<query string>, got: ${raw}`);
  }
  return [raw.slice(0, at), raw.slice(at + 1)];
}

function parseArgs(argv) {
  const options = { ...DEFAULTS, gifs: [], help: false, keepFrames: false, shots: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const takesValue = FLAGS.get(arg);
    if (takesValue !== undefined) {
      i += 1;
      takesValue(options, argv[i]);
      continue;
    }
    if (arg === "--keep-frames") {
      options.keepFrames = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--shot" || arg === "--gif") {
      i += 1;
      const pair = parsePair(arg, argv[i] ?? "");
      (arg === "--shot" ? options.shots : options.gifs).push(pair);
      continue;
    }
    throw new Error(`unknown option: ${arg}`);
  }
  return options;
}

function browser(args, { quiet = false } = {}) {
  return execFileSync("agent-browser", args, {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    stdio: quiet ? ["ignore", "pipe", "ignore"] : ["ignore", "pipe", "inherit"],
  });
}

/** Runs JS in the page and returns its value as a string. */
function evaluate(script) {
  return browser(["eval", script], { quiet: true }).trim();
}

function has(command) {
  try {
    execFileSync("which", [command], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function writeDataUrl(dataUrl, path) {
  const comma = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:image/png;base64,") || comma < 0) {
    throw new Error(`expected a PNG data URL, got ${dataUrl.slice(0, 48)}...`);
  }
  writeFileSync(path, Buffer.from(dataUrl.slice(comma + 1), "base64"));
}

/** Opens a sandbox URL and waits for the page to publish its capture bridge. */
function openShot(base, query, scale) {
  const separator = query.includes("scale=") || scale === 1 ? "" : `&scale=${scale}`;
  const url = `${base}/combat-sandbox?capture=1&${query}${separator}`;
  browser(["open", url], { quiet: true });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const ready = evaluate("typeof window.__combatSandbox === 'object'");
    if (ready.includes("true")) {
      return url;
    }
    execFileSync("agent-browser", ["wait", "250"], { stdio: "ignore" });
  }
  throw new Error(`page never published window.__combatSandbox: ${url}`);
}

function still(base, out, name, query, scale) {
  const url = openShot(base, query, scale);
  const path = join(out, `${name}.png`);
  writeDataUrl(evaluate("window.__combatSandbox.png()"), path);
  console.log(`  ${name}.png  <-  ${url}`);
  return path;
}

function gif(base, out, name, query, options) {
  const url = openShot(base, query, options.scale);
  const frameDir = join(out, `.frames-${name}`);
  mkdirSync(frameDir, { recursive: true });
  for (let i = 0; i < options.frames; i += 1) {
    const at = options.from + i / options.fps;
    writeDataUrl(
      evaluate(`(() => { window.__combatSandbox.renderAt(${at}); return window.__combatSandbox.png(); })()`),
      join(frameDir, `${String(i).padStart(4, "0")}.png`),
    );
  }
  if (!has("ffmpeg")) {
    console.log(`  ${name}: ffmpeg not on PATH — frames kept in ${frameDir}`);
    return;
  }
  const path = join(out, `${name}.gif`);
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error",
    "-framerate", String(options.fps),
    "-i", join(frameDir, "%04d.png"),
    "-filter_complex", "[0:v]split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer",
    path,
  ]);
  if (!options.keepFrames) {
    rmSync(frameDir, { force: true, recursive: true });
  }
  console.log(`  ${name}.gif  <-  ${url}  (${options.frames} frames @ ${options.fps} fps)`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(USAGE);
    return;
  }
  if (!has("agent-browser")) {
    throw new Error("agent-browser is not on PATH — it is the capture path ruled in #67");
  }

  const response = await fetch(`${options.url}/combat-sandbox`).catch(() => undefined);
  if (response === undefined) {
    throw new Error(
      `no dev server at ${options.url}. Run: pnpm --filter @hazard-pay/webapp dev`,
    );
  }

  mkdirSync(options.out, { recursive: true });
  const shots = options.shots.length > 0 || options.gifs.length > 0
    ? options.shots
    : DEFAULT_SHOTS;
  const gifs = options.shots.length > 0 || options.gifs.length > 0
    ? options.gifs
    : DEFAULT_GIFS;

  console.log(`capturing into ${options.out}`);
  for (const [name, query] of shots) {
    still(options.url, options.out, name, query, options.scale);
  }
  for (const [name, query] of gifs) {
    gif(options.url, options.out, name, query, options);
  }

  // The cost report is evidence, not decoration: crowd-scale draw calls and
  // frame budget are half of what a lane is judged on.
  openShot(options.url, "view=crowd&freeze=9000", options.scale);
  const cost = evaluate("JSON.stringify(window.__combatSandbox.cost())");
  writeFileSync(join(options.out, "cost-report.json"), `${cost}\n`);
  console.log("  cost-report.json");

  browser(["close"], { quiet: true });
}

main().catch((error) => {
  console.error(`capture failed: ${error.message}`);
  process.exitCode = 1;
});
