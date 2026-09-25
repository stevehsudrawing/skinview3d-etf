/**
 * Loader for the fixture skins used by the real-image specs. Only the
 * self-drawn `example.png` is committed; the specs gate on an ETF
 * example skin and skip when the local set is absent.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";
import type { PixelData } from "../../src/decode/core/types";

/** Folder holding the fixture skins. */
export const FIXTURE_DIR = "examples/src/assets/skins";

/** An ETF example skin; its presence marks the local set available. */
const SENTINEL_SKIN = "robot.png";

/** Whether the local ETF fixture set exists on this checkout. */
export const fixturesAvailable = existsSync(join(FIXTURE_DIR, SENTINEL_SKIN));

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
