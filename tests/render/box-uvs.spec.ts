/**
 * Host box-unwrap specs: the shared writer is pinned against the
 * host's own `SkinObject` mesh UVs (the golden oracle), the two V
 * conventions and the bottom-face rotation; the guards reject
 * non-six-face lists and segmented boxes.
 */

import { SkinObject } from "skinview3d";
import { BoxGeometry, type Mesh } from "three";
import { describe, expect, it } from "vitest";
import {
  writeHostBoxUVs,
  type BoxFaceEdges,
} from "../../src/render/core/box-uvs";

/**
 * Computes the six faces of one `u, v, w, h, d` box layout, in
 * three.js face order (the formulas the host `setUVs` consumes).
 *
 * @param u - The region origin x.
 * @param v - The region origin y.
 * @param w - The box width.
 * @param h - The box height.
 * @param d - The box depth.
 * @returns The six faces as exclusive pixel edges.
 */
function layoutFaces(
  u: number,
  v: number,
  w: number,
  h: number,
  d: number,
): BoxFaceEdges[] {
  return [
    [u + w + d, v + d, u + w + 2 * d, v + d + h],
    [u, v + d, u + d, v + d + h],
    [u + d, v, u + w + d, v + d],
    [u + w + d, v, u + 2 * w + d, v + d],
    [u + d, v + d, u + w + d, v + d + h],
    [u + w + 2 * d, v + d, u + 2 * w + 2 * d, v + d + h],
  ];
}

describe("writeHostBoxUVs", () => {
  it("reproduces the host's own body box UVs", () => {
    const geometry = new BoxGeometry(8, 12, 4);
    writeHostBoxUVs(geometry, layoutFaces(16, 16, 8, 12, 4), true);
    const ours = geometry.attributes.uv;
    const host = (new SkinObject().body.innerLayer as Mesh).geometry.attributes
      .uv;
    expect(ours.count).toBe(host.count);
    for (let index = 0; index < ours.count; index++) {
      expect(ours.getX(index)).toBeCloseTo(host.getX(index), 10);
      expect(ours.getY(index)).toBeCloseTo(host.getY(index), 10);
    }
  });

  it("writes the skin-space V as the flipped V's mirror", () => {
    const flipped = new BoxGeometry(2, 4, 2);
    const skinSpace = new BoxGeometry(2, 4, 2);
    const faces = layoutFaces(24, 0, 2, 4, 2);
    writeHostBoxUVs(flipped, faces, true);
    writeHostBoxUVs(skinSpace, faces, false);
    const flippedUv = flipped.attributes.uv;
    const skinUv = skinSpace.attributes.uv;
    for (let index = 0; index < skinUv.count; index++) {
      expect(flippedUv.getX(index)).toBeCloseTo(skinUv.getX(index), 10);
      expect(flippedUv.getY(index)).toBeCloseTo(1 - skinUv.getY(index), 10);
    }
  });

  it("keeps the host's rotated bottom face", () => {
    const geometry = new BoxGeometry(2, 4, 2);
    writeHostBoxUVs(geometry, layoutFaces(24, 0, 2, 4, 2), false);
    const uv = geometry.attributes.uv;
    // The regular +x face reads its top-left corner first (y1 = 2);
    // the -y face (vertices 12-15) reads its bottom edge first
    // (y2 = 2) and its top edge (y1 = 0) last.
    expect(uv.getY(0)).toBeCloseTo(2 / 64);
    expect(uv.getY(8)).toBeCloseTo(0);
    expect(uv.getY(12)).toBeCloseTo(2 / 64);
    expect(uv.getY(14)).toBeCloseTo(0);
  });

  it("rejects a face list that is not the six faces", () => {
    const geometry = new BoxGeometry(1, 1, 1);
    const faces = layoutFaces(0, 0, 1, 1, 1).slice(0, 5);
    expect(() => writeHostBoxUVs(geometry, faces, true)).toThrow(
      "six box faces",
    );
  });

  it("rejects a segmented box", () => {
    const geometry = new BoxGeometry(1, 1, 1, 2, 1, 1);
    expect(() =>
      writeHostBoxUVs(geometry, layoutFaces(0, 0, 1, 1, 1), true),
    ).toThrow("single-segment");
  });
});
