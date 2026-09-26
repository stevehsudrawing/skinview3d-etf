/**
 * Blinking core specs: option normalization, the seeded schedule, the
 * repaint rectangles, the pattern-glow bridge and the fixed eye-state
 * resolution.
 */

import { describe, expect, it } from "vitest";
import { createImage } from "../../src/decode/core/pixels";
import type {
  BlinkInfo,
  BlinkMode,
  PatternInfo,
  PixelData,
} from "../../src/decode/core/types";
import {
  normalizeBlinkOptions,
  type NormalizedBlinkOptions,
} from "../../src/render/core/options";
import type { BlinkState } from "../../src/render/core/types";
import {
  blinkRects,
  blinkSeed,
  blinkStateFrame,
  createBlinkScheduler,
  createPatternGlow,
  glowOverlaps,
} from "../../src/render/features/blinking";

/**
 * Builds synthetic blink data; the frame pixels are irrelevant for
 * these specs.
 *
 * @param mode - The blink mode.
 * @param frameCount - The number of prepared frames.
 * @param eyeHeight - The recorded eye height, if any.
 * @returns The fabricated blink info.
 */
function makeInfo(
  mode: BlinkMode,
  frameCount: number,
  eyeHeight: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | null = null,
): BlinkInfo {
  return {
    mode,
    eyeHeight,
    frames: Array.from({ length: frameCount }, () => createImage(64, 64)),
  };
}

/**
 * Builds a synthetic pattern whose mask carries one glowing pixel.
 *
 * @param x - The pixel column (64x64 layout).
 * @param y - The pixel row.
 * @returns The fabricated pattern.
 */
function makePattern(x: number, y: number): PatternInfo {
  const mask = createImage(64, 64);
  mask.data[(y * 64 + x) * 4 + 3] = 255;
  return { box: { x1: 0, y1: 0, x2: 0, y2: 0 }, keys: [], mask };
}

/**
 * Normalizes options with the closed phase pinned, so the phase
 * boundaries are easy to step through.
 *
 * @param overrides - Extra options on top of `closedMs: 250`.
 * @returns The normalized settings.
 */
function timing(overrides = {}): NormalizedBlinkOptions {
  return normalizeBlinkOptions({ closedMs: 250, ...overrides });
}

describe("normalizeBlinkOptions", () => {
  it("applies the documented defaults", () => {
    expect(normalizeBlinkOptions()).toEqual({
      state: "auto",
      interval: 6000,
      closedMs: 250,
      halfClosedMs: 125,
      reopenMs: 125,
    });
  });

  it("swaps reversed interval tuples and collapses equal ends", () => {
    expect(timing({ periodMs: [8000, 4000] }).interval).toEqual([4000, 8000]);
    expect(timing({ periodMs: [5000, 5000] }).interval).toBe(5000);
  });

  it("clamps the interval up to the total blink duration", () => {
    expect(timing({ periodMs: 300 }).interval).toBe(500);
  });

  it("replaces invalid values with defaults", () => {
    expect(timing({ periodMs: Number.NaN }).interval).toBe(6000);
    expect(timing({ periodMs: -5 }).interval).toBe(6000);
    expect(timing({ closedMs: -1 }).closedMs).toBe(250);
    expect(timing({ closedMs: Number.NaN }).closedMs).toBe(250);
    expect(normalizeBlinkOptions({ state: "bogus" as BlinkState }).state).toBe(
      "auto",
    );
  });

  it("keeps explicit zero phase durations", () => {
    const settings = timing({ closedMs: 0, halfClosedMs: 0, reopenMs: 0 });
    expect(settings.closedMs).toBe(0);
    expect(settings.halfClosedMs).toBe(0);
    expect(settings.reopenMs).toBe(0);
  });

  it("derives the trailing phase from the lead phase", () => {
    const settings = timing({ closedMs: 400 });
    expect(settings.halfClosedMs).toBe(200);
    expect(settings.reopenMs).toBe(200);
    expect(timing({ closedMs: 400, reopenMs: 0 }).reopenMs).toBe(0);
  });
});

