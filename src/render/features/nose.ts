/**
 * Nose feature: builds the villager nose box (skin-space UVs) and the
 * textured nose plate, both anchored to the head's layer-1 mesh.
 */

import {
  BoxGeometry,
  Mesh,
  PlaneGeometry,
  type BufferGeometry,
  type MeshStandardMaterial,
  type Texture,
} from "three";

import type { Coordinate } from "../../decode/core/types";

/** A rectangle in skin space; edges in 64ths, not pixel indices. */
interface FaceRect {
  /** The top-left edge pair. */
  topLeft: Coordinate;
  /** The bottom-right edge pair. */
  bottomRight: Coordinate;
}

/**
 * Skin-space rectangles of the 2x4x2 nose box faces, in three.js
 * geometry face order (`+x`, `-x`, `+y`, `-y`, `+z`, `-z`), matching
 * the vanilla box unwrap of the region `(24,0)-(32,6)`.
 */
const FACE_RECTS: readonly FaceRect[] = [
  { topLeft: { x: 28, y: 2 }, bottomRight: { x: 30, y: 6 } }, // +x side
  { topLeft: { x: 24, y: 2 }, bottomRight: { x: 26, y: 6 } }, // -x side
  { topLeft: { x: 26, y: 0 }, bottomRight: { x: 28, y: 2 } }, // +y top
  { topLeft: { x: 28, y: 0 }, bottomRight: { x: 30, y: 2 } }, // -y bottom
  { topLeft: { x: 26, y: 2 }, bottomRight: { x: 28, y: 6 } }, // +z front
  { topLeft: { x: 30, y: 2 }, bottomRight: { x: 32, y: 6 } }, // -z back
];

/** The nose mesh type used across the renderer. */
export type NoseMesh = Mesh<BufferGeometry, MeshStandardMaterial>;

/**
 * Builds the 2x4x2 nose box with UVs rewritten into skin space
 * (`flipY = false`, `u = x / 64`, `v = y / 64`).
 *
 * @returns The prepared box geometry.
 */
export function buildNoseGeometry(): BoxGeometry {
  const geometry = new BoxGeometry(2, 4, 2);
  const uv = geometry.attributes.uv;
  for (let face = 0; face < FACE_RECTS.length; face++) {
    const {
      topLeft: { x: x1, y: y1 },
      bottomRight: { x: x2, y: y2 },
    } = FACE_RECTS[face];
    for (let corner = 0; corner < 4; corner++) {
      const index = face * 4 + corner;
      const fu = uv.getX(index);
      const fv = 1 - uv.getY(index);
      uv.setXY(index, (x1 + fu * (x2 - x1)) / 64, (y2 - fv * (y2 - y1)) / 64);
    }
  }
  uv.needsUpdate = true;
  return geometry;
}

/**
 * Builds the villager nose box mesh: the head's layer-1 material is
 * cloned so the light response matches the host.
 *
 * @param headMaterial - The head's layer-1 material.
 * @param map - The villager (or skin) texture sampled by the UVs.
 * @returns The nose mesh, not yet added to a parent.
 */
export function createVillagerNoseMesh(
  headMaterial: MeshStandardMaterial,
  map: Texture,
): NoseMesh {
  const material = headMaterial.clone();
  material.map = map;
  material.needsUpdate = true;
  const mesh = new Mesh(buildNoseGeometry(), material);
  mesh.position.set(0, -2, 5);
  return mesh;
}

/**
 * Builds the textured nose plate showing the decoded 8x8 texture.
 *
 * @param headMaterial - The head's layer-1 material.
 * @param map - The 8x8 nose texture.
 * @returns The plate mesh, not yet added to a parent.
 */
export function createTexturedNoseMesh(
  headMaterial: MeshStandardMaterial,
  map: Texture,
): NoseMesh {
  const material = headMaterial.clone();
  material.map = map;
  material.needsUpdate = true;
  const mesh = new Mesh(new PlaneGeometry(2, 4), material);
  mesh.position.set(0, -2, 4.5);
  return mesh;
}

/**
 * Removes a nose mesh from its parent and disposes its geometry, the
 * cloned material and our texture.
 *
 * @param mesh - The mesh to dispose.
 */
export function disposeNose(mesh: NoseMesh): void {
  mesh.removeFromParent();
  mesh.geometry.dispose();
  mesh.material.map?.dispose();
  mesh.material.dispose();
}
