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
      "rightArm",
      "leftArm",
      "rightLeg",
      "leftLeg",
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
  it("pins the six box regions of the default model", () => {
    const expected = {
      head: [
        { topLeft: { x: 8, y: 0 }, bottomRight: { x: 23, y: 7 } },
        { topLeft: { x: 0, y: 8 }, bottomRight: { x: 31, y: 15 } },
      ],
      body: [
        { topLeft: { x: 20, y: 16 }, bottomRight: { x: 35, y: 19 } },
        { topLeft: { x: 16, y: 20 }, bottomRight: { x: 39, y: 31 } },
      ],
      rightArm: [
        { topLeft: { x: 44, y: 16 }, bottomRight: { x: 51, y: 19 } },
        { topLeft: { x: 40, y: 20 }, bottomRight: { x: 55, y: 31 } },
      ],
      leftArm: [
        { topLeft: { x: 36, y: 48 }, bottomRight: { x: 43, y: 51 } },
        { topLeft: { x: 32, y: 52 }, bottomRight: { x: 47, y: 63 } },
      ],
      rightLeg: [
        { topLeft: { x: 4, y: 16 }, bottomRight: { x: 11, y: 19 } },
        { topLeft: { x: 0, y: 20 }, bottomRight: { x: 15, y: 31 } },
      ],
      leftLeg: [
        { topLeft: { x: 20, y: 48 }, bottomRight: { x: 27, y: 51 } },
        { topLeft: { x: 16, y: 52 }, bottomRight: { x: 31, y: 63 } },
      ],
    };
    for (const id of BODY_PART_IDS) {
      expect(layer1Rects(id, "default")).toEqual(expected[id]);
    }
  });

  it("narrows both slim arms by one pixel per side", () => {
    expect(layer1Rects("rightArm", "slim")).toEqual([
      { topLeft: { x: 44, y: 16 }, bottomRight: { x: 49, y: 19 } },
      { topLeft: { x: 40, y: 20 }, bottomRight: { x: 53, y: 31 } },
    ]);
    expect(layer1Rects("leftArm", "slim")).toEqual([
      { topLeft: { x: 36, y: 48 }, bottomRight: { x: 41, y: 51 } },
      { topLeft: { x: 32, y: 52 }, bottomRight: { x: 45, y: 63 } },
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
