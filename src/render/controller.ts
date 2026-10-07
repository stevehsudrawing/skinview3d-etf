/**
 * The renderer controller behind `attachETFSkinFeatures()`: validates
 * the viewer, decodes the current skin and owns every render artifact
 * (canvas edits, material swaps, the nose mesh, the emissive and
 * enchanted overlays, the jacket shell and its overlays, the blink
 * repaints) with full restore on `detach()`. Teardown always
 * follows the same order: blink snapshot, ticker, nose, emissive,
 * enchanted, jacket, material swaps, canvas baseline.
 */

import type {
  BlinkInfo,
  DecodeResult,
  PatternInfo,
  PixelData,
} from "etf-skin-decoder";
import {
  cloneImage,
  createImage,
  decodeSkin,
  SKIN_SIZE,
} from "etf-skin-decoder";
import type { SkinViewer } from "skinview3d";
import type {
  BoxGeometry,
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  ShaderMaterial,
  Texture,
} from "three";
import {
  paintCanvasPixels,
  pixelsEqual,
  pixelsToCanvas,
  readCanvasPixels,
} from "./core/canvas";
import {
  DEFAULT_ENCHANTED_DATA_URL,
  DEFAULT_VILLAGER_NOSE_DATA_URL,
} from "./core/default-textures";
import {
  normalizeBlinkOptions,
  normalizeEnchantedOptions,
  normalizeOptions,
} from "./core/options";
import { createPartOverlays, disposeOverlays } from "./core/overlays";
import {
  bodyOuterMaterial,
  headLayerMaterial,
  layerMapsOf,
} from "./core/parts";
import { createTextureSlot, type TextureSlot } from "./core/texture-slot";
import {
  createMaskTexture,
  createSkinSpaceTexture,
  repaintMaskTexture,
} from "./core/textures";
import { startTicker, type TickerHandle } from "./core/ticker";
import type {
  BlinkOptions,
  EnchantedOptions,
  ETFController,
  ETFSkinFeaturesOptions,
  SkinFeatureToggles,
  VillagerNoseOptions,
} from "./core/types";
import {
  blinkSeed,
  blinkStateFrame,
  createBlinkOverlay,
  createBlinkPainter,
  createBlinkScheduler,
  type BlinkOverlay,
  type BlinkPainter,
  type BlinkScheduler,
} from "./features/blink";
import { createEmissiveMaterial } from "./features/emissive";
import {
  advanceEnchantedOffset,
  createEnchantedMaterial,
  createEnchantedTexture,
  ENCHANTED_RENDER_ORDER,
  setEnchantedOffset,
  setEnchantedTuning,
  updateEnchantedTexture,
  type EnchantedOffset,
} from "./features/enchanted";
import {
  createJacketGeometry,
  createJacketMaterial,
  createJacketMesh,
  createJacketOverlayMesh,
  disposeJacketMesh,
} from "./features/jacket";
import {
  createTexturedNoseMesh,
  createVillagerNoseMesh,
  disposeNose,
  type NoseMesh,
} from "./features/nose";
import { createTranslucentSides } from "./features/transparency";

/**
 * A fully transparent, skin-sized overlay mask used whenever a blink
 * frame carries no overlay pixels of its own.
 */
const EMPTY_OVERLAY_MASK: PixelData = createImage(SKIN_SIZE, SKIN_SIZE);

/** Cached mesh lookups for the current viewer binding. */
interface SkinTargets {
  /** The unique textures bound by the six parts' layers. */
  maps: Texture[];
}

