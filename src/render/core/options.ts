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
  SkinFeatureToggles,
} from "./types";

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

/** Internal, fully normalized options. */
export interface NormalizedOptions {
  /** Every feature switch with defaults applied. */
  features: Required<SkinFeatureToggles>;
  /** Normalized blink behavior: state, interval and phases. */
  blink: NormalizedBlinkOptions;
  /** Bloom switch; accepted and ignored - deferred quality mode. */
  bloom: boolean;
  /** Whether the controller drives `update(dt)` from the viewer. */
  manageTicker: boolean;
  /** Villager nose override: `undefined` = built-in, `null` = off. */
  villagerNoseTexture: ETFTextureInput | null | undefined;
  /** Glint texture; reserved for the glint renderer. */
  glintTexture: ETFTextureInput | null | undefined;
  /** Warning sink, or `null` for `console.warn`. */
  onWarning: ((message: string) => void) | null;
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
 * Applies defaults to the user options.
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
    blink: normalizeBlinkOptions(options.blink),
    bloom: options.bloom ?? false,
    manageTicker: options.manageTicker ?? true,
    villagerNoseTexture: options.villagerNoseTexture,
    glintTexture: options.glintTexture,
    onWarning: options.onWarning ?? null,
  };
}
