/**
 * Nose geometry facts: the `2x4x2` box's skin-space UVs against the
 * vanilla `(24,0)-(32,6)` unwrap, the two mesh anchors and the
 * disposer (pure parts - no viewer required).
 */

import {
  Group,
  MeshStandardMaterial,
  Texture,
  type BoxGeometry,
  type PlaneGeometry,
} from "three";
import { describe, expect, it } from "vitest";
import {
  buildNoseGeometry,
  createTexturedNoseMesh,
  createVillagerNoseMesh,
  disposeNose,
} from "../../src/render/features/nose";

describe("buildNoseGeometry", () => {
  it("builds the 2x4x2 box with the host's box-unwrap skin-space UVs", () => {
    const geometry = buildNoseGeometry();
    expect(geometry.parameters.width).toBe(2);
    expect(geometry.parameters.height).toBe(4);
    expect(geometry.parameters.depth).toBe(2);
    const uv = geometry.attributes.uv;
    expect(uv.count).toBe(24);
    // Every face samples its region of the (24,0)-(32,6) unwrap in
    // skin space (v grows down, `flipY = false`): the top-left vertex
    // maps to the region's (x1, y1) on every face except the host's
    // rotated bottom (`-y`) face, which reads (x1, y2) first.
    const expected = [
      // +x side (28,2)-(30,6)
      [28, 2],
      [30, 2],
      [28, 6],
      [30, 6],
      // -x side (24,2)-(26,6)
      [24, 2],
      [26, 2],
      [24, 6],
      [26, 6],
      // +y top (26,0)-(28,2)
      [26, 0],
      [28, 0],
      [26, 2],
      [28, 2],
      // -y bottom (28,0)-(30,2), the rotated host layout
      [28, 2],
      [30, 2],
      [28, 0],
      [30, 0],
      // +z front (26,2)-(28,6)
      [26, 2],
      [28, 2],
      [26, 6],
      [28, 6],
      // -z back (30,2)-(32,6)
      [30, 2],
      [32, 2],
      [30, 6],
      [32, 6],
    ];
    expected.forEach(([x, y], index) => {
      expect(uv.getX(index)).toBeCloseTo(x / 64);
      expect(uv.getY(index)).toBeCloseTo(y / 64);
    });
  });
});

describe("nose meshes", () => {
  it("anchors the villager box and clones the host material", () => {
    const source = new MeshStandardMaterial();
    const texture = new Texture();
    const mesh = createVillagerNoseMesh(source, texture);
    expect((mesh.geometry as BoxGeometry).parameters.width).toBe(2);
    expect(mesh.position.toArray()).toEqual([0, -2, 5]);
    expect(mesh.material).not.toBe(source);
    expect(mesh.material.map).toBe(texture);
  });

  it("anchors the 2x4 textured plate", () => {
    const source = new MeshStandardMaterial();
    const texture = new Texture();
    const mesh = createTexturedNoseMesh(source, texture);
    const geometry = mesh.geometry as PlaneGeometry;
    expect(geometry.parameters.width).toBe(2);
    expect(geometry.parameters.height).toBe(4);
    expect(mesh.position.toArray()).toEqual([0, -2, 4.5]);
    expect(mesh.material.map).toBe(texture);
  });

  it("disposes the geometry, material and texture, then detaches", () => {
    const mesh = createVillagerNoseMesh(
      new MeshStandardMaterial(),
      new Texture(),
    );
    const parent = new Group();
    parent.add(mesh);
    let geometryDisposed = false;
    let materialDisposed = false;
    let textureDisposed = false;
    mesh.geometry.addEventListener("dispose", () => {
      geometryDisposed = true;
    });
    mesh.material.addEventListener("dispose", () => {
      materialDisposed = true;
    });
    (mesh.material.map as Texture).addEventListener("dispose", () => {
      textureDisposed = true;
    });
    disposeNose(mesh);
    expect(geometryDisposed).toBe(true);
    expect(materialDisposed).toBe(true);
    expect(textureDisposed).toBe(true);
    expect(mesh.parent).toBeNull();
  });
});
