/**
 * Transparency feature: toggles the skin's layer-1 materials and
 * remembers every original flag so they can be restored.
 */

import type { SkinObject } from "skinview3d";
import type { Mesh, MeshStandardMaterial } from "three";

/**
 * Collects the unique layer-1 materials of the six body parts (the
 * plain variants plus the arms/legs "biased" polygon-offset clones).
 *
 * @param skin - The skin object to inspect.
 * @returns Every distinct layer-1 material.
 */
export function collectLayerMaterials(
  skin: SkinObject,
): MeshStandardMaterial[] {
  const parts = [
    skin.head,
    skin.body,
    skin.leftArm,
    skin.rightArm,
    skin.leftLeg,
    skin.rightLeg,
  ];
  const materials = new Set<MeshStandardMaterial>();
  for (const part of parts) {
    const mesh = part.innerLayer as Mesh;
    const material = mesh.material;
    if (Array.isArray(material)) {
      for (const entry of material) {
        materials.add(entry as MeshStandardMaterial);
      }
    } else {
      materials.add(material as MeshStandardMaterial);
    }
  }
  return [...materials];
}

/**
 * Applies the `transparent` flag to the given materials, storing the
 * original value of every material the first time it is seen.
 *
 * @param materials - The materials to update.
 * @param originals - Map receiving the original flags.
 * @param on - The transparency value to apply.
 */
export function setTransparent(
  materials: readonly MeshStandardMaterial[],
  originals: Map<MeshStandardMaterial, boolean>,
  on: boolean,
): void {
  for (const material of materials) {
    if (!originals.has(material)) {
      originals.set(material, material.transparent);
    }
    const next = on ? true : (originals.get(material) ?? material.transparent);
    if (material.transparent !== next) {
      material.transparent = next;
      material.needsUpdate = true;
    }
  }
}

/**
 * Restores the saved `transparent` flag of every known material.
 *
 * @param originals - The saved flags.
 */
export function restoreTransparent(
  originals: Map<MeshStandardMaterial, boolean>,
): void {
  for (const [material, transparent] of originals) {
    if (material.transparent !== transparent) {
      material.transparent = transparent;
      material.needsUpdate = true;
    }
  }
}
