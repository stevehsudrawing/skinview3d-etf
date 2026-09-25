import { describe, expect, it } from "vitest";
import { createImage, getPixel } from "../../src/decode/core/pixels";
import type { BlinkMode, PaletteId } from "../../src/decode/core/types";
import { decodeSkin } from "../../src/decode/index";
import { fixturesAvailable, loadSkin } from "../fixtures/skins";
import { createBlankSkin } from "../fixtures/synthetic";

/** Expected jacket values for one fixture. */
interface JacketExpectation {
  /** Coat style id. */
  style: number;
  /** Clamped length value. */
  length: number;
  /** Fat model flag. */
  fat: boolean;
  /** Moved-source flag. */
  moved: boolean;
  /** Top-faces flag. */
  top: boolean;
}

/** Expected nose values for one fixture. */
interface NoseExpectation {
  /** Villager nose flag. */
  villager: boolean;
  /** Textured variant, or `null`. */
  variant: number | null;
  /** Source-removal flag. */
  removesSource: boolean;
}

/** One fixture-matrix row. */
interface FixtureExpectation {
  /** Fixture file name. */
  name: string;
  /** Marker cells in upstream order. */
  cells: (PaletteId | null)[];
  /** Blink mode, or `null`. */
  blink: BlinkMode | null;
  /** Eye height, or `null`. */
  eyeHeight: number | null;
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
    eyeHeight: null,
    jacket: null,
    nose: null,
    emissive: true,
    enchanted: true,
  },
  {
    name: "amogus.png",
    cells: NO_CELLS,
    blink: null,
    eyeHeight: null,
    jacket: null,
    nose: null,
    emissive: false,
    enchanted: false,
  },
  {
    name: "big-dress.png",
    cells: NO_CELLS,
    blink: null,
    eyeHeight: null,
    jacket: { style: 3, length: 6, fat: true, moved: false, top: true },
    nose: null,
    emissive: false,
    enchanted: false,
  },
  {
    name: "blink-option1.png",
    cells: NO_CELLS,
    blink: 3,
    eyeHeight: 5,
    jacket: null,
    nose: null,
    emissive: false,
    enchanted: false,
  },
  {
    name: "blink-option2.png",
    cells: NO_CELLS,
    blink: 4,
    eyeHeight: 4,
    jacket: null,
    nose: null,
    emissive: false,
    enchanted: false,
  },
  {
    name: "blink-option3.png",
    cells: NO_CELLS,
    blink: 5,
    eyeHeight: 3,
    jacket: null,
    nose: null,
    emissive: false,
    enchanted: false,
  },
  {
    name: "cape.png",
    cells: NO_CELLS,
    blink: 4,
    eyeHeight: 4,
    jacket: null,
    nose: null,
    emissive: false,
    enchanted: false,
  },
  {
    name: "chicken.png",
    cells: NO_CELLS,
    blink: 2,
    eyeHeight: null,
    jacket: null,
    nose: null,
    emissive: false,
    enchanted: false,
  },
  {
    name: "chieck-coat.png",
    cells: NO_CELLS,
    blink: 2,
    eyeHeight: null,
    jacket: { style: 1, length: 4, fat: false, moved: false, top: true },
    nose: null,
    emissive: false,
    enchanted: false,
  },
  {
    name: "coat.png",
    cells: NO_CELLS,
    blink: 1,
    eyeHeight: null,
    jacket: { style: 1, length: 6, fat: false, moved: false, top: true },
    nose: null,
    emissive: false,
    enchanted: false,
  },
  {
    name: "dress.png",
    cells: NO_CELLS,
    blink: null,
    eyeHeight: null,
    jacket: { style: 4, length: 8, fat: true, moved: true, top: true },
    nose: null,
    emissive: false,
    enchanted: false,
  },
  {
    name: "dress2.png",
    cells: NO_CELLS,
    blink: null,
    eyeHeight: null,
    jacket: { style: 1, length: 4, fat: false, moved: false, top: true },
    nose: null,
    emissive: false,
    enchanted: false,
  },
  {
    name: "ghost.png",
    cells: PINK_CYAN,
    blink: null,
    eyeHeight: null,
    jacket: null,
    nose: null,
    emissive: true,
    enchanted: true,
  },
  {
    name: "robot.png",
    cells: PINK_ONLY,
    blink: 1,
    eyeHeight: null,
    jacket: null,
    nose: null,
    emissive: true,
    enchanted: false,
  },
  {
    name: "skelly.png",
    cells: NO_CELLS,
    blink: null,
    eyeHeight: null,
    jacket: null,
    nose: null,
    emissive: false,
    enchanted: false,
  },
  {
    name: "slime.png",
    cells: PINK_ONLY,
    blink: 2,
    eyeHeight: null,
    jacket: { style: 1, length: 1, fat: false, moved: false, top: true },
    nose: null,
    emissive: true,
    enchanted: false,
  },
  {
    name: "steve-hsu.png",
    cells: NO_CELLS,
    blink: 5,
    eyeHeight: 5,
    jacket: { style: 2, length: 3, fat: false, moved: true, top: true },
    nose: null,
    emissive: false,
    enchanted: false,
  },
  {
    name: "steve-villager.png",
    cells: NO_CELLS,
    blink: 4,
    eyeHeight: 4,
    jacket: { style: 2, length: 8, fat: false, moved: true, top: true },
    nose: { villager: true, variant: null, removesSource: true },
    emissive: false,
    enchanted: false,
  },
  {
    name: "steve.png",
    cells: PINK_CYAN,
    blink: 1,
    eyeHeight: null,
    jacket: { style: 1, length: 1, fat: false, moved: false, top: true },
    nose: null,
    emissive: true,
    enchanted: true,
  },
  {
    name: "steve2.png",
    cells: PINK_CYAN,
    blink: 1,
    eyeHeight: null,
    jacket: { style: 2, length: 1, fat: false, moved: true, top: true },
    nose: null,
    emissive: true,
    enchanted: true,
  },
  {
    name: "thanos.png",
    cells: PINK_CYAN,
    blink: 1,
    eyeHeight: null,
    jacket: null,
    nose: null,
    emissive: true,
    enchanted: true,
  },
  {
    name: "wizard.png",
    cells: PINK_CYAN,
    blink: null,
    eyeHeight: null,
    jacket: { style: 2, length: 1, fat: false, moved: true, top: true },
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
      eyeHeight: null,
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
      expect(result.blink?.eyeHeight ?? null).toBe(row.eyeHeight);
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
      eyeHeight: 5,
      cape: null,
      nose: null,
      forcedSolid: null,
    });
    expect(result.blink).toMatchObject({ mode: 5, eyeHeight: 5 });
    expect(result.jacket).toMatchObject({
      style: 2,
      length: 3,
      fat: false,
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
      { x1: 4, y1: 32, x2: 7, y2: 35 },
      { x1: 4, y1: 48, x2: 7, y2: 51 },
      { x1: 0, y1: 36, x2: 15, y2: 38 },
      { x1: 0, y1: 52, x2: 15, y2: 54 },
    ];
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const inside = removals.some(
          (rect) =>
            x >= rect.x1 && x <= rect.x2 && y >= rect.y1 && y <= rect.y2,
        );
        if (inside) {
          expect(getPixel(result.skin, x, y)).toEqual([0, 0, 0, 0]);
        } else {
          expect(getPixel(result.skin, x, y)).toEqual(getPixel(original, x, y));
        }
      }
    }
  });

  it("applies steve-villager's nose and coat removals", () => {
    const original = loadSkin("steve-villager.png");
    const result = decodeSkin(original);
    const removals = [
      { x1: 43, y1: 13, x2: 44, y2: 15 },
      { x1: 4, y1: 32, x2: 7, y2: 35 },
      { x1: 4, y1: 48, x2: 7, y2: 51 },
      { x1: 0, y1: 36, x2: 15, y2: 43 },
      { x1: 0, y1: 52, x2: 15, y2: 59 },
    ];
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const inside = removals.some(
          (rect) =>
            x >= rect.x1 && x <= rect.x2 && y >= rect.y1 && y <= rect.y2,
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
