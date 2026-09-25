/**
 * The six body parts shared across the renderer: one vocabulary for
 * the part list and the lookups derived from it (layer meshes,
 * layer-1 materials, bound textures), so no module re-spells the
 * six-part list again.
 */

import type { SkinObject } from "skinview3d";
import type { Mesh, MeshStandardMaterial, Texture } from "three";

/** The six body-part keys, in model order. */
export const BODY_PART_IDS = [
  "head",
  "body",
  "leftArm",
  "rightArm",
  "leftLeg",
  "rightLeg",
] as const;

/** One of the six body-part keys. */
export type BodyPartId = (typeof BODY_PART_IDS)[number];

/** The two layer meshes of one body part. */
export interface PartLayers {
  /** The inner (base) layer mesh. */
  inner: Mesh;
  /** The outer (overlay) layer mesh. */
  outer: Mesh;
}

/**
 * Resolves the six parts of a skin object into their layer meshes.
 *
 * @param skin - The skin object to inspect.
 * @returns The parts in {@link BODY_PART_IDS} order.
 */
export function partsOf(skin: SkinObject): PartLayers[] {
  const parts = [
    skin.head,
    skin.body,
    skin.leftArm,
    skin.rightArm,
    skin.leftLeg,
    skin.rightLeg,
  ];
  return parts.map((part) => ({
    inner: part.innerLayer as Mesh,
    outer: part.outerLayer as Mesh,
  }));
}

/**
 * Lists a part's layer meshes in inner/outer order.
 *
 * @param part - The part to expand.
 * @returns The inner layer first, then the outer layer.
 */
export function layersOf(part: PartLayers): Mesh[] {
  return [part.inner, part.outer];
}

/**
 * Normalizes a mesh's material slot into a list.
 *
 * @param mesh - The mesh to read.
 * @returns Every material instance bound to the mesh.
 */
function materialsOf(mesh: Mesh): MeshStandardMaterial[] {
  const material = mesh.material;
  const entries = Array.isArray(material) ? material : [material];
  return entries.map((entry) => entry as MeshStandardMaterial);
}

/**
 * Collects the unique layer-1 materials of the six parts (the plain
 * variants plus the arms/legs "biased" polygon-offset clones).
 *
 * @param skin - The skin object to inspect.
 * @returns Every distinct layer-1 material.
 */
export function layerMaterialsOf(skin: SkinObject): MeshStandardMaterial[] {
  const materials = new Set<MeshStandardMaterial>();
  for (const part of partsOf(skin)) {
    for (const material of materialsOf(part.inner)) {
      materials.add(material);
    }
  }
  return [...materials];
}

/**
 * Collects the unique textures bound by the six parts' layer meshes
 * (the set the controller marks for re-upload after a repaint).
 *
 * @param skin - The skin object to inspect.
 * @returns Every distinct bound texture.
 */
export function layerMapsOf(skin: SkinObject): Texture[] {
  const maps = new Set<Texture>();
  for (const part of partsOf(skin)) {
    for (const layer of layersOf(part)) {
      for (const material of materialsOf(layer)) {
        if (material.map !== null) {
          maps.add(material.map);
        }
      }
    }
  }
  return [...maps];
}

/**
 * Returns the head's layer-1 material (the nose material template).
 *
 * @param skin - The skin object to inspect.
 * @returns The head's inner-layer material.
 */
export function headLayerMaterial(skin: SkinObject): MeshStandardMaterial {
  const material = (skin.head.innerLayer as Mesh).material;
  return (
    Array.isArray(material) ? material[0] : material
  ) as MeshStandardMaterial;
}
