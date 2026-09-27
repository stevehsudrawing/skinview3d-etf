/**
 * Part vocabulary specs: the six-part order, the layer lists, the
 * layer-1 rectangles, the bound-texture dedupe and the material
 * getters (real three objects on the shared fake skin, no viewer).
 */

import { MeshStandardMaterial, Texture } from "three";
import { describe, expect, it } from "vitest";
import {
  BODY_PART_IDS,
  bodyOuterMaterial,
  headLayerMaterial,
  layer1Rects,
  layerMapsOf,
  layersOf,
  partsOf,
} from "../../src/render/core/parts";
import { createFakeSkin } from "../fixtures/fake-skin";

describe("BODY_PART_IDS", () => {
  it("keeps the six-part vocabulary order", () => {
    expect(BODY_PART_IDS).toEqual([
      "head",
      "body",
      "leftArm",
      "rightArm",
      "leftLeg",
      "rightLeg",
    ]);
  });
});

describe("partsOf", () => {
  it("resolves the six parts in the vocabulary order", () => {
    const { skin, inner, outer } = createFakeSkin();
    const parts = partsOf(skin);
    expect(parts).toHaveLength(BODY_PART_IDS.length);
    for (const [index, id] of BODY_PART_IDS.entries()) {
      expect(parts[index].inner).toBe(inner[id]);
      expect(parts[index].outer).toBe(outer[id]);
    }
  });
});

describe("layersOf", () => {
  it("lists the inner layer before the outer layer", () => {
    const { skin, inner, outer } = createFakeSkin();
    const [head] = partsOf(skin);
    expect(layersOf(head)).toEqual([inner.head, outer.head]);
  });
});

describe("layer1Rects", () => {
  it("pins the head and arm regions", () => {
    expect(layer1Rects("head", "default")).toEqual([
      { topLeft: { x: 8, y: 0 }, bottomRight: { x: 23, y: 7 } },
      { topLeft: { x: 0, y: 8 }, bottomRight: { x: 31, y: 15 } },
    ]);
    expect(layer1Rects("rightArm", "default")).toEqual([
      { topLeft: { x: 44, y: 16 }, bottomRight: { x: 51, y: 19 } },
      { topLeft: { x: 40, y: 20 }, bottomRight: { x: 55, y: 31 } },
    ]);
    expect(layer1Rects("rightArm", "slim")).toEqual([
      { topLeft: { x: 44, y: 16 }, bottomRight: { x: 49, y: 19 } },
      { topLeft: { x: 40, y: 20 }, bottomRight: { x: 53, y: 31 } },
    ]);
  });
});

describe("layerMapsOf", () => {
  it("collects the distinct bound textures", () => {
    const { skin, inner, outer } = createFakeSkin();
    expect(layerMapsOf(skin)).toEqual([]);
    const shared = new Texture();
    (inner.head.material as MeshStandardMaterial).map = shared;
    (outer.body.material as MeshStandardMaterial).map = shared;
    const distinct = new Texture();
    (inner.leftLeg.material as MeshStandardMaterial).map = distinct;
    expect(layerMapsOf(skin)).toEqual([shared, distinct]);
  });
});

describe("material getters", () => {
  it("reads the first material of an array slot", () => {
    const { skin, inner } = createFakeSkin();
    const first = new MeshStandardMaterial();
    const second = new MeshStandardMaterial();
    inner.head.material = [first, second];
    expect(headLayerMaterial(skin)).toBe(first);
  });

  it("passes a single material through", () => {
    const { skin, outer } = createFakeSkin();
    const material = outer.body.material;
    expect(bodyOuterMaterial(skin)).toBe(material);
  });
});
