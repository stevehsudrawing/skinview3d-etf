import { describe, expect, it } from "vitest";
import { decodeSkin } from "../../src/decode/index";
import { checkSignature, readCells } from "../../src/decode/marker";
import { createImage, setPixel } from "../../src/decode/pixels";
import {
  createBlankSkin,
  createMarkedSkin,
  paintCell,
} from "../fixtures/synthetic";

describe("marker", () => {
  it("accepts the signature and reads the cells", () => {
    const skin = createMarkedSkin();
    paintCell(skin, 0, 1);
    paintCell(skin, 1, 2);
    expect(checkSignature(skin)).toBe(true);
    expect(readCells(skin)).toEqual([1, 2, null, null]);
  });

  it("rejects a single wrong signature pixel", () => {
    const skin = createMarkedSkin();
    setPixel(skin, 2, 16, [0, 0, 255, 255]);
    expect(checkSignature(skin)).toBe(false);
  });

  it("ignores the template's (3,19) pixel", () => {
    const skin = createMarkedSkin();
    setPixel(skin, 3, 19, [255, 0, 255, 255]);
    expect(checkSignature(skin)).toBe(true);
  });

  it("treats transparent cells as unset and keeps the marker valid", () => {
    const skin = createMarkedSkin();
    paintCell(skin, 0, null);
    paintCell(skin, 3, null);
    expect(checkSignature(skin)).toBe(true);
    expect(readCells(skin)).toEqual([null, null, null, null]);
  });

  it("rejects blank and non-64x64 skins", () => {
    expect(checkSignature(createBlankSkin())).toBe(false);
    expect(checkSignature(createImage(128, 128))).toBe(false);
    expect(checkSignature(createImage(64, 32))).toBe(false);
  });

  it("flags unsupported sizes through decodeSkin", () => {
    const hd = createImage(128, 128);
    const result = decodeSkin(hd);
    expect(result.supported).toBe(false);
    expect(result.warnings).toHaveLength(1);
    expect(result.hasMarker).toBe(false);
    expect(result.cells).toEqual([null, null, null, null]);
    expect(result.blink).toBeNull();
    expect(result.nose).toBeNull();
    expect(result.jacket).toBeNull();
    expect(result.emissive).toBeNull();
    expect(result.enchanted).toBeNull();
    expect(result.transparency).toEqual({
      enabled: false,
      forcedSolid: false,
    });
    expect(result.skin.width).toBe(128);
    expect(result.skin.height).toBe(128);
  });
});
