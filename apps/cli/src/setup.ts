import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import env from "@hazard-pay/env";
import pg from "pg";

const READY_STATE_VERSION = 1;
const DATABASE_WAIT_MS = 30_000;

interface ReadyState {
  fingerprint: string;
  version: number;
}

function fail(message: string): never {
  throw new Error(`hazard-pay setup: ${message}`);
}

function run(command: string, args: string[], cwd: string, quiet = false): void {
  const result = spawnSync(command, args, { cwd, stdio: quiet ? "ignore" : "inherit" });
  if (result.status !== 0) {
    fail(`\`${command} ${args.join(" ")}\` failed`);
  }
}

function succeeds(command: string, args: string[], cwd: string): boolean {
  return spawnSync(command, args, { cwd, stdio: "ignore" }).status === 0;
}

function checkoutRoot(): string {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return fail("run from a Hazard Pay git checkout");
  }
}

function hashTree(hash: ReturnType<typeof createHash>, directory: string): void {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      hashTree(hash, entryPath);
    } else if (entry.isFile()) {
      hash.update(entryPath).update(readFileSync(entryPath));
    }
  }
}

function fingerprint(root: string): string {
  const hash = createHash("sha256");
  hash.update(String(READY_STATE_VERSION));
  hash.update(process.version).update(os.platform()).update(os.arch());
  hash.update(env.DATABASE_URL);
  hash.update(readFileSync(path.join(root, "pnpm-lock.yaml")));
  hash.update(readFileSync(new URL(import.meta.url)));
  hashTree(hash, path.join(root, "packages/db/migrations"));
  return hash.digest("hex");
}

function readReadyState(statePath: string): ReadyState | undefined {
  if (!existsSync(statePath)) {
    return undefined;
  }
  try {
    return JSON.parse(readFileSync(statePath, "utf8")) as ReadyState;
  } catch {
    return undefined;
  }
}

async function databaseIsReady(): Promise<boolean> {
  const client = new pg.Client({ connectionString: env.DATABASE_URL });
  try {
    await client.connect();
    const result = await client.query<{ rolcreatedb: boolean }>(
      "select rolcreatedb from pg_roles where rolname = current_user",
    );
    if (result.rows[0]?.rolcreatedb !== true) {
      fail("the DATABASE_URL role needs CREATEDB for the test suite");
    }
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("hazard-pay setup:")) {
      throw error;
    }
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}

function startDatabase(root: string): void {
  if (succeeds("docker", ["compose", "version"], root)) {
    run("docker", ["compose", "up", "-d", "--wait"], root);
    return;
  }
  if (!succeeds("pg_lsclusters", ["--no-header"], root)) {
    return;
  }
  const clusters = execFileSync("pg_lsclusters", ["--no-header"], { encoding: "utf8" });
  for (const line of clusters.trim().split("\n")) {
    const [version, name] = line.trim().split(/\s+/);
    if (version === undefined || name === undefined) {
      continue;
    }
    if (!succeeds("sudo", ["-n", "pg_ctlcluster", version, name, "start"], root)) {
      succeeds("pg_ctlcluster", [version, name, "start"], root);
    }
  }
}

async function waitForDatabase(): Promise<void> {
  const deadline = Date.now() + DATABASE_WAIT_MS;
  while (Date.now() < deadline) {
    if (await databaseIsReady()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  fail(`PostgreSQL at ${env.DATABASE_URL} is not ready; start Docker Compose or provision a CREATEDB-capable DATABASE_URL`);
}

function verifyToolchain(root: string): void {
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  if (nodeMajor < 22) {
    fail(`Node ${process.version} is unsupported (Node >=22 is required)`);
  }
  let pnpmVersion: string;
  try {
    pnpmVersion = execFileSync("pnpm", ["--version"], { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return fail("pnpm is missing (enable Corepack, then install pnpm 11.11.0)");
  }
  if (pnpmVersion !== "11.11.0") {
    fail(`pnpm ${pnpmVersion} is unsupported (11.11.0 is required)`);
  }
}

export async function setup(options: { force: boolean }): Promise<void> {
  const root = checkoutRoot();
  verifyToolchain(root);
  const expectedFingerprint = fingerprint(root);
  const statePath = path.join(root, "node_modules/.cache/hazard-pay/setup.json");
  const ready = readReadyState(statePath);
  const stateIsCurrent = !options.force
    && ready?.version === READY_STATE_VERSION
    && ready.fingerprint === expectedFingerprint;

  if (stateIsCurrent && await databaseIsReady()) {
    console.log("Hazard Pay setup is already current; nothing to do.");
    return;
  }

  console.log("Preparing PostgreSQL...");
  if (!await databaseIsReady()) {
    startDatabase(root);
    await waitForDatabase();
  }

  if (!stateIsCurrent) {
    console.log("Installing the headless browser...");
    const browserArgs = os.platform() === "linux"
      ? ["exec", "agent-browser", "install", "--with-deps"]
      : ["exec", "agent-browser", "install"];
    run("pnpm", browserArgs, root);
  }

  console.log("Applying development migrations...");
  run("pnpm", ["--filter", "@hazard-pay/db", "db:migrate"], root);

  mkdirSync(path.dirname(statePath), { recursive: true });
  writeFileSync(statePath, `${JSON.stringify({ fingerprint: expectedFingerprint, version: READY_STATE_VERSION })}\n`);
  console.log("Hazard Pay is ready.");
}
