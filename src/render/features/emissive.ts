/**
 * Emissive feature: the shared fullbright overlay material.
 *
 * The material is unlit (fullbright), blended, depth-read-only and
 * pushed slightly in front of the source mesh via the shared overlay
 * polygon offset, so the glow draws over the skin without mutating
 * it. Upstream instead deletes the mask pixels from the base
 * texture; the overlay reproduces the same look without touching the
 * skin. The mask texture and the overlay meshes come from the shared
 * core helpers (`render/core/textures.ts`, `render/core/overlays.ts`).
 */

import { DoubleSide, MeshBasicMaterial, type Texture } from "three";
import { OVERLAY_OFFSET } from "../core/overlays";

/**
 * Creates the shared overlay material: unlit (fullbright), blended,
 * depth-read-only and pushed slightly in front of the source mesh.
 *
 * @param map - The shared glow texture.
 * @returns The prepared material, owned by the caller.
 */
export function createEmissiveMaterial(map: Texture): MeshBasicMaterial {
  return new MeshBasicMaterial({
    map,
    transparent: true,
    depthWrite: false,
    alphaTest: 1e-5,
    side: DoubleSide,
    ...OVERLAY_OFFSET,
  });
}
