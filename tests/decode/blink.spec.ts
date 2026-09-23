import { describe, expect, it } from "vitest";
import { blinkNoseCuts, decodeBlinkMode } from "../../src/decode/blink";
import { DEPRECATED_NOSE_RECTS } from "../../src/decode/constants";
import { decodeSkin } from "../../src/decode/index";
import { getPixel, setPixel } from "../../src/decode/pixels";
import { fixturesAvailable, loadSkin } from "../fixtures/skins";
import {
  createMarkedSkin,
  paintRectWithPalette,
  paintSlot,
} from "../fixtures/synthetic";
import type { BlinkInfo, PixelData } from "../../src/decode/types";

/**
 * Requires a prepared frame from decoded blink data.
 *
 * @param blink - The decoded blink data.
 * @param index - The frame index.
 * @returns The frame, typed as non-null.
 */
function frameOf(blink: BlinkInfo | null, index: number): PixelData {
  const frame = blink?.frames[index] ?? null;
  if (frame === null) {
    throw new Error(`expected a blink frame at index ${index}`);
  }
  return frame;
}

describe("blink", () => {
  it("resolves modes 1-5 only", () => {
    for (const mode of [1, 2, 3, 4, 5] as const) {
      expect(decodeBlinkMode(mode)).toBe(mode);
    }
    expect(decodeBlinkMode(666)).toBeNull();
    expect(decodeBlinkMode(null)).toBeNull();
  });

  it("only queues nose cuts for the lazy modes", () => {
    expect(blinkNoseCuts(3)).toEqual([]);
    expect(blinkNoseCuts(1)).toHaveLength(1);
    expect(blinkNoseCuts(2)).toHaveLength(2);
  });

  it("builds one lazy frame from the stored corners (mode 1)", () => {
    const skin = createMarkedSkin();
    setPixel(skin, 0, 0, [1, 1, 1, 255]);
    setPixel(skin, 32, 0, [2, 2, 2, 255]);
    setPixel(skin, 24, 0, [3, 3, 3, 255]);
    paintSlot(skin, "blink", 1);
    const result = decodeSkin(skin);
    expect(result.blink).toMatchObject({ mode: 1, eyeHeight: null });
    expect(result.blink?.frames).toHaveLength(1);
    expect(getPixel(frameOf(result.blink, 0), 8, 8)).toEqual([1, 1, 1, 255]);
    expect(getPixel(frameOf(result.blink, 0), 40, 8)).toEqual([2, 2, 2, 255]);
  });

  it("adds the second lazy frame for mode 2", () => {
    const skin = createMarkedSkin();
    setPixel(skin, 0, 0, [1, 1, 1, 255]);
    setPixel(skin, 24, 0, [3, 3, 3, 255]);
    setPixel(skin, 56, 0, [4, 4, 4, 255]);
    paintSlot(skin, "blink", 2);
    const result = decodeSkin(skin);
    expect(result.blink).toMatchObject({ mode: 2, eyeHeight: null });
    expect(result.blink?.frames).toHaveLength(2);
    expect(getPixel(frameOf(result.blink, 0), 8, 8)).toEqual([1, 1, 1, 255]);
    expect(getPixel(frameOf(result.blink, 1), 8, 8)).toEqual([3, 3, 3, 255]);
    expect(getPixel(frameOf(result.blink, 1), 40, 8)).toEqual([4, 4, 4, 255]);
  });

  it("stamps the mode-3 strip across the chosen eye row", () => {
    const skin = createMarkedSkin();
    setPixel(skin, 12, 16, [11, 11, 11, 255]);
    setPixel(skin, 19, 16, [12, 12, 12, 255]);
    setPixel(skin, 40, 8, [99, 99, 99, 255]);
    paintSlot(skin, "blink", 3);
    paintSlot(skin, "eyeHeight", 5);
    const result = decodeSkin(skin);
    expect(result.blink).toMatchObject({ mode: 3, eyeHeight: 5 });
    expect(result.blink?.frames).toHaveLength(1);
    const frame = frameOf(result.blink, 0);
    expect(getPixel(frame, 8, 12)).toEqual([11, 11, 11, 255]);
    expect(getPixel(frame, 15, 12)).toEqual([12, 12, 12, 255]);
    expect(getPixel(frame, 40, 8)).toEqual([99, 99, 99, 255]);
  });

  it("uses both rows and both strips for modes 4 and 5", () => {
    const skin = createMarkedSkin();
    setPixel(skin, 12, 16, [21, 21, 21, 255]);
    setPixel(skin, 12, 18, [22, 22, 22, 255]);
    setPixel(skin, 36, 16, [23, 23, 23, 255]);
    paintSlot(skin, "blink", 4);
    paintSlot(skin, "eyeHeight", 4);
    const mode4 = decodeSkin(skin);
    expect(mode4.blink).toMatchObject({ mode: 4, eyeHeight: 4 });
    expect(getPixel(frameOf(mode4.blink, 0), 8, 11)).toEqual([21, 21, 21, 255]);
    expect(getPixel(frameOf(mode4.blink, 1), 8, 11)).toEqual([22, 22, 22, 255]);

    const skin5 = createMarkedSkin();
    setPixel(skin5, 12, 16, [31, 31, 31, 255]);
    setPixel(skin5, 36, 16, [32, 32, 32, 255]);
    paintSlot(skin5, "blink", 5);
    paintSlot(skin5, "eyeHeight", 3);
    const mode5 = decodeSkin(skin5);
    expect(mode5.blink).toMatchObject({ mode: 5, eyeHeight: 3 });
    expect(getPixel(frameOf(mode5.blink, 0), 8, 10)).toEqual([31, 31, 31, 255]);
    expect(getPixel(frameOf(mode5.blink, 1), 8, 10)).toEqual([32, 32, 32, 255]);
  });

  it("clamps unset or out-of-range eye heights to row 1", () => {
    const skin = createMarkedSkin();
    setPixel(skin, 12, 16, [11, 11, 11, 255]);
    paintSlot(skin, "blink", 3);
    const unset = decodeSkin(skin);
    expect(unset.blink).toMatchObject({ mode: 3, eyeHeight: 1 });
    expect(getPixel(frameOf(unset.blink, 0), 8, 8)).toEqual([11, 11, 11, 255]);

    const skinHigh = createMarkedSkin();
    setPixel(skinHigh, 12, 16, [11, 11, 11, 255]);
    paintSlot(skinHigh, "blink", 3);
    paintSlot(skinHigh, "eyeHeight", 666);
    expect(decodeSkin(skinHigh).blink).toMatchObject({ eyeHeight: 1 });
  });

  it("cuts the stored nose area when the hat nose pixels are removed", () => {
    const paintNose = (skin: PixelData): void => {
      paintRectWithPalette(skin, DEPRECATED_NOSE_RECTS.hat, 666);
    };
    const skin = createMarkedSkin();
    setPixel(skin, 35, 5, [77, 77, 77, 255]);
    setPixel(skin, 59, 5, [88, 88, 88, 255]);
    paintNose(skin);
    paintSlot(skin, "blink", 1);

    const mode1 = decodeSkin(skin);
    expect(getPixel(mode1.skin, 35, 5)).toEqual([0, 0, 0, 0]);
    expect(getPixel(mode1.skin, 59, 5)).toEqual([88, 88, 88, 255]);
    expect(getPixel(frameOf(mode1.blink, 0), 43, 13)).toEqual([0, 0, 0, 0]);

    const skin2 = createMarkedSkin();
    setPixel(skin2, 35, 5, [77, 77, 77, 255]);
    setPixel(skin2, 59, 5, [88, 88, 88, 255]);
    paintNose(skin2);
    paintSlot(skin2, "blink", 2);
    const mode2 = decodeSkin(skin2);
    expect(getPixel(mode2.skin, 35, 5)).toEqual([0, 0, 0, 0]);
    expect(getPixel(mode2.skin, 59, 5)).toEqual([0, 0, 0, 0]);
    expect(getPixel(frameOf(mode2.blink, 1), 43, 13)).toEqual([0, 0, 0, 0]);
  });

  it("keeps the stored corners untouched without a nose removal", () => {
    const skin = createMarkedSkin();
    setPixel(skin, 35, 5, [77, 77, 77, 255]);
    paintSlot(skin, "blink", 1);
    const result = decodeSkin(skin);
    expect(getPixel(result.skin, 35, 5)).toEqual([77, 77, 77, 255]);
    expect(getPixel(frameOf(result.blink, 0), 43, 13)).toEqual([
      77, 77, 77, 255,
    ]);
  });
});

describe.skipIf(!fixturesAvailable)("blink fixtures", () => {
  const cases = [
    ["blink-option1.png", 3, 1],
    ["blink-option2.png", 4, 2],
    ["blink-option3.png", 5, 2],
    ["cape.png", 4, 2],
    ["chicken.png", 2, 2],
    ["robot.png", 1, 1],
    ["thanos.png", 1, 1],
  ] as const;
  for (const [name, mode, frameCount] of cases) {
    it(`decodes ${name} as mode ${mode}`, () => {
      const result = decodeSkin(loadSkin(name));
      expect(result.blink?.mode).toBe(mode);
      expect(result.blink?.frames).toHaveLength(frameCount);
    });
  }
});
