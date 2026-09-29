/**
 * Transparency specs: the per-part alpha scan over the layer-1 box
 * unwrap and the material swap manager (real three objects on the
 * shared fake skin, no DOM).
 */

import { createImage } from "etf-skin-decoder";
import { DoubleSide, FrontSide, MeshStandardMaterial, Texture } from "three";
import { describe, expect, it, vi } from "vitest";
import {
  createTranslucentSides,
  translucentParts,
} from "../../src/render/features/transparency";
import { createFakeSkin } from "../fixtures/fake-skin";

/**
 * Builds an all-opaque skin image.
 *
 * @returns The opaque 64x64 image.
 */
function makeOpaqueImage(): {
  data: Uint8ClampedArray;
  width: number;
  height: number;
} {
  const image = createImage(64, 64);
  image.data.fill(255);
  return image;
}

describe("translucentParts", () => {
  it("reports nothing for an opaque skin", () => {
    expect(translucentParts(makeOpaqueImage(), "default").size).toBe(0);
  });

  it("ignores transparent filler pixels beside the box faces", () => {
    const image = makeOpaqueImage();
    // Head filler corner and arm filler column (unused by the meshes).
    image.data[(0 * 64 + 0) * 4 + 3] = 0;
    image.data[(7 * 64 + 31) * 4 + 3] = 0;
    image.data[(16 * 64 + 40) * 4 + 3] = 0;
    expect(translucentParts(image, "default").size).toBe(0);
  });

  it("detects a translucent pixel in a used face", () => {
    const image = makeOpaqueImage();
    image.data[(20 * 64 + 20) * 4 + 3] = 100;
    expect([...translucentParts(image, "default")]).toEqual(["body"]);
  });

  it("counts fully transparent pixels", () => {
    const image = makeOpaqueImage();
    image.data[(25 * 64 + 20) * 4 + 3] = 0;
    expect([...translucentParts(image, "default")]).toEqual(["body"]);
  });

  it("follows the model type at the slim arm edge", () => {
    const image = makeOpaqueImage();
    image.data[(20 * 64 + 54) * 4 + 3] = 0;
    expect([...translucentParts(image, "default")]).toEqual(["rightArm"]);
    expect(translucentParts(image, "slim").size).toBe(0);
  });
});

describe("createTranslucentSides", () => {
  it("swaps only the marked parts", () => {
    const { skin, inner } = createFakeSkin();
    const image = makeOpaqueImage();
    image.data[(20 * 64 + 20) * 4 + 3] = 100;
    const originalBody = inner.body.material as MeshStandardMaterial;
    const originalHead = inner.head.material as MeshStandardMaterial;
    const originalArm = inner.rightArm.material as MeshStandardMaterial;
    const sides = createTranslucentSides();

    sides.sync(skin, image, "default", true);

    const bodyMaterial = inner.body.material as MeshStandardMaterial;
    expect(bodyMaterial).not.toBe(originalBody);
    expect(bodyMaterial.transparent).toBe(true);
    expect(bodyMaterial.side).toBe(DoubleSide);
    expect(inner.head.material).toBe(originalHead);
    expect(originalHead.side).toBe(FrontSide);
    expect(inner.rightArm.material).toBe(originalArm);
    sides.dispose();
  });

  it("restores on demand and reuses the clone cache", () => {
    const { skin, inner } = createFakeSkin();
    const image = makeOpaqueImage();
    image.data[(20 * 64 + 20) * 4 + 3] = 100;
    const originalBody = inner.body.material as MeshStandardMaterial;
    const sides = createTranslucentSides();

    sides.sync(skin, image, "default", true);
    const clone = inner.body.material as MeshStandardMaterial;
    sides.sync(skin, image, "default", true);
    expect(inner.body.material).toBe(clone);

    sides.restore();
    expect(inner.body.material).toBe(originalBody);
    sides.sync(skin, image, "default", true);
    expect(inner.body.material).toBe(clone);
    sides.dispose();
  });

  it("releases the swaps when inactive", () => {
    const { skin, inner } = createFakeSkin();
    const image = makeOpaqueImage();
    image.data[(20 * 64 + 20) * 4 + 3] = 100;
    const originalBody = inner.body.material as MeshStandardMaterial;
    const sides = createTranslucentSides();

    sides.sync(skin, image, "default", true);
    sides.sync(skin, image, "default", false);
    expect(inner.body.material).toBe(originalBody);
    sides.dispose();
  });

  it("re-syncs the clone map from the host material", () => {
    const { skin, inner } = createFakeSkin();
    const image = makeOpaqueImage();
    image.data[(20 * 64 + 20) * 4 + 3] = 100;
    const originalBody = inner.body.material as MeshStandardMaterial;
    const sides = createTranslucentSides();

    sides.sync(skin, image, "default", true);
    const clone = inner.body.material as MeshStandardMaterial;
    const texture = new Texture();
    originalBody.map = texture;
    sides.sync(skin, image, "default", true);
    expect(clone.map).toBe(texture);
    sides.dispose();
  });

  it("never clobbers a material it did not place", () => {
    const { skin, inner } = createFakeSkin();
    const image = makeOpaqueImage();
    image.data[(20 * 64 + 20) * 4 + 3] = 100;
    const sides = createTranslucentSides();

    sides.sync(skin, image, "default", true);
    const replacement = new MeshStandardMaterial();
    inner.body.material = replacement;
    sides.restore();
    expect(inner.body.material).toBe(replacement);
    sides.dispose();
  });

  it("disposes the clones and rebuilds them afterwards", () => {
    const { skin, inner } = createFakeSkin();
    const image = makeOpaqueImage();
    image.data[(20 * 64 + 20) * 4 + 3] = 100;
    const sides = createTranslucentSides();

    sides.sync(skin, image, "default", true);
    const clone = inner.body.material as MeshStandardMaterial;
    const spy = vi.spyOn(clone, "dispose");
    sides.dispose();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(inner.body.material).not.toBe(clone);

    sides.sync(skin, image, "default", true);
    const rebuilt = inner.body.material as MeshStandardMaterial;
    expect(rebuilt).not.toBe(clone);
    expect(rebuilt.transparent).toBe(true);
    sides.dispose();
  });
});
