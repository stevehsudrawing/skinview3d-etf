/**
 * Jacket decoding: the style table, the length clamp and the prepared
 * jacket texture plus the moved-source removals and masks.
 */

import {
  JACKET_COPY_TABLE,
  JACKET_MOVED_RECTS,
  JACKET_STYLES,
  SKIN_SIZE,
} from "../core/constants";
import { copyRect, createImage } from "../core/pixels";
import type { JacketInfo, PaletteId, PixelData, Rect } from "../core/types";

/** The result of {@link decodeJacket}. */
export interface JacketDecodeResult {
  /** The decoded jacket, or `null` when no style is selected. */
  info: JacketInfo | null;
  /** Base-skin rectangles to clear (the moved styles' leg sources). */
  removals: Rect[];
}

/**
 * Extends a rectangle's bottom edge by `offset` rows: the jacket
 * length offset `L = length - 1` makes a longer jacket read one extra
 * source row per length step.
 *
 * @param rect - The rectangle to extend.
 * @param offset - The rows to add below the bottom edge.
 * @returns A new rectangle (the top-left corner is shared).
 */
function extendBottom(rect: Rect, offset: number): Rect {
  return {
    topLeft: rect.topLeft,
    bottomRight: { x: rect.bottomRight.x, y: rect.bottomRight.y + offset },
  };
}

/**
 * Builds the 64x64 jacket texture. Sources are copied from the
 * original skin's leg outer layer; the source rectangle's bottom
 * edge is extended by the length offset (see {@link extendBottom}).
 *
 * @param image - The original skin image.
 * @param lengthOffset - The jacket length offset `L = length - 1`.
 * @param keepTop - Whether the style keeps the top faces (styles 1-4).
 * @returns The prepared 64x64 jacket texture.
 */
function buildJacketTexture(
  image: PixelData,
  lengthOffset: number,
  keepTop: boolean,
): PixelData {
  const jacket = createImage(SKIN_SIZE, SKIN_SIZE);
  for (const copy of JACKET_COPY_TABLE) {
    if (copy.topOnly && !keepTop) {
      continue;
    }
    const source = extendBottom(copy.source, lengthOffset);
    copyRect(image, jacket, source, copy.target);
  }
  return jacket;
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
  const style = JACKET_STYLES[styleSlot - 1];
  // The range check excludes every other palette value (666
  // included).
  const length =
    lengthSlot !== null && lengthSlot >= 1 && lengthSlot <= 8
      ? (lengthSlot as JacketInfo["length"])
      : 1;
  const lengthOffset = length - 1;
  const removals = style.moved
    ? JACKET_MOVED_RECTS.map((entry) =>
        entry.extendY2
          ? extendBottom(entry.rect, lengthOffset)
          : { ...entry.rect },
      )
    : [];
  return {
    info: {
      style: style.id,
      length,
      wide: style.wide,
      moved: style.moved,
      top: style.top,
      texture: buildJacketTexture(image, lengthOffset, style.top),
      emissiveMask: null,
      enchantedMask: null,
    },
    removals,
  };
}
