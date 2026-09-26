/**
 * Public renderer types: texture inputs, feature toggles, options and
 * the controller contract. Type-only module - no runtime code.
 */

import type { Texture } from "three";
import type { PixelData } from "../../decode/core/types";

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
 * (`villagerNose.texture` and `glint.texture`).
 */
export type ETFTextureInput = TextureSource | RemoteImage | PixelData | Texture;

/**
 * Per-feature switches. Keys whose rendering is not implemented yet
 * are accepted and ignored, so callers can wire settings UIs once.
 */
export interface SkinFeatureToggles {
  /** Enables transparency on the base skin layer. */
  transparency?: boolean;
  /** Enables the fullbright emissive pixel overlays. */
  emissive?: boolean;
  /** Enables blinking eyes on skins that define blink frames. */
  blink?: boolean;
  /** Enables the villager and textured nose. */
  nose?: boolean;
  /** Reserved - jacket rendering lands after v0.0.1. */
  jacket?: boolean;
  /** Enables the enchanted (glint) overlay. */
  enchanted?: boolean;
}

/**
 * The eye state: `"auto"` blinks periodically, the other values hold
 * one frame and suspend the schedule.
 */
export type BlinkState = "auto" | "open" | "halfClosed" | "closed";

/** Blink behavior options. */
export interface BlinkOptions {
  /**
   * Eye state. `"halfClosed"` needs a 2-frame blink mode (1-frame
   * modes fall back to `"closed"`); every fixed state falls back to
   * `"open"` when the skin defines no blink frames.
   */
  state?: BlinkState;
  /**
   * Interval between blinks in milliseconds (default 6000). A
   * `[minMs, maxMs]` tuple re-rolls the interval after every blink
   * from a per-skin deterministic sequence; the interval is clamped
   * so consecutive blinks never overlap.
   */
  periodMs?: number | readonly [number, number];
  /**
   * Time the eyes stay fully closed, in milliseconds (default 250).
   * On 2-frame modes this is the middle phase between the two
   * half-closed phases.
   */
  closedMs?: number;
  /**
   * 2-frame modes only: the half-closed lead phase in milliseconds
   * (default `closedMs / 2`); `0` skips the phase.
   */
  halfClosedMs?: number;
  /**
   * 2-frame modes only: the half-closed trailing phase in
   * milliseconds (default the resolved `halfClosedMs`); `0` reopens
   * the eyes right after the closed phase - the upstream pop-open
   * look.
   */
  reopenMs?: number;
}

/** Villager nose options. */
export interface VillagerNoseOptions {
  /**
   * Texture of the flat villager nose. Defaults to the built-in
   * self-drawn texture; `null` disables villager noses.
   */
  texture?: ETFTextureInput | null;
}

/** Enchanted (glint) overlay options. */
export interface GlintOptions {
  /**
   * Glint pattern texture. Defaults to the built-in self-drawn
   * texture; `null` renders no glint.
   */
  texture?: ETFTextureInput | null;
  /**
   * Diagonal scroll speed in UV units per second (default 0.1).
   * `0` freezes the pattern; negative values reverse the direction.
   */
  speed?: number;
  /**
   * Additive brightness factor in 0..1 (default 1); values outside
   * the range are clamped.
   */
  opacity?: number;
  /**
   * How many times the pattern tiles across the UVs (default 1).
   * Values `<= 0` fall back to the default.
   */
  scale?: number;
  /**
   * Bilinear filtering for the pattern texture (default `true`, the
   * smoothed in-game glint look); `false` keeps crisp pixels.
   */
  smooth?: boolean;
}

/** Options accepted by `attachETFSkinFeatures()`. */
export interface ETFSkinFeaturesOptions {
  /** Per-feature switches; every feature defaults to enabled. */
  features?: SkinFeatureToggles;
  /** Blink behavior: eye state and timing. */
  blink?: BlinkOptions;
  /**
   * Reserved - accepted and ignored. Upstream renders emissive
   * pixels fullbright without post-processing; an optional bloom
   * quality mode is deferred.
   */
  bloom?: boolean;
  /**
   * When `true` (the default) the controller drives `update(dt)` from
   * the viewer's animation slot - hooking an existing animation or
   * installing a private `FunctionAnimation` while the slot is empty.
   * When `false`, call `controller.update(dt)` yourself. Replacing
   * `viewer.animation` yourself disconnects a private ticker; call
   * `controller.rebind()` to re-attach it.
   */
  manageTicker?: boolean;
  /** Villager nose options (the texture override). */
  villagerNose?: VillagerNoseOptions;
  /** Enchanted (glint) overlay options (texture and motion). */
  glint?: GlintOptions;
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
   * Advances time-based features by `dt` seconds (the host clock).
   * Negative deltas are ignored. In managed ticker mode this runs
   * automatically; otherwise call it from your render loop.
   */
  update(dt: number): void;
  /** Restores everything and disposes renderer resources. Idempotent. */
  detach(): void;
  /** Switches features on or off at runtime. */
  setFeatures(features: SkinFeatureToggles): void;
  /**
   * Merges villager nose options at runtime: `undefined` keeps the
   * current texture, `null` disables villager noses and any other
   * value replaces the texture.
   */
  setVillagerNoseOptions(options: VillagerNoseOptions): void;
  /**
   * Merges glint options (texture and / or motion parameters) at
   * runtime: `undefined` keeps the current value, `texture: null`
   * disables the glint and any other value replaces it. Invalid
   * numbers fall back to the documented defaults.
   */
  setGlintOptions(options: GlintOptions): void;
  /**
   * Merges blink options (eye state and/or timing) at runtime and
   * restarts the blink schedule.
   *
   * @param options - The partial blink options to apply.
   */
  setBlinkOptions(options: BlinkOptions): void;
}
