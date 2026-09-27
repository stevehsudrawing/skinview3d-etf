/**
 * Enchanted feature specs: the scrolling phase math and the shared
 * material wiring.
 */

import {
  AdditiveBlending,
  DoubleSide,
  LinearFilter,
  NearestFilter,
  Texture,
} from "three";
import { describe, expect, it } from "vitest";
import {
  advanceEnchantedPhase,
  createEnchantedMaterial,
  createEnchantedTexture,
  setEnchantedPhase,
  setEnchantedTuning,
  updateEnchantedTexture,
} from "../../src/render/features/enchanted";

describe("advanceEnchantedPhase", () => {
  it("advances the phase by speed x dt", () => {
    expect(advanceEnchantedPhase(0, 0.2, 1, 1)).toBeCloseTo(0.2);
    expect(advanceEnchantedPhase(0.5, 0.2, 2, 1)).toBeCloseTo(0.9);
  });

  it("wraps the phase into the tile period", () => {
    expect(advanceEnchantedPhase(0.9, 0.2, 1, 1)).toBeCloseTo(0.1);
    expect(advanceEnchantedPhase(0.25, 0.5, 3, 1)).toBeCloseTo(0.75);
    expect(advanceEnchantedPhase(0.5, 2, 5, 1)).toBeCloseTo(0.5);
  });

  it("keeps the phase on dt = 0", () => {
    expect(advanceEnchantedPhase(0.42, 0.2, 0, 1)).toBe(0.42);
  });

  it("reverses with a negative speed", () => {
    expect(advanceEnchantedPhase(0.1, -0.2, 1, 1)).toBeCloseTo(0.9);
    expect(advanceEnchantedPhase(0, -1, 0.25, 1)).toBeCloseTo(0.75);
  });

  it("wraps at the tile period for non-integer scales", () => {
    const scale = 2.5;
    // 0.35 advances past the 0.4 tile period and lands at 0.05.
    expect(advanceEnchantedPhase(0.35, 0.1, 1, scale)).toBeCloseTo(0.05);
    // The wrap shifts the pattern by exactly one whole tile, so the
    // scroll stays seamless.
    const before = 0.3;
    const after = advanceEnchantedPhase(before, 0.15, 1, scale);
    const difference = 0.15 * scale - (after - before) * scale;
    expect(Math.abs(difference - Math.round(difference))).toBeCloseTo(0);
    // The phase always stays within one tile period.
    const value = advanceEnchantedPhase(0.5, 1, 9, 8);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1 / 8 + 1e-9);
  });
});

describe("createEnchantedMaterial", () => {
  const mask = new Texture();
  const pattern = new Texture();

  it("wires the uniforms including the initial phase", () => {
    const material = createEnchantedMaterial(mask, pattern, 8, 0.5, 0.25);
    expect(material.uniforms.uMask.value).toBe(mask);
    expect(material.uniforms.uEnchanted.value).toBe(pattern);
    expect(material.uniforms.uScale.value).toBe(8);
    expect(material.uniforms.uOpacity.value).toBe(0.5);
    const offset = material.uniforms.uOffset.value as { x: number; y: number };
    expect(offset.x).toBe(0.25);
    expect(offset.y).toBe(0.25);
  });

  it("updates the offset in place via setEnchantedPhase", () => {
    const material = createEnchantedMaterial(mask, pattern, 8, 1, 0);
    const offset = material.uniforms.uOffset.value as { x: number; y: number };
    setEnchantedPhase(material, 0.75);
    expect(material.uniforms.uOffset.value).toBe(offset);
    expect(offset.x).toBe(0.75);
    expect(offset.y).toBe(0.75);
  });

  it("uses the additive overlay material flags", () => {
    const material = createEnchantedMaterial(mask, pattern, 8, 1, 0);
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.side).toBe(DoubleSide);
    expect(material.blending).toBe(AdditiveBlending);
    expect(material.polygonOffset).toBe(true);
    expect(material.polygonOffsetFactor).toBe(-1);
    expect(material.polygonOffsetUnits).toBe(-1);
  });
});

describe("updateEnchantedTexture", () => {
  const canvasA = {} as HTMLCanvasElement;
  const canvasB = {} as HTMLCanvasElement;

  it("swaps the source canvas and re-uploads once", () => {
    const texture = createEnchantedTexture(canvasA, true);
    const version = texture.version;
    updateEnchantedTexture(texture, canvasB, true);
    expect(texture.image).toBe(canvasB);
    expect(texture.version).toBe(version + 1);
  });

  it("leaves an unchanged texture untouched", () => {
    const texture = createEnchantedTexture(canvasA, true);
    const version = texture.version;
    updateEnchantedTexture(texture, canvasA, true);
    expect(texture.version).toBe(version);
  });

  it("refreshes the filter pair with the smooth flag", () => {
    const texture = createEnchantedTexture(canvasA, true);
    expect(texture.magFilter).toBe(LinearFilter);
    const version = texture.version;
    updateEnchantedTexture(texture, canvasA, false);
    expect(texture.magFilter).toBe(NearestFilter);
    expect(texture.minFilter).toBe(NearestFilter);
    expect(texture.version).toBe(version + 1);
  });
});

describe("setEnchantedTuning", () => {
  const mask = new Texture();
  const pattern = new Texture();

  it("updates scale and opacity in place", () => {
    const material = createEnchantedMaterial(mask, pattern, 1, 1, 0.5);
    setEnchantedTuning(material, 2, 0.25);
    expect(material.uniforms.uScale.value).toBe(2);
    expect(material.uniforms.uOpacity.value).toBe(0.25);
    const offset = material.uniforms.uOffset.value as { x: number; y: number };
    expect(offset.x).toBe(0.5);
  });
});