describe("blinkSeed", () => {
  it("is stable per byte sequence and differs across skins", () => {
    const a = new Uint8ClampedArray([0, 1, 2, 3]);
    const b = new Uint8ClampedArray([0, 1, 2, 4]);
    const first = blinkSeed(a);
    expect(first).toBe(blinkSeed(a));
    expect(first).not.toBe(blinkSeed(b));
    expect(Number.isInteger(first)).toBe(true);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(2 ** 32);
  });
});

describe("blinkRects", () => {
  it("covers the face and hat squares for the lazy modes", () => {
    const expected = [
      { x1: 8, y1: 8, x2: 15, y2: 15 },
      { x1: 40, y1: 8, x2: 47, y2: 15 },
    ];
    expect(blinkRects(makeInfo(1, 1))).toEqual(expected);
    expect(blinkRects(makeInfo(2, 2))).toEqual(expected);
  });

  it("stamps the eye row from the strip table for mode 3", () => {
    expect(blinkRects(makeInfo(3, 1, 5))).toEqual([
      { x1: 8, y1: 12, x2: 15, y2: 12 },
    ]);
  });

  it("derives the height from the strips for modes 4 and 5", () => {
    expect(blinkRects(makeInfo(4, 2, 4))).toEqual([
      { x1: 8, y1: 11, x2: 15, y2: 12 },
    ]);
    expect(blinkRects(makeInfo(5, 2, 3))).toEqual([
      { x1: 8, y1: 10, x2: 15, y2: 13 },
    ]);
  });
});

describe("glowOverlaps", () => {
  it("detects glow pixels inside the eye strip", () => {
    const info = makeInfo(3, 1, 5);
    const mask = createImage(64, 64);
    expect(glowOverlaps(mask, info)).toBe(false);
    mask.data[(12 * 64 + 10) * 4 + 3] = 255;
    expect(glowOverlaps(mask, info)).toBe(true);
  });

  it("ignores glow pixels outside the rectangles and a null mask", () => {
    const info = makeInfo(3, 1, 5);
    const mask = createImage(64, 64);
    mask.data[(20 * 64 + 10) * 4 + 3] = 255;
    expect(glowOverlaps(mask, info)).toBe(false);
    expect(glowOverlaps(null, info)).toBe(false);
  });

  it("covers the hat square for the lazy modes", () => {
    const info = makeInfo(1, 1);
    const mask = createImage(64, 64);
    mask.data[(8 * 64 + 40) * 4 + 3] = 255;
    expect(glowOverlaps(mask, info)).toBe(true);
  });
});

describe("createPatternGlow", () => {
  it("returns null without a pattern or without overlap", () => {
    const info = makeInfo(3, 1, 5);
    expect(createPatternGlow(info, null, () => undefined)).toBeNull();
    expect(
      createPatternGlow(info, makePattern(0, 0), () => undefined),
    ).toBeNull();
  });

  it("prepares the open mask, the frame masks and the repaint hook", () => {
    const info = makeInfo(3, 1, 5);
    const pattern = makePattern(10, 12);
    const repaints: (PixelData | null)[] = [];
    const glow = createPatternGlow(info, pattern, (mask) => {
      repaints.push(mask);
    });
    expect(glow).not.toBeNull();
    if (glow === null) {
      return;
    }
    expect(glow.openMask).toBe(pattern.mask);
    expect(glow.frameMasks).toEqual([null]);
    glow.repaint(glow.openMask);
    expect(repaints).toEqual([pattern.mask]);
  });
});

