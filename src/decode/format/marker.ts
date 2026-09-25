/**
 * Marker decoding: the eleven-pixel signature check and the four
 * choice cells.
 */

import { MARKER_CELLS, MARKER_SIGNATURE } from "../core/constants";
import { getPixel } from "../core/pixels";
import type { PaletteId, PixelData } from "../core/types";
import { readChoice } from "./slots";

/**
 * Checks the eleven marker signature pixels with exact RGBA equality.
 * The template's `(3,19)` icon pixel is not part of the check and is
 * deliberately ignored.
 *
 * @param image - The skin image.
 * @returns True when the signature matches on a 64x64 image.
 */
export function checkSignature(image: PixelData): boolean {
  if (image.width !== 64 || image.height !== 64) {
    return false;
  }
  return MARKER_SIGNATURE.every(([x, y, r, g, b]) => {
    const pixel = getPixel(image, x, y);
    return (
      pixel[0] === r && pixel[1] === g && pixel[2] === b && pixel[3] === 255
    );
  });
}

/**
 * Reads the four marker-choice cells in upstream order. The first
 * cell holding pink (id 1) enables emissive, the first holding cyan
 * (id 2) enables enchanted.
 *
 * @param image - The skin image.
 * @returns The palette id of each cell, or `null` when unset.
 */
export function readCells(image: PixelData): (PaletteId | null)[] {
  return MARKER_CELLS.map((cell) => readChoice(image, cell.x, cell.y));
}
