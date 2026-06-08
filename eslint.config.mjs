import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Configuration ESLint partagée du monorepo (flat config).
 * Règle absolue SYSTEM.md : zéro `any`, pas de `console.log`.
 */
export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/web-build/**",
      "**/.expo/**",
      "**/.turbo/**",
      "**/node_modules/**",
      "**/*.config.js",
      "**/*.config.cjs",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // TypeScript gère la résolution des identifiants.
      "no-undef": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
);
