/**
 * Frozen ETF player-skin format constants.
 *
 * Every constant was derived (2026-09-23) from the upstream decoder's
 * read behavior and verified against the ETF example skins; see the
 * notes at each constant. All coordinates are 64x64 layout pixels and
 * all colors are opaque unless stated otherwise.
 */

import type {
  Coordinate,
  PaletteId,
  Rect,
  RGBA,
  SignaturePixel,
} from "./types";

/**
 * The 64x64 skin layout side length every feature works in. Legacy
 * 64x32 inputs are converted into this layout first; HD skins are
 * unsupported.
 */
export const SKIN_SIZE = 64;

/**
 * The eleven marker signature pixels, each pairing a `Coordinate`
 * with the `RGB` it must match. All must match with exact RGBA
 * equality (alpha 255); the template's twelfth icon pixel `(3,19)`
 * is deliberately not checked.
 */
export const MARKER_SIGNATURE: readonly SignaturePixel[] = [
  [{ x: 0, y: 16 }, [127, 0, 0]],
  [{ x: 1, y: 16 }, [255, 0, 0]],
  [{ x: 2, y: 16 }, [0, 255, 0]],
  [{ x: 3, y: 16 }, [0, 127, 0]],
  [{ x: 0, y: 17 }, [255, 0, 0]],
  [{ x: 3, y: 17 }, [0, 255, 0]],
  [{ x: 0, y: 18 }, [0, 0, 255]],
  [{ x: 0, y: 19 }, [0, 0, 127]],
  [{ x: 1, y: 19 }, [0, 0, 255]],
  [{ x: 2, y: 19 }, [255, 255, 255]],
  [{ x: 3, y: 18 }, [255, 255, 255]],
];

/**
 * The four marker-choice cells, in the upstream read order. Cell `i`
 * selects {@link MARKER_BOXES}`[i]`: pink (palette id 1) enables the
 * emissive pattern on that box, cyan (id 2) enables the enchanted
 * pattern.
 */
export const MARKER_CELLS: readonly Coordinate[] = [
  { x: 1, y: 17 },
  { x: 1, y: 18 },
  { x: 2, y: 17 },
  { x: 2, y: 18 },
];

/**
 * The four 8x8 pattern boxes (unused skin columns) selected by
 * {@link MARKER_CELLS}.
 */
export const MARKER_BOXES: readonly Rect[] = [
  { topLeft: { x: 56, y: 16 }, bottomRight: { x: 63, y: 23 } },
  { topLeft: { x: 56, y: 24 }, bottomRight: { x: 63, y: 31 } },
  { topLeft: { x: 56, y: 32 }, bottomRight: { x: 63, y: 39 } },
  { topLeft: { x: 56, y: 40 }, bottomRight: { x: 63, y: 47 } },
];

/** One color-guide entry. */
export interface PaletteEntry {
  /** The color-guide id. */
  id: PaletteId;
  /** The display name used in the upstream editor. */
  name: string;
  /** The exact RGBA the id is matched against. */
  rgba: RGBA;
}

/** The eight color-guide swatches plus the villager nose color. */
export const PALETTE: readonly PaletteEntry[] = [
  { id: 1, name: "pink", rgba: [255, 0, 255, 255] },
  { id: 2, name: "cyan", rgba: [0, 255, 255, 255] },
  { id: 3, name: "red", rgba: [255, 0, 0, 255] },
  { id: 4, name: "green", rgba: [0, 255, 0, 255] },
  { id: 5, name: "brown", rgba: [127, 64, 0, 255] },
  { id: 6, name: "blue", rgba: [0, 0, 255, 255] },
  { id: 7, name: "orange", rgba: [255, 127, 0, 255] },
  { id: 8, name: "yellow", rgba: [255, 255, 34, 255] },
  { id: 666, name: "nose", rgba: [144, 94, 67, 255] },
];

/**
 * Returns the RGBA of a palette entry.
 *
 * @param id - The palette id to resolve.
 * @returns The exact RGBA of the entry.
 * @throws {Error} When the id has no palette entry.
 */
export function paletteColor(id: PaletteId): RGBA {
  const entry = PALETTE.find((candidate) => candidate.id === id);
  if (entry === undefined) {
    throw new Error(`unknown palette id ${id}`);
  }
  return entry.rgba;
}

/** The villager nose color (palette id 666). */
export const NOSE_COLOR: RGBA = paletteColor(666);

/** The seven choice-slot coordinates. */
export const SLOTS = {
  blink: { x: 52, y: 16 },
  jacketStyle: { x: 52, y: 17 },
  jacketLength: { x: 52, y: 18 },
  eyePosition: { x: 52, y: 19 },
  cape: { x: 53, y: 16 },
  nose: { x: 53, y: 17 },
  forcedSolid: { x: 53, y: 18 },
} as const satisfies Record<string, Coordinate>;

