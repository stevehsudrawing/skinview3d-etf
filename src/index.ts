/**
 * skinview3d-etf public entry point.
 *
 * `decodeSkin()` reads every ETF player skin feature into plain data
 * and prepared overlay images; `attachETFSkinFeatures()` renders the
 * supported features (transparency, the nose, the emissive pixels,
 * blinking eyes and the enchanted glint) on a live `skinview3d`
 * viewer and returns a controller whose `refresh()` must be called
 * after every `viewer.loadSkin()`.
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
export {
  DEFAULT_BLINK_OPTIONS,
  DEFAULT_GLINT_OPTIONS,
} from "./render/core/options";
export type {
  BlinkOptions,
  BlinkState,
  ETFController,
  ETFSkinFeaturesOptions,
  ETFTextureInput,
  GlintOptions,
  RemoteImage,
  SkinFeatureToggles,
  TextureCanvas,
  TextureSource,
  VillagerNoseOptions,
} from "./render/core/types";
