/**
 * Option normalization for the renderer: every default, invalid-value
 * fallback and the blink timing rules resolve here, so the controller
 * and the features share one resolved shape and the rules are
 * unit-testable without a viewer.
 */

import type {
  BlinkOptions,
  BlinkState,
  ETFSkinFeaturesOptions,
  ETFTextureInput,
  EmissiveOptions,
  EnchantedOptions,
  SkinFeatureToggles,
} from "./types";

/** Fully resolved emissive settings. */
interface NormalizedEmissiveOptions {
  /** Bloom switch; accepted and ignored - deferred quality mode. */
  bloom: boolean;
}

/** Default blink interval in milliseconds. */
const DEFAULT_PERIOD_MS = 6000;

/** Default closed phase in milliseconds. */
const DEFAULT_CLOSED_MS = 250;

/** Default half-closed phase (lead and tail), from the closed phase. */
const DEFAULT_HALF_CLOSED_MS = Math.round(DEFAULT_CLOSED_MS / 2);

/** Smallest accepted blink interval in milliseconds. */
const MIN_PERIOD_MS = 100;

/**
 * The documented blink defaults, exported for consumers that quote or
 * reset them. The resolver derives the same numbers when options are
 * omitted; the option specs assert both stay in sync.
 */
export const DEFAULT_BLINK_OPTIONS = {
  /** Interval between blinks, in ms. */
  periodMs: DEFAULT_PERIOD_MS,
  /** Fully closed phase, in ms. */
  closedMs: DEFAULT_CLOSED_MS,
  /** Half-closed lead phase, in ms. */
  halfClosedMs: DEFAULT_HALF_CLOSED_MS,
  /** Half-closed tail phase, in ms. */
  reopenMs: DEFAULT_HALF_CLOSED_MS,
} as const;

/** Fully resolved blink settings. */
export interface NormalizedBlinkOptions {
  /** The eye state. */
  state: BlinkState;
  /** Interval in ms, or `[minMs, maxMs]` for a per-cycle roll. */
  interval: number | readonly [number, number];
  /** Closed phase in ms. */
  closedMs: number;
  /** Half-closed lead phase in ms. */
  halfClosedMs: number;
  /** Half-closed trailing phase in ms; 0 skips it. */
  reopenMs: number;
}

/** Default enchanted pattern scroll speed in UV units per second. */
const DEFAULT_ENCHANTED_SPEED = 0.1;

/**
 * Default enchanted scroll direction: the (u, v) diagonal. One
 * constant backs both the documented defaults and the resolver.
 */
const DEFAULT_ENCHANTED_DIRECTION: readonly [number, number] = [1, 1];

/** Default enchanted additive brightness factor. */
const DEFAULT_ENCHANTED_OPACITY = 1;

/** Default enchanted pattern tiling across the UVs. */
const DEFAULT_ENCHANTED_SCALE = 1;

/** Default enchanted smoothing: bilinear pattern filtering on. */
const DEFAULT_ENCHANTED_SMOOTH = true;

/**
 * The documented enchanted defaults, exported for consumers that
 * quote or reset them. The resolver derives the same numbers when
 * options are omitted; the option specs assert both stay in sync.
 */
export const DEFAULT_ENCHANTED_OPTIONS = {
  /** Scroll speed, in UV units per second. */
  speed: DEFAULT_ENCHANTED_SPEED,
  /** Scroll direction as a UV-space (u, v) vector. */
  direction: DEFAULT_ENCHANTED_DIRECTION,
  /** Additive brightness factor in 0..1. */
  opacity: DEFAULT_ENCHANTED_OPACITY,
  /** Pattern tiling across the UVs. */
  scale: DEFAULT_ENCHANTED_SCALE,
  /** Bilinear pattern filtering (the in-game look). */
  smooth: DEFAULT_ENCHANTED_SMOOTH,
} as const;

/** Fully resolved enchanted settings. */
interface NormalizedEnchantedOptions {
  /** Texture override: `undefined` = built-in, `null` = off. */
  texture: ETFTextureInput | null | undefined;
  /** Scroll speed in UV units per second. */
  speed: number;
  /** Scroll direction as a UV-space (u, v) vector. */
  direction: readonly [number, number];
  /** Additive brightness factor in 0..1. */
  opacity: number;
  /** Pattern tiling across the UVs. */
  scale: number;
  /** Bilinear pattern filtering. */
  smooth: boolean;
}

/** Internal, fully normalized options. */
interface NormalizedOptions {
  /** Every feature switch with defaults applied. */
  features: Required<SkinFeatureToggles>;
  /** Normalized emissive options: the reserved bloom switch. */
  emissive: NormalizedEmissiveOptions;
  /** Normalized blink behavior: state, interval and phases. */
  blink: NormalizedBlinkOptions;
  /** Villager nose options: texture override only. */
  villagerNose: { texture: ETFTextureInput | null | undefined };
  /** Enchanted options: texture override and motion parameters. */
  enchanted: NormalizedEnchantedOptions;
  /** Whether the controller drives `update(dt)` from the viewer. */
  manageTicker: boolean;
  /** Warning sink, or `null` for `console.warn`. */
  onWarning: ((message: string) => void) | null;
}

/**
 * Resolves the public emissive options into fully normalized
 * settings: only a boolean `bloom` passes through; anything else
 * falls back to `false` (the flag is accepted and ignored).
 *
 * @param options - The user options, if any.
 * @returns The resolved settings.
 */
