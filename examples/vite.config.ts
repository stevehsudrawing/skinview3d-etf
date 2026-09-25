import { defineConfig } from "vite";

/**
 * The demo's Vite configuration: the dev server keeps the root base,
 * while the production build targets the GitHub Pages project path
 * (`https://stevehsudrawing.github.io/skinview3d-etf/`).
 */
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/skinview3d-etf/" : "/",
}));
