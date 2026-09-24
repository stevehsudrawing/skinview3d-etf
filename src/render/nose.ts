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

/** A rectangle in skin space; edges, not pixels (64x64 layout). */
interface FaceRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Skin-space rectangles of the 2x4x2 nose box faces, in three.js
 * geometry face order (`+x`, `-x`, `+y`, `-y`, `+z`, `-z`), matching
 * the vanilla box unwrap of the region `(24,0)-(32,6)`.
 */
const FACE_RECTS: readonly FaceRect[] = [
  { x1: 28, y1: 2, x2: 30, y2: 6 }, // +x side
  { x1: 24, y1: 2, x2: 26, y2: 6 }, // -x side
  { x1: 26, y1: 0, x2: 28, y2: 2 }, // +y top
  { x1: 28, y1: 0, x2: 30, y2: 2 }, // -y bottom
  { x1: 26, y1: 2, x2: 28, y2: 6 }, // +z front
  { x1: 30, y1: 2, x2: 32, y2: 6 }, // -z back
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
    const rect = FACE_RECTS[face];
    for (let corner = 0; corner < 4; corner++) {
      const index = face * 4 + corner;
      const fu = uv.getX(index);
      const fv = 1 - uv.getY(index);
      uv.setXY(
        index,
        (rect.x1 + fu * (rect.x2 - rect.x1)) / 64,
        (rect.y2 - fv * (rect.y2 - rect.y1)) / 64,
      );
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
