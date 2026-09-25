/**
 * Caps the commit body at a fixed number of lines. commitlint has no
 * built-in line-count rule (`body-max-length` counts characters), and
 * the line-length rule alone cannot bound the line count, so the pair
 * gets a custom rule.
 *
 * @param {{ body?: string | null }} commit - The parsed commit.
 * @param {string} [when] - The condition; only `"always"` is used.
 * @param {number} [value] - The maximum number of body lines.
 * @returns {[boolean, string]} Whether the rule passed, plus the
 * error text for the failure case.
 */
const bodyMaxLines = (commit, when = "always", value = 3) => {
  const body = typeof commit.body === "string" ? commit.body.trim() : "";
  const lines = body === "" ? 0 : body.split("\n").length;
  const pass = when === "never" ? lines > value : lines <= value;
  return [pass, `body must not be longer than ${value} lines`];
};

/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ["@commitlint/config-conventional"],
  plugins: [{ rules: { "body-max-lines": bodyMaxLines } }],
  rules: {
    "header-max-length": [2, "always", 200],
    // The body is capped at three 80-column lines; the line-count and
    // line-length rules together bound both dimensions.
    "body-max-lines": [2, "always", 3],
    "body-max-line-length": [2, "always", 80],
    "footer-max-line-length": [0],
  },
};
