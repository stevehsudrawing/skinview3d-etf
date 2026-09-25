/**
 * Loader for the local-only ETF example skins. The fixtures live in
 * `examples/images/example-skins/`, which is gitignored and copied
 * from the local upstream clone on a fresh checkout; specs that need
 * them skip themselves when the folder is absent.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";
import type { PixelData } from "../../src/decode/core/types";

/** Folder holding the local-only example skins. */
export const FIXTURE_DIR = "examples/images/example-skins";

/** Whether the local fixture folder exists on this checkout. */
export const fixturesAvailable = existsSync(FIXTURE_DIR);

/**
 * Loads one fixture skin into the decoder's pixel shape.
 *
 * @param name - The file name including the `.png` suffix.
 * @returns The decoded skin as a pixel buffer.
 */
export function loadSkin(name: string): PixelData {
  const png = PNG.sync.read(readFileSync(join(FIXTURE_DIR, name)));
  return {
    width: png.width,
    height: png.height,
    data: new Uint8ClampedArray(png.data),
  };
}
