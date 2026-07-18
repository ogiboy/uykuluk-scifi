import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      ".agents/**",
      ".claude/**",
      ".claude-flow/**",
      ".omx/**",
      ".ruflo/**",
      ".swarm/**",
      "dist/**",
      "runs/**",
      "node_modules/**",
      "apps/**/.next/**",
    ],
  },
  {
    languageOptions: {
      globals: {
        console: "readonly",
        document: "readonly",
        fetch: "readonly",
        process: "readonly",
        window: "readonly",
      },
    },
  },
  {
    files: [
      "src/**/*.ts",
      "tests/**/*.ts",
      "scripts/**/*.mjs",
      "apps/studio/**/*.ts",
      "apps/studio/**/*.tsx",
      "playwright.config.ts",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  eslintConfigPrettier,
  { settings: { react: { version: "19" } } },
];
