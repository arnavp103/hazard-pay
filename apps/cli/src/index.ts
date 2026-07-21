import { cac } from "cac";
import env from "@hazard-pay/env";
import { DEFAULT_TIMEOUT_MINUTES, prWatch } from "./pr-watch.ts";
import { tasks } from "./tasks.ts";
import { worktreeClean, worktreeNew } from "./worktree.ts";

const cli = cac("hazard-pay");

/** Env vars whose values must never be printed, only shown as "[set]". */
function isSecretName(name: string): boolean {
  return /KEY|SECRET|TOKEN|PASSWORD/i.test(name);
}

cli
  .command("env", "Print the resolved environment (secret values redacted)")
  .action(() => {
    const redacted = Object.fromEntries(Object.entries(env).map(([key, value]) => [
      key,
      isSecretName(key) && typeof value === "string" && value !== "" ? "[set]" : value,
    ]));
    console.log(JSON.stringify(redacted, null, 2));
  });

cli
  .command(
    "worktree <action> [name]",
    "Manage agent worktrees (actions: new <branch>, clean)",
  )
  .option("--dry-run", "With clean: only report what would be removed")
  .example("hazard-pay worktree new issue-42-fix-thing")
  .example("hazard-pay worktree clean --dry-run")
  .action((action: string, name: string | undefined, options: { dryRun?: boolean }) => {
    switch (action) {
      case "new":
        worktreeNew(name);
        break;
      case "clean":
        if (name !== undefined) {
          console.error(`hazard-pay worktree: clean takes no name argument (got "${name}")`);
          process.exit(1);
        }
        worktreeClean({ dryRun: options.dryRun === true });
        break;
      default:
        console.error(`hazard-pay worktree: unknown action "${action}" (expected "new" or "clean")`);
        process.exit(1);
    }
  });

cli
  .command("pr <action> [number]", "Manage PRs (actions: watch [number])")
  .option("--timeout <minutes>", "With watch: give up after this many minutes", { default: DEFAULT_TIMEOUT_MINUTES })
  .example("hazard-pay pr watch")
  .example("hazard-pay pr watch 42 --timeout 20")
  .action((action: string, number: string | undefined, options: { timeout: number }) => {
    switch (action) {
      case "watch": {
        const parsedNumber = number === undefined ? undefined : Number(number);
        if (parsedNumber !== undefined && !Number.isInteger(parsedNumber)) {
          console.error(`hazard-pay pr watch: invalid PR number "${number}"`);
          process.exit(1);
        }
        void prWatch({ number: parsedNumber, timeoutMinutes: Number(options.timeout) });
        break;
      }
      default:
        console.error(`hazard-pay pr: unknown action "${action}" (expected "watch")`);
        process.exit(1);
    }
  });

cli
  .command("tasks", "List open issues grouped as frontier / blocked / in flight")
  .option("--json", "Emit the raw grouped structure as JSON instead of a table")
  .example("hazard-pay tasks")
  .example("hazard-pay tasks --json")
  .action((options: { json?: boolean }) => {
    tasks({ json: options.json === true });
  });

cli.help();
cli.version("0.1.0");

cli.parse();

// cac prints nothing when invoked bare, so fall through to help.
if (!process.argv.slice(2).length) {
  cli.outputHelp();
}
