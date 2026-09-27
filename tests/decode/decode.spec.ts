import { describe, expect, it } from "vitest";
import { FORCED_SOLID_RECTS } from "../../src/decode/core/constants";
import { createImage, getPixel, setPixel } from "../../src/decode/core/pixels";
import type { BlinkMode, PaletteId } from "../../src/decode/core/types";
import { decodeSkin } from "../../src/decode/index";
import { fixturesAvailable, loadSkin } from "../fixtures/skins";
import {
  createBlankSkin,
  createMarkedSkin,
  paintSlot,
} from "../fixtures/synthetic";

/** Expected jacket values for one fixture. */
interface JacketExpectation {
  /** Jacket style id. */
  style: number;
  /** Clamped length value. */
  length: number;
  /** Wide model flag. */
  wide: boolean;
  /** Moved-source flag. */
  moved: boolean;
  /** Top-faces flag. */
  top: boolean;
}

/** Expected nose values for one fixture. */
interface NoseExpectation {
  /** Villager nose flag. */
  villager: boolean;
  /** The textured selection 1-5, or `null`. */
  textured: number | null;
  /** Remove-face-pixels flag. */
  removesFacePixels: boolean;
}

/** One fixture-matrix row. */
interface FixtureExpectation {
  /** Fixture file name. */
  name: string;
  /** Marker cells in upstream order. */
  cells: (PaletteId | null)[];
  /** Blink mode, or `null`. */
  blink: BlinkMode | null;
  /** Eye position, or `null`. */
  eyePosition: number | null;
  /** Jacket expectation, or `null`. */
  jacket: JacketExpectation | null;
  /** Nose expectation, or `null`. */
  nose: NoseExpectation | null;
  /** Whether emissive is on. */
  emissive: boolean;
  /** Whether enchanted is on. */
  enchanted: boolean;
}

const PINK_CYAN: (PaletteId | null)[] = [1, 2, null, null];
const PINK_ONLY: (PaletteId | null)[] = [1, null, null, null];
const NO_CELLS: (PaletteId | null)[] = [null, null, null, null];