/**
 * The raw pixel that encodes nose type 9 (the "Villager textured,
 * remove face pixels" type) in the nose slot: RGBA `(9, 0, 0, 0)`.
 * The editor writes this literal value because the type id has no
 * palette swatch; it is the only type encoded outside the palette.
 */
export const NOSE_TYPE9_PIXEL: RGBA = [9, 0, 0, 0];

/**
 * The deprecated six-pixel villager nose rectangles. The
 * floating-face variant also removes its pixels from the base skin;
 * the face variant is kept.
 */
export const DEPRECATED_NOSE_RECTS: { floatingFace: Rect; face: Rect } = {
  floatingFace: {
    topLeft: { x: 43, y: 13 },
    bottomRight: { x: 44, y: 15 },
  },
  face: { topLeft: { x: 11, y: 13 }, bottomRight: { x: 12, y: 15 } },
};

/**
 * The five former in-skin-cape regions, reused as the textured-nose
 * sources. Index `i` belongs to textured nose variant `i + 1`; each
 * region is 8 wide by 4 high.
 */
export const NOSE_CAPE_REGIONS: readonly Rect[] = [
  { topLeft: { x: 12, y: 32 }, bottomRight: { x: 19, y: 35 } },
  { topLeft: { x: 36, y: 32 }, bottomRight: { x: 43, y: 35 } },
  { topLeft: { x: 12, y: 48 }, bottomRight: { x: 19, y: 51 } },
  { topLeft: { x: 28, y: 48 }, bottomRight: { x: 35, y: 51 } },
  { topLeft: { x: 44, y: 48 }, bottomRight: { x: 51, y: 51 } },
];

/** One stored entire-face blink square and where it is copied to. */
export interface BlinkCorner {
  /** The stored 8x8 source square (an unused head-texture corner). */
  source: Rect;
  /** The target top-left pixel the square is copied to. */
  target: Coordinate;
  /** The animation frame (1 or 2) this square belongs to. */
  frame: 1 | 2;
}

/**
 * The face-front square the entire-face blink frames copy into; its
 * top-left corner is also the base of the pixel-tall eye strip row.
 */
export const BLINK_FACE_RECT: Rect = {
  topLeft: { x: 8, y: 8 },
  bottomRight: { x: 15, y: 15 },
};

/** The floating-face square the entire-face blink frames copy into. */
export const BLINK_FLOATING_FACE_RECT: Rect = {
  topLeft: { x: 40, y: 8 },
  bottomRight: { x: 47, y: 15 },
};

/**
 * The four entire-face blink corner squares. Frame 1 copies into the
 * face and floating-face fronts, frame 2 supplies the second
 * (optional) frame.
 */
export const BLINK_CORNERS: readonly BlinkCorner[] = [
  {
    source: { topLeft: { x: 0, y: 0 }, bottomRight: { x: 7, y: 7 } },
    target: BLINK_FACE_RECT.topLeft,
    frame: 1,
  },
  {
    source: { topLeft: { x: 24, y: 0 }, bottomRight: { x: 31, y: 7 } },
    target: BLINK_FACE_RECT.topLeft,
    frame: 2,
  },
  {
    source: { topLeft: { x: 32, y: 0 }, bottomRight: { x: 39, y: 7 } },
    target: BLINK_FLOATING_FACE_RECT.topLeft,
    frame: 1,
  },
  {
    source: { topLeft: { x: 56, y: 0 }, bottomRight: { x: 63, y: 7 } },
    target: BLINK_FLOATING_FACE_RECT.topLeft,
    frame: 2,
  },
];

/**
 * The pixel-tall eye closed-eye strips per mode; each mode lists its
 * frame sources in order. A strip is stamped across the face row
 * `8 + (eyePosition - 1)`.
 */
export const BLINK_EYE_STRIPS: Readonly<Record<3 | 4 | 5, readonly Rect[]>> = {
  3: [{ topLeft: { x: 12, y: 16 }, bottomRight: { x: 19, y: 16 } }],
  4: [
    { topLeft: { x: 12, y: 16 }, bottomRight: { x: 19, y: 17 } },
    { topLeft: { x: 12, y: 18 }, bottomRight: { x: 19, y: 19 } },
  ],
  5: [
    { topLeft: { x: 12, y: 16 }, bottomRight: { x: 19, y: 19 } },
    { topLeft: { x: 36, y: 16 }, bottomRight: { x: 43, y: 19 } },
  ],
};

/**
 * Nose-area cuts inside the stored entire-face frames, applied when
 * the deprecated floating-face nose pixels are removed: the first
 * belongs to frame 1 (modes 1-2), the second to frame 2 (mode 2 only).
 */
export const BLINK_NOSE_CUT_RECTS: readonly Rect[] = [
  { topLeft: { x: 35, y: 5 }, bottomRight: { x: 36, y: 7 } },
  { topLeft: { x: 59, y: 5 }, bottomRight: { x: 60, y: 7 } },
];

