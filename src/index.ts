/**
 * skinview3d-etf public entry point.
 *
 * `decodeSkin()` reads every ETF player skin feature into plain data
 * and prepared overlay images; `attachETFSkinFeatures()` renders the
 * supported features (transparency, the nose, the emissive pixels
 * and blinking eyes) on a live `skinview3d` viewer and returns a
 * controller whose `refresh()` must be called after every
 * `viewer.loadSkin()`.
 */

export type {
  BlinkInfo,
  BlinkMode,
  DecodeResult,
  JacketInfo,
  NoseInfo,
  PaletteId,
  PatternInfo,
  PixelData,
  Rect,
  RGBA,
  SlotValues,
} from "./decode/core/types";
export { decodeSkin } from "./decode/index";
export { attachETFSkinFeatures } from "./render/controller";
export type {
  BlinkOptions,
  BlinkState,
  ETFController,
  ETFSkinFeaturesOptions,
  ETFTextureInput,
  RemoteImage,
  SkinFeatureToggles,
  TextureCanvas,
  TextureSource,
} from "./render/core/types";
