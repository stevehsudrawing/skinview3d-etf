/**
 * Legacy (pre-1.8) skin support: converts a 64x32 skin to the 1.8 layout
 * so the normal decoder pipeline can run on it. The geometry matches the
 * transformation the rendering pipeline applies (vanilla's
 * `processLegacySkin`, reimplemented by skinview-utils'
 * `convertSkinTo1_8`), so decode results agree with what renders on
 * screen.
 *
 * Only the geometry is replicated: the alpha / opacity fixes of the
 * rendering pipeline (hat-layer clearing for opaque skins, forced
 * opaque regions) belong to the host and are not part of the decoder.
 */

import { SKIN_SIZE } from "./constants";
import { createImage } from "./pixels";
import type { PixelData } from "./types";

/** Width of a legacy (pre-1.8) skin. */
const LEGACY_WIDTH = 64;

/** Height of a legacy (pre-1.8) skin. */
const LEGACY_HEIGHT = 32;

/** One mirrored plate copy from the legacy source to the 1.8 target. */
interface PlateCopy {
  /** Source rectangle x on the legacy skin. */
  sx: number;
  /** Source rectangle y on the legacy skin. */
  sy: number;
  /** Destination rectangle x on the 1.8 skin. */
  dx: number;
  /** Destination rectangle y on the 1.8 skin. */
  dy: number;
  /** Plate width in pixels. */
  width: number;
  /** Plate height in pixels. */
  height: number;
}

/**
 * The twelve limb-plate copies: the right leg and right arm plates are
 * mirrored into the left-limb regions of the 1.8 layout. Every plate is
 * flipped horizontally when copied.
 */
const PLATE_COPIES: readonly PlateCopy[] = [
  { sx: 4, sy: 16, dx: 20, dy: 48, width: 4, height: 4 }, // leg top
  { sx: 8, sy: 16, dx: 24, dy: 48, width: 4, height: 4 }, // leg bottom
  { sx: 0, sy: 20, dx: 24, dy: 52, width: 4, height: 12 }, // leg outer
  { sx: 4, sy: 20, dx: 20, dy: 52, width: 4, height: 12 }, // leg front
  { sx: 8, sy: 20, dx: 16, dy: 52, width: 4, height: 12 }, // leg inner
  { sx: 12, sy: 20, dx: 28, dy: 52, width: 4, height: 12 }, // leg back
  { sx: 44, sy: 16, dx: 36, dy: 48, width: 4, height: 4 }, // arm top
  { sx: 48, sy: 16, dx: 40, dy: 48, width: 4, height: 4 }, // arm bottom
  { sx: 40, sy: 20, dx: 40, dy: 52, width: 4, height: 12 }, // arm outer
  { sx: 44, sy: 20, dx: 36, dy: 52, width: 4, height: 12 }, // arm front
  { sx: 48, sy: 20, dx: 32, dy: 52, width: 4, height: 12 }, // arm inner
  { sx: 52, sy: 20, dx: 44, dy: 52, width: 4, height: 12 }, // arm back
];

/**
 * Whether an image is a legacy (pre-1.8) skin.
 *
 * @param image - The pixel buffer to test.
 * @returns `true` for a 64x32 skin.
 */
export function isLegacySkin(image: PixelData): boolean {
  return image.width === LEGACY_WIDTH && image.height === LEGACY_HEIGHT;
}

/**
 * Converts a legacy 64x32 skin to the 64x64 1.8 layout. The top half is
 * preserved as-is, the left-limb regions receive horizontally mirrored
 * copies of the right-limb plates and every other bottom-half pixel
 * stays transparent.
 *
 * @param image - The legacy skin (64x32).
 * @returns A new 64x64 buffer in the 1.8 layout.
 */
export function convertLegacySkin(image: PixelData): PixelData {
  const converted = createImage(SKIN_SIZE, SKIN_SIZE);
  converted.data.set(image.data);
  for (const plate of PLATE_COPIES) {
    copyPlateMirrored(image, converted, plate);
  }
  return converted;
}

/**
 * Copies one plate horizontally mirrored: the first destination column
 * receives the last source column and so on.
 *
 * @param source - The legacy source buffer.
 * @param target - The 1.8 target buffer.
 * @param plate - The source and destination rectangles.
 */
function copyPlateMirrored(
  source: PixelData,
  target: PixelData,
  plate: PlateCopy,
): void {
  for (let row = 0; row < plate.height; row++) {
    for (let column = 0; column < plate.width; column++) {
      const from =
        ((plate.sy + row) * source.width +
          plate.sx +
          plate.width -
          1 -
          column) *
        4;
      const to = ((plate.dy + row) * target.width + plate.dx + column) * 4;
      target.data[to] = source.data[from];
      target.data[to + 1] = source.data[from + 1];
      target.data[to + 2] = source.data[from + 2];
      target.data[to + 3] = source.data[from + 3];
    }
  }
}
