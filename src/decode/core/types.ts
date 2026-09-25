/**
 * Public types of the ETF player-skin decoder.
 *
 * The decoder is a pure, three-free layer: it operates on
 * `ImageData`-compatible pixel buffers and returns plain data plus
 * prepared overlay images. Nothing in `src/decode/` imports `three`
 * or `skinview3d`.
 */

/**
 * Minimal pixel buffer compatible with the DOM `ImageData` class:
 * row-major RGBA bytes, `width * height * 4` entries long.
 */
export interface PixelData {
  /** Image width in pixels. */
  width: number;
  /** Image height in pixels. */
  height: number;
  /** Row-major RGBA pixel bytes (`width * height * 4` entries). */
  data: Uint8ClampedArray;
}

/**
 * Inclusive pixel rectangle: `(x1, y1)` is the top-left pixel and
 * `(x2, y2)` the bottom-right pixel.
 */
export interface Rect {
  /** Left edge (inclusive). */
  x1: number;
  /** Top edge (inclusive). */
  y1: number;
  /** Right edge (inclusive). */
  x2: number;
  /** Bottom edge (inclusive). */
  y2: number;
}

/** An 8-bit RGBA color tuple; every channel is 0-255. */
export type RGBA = readonly [number, number, number, number];

/**
 * A color-guide id: 1-8 for the eight paint swatches, 666 for the
 * villager nose color. Values are matched with exact RGBA equality.
 */
export type PaletteId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 666;

/** Blink mode: 1-2 lazy face copies, 3-5 optimized closed-eye strips. */
export type BlinkMode = 1 | 2 | 3 | 4 | 5;

/** Blinking information decoded from the blink and eye-height slots. */
export interface BlinkInfo {
  /** The selected blink mode (slot `(52,16)`, palette ids 1-5). */
  mode: BlinkMode;
  /**
   * The face row (1 = top) the closed-eye strip is stamped at, for the
   * optimized modes 3-5; `null` for the lazy modes 1-2.
   */
  eyeHeight: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | null;
  /**
   * Prepared full-size frames: one frame for modes 1 and 3, two frames
   * for modes 2, 4 and 5.
   */
  frames: PixelData[];
}

/**
 * Nose information decoded from the deprecated pixels and the nose
 * slot.
 *
 * The two nose styles are independent in the format: the villager
 * style (deprecated pixels or slot choices 1/7/8/9) is drawn with the
 * villager model, and the textured style (slot choices 2-6) is drawn
 * from a prepared 8x8 texture.
 */
export interface NoseInfo {
  /** Whether the villager-style nose is drawn. */
  villager: boolean;
  /**
   * Whether the villager nose is textured with the player skin (slot
   * choices 7/9) instead of the villager texture.
   */
  villagerSkinTextured: boolean;
  /** The textured-nose source region 1-5, or `null` when not textured. */
  variant: 1 | 2 | 3 | 4 | 5 | null;
  /** The prepared 8x8 textured-nose image, or `null` when not textured. */
  texture: PixelData | null;
  /** Whether the hat nose pixels were removed from `skin`. */
  removesSource: boolean;
}

/** Jacket information decoded from the style and length slots. */
export interface JacketInfo {
  /** The coat style id 1-8. */
  style: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  /**
   * The clamped raw length slot value 1-8 (an unset or out-of-range
   * slot decodes as 1).
   */
  length: number;
  /** Whether the style uses the wider "fat" coat model. */
  fat: boolean;
  /** Whether the style moved (and removed) the leg source pixels. */
  moved: boolean;
  /** Whether the style keeps the coat's top faces. */
  top: boolean;
  /** The prepared 64x64 coat texture. */
  texture: PixelData;
}

/** An emissive or enchanted color-key pattern. */
export interface PatternInfo {
  /** The selected 8x8 pattern box. */
  box: Rect;
  /**
   * The distinct non-transparent colors read from the box, in
   * row-major first-seen order.
   */
  keys: RGBA[];
  /**
   * A full-size overlay that keeps only the pixels whose RGBA equals a
   * key exactly.
   */
  mask: PixelData;
}

/** Raw choice-slot values, keyed by slot. */
export interface SlotValues {
  /** Blink mode slot `(52,16)`; palette ids 1-5 select a mode. */
  blink: PaletteId | null;
  /** Jacket style slot `(52,17)`; palette ids 1-8 select a style. */
  jacketStyle: PaletteId | null;
  /** Jacket length slot `(52,18)`; palette ids 1-8 select a length. */
  jacketLength: PaletteId | null;
  /** Eye-height slot `(52,19)`; palette ids 1-8 select a face row. */
  eyeHeight: PaletteId | null;
  /**
   * Cape slot `(53,16)`: retained by the decoder but dead upstream -
   * the in-skin cape feature was discontinued and the slot is kept for
   * diagnostics only.
   */
  cape: PaletteId | null;
  /**
   * Nose slot `(53,17)`; palette ids 1-8 select a nose. The nose
   * color (666) reads through as a palette id but is ignored by the
   * nose decoder; nose type 9 is encoded outside the palette (see
   * {@link DecodeResult.nose}).
   */
  nose: PaletteId | null;
  /** Forced-solid slot `(53,18)`; palette id 1 forces the base layer solid. */
  forcedSolid: PaletteId | null;
}

/** The result of {@link decodeSkin}. */
export interface DecodeResult {
  /** `true` for 64x64 skins; `false` disables every other field. */
  supported: boolean;
  /** Non-fatal decoding notes (unsupported sizes only). */
  warnings: string[];
  /** Whether the 4x4 marker signature matched. */
  hasMarker: boolean;
  /** The palette value of each marker cell, in upstream order. */
  cells: (PaletteId | null)[];
  /** The raw choice-slot values. */
  slots: SlotValues;
  /** Transparency gate and forced-solid opt-out. */
  transparency: {
    /** Whether the skin may render with layer-1 alpha. */
    enabled: boolean;
    /** Whether the forced-solid slot strips alpha on the base layer. */
    forcedSolid: boolean;
  };
  /** Blinking data, or `null` when no mode is selected. */
  blink: BlinkInfo | null;
  /** Nose data, or `null` when no nose is selected. */
  nose: NoseInfo | null;
  /** Jacket data, or `null` when no style is selected. */
  jacket: JacketInfo | null;
  /** Emissive pattern data, or `null` when not enabled or empty. */
  emissive: PatternInfo | null;
  /** Enchanted pattern data, or `null` when not enabled or empty. */
  enchanted: PatternInfo | null;
  /**
   * The base skin with every removable overlay source cleared (nose
   * and moved-coat sources plus the lazy-blink nose cuts) and the
   * forced-solid alpha strips applied.
   */
  skin: PixelData;
}
