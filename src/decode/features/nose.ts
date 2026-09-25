/**
 * Nose decoding: the deprecated six-pixel path and the slot path
 * (villager, textured and remove variants).
 */

import {
  DEPRECATED_NOSE_RECTS,
  NOSE_CAPE_REGIONS,
  NOSE_COLOR,
  NOSE_TYPE9_PIXEL,
  SLOTS,
} from "../core/constants";
import { createImage, getPixel, sameColor, setPixel } from "../core/pixels";
import type { NoseInfo, PaletteId, PixelData, Rect } from "../core/types";

/** The result of {@link decodeNose}. */
export interface NoseDecodeResult {
  /** The decoded nose, or `null` when none is selected. */
  info: NoseInfo | null;
  /** Base-skin rectangles to clear (the deprecated hat nose pixels). */
  removals: Rect[];
}

/**
 * Checks whether every pixel of a rectangle equals the villager nose
 * color.
 *
 * @param image - The source image.
 * @param rect - The six-pixel rectangle to check.
 * @returns True when all six pixels match.
 */
function allNosePixels(image: PixelData, rect: Rect): boolean {
  for (let y = rect.y1; y <= rect.y2; y++) {
    for (let x = rect.x1; x <= rect.x2; x++) {
      if (!sameColor(getPixel(image, x, y), NOSE_COLOR)) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Resolves the nose slot, including the raw type-9 encoding: when the
 * slot holds no palette color, the literal pixel value `9` selects
 * the "villager-textured-remove" type.
 *
 * @param image - The skin image.
 * @param slot - The palette id read from the nose slot, if any.
 * @returns The nose type id 1-9, or `null` when unset.
 */
function resolveNoseChoice(
  image: PixelData,
  slot: PaletteId | null,
): number | null {
  if (slot !== null) {
    return slot;
  }
  const raw = getPixel(image, SLOTS.nose.x, SLOTS.nose.y);
  return sameColor(raw, NOSE_TYPE9_PIXEL) ? 9 : null;
}

/**
 * Builds the 8x8 textured nose from a former cape region. The 8x4
 * source is transposed into 4x8, mirrored to 8x8 and has its top and
 * bottom halves swapped.
 *
 * @param image - The original skin image.
 * @param variant - The textured source region 1-5.
 * @returns The prepared 8x8 nose image.
 */
function buildTexturedNose(
  image: PixelData,
  variant: 1 | 2 | 3 | 4 | 5,
): PixelData {
  const bounds = NOSE_CAPE_REGIONS[variant - 1];
  const texture = createImage(8, 8);
  for (let sx = bounds.x1; sx <= bounds.x2; sx++) {
    for (let sy = bounds.y1; sy <= bounds.y2; sy++) {
      setPixel(
        texture,
        sy - bounds.y1,
        sx - bounds.x1,
        getPixel(image, sx, sy),
      );
    }
  }
  for (let x = 4; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      setPixel(texture, x, y, getPixel(texture, 7 - x, y));
    }
  }
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 4; y++) {
      const lower = getPixel(texture, x, y + 4);
      setPixel(texture, x, y + 4, getPixel(texture, x, y));
      setPixel(texture, x, y, lower);
    }
  }
  return texture;
}

/**
 * Decodes the nose feature from the deprecated pixels and the nose
 * slot. The textured image is built from the original skin; the only
 * base-skin change is the deprecated hat pixel removal.
 *
 * @param image - The original skin image.
 * @param slot - The palette id read from the nose slot, if any.
 * @returns The nose data and the base-skin removal rectangles.
 */
export function decodeNose(
  image: PixelData,
  slot: PaletteId | null,
): NoseDecodeResult {
  const hatPresent = allNosePixels(image, DEPRECATED_NOSE_RECTS.hat);
  const facePresent = allNosePixels(image, DEPRECATED_NOSE_RECTS.face);

  let villager = hatPresent || facePresent;
  let villagerSkinTextured = false;
  let variant: 1 | 2 | 3 | 4 | 5 | null = null;
  let texture: PixelData | null = null;
  let removesSource = hatPresent;

  const choice = resolveNoseChoice(image, slot);
  if (choice !== null && choice >= 1 && choice <= 9) {
    switch (choice) {
      case 1:
        villager = true;
        break;
      case 7:
        villager = true;
        villagerSkinTextured = true;
        break;
      case 8:
        villager = true;
        removesSource = true;
        break;
      case 9:
        villager = true;
        villagerSkinTextured = true;
        removesSource = true;
        break;
      default: {
        variant = (choice - 1) as 1 | 2 | 3 | 4 | 5;
        texture = buildTexturedNose(image, variant);
      }
    }
  }

  const info: NoseInfo | null =
    villager || variant !== null
      ? { villager, villagerSkinTextured, variant, texture, removesSource }
      : null;

  return {
    info,
    removals: removesSource ? [DEPRECATED_NOSE_RECTS.hat] : [],
  };
}
