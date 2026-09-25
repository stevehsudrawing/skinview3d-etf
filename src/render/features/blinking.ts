/**
 * Blinking feature: the blink schedule, the canvas rectangles a blink
 * touches and a rectangle-scoped painter for the host skin canvas and
 * the emissive glow.
 *
 * Frame semantics follow the official ETF skin guide: `frames[0]` is
 * the fully closed copy and `frames[1]` the half-closed copy (present
 * in 2-frame modes only). The schedule plays half-closed -> closed ->
 * half-closed with per-phase durations; a fixed eye state holds one
 * frame and suspends the schedule.
 */

import {
  BLINK_EYE_STRIPS,
  BLINK_FACE_RECT,
  BLINK_HAT_RECT,
} from "../../decode/core/constants";
import type { BlinkInfo, PixelData, Rect } from "../../decode/core/types";
import {
  paintCanvasPixels,
  paintCanvasRect,
  readCanvasPixels,
} from "../core/canvas";
import type { NormalizedBlinkOptions } from "../core/options";
import type { BlinkState } from "../core/types";

/** One scheduled blink phase. */
interface BlinkPhase {
  /** The frame index to show. */
  frame: number;
  /** The phase duration in ms. */
  ms: number;
}

/** Handle over the blink schedule. */
export interface BlinkScheduler {
  /**
   * Advances the schedule by `dtMs` milliseconds.
   *
   * @param dtMs - Elapsed time; negative values are ignored.
   * @returns The visible frame index, or -1 for the open state.
   */
  advance(dtMs: number): number;
  /** Restarts the schedule with a fresh seeded first delay. */
  reset(): void;
}

/** Glow-mask integration for the painter. */
export interface BlinkGlow {
  /** The open emissive mask, or `null` when nothing glows. */
  openMask: PixelData | null;
  /** Per-frame masks; `null` when a frame has no glowing pixels. */
  frameMasks: readonly (PixelData | null)[];
  /**
   * Applies one mask (or `null` for nothing at all) to the glow
   * texture.
   *
   * @param mask - The mask to upload.
   */
  repaint(mask: PixelData | null): void;
}

/** Handle over the blink repainting. */
export interface BlinkPainter {
  /**
   * Shows one prepared frame, or restores the open state for -1.
   *
   * @param frame - The frame index, or -1 for open.
   */
  show(frame: number): void;
  /** Restores the pre-blink canvas pixels and glow. Idempotent. */
  restore(): void;
}

/**
 * FNV-1a hash of the pixel bytes: the deterministic seed behind the
 * per-skin first delay and interval rolls. The same skin always
 * behaves identically while different skins stay de-synchronized.
 *
 * @param data - The skin's RGBA bytes.
 * @returns A 32-bit unsigned integer.
 */
