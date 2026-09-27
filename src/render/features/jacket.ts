/**
 * The jacket/dress extension: the thin and wide shells (upstream
 * `texOffs(16, 32)` with grow 0.25 / 0.75) drawn from the decoded
 * jacket texture, with the 1-8 px length told by the texture.
 *
 * The shell hangs under the body's outer layer, so the host's
 * re-parenting and the outer-layer visibility carry over through the
 * parent chain. The box UVs are written in skin space against the
 * body-outer region of the 64x64 layout - the same regions the
 * decoder fills - so the jacket texture samples exactly like the
 * skin pixels it was cut from. The overlay meshes (the jacket's
 * emissive and enchanted masks) share the shell geometry and are
 * children of the shell; their materials come from the shared
 * feature recipes.
 */

import {
  BoxGeometry,
  Mesh,
  Texture,
  type BufferGeometry,
  type Material,
  type MeshStandardMaterial,
} from "three";
import { SKIN_SIZE } from "../../decode/core/constants";
import type { Rect } from "../../decode/core/types";

/** One jacket shell's dimensions, in model units (1 unit = 1 px). */
interface JacketBoxSize {
  /** Shell width. */
  width: number;
  /** Shell height. */
  height: number;
  /** Shell depth. */
  depth: number;
}

/**
 * The two shell sizes: the upstream `8 x 12 x 4` body box grown by
 * 0.25 (thin) and 0.75 (wide) per side.
 */
export const JACKET_SIZES: Readonly<Record<"thin" | "wide", JacketBoxSize>> = {
  thin: { width: 8.5, height: 12.5, depth: 4.5 },
  wide: { width: 9.5, height: 13.5, depth: 5.5 },
};

/**
 * The box layout the jacket texture is built on: the body outer
 * layer's region of the 64x64 layout (`(16, 32)`, `8 x 12 x 4`),
 * which is also the anchor upstream samples (`texOffs(16, 32)`). The
 * decoder fills exactly these face regions.
 */
const JACKET_UV_REGION = {
  /** The region anchor column. */
  u: 16,
  /** The region anchor row. */
  v: 32,
  /** Box width in pixels. */
  width: 8,
  /** Box height in pixels. */
  height: 12,
  /** Box depth in pixels. */
  depth: 4,
} as const;

/** One box face as skin-space edges (`[x1, y1, x2, y2]`, exclusive ends). */
type FaceEdges = readonly [number, number, number, number];

/**
 * The six face regions of the jacket box layout, in three.js face
 * order (`+x`, `-x`, `+y`, `-y`, `+z`, `-z`): the classic box unwrap
 * of {@link JACKET_UV_REGION}, matching the host model's own layer
 * UVs. The `-y` bottom stays empty.
 *
 * @returns The six faces as exclusive-end edge tuples.
 */
function jacketFaceEdges(): readonly FaceEdges[] {
  const { u, v, width: w, height: h, depth: d } = JACKET_UV_REGION;
  return [
    [u + w + d, v + d, u + w + 2 * d, v + d + h],
    [u, v + d, u + d, v + d + h],
    [u + d, v, u + w + d, v + d],
    [u + w + d, v, u + 2 * w + d, v + d],
    [u + d, v + d, u + w + d, v + d + h],
    [u + w + 2 * d, v + d, u + 2 * w + 2 * d, v + d + h],
  ];
}

/**
 * Returns the six skin-space face regions of the jacket box, in
 * three.js face order (`+x`, `-x`, `+y`, `-y`, `+z`, `-z`). The
 * rects are inclusive and match the decoder's fill targets column
 * for column; the `-y` bottom stays unfilled (transparent).
 *
 * @returns The six inclusive face rectangles.
 */
export function jacketFaceRects(): readonly Rect[] {
  return jacketFaceEdges().map(([x1, y1, x2, y2]) => ({
    topLeft: { x: x1, y: y1 },
    bottomRight: { x: x2 - 1, y: y2 - 1 },
  }));
}

/**
 * The four UV corners of one face in the classic unwrap order. The V
 * axis follows our skin-space convention (`v = y / 64` grows
 * downwards, `flipY = false` textures), so the host's bottom-up
 * `1 - y / 64` formula swaps to `y / 64`.
 *
 * @param edges - The face edges (exclusive ends).
 * @returns The four corners as `[u, v]` pairs.
 */
function faceCorners([x1, y1, x2, y2]: FaceEdges): readonly (readonly [
  number,
  number,
])[] {
  return [
    [x1 / SKIN_SIZE, y2 / SKIN_SIZE],
    [x2 / SKIN_SIZE, y2 / SKIN_SIZE],
    [x2 / SKIN_SIZE, y1 / SKIN_SIZE],
    [x1 / SKIN_SIZE, y1 / SKIN_SIZE],
  ];
}

