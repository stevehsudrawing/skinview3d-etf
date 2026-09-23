/**
 * `ImageData`-like pixel helpers used by the decoder: creation, reads
 * and writes, rectangle operations and colour-key matching.
 *
 * All helpers assume in-bounds coordinates; callers work on 64x64
 * buffers with fixed rectangles. No helper imports `three` or
 * `skinview3d`.
 */

import type { PixelData, Rect, RGBA } from "./types";

/**
 * Creates a fully transparent image.
 *
 * @param width - Image width in pixels.
 * @param height - Image height in pixels.
 * @returns A zero-filled pixel buffer.
 */
export function createImage(width: number, height: number): PixelData {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

/**
 * Copies an image.
 *
 * @param image - The image to clone.
 * @returns A new buffer with identical dimensions and bytes.
 */
export function cloneImage(image: PixelData): PixelData {
  return {
    width: image.width,
    height: image.height,
    data: new Uint8ClampedArray(image.data),
  };
}

/**
 * Reads the RGBA bytes of one pixel.
 *
 * @param image - The source image.
 * @param x - Pixel column.
 * @param y - Pixel row.
 * @returns The pixel as an RGBA tuple.
 */
export function getPixel(image: PixelData, x: number, y: number): RGBA {
  const index = (image.width * y + x) * 4;
  const { data } = image;
  return [data[index], data[index + 1], data[index + 2], data[index + 3]];
}

/**
 * Writes the RGBA bytes of one pixel.
 *
 * @param image - The target image (mutated).
 * @param x - Pixel column.
 * @param y - Pixel row.
 * @param rgba - The colour to write.
 */
export function setPixel(
  image: PixelData,
  x: number,
  y: number,
  rgba: RGBA,
): void {
  const index = (image.width * y + x) * 4;
  const { data } = image;
  data[index] = rgba[0];
  data[index + 1] = rgba[1];
  data[index + 2] = rgba[2];
  data[index + 3] = rgba[3];
}

/**
 * Compares two colours channel by channel (alpha included).
 *
 * @param a - The first colour.
 * @param b - The second colour.
 * @returns True when all four channels are equal.
 */
export function sameColour(a: RGBA, b: RGBA): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}

/**
 * Fills an inclusive rectangle with a colour.
 *
 * @param image - The target image (mutated).
 * @param rect - The rectangle to fill.
 * @param rgba - The fill colour.
 */
export function fillRect(image: PixelData, rect: Rect, rgba: RGBA): void {
  for (let y = rect.y1; y <= rect.y2; y++) {
    for (let x = rect.x1; x <= rect.x2; x++) {
      setPixel(image, x, y, rgba);
    }
  }
}

/**
 * Copies an inclusive source rectangle into a target image. The
 * source's top-left pixel lands on `(targetX, targetY)`.
 *
 * @param source - The image to read from.
 * @param target - The image to write to (mutated).
 * @param rect - The source rectangle.
 * @param targetX - Target column of the rectangle's top-left pixel.
 * @param targetY - Target row of the rectangle's top-left pixel.
 */
export function copyRect(
  source: PixelData,
  target: PixelData,
  rect: Rect,
  targetX: number,
  targetY: number,
): void {
  for (let y = rect.y1; y <= rect.y2; y++) {
    for (let x = rect.x1; x <= rect.x2; x++) {
      const rgba = getPixel(source, x, y);
      setPixel(target, targetX + (x - rect.x1), targetY + (y - rect.y1), rgba);
    }
  }
}

/**
 * Clears an inclusive rectangle (sets every pixel to transparent
 * black).
 *
 * @param image - The target image (mutated).
 * @param rect - The rectangle to clear.
 */
export function clearRect(image: PixelData, rect: Rect): void {
  fillRect(image, rect, [0, 0, 0, 0]);
}

/**
 * Forces the alpha channel of an inclusive rectangle to 255 while
 * keeping the RGB channels.
 *
 * @param image - The target image (mutated).
 * @param rect - The rectangle to strip.
 */
export function stripAlphaRect(image: PixelData, rect: Rect): void {
  for (let y = rect.y1; y <= rect.y2; y++) {
    for (let x = rect.x1; x <= rect.x2; x++) {
      image.data[(image.width * y + x) * 4 + 3] = 255;
    }
  }
}

/**
 * Converts a colour to a comparable string key.
 *
 * @param rgba - The colour to pack.
 * @returns A `"r,g,b,a"` key.
 */
function colourKey(rgba: RGBA): string {
  return `${rgba[0]},${rgba[1]},${rgba[2]},${rgba[3]}`;
}

/**
 * Collects the distinct non-transparent colours of an inclusive
 * rectangle. A pixel counts when its alpha channel differs from zero,
 * which mirrors how upstream reads key colours.
 *
 * @param image - The source image.
 * @param rect - The region to scan.
 * @returns The distinct colours in row-major first-seen order.
 */
export function collectKeys(image: PixelData, rect: Rect): RGBA[] {
  const seen = new Set<string>();
  const keys: RGBA[] = [];
  for (let y = rect.y1; y <= rect.y2; y++) {
    for (let x = rect.x1; x <= rect.x2; x++) {
      const rgba = getPixel(image, x, y);
      if (rgba[3] === 0) {
        continue;
      }
      const key = colourKey(rgba);
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(rgba);
      }
    }
  }
  return keys;
}

/**
 * Builds a full-size overlay that keeps only the pixels whose RGBA
 * equals one of `keys` exactly; every other pixel becomes fully
 * transparent.
 *
 * @param image - The source image.
 * @param keys - The key colours to keep.
 * @returns The overlay, or `null` when no pixel matches.
 */
export function buildMask(
  image: PixelData,
  keys: readonly RGBA[],
): PixelData | null {
  const wanted = new Set(keys.map(colourKey));
  const mask = createImage(image.width, image.height);
  let matched = false;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const rgba = getPixel(image, x, y);
      if (wanted.has(colourKey(rgba))) {
        setPixel(mask, x, y, rgba);
        matched = true;
      }
    }
  }
  return matched ? mask : null;
}

/**
 * Counts the pixels of an image whose RGBA equals a colour exactly.
 *
 * @param image - The source image.
 * @param rgba - The colour to count.
 * @returns The number of matching pixels.
 */
export function countPixels(image: PixelData, rgba: RGBA): number {
  const wanted = colourKey(rgba);
  let count = 0;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (colourKey(getPixel(image, x, y)) === wanted) {
        count++;
      }
    }
  }
  return count;
}
