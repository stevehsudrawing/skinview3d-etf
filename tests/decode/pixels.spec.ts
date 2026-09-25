import { describe, expect, it } from "vitest";
import {
  buildMask,
  clearRect,
  collectKeys,
  copyRect,
  countPixels,
  createImage,
  getPixel,
  setPixel,
  stripAlphaRect,
} from "../../src/decode/core/pixels";
import type { PixelData, RGBA } from "../../src/decode/core/types";

const RED: RGBA = [255, 0, 0, 255];
const BLUE: RGBA = [0, 0, 255, 255];
const HALF: RGBA = [10, 20, 30, 128];
const CLEAR: RGBA = [0, 0, 0, 0];

/**
 * Requires a non-null mask produced by `buildMask`.
 *
 * @param mask - The mask under test.
 * @returns The mask, typed as non-null.
 */
function requireMask(mask: PixelData | null): PixelData {
  if (mask === null) {
    throw new Error("expected a mask");
  }
  return mask;
}

describe("pixel helpers", () => {
  it("creates transparent images and round-trips pixels", () => {
    const image = createImage(4, 4);
    expect(getPixel(image, 1, 2)).toEqual(CLEAR);
    setPixel(image, 1, 2, RED);
    expect(getPixel(image, 1, 2)).toEqual(RED);
  });

  it("copies rectangles so the source top-left lands on the target", () => {
    const source = createImage(4, 4);
    setPixel(source, 1, 1, RED);
    setPixel(source, 2, 2, BLUE);
    const target = createImage(8, 8);
    copyRect(source, target, { x1: 1, y1: 1, x2: 2, y2: 2 }, 5, 5);
    expect(getPixel(target, 5, 5)).toEqual(RED);
    expect(getPixel(target, 6, 6)).toEqual(BLUE);
    expect(getPixel(target, 4, 4)).toEqual(CLEAR);
  });

  it("clears rectangles", () => {
    const image = createImage(4, 4);
    setPixel(image, 1, 1, RED);
    clearRect(image, { x1: 0, y1: 0, x2: 3, y2: 3 });
    expect(getPixel(image, 1, 1)).toEqual(CLEAR);
  });

  it("strips alpha while keeping rgb", () => {
    const image = createImage(2, 2);
    setPixel(image, 0, 0, HALF);
    stripAlphaRect(image, { x1: 0, y1: 0, x2: 1, y2: 1 });
    expect(getPixel(image, 0, 0)).toEqual([10, 20, 30, 255]);
  });

  it("collects distinct non-transparent keys in first-seen order", () => {
    const image = createImage(4, 1);
    setPixel(image, 0, 0, RED);
    setPixel(image, 1, 0, RED);
    setPixel(image, 2, 0, BLUE);
    setPixel(image, 3, 0, HALF);
    expect(collectKeys(image, { x1: 0, y1: 0, x2: 3, y2: 0 })).toEqual([
      RED,
      BLUE,
      HALF,
    ]);
  });

  it("skips fully transparent pixels when collecting keys", () => {
    const image = createImage(2, 1);
    expect(collectKeys(image, { x1: 0, y1: 0, x2: 1, y2: 0 })).toEqual([]);
  });

  it("builds masks that keep exact matches only", () => {
    const image = createImage(2, 2);
    setPixel(image, 0, 0, RED);
    setPixel(image, 1, 1, RED);
    setPixel(image, 0, 1, [255, 0, 0, 128]);
    const mask = requireMask(buildMask(image, [RED]));
    expect(getPixel(mask, 0, 0)).toEqual(RED);
    expect(getPixel(mask, 1, 1)).toEqual(RED);
    expect(getPixel(mask, 0, 1)).toEqual(CLEAR);
    expect(getPixel(mask, 1, 0)).toEqual(CLEAR);
  });

  it("returns a null mask when nothing matches", () => {
    const image = createImage(2, 2);
    setPixel(image, 0, 0, RED);
    expect(buildMask(image, [BLUE])).toBeNull();
    expect(buildMask(image, [])).toBeNull();
  });

  it("counts exact pixel matches", () => {
    const image = createImage(3, 1);
    setPixel(image, 0, 0, RED);
    setPixel(image, 1, 0, RED);
    setPixel(image, 2, 0, BLUE);
    expect(countPixels(image, RED)).toBe(2);
    expect(countPixels(image, BLUE)).toBe(1);
    expect(countPixels(image, CLEAR)).toBe(0);
  });
});
