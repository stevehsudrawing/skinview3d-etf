/**
 * Blink painter specs: the shared fake canvas (see
 * `tests/fixtures/fake-canvas.ts`) mimics the `getImageData` /
 * `createImageData` / `putImageData` subset the canvas helpers use
 * (with the HTML-spec dirty-rectangle destination semantics), so
 * snapshot-once, rectangle scope, dirty marking and the idempotent
 * restore are asserted without a browser.
 */

import type { BlinkInfo, BlinkMode, PixelData } from "etf-skin-decoder";
import { createImage } from "etf-skin-decoder";
import { describe, expect, it, vi } from "vitest";
import {
  createBlinkPainter,
  type BlinkOverlay,
} from "../../src/render/features/blink";
import { FakeCanvas } from "../fixtures/fake-canvas";

/**
 * Builds synthetic blink info whose frames carry distinguishable bytes.
 *
 * @param mode - The blink mode.
 * @param frameCount - The number of prepared frames.
 * @param eyePosition - The eye position for the pixel-tall eye modes.
 * @returns The fabricated blink data.
 */
function makeInfo(
  mode: BlinkMode,
  frameCount: number,
  eyePosition: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | null = null,
): BlinkInfo {
  const frames = Array.from({ length: frameCount }, (_, index) => {
    const image = createImage(64, 64);
    image.data.fill(index === 0 ? 0xa1 : 0xb2);
    return image;
  });
  return { mode, eyePosition, frames };
}

/**
 * Builds a synthetic overlay mask.
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
    const overlay: BlinkOverlay = {
      openMask: makeMask(0x02),
      frameMasks: [maskA, null],
      repaint: (mask) => repaints.push(mask),
    };
    const painter = createBlinkPainter(
      canvas as unknown as HTMLCanvasElement,
      makeInfo(4, 2, 4),
      [overlay],
      markDirty,
    );

    painter.show(0);

    // Mode 4 with eye position 4 paints the row pair (8,11)-(15,12).
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
      [],
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
    const overlay: BlinkOverlay = {
      openMask,
      frameMasks: [makeMask(0x01), null],
      repaint: (mask) => repaints.push(mask),
    };
    const painter = createBlinkPainter(
      canvas as unknown as HTMLCanvasElement,
      makeInfo(5, 2, 3),
      [overlay],
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
      [],
      markDirty,
    );

    painter.show(-1);
    expect(markDirty).not.toHaveBeenCalled();

    painter.show(0);
    painter.restore();
    painter.restore();
    expect(markDirty).toHaveBeenCalledTimes(2);
  });

  it("switches the per-frame overlay masks of every overlay", () => {
    const canvas = new FakeCanvas();
    canvas.pixels.fill(0x11);
    const repaintsA: (PixelData | null)[] = [];
    const repaintsB: (PixelData | null)[] = [];
    const maskA = makeMask(0x01);
    const overlayA: BlinkOverlay = {
      openMask: makeMask(0x02),
      frameMasks: [maskA, null],
      repaint: (mask) => repaintsA.push(mask),
    };
    const openB = makeMask(0x03);
    const maskB = makeMask(0x04);
    const overlayB: BlinkOverlay = {
      openMask: openB,
      frameMasks: [null, maskB],
      repaint: (mask) => repaintsB.push(mask),
    };
    const painter = createBlinkPainter(
      canvas as unknown as HTMLCanvasElement,
      makeInfo(4, 2, 4),
      [overlayA, overlayB],
      vi.fn(),
    );

    painter.show(1);
    painter.show(0);
    painter.show(-1);

    expect(repaintsA).toEqual([null, maskA, overlayA.openMask]);
    expect(repaintsB).toEqual([maskB, null, openB]);
  });
});
