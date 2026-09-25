/**
 * Emissive feature: uploads the decoded emissive mask as a shared
 * fullbright texture and draws one overlay mesh per body-part layer.
 *
 * The overlay meshes share the host geometry and use a polygon offset
 * to sit slightly in front of the base meshes, so no z-fighting
 * occurs and the base skin pixels stay untouched. Upstream instead
 * deletes the mask pixels from the base texture; the overlay
 * reproduces the same look without mutating the skin.
 */

import type { SkinObject } from "skinview3d";
import {
  CanvasTexture,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  type Texture,
} from "three";
import type { PixelData } from "../../decode/core/types";
import { paintCanvasPixels } from "../core/canvas";

/**
 * Creates the shared glow texture from a decoded emissive mask. The
 * sampler configuration mirrors the host's skin texture (a plain
 * canvas texture with nearest filtering and the default `flipY`),
 * because the overlays reuse the host geometry and UVs.
 *
 * @param mask - The decoded emissive mask (skin-sized RGBA pixels).
 * @returns The prepared texture, owned by the caller.
 */
export function createGlowTexture(mask: PixelData): CanvasTexture {
  const canvas = document.createElement("canvas");
  paintCanvasPixels(canvas, mask);
  const texture = new CanvasTexture(canvas);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  return texture;
}

/**
 * Repaints an existing glow texture with new mask pixels.
 *
 * @param texture - A texture created by {@link createGlowTexture}.
 * @param mask - The decoded emissive mask (skin-sized RGBA pixels).
 */
export function repaintGlowTexture(
  texture: CanvasTexture,
  mask: PixelData,
): void {
  const canvas = texture.image as HTMLCanvasElement;
  paintCanvasPixels(canvas, mask);
  texture.needsUpdate = true;
}

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
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}

/**
 * Adds one overlay mesh per body-part layer (six parts x inner/outer)
 * as a child of the source mesh, sharing its geometry so model-type
 * changes and arm scaling stay in sync.
 *
 * @param skin - The skin object whose layer meshes are overlaid.
 * @param material - The shared overlay material.
 * @returns The created meshes, in part/layer order.
 */
export function createEmissiveOverlays(
  skin: SkinObject,
  material: MeshBasicMaterial,
): Mesh[] {
  const parts = [
    skin.head,
    skin.body,
    skin.leftArm,
    skin.rightArm,
    skin.leftLeg,
    skin.rightLeg,
  ];
  const meshes: Mesh[] = [];
  for (const part of parts) {
    for (const layer of [part.innerLayer, part.outerLayer]) {
      const source = layer as Mesh;
      const overlay = new Mesh(source.geometry, material);
      overlay.name = "etf-emissive";
      source.add(overlay);
      meshes.push(overlay);
    }
  }
  return meshes;
}

/**
 * Detaches the overlays from their parents. The shared geometry,
 * material and texture are owned by the caller and are not disposed
 * here.
 *
 * @param meshes - The meshes created by {@link createEmissiveOverlays}.
 */
export function disposeEmissiveOverlays(meshes: readonly Mesh[]): void {
  for (const mesh of meshes) {
    mesh.removeFromParent();
  }
}
