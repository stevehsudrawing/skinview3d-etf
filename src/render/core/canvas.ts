/**
 * Canvas helpers shared by the renderer modules: reading, painting and
 * comparing pixel buffers.
 */

import type { PixelData } from "../../decode/core/types";

/**
 * Reads the full pixel content of a canvas.
 *
 * @param canvas - The source canvas.
 * @returns The canvas pixels as a `PixelData` buffer.
 * @throws Error when a 2d context is unavailable.
 */
export function readCanvasPixels(canvas: HTMLCanvasElement): PixelData {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (context === null) {
    throw new Error("2d canvas context unavailable");
  }
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  return { width: image.width, height: image.height, data: image.data };
}

/**
 * Writes a pixel buffer onto a canvas, resizing it when needed.
 *
 * @param canvas - The target canvas.
 * @param pixels - The pixels to paint.
 * @throws Error when a 2d context is unavailable.
 */
export function paintCanvasPixels(
  canvas: HTMLCanvasElement,
  pixels: PixelData,
): void {
  if (canvas.width !== pixels.width || canvas.height !== pixels.height) {
    canvas.width = pixels.width;
    canvas.height = pixels.height;
  }
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("2d canvas context unavailable");
  }
  const image = context.createImageData(pixels.width, pixels.height);
  image.data.set(pixels.data);
  context.putImageData(image, 0, 0);
}

/**
 * Converts a pixel buffer into a new canvas of the same size.
 *
 * @param pixels - The pixels to draw.
 * @returns A canvas holding the pixels.
 */
export function pixelsToCanvas(pixels: PixelData): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  paintCanvasPixels(canvas, pixels);
  return canvas;
}

/**
 * Compares two pixel buffers for exact equality.
 *
 * @param a - The first buffer.
 * @param b - The second buffer.
 * @returns True when size and every byte match.
 */
export function pixelsEqual(a: PixelData, b: PixelData): boolean {
  if (
    a.width !== b.width ||
    a.height !== b.height ||
    a.data.length !== b.data.length
  ) {
    return false;
  }
  for (let i = 0; i < a.data.length; i++) {
    if (a.data[i] !== b.data[i]) {
      return false;
    }
  }
  return true;
}
