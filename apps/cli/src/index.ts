import { cac } from "cac";
import env from "@hazard-pay/env";
import { worktreeClean, worktreeNew } from "./worktree.ts";

const cli = cac("hazard-pay");

cli
  .command("env", "Print the resolved environment (secret values redacted)")
  .action(() => {
    const redacted = Object.fromEntries(Object.entries(env).map(([key, value]) => [
      key,
      /KEY|SECRET|TOKEN|PASSWORD/i.test(key) && typeof value === "string" && value !== ""
        ? "[set]"
        : value,
    ]));
    console.log(JSON.stringify(redacted, null, 2));
  });

cli
  .command(
    "worktree <action> [name]",
    "Manage agent worktrees under .claude/worktrees (actions: new <branch>, clean)",
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
        worktreeClean({ dryRun: options.dryRun === true });
        break;
      default:
        console.error(`hazard-pay worktree: unknown action "${action}" (expected "new" or "clean")`);
        process.exit(1);
    }
  });

cli.help();
cli.version("0.1.0");

cli.parse();

// cac prints nothing when invoked bare, so fall through to help.
if (!process.argv.slice(2).length) {
  cli.outputHelp();
}
