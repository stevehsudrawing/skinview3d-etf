/**
 * Emissive pure parts: the shared overlay material's flags against
 * the core conventions (no viewer required).
 */

import { DoubleSide, Texture } from "three";
import { describe, expect, it } from "vitest";
import { OVERLAY_OFFSET } from "../../src/render/core/overlays";
import { createEmissiveMaterial } from "../../src/render/features/emissive";

describe("createEmissiveMaterial", () => {
  it("uses the fullbright overlay flags and the shared offset", () => {
    const map = new Texture();
    const material = createEmissiveMaterial(map);
    expect(material.map).toBe(map);
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.alphaTest).toBe(1e-5);
    expect(material.side).toBe(DoubleSide);
    expect(material.polygonOffset).toBe(OVERLAY_OFFSET.polygonOffset);
    expect(material.polygonOffsetFactor).toBe(
      OVERLAY_OFFSET.polygonOffsetFactor,
    );
    expect(material.polygonOffsetUnits).toBe(OVERLAY_OFFSET.polygonOffsetUnits);
  });
});
