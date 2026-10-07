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

import { writeHostBoxUVs, type BoxFaceEdges } from "../core/box-uvs";

/**
 * Skin-space edges of the 2x4x2 nose box faces, in three.js geometry
 * face order (`+x`, `-x`, `+y`, `-y`, `+z`, `-z`): the vanilla box
 * unwrap of the region `(24,0)-(32,6)`, as `[left, top, right,
 * bottom]` pixel edges (the right and bottom edges are the last
 * pixel + 1).
 */
const FACE_EDGES: readonly BoxFaceEdges[] = [
  [28, 2, 30, 6], // +x side
  [24, 2, 26, 6], // -x side
  [26, 0, 28, 2], // +y top
  [28, 0, 30, 2], // -y bottom
  [26, 2, 28, 6], // +z front
  [30, 2, 32, 6], // -z back
];

/** The nose mesh type used across the renderer. */
export type NoseMesh = Mesh<BufferGeometry, MeshStandardMaterial>;

/**
 * Builds the 2x4x2 nose box with its UVs written by the shared host
 * box-unwrap writer in skin space (`flipY = false`): each face maps
 * its top-left vertex to the region's `(x1, y1)`; only the bottom
 * (`-y`) face keeps the host's rotated layout.
 *
 * @returns The prepared box geometry.
 */
export function buildNoseGeometry(): BoxGeometry {
  const geometry = new BoxGeometry(2, 4, 2);
  writeHostBoxUVs(geometry, FACE_EDGES, false);
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
