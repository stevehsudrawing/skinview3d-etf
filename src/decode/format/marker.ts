/**
 * Marker decoding: the eleven-pixel signature check and the four
 * choice cells.
 */

import { MARKER_CELLS, MARKER_SIGNATURE, SKIN_SIZE } from "../core/constants";
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
  if (image.width !== SKIN_SIZE || image.height !== SKIN_SIZE) {
    return false;
  }
  return MARKER_SIGNATURE.every(([at, rgb]) => {
    const pixel = getPixel(image, at.x, at.y);
    return (
      pixel[0] === rgb[0] &&
      pixel[1] === rgb[1] &&
      pixel[2] === rgb[2] &&
      pixel[3] === 255
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
  return MARKER_CELLS.map((cell) => readChoice(image, cell));
}
