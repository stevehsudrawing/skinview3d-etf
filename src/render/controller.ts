/**
 * The renderer controller behind `attachETFSkinFeatures()`: validates
 * the viewer, decodes the current skin and owns every render artifact
 * (canvas edits, material swaps, the nose mesh, the emissive and
 * glint overlays, the blink repaints) with full restore on
 * `detach()`. Teardown always follows the same order: blink
 * snapshot, ticker, nose, emissive, glint, material swaps, canvas
 * baseline.
 */

import type { SkinViewer } from "skinview3d";
import type {
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  ShaderMaterial,
  Texture,
} from "three";
import { SKIN_SIZE } from "../decode/core/constants";
import { cloneImage, createImage } from "../decode/core/pixels";
import type {
  BlinkInfo,
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
import {
  DEFAULT_GLINT_DATA_URL,
  DEFAULT_VILLAGER_NOSE_DATA_URL,
} from "./core/default-textures";
import {
  normalizeBlinkOptions,
  normalizeGlintOptions,
  normalizeOptions,
} from "./core/options";
import { createPartOverlays, disposeOverlays } from "./core/overlays";
import { headLayerMaterial, layerMapsOf } from "./core/parts";
import { createTextureSlot, type TextureSlot } from "./core/texture-slot";
import {
  createMaskTexture,
  createSkinSpaceTexture,
  repaintMaskTexture,
} from "./core/textures";
import { startTicker, type TickerHandle } from "./core/ticker";
import type {
  BlinkOptions,
  ETFController,
  ETFSkinFeaturesOptions,
  GlintOptions,
  SkinFeatureToggles,
  VillagerNoseOptions,
} from "./core/types";
import {
  blinkSeed,
  blinkStateFrame,
  createBlinkPainter,
  createBlinkScheduler,
  createPatternGlow,
  type BlinkGlow,
  type BlinkPainter,
  type BlinkScheduler,
} from "./features/blinking";
import { createEmissiveMaterial } from "./features/emissive";
import {
  advanceGlintPhase,
  createGlintMaterial,
  createGlintTexture,
  setGlintPhase,
  setGlintTuning,
  updateGlintTexture,
} from "./features/glint";
import {
  createTexturedNoseMesh,
  createVillagerNoseMesh,
  disposeNose,
  type NoseMesh,
} from "./features/nose";
import { createTranslucentSides } from "./features/transparency";

/**
 * A fully transparent, skin-sized glow mask used whenever a blink
 * frame has no glowing pixels of its own.
 */
const EMPTY_GLOW_MASK: PixelData = createImage(SKIN_SIZE, SKIN_SIZE);

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
 * blinking eyes and the enchanted glint). Call
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
  const glintSlot: TextureSlot = createTextureSlot();
  let decoded: DecodeResult | null = null;
  let targets: SkinTargets | null = null;
  let baselinePixels: PixelData | null = null;
  let lastPainted: PixelData | null = null;
  let skinEdited = false;
  let noseMesh: NoseMesh | null = null;
  let glowTexture: CanvasTexture | null = null;
  let glowMaterial: MeshBasicMaterial | null = null;
  let glowMeshes: Mesh[] = [];
  let glintMaskTexture: CanvasTexture | null = null;
  let glintPatternTexture: CanvasTexture | null = null;
  let glintMaterial: ShaderMaterial | null = null;
  let glintMeshes: Mesh[] = [];
  let glintPhase = 0;
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
    disposeOverlays(glowMeshes);
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
   * Removes and disposes the glint overlays, material and textures;
   * the full-dispose route for the feature-off, `unapply()` and
   * `detach()` paths - a plain re-apply updates the assets in place
   * instead.
   */
  function clearGlint(): void {
    disposeOverlays(glintMeshes);
    glintMeshes = [];
    if (glintMaterial !== null) {
      glintMaterial.dispose();
      glintMaterial = null;
    }
    if (glintMaskTexture !== null) {
      glintMaskTexture.dispose();
      glintMaskTexture = null;
    }
    if (glintPatternTexture !== null) {
      glintPatternTexture.dispose();
      glintPatternTexture = null;
    }
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
   * Builds the glow integrations for the blink painter: one per
   * active overlay feature (the emissive glow and / or the glint
   * mask), each with precomputed per-frame masks, so toggling a
   * frame only repaints the feature's texture.
   *
   * @param info - The decoded blink data.
   * @returns The glow hooks in draw order.
   */
  function buildBlinkGlows(info: BlinkInfo): BlinkGlow[] {
    const glows: BlinkGlow[] = [];
    if (settings.features.emissive && glowTexture !== null) {
      const glow = createPatternGlow(
        info,
        decoded?.emissive ?? null,
        (mask) => {
          if (glowTexture !== null) {
            repaintMaskTexture(glowTexture, mask ?? EMPTY_GLOW_MASK);
          }
        },
      );
      if (glow !== null) {
        glows.push(glow);
      }
    }
    if (settings.features.enchanted && glintMaskTexture !== null) {
      const glow = createPatternGlow(
        info,
        decoded?.enchanted ?? null,
        (mask) => {
          if (glintMaskTexture !== null) {
            repaintMaskTexture(glintMaskTexture, mask ?? EMPTY_GLOW_MASK);
          }
        },
      );
      if (glow !== null) {
        glows.push(glow);
      }
    }
    return glows;
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
      buildBlinkGlows(info),
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
   * Whether the glint needs per-frame updates: the feature is on, a
   * built material exists and the speed is not zero.
   *
   * @returns `true` while the glint scrolls.
   */
  function glintActive(): boolean {
    return (
      settings.features.enchanted &&
      settings.glint.speed !== 0 &&
      glintMaterial !== null
    );
  }

  /**
   * Starts or stops the managed ticker so it runs exactly while the
   * blink feature auto-cycles or the glint scrolls.
   */
  function syncTicker(): void {
    const blinkNeeded =
      settings.features.blink &&
      settings.blink.state === "auto" &&
      decoded !== null &&
      decoded.supported &&
      decoded.blink !== null;
    const needed = settings.manageTicker && (blinkNeeded || glintActive());
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
    if (nose.villager && nose.villagerSkinTextured) {
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
   * (Re)builds the emissive overlays for the given pattern: the glow
   * texture is created on first use and repainted afterwards, the
   * shared material is created once, and the overlay meshes are
   * rebuilt from scratch.
   *
   * @param pattern - The decoded emissive pattern.
   */
  function rebuildEmissive(pattern: PatternInfo): void {
    disposeOverlays(glowMeshes);
    glowMeshes = [];
    if (glowTexture === null) {
      glowTexture = createMaskTexture(pattern.mask);
    } else {
      repaintMaskTexture(glowTexture, pattern.mask);
    }
    if (glowMaterial === null) {
      glowMaterial = createEmissiveMaterial(glowTexture);
    }
    glowMeshes = createPartOverlays(
      viewer.playerObject.skin,
      glowMaterial,
      "etf-emissive",
    );
  }

  /**
   * (Re)builds the glint overlays for the current decode: the mask
   * texture, the pattern texture and the shared material are created
   * once and updated in place afterwards, and the overlay meshes
   * (render order 1, on top of the emissive glow) go through the
   * shared builder. The pattern texture resolves asynchronously
   * through the slot; the build waits for it.
   */
  function rebuildGlint(): void {
    disposeOverlays(glintMeshes);
    glintMeshes = [];
    const pattern = decoded?.enchanted ?? null;
    if (detached || !settings.features.enchanted || pattern === null) {
      return;
    }
    if (settings.glint.texture === null) {
      return;
    }
    if (glintSlot.canvas === null) {
      glintSlot.ensure(
        settings.glint.texture ?? DEFAULT_GLINT_DATA_URL,
        apply,
        (error) => {
          warn(`glint texture failed: ${String(error)}`);
        },
      );
      return;
    }
    if (glintMaskTexture === null) {
      glintMaskTexture = createMaskTexture(pattern.mask);
    } else {
      repaintMaskTexture(glintMaskTexture, pattern.mask);
    }
    if (glintPatternTexture === null) {
      glintPatternTexture = createGlintTexture(
        glintSlot.canvas,
        settings.glint.smooth,
      );
    } else {
      updateGlintTexture(
        glintPatternTexture,
        glintSlot.canvas,
        settings.glint.smooth,
      );
    }
    if (glintMaterial === null) {
      glintMaterial = createGlintMaterial(
        glintMaskTexture,
        glintPatternTexture,
        settings.glint.scale,
        settings.glint.opacity,
        glintPhase,
      );
    } else {
      setGlintTuning(
        glintMaterial,
        settings.glint.scale,
        settings.glint.opacity,
      );
    }
    glintMeshes = createPartOverlays(
      viewer.playerObject.skin,
      glintMaterial,
      "etf-glint",
      1,
    );
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
      clearGlint();
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
        !decoded.nose.villagerSkinTextured &&
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
      rebuildGlint();
    } else {
      clearGlint();
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
    clearGlint();
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
   * glint phase) by `dt` seconds; negative deltas are ignored. The
   * managed ticker calls this automatically unless `manageTicker` is
   * `false`.
   *
   * @param dt - Time since the previous update, in seconds.
   */
  function update(dt: number): void {
    if (detached) {
      return;
    }
    const seconds = Math.max(0, dt);
    if (
      blinkScheduler !== null &&
      blinkPainter !== null &&
      settings.blink.state === "auto"
    ) {
      blinkPainter.show(blinkScheduler.advance(seconds * 1000));
    }
    if (glintActive() && glintMaterial !== null) {
      glintPhase = advanceGlintPhase(
        glintPhase,
        settings.glint.speed,
        seconds,
        settings.glint.scale,
      );
      setGlintPhase(glintMaterial, glintPhase);
    }
  }

  /** Restores everything and disposes the renderer resources. */
  function detach(): void {
    if (detached) {
      return;
    }
    unapply();
    sides.dispose();
    villagerSlot.reset();
    glintSlot.reset();
    glintPhase = 0;
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
   * Merges glint options (texture and / or motion parameters) at
   * runtime; an omitted property keeps its current value except
   * `texture`: an omitted `texture` keeps it, `texture: undefined`
   * restores the built-in default and `texture: null` disables the
   * glint. The merged values go through the full normalization, so
   * invalid numbers fall back to the documented defaults.
   *
   * @param options - The partial glint options to apply.
   */
  function setGlintOptions(options: GlintOptions): void {
    if (detached) {
      return;
    }
    const hasTexture = "texture" in options;
    settings.glint = normalizeGlintOptions({
      texture: hasTexture ? options.texture : settings.glint.texture,
      speed: options.speed ?? settings.glint.speed,
      opacity: options.opacity ?? settings.glint.opacity,
      scale: options.scale ?? settings.glint.scale,
      smooth: options.smooth ?? settings.glint.smooth,
    });
    if (hasTexture) {
      glintSlot.reset();
    }
    apply();
  }

  /**
   * Merges blink options (state and/or timing) and restarts the
   * blink schedule.
   *
   * @param options - The partial blink options to apply.
   */
  function setBlinkOptions(options: BlinkOptions): void {
    if (detached) {
      return;
    }
    settings.blink = normalizeBlinkOptions({
      state: settings.blink.state,
      periodMs: settings.blink.interval,
      closedMs: settings.blink.closedMs,
      halfClosedMs: settings.blink.halfClosedMs,
      reopenMs: settings.blink.reopenMs,
      ...options,
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
    setGlintOptions,
    setBlinkOptions,
  };
}
