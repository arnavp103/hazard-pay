import { defineConfig } from "eslint/config";
import baseConfig from "./eslint.config.js";
import globals from "globals";

/**
 * ESLint configuration for Node.js services.
 * Extends base config, removes browser globals.
 */
const nodeConfig = defineConfig([
  ...baseConfig,

  // Override globals - Node only, no browser
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
        // Explicitly undefined to error if used
        window: "off",
        document: "off",
        navigator: "off",
        localStorage: "off",
        sessionStorage: "off",
      },
    },
  },
]);

export default nodeConfig;
