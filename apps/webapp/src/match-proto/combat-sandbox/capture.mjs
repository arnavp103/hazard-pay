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
  ["crowd-motion", "view=crowd&start=6"],
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

/**
 * Runs JS in the page and returns its value.
 *
 * `--json` because the plain output re-serialises strings with quotes, and a
 * base64 PNG that silently keeps its quotes writes a corrupt file.
 */
function evaluate(script) {
  const raw = browser(["eval", "--json", script], { quiet: true }).trim();
  const envelope = JSON.parse(raw);
  if (envelope.success !== true) {
    throw new Error(`eval failed: ${JSON.stringify(envelope.error)}`);
  }
  return envelope.data.result;
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

/**
 * Opens a sandbox URL and waits for the page to publish its capture bridge.
 *
 * `freeze` matters more than it looks. Without it the page runs a
 * requestAnimationFrame loop, and since `renderAt` only ever moves the
 * fixed-step clock FORWARD, every frame a GIF asks for is already in the past
 * by the time the eval lands — so the frames come out at eval-latency spacing
 * wherever the live loop happens to be, not at the times requested. Callers
 * that drive `renderAt` themselves must pass `freeze`.
 */
/**
 * Cache buster, unique per process and per shot (#100).
 *
 * Two failure modes, both silent, both fixed by making every navigation go to
 * a URL the browser has never seen:
 *
 *  - `open` returns before the new document has loaded, so polling for
 *    `typeof window.__combatSandbox === 'object'` passes instantly against the
 *    page being left. Every shot after the first then wrote the PREVIOUS
 *    shot's pixels, at the previous shot's canvas size — shots differing only
 *    in query string came out byte-identical.
 *  - Re-opening the URL the page is already on does not navigate at all, so a
 *    bridge cleared before the open never comes back and every subsequent
 *    `renderAt` throws `Cannot read properties of undefined`.
 *
 * The parameter is ignored by the route, so it changes navigation and nothing
 * else; the same command still produces the same pixels.
 */
const RUN = Date.now().toString(36);
let shotOrdinal = 0;

function openShot(base, query, scale, extra = "") {
  const separator = query.includes("scale=") || scale === 1 ? "" : `&scale=${scale}`;
  const url = `${base}/combat-sandbox?capture=1&${query}${separator}${extra}`;
  shotOrdinal += 1;
  const stamp = `${RUN}-${shotOrdinal}`;
  browser(["open", `${url}&_shot=${stamp}`], { quiet: true });
  // The readiness test asks for THIS shot's page, not just any page with a
  // bridge on it. Testing the bridge alone passes against the page being left.
  const ready = `location.search.includes("_shot=${stamp}") && typeof window.__combatSandbox === "object"`;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    execFileSync("agent-browser", ["wait", "250"], { stdio: "ignore" });
    if (evaluate(ready) === true) {
      return url;
    }
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
  // Freeze the page so the clock only moves when we move it.
  const url = openShot(base, query, options.scale, query.includes("freeze=") ? "" : "&freeze=0");
  // A shot may open mid-fight with `start=`; the clock cannot rewind, so the
  // first frame is whichever is later, the requested --from or where we are.
  const opened = evaluate("window.__combatSandbox.simTime()");
  const base0 = Math.max(options.from, opened);
  const frameDir = join(out, `.frames-${name}`);
  mkdirSync(frameDir, { recursive: true });
  for (let i = 0; i < options.frames; i += 1) {
    const at = base0 + i / options.fps;
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
  console.log(`  ${name}.gif  <-  ${url}  (${options.frames} frames @ ${options.fps} fps from ${base0.toFixed(2)}s)`);
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
  const cost = evaluate("window.__combatSandbox.cost()");
  writeFileSync(join(options.out, "cost-report.json"), `${JSON.stringify(cost, null, 2)}\n`);
  console.log("  cost-report.json");

  browser(["close"], { quiet: true });
}

main().catch((error) => {
  console.error(`capture failed: ${error.message}`);
  process.exitCode = 1;
});
