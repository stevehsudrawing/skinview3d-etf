/**
 * Nose geometry facts: the `2x4x2` box's skin-space UVs against the
 * vanilla `(24,0)-(32,6)` unwrap, the two mesh anchors and the
 * disposer (pure parts - no viewer required).
 */

import {
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
  it("builds the 2x4x2 box with 24 skin-space UVs", () => {
    const geometry = buildNoseGeometry();
    expect(geometry.parameters.width).toBe(2);
    expect(geometry.parameters.height).toBe(4);
    expect(geometry.parameters.depth).toBe(2);
    const uv = geometry.attributes.uv;
    expect(uv.count).toBe(24);
    // The +x face (vertices 0-3) samples (28,2)-(30,6); its corner
    // order reads (x1,y2), (x2,y2), (x1,y1), (x2,y1) - the host's
    // box unwrap mapped into skin space (v grows down).
    expect(uv.getX(0)).toBeCloseTo(28 / 64);
    expect(uv.getY(0)).toBeCloseTo(6 / 64);
    expect(uv.getX(1)).toBeCloseTo(30 / 64);
    expect(uv.getY(2)).toBeCloseTo(2 / 64);
    expect(uv.getX(3)).toBeCloseTo(30 / 64);
    expect(uv.getY(3)).toBeCloseTo(2 / 64);
    // The +y top face (vertices 8-11) samples (26,0)-(28,2).
    expect(uv.getX(8)).toBeCloseTo(26 / 64);
    expect(uv.getY(8)).toBeCloseTo(2 / 64);
    expect(uv.getY(11)).toBeCloseTo(0);
    // The -y bottom face (vertices 12-15) samples (28,0)-(30,2).
    expect(uv.getX(12)).toBeCloseTo(28 / 64);
    expect(uv.getY(12)).toBeCloseTo(2 / 64);
    expect(uv.getX(15)).toBeCloseTo(30 / 64);
    expect(uv.getY(15)).toBeCloseTo(0);
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

  it("disposes the geometry, material and texture", () => {
    const mesh = createVillagerNoseMesh(
      new MeshStandardMaterial(),
      new Texture(),
    );
    let materialDisposed = false;
    let textureDisposed = false;
    mesh.material.addEventListener("dispose", () => {
      materialDisposed = true;
    });
    (mesh.material.map as Texture).addEventListener("dispose", () => {
      textureDisposed = true;
    });
    disposeNose(mesh);
    expect(materialDisposed).toBe(true);
    expect(textureDisposed).toBe(true);
  });
});