/**
 * Rewrites a box geometry's UVs to sample the jacket layout. The
 * per-face vertex arrangement replicates the host model's classic
 * box unwrap (its `setUVs`, MIT), so a face samples the same region
 * the host's body outer layer would.
 *
 * @param geometry - The box geometry to rewrite (mutated).
 */
function writeJacketUVs(geometry: BoxGeometry): void {
  const [right, left, top, bottom, front, back] = jacketFaceEdges();
  // The host's per-face corner permutations: every face reads its
  // corners as [3, 2, 0, 1] except the bottom face ([0, 1, 3, 2]).
  const orders = [
    [3, 2, 0, 1],
    [3, 2, 0, 1],
    [3, 2, 0, 1],
    [0, 1, 3, 2],
    [3, 2, 0, 1],
    [3, 2, 0, 1],
  ] as const;
  const edges = [right, left, top, bottom, front, back];
  const values: number[] = [];
  for (let face = 0; face < edges.length; face++) {
    const corners = faceCorners(edges[face]);
    for (const corner of orders[face]) {
      values.push(...corners[corner]);
    }
  }
  const uvAttr = geometry.attributes.uv;
  for (let index = 0; index < values.length; index += 2) {
    uvAttr.setXY(index / 2, values[index], values[index + 1]);
  }
  uvAttr.needsUpdate = true;
}

/**
 * Builds one jacket shell geometry: a box at the requested width
 * whose UVs sample the jacket layout in skin space.
 *
 * @param wide - Whether to build the wide shell (`false` = thin).
 * @returns The prepared geometry, owned by the caller.
 */
export function createJacketGeometry(wide: boolean): BoxGeometry {
  const size = JACKET_SIZES[wide ? "wide" : "thin"];
  const geometry = new BoxGeometry(size.width, size.height, size.depth);
  writeJacketUVs(geometry);
  return geometry;
}

/**
 * Creates the jacket material: a clone of the host body outer-layer
 * material (its blending, alpha test, sides and light response carry
 * over) whose map is the decoded jacket texture.
 *
 * @param source - The host body outer-layer material.
 * @param map - The jacket texture.
 * @returns The prepared material, owned by the caller.
 */
export function createJacketMaterial(
  source: MeshStandardMaterial,
  map: Texture,
): MeshStandardMaterial {
  const material = source.clone();
  material.map = map;
  material.needsUpdate = true;
  return material;
}

/**
 * Creates the jacket shell mesh (the `etf-jacket` name) and anchors
 * it where the shell hangs: under the body's outer layer so its top
 * face meets the body's bottom (`y = -12.5`; 1 unit = 1 px, the
 * upstream model position).
 *
 * @param geometry - The shell geometry (shared with the overlays).
 * @param material - The shell material.
 * @returns The mesh, not yet added to a parent.
 */
export function createJacketMesh(
  geometry: BufferGeometry,
  material: Material,
): Mesh {
  const mesh = new Mesh(geometry, material);
  mesh.name = "etf-jacket";
  mesh.position.set(0, -12.5, 0);
  return mesh;
}

/**
 * Creates one jacket overlay mesh sharing the shell geometry (the
 * `etf-` name convention).
 *
 * @param geometry - The shell geometry.
 * @param material - The overlay material.
 * @param name - The overlay mesh name.
 * @param renderOrder - Draw order among the overlays.
 * @returns The mesh, to be added as a child of the shell mesh.
 */
export function createJacketOverlayMesh(
  geometry: BufferGeometry,
  material: Material,
  name: string,
  renderOrder: number,
): Mesh {
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.renderOrder = renderOrder;
  return mesh;
}

/**
 * Disposes one mesh's material and the texture the feature owns: the
 * material's `map`, or the enchanted overlay's mask uniform. The
 * host material and the shared pattern texture are never touched.
 *
 * @param mesh - One mesh of the jacket tree.
 */
function disposeMeshAssets(mesh: Mesh): void {
  const material = mesh.material;
  if (Array.isArray(material)) {
    return;
  }
  const map = (material as unknown as { map?: Texture | null }).map;
  if (map !== undefined && map !== null) {
    map.dispose();
  }
  const uniforms = (
    material as unknown as { uniforms?: Record<string, { value?: unknown }> }
  ).uniforms;
  const mask = uniforms?.uMask?.value;
  if (mask instanceof Texture) {
    mask.dispose();
  }
  material.dispose();
}

/**
 * Removes a jacket mesh tree from its parent and disposes the assets
 * the feature created: the shell's and its overlay children's
 * materials and their own textures. The geometry belongs to the
 * caller's cache and is left alone.
 *
 * @param mesh - The shell mesh created by {@link createJacketMesh}.
 */
export function disposeJacketMesh(mesh: Mesh): void {
  for (const child of [...mesh.children]) {
    if (child instanceof Mesh) {
      disposeMeshAssets(child);
    }
  }
  disposeMeshAssets(mesh);
  mesh.removeFromParent();
}
