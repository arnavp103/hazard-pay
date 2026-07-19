import { defineConfig } from "eslint/config";
import baseConfig from "@hazard-pay/config/eslint-node";

export default defineConfig([
  ...baseConfig,

  // stdout is this app's output surface, not a stray debug statement.
  {
    files: ["src/**/*.ts"],
    rules: { "no-console": "off" },
  },
]);
