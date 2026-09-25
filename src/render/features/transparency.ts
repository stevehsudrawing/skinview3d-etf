/**
 * Transparency feature: toggles the skin's layer-1 materials and
 * remembers the original settings (transparency and face culling) so
 * they can be restored.
 */

import { DoubleSide, type MeshStandardMaterial, type Side } from "three";

/** Original layer-1 material settings, saved before the first change. */
export interface MaterialState {
  /** The original `transparent` flag. */
  transparent: boolean;
  /** The original `side` value. */
  side: Side;
}

/**
 * Applies the translucent look to the given materials: the
 * `transparent` flag plus `DoubleSide`, because the in-game
 * translucent render type does not cull back faces - a see-through
 * skin shows the inside of the model. The original settings are saved
 * the first time each material is seen.
 *
 * @param materials - The materials to update.
 * @param originals - Map receiving the original settings.
 * @param on - Whether the translucent look is active.
 */
export function setTransparent(
  materials: readonly MeshStandardMaterial[],
  originals: Map<MeshStandardMaterial, MaterialState>,
  on: boolean,
): void {
  for (const material of materials) {
    let saved = originals.get(material);
    if (saved === undefined) {
      saved = { transparent: material.transparent, side: material.side };
      originals.set(material, saved);
    }
    const nextTransparent = on ? true : saved.transparent;
    const nextSide: Side = on ? DoubleSide : saved.side;
    if (
      material.transparent !== nextTransparent ||
      material.side !== nextSide
    ) {
      material.transparent = nextTransparent;
      material.side = nextSide;
      material.needsUpdate = true;
    }
  }
}

/**
 * Restores the saved translucency settings of every known material.
 *
 * @param originals - The saved settings.
 */
export function restoreTransparent(
  originals: Map<MeshStandardMaterial, MaterialState>,
): void {
  for (const [material, saved] of originals) {
    if (
      material.transparent !== saved.transparent ||
      material.side !== saved.side
    ) {
      material.transparent = saved.transparent;
      material.side = saved.side;
      material.needsUpdate = true;
    }
  }
}
