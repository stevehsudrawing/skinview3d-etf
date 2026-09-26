import eslint from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default [
  {
    // Build output and the local-only working trees; `**/dist/` also covers
    // the demo build output.
    ignores: ["**/dist/", "node_modules/", "local/"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
];
