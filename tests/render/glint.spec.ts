/**
 * Glint feature specs: the scrolling phase math and the shared
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
  advanceGlintPhase,
  createGlintMaterial,
  createGlintTexture,
  setGlintPhase,
  setGlintTuning,
  updateGlintTexture,
} from "../../src/render/features/glint";

describe("advanceGlintPhase", () => {
  it("advances the phase by speed x dt", () => {
    expect(advanceGlintPhase(0, 0.2, 1, 1)).toBeCloseTo(0.2);
    expect(advanceGlintPhase(0.5, 0.2, 2, 1)).toBeCloseTo(0.9);
  });

  it("wraps the phase into the tile period", () => {
    expect(advanceGlintPhase(0.9, 0.2, 1, 1)).toBeCloseTo(0.1);
    expect(advanceGlintPhase(0.25, 0.5, 3, 1)).toBeCloseTo(0.75);
    expect(advanceGlintPhase(0.5, 2, 5, 1)).toBeCloseTo(0.5);
  });

  it("keeps the phase on dt = 0", () => {
    expect(advanceGlintPhase(0.42, 0.2, 0, 1)).toBe(0.42);
  });

  it("reverses with a negative speed", () => {
    expect(advanceGlintPhase(0.1, -0.2, 1, 1)).toBeCloseTo(0.9);
    expect(advanceGlintPhase(0, -1, 0.25, 1)).toBeCloseTo(0.75);
  });

  it("wraps at the tile period for non-integer scales", () => {
    const scale = 2.5;
    // 0.35 advances past the 0.4 tile period and lands at 0.05.
    expect(advanceGlintPhase(0.35, 0.1, 1, scale)).toBeCloseTo(0.05);
    // The wrap shifts the pattern by exactly one whole tile, so the
    // scroll stays seamless.
    const before = 0.3;
    const after = advanceGlintPhase(before, 0.15, 1, scale);
    const difference = 0.15 * scale - (after - before) * scale;
    expect(Math.abs(difference - Math.round(difference))).toBeCloseTo(0);
    // The phase always stays within one tile period.
    const value = advanceGlintPhase(0.5, 1, 9, 8);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1 / 8 + 1e-9);
  });
});

describe("createGlintMaterial", () => {
  const mask = new Texture();
  const glint = new Texture();

  it("wires the uniforms including the initial phase", () => {
    const material = createGlintMaterial(mask, glint, 8, 0.5, 0.25);
    expect(material.uniforms.uMask.value).toBe(mask);
    expect(material.uniforms.uGlint.value).toBe(glint);
    expect(material.uniforms.uScale.value).toBe(8);
    expect(material.uniforms.uOpacity.value).toBe(0.5);
    const offset = material.uniforms.uOffset.value as { x: number; y: number };
    expect(offset.x).toBe(0.25);
    expect(offset.y).toBe(0.25);
  });

  it("updates the offset in place via setGlintPhase", () => {
    const material = createGlintMaterial(mask, glint, 8, 1, 0);
    const offset = material.uniforms.uOffset.value as { x: number; y: number };
    setGlintPhase(material, 0.75);
    expect(material.uniforms.uOffset.value).toBe(offset);
    expect(offset.x).toBe(0.75);
    expect(offset.y).toBe(0.75);
  });

  it("uses the additive overlay material flags", () => {
    const material = createGlintMaterial(mask, glint, 8, 1, 0);
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.side).toBe(DoubleSide);
    expect(material.blending).toBe(AdditiveBlending);
    expect(material.polygonOffset).toBe(true);
    expect(material.polygonOffsetFactor).toBe(-1);
    expect(material.polygonOffsetUnits).toBe(-1);
  });
});

describe("updateGlintTexture", () => {
  const canvasA = {} as HTMLCanvasElement;
  const canvasB = {} as HTMLCanvasElement;

  it("swaps the source canvas and re-uploads once", () => {
    const texture = createGlintTexture(canvasA, true);
    const version = texture.version;
    updateGlintTexture(texture, canvasB, true);
    expect(texture.image).toBe(canvasB);
    expect(texture.version).toBe(version + 1);
  });

  it("leaves an unchanged texture untouched", () => {
    const texture = createGlintTexture(canvasA, true);
    const version = texture.version;
    updateGlintTexture(texture, canvasA, true);
    expect(texture.version).toBe(version);
  });

  it("refreshes the filter pair with the smooth flag", () => {
    const texture = createGlintTexture(canvasA, true);
    expect(texture.magFilter).toBe(LinearFilter);
    const version = texture.version;
    updateGlintTexture(texture, canvasA, false);
    expect(texture.magFilter).toBe(NearestFilter);
    expect(texture.minFilter).toBe(NearestFilter);
    expect(texture.version).toBe(version + 1);
  });
});

describe("setGlintTuning", () => {
  const mask = new Texture();
  const glint = new Texture();

  it("updates scale and opacity in place", () => {
    const material = createGlintMaterial(mask, glint, 1, 1, 0.5);
    setGlintTuning(material, 2, 0.25);
    expect(material.uniforms.uScale.value).toBe(2);
    expect(material.uniforms.uOpacity.value).toBe(0.25);
    const offset = material.uniforms.uOffset.value as { x: number; y: number };
    expect(offset.x).toBe(0.5);
  });
});
