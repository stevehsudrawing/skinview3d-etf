/**
 * Public renderer types: texture inputs, feature toggles, options and
 * the controller contract. Type-only module - no runtime code.
 */

import type { Texture } from "three";
import type { PixelData } from "../decode/types";

/** A DOM canvas accepted as a texture source. */
export type TextureCanvas = HTMLCanvasElement | OffscreenCanvas;

/**
 * A ready-to-use image source (the shapes the host library's
 * `loadSkin` / `loadCape` loaders accept).
 */
export type TextureSource =
  HTMLImageElement | HTMLVideoElement | ImageBitmap | TextureCanvas;

/**
 * A remotely loaded image: a URL string or an object with `src` plus
 * optional CORS settings (the host library's `RemoteImage` shape).
 */
export type RemoteImage =
  | string
  | {
      /** The image URL. */
      src: string;
      /** Requested CORS mode; defaults to `"anonymous"`. */
      crossOrigin?: string | null;
      /** Referrer policy forwarded to the image element. */
      referrerPolicy?: string;
    };

/**
 * Every source accepted by the texture options
 * (`villagerNoseTexture` and `glintTexture`).
 */
export type ETFTextureInput = TextureSource | RemoteImage | PixelData | Texture;

/**
 * Per-feature switches. Keys whose rendering is not implemented yet
 * are accepted and ignored, so callers can wire settings UIs once.
 */
export interface SkinFeatureToggles {
  /** Enables transparency on the base skin layer. */
  transparency?: boolean;
  /** Reserved - emissive rendering lands in a later v0.0.1 commit. */
  emissive?: boolean;
  /** Reserved - blinking lands in a later v0.0.1 commit. */
  blink?: boolean;
  /** Enables the villager and textured nose. */
  nose?: boolean;
  /** Reserved - jacket rendering lands after v0.0.1. */
  jacket?: boolean;
  /** Reserved - glint rendering lands after v0.0.1. */
  enchanted?: boolean;
}

/** Blink timing options; reserved for the blinking commit. */
export interface BlinkTiming {
  /** Time the eyes stay closed, in milliseconds. */
  closedMs?: number;
  /** Time between two blinks, in milliseconds. */
  periodMs?: number;
}

/** Options accepted by `attachETFSkinFeatures()`. */
export interface ETFSkinFeaturesOptions {
  /** Per-feature switches; every feature defaults to enabled. */
  features?: SkinFeatureToggles;
  /** Blink timing; reserved for the blinking commit. */
  blink?: BlinkTiming;
  /** Adds a bloom pass to the emissive pixels; reserved. */
  bloom?: boolean;
  /**
   * When `true` (the default) the controller installs its own ticker
   * whenever the viewer's animation slot is empty; when `false`, drive
   * `controller.update(dt)` yourself. Reserved - the ticker lands with
   * the blinking commit.
   */
  manageTicker?: boolean;
  /**
   * Texture used by the flat villager nose. Defaults to the built-in
   * self-drawn texture; `null` disables villager noses.
   */
  villagerNoseTexture?: ETFTextureInput | null;
  /** Glint overlay texture; reserved for the glint renderer. */
  glintTexture?: ETFTextureInput | null;
  /**
   * Receives warning messages (unsupported skins, texture failures).
   * Falls back to `console.warn`, deduplicated once per message.
   */
  onWarning?: (message: string) => void;
}

/** Controller returned by `attachETFSkinFeatures()`. */
export interface ETFController {
  /**
   * Re-decodes the current skin and re-applies every enabled feature.
   * Call this after `viewer.loadSkin()` - skin changes are never
   * detected automatically.
   */
  refresh(): void;
  /**
   * Re-resolves the viewer's meshes and re-applies the current state.
   * Call this after `playerObject` is replaced or the model is
   * re-parented.
   */
  rebind(): void;
  /**
   * Advances time-based features; a no-op until the blinking commit.
   * `dt` is in seconds, matching the viewer's clock.
   */
  update(dt: number): void;
  /** Restores everything and disposes renderer resources. Idempotent. */
  detach(): void;
  /** Switches features on or off at runtime. */
  setFeatures(features: SkinFeatureToggles): void;
  /**
   * Replaces the villager nose texture at runtime; `null` disables
   * villager noses.
   */
  setVillagerNoseTexture(source: ETFTextureInput | null): void;
}
