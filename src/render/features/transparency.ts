/**
 * Transparency feature: the translucent look is applied per body
 * part, measured from the decoded pixels. A part whose layer-1
 * pixels contain a non-opaque pixel swaps its inner-layer mesh to a
 * double-sided blended clone of the host material; parts without
 * translucent pixels keep the host material untouched, because back
 * faces behind opaque pixels are provably invisible.
 */

import type { SkinObject } from "skinview3d";
import { DoubleSide, type Mesh, type MeshStandardMaterial } from "three";
import type { PixelData, Rect } from "../../decode/core/types";
import {
  BODY_PART_IDS,
  layer1Rects,
  partsOf,
  type BodyPartId,
} from "../core/parts";

/**
 * Whether a rectangle contains a non-opaque pixel (`alpha < 255`;
 * fully transparent pixels count, because without blending they
 * would paint opaque).
 *
 * @param image - The decoded skin pixels.
 * @param rect - The rectangle to scan.
 * @returns `true` when a non-opaque pixel exists inside.
 */
function rectHasTranslucentPixel(image: PixelData, rect: Rect): boolean {
  for (let y = rect.y1; y <= rect.y2; y++) {
    for (let x = rect.x1; x <= rect.x2; x++) {
      if (image.data[(y * image.width + x) * 4 + 3] < 255) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Collects the parts whose layer-1 box unwrap contains a non-opaque
 * pixel in the decoded skin.
 *
 * @param image - The decoded skin pixels (post-removal).
 * @param modelType - The skin's model type (`"slim"` narrows the
 *   arms).
 * @returns The ids of the translucent parts.
 */
export function translucentParts(
  image: PixelData,
  modelType: SkinObject["modelType"],
): Set<BodyPartId> {
  const parts = new Set<BodyPartId>();
  for (const id of BODY_PART_IDS) {
    if (
      layer1Rects(id, modelType).some((rect) =>
        rectHasTranslucentPixel(image, rect),
      )
    ) {
      parts.add(id);
    }
  }
  return parts;
}

/** One swapped part: the mesh, our clone and the material it displaced. */
interface SwapState {
  /** The inner-layer mesh carrying the clone. */
  mesh: Mesh;
  /** Our double-sided blended clone. */
  clone: MeshStandardMaterial;
  /** The host material the clone displaced. */
  original: MeshStandardMaterial;
}

/** The per-part swap manager behind the translucent look. */
export interface TranslucentSides {
  /**
   * Re-applies the translucent look for the parts the decoded pixels
   * mark. Restores every previous swap first, so a skin change or a
   * disabled feature always lands on the host's materials.
   *
   * @param skin - The skin object to update.
   * @param image - The decoded skin pixels (post-removal).
   * @param modelType - The skin's model type.
   * @param active - Whether the transparency feature is active.
   */
  sync(
    skin: SkinObject,
    image: PixelData,
    modelType: SkinObject["modelType"],
    active: boolean,
  ): void;
  /** Releases every swap; the clones stay cached for a cheap re-enable. */
  restore(): void;
  /** Releases every swap and disposes the cached clones. */
  dispose(): void;
}

/**
 * Creates the swap manager: one material clone per translucent part,
 * derived from the part's current host material (polygon offset and
 * map carry over). A mesh is only touched while it still carries our
 * clone, and every `sync()` re-reads each clone's map from the host
 * material because the host's `loadSkin()` only updates its own
 * instances.
 *
 * @returns The manager handle.
 */
export function createTranslucentSides(): TranslucentSides {
  const swaps = new Map<BodyPartId, SwapState>();
  const clones = new Map<BodyPartId, MeshStandardMaterial>();

  const restore = (): void => {
    for (const state of swaps.values()) {
      if (state.mesh.material === state.clone) {
        state.mesh.material = state.original;
      }
    }
    swaps.clear();
  };

  const sync = (
    skin: SkinObject,
    image: PixelData,
    modelType: SkinObject["modelType"],
    active: boolean,
  ): void => {
    restore();
    if (!active) {
      return;
    }
    const needed = translucentParts(image, modelType);
    if (needed.size === 0) {
      return;
    }
    const parts = partsOf(skin);
    for (let index = 0; index < BODY_PART_IDS.length; index++) {
      const id = BODY_PART_IDS[index];
      if (!needed.has(id)) {
        continue;
      }
      const mesh = parts[index].inner;
      const original = mesh.material as MeshStandardMaterial;
      let clone = clones.get(id);
      if (clone === undefined) {
        clone = original.clone();
        clone.transparent = true;
        clone.side = DoubleSide;
        clone.needsUpdate = true;
        clones.set(id, clone);
      }
      if (clone.map !== original.map) {
        clone.map = original.map;
        clone.needsUpdate = true;
      }
      mesh.material = clone;
      swaps.set(id, { mesh, clone, original });
    }
  };

  const dispose = (): void => {
    restore();
    for (const clone of clones.values()) {
      clone.dispose();
    }
    clones.clear();
  };

  return { sync, restore, dispose };
}
