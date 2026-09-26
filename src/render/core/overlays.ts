/**
 * Shared overlay plumbing: one overlay mesh per body-part layer,
 * added as a child of the source mesh and sharing its geometry, so
 * model-type changes, arm scaling and any re-parenting stay in sync.
 *
 * The emissive glow and the glint overlay both use this builder; the
 * polygon offset that keeps overlays in front of the base pixels
 * lives here as well.
 */

import type { SkinObject } from "skinview3d";
import { Mesh, type Material } from "three";
import { layersOf, partsOf } from "./parts";

/**
 * Polygon-offset flags that push an overlay slightly in front of its
 * source mesh, avoiding z-fighting without touching the base pixels.
 */
export const OVERLAY_OFFSET = {
  /** Enables the polygon offset. */
  polygonOffset: true,
  /** Pulls the overlay toward the camera. */
  polygonOffsetFactor: -1,
  /** Pulls the overlay toward the camera. */
  polygonOffsetUnits: -1,
} as const;

/**
 * Adds one overlay mesh per body-part layer (six parts x inner/outer)
 * as a child of the source mesh, sharing its geometry. The host owns
 * the geometry; the caller owns the material and the meshes.
 *
 * @param skin - The skin object whose layer meshes are overlaid.
 * @param material - The shared overlay material.
 * @param name - The overlay mesh name (the `etf-` convention).
 * @param renderOrder - Draw order among the overlays (default 0).
 * @returns The created meshes, in part/layer order.
 */
export function createPartOverlays(
  skin: SkinObject,
  material: Material,
  name: string,
  renderOrder = 0,
): Mesh[] {
  const meshes: Mesh[] = [];
  for (const part of partsOf(skin)) {
    for (const layer of layersOf(part)) {
      const overlay = new Mesh(layer.geometry, material);
      overlay.name = name;
      overlay.renderOrder = renderOrder;
      layer.add(overlay);
      meshes.push(overlay);
    }
  }
  return meshes;
}

/**
 * Detaches the overlays from their parents. The shared geometry,
 * material and textures are owned by the caller and are not disposed
 * here.
 *
 * @param meshes - The meshes created by {@link createPartOverlays}.
 */
export function disposeOverlays(meshes: readonly Mesh[]): void {
  for (const mesh of meshes) {
    mesh.removeFromParent();
  }
}