describe("blinkStateFrame", () => {
  it("resolves the fixed states with availability fallbacks", () => {
    const twoFrames = makeInfo(4, 2);
    const oneFrame = makeInfo(3, 1);
    expect(blinkStateFrame("auto", twoFrames)).toBe(-1);
    expect(blinkStateFrame("open", twoFrames)).toBe(-1);
    expect(blinkStateFrame("closed", twoFrames)).toBe(0);
    expect(blinkStateFrame("halfClosed", twoFrames)).toBe(1);
    expect(blinkStateFrame("halfClosed", oneFrame)).toBe(0);
    expect(blinkStateFrame("closed", null)).toBe(-1);
    expect(blinkStateFrame("halfClosed", null)).toBe(-1);
  });
});

describe("createBlinkScheduler", () => {
  it("steps through the 2-frame sequence at exact boundaries", () => {
    const scheduler = createBlinkScheduler(2, timing(), 1234);
    expect(scheduler.advance(0)).toBe(-1);
    expect(scheduler.advance(1234)).toBe(1);
    expect(scheduler.advance(125)).toBe(0);
    expect(scheduler.advance(250)).toBe(1);
    expect(scheduler.advance(125)).toBe(-1);
    expect(scheduler.advance(6000)).toBe(1);
  });

  it("shows only the closed frame on 1-frame modes", () => {
    const scheduler = createBlinkScheduler(1, timing(), 1234);
    expect(scheduler.advance(1234)).toBe(0);
    expect(scheduler.advance(250)).toBe(-1);
    expect(scheduler.advance(6000)).toBe(0);
  });

  it("skips the trailing phase when reopenMs is 0", () => {
    const scheduler = createBlinkScheduler(2, timing({ reopenMs: 0 }), 1234);
    expect(scheduler.advance(1234)).toBe(1);
    expect(scheduler.advance(125)).toBe(0);
    expect(scheduler.advance(250)).toBe(-1);
    expect(scheduler.advance(6000)).toBe(1);
  });

  it("never blinks when every phase has zero duration", () => {
    const scheduler = createBlinkScheduler(
      2,
      timing({ closedMs: 0, halfClosedMs: 0, reopenMs: 0 }),
      1234,
    );
    expect(scheduler.advance(1234)).toBe(-1);
    expect(scheduler.advance(6000)).toBe(-1);
    expect(scheduler.advance(100000)).toBe(-1);
  });

  it("ignores negative and zero steps", () => {
    const scheduler = createBlinkScheduler(2, timing(), 1234);
    expect(scheduler.advance(-500)).toBe(-1);
    expect(scheduler.advance(0)).toBe(-1);
    expect(scheduler.advance(1234)).toBe(1);
  });

  it("stays bounded across a very large step", () => {
    const scheduler = createBlinkScheduler(2, timing(), 1234);
    expect([-1, 0, 1]).toContain(scheduler.advance(1e9));
    expect(scheduler.advance(0)).toBe(scheduler.advance(0));
  });

  it("derives the first delay from the seed in a range", () => {
    const settings = timing({ periodMs: [4000, 8000] });
    const first = createBlinkScheduler(2, settings, 1);
    const second = createBlinkScheduler(2, settings, 2);
    expect(first.advance(4000)).toBe(-1);
    expect(second.advance(4000)).toBe(-1);
    expect(first.advance(1)).toBe(1);
    expect(second.advance(1)).toBe(-1);
    expect(second.advance(1)).toBe(1);
  });

  it("replays identically per seed and varies across seeds", () => {
    const settings = timing({ periodMs: [4000, 8000] });
    const steps = [4042, 100, 300, 100, 6000, 7000, 8000];
    const run = (seed: number): number[] => {
      const scheduler = createBlinkScheduler(2, settings, seed);
      return steps.map((step) => scheduler.advance(step));
    };
    expect(run(42)).toEqual(run(42));
    expect(run(42)).not.toEqual(run(43));
  });

  it("restarts from the seeded first delay on reset", () => {
    const scheduler = createBlinkScheduler(2, timing(), 1234);
    expect(scheduler.advance(1234)).toBe(1);
    scheduler.reset();
    expect(scheduler.advance(1233)).toBe(-1);
    expect(scheduler.advance(1)).toBe(1);
  });
});
