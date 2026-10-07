/**
 * Public renderer types: texture inputs, feature toggles, options and
 * the controller contract. Type-only module - no runtime code.
 */

import type { PixelData } from "etf-skin-decoder";
import type { RemoteImage, TextureCanvas, TextureSource } from "skinview-utils";
import type { Texture } from "three";

/**
 * The texture-input shapes, re-used verbatim from `skinview-utils`
 * (the host library's utility layer): this package and the host
 * accept exactly the same inputs, from one shared definition.
 */
export type { RemoteImage, TextureCanvas, TextureSource };

/**
 * Every source accepted by the texture options
 * (`villagerNose.texture` and `enchanted.texture`).
 */
export type ETFTextureInput = TextureSource | RemoteImage | PixelData | Texture;

/**
 * Per-feature switches; each is honored when the decoded skin
 * carries its data, so callers can wire settings UIs once.
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
  /** Enables the jacket/dress extension (the decoded jacket texture). */
  jacket?: boolean;
  /** Enables the enchanted pixel overlay. */
  enchanted?: boolean;
}

/**
 * Emissive pixel options: the reserved bloom flag.
 */
export interface EmissiveOptions {
  /**
   * Reserved - accepted and ignored. Upstream renders emissive
   * pixels fullbright without post-processing; an optional bloom
   * quality mode is deferred.
   */
  bloom?: boolean;
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

/** Enchanted pixel overlay options. */
export interface EnchantedOptions {
  /**
   * Enchanted pattern texture. Defaults to the built-in self-drawn
   * texture; `null` renders no enchanted pixels.
   */
  texture?: ETFTextureInput | null;
  /**
   * Scroll speed in UV units per second (default 0.1); the pattern's
   * sampling offset advances by `speed x direction` per second. `0`
   * freezes the pattern; negative values reverse along `direction`.
   */
  speed?: number;
  /**
   * Scroll direction as a UV-space (u, v) vector (default `[1, 1]`,
   * the diagonal). The vector is used as given - never normalized -
   * so `speed` stays the perceived UV units per second; components
   * may be negative or zero, and `[0, 0]` freezes the pattern.
   */
  direction?: readonly [number, number];
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
   * smoothed in-game look); `false` keeps crisp pixels.
   */
  smooth?: boolean;
}

/**
 * Options accepted by `attachETFSkinFeatures()`. The five feature
 * groups come first - `features` carries the switches, the other
 * four carry their feature's options - and each group has a
 * matching controller setter; `manageTicker` and `onWarning` stay
 * last.
 */
export interface ETFSkinFeaturesOptions {
  /** Per-feature switches; every feature defaults to enabled. */
  features?: SkinFeatureToggles;
  /** Emissive pixel options: the reserved bloom flag. */
  emissive?: EmissiveOptions;
  /** Blink behavior: eye state and timing. */
  blink?: BlinkOptions;
  /** Villager nose options (the texture override). */
  villagerNose?: VillagerNoseOptions;
  /** Enchanted pixel overlay options (texture and motion). */
  enchanted?: EnchantedOptions;
  /**
   * When `true` (the default) the controller drives `update(dt)` from
   * the viewer's animation slot - hooking an existing animation or
   * installing a private `FunctionAnimation` while the slot is empty.
   * When `false`, call `controller.update(dt)` yourself. Replacing
   * `viewer.animation` yourself disconnects a private ticker; call
   * `controller.rebind()` to re-attach it.
   */
  manageTicker?: boolean;
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
   * Negative and non-finite deltas are ignored. In managed ticker
   * mode this runs automatically; otherwise call it from your
   * render loop.
   */
  update(dt: number): void;
  /** Restores everything and disposes renderer resources. Idempotent. */
  detach(): void;
  /** Switches features on or off at runtime. */
  setFeatures(features: SkinFeatureToggles): void;
  /**
   * Merges emissive options at runtime; an omitted (`undefined`)
   * `bloom` keeps the current value - the flag stays inert until a
   * bloom mode lands.
   */
  setEmissiveOptions(options: EmissiveOptions): void;
  /**
   * Merges blink options (eye state and/or timing) at runtime and
   * restarts the blink schedule.
   *
   * @param options - The partial blink options to apply.
   */
  setBlinkOptions(options: BlinkOptions): void;
  /**
   * Merges villager nose options at runtime: an omitted `texture`
   * keeps the current one, `texture: undefined` restores the
   * built-in default, `null` disables villager noses and any other
   * value replaces the texture.
   */
  setVillagerNoseOptions(options: VillagerNoseOptions): void;
  /**
   * Merges enchanted options (texture and / or motion parameters) at
   * runtime: omitted properties keep their current values except
   * `texture` - `texture: undefined` restores the built-in default
   * and `texture: null` disables the enchanted pixels. Invalid
   * numbers fall back to the documented defaults.
   */
  setEnchantedOptions(options: EnchantedOptions): void;
}
