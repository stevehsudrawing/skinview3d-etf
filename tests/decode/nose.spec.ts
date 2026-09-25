import { describe, expect, it } from "vitest";
import {
  DEPRECATED_NOSE_RECTS,
  NOSE_CAPE_REGIONS,
  NOSE_COLOR,
} from "../../src/decode/core/constants";
import { getPixel, sameColor, setPixel } from "../../src/decode/core/pixels";
import { decodeNose } from "../../src/decode/features/nose";
import { decodeSkin } from "../../src/decode/index";
import { fixturesAvailable, loadSkin } from "../fixtures/skins";
import {
  createMarkedSkin,
  paintRectWithPalette,
  paintSlot,
} from "../fixtures/synthetic";

describe("nose", () => {
  it("detects the deprecated hat nose and removes its pixels", () => {
    const skin = createMarkedSkin();
    paintRectWithPalette(skin, DEPRECATED_NOSE_RECTS.hat, 666);
    const result = decodeNose(skin, null);
    expect(result.info).toMatchObject({
      villager: true,
      villagerSkinTextured: false,
      variant: null,
      texture: null,
      removesSource: true,
    });
    expect(result.removals).toEqual([DEPRECATED_NOSE_RECTS.hat]);

    const decoded = decodeSkin(skin);
    for (let y = 13; y <= 15; y++) {
      for (let x = 43; x <= 44; x++) {
        expect(getPixel(decoded.skin, x, y)).toEqual([0, 0, 0, 0]);
      }
    }
  });

  it("keeps the deprecated face nose pixels", () => {
    const skin = createMarkedSkin();
    paintRectWithPalette(skin, DEPRECATED_NOSE_RECTS.face, 666);
    const result = decodeNose(skin, null);
    expect(result.info).toMatchObject({
      villager: true,
      removesSource: false,
    });
    expect(result.removals).toEqual([]);
    expect(getPixel(decodeSkin(skin).skin, 11, 13)).toEqual(NOSE_COLOR);
  });

  it("requires all six pixels of a deprecated rectangle", () => {
    const skin = createMarkedSkin();
    paintRectWithPalette(skin, DEPRECATED_NOSE_RECTS.hat, 666);
    setPixel(skin, 43, 13, [0, 0, 0, 0]);
    expect(decodeNose(skin, null).info).toBeNull();
  });

  it("maps the palette slot choices to the villager variants", () => {
    const cases = [
      { id: 1, skinTextured: false, removes: false },
      { id: 7, skinTextured: true, removes: false },
      { id: 8, skinTextured: false, removes: true },
    ] as const;
    for (const variant of cases) {
      const skin = createMarkedSkin();
      const result = decodeNose(skin, variant.id);
      expect(result.info).toMatchObject({
        villager: true,
        villagerSkinTextured: variant.skinTextured,
        variant: null,
        texture: null,
        removesSource: variant.removes,
      });
      expect(result.removals).toEqual(
        variant.removes ? [DEPRECATED_NOSE_RECTS.hat] : [],
      );
    }
  });

  it("resolves the raw type-9 pixel as villager-textured-remove", () => {
    const skin = createMarkedSkin();
    setPixel(skin, 53, 17, [9, 0, 0, 0]);
    const result = decodeSkin(skin);
    expect(result.nose).toMatchObject({
      villager: true,
      villagerSkinTextured: true,
      variant: null,
      removesSource: true,
    });
    expect(result.slots.nose).toBeNull();
    expect(result.nose?.texture).toBeNull();
  });

  it("builds textured noses 1-5 from the former cape regions", () => {
    for (const choice of [2, 3, 4, 5, 6] as const) {
      const variant = (choice - 1) as 1 | 2 | 3 | 4 | 5;
      const region = NOSE_CAPE_REGIONS[variant - 1];
      const skin = createMarkedSkin();
      paintSlot(skin, "nose", choice);
      for (let x = region.x1; x <= region.x2; x++) {
        for (let y = region.y1; y <= region.y2; y++) {
          setPixel(skin, x, y, [x * 10, (y - region.y1) * 50, variant, 255]);
        }
      }
      const result = decodeSkin(skin);
      expect(result.nose).toMatchObject({
        villager: false,
        variant,
        removesSource: false,
      });
      const texture = result.nose?.texture ?? null;
      expect(texture).not.toBeNull();
      if (texture === null) {
        throw new Error("expected a textured nose");
      }
      expect(texture.width).toBe(8);
      expect(texture.height).toBe(8);
      expect(getPixel(texture, 7, 4)).toEqual(getPixel(texture, 0, 4));
      expect(getPixel(texture, 7, 0)).toEqual(getPixel(texture, 0, 0));
    }
  });

  it("transposes, mirrors and swaps the 8x4 source deterministically", () => {
    const region = NOSE_CAPE_REGIONS[0];
    const skin = createMarkedSkin();
    paintSlot(skin, "nose", 2);
    for (let x = region.x1; x <= region.x2; x++) {
      for (let y = region.y1; y <= region.y2; y++) {
        setPixel(skin, x, y, [x * 10, (y - region.y1) * 50, 7, 255]);
      }
    }
    const texture = decodeSkin(skin).nose?.texture ?? null;
    expect(texture).not.toBeNull();
    if (texture === null) {
      throw new Error("expected a textured nose");
    }
    // dest(x, y) = source(x1 + y, y1 + x); mirrored to 8 wide, then
    // the top and bottom halves are swapped.
    expect(getPixel(texture, 0, 0)).toEqual([160, 0, 7, 255]);
    expect(getPixel(texture, 0, 4)).toEqual([120, 0, 7, 255]);
    expect(getPixel(texture, 0, 3)).toEqual([190, 0, 7, 255]);
    expect(getPixel(texture, 0, 7)).toEqual([150, 0, 7, 255]);
    expect(getPixel(texture, 7, 0)).toEqual([160, 0, 7, 255]);
    expect(getPixel(texture, 3, 4)).toEqual([120, 150, 7, 255]);
    expect(getPixel(texture, 4, 0)).toEqual([160, 150, 7, 255]);
  });
});

describe.skipIf(!fixturesAvailable)("nose fixtures", () => {
  it("decodes steve-villager's deprecated hat nose", () => {
    const original = loadSkin("steve-villager.png");
    const result = decodeSkin(original);
    expect(result.nose).toMatchObject({
      villager: true,
      villagerSkinTextured: false,
      variant: null,
      texture: null,
      removesSource: true,
    });
    for (let y = 13; y <= 15; y++) {
      for (let x = 43; x <= 44; x++) {
        expect(getPixel(result.skin, x, y)).toEqual([0, 0, 0, 0]);
      }
    }
    let faceNose = 0;
    for (let y = 13; y <= 15; y++) {
      for (let x = 11; x <= 12; x++) {
        if (sameColor(getPixel(original, x, y), NOSE_COLOR)) {
          faceNose++;
          expect(getPixel(result.skin, x, y)).toEqual(NOSE_COLOR);
        }
      }
    }
    expect(faceNose).toBe(2);
  });
});
