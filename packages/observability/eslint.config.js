import nodeConfig from "@hazard-pay/config/eslint-node";
import { defineConfig } from "eslint/config";
import globals from "globals";

/**
 * Node preset for the package, with browser globals restored for the
 * `/browser` entry — it ships to the webapp, not to Node.
 */
export default defineConfig([
  ...nodeConfig,
  {
    files: ["src/browser/**"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
]);
