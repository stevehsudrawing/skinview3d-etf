/**
 * Blink painter specs: the canvas stub mimics the `getImageData` /
 * `createImageData` / `putImageData` subset the canvas helpers use
 * (with the HTML-spec dirty-rectangle destination semantics), so
 * snapshot-once, rectangle scope, dirty marking and the idempotent
 * restore are asserted without a browser.
 */

import { describe, expect, it, vi } from "vitest";
import { createImage } from "../../src/decode/core/pixels";
import type {
  BlinkInfo,
  BlinkMode,
  PixelData,
} from "../../src/decode/core/types";
import {
  createBlinkPainter,
  type BlinkGlow,
} from "../../src/render/features/blinking";

/** The fake `ImageData` handed out by the stub context. */
interface FakeImageData {
  /** Width in pixels. */
  width: number;
  /** Height in pixels. */
  height: number;
  /** The RGBA bytes. */
  data: Uint8ClampedArray;
}

/** The 2d-context subset the canvas helpers call. */
class FakeContext {
  /**
   * @param canvas - The canvas backing this context.
   */
  constructor(private readonly canvas: FakeCanvas) {}

  /**
   * @param width - The image width.
   * @param height - The image height.
   * @returns A blank image buffer.
   */
  createImageData(width: number, height: number): FakeImageData {
    return { width, height, data: new Uint8ClampedArray(width * height * 4) };
  }

  /**
   * @param x - Source x.
   * @param y - Source y.
   * @param width - Source width.
   * @param height - Source height.
   * @returns A copy of the canvas region.
   */
  getImageData(
    x: number,
    y: number,
    width: number,
    height: number,
  ): FakeImageData {
    const image = this.createImageData(width, height);
    for (let row = 0; row < height; row++) {
      const from = ((y + row) * this.canvas.width + x) * 4;
      image.data.set(
        this.canvas.pixels.subarray(from, from + width * 4),
        row * width * 4,
      );
    }
    return image;
  }

  /**
   * Writes an image region onto the canvas. Follows the HTML spec:
   * the dirty rectangle selects the source pixels and the destination
   * is offset by `(dx + dirtyX, dy + dirtyY)`.
   *
   * @param image - The source buffer.
   * @param dx - Destination x offset.
   * @param dy - Destination y offset.
   * @param dirtyX - Source rectangle x.
   * @param dirtyY - Source rectangle y.
   * @param dirtyWidth - Source rectangle width.
   * @param dirtyHeight - Source rectangle height.
   */
  putImageData(
    image: FakeImageData,
    dx: number,
    dy: number,
    dirtyX = 0,
    dirtyY = 0,
    dirtyWidth = image.width,
    dirtyHeight = image.height,
  ): void {
    for (let row = dirtyY; row < dirtyY + dirtyHeight; row++) {
      for (let col = dirtyX; col < dirtyX + dirtyWidth; col++) {
        const from = (row * image.width + col) * 4;
        const to = ((row + dy) * this.canvas.width + (col + dx)) * 4;
        this.canvas.pixels.set(image.data.subarray(from, from + 4), to);
      }
    }
  }
}

/** The fake canvas itself. */
class FakeCanvas {
  /** Canvas width in pixels. */
  width = 64;
  /** Canvas height in pixels. */
  height = 64;
  /** The backing pixel store. */
  pixels = new Uint8ClampedArray(64 * 64 * 4);
  private readonly context = new FakeContext(this);

  /**
   * @returns The shared stub context.
   */
  getContext(): FakeContext {
    return this.context;
  }
}

/**
 * Builds synthetic blink info whose frames carry distinguishable bytes.
 *
 * @param mode - The blink mode.
 * @param frameCount - The number of prepared frames.
 * @param eyeHeight - The eye height for the optimized modes.
 * @returns The fabricated blink data.
 */
function makeInfo(
  mode: BlinkMode,
  frameCount: number,
  eyeHeight: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | null = null,
): BlinkInfo {
  const frames = Array.from({ length: frameCount }, (_, index) => {
    const image = createImage(64, 64);
    image.data.fill(index === 0 ? 0xa1 : 0xb2);
    return image;
  });
  return { mode, eyeHeight, frames };
}

