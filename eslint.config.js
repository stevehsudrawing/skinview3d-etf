import eslint from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default [
  {
    // Build output and local-only trees: vendored reference clones,
    // dev tools and scratch space are never committed (see
    // .gitignore); `**/dist/` also covers the demo build output.
    ignores: ["**/dist/", "node_modules/", "references/", "temp/", "tools/"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
];