const MATRIX: readonly FixtureExpectation[] = [
  {
    name: "alex.png",
    cells: PINK_CYAN,
    blink: 1,
    eyePosition: null,
    jacket: null,
    nose: null,
    emissive: true,
    enchanted: true,
  },
  {
    name: "amogus.png",
    cells: NO_CELLS,
    blink: null,
    eyePosition: null,
    jacket: null,
    nose: null,
    emissive: false,
    enchanted: false,
  },
  {
    name: "big-dress.png",
    cells: NO_CELLS,
    blink: null,
    eyePosition: null,
    jacket: { style: 3, length: 6, wide: true, moved: false, top: true },
    nose: null,
    emissive: false,
    enchanted: false,
  },
  {
    name: "blink-option1.png",
    cells: NO_CELLS,
    blink: 3,
    eyePosition: 5,
    jacket: null,
    nose: null,
    emissive: false,
    enchanted: false,
  },
  {
    name: "blink-option2.png",
    cells: NO_CELLS,
    blink: 4,
    eyePosition: 4,
    jacket: null,
    nose: null,
    emissive: false,
    enchanted: false,
  },
  {
    name: "blink-option3.png",
    cells: NO_CELLS,
    blink: 5,
    eyePosition: 3,
    jacket: null,
    nose: null,
    emissive: false,
    enchanted: false,
  },
  {
    name: "cape.png",
    cells: NO_CELLS,
    blink: 4,
    eyePosition: 4,
    jacket: null,
    nose: null,
    emissive: false,
    enchanted: false,
  },
  {
    name: "chicken.png",
    cells: NO_CELLS,
    blink: 2,
    eyePosition: null,
    jacket: null,
    nose: null,
    emissive: false,
    enchanted: false,
  },
  {
    name: "chieck-coat.png",
    cells: NO_CELLS,
    blink: 2,
    eyePosition: null,
    jacket: { style: 1, length: 4, wide: false, moved: false, top: true },
    nose: null,
    emissive: false,
    enchanted: false,
  },
  {
    name: "coat.png",
    cells: NO_CELLS,
    blink: 1,
    eyePosition: null,
    jacket: { style: 1, length: 6, wide: false, moved: false, top: true },
    nose: null,
    emissive: false,
    enchanted: false,
  },
  {
    name: "dress.png",
    cells: NO_CELLS,
    blink: null,
    eyePosition: null,
    jacket: { style: 4, length: 8, wide: true, moved: true, top: true },
    nose: null,
    emissive: false,
    enchanted: false,
  },
  {
    name: "dress2.png",
    cells: NO_CELLS,
    blink: null,
    eyePosition: null,
    jacket: { style: 1, length: 4, wide: false, moved: false, top: true },
    nose: null,
    emissive: false,
    enchanted: false,
  },
  {
    name: "ghost.png",
    cells: PINK_CYAN,
    blink: null,
    eyePosition: null,
    jacket: null,
    nose: null,
    emissive: true,
    enchanted: true,
  },
  {
    name: "robot.png",
    cells: PINK_ONLY,
    blink: 1,
    eyePosition: null,
    jacket: null,
    nose: null,
    emissive: true,
    enchanted: false,
  },
  {
    name: "skelly.png",
    cells: NO_CELLS,
    blink: null,
    eyePosition: null,
    jacket: null,
    nose: null,
    emissive: false,
    enchanted: false,
  },
  {
    name: "slime.png",
    cells: PINK_ONLY,
    blink: 2,
    eyePosition: null,
    jacket: { style: 1, length: 1, wide: false, moved: false, top: true },
    nose: null,
    emissive: true,
    enchanted: false,
  },
  {
    name: "steve-hsu.png",
    cells: NO_CELLS,
    blink: 5,
    eyePosition: 5,
    jacket: { style: 2, length: 3, wide: false, moved: true, top: true },
    nose: null,
    emissive: false,
    enchanted: false,
  },
  {
    name: "steve-villager.png",
    cells: NO_CELLS,
    blink: 4,
    eyePosition: 4,
    jacket: { style: 2, length: 8, wide: false, moved: true, top: true },
    nose: { villager: true, textured: null, removesFacePixels: true },
    emissive: false,
    enchanted: false,
  },
  {
    name: "steve.png",
    cells: PINK_CYAN,
    blink: 1,
    eyePosition: null,
    jacket: { style: 1, length: 1, wide: false, moved: false, top: true },
    nose: null,
    emissive: true,
    enchanted: true,
  },
  {
    name: "steve2.png",
    cells: PINK_CYAN,
    blink: 1,
    eyePosition: null,
    jacket: { style: 2, length: 1, wide: false, moved: true, top: true },
    nose: null,
    emissive: true,
    enchanted: true,
  },
  {
    name: "thanos.png",
    cells: PINK_CYAN,
    blink: 1,
    eyePosition: null,
    jacket: null,
    nose: null,
    emissive: true,
    enchanted: true,
  },
  {
    name: "wizard.png",
    cells: PINK_CYAN,
    blink: null,
    eyePosition: null,
    jacket: { style: 2, length: 1, wide: false, moved: true, top: true },
    nose: null,
    emissive: true,
    enchanted: true,
  },
];

describe("decodeSkin", () => {
  it("decodes a marker-less skin as feature-free", () => {
    const blank = createBlankSkin();
    const result = decodeSkin(blank);
    expect(result.supported).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.hasMarker).toBe(false);
    expect(result.cells).toEqual([null, null, null, null]);
    expect(result.slots).toEqual({
      blink: null,
      jacketStyle: null,
      jacketLength: null,
      eyePosition: null,
      cape: null,
      nose: null,
      forcedSolid: null,
    });
    expect(result.transparency).toEqual({
      enabled: false,
      forcedSolid: false,
    });
    expect(result.blink).toBeNull();
    expect(result.nose).toBeNull();
    expect(result.jacket).toBeNull();
    expect(result.emissive).toBeNull();
    expect(result.enchanted).toBeNull();
    expect(result.skin.data).toEqual(blank.data);
  });

  it("throws on malformed buffers", () => {
    const image = createImage(64, 64);
    expect(() =>
      decodeSkin({
        width: 64,
        height: 64,
        data: image.data.slice(0, 100),
      }),
    ).toThrow(TypeError);
    expect(() =>
      decodeSkin({ width: 0, height: 0, data: new Uint8ClampedArray(0) }),
    ).toThrow(TypeError);
    expect(() =>
      decodeSkin({ width: 64.5, height: 64, data: image.data }),
    ).toThrow(TypeError);
  });

  it("strips the forced-solid alpha", () => {
    const skin = createMarkedSkin();
    paintSlot(skin, "forcedSolid", 1);
    // One transparent pixel inside the first forced-solid rectangle
    // and one outside every rectangle.
    const inside = FORCED_SOLID_RECTS[0].topLeft;
    const outside = { x: 30, y: 0 };
    setPixel(skin, inside.x, inside.y, [10, 20, 30, 0]);
    setPixel(skin, outside.x, outside.y, [10, 20, 30, 0]);
    const result = decodeSkin(skin);
    expect(result.transparency).toEqual({ enabled: true, forcedSolid: true });
    expect(getPixel(result.skin, inside.x, inside.y)).toEqual([
      10, 20, 30, 255,
    ]);
    expect(getPixel(result.skin, outside.x, outside.y)).toEqual([
      10, 20, 30, 0,
    ]);
  });
});

