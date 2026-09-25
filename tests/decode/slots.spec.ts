import { describe, expect, it } from "vitest";
import { setPixel } from "../../src/decode/core/pixels";
import type { PaletteId } from "../../src/decode/core/types";
import { readChoice, readSlots } from "../../src/decode/format/slots";
import { createMarkedSkin, paintSlot } from "../fixtures/synthetic";

const ALL_UNSET = {
  blink: null,
  jacketStyle: null,
  jacketLength: null,
  eyeHeight: null,
  cape: null,
  nose: null,
  forcedSolid: null,
};

describe("choice slots", () => {
  it("resolves exact palette matches", () => {
    const skin = createMarkedSkin();
    paintSlot(skin, "blink", 5);
    paintSlot(skin, "jacketStyle", 2);
    paintSlot(skin, "jacketLength", 3);
    paintSlot(skin, "eyeHeight", 5);
    expect(readSlots(skin)).toEqual({
      blink: 5,
      jacketStyle: 2,
      jacketLength: 3,
      eyeHeight: 5,
      cape: null,
      nose: null,
      forcedSolid: null,
    });
  });

  it("reads the dead cape slot for diagnostics", () => {
    const skin = createMarkedSkin();
    paintSlot(skin, "cape", 1);
    expect(readSlots(skin).cape).toBe(1);
  });

  it("treats alpha variants, placeholder grays and transparency as unset", () => {
    const skin = createMarkedSkin();
    setPixel(skin, 52, 16, [255, 0, 255, 254]);
    setPixel(skin, 52, 17, [64, 64, 64, 255]);
    setPixel(skin, 52, 18, [0, 0, 0, 0]);
    expect(readSlots(skin)).toEqual(ALL_UNSET);
  });

  it("does not resolve the raw type-9 nose pixel as a palette color", () => {
    const skin = createMarkedSkin();
    setPixel(skin, 53, 17, [9, 0, 0, 0]);
    expect(readChoice(skin, 53, 17)).toBeNull();
    expect(readSlots(skin).nose).toBeNull();
  });

  it("resolves every palette entry", () => {
    const ids: PaletteId[] = [1, 2, 3, 4, 5, 6, 7, 8, 666];
    for (const id of ids) {
      const skin = createMarkedSkin();
      paintSlot(skin, "blink", id);
      expect(readSlots(skin).blink).toBe(id);
    }
  });
});
