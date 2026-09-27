/**
 * Jacket shell facts: the size table, the six skin-space face rects
 * and the UV rewrite (pure parts - no viewer required).
 */

import { BoxGeometry, MeshBasicMaterial } from "three";
import { describe, expect, it } from "vitest";
import {
  JACKET_SIZES,
  createJacketGeometry,
  createJacketMesh,
  jacketFaceRects,
} from "../../src/render/features/jacket";

describe("JACKET_SIZES", () => {
  it("pins the thin and wide shell dimensions", () => {
    expect(JACKET_SIZES.thin).toEqual({
      width: 8.5,
      height: 12.5,
      depth: 4.5,
    });
    expect(JACKET_SIZES.wide).toEqual({
      width: 9.5,
      height: 13.5,
      depth: 5.5,
    });
  });
});

describe("jacketFaceRects", () => {
  it("pins the six face regions in three.js face order", () => {
    expect(jacketFaceRects()).toEqual([
      { topLeft: { x: 28, y: 36 }, bottomRight: { x: 31, y: 47 } },
      { topLeft: { x: 16, y: 36 }, bottomRight: { x: 19, y: 47 } },
      { topLeft: { x: 20, y: 32 }, bottomRight: { x: 27, y: 35 } },
      { topLeft: { x: 28, y: 32 }, bottomRight: { x: 35, y: 35 } },
      { topLeft: { x: 20, y: 36 }, bottomRight: { x: 27, y: 47 } },
      { topLeft: { x: 32, y: 36 }, bottomRight: { x: 39, y: 47 } },
    ]);
  });
});

describe("createJacketGeometry", () => {
  it("builds the shell with skin-space UVs at the decoded width", () => {
    const thin = createJacketGeometry(false);
    expect(thin.parameters.width).toBe(8.5);
    expect(thin.parameters.height).toBe(12.5);
    expect(thin.parameters.depth).toBe(4.5);
    expect(thin.attributes.uv.count).toBe(24);
    // The +x face starts on its region's top-left corner (28, 36),
    // the +y face on (20, 32) - both in skin space (v grows down).
    expect(thin.attributes.uv.getX(0)).toBeCloseTo(28 / 64);
    expect(thin.attributes.uv.getY(0)).toBeCloseTo(36 / 64);
    expect(thin.attributes.uv.getX(8)).toBeCloseTo(20 / 64);
    expect(thin.attributes.uv.getY(8)).toBeCloseTo(32 / 64);
    const wide = createJacketGeometry(true);
    expect(wide.parameters.width).toBe(9.5);
    expect(wide.parameters.height).toBe(13.5);
    expect(wide.parameters.depth).toBe(5.5);
  });
});

describe("createJacketMesh", () => {
  it("anchors the shell at the body's bottom", () => {
    const mesh = createJacketMesh(
      new BoxGeometry(1, 1, 1),
      new MeshBasicMaterial(),
    );
    expect(mesh.name).toBe("etf-jacket");
    expect(mesh.position.toArray()).toEqual([0, -12.5, 0]);
  });
});
