import { cac } from "cac";
import env from "@hazard-pay/env";

const cli = cac("hazard-pay");

cli
  .command("env", "Print the resolved environment")
  .action(() => {
    console.log(JSON.stringify(env, null, 2));
  });

cli.help();
cli.version("0.1.0");

cli.parse();

// cac prints nothing when invoked bare, so fall through to help.
if (!process.argv.slice(2).length) {
  cli.outputHelp();
}
