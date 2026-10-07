/**
 * The host's box-unwrap UV mapping in one place: the boxes whose UVs
 * we hand-write (the jacket shell and the villager nose box) replay
 * the host model's `setUVs` convention through this writer, so the
 * mapping has a single home.
 *
 * The convention, for a single-segment box whose six faces sit in
 * three.js face order (`+x`, `-x`, `+y`, `-y`, `+z`, `-z`): every
 * face except the bottom (`-y`) reads its vertices as top-left,
 * top-right, bottom-left, bottom-right; the host's bottom face uses
 * its own rotated order (`[0, 1, 3, 2]` over the same corner list).
 * `flipY` selects the V convention of the consuming texture: `true`
 * for the host's default-`flipY` textures (`v = 1 - y / 64`, the
 * jacket) and `false` for skin-space textures (`v = y / 64`, the
 * nose).
 */

import { SKIN_SIZE } from "etf-skin-decoder";
import type { BoxGeometry } from "three";

/**
 * One box face as skin-space pixel edges (`[left, top, right,
 * bottom]`); the right and bottom edges sit one past the last pixel.
 */
export type BoxFaceEdges = readonly [number, number, number, number];

/**
 * The host `setUVs` vertex order per face (`+x`, `-x`, `+y`, `-y`,
 * `+z`, `-z`) over the corner list `(x1, y2)`, `(x2, y2)`, `(x2, y1)`,
 * `(x1, y1)`: every face reads `[3, 2, 0, 1]` except the rotated
 * bottom face.
 */
const FACE_ORDERS: readonly (readonly number[])[] = [
  [3, 2, 0, 1],
  [3, 2, 0, 1],
  [3, 2, 0, 1],
  [0, 1, 3, 2],
  [3, 2, 0, 1],
  [3, 2, 0, 1],
];

/**
 * Writes the host box-unwrap UVs for a single-segment box (24 UV
 * vertices).
 *
 * @param geometry - The box geometry to rewrite (mutated).
 * @param faces - The six faces in three.js face order.
 * @param flipY - The consuming texture's `flipY` flag: `true` writes
 *   the host convention (`v = 1 - y / 64`), `false` skin space
 *   (`v = y / 64`).
 * @throws {Error} When `faces` is not the six-face list.
 * @throws {Error} When the geometry is not a single-segment box.
 */
export function writeHostBoxUVs(
  geometry: BoxGeometry,
  faces: readonly BoxFaceEdges[],
  flipY: boolean,
): void {
  const uv = geometry.attributes.uv;
  if (faces.length !== FACE_ORDERS.length) {
    throw new Error("writeHostBoxUVs expects the six box faces");
  }
  if (uv.count !== faces.length * 4) {
    throw new Error("writeHostBoxUVs expects a single-segment box");
  }
  for (let face = 0; face < faces.length; face++) {
    const [x1, y1, x2, y2] = faces[face];
    const corners = [
      [x1, flipY ? SKIN_SIZE - y2 : y2],
      [x2, flipY ? SKIN_SIZE - y2 : y2],
      [x2, flipY ? SKIN_SIZE - y1 : y1],
      [x1, flipY ? SKIN_SIZE - y1 : y1],
    ];
    const order = FACE_ORDERS[face];
    for (let vertex = 0; vertex < order.length; vertex++) {
      const [x, y] = corners[order[vertex]];
      uv.setXY(face * 4 + vertex, x / SKIN_SIZE, y / SKIN_SIZE);
    }
  }
  uv.needsUpdate = true;
}