/**
 * Builds a synthetic glow mask.
 *
 * @param value - The byte to fill.
 * @returns The mask.
 */
function makeMask(value: number): PixelData {
  const mask = createImage(64, 64);
  mask.data.fill(value);
  return mask;
}

describe("createBlinkPainter", () => {
  it("paints only the blink rectangles and marks the maps dirty", () => {
    const canvas = new FakeCanvas();
    canvas.pixels.fill(0x11);
    const markDirty = vi.fn();
    const repaints: (PixelData | null)[] = [];
    const maskA = makeMask(0x01);
    const glow: BlinkGlow = {
      openMask: makeMask(0x02),
      frameMasks: [maskA, null],
      repaint: (mask) => repaints.push(mask),
    };
    const painter = createBlinkPainter(
      canvas as unknown as HTMLCanvasElement,
      makeInfo(4, 2, 4),
      glow,
      markDirty,
    );

    painter.show(0);

    // Mode 4 with eye height 4 paints the row pair (8,11)-(15,12).
    expect(canvas.pixels[(11 * 64 + 8) * 4]).toBe(0xa1);
    expect(canvas.pixels[(12 * 64 + 15) * 4]).toBe(0xa1);
    expect(canvas.pixels[(10 * 64 + 8) * 4]).toBe(0x11);
    expect(canvas.pixels[(11 * 64 + 16) * 4]).toBe(0x11);
    expect(canvas.pixels[0]).toBe(0x11);
    expect(markDirty).toHaveBeenCalledTimes(1);
    expect(repaints).toEqual([maskA]);
  });

  it("treats the same frame as a no-op", () => {
    const canvas = new FakeCanvas();
    canvas.pixels.fill(0x11);
    const markDirty = vi.fn();
    const painter = createBlinkPainter(
      canvas as unknown as HTMLCanvasElement,
      makeInfo(4, 2, 4),
      null,
      markDirty,
    );

    painter.show(0);
    painter.show(0);

    expect(markDirty).toHaveBeenCalledTimes(1);
  });

  it("restores the exact pre-blink snapshot", () => {
    const canvas = new FakeCanvas();
    canvas.pixels.fill(0x11);
    const original = Uint8ClampedArray.from(canvas.pixels);
    const markDirty = vi.fn();
    const repaints: (PixelData | null)[] = [];
    const openMask = makeMask(0x02);
    const glow: BlinkGlow = {
      openMask,
      frameMasks: [makeMask(0x01), null],
      repaint: (mask) => repaints.push(mask),
    };
    const painter = createBlinkPainter(
      canvas as unknown as HTMLCanvasElement,
      makeInfo(5, 2, 3),
      glow,
      markDirty,
    );

    painter.show(0);
    expect(canvas.pixels).not.toEqual(original);
    painter.show(-1);

    expect(canvas.pixels).toEqual(original);
    expect(repaints[repaints.length - 1]).toBe(openMask);
  });

  it("keeps restore idempotent and silent before the first show", () => {
    const canvas = new FakeCanvas();
    canvas.pixels.fill(0x11);
    const markDirty = vi.fn();
    const painter = createBlinkPainter(
      canvas as unknown as HTMLCanvasElement,
      makeInfo(1, 1),
      null,
      markDirty,
    );

    painter.show(-1);
    expect(markDirty).not.toHaveBeenCalled();

    painter.show(0);
    painter.restore();
    painter.restore();
    expect(markDirty).toHaveBeenCalledTimes(2);
  });

  it("switches the per-frame glow masks, including the null frame", () => {
    const canvas = new FakeCanvas();
    canvas.pixels.fill(0x11);
    const repaints: (PixelData | null)[] = [];
    const maskA = makeMask(0x01);
    const glow: BlinkGlow = {
      openMask: makeMask(0x02),
      frameMasks: [maskA, null],
      repaint: (mask) => repaints.push(mask),
    };
    const painter = createBlinkPainter(
      canvas as unknown as HTMLCanvasElement,
      makeInfo(4, 2, 4),
      glow,
      vi.fn(),
    );

    painter.show(1);
    painter.show(0);
    painter.show(-1);

    expect(repaints).toEqual([null, maskA, glow.openMask]);
  });
});
