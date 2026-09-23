/**
 * Jacket (coat) decoding: the style table, the length clamp and the
 * prepared coat texture plus the moved-source removals.
 */

import {
  COAT_STYLES,
  JACKET_COPY_TABLE,
  JACKET_MOVED_RECTS,
} from "./constants";
import { copyRect, createImage } from "./pixels";
import type { JacketInfo, PaletteId, PixelData, Rect } from "./types";

/** The result of {@link decodeJacket}. */
export interface JacketDecodeResult {
  /** The decoded jacket, or `null` when no style is selected. */
  info: JacketInfo | null;
  /** Base-skin rectangles to clear (the moved styles' leg sources). */
  removals: Rect[];
}

/**
 * Builds the 64x64 coat texture. Sources are copied from the original
 * skin's leg outer layer; the source `y2` grows with the coat length
 * offset so a longer coat reads one extra row per length step.
 *
 * @param image - The original skin image.
 * @param lengthOffset - The coat length offset `L = length - 1`.
 * @param keepTop - Whether the style keeps the top faces (styles 1-4).
 * @returns The prepared 64x64 coat texture.
 */
function buildCoatTexture(
  image: PixelData,
  lengthOffset: number,
  keepTop: boolean,
): PixelData {
  const coat = createImage(64, 64);
  for (const copy of JACKET_COPY_TABLE) {
    if (copy.topOnly && !keepTop) {
      continue;
    }
    const source = { ...copy.source, y2: copy.source.y2 + lengthOffset };
    copyRect(image, coat, source, copy.targetX, copy.targetY);
  }
  return coat;
}

/**
 * Decodes the jacket feature from the style and length slots. An
 * unset or out-of-range length decodes as 1.
 *
 * @param image - The original skin image.
 * @param styleSlot - The palette id read from the style slot, if any.
 * @param lengthSlot - The palette id read from the length slot, if any.
 * @returns The jacket data and the base-skin removal rectangles.
 */
export function decodeJacket(
  image: PixelData,
  styleSlot: PaletteId | null,
  lengthSlot: PaletteId | null,
): JacketDecodeResult {
  if (styleSlot === null || styleSlot < 1 || styleSlot > 8) {
    return { info: null, removals: [] };
  }
  const style = COAT_STYLES[styleSlot - 1];
  const length =
    lengthSlot !== null && lengthSlot >= 1 && lengthSlot <= 8 ? lengthSlot : 1;
  const lengthOffset = length - 1;
  const removals = style.moved
    ? JACKET_MOVED_RECTS.map((entry) =>
        entry.extendY2
          ? { ...entry.rect, y2: entry.rect.y2 + lengthOffset }
          : { ...entry.rect },
      )
    : [];
  return {
    info: {
      style: style.id,
      length,
      fat: style.fat,
      moved: style.moved,
      top: style.top,
      texture: buildCoatTexture(image, lengthOffset, style.top),
    },
    removals,
  };
}
