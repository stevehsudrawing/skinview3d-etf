/**
 * Shared fake `SkinObject` builder for the render specs: six parts
 * whose layer meshes carry fresh `MeshStandardMaterial` instances, so
 * the part, overlay and transparency specs exercise real three
 * objects without a viewer. The part list comes from
 * `src/render/core/parts`, so the six-part vocabulary keeps one home.
 */

import type { SkinObject } from "skinview3d";
import { Mesh, MeshStandardMaterial } from "three";
import { BODY_PART_IDS, type BodyPartId } from "../../src/render/core/parts";

/** The layer meshes of one layer set, keyed by part. */
export type FakeSkinLayers = Record<BodyPartId, Mesh>;

/** A fake skin object plus its layer meshes. */
export interface FakeSkin {
  /** The part source the renderer consumes. */
  skin: SkinObject;
  /** The inner-layer meshes by part. */
  inner: FakeSkinLayers;
  /** The outer-layer meshes by part. */
  outer: FakeSkinLayers;
}

/**
 * Builds a fake skin object.
 *
 * @returns The skin stand-in plus its inner / outer layer meshes.
 */
export function createFakeSkin(): FakeSkin {
  const inner = {} as FakeSkinLayers;
  const outer = {} as FakeSkinLayers;
  const parts = {} as Record<
    BodyPartId,
    { innerLayer: Mesh; outerLayer: Mesh }
  >;
  for (const id of BODY_PART_IDS) {
    inner[id] = new Mesh(undefined, new MeshStandardMaterial());
    outer[id] = new Mesh(undefined, new MeshStandardMaterial());
    parts[id] = { innerLayer: inner[id], outerLayer: outer[id] };
  }
  return { skin: parts as unknown as SkinObject, inner, outer };
}
