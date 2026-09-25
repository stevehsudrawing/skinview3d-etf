import { describe, expect, it } from "vitest";
import { convertLegacySkin, isLegacySkin } from "../../src/decode/core/legacy";
import { createImage, getPixel, setPixel } from "../../src/decode/core/pixels";
import type { PixelData, RGBA } from "../../src/decode/core/types";
import { decodeSkin } from "../../src/decode/index";
import { fixturesAvailable, loadSkin } from "../fixtures/skins";
import {
  paintCell,
  paintMarker,
  paintRectWithPalette,
} from "../fixtures/synthetic";

/** One mirrored plate copy of the legacy conversion. */
interface Plate {
  /** Source rectangle x on the legacy skin. */
  sx: number;
  /** Source rectangle y on the legacy skin. */
  sy: number;
  /** Destination rectangle x on the 1.8 skin. */
  dx: number;
  /** Destination rectangle y on the 1.8 skin. */
  dy: number;
  /** Plate width in pixels. */
  width: number;
  /** Plate height in pixels. */
  height: number;
}

/** The plate table pinned by these specs (right limb -> left limb). */
const PLATES: readonly Plate[] = [
  { sx: 4, sy: 16, dx: 20, dy: 48, width: 4, height: 4 },
  { sx: 8, sy: 16, dx: 24, dy: 48, width: 4, height: 4 },
  { sx: 0, sy: 20, dx: 24, dy: 52, width: 4, height: 12 },
  { sx: 4, sy: 20, dx: 20, dy: 52, width: 4, height: 12 },
  { sx: 8, sy: 20, dx: 16, dy: 52, width: 4, height: 12 },
  { sx: 12, sy: 20, dx: 28, dy: 52, width: 4, height: 12 },
  { sx: 44, sy: 16, dx: 36, dy: 48, width: 4, height: 4 },
  { sx: 48, sy: 16, dx: 40, dy: 48, width: 4, height: 4 },
  { sx: 40, sy: 20, dx: 40, dy: 52, width: 4, height: 12 },
  { sx: 44, sy: 20, dx: 36, dy: 52, width: 4, height: 12 },
  { sx: 48, sy: 20, dx: 32, dy: 52, width: 4, height: 12 },
  { sx: 52, sy: 20, dx: 44, dy: 52, width: 4, height: 12 },
];

/** Bottom-half rectangles the conversion never writes to. */
const UNTOUCHED_BOTTOM: readonly (readonly [number, number, number, number])[] =
  [
    [0, 32, 16, 48], // right leg layer 2
    [16, 32, 40, 48], // body layer 2
    [40, 32, 56, 48], // right arm layer 2
    [56, 32, 64, 48], // unused columns (marker boxes 2 and 3)
    [0, 48, 16, 64], // left leg layer 2
    [48, 48, 64, 64], // left arm layer 2
  ];

/**
 * Creates a blank 64x32 legacy skin.
 *
 * @returns A transparent legacy buffer.
 */
function createLegacySkin(): PixelData {
  return createImage(64, 32);
}

/**
 * Paints every source plate with an asymmetric pattern: the red channel
 * encodes the column, so a missing or wrongly directed flip fails.
 *
 * @param skin - The legacy skin to paint.
 */
function paintPlates(skin: PixelData): void {
  for (const plate of PLATES) {
    for (let row = 0; row < plate.height; row++) {
      for (let column = 0; column < plate.width; column++) {
        setPixel(skin, plate.sx + column, plate.sy + row, [
          10 + column,
          20 + row,
          30,
          255,
        ]);
      }
    }
  }
}

describe("isLegacySkin", () => {
  it("accepts exactly the 64x32 size", () => {
    expect(isLegacySkin(createLegacySkin())).toBe(true);
    expect(isLegacySkin(createImage(64, 64))).toBe(false);
    expect(isLegacySkin(createImage(128, 64))).toBe(false);
    expect(isLegacySkin(createImage(64, 16))).toBe(false);
    expect(isLegacySkin(createImage(32, 16))).toBe(false);
  });
});

