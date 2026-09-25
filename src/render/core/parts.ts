/**
 * The six body parts shared across the renderer: one vocabulary for
 * the part list and the facts derived from it (layer meshes, layer-1
 * region rectangles, bound textures), so no module re-spells the
 * six-part list again.
 */

import type { SkinObject } from "skinview3d";
import type { Mesh, MeshStandardMaterial, Texture } from "three";
import type { Rect } from "../../decode/core/types";

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
 * One layer-1 box-unwrap region: the parameters of the host's
 * `setSkinUVs` call for the part's inner-layer box, which is where
 * the mesh samples its texture.
 */
interface PartBox {
  /** Region origin x on the 64x64 layout. */
  u: number;
  /** Region origin y on the 64x64 layout. */
  v: number;
  /** Box width in pixels (3 for slim arms). */
  w: number;
  /** Box height in pixels. */
  h: number;
  /** Box depth in pixels. */
  d: number;
}

/** The layer-1 box parameters of every part (classic model). */
const LAYER1_BOXES: Readonly<Record<BodyPartId, PartBox>> = {
  head: { u: 0, v: 0, w: 8, h: 8, d: 8 },
  body: { u: 16, v: 16, w: 8, h: 12, d: 4 },
  rightArm: { u: 40, v: 16, w: 4, h: 12, d: 4 },
  leftArm: { u: 32, v: 48, w: 4, h: 12, d: 4 },
  rightLeg: { u: 0, v: 16, w: 4, h: 12, d: 4 },
  leftLeg: { u: 16, v: 48, w: 4, h: 12, d: 4 },
};

/**
 * Returns the two rectangles of a part's layer-1 box unwrap - the
 * exact pixels its inner-layer mesh samples. Row A holds the top and
 * bottom faces (the corner blocks beside them are unused filler, so
 * a bounding-box scan would false-positive on blank skins); row B
 * holds the four side faces. Slim arms are 3 px wide.
 *
 * @param part - The body part.
 * @param modelType - The skin's model type (`"slim"` narrows the
 *   arms).
 * @returns The two row rectangles of the layer-1 region.
 */
export function layer1Rects(
  part: BodyPartId,
  modelType: SkinObject["modelType"],
): Rect[] {
  const box = LAYER1_BOXES[part];
  const w =
    modelType === "slim" && (part === "rightArm" || part === "leftArm")
      ? 3
      : box.w;
  return [
    {
      x1: box.u + box.d,
      y1: box.v,
      x2: box.u + box.d + 2 * w - 1,
      y2: box.v + box.d - 1,
    },
    {
      x1: box.u,
      y1: box.v + box.d,
      x2: box.u + 2 * (w + box.d) - 1,
      y2: box.v + box.d + box.h - 1,
    },
  ];
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