export function normalizeEmissiveOptions(
  options?: EmissiveOptions,
): NormalizedEmissiveOptions {
  return {
    bloom: typeof options?.bloom === "boolean" ? options.bloom : false,
  };
}

/**
 * Whether a duration is usable: a finite number >= 0.
 *
 * @param value - The candidate value.
 * @returns `true` for finite non-negative numbers.
 */
function isDuration(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/**
 * Sanitizes the raw interval option: invalid values fall back to the
 * default, reversed tuples are swapped and equal ends collapse to a
 * fixed value.
 *
 * @param raw - The raw `periodMs` value.
 * @returns A positive number or a normalized tuple.
 */
function resolveInterval(
  raw: number | readonly [number, number] | undefined,
): number | readonly [number, number] {
  if (raw === undefined) {
    return DEFAULT_PERIOD_MS;
  }
  if (typeof raw === "number") {
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_PERIOD_MS;
  }
  const [first, second] = raw;
  if (!isDuration(first) || !isDuration(second)) {
    return DEFAULT_PERIOD_MS;
  }
  if (first === second) {
    return first === 0 ? DEFAULT_PERIOD_MS : first;
  }
  return first < second ? [first, second] : [second, first];
}

/**
 * Resolves the public blink options into fully normalized settings:
 * defaults applied, invalid values replaced, the interval sanitized
 * and clamped so consecutive blinks never overlap.
 *
 * @param options - The user options, if any.
 * @returns The resolved settings.
 */
export function normalizeBlinkOptions(
  options?: BlinkOptions,
): NormalizedBlinkOptions {
  const state = options?.state;
  const resolvedState: BlinkState =
    state === "open" || state === "halfClosed" || state === "closed"
      ? state
      : "auto";
  const closedMs = isDuration(options?.closedMs)
    ? options.closedMs
    : DEFAULT_CLOSED_MS;
  const halfClosedMs = isDuration(options?.halfClosedMs)
    ? options.halfClosedMs
    : Math.round(closedMs / 2);
  const reopenMs = isDuration(options?.reopenMs)
    ? options.reopenMs
    : halfClosedMs;
  const minInterval = Math.max(
    MIN_PERIOD_MS,
    closedMs + halfClosedMs + reopenMs,
  );
  let interval = resolveInterval(options?.periodMs);
  if (typeof interval === "number") {
    interval = Math.max(interval, minInterval);
  } else {
    const low = Math.max(interval[0], minInterval);
    const high = Math.max(interval[1], minInterval);
    interval = low === high ? low : [low, high];
  }
  return { state: resolvedState, interval, closedMs, halfClosedMs, reopenMs };
}

/**
 * Resolves the scroll-direction option: a pair of finite numbers
 * passes through as given (zero and negative components are legal),
 * anything else - a non-finite component included - falls back to
 * the documented default.
 *
 * @param raw - The raw `direction` value.
 * @returns The resolved direction pair.
 */
function resolveDirection(
  raw: readonly [number, number] | undefined,
): readonly [number, number] {
  if (raw !== undefined && Number.isFinite(raw[0]) && Number.isFinite(raw[1])) {
    return raw;
  }
  return DEFAULT_ENCHANTED_DIRECTION;
}

/**
 * Resolves the public enchanted options into fully normalized
 * settings: defaults applied, non-finite numbers replaced and
 * `opacity` clamped to 0..1.
 *
 * @param options - The user options, if any.
 * @returns The resolved settings.
 */
export function normalizeEnchantedOptions(
  options?: EnchantedOptions,
): NormalizedEnchantedOptions {
  const speed =
    typeof options?.speed === "number" && Number.isFinite(options.speed)
      ? options.speed
      : DEFAULT_ENCHANTED_SPEED;
  const opacity =
    typeof options?.opacity === "number" && Number.isFinite(options.opacity)
      ? Math.min(1, Math.max(0, options.opacity))
      : DEFAULT_ENCHANTED_OPACITY;
  const scale =
    typeof options?.scale === "number" &&
    Number.isFinite(options.scale) &&
    options.scale > 0
      ? options.scale
      : DEFAULT_ENCHANTED_SCALE;
  const smooth =
    typeof options?.smooth === "boolean"
      ? options.smooth
      : DEFAULT_ENCHANTED_SMOOTH;
  const direction = resolveDirection(options?.direction);
  return {
    texture: options?.texture,
    speed,
    direction,
    opacity,
    scale,
    smooth,
  };
}

/**
 * Resolves the public options into fully normalized settings: the
 * feature defaults applied and every group routed through its
 * normalizer.
 *
 * @param options - The user options, if any.
 * @returns The normalized settings.
 */
export function normalizeOptions(
  options: ETFSkinFeaturesOptions,
): NormalizedOptions {
  const features = options.features ?? {};
  return {
    features: {
      transparency: features.transparency ?? true,
      emissive: features.emissive ?? true,
      blink: features.blink ?? true,
      nose: features.nose ?? true,
      jacket: features.jacket ?? true,
      enchanted: features.enchanted ?? true,
    },
    emissive: normalizeEmissiveOptions(options.emissive),
    blink: normalizeBlinkOptions(options.blink),
    villagerNose: { texture: options.villagerNose?.texture },
    enchanted: normalizeEnchantedOptions(options.enchanted),
    manageTicker: options.manageTicker ?? true,
    onWarning: options.onWarning ?? null,
  };
}
