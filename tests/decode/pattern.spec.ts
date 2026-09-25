import { describe, expect, it } from "vitest";
import { MARKER_BOXES } from "../../src/decode/core/constants";
import { setPixel } from "../../src/decode/core/pixels";
import type { PatternInfo, PixelData } from "../../src/decode/core/types";
import { selectBox } from "../../src/decode/features/pattern";
import { decodeSkin } from "../../src/decode/index";
import { fixturesAvailable, loadSkin } from "../fixtures/skins";
import { createMarkedSkin, paintCell } from "../fixtures/synthetic";

/**
 * Requires a decoded pattern.
 *
 * @param pattern - The pattern under test.
 * @returns The pattern, typed as non-null.
 */
function requirePattern(pattern: PatternInfo | null): PatternInfo {
  if (pattern === null) {
    throw new Error("expected a pattern");
  }
  return pattern;
}

/**
 * Counts the non-transparent pixels of an overlay.
 *
 * @param image - The overlay to scan.
 * @returns The number of non-transparent pixels.
 */
function countOpaque(image: PixelData): number {
  let count = 0;
  for (let index = 3; index < image.data.length; index += 4) {
    if (image.data[index] !== 0) {
      count++;
    }
  }
  return count;
}

describe("pattern", () => {
  it("selects the box of the first matching cell", () => {
    expect(selectBox([null, 1, null, null], 1)).toEqual(MARKER_BOXES[1]);
    expect(selectBox([1, 1, null, null], 1)).toEqual(MARKER_BOXES[0]);
    expect(selectBox([null, null, null, null], 1)).toBeNull();
  });

  it("collects keys and keeps every exact match in the mask", () => {
    const skin = createMarkedSkin();
    paintCell(skin, 0, 1);
    const box = MARKER_BOXES[0];
    setPixel(skin, box.x1, box.y1, [12, 34, 56, 255]);
    setPixel(skin, box.x1 + 1, box.y1, [12, 34, 56, 255]);
    setPixel(skin, box.x1 + 2, box.y1, [0, 0, 0, 0]);
    setPixel(skin, 20, 20, [12, 34, 56, 255]);
    setPixel(skin, 21, 20, [12, 34, 56, 254]);
    const result = decodeSkin(skin);
    const emissive = requirePattern(result.emissive);
    expect(emissive.keys).toEqual([[12, 34, 56, 255]]);
    expect(countOpaque(emissive.mask)).toBe(3);
    expect(
      emissive.mask.data
        .slice((64 * 20 + 21) * 4, (64 * 20 + 21) * 4 + 4)
        .every((value) => value === 0),
    ).toBe(true);
    expect(result.enchanted).toBeNull();
  });

  it("turns a pattern off when its box is empty", () => {
    const skin = createMarkedSkin();
    paintCell(skin, 0, 1);
    expect(decodeSkin(skin).emissive).toBeNull();
  });

  it("resolves emissive and enchanted independently", () => {
    const skin = createMarkedSkin();
    paintCell(skin, 0, 1);
    paintCell(skin, 1, 2);
    setPixel(skin, 56, 16, [9, 9, 9, 255]);
    setPixel(skin, 56, 24, [8, 8, 8, 255]);
    const result = decodeSkin(skin);
    const emissive = requirePattern(result.emissive);
    const enchanted = requirePattern(result.enchanted);
    expect(emissive.box).toEqual(MARKER_BOXES[0]);
    expect(enchanted.box).toEqual(MARKER_BOXES[1]);
    expect(countOpaque(emissive.mask)).toBe(1);
    expect(countOpaque(enchanted.mask)).toBe(1);
  });
});

describe.skipIf(!fixturesAvailable)("pattern fixtures", () => {
  // Key counts and mask pixel counts, verified against the example
  // skins. Wizard's enchant mask shrinks by two pixels because its
  // moved coat clears two matching leg pixels first.
  const cases = [
    ["alex.png", 14, 225, 12, 395],
    ["ghost.png", 1, 5, 1, 57],
    ["robot.png", 8, 136, null, null],
    ["slime.png", 4, 8, null, null],
    ["steve.png", 5, 119, 9, 459],
    ["steve2.png", 5, 121, 9, 459],
    ["thanos.png", 6, 15, 1, 66],
    ["wizard.png", 3, 376, 25, 233],
  ] as const;

  for (const [name, eKeys, ePixels, qKeys, qPixels] of cases) {
    it(`matches the baseline for ${name}`, () => {
      const result = decodeSkin(loadSkin(name));
      if (eKeys === null) {
        expect(result.emissive).toBeNull();
      } else {
        const emissive = requirePattern(result.emissive);
        expect(emissive.keys).toHaveLength(eKeys);
        expect(countOpaque(emissive.mask)).toBe(ePixels);
      }
      if (qKeys === null) {
        expect(result.enchanted).toBeNull();
      } else {
        const enchanted = requirePattern(result.enchanted);
        expect(enchanted.keys).toHaveLength(qKeys);
        expect(countOpaque(enchanted.mask)).toBe(qPixels);
      }
    });
  }
});
