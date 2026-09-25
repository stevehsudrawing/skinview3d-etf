/**
 * Option normalization specs: the defaults, feature merging and the
 * blink passthrough of `normalizeOptions()`, plus the resolved blink
 * shape.
 */

import { describe, expect, it } from "vitest";
import { normalizeOptions } from "../../src/render/core/options";

describe("normalizeOptions", () => {
  it("applies the documented defaults", () => {
    const settings = normalizeOptions({});
    expect(settings.features).toEqual({
      transparency: true,
      emissive: true,
      blink: true,
      nose: true,
      jacket: true,
      enchanted: true,
    });
    expect(settings.blink).toEqual({
      state: "auto",
      interval: 6000,
      closedMs: 250,
      halfClosedMs: 125,
      reopenMs: 125,
    });
    expect(settings.bloom).toBe(false);
    expect(settings.manageTicker).toBe(true);
    expect(settings.villagerNoseTexture).toBeUndefined();
    expect(settings.glintTexture).toBeUndefined();
    expect(settings.onWarning).toBeNull();
  });

  it("merges partial feature switches over the defaults", () => {
    const settings = normalizeOptions({
      features: { blink: false, jacket: false },
    });
    expect(settings.features.blink).toBe(false);
    expect(settings.features.jacket).toBe(false);
    expect(settings.features.transparency).toBe(true);
  });

  it("passes the scalar and callback options through", () => {
    const onWarning = (): void => undefined;
    const settings = normalizeOptions({
      bloom: true,
      manageTicker: false,
      villagerNoseTexture: null,
      glintTexture: "https://example.com/glint.png",
      onWarning,
    });
    expect(settings.bloom).toBe(true);
    expect(settings.manageTicker).toBe(false);
    expect(settings.villagerNoseTexture).toBeNull();
    expect(settings.glintTexture).toBe("https://example.com/glint.png");
    expect(settings.onWarning).toBe(onWarning);
  });

  it("routes the blink options through the blink normalization", () => {
    const settings = normalizeOptions({
      blink: { state: "closed", closedMs: 300 },
    });
    expect(settings.blink.state).toBe("closed");
    expect(settings.blink.closedMs).toBe(300);
    expect(settings.blink.interval).toBe(6000);
    expect(settings.blink.halfClosedMs).toBe(150);
    expect(settings.blink.reopenMs).toBe(150);
  });
});