describe("convertLegacySkin", () => {
  it("mirrors every plate into the 1.8 layout", () => {
    const legacy = createLegacySkin();
    paintPlates(legacy);
    const converted = convertLegacySkin(legacy);
    expect(converted.width).toBe(64);
    expect(converted.height).toBe(64);
    for (const plate of PLATES) {
      // Corner pins first: the source's first column lands on the
      // destination's last column, and the other way round.
      const label = `plate ${plate.sx},${plate.sy}`;
      expect(
        getPixel(converted, plate.dx + plate.width - 1, plate.dy),
        label,
      ).toEqual([10, 20, 30, 255]);
      expect(getPixel(converted, plate.dx, plate.dy), label).toEqual([
        10 + plate.width - 1,
        20,
        30,
        255,
      ]);
      for (let row = 0; row < plate.height; row++) {
        for (let column = 0; column < plate.width; column++) {
          const expected: RGBA = [
            10 + plate.width - 1 - column,
            20 + row,
            30,
            255,
          ];
          expect(
            getPixel(converted, plate.dx + column, plate.dy + row),
            label,
          ).toEqual(expected);
        }
      }
    }
  });

  it("preserves the top half byte for byte", () => {
    const legacy = createLegacySkin();
    paintPlates(legacy);
    paintMarker(legacy);
    const converted = convertLegacySkin(legacy);
    const topHalf = legacy.data.length;
    expect(Array.from(converted.data.subarray(0, topHalf))).toEqual(
      Array.from(legacy.data),
    );
  });

  it("leaves every other bottom-half pixel transparent", () => {
    const legacy = createLegacySkin();
    paintPlates(legacy);
    const converted = convertLegacySkin(legacy);
    let painted = 0;
    for (const [x1, y1, x2, y2] of UNTOUCHED_BOTTOM) {
      for (let y = y1; y < y2; y++) {
        for (let x = x1; x < x2; x++) {
          if (converted.data[(y * 64 + x) * 4 + 3] !== 0) {
            painted++;
          }
        }
      }
    }
    expect(painted).toBe(0);
  });
});

describe("decodeSkin on legacy skins", () => {
  it("converts a marked 64x32 skin and decodes it", () => {
    const legacy = createLegacySkin();
    paintMarker(legacy);
    paintCell(legacy, 0, 1);
    paintRectWithPalette(legacy, { x1: 56, y1: 16, x2: 63, y2: 23 }, 1);
    const result = decodeSkin(legacy);
    expect(result.supported).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.hasMarker).toBe(true);
    expect(result.cells).toEqual([1, null, null, null]);
    expect(result.emissive).not.toBeNull();
    expect(result.enchanted).toBeNull();
    expect(result.skin.width).toBe(64);
    expect(result.skin.height).toBe(64);
  });

  it("keeps every other size unsupported", () => {
    const sizes: readonly (readonly [number, number])[] = [
      [128, 64],
      [96, 96],
      [64, 16],
    ];
    for (const [width, height] of sizes) {
      const result = decodeSkin(createImage(width, height));
      expect(result.supported).toBe(false);
      expect(result.warnings).toHaveLength(1);
      expect(result.hasMarker).toBe(false);
      expect(result.skin.width).toBe(width);
      expect(result.skin.height).toBe(height);
    }
  });
});

describe.skipIf(!fixturesAvailable)("legacy example fixture", () => {
  it("decodes old-format-test.png as a converted skin", () => {
    const source = loadSkin("old-format-test.png");
    expect(source.height).toBe(32);
    expect(source.width).toBe(64);
    const result = decodeSkin(source);
    expect(result.supported).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.hasMarker).toBe(true);
    expect(result.cells).toEqual([1, 2, null, null]);
    expect(result.transparency).toEqual({ enabled: true, forcedSolid: false });
    expect(result.blink).not.toBeNull();
    expect(result.nose).toBeNull();
    expect(result.emissive).not.toBeNull();
    expect(result.enchanted).not.toBeNull();
    expect(result.jacket).not.toBeNull();
    expect(result.skin.width).toBe(64);
    expect(result.skin.height).toBe(64);
  });
});
