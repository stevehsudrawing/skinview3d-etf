/**
 * Emissive/enchanted pattern decoding: box selection, colour-key
 * collection and matching-mask preparation.
 */

import { MARKER_BOXES } from "./constants";
import { buildMask, collectKeys } from "./pixels";
import type { PaletteId, PatternInfo, PixelData, Rect } from "./types";

/**
 * Selects the pattern box chosen by the marker cells. The first cell
 * holding the choice wins, matching the upstream list-order
 * resolution.
 *
 * @param cells - The decoded marker cells.
 * @param choice - The palette id enabling the pattern (1 or 2).
 * @returns The selected box, or `null` when no cell holds the choice.
 */
export function selectBox(
  cells: readonly (PaletteId | null)[],
  choice: PaletteId,
): Rect | null {
  const index = cells.indexOf(choice);
  return index === -1 ? null : MARKER_BOXES[index];
}

/**
 * Decodes one pattern: it collects the box's key colours and cuts the
 * matching overlay from the working skin. The pattern is off when the
 * box holds no non-transparent pixel or nothing in the skin matches a
 * key.
 *
 * @param image - The working skin (removals already applied).
 * @param box - The selected pattern box.
 * @returns The pattern data, or `null` when off.
 */
export function decodePattern(image: PixelData, box: Rect): PatternInfo | null {
  const keys = collectKeys(image, box);
  if (keys.length === 0) {
    return null;
  }
  const mask = buildMask(image, keys);
  if (mask === null) {
    return null;
  }
  return { box, keys, mask };
}
