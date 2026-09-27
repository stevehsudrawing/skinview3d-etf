/**
 * Overlay builder specs: one child mesh per part layer sharing its
 * source geometry, the name / render order and the detach-only
 * disposal (real three objects on the shared fake skin, no viewer).
 */

import { MeshBasicMaterial } from "three";
import { describe, expect, it } from "vitest";
import {
  createPartOverlays,
  disposeOverlays,
} from "../../src/render/core/overlays";
import { layersOf, partsOf } from "../../src/render/core/parts";
import { createFakeSkin } from "../fixtures/fake-skin";

describe("createPartOverlays", () => {
  it("adds one overlay per part layer, sharing its geometry", () => {
    const { skin } = createFakeSkin();
    const material = new MeshBasicMaterial();
    const overlays = createPartOverlays(skin, material, "etf-test");
    const parents = partsOf(skin).flatMap((part) => layersOf(part));
    expect(overlays).toHaveLength(parents.length);
    overlays.forEach((overlay, index) => {
      expect(overlay.parent).toBe(parents[index]);
      expect(overlay.geometry).toBe(parents[index].geometry);
      expect(overlay.material).toBe(material);
      expect(overlay.name).toBe("etf-test");
      expect(overlay.renderOrder).toBe(0);
    });
  });

  it("applies the requested draw order", () => {
    const { skin } = createFakeSkin();
    const overlays = createPartOverlays(
      skin,
      new MeshBasicMaterial(),
      "etf-enchanted",
      1,
    );
    expect(overlays.every((overlay) => overlay.renderOrder === 1)).toBe(true);
  });
});

describe("disposeOverlays", () => {
  it("detaches the meshes without touching the shared resources", () => {
    const { skin } = createFakeSkin();
    const material = new MeshBasicMaterial();
    const geometry = partsOf(skin)[0].inner.geometry;
    let disposed = 0;
    material.addEventListener("dispose", () => {
      disposed++;
    });
    geometry.addEventListener("dispose", () => {
      disposed++;
    });
    const overlays = createPartOverlays(skin, material, "etf-test");
    disposeOverlays(overlays);
    expect(overlays.every((overlay) => overlay.parent === null)).toBe(true);
    expect(disposed).toBe(0);
  });
});
