/**
 * Blinking decoding: mode resolution, lazy face copies, optimized eye
 * strips and the prepared animation frames.
 */

import {
  BLINK_CORNERS,
  BLINK_EYE_STRIPS,
  BLINK_NOSE_CUT_RECTS,
} from "./constants";
import { cloneImage, copyRect } from "./pixels";
import type { BlinkInfo, BlinkMode, PaletteId, PixelData, Rect } from "./types";

/**
 * Resolves the blink mode from the blink slot.
 *
 * @param slot - The palette id read from the blink slot, if any.
 * @returns The mode 1-5, or `null` when the slot selects none.
 */
export function decodeBlinkMode(slot: PaletteId | null): BlinkMode | null {
  if (slot === null || slot < 1 || slot > 5) {
    return null;
  }
  // The range check excludes every other palette value (666 included).
  return slot as BlinkMode;
}

/**
 * Returns the nose-area cuts the stored lazy frames receive when the
 * deprecated hat nose pixels are removed.
 *
 * @param mode - The resolved blink mode.
 * @returns The rectangles to clear from the working skin before the
 *   frames are built; empty for the optimized modes.
 */
export function blinkNoseCuts(mode: BlinkMode): Rect[] {
  if (mode === 1) {
    return [BLINK_NOSE_CUT_RECTS[0]];
  }
  if (mode === 2) {
    return [...BLINK_NOSE_CUT_RECTS];
  }
  return [];
}

/**
 * Builds one lazy frame: the working skin with the stored corner
 * squares copied into the face and hat fronts.
 *
 * @param image - The working skin image.
 * @param frame - The frame to build (1 or 2).
 * @returns The prepared frame.
 */
function buildLazyFrame(image: PixelData, frame: 1 | 2): PixelData {
  const output = cloneImage(image);
  for (const corner of BLINK_CORNERS) {
    if (corner.frame === frame) {
      copyRect(image, output, corner.source, corner.targetX, corner.targetY);
    }
  }
  return output;
}

/**
 * Builds one optimized frame: the working skin with the closed-eye
 * strip stamped across the face row.
 *
 * @param image - The working skin image.
 * @param mode - The optimized mode 3-5.
 * @param eyeHeight - The clamped face row 1-8.
 * @param frameIndex - The index of the strip within the mode.
 * @returns The prepared frame.
 */
function buildOptimizedFrame(
  image: PixelData,
  mode: 3 | 4 | 5,
  eyeHeight: number,
  frameIndex: number,
): PixelData {
  const output = cloneImage(image);
  const strip = BLINK_EYE_STRIPS[mode][frameIndex];
  copyRect(image, output, strip, 8, 8 + (eyeHeight - 1));
  return output;
}

/**
 * Builds the prepared blink frames from the working skin (removals and
 * nose cuts already applied). Modes 1 and 3 produce one frame; modes
 * 2, 4 and 5 produce two.
 *
 * @param image - The working skin image.
 * @param mode - The resolved blink mode 1-5.
 * @param eyeSlot - The palette id read from the eye-height slot.
 * @returns The blinking data with the prepared frames.
 */
export function decodeBlink(
  image: PixelData,
  mode: BlinkMode,
  eyeSlot: PaletteId | null,
): BlinkInfo {
  if (mode === 1 || mode === 2) {
    const first = buildLazyFrame(image, 1);
    const frames = mode === 1 ? [first] : [first, buildLazyFrame(image, 2)];
    return { mode, eyeHeight: null, frames };
  }
  const eyeHeight: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 =
    eyeSlot !== null && eyeSlot >= 1 && eyeSlot <= 8
      ? (eyeSlot as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8)
      : 1;
  const frames = BLINK_EYE_STRIPS[mode].map((_, index) =>
    buildOptimizedFrame(image, mode, eyeHeight, index),
  );
  return { mode, eyeHeight, frames };
}
