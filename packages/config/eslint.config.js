import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Base ESLint configuration for the monorepo.
 * Framework-specific configs (Node) extend this.
 */
const baseConfig = defineConfig([
  // Global ignores
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/build/**",
      "**/.turbo/**",
    ],
  },

  // Base JS recommended rules
  js.configs.recommended,

  // TypeScript rules
  tseslint.configs.recommended,

  // Stylistic formatting rules — this repo has no Prettier; @stylistic owns
  // formatting so there is exactly one tool that can rewrite a file.
  stylistic.configs.customize({
    indent: 2,
    quotes: "double",
    semi: true,
    jsx: true,
    arrowParens: true,
    braceStyle: "1tbs",
  }),

  // Global settings for all files
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2022,
      },
    },
  },

  // TypeScript-specific settings
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      "curly": "error",
      "@stylistic/operator-linebreak": ["error", "before"],
      "@stylistic/max-statements-per-line": ["error", { max: 2 }],
      "no-console": "warn",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-deprecated": "warn",
    },
  },
]);

export default baseConfig;
