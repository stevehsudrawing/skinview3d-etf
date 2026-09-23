/**
 * skinview3d-etf public entry point.
 *
 * The decoder is available now - `decodeSkin()` reads every ETF player
 * skin feature into plain data and prepared overlay images. The
 * renderer API - `attachETFSkinFeatures(viewer, options)` returning
 * `{ refresh(), rebind(), update(dt), detach() }` - arrives in a later
 * v0.0.1 commit.
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
