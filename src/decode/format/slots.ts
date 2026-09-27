/**
 * Color-guide resolution and choice-slot decoding: the seven slots at
 * `(52,16)` through `(53,18)`.
 */

import { PALETTE, SLOTS } from "../core/constants";
import { getPixel, sameColor } from "../core/pixels";
import type {
  Coordinate,
  PaletteId,
  PixelData,
  SlotValues,
} from "../core/types";

/**
 * Resolves a choice pixel to a palette id by exact RGBA match (alpha
 * included). Anything else reads as "unset" (`null`); the format is
 * lenient here - black, transparent and arbitrary placeholder colors
 * are all valid.
 *
 * @param image - The skin image.
 * @param at - The choice cell or slot point.
 * @returns The palette id, or `null` when nothing matches.
 */
export function readChoice(image: PixelData, at: Coordinate): PaletteId | null {
  const rgba = getPixel(image, at.x, at.y);
  for (const entry of PALETTE) {
    if (sameColor(entry.rgba, rgba)) {
      return entry.id;
    }
  }
  return null;
}

/**
 * Reads the seven choice slots as palette ids.
 *
 * The nose slot can additionally hold the raw value `9` (nose type 9);
 * that is resolved by the nose decoder, not here.
 *
 * @param image - The skin image.
 * @returns The raw slot values; `null` means unset.
 */
export function readSlots(image: PixelData): SlotValues {
  return {
    blink: readChoice(image, SLOTS.blink),
    jacketStyle: readChoice(image, SLOTS.jacketStyle),
    jacketLength: readChoice(image, SLOTS.jacketLength),
    eyePosition: readChoice(image, SLOTS.eyePosition),
    cape: readChoice(image, SLOTS.cape),
    nose: readChoice(image, SLOTS.nose),
    forcedSolid: readChoice(image, SLOTS.forcedSolid),
  };
}
