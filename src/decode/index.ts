/**
 * The decoder entry point. `decodeSkin()` orchestrates the marker,
 * slot and feature decoders in the upstream processing order and
 * returns plain data plus the prepared overlay images.
 */

import { blinkNoseCuts, decodeBlink, decodeBlinkMode } from "./blink";
import { FORCED_SOLID_RECTS } from "./constants";
import { decodeJacket } from "./jacket";
import { checkSignature, readCells } from "./marker";
import { decodeNose } from "./nose";
import { decodePattern, selectBox } from "./pattern";
import { clearRect, cloneImage, stripAlphaRect } from "./pixels";
import { readSlots } from "./slots";
import type {
  BlinkInfo,
  DecodeResult,
  JacketInfo,
  NoseInfo,
  PaletteId,
  PatternInfo,
  PixelData,
  SlotValues,
} from "./types";

/**
 * Creates an all-unset slot record.
 *
 * @returns A fresh slot record with every value `null`.
 */
function emptySlots(): SlotValues {
  return {
    blink: null,
    jacketStyle: null,
    jacketLength: null,
    eyeHeight: null,
    cape: null,
    nose: null,
    forcedSolid: null,
  };
}

/**
 * Builds the result for an unsupported (non-64x64) skin.
 *
 * @param image - The skin image.
 * @returns A disabled result with one warning.
 */
function unsupportedResult(image: PixelData): DecodeResult {
  return {
    supported: false,
    warnings: [
      `Unsupported skin size ${image.width}x${image.height}: ETF player ` +
        "skin features require a 64x64 RGBA skin.",
    ],
    hasMarker: false,
    cells: [null, null, null, null],
    slots: emptySlots(),
    transparency: { enabled: false, forcedSolid: false },
    blink: null,
    nose: null,
    jacket: null,
    emissive: null,
    enchanted: null,
    skin: cloneImage(image),
  };
}

/**
 * Validates the pixel-buffer shape.
 *
 * @param image - The buffer to validate.
 * @throws {TypeError} When the dimensions are not positive integers or
 *   the byte length does not match `width * height * 4`.
 */
function assertPixelData(image: PixelData): void {
  const { width, height, data } = image;
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    throw new TypeError(`invalid skin dimensions ${width}x${height}`);
  }
  if (width <= 0 || height <= 0) {
    throw new TypeError(`invalid skin dimensions ${width}x${height}`);
  }
  const expected = width * height * 4;
  if (data.length !== expected) {
    throw new TypeError(
      `invalid skin buffer: expected ${expected} bytes, got ${data.length}`,
    );
  }
}

/**
 * Decodes an ETF player skin.
 *
 * The decoder accepts any `ImageData`-compatible buffer and returns
 * the marker state, the raw slot values and every feature the skin
 * selects: blinking (with prepared frames), nose (villager and
 * textured, with the prepared 8x8 image), jacket (with the prepared
 * coat texture and removal rectangles applied to `skin`), emissive and
 * enchanted patterns (with matching masks), plus the modified base
 * skin. Only 64x64 skins are supported; other sizes decode as
 * `supported: false` with a warning and no features.
 *
 * @param image - The skin as an `ImageData`-compatible buffer.
 * @returns The decoded features and prepared artifacts.
 * @throws {TypeError} When the buffer shape is malformed.
 */
export function decodeSkin(image: PixelData): DecodeResult {
  assertPixelData(image);
  if (image.width !== 64 || image.height !== 64) {
    return unsupportedResult(image);
  }

  const hasMarker = checkSignature(image);
  const cells: (PaletteId | null)[] = hasMarker
    ? readCells(image)
    : [null, null, null, null];
  const slots = hasMarker ? readSlots(image) : emptySlots();
  const skin = cloneImage(image);

  let blink: BlinkInfo | null = null;
  let nose: NoseInfo | null = null;
  let jacket: JacketInfo | null = null;
  let emissive: PatternInfo | null = null;
  let enchanted: PatternInfo | null = null;
  let forcedSolid = false;

  if (hasMarker) {
    // Nose removals, then the coat texture and its moved-source
    // removals, then the forced-solid strips - all mirrored from the
    // upstream processing order so that the frames and masks below see
    // the same working skin the renderer will.
    const noseResult = decodeNose(image, slots.nose);
    nose = noseResult.info;
    for (const rect of noseResult.removals) {
      clearRect(skin, rect);
    }

    const jacketResult = decodeJacket(
      image,
      slots.jacketStyle,
      slots.jacketLength,
    );
    jacket = jacketResult.info;
    for (const rect of jacketResult.removals) {
      clearRect(skin, rect);
    }

    forcedSolid = slots.forcedSolid === 1;
    if (forcedSolid) {
      for (const rect of FORCED_SOLID_RECTS) {
        stripAlphaRect(skin, rect);
      }
    }

    const mode = decodeBlinkMode(slots.blink);
    if (mode !== null) {
      if (nose !== null && nose.removesSource) {
        for (const rect of blinkNoseCuts(mode)) {
          clearRect(skin, rect);
        }
      }
      blink = decodeBlink(skin, mode, slots.eyeHeight);
    }

    const emissiveBox = selectBox(cells, 1);
    if (emissiveBox !== null) {
      emissive = decodePattern(skin, emissiveBox);
    }
    const enchantedBox = selectBox(cells, 2);
    if (enchantedBox !== null) {
      enchanted = decodePattern(skin, enchantedBox);
    }
  }

  return {
    supported: true,
    warnings: [],
    hasMarker,
    cells,
    slots,
    transparency: { enabled: hasMarker, forcedSolid },
    blink,
    nose,
    jacket,
    emissive,
    enchanted,
    skin,
  };
}
