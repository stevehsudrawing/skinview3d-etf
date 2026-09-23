/**
 * Frozen ETF player-skin format constants.
 *
 * Every constant was derived (2026-09-23) from the upstream decoder's
 * read behaviour and verified against the ETF example skins; see the
 * notes at each constant. All coordinates are 64x64 layout pixels and
 * all colours are opaque unless stated otherwise.
 */

import type { PaletteId, Rect, RGBA } from "./types";

/**
 * One marker signature pixel: `[x, y, r, g, b]`. The alpha channel is
 * always 255.
 */
export type SignaturePixel = readonly [number, number, number, number, number];

/**
 * The eleven marker signature pixels. All must match with exact RGBA
 * equality; the template's twelfth icon pixel `(3,19)` is deliberately
 * not checked.
 */
export const MARKER_SIGNATURE: readonly SignaturePixel[] = [
  [0, 16, 127, 0, 0],
  [1, 16, 255, 0, 0],
  [2, 16, 0, 255, 0],
  [3, 16, 0, 127, 0],
  [0, 17, 255, 0, 0],
  [3, 17, 0, 255, 0],
  [0, 18, 0, 0, 255],
  [0, 19, 0, 0, 127],
  [1, 19, 0, 0, 255],
  [2, 19, 255, 255, 255],
  [3, 18, 255, 255, 255],
];

/**
 * The four marker-choice cells, in the upstream read order. Cell `i`
 * selects {@link MARKER_BOXES}`[i]`: pink (palette id 1) enables the
 * emissive pattern on that box, cyan (id 2) enables the enchanted
 * pattern.
 */
export const MARKER_CELLS: readonly { x: number; y: number }[] = [
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
  { x1: 56, y1: 16, x2: 63, y2: 23 },
  { x1: 56, y1: 24, x2: 63, y2: 31 },
  { x1: 56, y1: 32, x2: 63, y2: 39 },
  { x1: 56, y1: 40, x2: 63, y2: 47 },
];

/** One colour-guide entry. */
export interface PaletteEntry {
  /** The colour-guide id. */
  id: PaletteId;
  /** The display name used in the upstream editor. */
  name: string;
  /** The exact RGBA the id is matched against. */
  rgba: RGBA;
}

/** The eight colour-guide swatches plus the villager nose colour. */
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
 */
export function paletteColour(id: PaletteId): RGBA {
  const entry = PALETTE.find((candidate) => candidate.id === id);
  if (entry === undefined) {
    throw new Error(`unknown palette id ${id}`);
  }
  return entry.rgba;
}

/** The villager nose colour (palette id 666). */
export const NOSE_COLOUR: RGBA = paletteColour(666);

/** The seven choice-slot coordinates. */
export const SLOTS = {
  blink: { x: 52, y: 16 },
  jacketStyle: { x: 52, y: 17 },
  jacketLength: { x: 52, y: 18 },
  eyeHeight: { x: 52, y: 19 },
  cape: { x: 53, y: 16 },
  nose: { x: 53, y: 17 },
  forcedSolid: { x: 53, y: 18 },
} as const;

/**
 * The raw pixel that encodes nose type 9 (villager-textured-remove) in
 * the nose slot: RGBA `(9, 0, 0, 0)`. The editor writes this literal
 * value because the type id has no palette swatch; it is the only type
 * encoded outside the palette.
 */
export const NOSE_TYPE9_PIXEL: RGBA = [9, 0, 0, 0];

/**
 * The deprecated six-pixel villager nose rectangles. The hat variant
 * also removes its pixels from the base skin; the face variant is kept.
 */
export const DEPRECATED_NOSE_RECTS: { hat: Rect; face: Rect } = {
  hat: { x1: 43, y1: 13, x2: 44, y2: 15 },
  face: { x1: 11, y1: 13, x2: 12, y2: 15 },
};

/**
 * The five former in-skin-cape regions, reused as the textured-nose
 * sources. Index `i` belongs to textured nose variant `i + 1`; each
 * region is 8 wide by 4 high.
 */
export const NOSE_CAPE_REGIONS: readonly Rect[] = [
  { x1: 12, y1: 32, x2: 19, y2: 35 },
  { x1: 36, y1: 32, x2: 43, y2: 35 },
  { x1: 12, y1: 48, x2: 19, y2: 51 },
  { x1: 28, y1: 48, x2: 35, y2: 51 },
  { x1: 44, y1: 48, x2: 51, y2: 51 },
];

/** One stored lazy-blink face square and where it is copied to. */
export interface BlinkCorner {
  /** The stored 8x8 source square (an unused head/hat corner). */
  source: Rect;
  /** Target x of the square's top-left pixel. */
  targetX: number;
  /** Target y of the square's top-left pixel. */
  targetY: number;
  /** The animation frame (1 or 2) this square belongs to. */
  frame: 1 | 2;
}

/**
 * The four lazy-blink corner squares. Frame 1 copies into the face and
 * hat front, frame 2 supplies the second (optional) frame.
 */
export const BLINK_CORNERS: readonly BlinkCorner[] = [
  { source: { x1: 0, y1: 0, x2: 7, y2: 7 }, targetX: 8, targetY: 8, frame: 1 },
  {
    source: { x1: 24, y1: 0, x2: 31, y2: 7 },
    targetX: 8,
    targetY: 8,
    frame: 2,
  },
  {
    source: { x1: 32, y1: 0, x2: 39, y2: 7 },
    targetX: 40,
    targetY: 8,
    frame: 1,
  },
  {
    source: { x1: 56, y1: 0, x2: 63, y2: 7 },
    targetX: 40,
    targetY: 8,
    frame: 2,
  },
];

