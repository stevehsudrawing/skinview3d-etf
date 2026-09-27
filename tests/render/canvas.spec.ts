/**
 * Canvas helper specs: the read / paint round-trip, the resize path,
 * the rectangle scope and the equality comparison, against the
 * shared fake canvas (no browser).
 */

import { describe, expect, it } from "vitest";
import { createImage, setPixel } from "../../src/decode/core/pixels";
import type { PixelData } from "../../src/decode/core/types";
import {
  paintCanvasPixels,
  paintCanvasRect,
  pixelsEqual,
  readCanvasPixels,
} from "../../src/render/core/canvas";
import { FakeCanvas } from "../fixtures/fake-canvas";

/**
 * Creates a pixel buffer with every byte set to one value.
 *
 * @param width - Buffer width in pixels.
 * @param height - Buffer height in pixels.
 * @param value - The byte to fill.
 * @returns The filled buffer.
 */
function filledPixels(width: number, height: number, value: number): PixelData {
  const image = createImage(width, height);
  image.data.fill(value);
  return image;
}

describe("readCanvasPixels", () => {
  it("reads a copy of the canvas pixels", () => {
    const canvas = new FakeCanvas(4, 2);
    canvas.pixels.fill(0x2a);
    const pixels = readCanvasPixels(canvas as unknown as HTMLCanvasElement);
    expect(pixels.width).toBe(4);
    expect(pixels.height).toBe(2);
    expect(pixels.data).toEqual(canvas.pixels);
    expect(pixels.data).not.toBe(canvas.pixels);
  });
});

describe("paintCanvasPixels", () => {
  it("paints the full buffer onto a matching canvas", () => {
    const canvas = new FakeCanvas(2, 2);
    canvas.pixels.fill(0x11);
    const pixels = filledPixels(2, 2, 0x33);
    paintCanvasPixels(canvas as unknown as HTMLCanvasElement, pixels);
    expect(canvas.pixels).toEqual(pixels.data);
  });

  it("resizes the canvas to the buffer first", () => {
    const canvas = new FakeCanvas(2, 2);
    const pixels = filledPixels(4, 3, 0x55);
    paintCanvasPixels(canvas as unknown as HTMLCanvasElement, pixels);
    expect(canvas.width).toBe(4);
    expect(canvas.height).toBe(3);
    expect(canvas.pixels).toHaveLength(4 * 3 * 4);
    expect(canvas.pixels).toEqual(pixels.data);
  });
});

describe("paintCanvasRect", () => {
  it("writes only the rectangle and leaves the rest alone", () => {
    const canvas = new FakeCanvas(4, 4);
    canvas.pixels.fill(0x11);
    const pixels = filledPixels(4, 4, 0x22);
    paintCanvasRect(canvas as unknown as HTMLCanvasElement, pixels, {
      topLeft: { x: 1, y: 1 },
      bottomRight: { x: 2, y: 2 },
    });
    for (const [x, y] of [
      [1, 1],
      [2, 1],
      [1, 2],
      [2, 2],
    ] as const) {
      expect(canvas.pixels[(y * 4 + x) * 4]).toBe(0x22);
    }
    for (const [x, y] of [
      [0, 0],
      [3, 0],
      [0, 1],
      [3, 2],
      [0, 3],
      [3, 3],
    ] as const) {
      expect(canvas.pixels[(y * 4 + x) * 4]).toBe(0x11);
    }
  });
});

describe("pixelsEqual", () => {
  it("compares the size and every byte", () => {
    const a = createImage(2, 2);
    setPixel(a, 0, 0, [1, 2, 3, 255]);
    const same = createImage(2, 2);
    setPixel(same, 0, 0, [1, 2, 3, 255]);
    expect(pixelsEqual(a, a)).toBe(true);
    expect(pixelsEqual(a, same)).toBe(true);
    const changed = createImage(2, 2);
    setPixel(changed, 0, 0, [1, 2, 4, 255]);
    expect(pixelsEqual(a, changed)).toBe(false);
    expect(pixelsEqual(a, createImage(1, 2))).toBe(false);
  });
});
