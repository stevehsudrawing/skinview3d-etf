/**
 * Option normalization specs: the defaults, feature merging and the
 * blink / enchanted passthrough of `normalizeOptions()`, plus the
 * resolved blink and enchanted shapes.
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_BLINK_OPTIONS,
  DEFAULT_ENCHANTED_OPTIONS,
  normalizeEnchantedOptions,
  normalizeOptions,
} from "../../src/render/core/options";

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
    expect(settings.villagerNose).toEqual({ texture: undefined });
    expect(settings.enchanted).toEqual({
      texture: undefined,
      speed: 0.1,
      opacity: 1,
      scale: 1,
      smooth: true,
    });
    expect(settings.onWarning).toBeNull();
  });

  it("keeps the exported blink defaults in sync with the resolver", () => {
    const settings = normalizeOptions({});
    expect({
      periodMs: settings.blink.interval,
      closedMs: settings.blink.closedMs,
      halfClosedMs: settings.blink.halfClosedMs,
      reopenMs: settings.blink.reopenMs,
    }).toEqual(DEFAULT_BLINK_OPTIONS);
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
      villagerNose: { texture: null },
      enchanted: { texture: "https://example.com/enchanted.png" },
      onWarning,
    });
    expect(settings.bloom).toBe(true);
    expect(settings.manageTicker).toBe(false);
    expect(settings.villagerNose.texture).toBeNull();
    expect(settings.enchanted.texture).toBe(
      "https://example.com/enchanted.png",
    );
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

describe("normalizeEnchantedOptions", () => {
  it("applies the documented defaults", () => {
    expect(normalizeEnchantedOptions()).toEqual({
      texture: undefined,
      speed: 0.1,
      opacity: 1,
      scale: 1,
      smooth: true,
    });
  });

  it("keeps the exported enchanted defaults in sync with the resolver", () => {
    const settings = normalizeEnchantedOptions({});
    expect({
      speed: settings.speed,
      opacity: settings.opacity,
      scale: settings.scale,
      smooth: settings.smooth,
    }).toEqual(DEFAULT_ENCHANTED_OPTIONS);
  });

  it("replaces non-finite values with the defaults and clamps opacity", () => {
    expect(normalizeEnchantedOptions({ speed: Number.NaN }).speed).toBe(0.1);
    expect(
      normalizeEnchantedOptions({ speed: Number.POSITIVE_INFINITY }).speed,
    ).toBe(0.1);
    expect(normalizeEnchantedOptions({ opacity: 2 }).opacity).toBe(1);
    expect(normalizeEnchantedOptions({ opacity: -1 }).opacity).toBe(0);
    expect(normalizeEnchantedOptions({ opacity: Number.NaN }).opacity).toBe(1);
    expect(normalizeEnchantedOptions({ scale: 0 }).scale).toBe(1);
    expect(normalizeEnchantedOptions({ scale: -3 }).scale).toBe(1);
    expect(normalizeEnchantedOptions({ scale: Number.NaN }).scale).toBe(1);
  });

  it("accepts zero and negative speeds and positive scales", () => {
    expect(normalizeEnchantedOptions({ speed: 0 }).speed).toBe(0);
    expect(normalizeEnchantedOptions({ speed: -0.5 }).speed).toBe(-0.5);
    expect(normalizeEnchantedOptions({ scale: 2.5 }).scale).toBe(2.5);
  });

  it("accepts explicit smoothing and falls back for non-booleans", () => {
    expect(normalizeEnchantedOptions({ smooth: false }).smooth).toBe(false);
    expect(normalizeEnchantedOptions({ smooth: true }).smooth).toBe(true);
    expect(
      normalizeEnchantedOptions({ smooth: 1 as unknown as boolean }).smooth,
    ).toBe(true);
  });
});