describe.skipIf(!fixturesAvailable)("fixture matrix", () => {
  for (const row of MATRIX) {
    it(`decodes ${row.name}`, () => {
      const result = decodeSkin(loadSkin(row.name));
      expect(result.supported).toBe(true);
      expect(result.warnings).toEqual([]);
      expect(result.hasMarker).toBe(true);
      expect(result.cells).toEqual(row.cells);
      expect(result.blink?.mode ?? null).toBe(row.blink);
      expect(result.blink?.eyePosition ?? null).toBe(row.eyePosition);
      if (row.jacket === null) {
        expect(result.jacket).toBeNull();
      } else {
        expect(result.jacket).toMatchObject(row.jacket);
        expect(result.jacket?.texture.width).toBe(64);
        expect(result.jacket?.texture.height).toBe(64);
      }
      if (row.nose === null) {
        expect(result.nose).toBeNull();
      } else {
        expect(result.nose).toMatchObject(row.nose);
      }
      expect(result.emissive !== null).toBe(row.emissive);
      expect(result.enchanted !== null).toBe(row.enchanted);
    });
  }

  it("decodes steve-hsu pixel-exactly", () => {
    const original = loadSkin("steve-hsu.png");
    const result = decodeSkin(original);
    expect(result.supported).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.hasMarker).toBe(true);
    expect(result.cells).toEqual([null, null, null, null]);
    expect(result.slots).toEqual({
      blink: 5,
      jacketStyle: 2,
      jacketLength: 3,
      eyePosition: 5,
      cape: null,
      nose: null,
      forcedSolid: null,
    });
    expect(result.blink).toMatchObject({ mode: 5, eyePosition: 5 });
    expect(result.jacket).toMatchObject({
      style: 2,
      length: 3,
      wide: false,
      moved: true,
      top: true,
    });
    expect(result.nose).toBeNull();
    expect(result.emissive).toBeNull();
    expect(result.enchanted).toBeNull();
    expect(result.transparency).toEqual({
      enabled: true,
      forcedSolid: false,
    });

    const removals = [
      { topLeft: { x: 4, y: 32 }, bottomRight: { x: 7, y: 35 } },
      { topLeft: { x: 4, y: 48 }, bottomRight: { x: 7, y: 51 } },
      { topLeft: { x: 0, y: 36 }, bottomRight: { x: 15, y: 38 } },
      { topLeft: { x: 0, y: 52 }, bottomRight: { x: 15, y: 54 } },
    ];
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const inside = removals.some(
          (rect) =>
            x >= rect.topLeft.x &&
            x <= rect.bottomRight.x &&
            y >= rect.topLeft.y &&
            y <= rect.bottomRight.y,
        );
        if (inside) {
          expect(getPixel(result.skin, x, y)).toEqual([0, 0, 0, 0]);
        } else {
          expect(getPixel(result.skin, x, y)).toEqual(getPixel(original, x, y));
        }
      }
    }
  });

  it("applies steve-villager's nose and jacket removals", () => {
    const original = loadSkin("steve-villager.png");
    const result = decodeSkin(original);
    const removals = [
      { topLeft: { x: 43, y: 13 }, bottomRight: { x: 44, y: 15 } },
      { topLeft: { x: 4, y: 32 }, bottomRight: { x: 7, y: 35 } },
      { topLeft: { x: 4, y: 48 }, bottomRight: { x: 7, y: 51 } },
      { topLeft: { x: 0, y: 36 }, bottomRight: { x: 15, y: 43 } },
      { topLeft: { x: 0, y: 52 }, bottomRight: { x: 15, y: 59 } },
    ];
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const inside = removals.some(
          (rect) =>
            x >= rect.topLeft.x &&
            x <= rect.bottomRight.x &&
            y >= rect.topLeft.y &&
            y <= rect.bottomRight.y,
        );
        if (inside) {
          expect(getPixel(result.skin, x, y)).toEqual([0, 0, 0, 0]);
        } else {
          expect(getPixel(result.skin, x, y)).toEqual(getPixel(original, x, y));
        }
      }
    }
  });

  it("surfaces the dead cape slot for diagnostics", () => {
    const result = decodeSkin(loadSkin("cape.png"));
    expect(result.slots.cape).toBe(1);
  });
});
