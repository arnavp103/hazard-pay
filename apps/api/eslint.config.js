import { defineConfig } from "eslint/config";
import baseConfig from "@hazard-pay/config/eslint-node";

export default defineConfig([
  ...baseConfig,

  // ADR 0001 §1 import fence: queries and transaction boundaries live in
  // src/db/** — the rest of the app reaches the database only through
  // `ctx.db` and the helpers src/db exports. Type imports stay legal
  // everywhere so signatures can name `Db` without moving.
  {
    files: ["src/**/*.ts"],
    ignores: ["src/db/**"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@hazard-pay/db",
              message:
                "Runtime imports of @hazard-pay/db belong in src/db/** (ADR 0001). Import query helpers from ./db instead; `import type` is allowed anywhere.",
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
]);
