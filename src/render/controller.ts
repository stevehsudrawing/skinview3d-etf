/**
 * The renderer controller behind `attachETFSkinFeatures()`: validates
 * the viewer, decodes the current skin and owns every render artifact
 * (canvas edits, material flags, the nose mesh, the emissive
 * overlays) with full restore on `detach()`.
 */

import type { SkinViewer } from "skinview3d";
import type {
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Texture,
} from "three";
import { cloneImage } from "../decode/core/pixels";
import type {
  DecodeResult,
  PatternInfo,
  PixelData,
} from "../decode/core/types";
import { decodeSkin } from "../decode/index";
import {
  paintCanvasPixels,
  pixelsEqual,
  pixelsToCanvas,
  readCanvasPixels,
} from "./core/canvas";
import { DEFAULT_VILLAGER_NOSE_DATA_URL } from "./core/default-textures";
import { createSkinSpaceTexture, resolveTextureInput } from "./core/textures";
import type {
  ETFController,
  ETFSkinFeaturesOptions,
  ETFTextureInput,
  SkinFeatureToggles,
} from "./core/types";
import {
  createEmissiveMaterial,
  createEmissiveOverlays,
  createGlowTexture,
  disposeEmissiveOverlays,
  repaintGlowTexture,
} from "./features/emissive";
import {
  createTexturedNoseMesh,
  createVillagerNoseMesh,
  disposeNose,
  type NoseMesh,
} from "./features/nose";
import {
  collectLayerMaterials,
  restoreTransparent,
  setTransparent,
  type MaterialState,
} from "./features/transparency";

/** Internal, fully normalized options. */
interface NormalizedOptions {
  /** Every feature switch with defaults applied. */
  features: Required<SkinFeatureToggles>;
  /** Blink timing; reserved for the blinking commit. */
  blink: { closedMs: number; periodMs: number };
  /** Bloom switch; accepted and ignored - deferred quality mode. */
  bloom: boolean;
  /** Ticker management switch; reserved for the blinking commit. */
  manageTicker: boolean;
  /** Villager nose override: `undefined` = built-in, `null` = off. */
  villagerNoseTexture: ETFTextureInput | null | undefined;
  /** Glint texture; reserved for the glint renderer. */
  glintTexture: ETFTextureInput | null | undefined;
  /** Warning sink, or `null` for `console.warn`. */
  onWarning: ((message: string) => void) | null;
}

/**
 * Applies defaults to the user options.
 *
 * @param options - The user options, if any.
 * @returns The normalized settings.
 */
function normalizeOptions(options: ETFSkinFeaturesOptions): NormalizedOptions {
  const features = options.features ?? {};
  return {
    features: {
      transparency: features.transparency ?? true,
      emissive: features.emissive ?? true,
      blink: features.blink ?? true,
      nose: features.nose ?? true,
      jacket: features.jacket ?? true,
      enchanted: features.enchanted ?? true,
    },
    blink: {
      closedMs: options.blink?.closedMs ?? 250,
      periodMs: options.blink?.periodMs ?? 6000,
    },
    bloom: options.bloom ?? false,
    manageTicker: options.manageTicker ?? true,
    villagerNoseTexture: options.villagerNoseTexture,
    glintTexture: options.glintTexture,
    onWarning: options.onWarning ?? null,
  };
}

/**
 * Attaches the ETF skin features to a live skinview3d viewer.
 *
 * Decodes the viewer's current skin immediately and renders the
 * supported features (transparency, the nose and the emissive
 * pixels). Call `controller.refresh()` after every
 * `viewer.loadSkin()`; call `controller.detach()` to restore the
 * viewer exactly as it was.
 *
 * @param viewer - The skinview3d viewer to extend.
 * @param options - Feature switches and texture overrides.
 * @returns The controller bound to this viewer.
 * @throws TypeError when `viewer` is not a skinview3d `SkinViewer`.
 */
