import { describe, expect, it } from "vitest";
import { getPixel, setPixel } from "../../src/decode/core/pixels";
import { decodeJacket } from "../../src/decode/features/jacket";
import { decodeSkin } from "../../src/decode/index";
import { fixturesAvailable, loadSkin } from "../fixtures/skins";
import { createMarkedSkin, paintSlot } from "../fixtures/synthetic";

describe("jacket", () => {
  it("maps every style id to its flags", () => {
    const expected = [
      [1, false, false, true],
      [2, false, true, true],
      [3, true, false, true],
      [4, true, true, true],
      [5, false, false, false],
      [6, false, true, false],
      [7, true, false, false],
      [8, true, true, false],
    ] as const;
    for (const [id, fat, moved, top] of expected) {
      const skin = createMarkedSkin();
      const result = decodeJacket(skin, id, 4);
      expect(result.info).toMatchObject({
        style: id,
        length: 4,
        fat,
        moved,
        top,
      });
    }
  });

  it("clamps unset and out-of-range lengths to 1", () => {
    const skin = createMarkedSkin();
    expect(decodeJacket(skin, 1, null).info?.length).toBe(1);
    expect(decodeJacket(skin, 1, 666).info?.length).toBe(1);
    expect(decodeJacket(skin, 1, 8).info?.length).toBe(8);
    expect(decodeJacket(skin, null, 3).info).toBeNull();
    expect(decodeJacket(skin, 666, 3).info).toBeNull();
    expect(decodeJacket(skin, 666, 3).removals).toEqual([]);
  });

  it("copies the leg sources into the coat texture", () => {
    const skin = createMarkedSkin();
    setPixel(skin, 4, 32, [1, 2, 3, 255]);
    setPixel(skin, 4, 37, [10, 11, 12, 255]);
    setPixel(skin, 4, 48, [21, 22, 23, 255]);
    setPixel(skin, 0, 36, [31, 32, 33, 255]);
    setPixel(skin, 0, 38, [34, 35, 36, 255]);
    setPixel(skin, 12, 36, [41, 42, 43, 255]);
    setPixel(skin, 4, 52, [51, 52, 53, 255]);
    setPixel(skin, 4, 54, [61, 62, 63, 255]);
    const { info } = decodeJacket(skin, 1, 3);
    if (info === null) {
      throw new Error("expected a coat");
    }
    expect(getPixel(info.texture, 20, 32)).toEqual([1, 2, 3, 255]);
    expect(getPixel(info.texture, 20, 37)).toEqual([10, 11, 12, 255]);
    expect(getPixel(info.texture, 24, 32)).toEqual([21, 22, 23, 255]);
    expect(getPixel(info.texture, 16, 36)).toEqual([31, 32, 33, 255]);
    expect(getPixel(info.texture, 16, 38)).toEqual([34, 35, 36, 255]);
    expect(getPixel(info.texture, 36, 36)).toEqual([41, 42, 43, 255]);
    expect(getPixel(info.texture, 24, 36)).toEqual([51, 52, 53, 255]);
    expect(getPixel(info.texture, 24, 38)).toEqual([61, 62, 63, 255]);
    expect(getPixel(info.texture, 0, 0)).toEqual([0, 0, 0, 0]);
  });

  it("skips the top faces for the styles without tops", () => {
    const skin = createMarkedSkin();
    setPixel(skin, 4, 32, [1, 2, 3, 255]);
    setPixel(skin, 0, 36, [31, 32, 33, 255]);
    const { info } = decodeJacket(skin, 5, 3);
    if (info === null) {
      throw new Error("expected a coat");
    }
    expect(info.top).toBe(false);
    expect(getPixel(info.texture, 20, 32)).toEqual([0, 0, 0, 0]);
    expect(getPixel(info.texture, 16, 36)).toEqual([31, 32, 33, 255]);
  });

  it("returns the moved-style removal rectangles", () => {
    const skin = createMarkedSkin();
    expect(decodeJacket(skin, 2, 3).removals).toEqual([
      { x1: 4, y1: 32, x2: 7, y2: 35 },
      { x1: 4, y1: 48, x2: 7, y2: 51 },
      { x1: 0, y1: 36, x2: 15, y2: 38 },
      { x1: 0, y1: 52, x2: 15, y2: 54 },
    ]);
    expect(decodeJacket(skin, 1, 3).removals).toEqual([]);
  });

  it("clears the moved sources on the decoded skin", () => {
    const skin = createMarkedSkin();
    setPixel(skin, 0, 38, [9, 9, 9, 255]);
    setPixel(skin, 0, 39, [9, 9, 9, 255]);
    paintSlot(skin, "jacketStyle", 2);
    paintSlot(skin, "jacketLength", 3);
    const result = decodeSkin(skin);
    expect(result.jacket).toMatchObject({ style: 2, length: 3, moved: true });
    expect(getPixel(result.skin, 0, 38)).toEqual([0, 0, 0, 0]);
    expect(getPixel(result.skin, 0, 39)).toEqual([9, 9, 9, 255]);
  });
});

describe.skipIf(!fixturesAvailable)("jacket fixtures", () => {
  const cases = [
    ["steve-hsu.png", 2, 3],
    ["steve-villager.png", 2, 8],
    ["big-dress.png", 3, 6],
    ["chieck-coat.png", 1, 4],
    ["coat.png", 1, 6],
    ["dress.png", 4, 8],
    ["dress2.png", 1, 4],
  ] as const;
  for (const [name, style, length] of cases) {
    it(`decodes ${name} as style ${style} length ${length}`, () => {
      const result = decodeSkin(loadSkin(name));
      expect(result.jacket).toMatchObject({ style, length });
      expect(result.jacket?.texture.width).toBe(64);
      expect(result.jacket?.texture.height).toBe(64);
    });
  }
});
