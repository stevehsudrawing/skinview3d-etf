/**
 * skinview3d-etf public entry point.
 *
 * `decodeSkin()` reads every ETF player skin feature into plain data
 * and prepared overlay images; `attachETFSkinFeatures()` renders the
 * supported features (transparency, the nose, the emissive pixels,
 * blinking eyes, the enchanted pixels and the jacket/dress
 * extension) on a live `skinview3d` viewer and returns a controller
 * whose `refresh()` must be called after every `viewer.loadSkin()`.
 */

export { decodeSkin } from "etf-skin-decoder";
export type {
  BlinkInfo,
  BlinkMode,
  Coordinate,
  DecodeResult,
  JacketInfo,
  NoseInfo,
  PaletteId,
  PatternInfo,
  PixelData,
  Rect,
  RGB,
  RGBA,
  SlotValues,
} from "etf-skin-decoder";
export { attachETFSkinFeatures } from "./render/controller";
export {
  DEFAULT_BLINK_OPTIONS,
  DEFAULT_ENCHANTED_OPTIONS,
} from "./render/core/options";
export type {
  BlinkOptions,
  BlinkState,
  EmissiveOptions,
  EnchantedOptions,
  ETFController,
  ETFSkinFeaturesOptions,
  ETFTextureInput,
  RemoteImage,
  SkinFeatureToggles,
  TextureCanvas,
  TextureSource,
  VillagerNoseOptions,
} from "./render/core/types";