/**
 * The optimized-blink closed-eye strips per mode; each mode lists its
 * frame sources in order. A strip is stamped across the face row
 * `8 + (eyeHeight - 1)`.
 */
export const BLINK_EYE_STRIPS: Readonly<Record<3 | 4 | 5, readonly Rect[]>> = {
  3: [{ x1: 12, y1: 16, x2: 19, y2: 16 }],
  4: [
    { x1: 12, y1: 16, x2: 19, y2: 17 },
    { x1: 12, y1: 18, x2: 19, y2: 19 },
  ],
  5: [
    { x1: 12, y1: 16, x2: 19, y2: 19 },
    { x1: 36, y1: 16, x2: 43, y2: 19 },
  ],
};

/**
 * Nose-area cuts inside the stored lazy frames, applied when the
 * deprecated hat nose pixels are removed: the first belongs to frame 1
 * (modes 1-2), the second to frame 2 (mode 2 only).
 */
export const BLINK_NOSE_CUT_RECTS: readonly Rect[] = [
  { x1: 35, y1: 5, x2: 36, y2: 7 },
  { x1: 59, y1: 5, x2: 60, y2: 7 },
];

/** One coat style definition. */
export interface CoatStyle {
  /** The style id 1-8. */
  id: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  /** The upstream editor name. */
  name: string;
  /** Whether the style uses the "fat" coat model. */
  fat: boolean;
  /** Whether the style moved (and removed) the leg source pixels. */
  moved: boolean;
  /** Whether the style keeps the coat's top faces. */
  top: boolean;
}

/** The eight coat styles, indexed by `id - 1`. */
export const COAT_STYLES: readonly CoatStyle[] = [
  { id: 1, name: "copied-thin-top", fat: false, moved: false, top: true },
  { id: 2, name: "moved-thin-top", fat: false, moved: true, top: true },
  { id: 3, name: "copied-fat-top", fat: true, moved: false, top: true },
  { id: 4, name: "moved-fat-top", fat: true, moved: true, top: true },
  { id: 5, name: "copied-thin", fat: false, moved: false, top: false },
  { id: 6, name: "moved-thin", fat: false, moved: true, top: false },
  { id: 7, name: "copied-fat", fat: true, moved: false, top: false },
  { id: 8, name: "moved-fat", fat: true, moved: true, top: false },
];

/** One coat-texture copy entry. */
export interface CoatCopy {
  /** The source rectangle in the leg outer layer. */
  source: Rect;
  /** Target x of the copied area's top-left pixel. */
  targetX: number;
  /** Target y of the copied area's top-left pixel. */
  targetY: number;
  /** When true the entry is skipped by the styles without tops (5-8). */
  topOnly: boolean;
}

/**
 * The coat-texture copy table. The source `y2` is extended by the coat
 * length offset `L = length - 1` at copy time. All sources sit in the
 * leg outer layer.
 */
export const JACKET_COPY_TABLE: readonly CoatCopy[] = [
  {
    source: { x1: 4, y1: 32, x2: 7, y2: 35 },
    targetX: 20,
    targetY: 32,
    topOnly: true,
  },
  {
    source: { x1: 4, y1: 48, x2: 7, y2: 51 },
    targetX: 24,
    targetY: 32,
    topOnly: true,
  },
  {
    source: { x1: 0, y1: 36, x2: 7, y2: 36 },
    targetX: 16,
    targetY: 36,
    topOnly: false,
  },
  {
    source: { x1: 12, y1: 36, x2: 15, y2: 36 },
    targetX: 36,
    targetY: 36,
    topOnly: false,
  },
  {
    source: { x1: 4, y1: 52, x2: 15, y2: 52 },
    targetX: 24,
    targetY: 36,
    topOnly: false,
  },
];

/** One moved-coat source removal. */
export interface CoatSourceRemoval {
  /** The source rectangle cleared on the base skin. */
  rect: Rect;
  /** When true the rectangle's `y2` grows by the coat length offset. */
  extendY2: boolean;
}

/**
 * The base-skin rectangles cleared by the moved coat styles (2, 4, 6,
 * 8). The first two always cover the leg top faces; the last two cover
 * the leg side strips including the length extension.
 */
export const JACKET_MOVED_RECTS: readonly CoatSourceRemoval[] = [
  { rect: { x1: 4, y1: 32, x2: 7, y2: 35 }, extendY2: false },
  { rect: { x1: 4, y1: 48, x2: 7, y2: 51 }, extendY2: false },
  { rect: { x1: 0, y1: 36, x2: 15, y2: 36 }, extendY2: true },
  { rect: { x1: 0, y1: 52, x2: 15, y2: 52 }, extendY2: true },
];

/**
 * The ten base-layer rectangles whose alpha is forced to opaque when
 * the forced-solid slot holds pink (id 1). These are the "lower skin"
 * regions the transparency feature would otherwise affect.
 */
export const FORCED_SOLID_RECTS: readonly Rect[] = [
  { x1: 8, y1: 0, x2: 23, y2: 15 },
  { x1: 0, y1: 20, x2: 55, y2: 31 },
  { x1: 0, y1: 8, x2: 7, y2: 15 },
  { x1: 24, y1: 8, x2: 31, y2: 15 },
  { x1: 0, y1: 16, x2: 11, y2: 19 },
  { x1: 20, y1: 16, x2: 35, y2: 19 },
  { x1: 44, y1: 16, x2: 51, y2: 19 },
  { x1: 20, y1: 48, x2: 27, y2: 51 },
  { x1: 36, y1: 48, x2: 43, y2: 51 },
  { x1: 16, y1: 52, x2: 47, y2: 63 },
];