/**
 * Attaches the ETF skin features to a live skinview3d viewer.
 *
 * Decodes the viewer's current skin immediately and renders the
 * supported features (transparency, the nose, the emissive pixels,
 * blinking eyes, the enchanted pixels and the jacket). Call
 * `controller.refresh()` after every `viewer.loadSkin()`; call
 * `controller.detach()` to restore the viewer exactly as it was.
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
  const sides = createTranslucentSides();

  const villagerSlot: TextureSlot = createTextureSlot();
  const enchantedSlot: TextureSlot = createTextureSlot();
  let decoded: DecodeResult | null = null;
  let targets: SkinTargets | null = null;
  let baselinePixels: PixelData | null = null;
  let lastPainted: PixelData | null = null;
  let skinEdited = false;
  let noseMesh: NoseMesh | null = null;
  let jacketMesh: Mesh | null = null;
  let jacketEnchantedMaterial: ShaderMaterial | null = null;
  let jacketGeometries: Map<"thin" | "wide", BoxGeometry> | null = null;
  let emissiveTexture: CanvasTexture | null = null;
  let emissiveMaterial: MeshBasicMaterial | null = null;
  let emissiveMeshes: Mesh[] = [];
  let enchantedMaskTexture: CanvasTexture | null = null;
  let enchantedPatternTexture: CanvasTexture | null = null;
  let enchantedMaterial: ShaderMaterial | null = null;
  let enchantedMeshes: Mesh[] = [];
  let enchantedOffset: EnchantedOffset = { x: 0, y: 0 };
  let blinkPainter: BlinkPainter | null = null;
  let blinkScheduler: BlinkScheduler | null = null;
  let ticker: TickerHandle | null = null;
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
   * Rebuilds the cached mesh lookups ({@link SkinTargets}) from the
   * live skin. `apply()` calls this, so `rebind()` and `refresh()`
   * after host model swaps stay covered.
   *
   * @returns The fresh lookup snapshot.
   */
  function resolveTargets(): SkinTargets {
    const resolved: SkinTargets = {
      maps: layerMapsOf(viewer.playerObject.skin),
    };
    targets = resolved;
    return resolved;
  }

  /**
   * Marks every texture bound by the six parts as needing an update;
   * uses the cached lookup and falls back to a fresh scan when called
   * before the first `apply()`.
   */
  function markSkinDirty(): void {
    const maps = targets?.maps ?? layerMapsOf(viewer.playerObject.skin);
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
    disposeOverlays(emissiveMeshes);
    emissiveMeshes = [];
    if (emissiveMaterial !== null) {
      emissiveMaterial.dispose();
      emissiveMaterial = null;
    }
    if (emissiveTexture !== null) {
      emissiveTexture.dispose();
      emissiveTexture = null;
    }
  }

  /**
   * Removes and disposes the enchanted overlays, material and
   * textures; the full-dispose route for the feature-off, `unapply()`
   * and `detach()` paths - a plain re-apply updates the assets in
   * place instead.
   */
  function clearEnchanted(): void {
    disposeOverlays(enchantedMeshes);
    enchantedMeshes = [];
    if (enchantedMaterial !== null) {
      enchantedMaterial.dispose();
      enchantedMaterial = null;
    }
    if (enchantedMaskTexture !== null) {
      enchantedMaskTexture.dispose();
      enchantedMaskTexture = null;
    }
    if (enchantedPatternTexture !== null) {
      enchantedPatternTexture.dispose();
      enchantedPatternTexture = null;
    }
  }

  /**
   * Removes and disposes the jacket mesh tree (the shell and its
   * overlay children); the cached geometries survive until
   * `detach()`.
   */
  function clearJacket(): void {
    if (jacketMesh !== null) {
      disposeJacketMesh(jacketMesh);
      jacketMesh = null;
    }
    jacketEnchantedMaterial = null;
  }

  /** Restores and drops the current blink painter and scheduler. */
  function teardownBlink(): void {
    if (blinkPainter !== null) {
      blinkPainter.restore();
      blinkPainter = null;
    }
    blinkScheduler = null;
  }

  /**
   * Builds the overlay integrations for the blink painter: one per
   * active overlay feature (the emissive and / or the enchanted
   * mask), each with precomputed per-frame masks, so toggling a
   * frame only repaints the feature's texture.
   *
   * @param info - The decoded blink data.
   * @returns The overlay hooks in draw order.
   */
  function buildBlinkOverlays(info: BlinkInfo): BlinkOverlay[] {
    const overlays: BlinkOverlay[] = [];
    if (settings.features.emissive && emissiveTexture !== null) {
      const emissiveOverlay = createBlinkOverlay(
        info,
        decoded?.emissive ?? null,
        (mask) => {
          if (emissiveTexture !== null) {
            repaintMaskTexture(emissiveTexture, mask ?? EMPTY_OVERLAY_MASK);
          }
        },
      );
      if (emissiveOverlay !== null) {
        overlays.push(emissiveOverlay);
      }
    }
    if (settings.features.enchanted && enchantedMaskTexture !== null) {
      const enchantedOverlay = createBlinkOverlay(
        info,
        decoded?.enchanted ?? null,
        (mask) => {
          if (enchantedMaskTexture !== null) {
            repaintMaskTexture(
              enchantedMaskTexture,
              mask ?? EMPTY_OVERLAY_MASK,
            );
          }
        },
      );
      if (enchantedOverlay !== null) {
        overlays.push(enchantedOverlay);
      }
    }
    return overlays;
  }

  /**
   * (Re)builds the blink painter and scheduler for the current decode
   * and applies the configured eye state.
   */
  function setupBlink(): void {
    const info = decoded?.blink ?? null;
    if (
      detached ||
      !settings.features.blink ||
      decoded === null ||
      !decoded.supported ||
      info === null
    ) {
      return;
    }
    blinkScheduler = createBlinkScheduler(
      info.frames.length,
      settings.blink,
      blinkSeed(decoded.skin.data),
    );
    blinkPainter = createBlinkPainter(
      viewer.skinCanvas,
      info,
      buildBlinkOverlays(info),
      markSkinDirty,
    );
    blinkPainter.show(blinkStateFrame(settings.blink.state, info));
  }

  /** Disposes the managed ticker, if one is attached. */
  function stopTicker(): void {
    if (ticker !== null) {
      ticker.dispose();
      ticker = null;
    }
  }

  /**
   * Whether the enchanted overlay needs per-frame updates: the
   * feature is on, a built material exists and the pattern actually
   * moves (the speed is not zero and the direction is not `[0, 0]`).
   *
   * @returns `true` while the enchanted pattern scrolls.
   */
  function enchantedActive(): boolean {
    return (
      settings.features.enchanted &&
      settings.enchanted.speed !== 0 &&
      (settings.enchanted.direction[0] !== 0 ||
        settings.enchanted.direction[1] !== 0) &&
      enchantedMaterial !== null
    );
  }

  /**
   * Starts or stops the managed ticker so it runs exactly while the
   * blink feature auto-cycles or the enchanted pattern scrolls.
   */
  function syncTicker(): void {
    const blinkNeeded =
      settings.features.blink &&
      settings.blink.state === "auto" &&
      decoded !== null &&
      decoded.supported &&
      decoded.blink !== null;
    const needed = settings.manageTicker && (blinkNeeded || enchantedActive());
    if (needed && ticker === null) {
      ticker = startTicker(viewer, update);
    } else if (!needed) {
      stopTicker();
    }
  }

  /**
   * (Re)builds the nose mesh for the current decode and features. The
   * villager texture resolves asynchronously through the slot; the
   * build waits for it.
   */
  function rebuildNose(): void {
    clearNose();
    const nose = decoded?.nose ?? null;
    if (detached || !settings.features.nose || nose === null) {
      return;
    }
    const head = headLayerMaterial(viewer.playerObject.skin);
    if (nose.villager && nose.villagerTextured) {
      noseMesh = createVillagerNoseMesh(
        head,
        createSkinSpaceTexture(viewer.skinCanvas),
      );
    } else if (nose.villager) {
      if (settings.villagerNose.texture === null) {
        return;
      }
      if (villagerSlot.canvas === null) {
        villagerSlot.ensure(
          settings.villagerNose.texture ?? DEFAULT_VILLAGER_NOSE_DATA_URL,
          apply,
          (error) => {
            warn(`villager nose texture failed: ${String(error)}`);
          },
        );
        return;
      }
      noseMesh = createVillagerNoseMesh(
        head,
        createSkinSpaceTexture(villagerSlot.canvas),
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
   * (Re)builds the emissive overlays for the given pattern: the
   * emissive texture is created on first use and repainted
   * afterwards, the shared material is created once, and the overlay
   * meshes are rebuilt from scratch.
   *
   * @param pattern - The decoded emissive pattern.
   */
  function rebuildEmissive(pattern: PatternInfo): void {
    disposeOverlays(emissiveMeshes);
    emissiveMeshes = [];
    if (emissiveTexture === null) {
      emissiveTexture = createMaskTexture(pattern.mask);
    } else {
      repaintMaskTexture(emissiveTexture, pattern.mask);
    }
    if (emissiveMaterial === null) {
      emissiveMaterial = createEmissiveMaterial(emissiveTexture);
    }
    emissiveMeshes = createPartOverlays(
      viewer.playerObject.skin,
      emissiveMaterial,
      "etf-emissive",
    );
  }

  /**
   * (Re)builds the enchanted overlays for the current decode: the
   * mask texture, the pattern texture and the shared material are
   * created once and updated in place afterwards, and the overlay
   * meshes (drawn above the emissive overlay) go through the shared
   * builder. The pattern texture resolves
   * asynchronously through the slot; the build waits for it.
   */
  function rebuildEnchanted(): void {
    disposeOverlays(enchantedMeshes);
    enchantedMeshes = [];
    const pattern = decoded?.enchanted ?? null;
    if (detached || !settings.features.enchanted || pattern === null) {
      return;
    }
    if (settings.enchanted.texture === null) {
      return;
    }
    if (enchantedSlot.canvas === null) {
      enchantedSlot.ensure(
        settings.enchanted.texture ?? DEFAULT_ENCHANTED_DATA_URL,
        apply,
        (error) => {
          warn(`enchanted texture failed: ${String(error)}`);
        },
      );
      return;
    }
    if (enchantedMaskTexture === null) {
      enchantedMaskTexture = createMaskTexture(pattern.mask);
    } else {
      repaintMaskTexture(enchantedMaskTexture, pattern.mask);
    }
    if (enchantedPatternTexture === null) {
      enchantedPatternTexture = createEnchantedTexture(
        enchantedSlot.canvas,
        settings.enchanted.smooth,
      );
    } else {
      updateEnchantedTexture(
        enchantedPatternTexture,
        enchantedSlot.canvas,
        settings.enchanted.smooth,
      );
    }
    if (enchantedMaterial === null) {
      enchantedMaterial = createEnchantedMaterial(
        enchantedMaskTexture,
        enchantedPatternTexture,
        settings.enchanted.scale,
        settings.enchanted.opacity,
        enchantedOffset,
      );
    } else {
      setEnchantedTuning(
        enchantedMaterial,
        settings.enchanted.scale,
        settings.enchanted.opacity,
      );
    }
    enchantedMeshes = createPartOverlays(
      viewer.playerObject.skin,
      enchantedMaterial,
      "etf-enchanted",
      ENCHANTED_RENDER_ORDER,
    );
  }

  /**
   * Returns the cached thin / wide shell geometry, building it on
   * first use.
   *
   * @param wide - Whether the shell is the wide variant.
   * @returns The shared geometry (disposed on `detach()`).
   */
  function jacketGeometry(wide: boolean): BoxGeometry {
    const key = wide ? "wide" : "thin";
    if (jacketGeometries === null) {
      jacketGeometries = new Map();
    }
    let geometry = jacketGeometries.get(key);
    if (geometry === undefined) {
      geometry = createJacketGeometry(wide);
      jacketGeometries.set(key, geometry);
    }
    return geometry;
  }

  /** Disposes the cached jacket geometries. */
  function disposeJacketGeometries(): void {
    if (jacketGeometries !== null) {
      for (const geometry of jacketGeometries.values()) {
        geometry.dispose();
      }
      jacketGeometries = null;
    }
  }

  /**
   * (Re)builds the jacket mesh tree for the current decode: the
   * shell under the body's outer layer (anchored by
   * `createJacketMesh`), plus the emissive and enchanted overlay
   * children the decoded masks select.
   */
  function rebuildJacket(): void {
    clearJacket();
    const jacket = decoded?.jacket ?? null;
    if (detached || !settings.features.jacket || jacket === null) {
      return;
    }
    const geometry = jacketGeometry(jacket.wide);
    const skin = viewer.playerObject.skin;
    const mesh = createJacketMesh(
      geometry,
      createJacketMaterial(
        bodyOuterMaterial(skin),
        createSkinSpaceTexture(pixelsToCanvas(jacket.texture)),
      ),
    );
    if (settings.features.emissive && jacket.emissiveMask !== null) {
      mesh.add(
        createJacketOverlayMesh(
          geometry,
          createEmissiveMaterial(
            createSkinSpaceTexture(pixelsToCanvas(jacket.emissiveMask)),
          ),
          "etf-jacket-emissive",
          0,
        ),
      );
    }
    if (
      settings.features.enchanted &&
      jacket.enchantedMask !== null &&
      enchantedPatternTexture !== null
    ) {
      jacketEnchantedMaterial = createEnchantedMaterial(
        createSkinSpaceTexture(pixelsToCanvas(jacket.enchantedMask)),
        enchantedPatternTexture,
        settings.enchanted.scale,
        settings.enchanted.opacity,
        enchantedOffset,
      );
      mesh.add(
        createJacketOverlayMesh(
          geometry,
          jacketEnchantedMaterial,
          "etf-jacket-enchanted",
          ENCHANTED_RENDER_ORDER,
        ),
      );
    }
    skin.body.outerLayer.add(mesh);
    jacketMesh = mesh;
  }

  /**
   * Restores the baselines (canvas pixels and material flags), then
   * applies every enabled feature. Idempotent by construction.
   */
  function apply(): void {
    teardownBlink();
    if (detached || decoded === null || !decoded.supported) {
      clearNose();
      clearEmissive();
      clearEnchanted();
      clearJacket();
      syncTicker();
      return;
    }
    resolveTargets();

    const transparencyActive =
      settings.features.transparency && decoded.transparency.enabled;
    const noseActive =
      settings.features.nose &&
      decoded.nose !== null &&
      !(
        decoded.nose.villager &&
        !decoded.nose.villagerTextured &&
        settings.villagerNose.texture === null
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

    const skin = viewer.playerObject.skin;
    sides.sync(skin, decoded.skin, skin.modelType, transparencyActive);
    rebuildNose();
    const emissive = decoded.emissive;
    if (settings.features.emissive && emissive !== null) {
      rebuildEmissive(emissive);
    } else {
      clearEmissive();
    }
    const enchanted = decoded.enchanted;
    if (settings.features.enchanted && enchanted !== null) {
      rebuildEnchanted();
    } else {
      clearEnchanted();
    }
    if (settings.features.jacket && decoded.jacket !== null) {
      rebuildJacket();
    } else {
      clearJacket();
    }
    setupBlink();
    syncTicker();
  }

  /** Removes every render artifact and restores the baselines. */
  function unapply(): void {
    teardownBlink();
    stopTicker();
    clearNose();
    clearEmissive();
    clearEnchanted();
    clearJacket();
    sides.restore();
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
    if (blinkPainter !== null) {
      blinkPainter.restore();
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

  /**
   * Re-resolves the viewer's meshes and re-applies the state, then
   * re-attaches the managed ticker (the host may have replaced the
   * animation slot).
   */
  function rebind(): void {
    if (detached) {
      return;
    }
    stopTicker();
    apply();
  }

  /**
   * Advances the time-based features (the blink schedule and the
   * enchanted offset) by `dt` seconds; negative and non-finite deltas
   * are ignored. The managed ticker calls this automatically unless
   * `manageTicker` is `false`.
   *
   * @param dt - Time since the previous update, in seconds.
   */
  function update(dt: number): void {
    if (detached) {
      return;
    }
    const seconds = Number.isFinite(dt) && dt > 0 ? dt : 0;
    if (
      blinkScheduler !== null &&
      blinkPainter !== null &&
      settings.blink.state === "auto"
    ) {
      blinkPainter.show(blinkScheduler.advance(seconds * 1000));
    }
    if (enchantedActive() && enchantedMaterial !== null) {
      enchantedOffset = advanceEnchantedOffset(
        enchantedOffset,
        settings.enchanted.speed,
        settings.enchanted.direction,
        seconds,
        settings.enchanted.scale,
      );
      setEnchantedOffset(enchantedMaterial, enchantedOffset);
      if (jacketEnchantedMaterial !== null) {
        setEnchantedOffset(jacketEnchantedMaterial, enchantedOffset);
      }
    }
  }

  /** Restores everything and disposes the renderer resources. */
  function detach(): void {
    if (detached) {
      return;
    }
    unapply();
    sides.dispose();
    disposeJacketGeometries();
    villagerSlot.reset();
    enchantedSlot.reset();
    enchantedOffset = { x: 0, y: 0 };
    baselinePixels = null;
    lastPainted = null;
    decoded = null;
    detached = true;
  }

  /**
   * Merges feature switches at runtime; an explicit `undefined`
   * keeps the current value (same as an omitted property).
   *
   * @param features - The partial feature switches to merge.
   */
  function setFeatures(features: SkinFeatureToggles): void {
    if (detached) {
      return;
    }
    settings.features = {
      transparency: features.transparency ?? settings.features.transparency,
      emissive: features.emissive ?? settings.features.emissive,
      blink: features.blink ?? settings.features.blink,
      nose: features.nose ?? settings.features.nose,
      jacket: features.jacket ?? settings.features.jacket,
      enchanted: features.enchanted ?? settings.features.enchanted,
    };
    apply();
  }

  /**
   * Merges villager nose options at runtime; an omitted `texture`
   * keeps the current one, `texture: undefined` restores the
   * built-in default, `null` disables villager noses and any other
   * value replaces the texture (resetting pending or resolved
   * loads).
   *
   * @param options - The partial villager nose options to apply.
   */
  function setVillagerNoseOptions(options: VillagerNoseOptions): void {
    if (detached) {
      return;
    }
    if ("texture" in options) {
      settings.villagerNose.texture = options.texture;
      villagerSlot.reset();
    }
    apply();
  }

  /**
   * Merges enchanted options (texture and / or motion parameters) at
   * runtime; an omitted property keeps its current value except
   * `texture`: an omitted `texture` keeps it, `texture: undefined`
   * restores the built-in default and `texture: null` disables the
   * enchanted pixels. The merged values go through the full
   * normalization, so invalid numbers fall back to the documented
   * defaults.
   *
   * @param options - The partial enchanted options to apply.
   */
  function setEnchantedOptions(options: EnchantedOptions): void {
    if (detached) {
      return;
    }
    const hasTexture = "texture" in options;
    settings.enchanted = normalizeEnchantedOptions({
      texture: hasTexture ? options.texture : settings.enchanted.texture,
      speed: options.speed ?? settings.enchanted.speed,
      direction: options.direction ?? settings.enchanted.direction,
      opacity: options.opacity ?? settings.enchanted.opacity,
      scale: options.scale ?? settings.enchanted.scale,
      smooth: options.smooth ?? settings.enchanted.smooth,
    });
    if (hasTexture) {
      enchantedSlot.reset();
    }
    apply();
  }

  /**
   * Merges blink options (state and/or timing) and restarts the
   * blink schedule; an explicit `undefined` keeps the current value
   * (same as an omitted property).
   *
   * @param options - The partial blink options to apply.
   */
  function setBlinkOptions(options: BlinkOptions): void {
    if (detached) {
      return;
    }
    settings.blink = normalizeBlinkOptions({
      state: options.state ?? settings.blink.state,
      periodMs: options.periodMs ?? settings.blink.interval,
      closedMs: options.closedMs ?? settings.blink.closedMs,
      halfClosedMs: options.halfClosedMs ?? settings.blink.halfClosedMs,
      reopenMs: options.reopenMs ?? settings.blink.reopenMs,
    });
    apply();
  }

  refresh();
  return {
    refresh,
    rebind,
    update,
    detach,
    setFeatures,
    setVillagerNoseOptions,
    setEnchantedOptions,
    setBlinkOptions,
  };
}