export function attachETFSkinFeatures(
  viewer: SkinViewer,
  options: ETFSkinFeaturesOptions = {},
): ETFController {
  if (!viewer || !viewer.playerObject || !viewer.skinCanvas) {
    throw new TypeError(
      "attachETFSkinFeatures expects a skinview3d SkinViewer",
    );
  }
  const settings = normalizeOptions(options);
  const warned = new Set<string>();
  const materialOriginals = new Map<MeshStandardMaterial, MaterialState>();

  let decoded: DecodeResult | null = null;
  let baselinePixels: PixelData | null = null;
  let lastPainted: PixelData | null = null;
  let skinEdited = false;
  let noseMesh: NoseMesh | null = null;
  let glowTexture: CanvasTexture | null = null;
  let glowMaterial: MeshBasicMaterial | null = null;
  let glowMeshes: Mesh[] = [];
  let villagerTexture: HTMLCanvasElement | null = null;
  let villagerPending = false;
  let villagerFailed = false;
  let textureGeneration = 0;
  let detached = false;

  /**
   * Reports a warning once per unique message.
   *
   * @param message - The warning text.
   */
  function warn(message: string): void {
    if (warned.has(message)) {
      return;
    }
    warned.add(message);
    if (settings.onWarning !== null) {
      settings.onWarning(message);
    } else {
      console.warn(message);
    }
  }

  /**
   * Returns the six body parts of the current skin.
   *
   * @returns The parts, fetched from the live skin object.
   */
  function bodyParts() {
    const skin = viewer.playerObject.skin;
    return [
      skin.head,
      skin.body,
      skin.leftArm,
      skin.rightArm,
      skin.leftLeg,
      skin.rightLeg,
    ];
  }

  /**
   * Returns the head's layer-1 material (the nose material template).
   *
   * @returns The head material.
   */
  function headMaterial(): MeshStandardMaterial {
    const mesh = viewer.playerObject.skin.head.innerLayer as Mesh;
    const material = mesh.material;
    return (
      Array.isArray(material) ? material[0] : material
    ) as MeshStandardMaterial;
  }

  /**
   * Marks every skin map bound by the six parts as needing an update.
   */
  function markSkinDirty(): void {
    const maps = new Set<Texture>();
    for (const part of bodyParts()) {
      for (const layer of [part.innerLayer, part.outerLayer]) {
        const material = (layer as Mesh).material;
        const entries = Array.isArray(material) ? material : [material];
        for (const entry of entries) {
          const map = (entry as MeshStandardMaterial).map;
          if (map !== null) {
            maps.add(map);
          }
        }
      }
    }
    for (const map of maps) {
      map.needsUpdate = true;
    }
  }

  /** Removes and disposes the current nose mesh, if any. */
  function clearNose(): void {
    if (noseMesh !== null) {
      disposeNose(noseMesh);
      noseMesh = null;
    }
  }

  /** Removes and disposes the emissive overlays, material and texture. */
  function clearEmissive(): void {
    disposeEmissiveOverlays(glowMeshes);
    glowMeshes = [];
    if (glowMaterial !== null) {
      glowMaterial.dispose();
      glowMaterial = null;
    }
    if (glowTexture !== null) {
      glowTexture.dispose();
      glowTexture = null;
    }
  }

  /**
   * Starts resolving the villager nose texture in the background.
   * The result re-applies the features once loaded; stale loads (after
   * a texture replacement or detach) are discarded.
   */
  function ensureVillagerTexture(): void {
    if (
      villagerTexture !== null ||
      villagerPending ||
      villagerFailed ||
      detached
    ) {
      return;
    }
    const source = settings.villagerNoseTexture;
    if (source === null) {
      return;
    }
    const generation = textureGeneration;
    const input: ETFTextureInput = source ?? DEFAULT_VILLAGER_NOSE_DATA_URL;
    villagerPending = true;
    void resolveTextureInput(input)
      .then((canvas) => {
        villagerPending = false;
        if (detached || generation !== textureGeneration) {
          return;
        }
        villagerTexture = canvas;
        apply();
      })
      .catch((error: unknown) => {
        villagerPending = false;
        if (generation !== textureGeneration) {
          return;
        }
        villagerFailed = true;
        warn(`villager nose texture failed: ${String(error)}`);
      });
  }

  /**
   * (Re)builds the nose mesh for the current decode and features.
   */
  function rebuildNose(): void {
    clearNose();
    const nose = decoded?.nose ?? null;
    if (detached || !settings.features.nose || nose === null) {
      return;
    }
    const head = headMaterial();
    if (nose.villager && nose.villagerSkinTextured) {
      noseMesh = createVillagerNoseMesh(
        head,
        createSkinSpaceTexture(viewer.skinCanvas),
      );
    } else if (nose.villager) {
      if (settings.villagerNoseTexture === null) {
        return;
      }
      if (villagerTexture === null) {
        ensureVillagerTexture();
        return;
      }
      noseMesh = createVillagerNoseMesh(
        head,
        createSkinSpaceTexture(villagerTexture),
      );
    } else if (nose.texture !== null) {
      noseMesh = createTexturedNoseMesh(
        head,
        createSkinSpaceTexture(pixelsToCanvas(nose.texture), true),
      );
    }
    if (noseMesh !== null) {
      viewer.playerObject.skin.head.innerLayer.add(noseMesh);
    }
  }

  /**
   * (Re)builds the emissive overlays for the given pattern: the glow
   * texture is created on first use and repainted afterwards, the
   * shared material is created once, and the overlay meshes are
   * rebuilt from scratch.
   *
   * @param pattern - The decoded emissive pattern.
   */
  function rebuildEmissive(pattern: PatternInfo): void {
    disposeEmissiveOverlays(glowMeshes);
    glowMeshes = [];
    if (glowTexture === null) {
      glowTexture = createGlowTexture(pattern.mask);
    } else {
      repaintGlowTexture(glowTexture, pattern.mask);
    }
    if (glowMaterial === null) {
      glowMaterial = createEmissiveMaterial(glowTexture);
    }
    glowMeshes = createEmissiveOverlays(viewer.playerObject.skin, glowMaterial);
  }

  /**
   * Restores the baselines (canvas pixels and material flags), then
   * applies every enabled feature. Idempotent by construction.
   */
  function apply(): void {
    if (detached || decoded === null || !decoded.supported) {
      clearNose();
      clearEmissive();
      return;
    }
    const materials = collectLayerMaterials(viewer.playerObject.skin);
    restoreTransparent(materialOriginals);

    const transparencyActive =
      settings.features.transparency && decoded.transparency.enabled;
    const noseActive =
      settings.features.nose &&
      decoded.nose !== null &&
      !(
        decoded.nose.villager &&
        !decoded.nose.villagerSkinTextured &&
        settings.villagerNoseTexture === null
      );

    if (transparencyActive || noseActive) {
      paintCanvasPixels(viewer.skinCanvas, decoded.skin);
      lastPainted = cloneImage(decoded.skin);
      skinEdited = true;
      markSkinDirty();
    } else if (skinEdited) {
      if (baselinePixels !== null) {
        paintCanvasPixels(viewer.skinCanvas, baselinePixels);
        markSkinDirty();
      }
      skinEdited = false;
      lastPainted = null;
    }

    if (transparencyActive) {
      setTransparent(materials, materialOriginals, true);
    }
    rebuildNose();
    const emissive = decoded.emissive;
    if (settings.features.emissive && emissive !== null) {
      rebuildEmissive(emissive);
    } else {
      clearEmissive();
    }
  }

  /** Removes every render artifact and restores the baselines. */
  function unapply(): void {
    clearNose();
    clearEmissive();
    restoreTransparent(materialOriginals);
    if (skinEdited && baselinePixels !== null) {
      paintCanvasPixels(viewer.skinCanvas, baselinePixels);
      markSkinDirty();
    }
    skinEdited = false;
    lastPainted = null;
  }

  /**
   * Re-decodes the current skin and re-applies every enabled feature.
   * When the canvas still holds our own last paint, the saved baseline
   * is used as the decode source; otherwise the canvas is re-read.
   */
  function refresh(): void {
    if (detached) {
      return;
    }
    const current = readCanvasPixels(viewer.skinCanvas);
    let source = current;
    if (
      skinEdited &&
      lastPainted !== null &&
      baselinePixels !== null &&
      pixelsEqual(current, lastPainted)
    ) {
      source = baselinePixels;
    }
    baselinePixels = cloneImage(source);
    decoded = decodeSkin(source);
    for (const message of decoded.warnings) {
      warn(message);
    }
    if (!decoded.supported) {
      unapply();
      return;
    }
    apply();
  }

  /** Re-resolves the viewer's meshes and re-applies the state. */
  function rebind(): void {
    if (detached) {
      return;
    }
    apply();
  }

  /**
   * Advances time-based features; a no-op until the blinking commit,
   * where the ticker will drive it with seconds.
   */
  function update(): void {
    // Reserved: the blinking commit implements the watchdog here.
  }

  /** Restores everything and disposes the renderer resources. */
  function detach(): void {
    if (detached) {
      return;
    }
    unapply();
    textureGeneration++;
    villagerTexture = null;
    villagerPending = false;
    villagerFailed = false;
    baselinePixels = null;
    lastPainted = null;
    decoded = null;
    detached = true;
  }

  /**
   * Switches features on or off at runtime.
   *
   * @param features - The partial feature switches to merge.
   */
  function setFeatures(features: SkinFeatureToggles): void {
    if (detached) {
      return;
    }
    Object.assign(settings.features, features);
    apply();
  }

  /**
   * Replaces the villager nose texture at runtime.
   *
   * @param source - The new source, or `null` to disable villager
   * noses.
   */
  function setVillagerNoseTexture(source: ETFTextureInput | null): void {
    if (detached) {
      return;
    }
    settings.villagerNoseTexture = source;
    textureGeneration++;
    villagerTexture = null;
    villagerPending = false;
    villagerFailed = false;
    apply();
  }

  refresh();
  return {
    refresh,
    rebind,
    update,
    detach,
    setFeatures,
    setVillagerNoseTexture,
  };
}