/** One jacket style definition. */
export interface JacketStyle {
  /** The style id 1-8. */
  id: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  /** The upstream editor name. */
  name: string;
  /** Whether the style uses the wider jacket model (`wide`). */
  wide: boolean;
  /** Whether the style moved (and removed) the leg source pixels. */
  moved: boolean;
  /** Whether the style keeps the jacket's top faces. */
  top: boolean;
}

/** The eight jacket styles, indexed by `id - 1`. */
export const JACKET_STYLES: readonly JacketStyle[] = [
  { id: 1, name: "copied-thin-top", wide: false, moved: false, top: true },
  { id: 2, name: "moved-thin-top", wide: false, moved: true, top: true },
  { id: 3, name: "copied-wide-top", wide: true, moved: false, top: true },
  { id: 4, name: "moved-wide-top", wide: true, moved: true, top: true },
  { id: 5, name: "copied-thin", wide: false, moved: false, top: false },
  { id: 6, name: "moved-thin", wide: false, moved: true, top: false },
  { id: 7, name: "copied-wide", wide: true, moved: false, top: false },
  { id: 8, name: "moved-wide", wide: true, moved: true, top: false },
];

/** One jacket-texture copy entry. */
export interface JacketCopy {
  /** The source rectangle in the leg outer layer. */
  source: Rect;
  /** The target top-left pixel the area is copied to. */
  target: Coordinate;
  /** When true the entry is skipped by the styles without tops (5-8). */
  topOnly: boolean;
}

/**
 * The jacket-texture copy table. The source `y2` is extended by the
 * jacket length offset `L = length - 1` at copy time. All sources sit
 * in the leg outer layer.
 */
export const JACKET_COPY_TABLE: readonly JacketCopy[] = [
  {
    source: { topLeft: { x: 4, y: 32 }, bottomRight: { x: 7, y: 35 } },
    target: { x: 20, y: 32 },
    topOnly: true,
  },
  {
    source: { topLeft: { x: 4, y: 48 }, bottomRight: { x: 7, y: 51 } },
    target: { x: 24, y: 32 },
    topOnly: true,
  },
  {
    source: { topLeft: { x: 0, y: 36 }, bottomRight: { x: 7, y: 36 } },
    target: { x: 16, y: 36 },
    topOnly: false,
  },
  {
    source: { topLeft: { x: 12, y: 36 }, bottomRight: { x: 15, y: 36 } },
    target: { x: 36, y: 36 },
    topOnly: false,
  },
  {
    source: { topLeft: { x: 4, y: 52 }, bottomRight: { x: 15, y: 52 } },
    target: { x: 24, y: 36 },
    topOnly: false,
  },
];

/** One moved-jacket source removal. */
export interface JacketSourceRemoval {
  /** The source rectangle cleared on the base skin. */
  rect: Rect;
  /** When true the rectangle's `y2` grows by the jacket length offset. */
  extendY2: boolean;
}

/**
 * The base-skin rectangles cleared by the moved jacket styles (2, 4,
 * 6, 8). The first two always cover the leg top faces; the last two
 * cover the leg side strips including the length extension.
 */
export const JACKET_MOVED_RECTS: readonly JacketSourceRemoval[] = [
  {
    rect: { topLeft: { x: 4, y: 32 }, bottomRight: { x: 7, y: 35 } },
    extendY2: false,
  },
  {
    rect: { topLeft: { x: 4, y: 48 }, bottomRight: { x: 7, y: 51 } },
    extendY2: false,
  },
  {
    rect: { topLeft: { x: 0, y: 36 }, bottomRight: { x: 15, y: 36 } },
    extendY2: true,
  },
  {
    rect: { topLeft: { x: 0, y: 52 }, bottomRight: { x: 15, y: 52 } },
    extendY2: true,
  },
];

/**
 * The ten base-layer rectangles whose alpha is forced to opaque when
 * the forced-solid slot holds pink (id 1). These are the "lower skin"
 * regions the transparency feature would otherwise affect.
 */
export const FORCED_SOLID_RECTS: readonly Rect[] = [
  { topLeft: { x: 8, y: 0 }, bottomRight: { x: 23, y: 15 } },
  { topLeft: { x: 0, y: 20 }, bottomRight: { x: 55, y: 31 } },
  { topLeft: { x: 0, y: 8 }, bottomRight: { x: 7, y: 15 } },
  { topLeft: { x: 24, y: 8 }, bottomRight: { x: 31, y: 15 } },
  { topLeft: { x: 0, y: 16 }, bottomRight: { x: 11, y: 19 } },
  { topLeft: { x: 20, y: 16 }, bottomRight: { x: 35, y: 19 } },
  { topLeft: { x: 44, y: 16 }, bottomRight: { x: 51, y: 19 } },
  { topLeft: { x: 20, y: 48 }, bottomRight: { x: 27, y: 51 } },
  { topLeft: { x: 36, y: 48 }, bottomRight: { x: 43, y: 51 } },
  { topLeft: { x: 16, y: 52 }, bottomRight: { x: 47, y: 63 } },
];
