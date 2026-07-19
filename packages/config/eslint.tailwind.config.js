import { defineConfig } from "eslint/config";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";
import baseConfig from "./eslint.config.js";

/**
 * ESLint configuration for packages that render Tailwind class names.
 *
 * `entryPoint` must point at the CSS file holding `@import "tailwindcss"` —
 * the plugin reads it to learn the generated class set, and without a correct
 * path every class looks unknown. The default below matches the layout a
 * `packages/ui` would use; a consumer whose CSS lives elsewhere overrides it:
 *
 *   import tailwindConfig from "@hazard-pay/config/eslint-tailwind";
 *
 *   export default defineConfig([
 *     ...tailwindConfig,
 *     { settings: { "better-tailwindcss": { entryPoint: "src/app/globals.css" } } },
 *   ]);
 */
const tailwindConfig = defineConfig([
  ...baseConfig,

  {
    files: ["**/*.tsx", "**/*.jsx"],
    plugins: { "better-tailwindcss": betterTailwindcss },
    settings: {
      "better-tailwindcss": { entryPoint: "src/styles/globals.css" },
    },
    rules: {
      "better-tailwindcss/enforce-consistent-class-order": "warn",
      "better-tailwindcss/no-conflicting-classes": "error",
      "better-tailwindcss/no-unnecessary-whitespace": "warn",
      "better-tailwindcss/no-duplicate-classes": "warn",
    },
  },
]);

export default tailwindConfig;
