import eslint from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default [
  {
    // Local-only trees: vendored reference clones, dev tools and
    // scratch space are never committed (see .gitignore).
    ignores: ["dist/", "node_modules/", "references/", "temp/", "tools/"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
];
