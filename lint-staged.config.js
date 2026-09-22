/** @type {import("lint-staged").Config} */
export default {
  "*.{js,mjs,cjs,ts,mts,cts}": [
    "eslint --fix",
    "prettier --write --ignore-path .prettierignore",
  ],
  "*.{json,md,html,yml,yaml}": [
    "prettier --write --ignore-path .prettierignore",
  ],
};
