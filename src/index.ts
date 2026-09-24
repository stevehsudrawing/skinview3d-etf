/**
 * skinview3d-etf public entry point.
 *
 * `decodeSkin()` reads every ETF player skin feature into plain data
 * and prepared overlay images; `attachETFSkinFeatures()` renders the
 * supported features (transparency and the nose) on a live
 * `skinview3d` viewer and returns a controller whose `refresh()` must
 * be called after every `viewer.loadSkin()`.
 */

export { decodeSkin } from "./decode/index";
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
} from "./decode/types";
export { attachETFSkinFeatures } from "./render/controller";
export type {
  BlinkTiming,
  ETFController,
  ETFSkinFeaturesOptions,
  ETFTextureInput,
  RemoteImage,
  SkinFeatureToggles,
  TextureCanvas,
  TextureSource,
} from "./render/types";