export function blinkSeed(data: Uint8ClampedArray): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < data.length; index++) {
    hash ^= data[index];
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Creates a deterministic PRNG (mulberry32) for the interval rolls.
 *
 * @param seed - The 32-bit seed.
 * @returns A function yielding values in `[0, 1)`.
 */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Draws one interval: the fixed value itself, or a uniformly rounded
 * value inside the range.
 *
 * @param random - The seeded PRNG.
 * @param interval - The normalized interval.
 * @returns The interval in ms.
 */
function drawInterval(
  random: () => number,
  interval: number | readonly [number, number],
): number {
  if (typeof interval === "number") {
    return interval;
  }
  const [low, high] = interval;
  return low + Math.round(random() * (high - low));
}

/**
 * The first delay after a (re)start: derived from the skin seed so
 * skins de-synchronize while staying deterministic.
 *
 * @param seed - The 32-bit skin seed.
 * @param interval - The normalized interval.
 * @returns The delay in ms.
 */
function firstDelayMs(
  seed: number,
  interval: number | readonly [number, number],
): number {
  if (typeof interval === "number") {
    return seed % interval;
  }
  const [low, high] = interval;
  return low + (seed % (high - low + 1));
}

/**
 * Returns the canvas rectangles a blink repaint touches: the face and
 * hat squares for the lazy modes, the eye strip row(s) for the
 * optimized modes. The strip height derives from the decoder's
 * `BLINK_EYE_STRIPS` table so the fact lives in one place.
 *
 * @param info - The decoded blink data.
 * @returns The affected rectangles.
 */
export function blinkRects(info: BlinkInfo): Rect[] {
  if (info.mode === 1 || info.mode === 2) {
    return [BLINK_FACE_RECT, BLINK_HAT_RECT];
  }
  const strip = BLINK_EYE_STRIPS[info.mode][0];
  const height = strip.y2 - strip.y1 + 1;
  const top = BLINK_FACE_RECT.y1 + ((info.eyeHeight ?? 1) - 1);
  return [
    {
      x1: BLINK_FACE_RECT.x1,
      y1: top,
      x2: BLINK_FACE_RECT.x2,
      y2: top + height - 1,
    },
  ];
}

/**
 * Whether an emissive mask has any glowing pixel inside the
 * rectangles a blink repaints.
 *
 * @param mask - The emissive mask, or `null` when nothing glows.
 * @param info - The decoded blink data.
 * @returns `true` when the glow content has to follow the blink.
 */
export function glowOverlaps(mask: PixelData | null, info: BlinkInfo): boolean {
  if (mask === null) {
    return false;
  }
  return blinkRects(info).some((rect) => {
    for (let y = rect.y1; y <= rect.y2; y++) {
      for (let x = rect.x1; x <= rect.x2; x++) {
        if (mask.data[(y * mask.width + x) * 4 + 3] !== 0) {
          return true;
        }
      }
    }
    return false;
  });
}

/**
 * Resolves the frame a fixed eye state shows, applying the
 * availability fallbacks: half-closed needs a second frame (1-frame
 * modes fall back to closed), and every fixed state falls back to
 * open when the skin has no blink data at all.
 *
 * @param state - The requested eye state.
 * @param info - The decoded blink data, or `null`.
 * @returns The frame index, or -1 for the open state.
 */
export function blinkStateFrame(
  state: BlinkState,
  info: BlinkInfo | null,
): number {
  if (state === "open" || info === null) {
    return -1;
  }
  if (state === "halfClosed") {
    return info.frames.length > 1 ? 1 : 0;
  }
  if (state === "closed") {
    return 0;
  }
  return -1;
}

/**
 * Creates the blink schedule: a seeded first delay, then repeating
 * blink phases (half-closed lead, closed, half-closed tail; zero
 * phases skipped) separated by drawn intervals.
 *
 * @param frameCount - The number of prepared frames (1 or 2).
 * @param timing - The normalized blink settings.
 * @param seed - The 32-bit skin seed.
 * @returns The scheduler.
 */
export function createBlinkScheduler(
  frameCount: number,
  timing: NormalizedBlinkOptions,
  seed: number,
): BlinkScheduler {
  const phases: BlinkPhase[] = [];
  if (frameCount > 1 && timing.halfClosedMs > 0) {
    phases.push({ frame: 1, ms: timing.halfClosedMs });
  }
  if (timing.closedMs > 0) {
    phases.push({ frame: 0, ms: timing.closedMs });
  }
  if (frameCount > 1 && timing.reopenMs > 0) {
    phases.push({ frame: 1, ms: timing.reopenMs });
  }
  const random = createRandom(seed);
  let visible = -1;
  let index = -1;
  let remaining = firstDelayMs(seed, timing.interval);

  return {
    advance: (dtMs: number): number => {
      let left = Math.max(0, dtMs);
      while (left > 0) {
        if (remaining > left) {
          remaining -= left;
          break;
        }
        left -= remaining;
        index = index === -1 ? 0 : index + 1;
        if (index >= phases.length) {
          index = -1;
          visible = -1;
          remaining = drawInterval(random, timing.interval);
        } else {
          visible = phases[index].frame;
          remaining = phases[index].ms;
        }
      }
      return visible;
    },
    reset: (): void => {
      visible = -1;
      index = -1;
      remaining = firstDelayMs(seed, timing.interval);
    },
  };
}

/**
 * Creates the rectangle-scoped blink painter: the canvas is snapshotted
 * before the first patch, only the affected rectangles are painted from
 * the frames and `restore()` puts everything back.
 *
 * @param canvas - The host skin canvas.
 * @param info - The decoded blink data.
 * @param glow - Glow-mask integration, or `null` when the emissive
 *   feature is inactive or nothing glows inside the blink rects.
 * @param markDirty - Marks the host skin maps for re-upload.
 * @returns The painter.
 */
export function createBlinkPainter(
  canvas: HTMLCanvasElement,
  info: BlinkInfo,
  glow: BlinkGlow | null,
  markDirty: () => void,
): BlinkPainter {
  const rects = blinkRects(info);
  let snapshot: PixelData | null = null;
  let visible = -1;

  const paintGlow = (frame: number): void => {
    if (glow === null) {
      return;
    }
    glow.repaint(frame < 0 ? glow.openMask : (glow.frameMasks[frame] ?? null));
  };

  const restore = (): void => {
    if (snapshot === null) {
      return;
    }
    paintCanvasPixels(canvas, snapshot);
    snapshot = null;
    visible = -1;
    markDirty();
    paintGlow(-1);
  };

  const show = (frame: number): void => {
    if (frame === visible) {
      return;
    }
    if (frame < 0) {
      restore();
      return;
    }
    if (snapshot === null) {
      snapshot = readCanvasPixels(canvas);
    }
    for (const rect of rects) {
      paintCanvasRect(canvas, info.frames[frame], rect);
    }
    visible = frame;
    markDirty();
    paintGlow(frame);
  };

  return { show, restore };
}
