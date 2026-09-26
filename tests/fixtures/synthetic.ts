/**
 * Synthetic 64x64 skin builders for the decoder specs. Everything a
 * spec needs can be painted pixel by pixel from a blank skin, so the
 * synthetic tests never depend on the local-only fixture folder.
 */

import {
  MARKER_CELLS,
  MARKER_SIGNATURE,
  paletteColor,
  SKIN_SIZE,
  SLOTS,
} from "../../src/decode/core/constants";
import { createImage, fillRect, setPixel } from "../../src/decode/core/pixels";
import type {
  PaletteId,
  PixelData,
  Rect,
  RGBA,
} from "../../src/decode/core/types";

/** A slot key of the seven choice slots. */
export type SlotName = keyof typeof SLOTS;

/**
 * Creates a fully transparent 64x64 skin.
 *
 * @returns A blank skin buffer.
 */
export function createBlankSkin(): PixelData {
  return createImage(SKIN_SIZE, SKIN_SIZE);
}

/**
 * Writes one pixel.
 *
 * @param skin - The skin to mutate.
 * @param x - Pixel column.
 * @param y - Pixel row.
 * @param rgba - The color to write.
 */
export function paintPixel(
  skin: PixelData,
  x: number,
  y: number,
  rgba: RGBA,
): void {
  setPixel(skin, x, y, rgba);
}

/**
 * Paints a rectangle with a palette color.
 *
 * @param skin - The skin to mutate.
 * @param rect - The rectangle to fill.
 * @param id - The palette id to fill with.
 */
export function paintRectWithPalette(
  skin: PixelData,
  rect: Rect,
  id: PaletteId,
): void {
  fillRect(skin, rect, paletteColor(id));
}

/**
 * Paints the eleven marker signature pixels.
 *
 * @param skin - The skin to mutate.
 */
export function paintMarker(skin: PixelData): void {
  for (const [x, y, r, g, b] of MARKER_SIGNATURE) {
    setPixel(skin, x, y, [r, g, b, 255]);
  }
}

/**
 * Paints one marker-choice cell with a palette color, or clears it.
 *
 * @param skin - The skin to mutate.
 * @param index - The cell index 0-3 in upstream read order.
 * @param id - The palette id, or `null` to clear the cell.
 */
export function paintCell(
  skin: PixelData,
  index: number,
  id: PaletteId | null,
): void {
  const cell = MARKER_CELLS[index];
  setPixel(skin, cell.x, cell.y, id === null ? [0, 0, 0, 0] : paletteColor(id));
}

/**
 * Paints one choice slot with a palette color, or clears it.
 *
 * @param skin - The skin to mutate.
 * @param name - The slot to write.
 * @param id - The palette id, or `null` to clear the slot.
 */
export function paintSlot(
  skin: PixelData,
  name: SlotName,
  id: PaletteId | null,
): void {
  const slot = SLOTS[name];
  setPixel(skin, slot.x, slot.y, id === null ? [0, 0, 0, 0] : paletteColor(id));
}

/**
 * Creates a blank skin with the marker signature painted.
 *
 * @returns A marked synthetic skin.
 */
export function createMarkedSkin(): PixelData {
  const skin = createBlankSkin();
  paintMarker(skin);
  return skin;
}
