/**
 * Enchanted feature specs: the scrolling offset math and the shared
 * material wiring.
 */

import {
  AdditiveBlending,
  DoubleSide,
  LinearFilter,
  NearestFilter,
  RepeatWrapping,
  Texture,
} from "three";
import { describe, expect, it } from "vitest";
import {
  advanceEnchantedOffset,
  createEnchantedMaterial,
  createEnchantedTexture,
  setEnchantedOffset,
  setEnchantedTuning,
  updateEnchantedTexture,
} from "../../src/render/features/enchanted";

describe("advanceEnchantedOffset", () => {
  it("advances both axes by speed x direction x dt", () => {
    const offset = advanceEnchantedOffset({ x: 0, y: 0 }, 0.2, [1, 1], 1, 1);
    expect(offset.x).toBeCloseTo(0.2);
    expect(offset.y).toBeCloseTo(0.2);
  });

  it("advances each axis independently", () => {
    const offset = advanceEnchantedOffset(
      { x: 0.25, y: 0 },
      0.1,
      [2, -1],
      1,
      1,
    );
    expect(offset.x).toBeCloseTo(0.45);
    expect(offset.y).toBeCloseTo(0.9);
  });

  it("wraps each axis into the tile period", () => {
    const offset = advanceEnchantedOffset(
      { x: 0.9, y: 0.5 },
      0.2,
      [1, 1],
      1,
      1,
    );
    expect(offset.x).toBeCloseTo(0.1);
    expect(offset.y).toBeCloseTo(0.7);
    const wrapped = advanceEnchantedOffset({ x: 0.5, y: 0.5 }, 2, [1, 1], 5, 1);
    expect(wrapped.x).toBeCloseTo(0.5);
    expect(wrapped.y).toBeCloseTo(0.5);
  });

  it("keeps the offset on dt = 0", () => {
    const offset = advanceEnchantedOffset(
      { x: 0.42, y: 0.17 },
      0.2,
      [1, 1],
      0,
      1,
    );
    expect(offset.x).toBe(0.42);
    expect(offset.y).toBe(0.17);
  });

  it("reverses an axis with a negative component", () => {
    const offset = advanceEnchantedOffset(
      { x: 0.1, y: 0.1 },
      0.2,
      [-1, 1],
      1,
      1,
    );
    expect(offset.x).toBeCloseTo(0.9);
    expect(offset.y).toBeCloseTo(0.3);
  });

  it("keeps the offset frozen for a zero direction", () => {
    const offset = advanceEnchantedOffset(
      { x: 0.33, y: 0.66 },
      1,
      [0, 0],
      10,
      1,
    );
    expect(offset).toEqual({ x: 0.33, y: 0.66 });
  });

  it("wraps at the tile period for non-integer scales", () => {
    const scale = 2.5;
    // 0.4 is the tile period at this scale: both axes wrap.
    const before = { x: 0.37, y: 0.39 };
    const after = advanceEnchantedOffset(before, 0.15, [0.5, 0.25], 1, scale);
    expect(after.x).toBeCloseTo(0.045);
    expect(after.y).toBeCloseTo(0.0275);
    // The wrap shifts each axis by exactly one whole tile, so the
    // scroll stays seamless at any direction.
    const shiftX = 0.15 * 0.5 * scale - (after.x - before.x) * scale;
    const shiftY = 0.15 * 0.25 * scale - (after.y - before.y) * scale;
    expect(Math.abs(shiftX - Math.round(shiftX))).toBeCloseTo(0);
    expect(Math.abs(shiftY - Math.round(shiftY))).toBeCloseTo(0);
    // The offset always stays within one tile period.
    const value = advanceEnchantedOffset(
      { x: 0.5, y: 0.5 },
      1,
      [0.5, 0.25],
      9,
      8,
    );
    expect(value.x).toBeGreaterThanOrEqual(0);
    expect(value.x).toBeLessThan(1 / 8 + 1e-9);
    expect(value.y).toBeGreaterThanOrEqual(0);
    expect(value.y).toBeLessThan(1 / 8 + 1e-9);
  });
});

describe("createEnchantedMaterial", () => {
  const mask = new Texture();
  const pattern = new Texture();

  it("wires the uniforms including the initial offset", () => {
    const material = createEnchantedMaterial(mask, pattern, 8, 0.5, {
      x: 0.25,
      y: 0.75,
    });
    expect(material.uniforms.uMask.value).toBe(mask);
    expect(material.uniforms.uEnchanted.value).toBe(pattern);
    expect(material.uniforms.uScale.value).toBe(8);
    expect(material.uniforms.uOpacity.value).toBe(0.5);
    const offset = material.uniforms.uOffset.value as {
      x: number;
      y: number;
    };
    expect(offset.x).toBe(0.25);
    expect(offset.y).toBe(0.75);
    const shift = material.uniforms.uUvShift.value as {
      x: number;
      y: number;
    };
    expect(shift.x).toBe(0);
    expect(shift.y).toBe(0);
  });

  it("wires an explicit sampling shift", () => {
    const material = createEnchantedMaterial(
      mask,
      pattern,
      1,
      1,
      { x: 0, y: 0 },
      [0, -12 / 64],
    );
    const shift = material.uniforms.uUvShift.value as {
      x: number;
      y: number;
    };
    expect(shift.x).toBe(0);
    expect(shift.y).toBeCloseTo(-12 / 64);
  });

  it("updates the offset in place via setEnchantedOffset", () => {
    const material = createEnchantedMaterial(mask, pattern, 8, 1, {
      x: 0,
      y: 0,
    });
    const offset = material.uniforms.uOffset.value as {
      x: number;
      y: number;
    };
    setEnchantedOffset(material, { x: 0.75, y: 0.5 });
    expect(material.uniforms.uOffset.value).toBe(offset);
    expect(offset.x).toBe(0.75);
    expect(offset.y).toBe(0.5);
  });

  it("uses the additive overlay material flags", () => {
    const material = createEnchantedMaterial(mask, pattern, 8, 1, {
      x: 0,
      y: 0,
    });
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.side).toBe(DoubleSide);
    expect(material.blending).toBe(AdditiveBlending);
    expect(material.polygonOffset).toBe(true);
    expect(material.polygonOffsetFactor).toBe(-1);
    expect(material.polygonOffsetUnits).toBe(-1);
  });
});

describe("createEnchantedTexture", () => {
  it("wraps the pattern and leaves mipmaps off", () => {
    const texture = createEnchantedTexture({} as HTMLCanvasElement, true);
    expect(texture.wrapS).toBe(RepeatWrapping);
    expect(texture.wrapT).toBe(RepeatWrapping);
    expect(texture.generateMipmaps).toBe(false);
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
    const material = createEnchantedMaterial(mask, pattern, 1, 1, {
      x: 0.5,
      y: 0.25,
    });
    setEnchantedTuning(material, 2, 0.25);
    expect(material.uniforms.uScale.value).toBe(2);
    expect(material.uniforms.uOpacity.value).toBe(0.25);
    const offset = material.uniforms.uOffset.value as {
      x: number;
      y: number;
    };
    expect(offset.x).toBe(0.5);
    expect(offset.y).toBe(0.25);
  });
});
