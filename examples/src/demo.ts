/**
 * The 3D demo tab: the page assembly around the shared fixture bar.
 *
 * Creates a `SkinViewer` inside a square stage (with a `reset`
 * overlay that restores the camera pose), attaches the ETF features
 * through the public `attachETFSkinFeatures()` API and offers three
 * aligned control tables grouped by owning package (the extension,
 * the blockbench animation provider, the host viewer; the builders
 * live in `controls.ts`, the provider group in `blockbench.ts`).
 * Every row shows one API keyword at its API-path depth with the
 * dotted path and description in the tooltip; rows the current
 * skin has no decode data for gray out, the blink / glint rows
 * couple to their feature switches, and function rows carry
 * `execute` buttons with their parameters as children (values the
 * demo derives render as locked read-only inputs). The host picker
 * and the
 * blockbench pair share the single `viewer.animation` slot and call
 * `controller.rebind()` whenever the slot object changes; the skin
 * shown comes from the shared fixture bar above the tabs.
 */

import {
  CrouchAnimation,
  FlyingAnimation,
  HitAnimation,
  IdleAnimation,
  RunningAnimation,
  SkinViewer,
  SwimAnimation,
  WalkingAnimation,
  WaveAnimation,
  type PlayerAnimation,
  type SkinLoadOptions,
} from "skinview3d";
import type { BlinkState, DecodeResult, ETFController } from "../../src/index";
import {
  attachETFSkinFeatures,
  decodeSkin,
  DEFAULT_BLINK_OPTIONS,
  DEFAULT_GLINT_OPTIONS,
} from "../../src/index";
import { createBlockbenchGroup } from "./blockbench";
import {
  actionButton,
  controlTable,
  executeButton,
  lockedInput,
  numberInput,
  optionRow,
  setRowDisabled,
  setRowInapplicable,
} from "./controls";
import {
  getSelectedFixture,
  loadImageData,
  onFixtureSelected,
  type Fixture,
} from "./fixtures";
import { createTexturePicker } from "./texture-picker";

/** Built-in action presets offered by the demo. */
const ANIMATIONS: ReadonlyArray<{
  /** Option value shown in the picker. */
  id: string;
  /** Creates a fresh instance of the animation. */
  create: () => PlayerAnimation;
}> = [
  { id: "idle", create: () => new IdleAnimation() },
  { id: "walk", create: () => new WalkingAnimation() },
  { id: "run", create: () => new RunningAnimation() },
  {
    id: "crouch",
    create: () => {
      const animation = new CrouchAnimation();
      // Without `runOnce` the pose toggles between standing and
      // crouching eight times per progress unit.
      animation.runOnce = true;
      return animation;
    },
  },
  { id: "wave", create: () => new WaveAnimation() },
  { id: "hit", create: () => new HitAnimation() },
  { id: "swim", create: () => new SwimAnimation() },
  { id: "fly", create: () => new FlyingAnimation() },
];

/** Model picker entries: the raw `loadSkin()` model values. */
const MODEL_OPTIONS: ReadonlyArray<{
  /** Value passed to `loadSkin()`. */
  model: NonNullable<SkinLoadOptions["model"]>;
}> = [{ model: "auto-detect" }, { model: "default" }, { model: "slim" }];

/** Handle used by the tab shell to pause a hidden viewer. */
export interface DemoHandle {
  /** Resumes rendering once the tab is visible again. */
  activate(): void;
  /** Pauses rendering while the tab is hidden. */
  deactivate(): void;
}

/**
 * Builds the 3D demo inside the given container. The container must be
 * visible: the viewer is sized from its width.
 *
 * @param container - The tab panel element.
 * @returns The pause/resume handle for the tab shell.
 */
export function initDemo(container: HTMLElement): DemoHandle {
  const canvas = document.createElement("canvas");
  canvas.className = "viewer";
  const stage = document.createElement("div");
  stage.className = "stage";
  stage.append(canvas);
  container.append(stage);
  const initialSize = stage.clientWidth || 640;
  const viewer = new SkinViewer({
    canvas,
    width: initialSize,
    height: initialSize,
  });
  // Debugging handle: inspect the viewer from the devtools console.
  (window as unknown as { __viewer?: SkinViewer }).__viewer = viewer;
  // Keep the renderer resolution in sync with the CSS-driven stage
  // size (the stage stays square and shrinks with the viewport).
  const resizeObserver = new ResizeObserver(() => {
    const nextSize = Math.round(stage.clientWidth);
    if (nextSize === 0) {
      return;
    }
    viewer.setSize(nextSize, nextSize);
  });
  resizeObserver.observe(stage);

  // Camera reset: the stage overlay restores the default view.
  const resetView = document.createElement("button");
  resetView.type = "button";
  resetView.className = "stage-reset";
  resetView.textContent = "reset";
  resetView.setAttribute("aria-label", "reset camera");
  resetView.addEventListener("click", () => {
    viewer.resetCameraPose();
  });
  stage.append(resetView);

  const status = document.createElement("p");
  status.className = "status";

  let controller: ETFController | null = null;
  let decoded: DecodeResult | null = null;

  /**
   * Reports a message in the status line (warnings are also logged).
   *
   * @param message - The text to show.
   */
  const report = (message: string): void => {
    status.textContent = message;
  };

  /** Attaches the controller when it is not attached yet. */
  const attach = (): void => {
    if (controller !== null) {
      return;
    }
    controller = attachETFSkinFeatures(viewer, {
      features: {
        transparency: transparencyBox.checked,
        nose: noseBox.checked,
        emissive: emissiveBox.checked,
        blink: blinkBox.checked,
        enchanted: enchantedBox.checked,
      },
      onWarning: (message) => {
        report(`warning: ${message}`);
        console.warn(message);
      },
    });
    (window as unknown as { __etf?: ETFController | null }).__etf = controller;
    // The fresh controller starts from the defaults: replay the
    // current control values so the UI never misreports its state.
    applyUiState();
    attachButton.disabled = true;
    detachButton.disabled = false;
    syncControlAvailability();
  };

  /** Detaches and disposes the controller when attached. */
  const detachController = (): void => {
    if (controller === null) {
      return;
    }
    controller.detach();
    controller = null;
    (window as unknown as { __etf?: ETFController | null }).__etf = null;
    attachButton.disabled = false;
    detachButton.disabled = true;
    syncControlAvailability();
  };

  /**
   * Loads a fixture skin and refreshes the controller.
   *
   * @param fixture - The fixture to show.
   */
  const showFixture = async (fixture: Fixture): Promise<void> => {
    report(`loading ${fixture.name}...`);
    await viewer.loadSkin(fixture.url, { model: selectedModel() });
    controller?.refresh();
    // Decode the skin once for the applicability graying (the same
    // path the preview tab walks); a decode failure greys the rows.
    try {
      decoded = decodeSkin(await loadImageData(fixture.url));
    } catch {
      decoded = null;
    }
    loadSkinSource.value = fixture.url;
    loadSkinButton.disabled = false;
    syncControlAvailability();
    report(`showing ${fixture.name}`);
  };

  const transparencyBox = document.createElement("input");
  transparencyBox.type = "checkbox";
  transparencyBox.checked = true;
  transparencyBox.disabled = true;
  transparencyBox.addEventListener("change", () => {
    controller?.setFeatures({ transparency: transparencyBox.checked });
  });

  const noseBox = document.createElement("input");
  noseBox.type = "checkbox";
  noseBox.checked = true;
  noseBox.disabled = true;
  noseBox.addEventListener("change", () => {
    controller?.setFeatures({ nose: noseBox.checked });
  });

  const emissiveBox = document.createElement("input");
  emissiveBox.type = "checkbox";
  emissiveBox.checked = true;
  emissiveBox.disabled = true;
  emissiveBox.addEventListener("change", () => {
    controller?.setFeatures({ emissive: emissiveBox.checked });
  });

  const blinkBox = document.createElement("input");
  blinkBox.type = "checkbox";
  blinkBox.checked = true;
  blinkBox.disabled = true;
  blinkBox.addEventListener("change", () => {
    controller?.setFeatures({ blink: blinkBox.checked });
    syncControlAvailability();
  });

  const enchantedBox = document.createElement("input");
  enchantedBox.type = "checkbox";
  enchantedBox.checked = true;
  enchantedBox.disabled = true;
  enchantedBox.addEventListener("change", () => {
    controller?.setFeatures({ enchanted: enchantedBox.checked });
    syncControlAvailability();
  });

  const blinkStateSelect = document.createElement("select");
  for (const state of ["auto", "open", "halfClosed", "closed"]) {
    const option = document.createElement("option");
    option.value = state;
    option.textContent = state;
    blinkStateSelect.append(option);
  }
  blinkStateSelect.disabled = true;
  blinkStateSelect.addEventListener("change", () => {
    controller?.setBlinkOptions({
      state: blinkStateSelect.value as BlinkState,
    });
    syncControlAvailability();
  });

  /**
   * Reads a timing input as a non-negative integer.
   *
   * @param input - The input to read.
   * @returns The parsed value, or `null` when unusable.
   */
  function readTiming(input: HTMLInputElement): number | null {
    const parsed = Number.parseInt(input.value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  /** Sends the period pair; equal ends mean a fixed interval. */
  function applyPeriod(): void {
    const min = readTiming(periodMin);
    const max = readTiming(periodMax);
    if (min === null || max === null) {
      return;
    }
    controller?.setBlinkOptions({ periodMs: min === max ? min : [min, max] });
  }

  const periodMin = numberInput(
    DEFAULT_BLINK_OPTIONS.periodMs,
    100,
    applyPeriod,
    0,
  );
  const periodMax = numberInput(
    DEFAULT_BLINK_OPTIONS.periodMs,
    100,
    applyPeriod,
    0,
  );
  const closedInput = numberInput(
    DEFAULT_BLINK_OPTIONS.closedMs,
    10,
    (value) => controller?.setBlinkOptions({ closedMs: value }),
    0,
  );
  const halfClosedInput = numberInput(
    DEFAULT_BLINK_OPTIONS.halfClosedMs,
    10,
    (value) => controller?.setBlinkOptions({ halfClosedMs: value }),
    0,
  );
  const reopenInput = numberInput(
    DEFAULT_BLINK_OPTIONS.reopenMs,
    10,
    (value) => controller?.setBlinkOptions({ reopenMs: value }),
    0,
  );
  const periodReset = actionButton("reset", "reset blink.periodMs", () => {
    periodMin.value = String(DEFAULT_BLINK_OPTIONS.periodMs);
    periodMax.value = String(DEFAULT_BLINK_OPTIONS.periodMs);
    controller?.setBlinkOptions({ periodMs: DEFAULT_BLINK_OPTIONS.periodMs });
  });
  const closedReset = actionButton("reset", "reset blink.closedMs", () => {
    closedInput.value = String(DEFAULT_BLINK_OPTIONS.closedMs);
    controller?.setBlinkOptions({ closedMs: DEFAULT_BLINK_OPTIONS.closedMs });
  });
  const halfClosedReset = actionButton(
    "reset",
    "reset blink.halfClosedMs",
    () => {
      halfClosedInput.value = String(DEFAULT_BLINK_OPTIONS.halfClosedMs);
      controller?.setBlinkOptions({
        halfClosedMs: DEFAULT_BLINK_OPTIONS.halfClosedMs,
      });
    },
  );
  const reopenReset = actionButton("reset", "reset blink.reopenMs", () => {
    reopenInput.value = String(DEFAULT_BLINK_OPTIONS.reopenMs);
    controller?.setBlinkOptions({ reopenMs: DEFAULT_BLINK_OPTIONS.reopenMs });
  });

  const glintSpeedInput = numberInput(
    DEFAULT_GLINT_OPTIONS.speed,
    0.05,
    (value) => controller?.setGlintOptions({ speed: value }),
  );
  const glintOpacityInput = numberInput(
    DEFAULT_GLINT_OPTIONS.opacity,
    0.05,
    (value) => controller?.setGlintOptions({ opacity: value }),
    0,
    1,
  );
  const glintScaleInput = numberInput(
    DEFAULT_GLINT_OPTIONS.scale,
    0.25,
    (value) => controller?.setGlintOptions({ scale: value }),
    0,
  );
  const glintSpeedReset = actionButton("reset", "reset glint.speed", () => {
    glintSpeedInput.value = String(DEFAULT_GLINT_OPTIONS.speed);
    controller?.setGlintOptions({ speed: DEFAULT_GLINT_OPTIONS.speed });
  });
  const glintOpacityReset = actionButton("reset", "reset glint.opacity", () => {
    glintOpacityInput.value = String(DEFAULT_GLINT_OPTIONS.opacity);
    controller?.setGlintOptions({ opacity: DEFAULT_GLINT_OPTIONS.opacity });
  });
  const glintScaleReset = actionButton("reset", "reset glint.scale", () => {
    glintScaleInput.value = String(DEFAULT_GLINT_OPTIONS.scale);
    controller?.setGlintOptions({ scale: DEFAULT_GLINT_OPTIONS.scale });
  });

  const glintSmoothBox = document.createElement("input");
  glintSmoothBox.type = "checkbox";
  glintSmoothBox.checked = DEFAULT_GLINT_OPTIONS.smooth;
  glintSmoothBox.disabled = true;
  glintSmoothBox.addEventListener("change", () => {
    controller?.setGlintOptions({ smooth: glintSmoothBox.checked });
  });
  const glintSmoothReset = actionButton("reset", "reset glint.smooth", () => {
    glintSmoothBox.checked = DEFAULT_GLINT_OPTIONS.smooth;
    controller?.setGlintOptions({ smooth: DEFAULT_GLINT_OPTIONS.smooth });
  });
  glintSpeedInput.disabled = true;
  glintOpacityInput.disabled = true;
  glintScaleInput.disabled = true;

  /** The latest custom texture sources, replayed on re-attach. */
  let glintTextureSource: string | undefined;
  let noseTextureSource: string | undefined;

  const glintPicker = createTexturePicker({
    path: "glint.texture",
    apply: (source) => {
      glintTextureSource = source;
      controller?.setGlintOptions({ texture: source });
    },
  });
  const nosePicker = createTexturePicker({
    path: "villagerNose.texture",
    apply: (source) => {
      noseTextureSource = source;
      controller?.setVillagerNoseOptions({ texture: source });
    },
  });
  glintPicker.input.disabled = true;
  glintPicker.reset.disabled = true;
  nosePicker.input.disabled = true;
  nosePicker.reset.disabled = true;

  /**
   * Pushes the current control values into the controller; a fresh
   * controller starts from the defaults, so re-attaching replays the
   * UI state.
   */
  function applyUiState(): void {
    if (controller === null) {
      return;
    }
    const min = readTiming(periodMin);
    const max = readTiming(periodMax);
    if (min !== null && max !== null) {
      controller.setBlinkOptions({
        periodMs: min === max ? min : [min, max],
      });
    }
    const closed = readTiming(closedInput);
    if (closed !== null) {
      controller.setBlinkOptions({ closedMs: closed });
    }
    const halfClosed = readTiming(halfClosedInput);
    if (halfClosed !== null) {
      controller.setBlinkOptions({ halfClosedMs: halfClosed });
    }
    const reopen = readTiming(reopenInput);
    if (reopen !== null) {
      controller.setBlinkOptions({ reopenMs: reopen });
    }
    controller.setBlinkOptions({
      state: blinkStateSelect.value as BlinkState,
    });
    const speed = Number.parseFloat(glintSpeedInput.value);
    if (Number.isFinite(speed)) {
      controller.setGlintOptions({ speed });
    }
    const opacity = Number.parseFloat(glintOpacityInput.value);
    if (Number.isFinite(opacity)) {
      controller.setGlintOptions({ opacity });
    }
    const scale = Number.parseFloat(glintScaleInput.value);
    if (Number.isFinite(scale)) {
      controller.setGlintOptions({ scale });
    }
    controller.setGlintOptions({
      smooth: glintSmoothBox.checked,
      texture: glintTextureSource,
    });
    controller.setVillagerNoseOptions({ texture: noseTextureSource });
  }

  /**
   * Recomputes which controls accept input and which rows the
   * current skin cannot use: `enabled = attached && applicable &&
   * coupling`; inapplicable rows gray out, the blink and glint
   * subtrees follow their feature switch, and the attach / detach
   * rows follow the attach state.
   */
  function syncControlAvailability(): void {
    const attached = controller !== null;
    const uses = {
      transparency: decoded !== null && decoded.transparency.enabled,
      nose: decoded !== null && decoded.nose !== null,
      emissive: decoded !== null && decoded.emissive !== null,
      blink: decoded !== null && decoded.blink !== null,
      enchanted: decoded !== null && decoded.enchanted !== null,
      villagerNose:
        decoded !== null &&
        decoded.nose !== null &&
        decoded.nose.villager &&
        !decoded.nose.villagerSkinTextured,
    };
    const updateRow = (
      row: HTMLTableRowElement,
      applicable: boolean,
      enabled: boolean,
    ): void => {
      setRowInapplicable(row, !applicable);
      setRowDisabled(row, !enabled);
    };
    updateRow(
      transparencyRow,
      uses.transparency,
      attached && uses.transparency,
    );
    updateRow(noseRow, uses.nose, attached && uses.nose);
    updateRow(emissiveRow, uses.emissive, attached && uses.emissive);
    updateRow(blinkFeatureRow, uses.blink, attached && uses.blink);
    updateRow(enchantedRow, uses.enchanted, attached && uses.enchanted);
    const eyesOn = attached && uses.blink && blinkBox.checked;
    const timingOn = eyesOn && blinkStateSelect.value === "auto";
    updateRow(stateRow, uses.blink, eyesOn);
    updateRow(periodRow, uses.blink, timingOn);
    updateRow(closedRow, uses.blink, timingOn);
    updateRow(halfClosedRow, uses.blink, timingOn);
    updateRow(reopenRow, uses.blink, timingOn);
    const glintOn = attached && uses.enchanted && enchantedBox.checked;
    updateRow(glintTextureRow, uses.enchanted, glintOn);
    updateRow(glintSpeedRow, uses.enchanted, glintOn);
    updateRow(glintOpacityRow, uses.enchanted, glintOn);
    updateRow(glintScaleRow, uses.enchanted, glintOn);
    updateRow(glintSmoothRow, uses.enchanted, glintOn);
    const noseTextureOn = attached && uses.villagerNose && noseBox.checked;
    updateRow(villagerNoseTextureRow, uses.villagerNose, noseTextureOn);
  }

  const animationSelect = document.createElement("select");
  for (const id of ["none", ...ANIMATIONS.map((preset) => preset.id)]) {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = id;
    animationSelect.append(option);
  }
  animationSelect.addEventListener("change", () => {
    const preset = ANIMATIONS.find(
      (entry) => entry.id === animationSelect.value,
    );
    // The viewer resets the pose whenever the animation slot changes.
    viewer.animation = preset === undefined ? null : preset.create();
    blockbenchGroup.release();
    controller?.rebind();
  });

  const blockbenchGroup = createBlockbenchGroup({
    viewer,
    report,
    onSlotChange: () => {
      animationSelect.value = "none";
      controller?.rebind();
    },
  });

  const modelSelect = document.createElement("select");
  for (const entry of MODEL_OPTIONS) {
    const option = document.createElement("option");
    option.value = entry.model;
    option.textContent = entry.model;
    modelSelect.append(option);
  }
  modelSelect.addEventListener("change", () => {
    const current = getSelectedFixture();
    if (current !== undefined) {
      loadFixture(current);
    }
  });

  /**
   * Resolves the model value currently chosen in the picker.
   *
   * @returns The `loadSkin()` model value.
   */
  const selectedModel = (): NonNullable<SkinLoadOptions["model"]> => {
    const match = MODEL_OPTIONS.find(
      (entry) => entry.model === modelSelect.value,
    );
    return match?.model ?? "auto-detect";
  };

  const backgroundInput = document.createElement("input");
  backgroundInput.type = "color";
  backgroundInput.value = "#ffffff";
  backgroundInput.addEventListener("input", () => {
    viewer.background = backgroundInput.value;
  });

  const globalLightInput = document.createElement("input");
  globalLightInput.type = "range";
  globalLightInput.min = "0";
  globalLightInput.max = "4";
  globalLightInput.step = "0.1";
  globalLightInput.value = String(viewer.globalLight.intensity);
  globalLightInput.addEventListener("input", () => {
    viewer.globalLight.intensity = Number(globalLightInput.value);
  });

  const cameraLightInput = document.createElement("input");
  cameraLightInput.type = "range";
  cameraLightInput.min = "0";
  cameraLightInput.max = "2";
  cameraLightInput.step = "0.1";
  cameraLightInput.value = String(viewer.cameraLight.intensity);
  cameraLightInput.addEventListener("input", () => {
    viewer.cameraLight.intensity = Number(cameraLightInput.value);
  });

  const globalLightDefault = viewer.globalLight.intensity;
  const cameraLightDefault = viewer.cameraLight.intensity;
  const globalLightReset = actionButton("reset", "reset globalLight", () => {
    globalLightInput.value = String(globalLightDefault);
    viewer.globalLight.intensity = globalLightDefault;
  });
  const cameraLightReset = actionButton("reset", "reset cameraLight", () => {
    cameraLightInput.value = String(cameraLightDefault);
    viewer.cameraLight.intensity = cameraLightDefault;
  });

  const attachButton = executeButton("execute attachETFSkinFeatures", () =>
    attach(),
  );
  attachButton.disabled = true;
  const detachButton = executeButton("execute detach", () =>
    detachController(),
  );
  detachButton.disabled = true;

  const attachRow = optionRow(
    ["attachETFSkinFeatures"],
    "attachETFSkinFeatures(viewer, options): attach the extension " +
      "to the demo viewer; the option groups below stay live " +
      "through the setters",
    [attachButton],
  );
  const detachRow = optionRow(
    ["detach"],
    "controller.detach(): restore every artifact and dispose",
    [detachButton],
  );
  const featuresGroupRow = optionRow(
    ["features"],
    "features: the per-feature switches",
    [],
  );
  const transparencyRow = optionRow(
    ["features", "transparency"],
    "features.transparency: honor the decoded base-layer alpha",
    [transparencyBox],
  );
  const noseRow = optionRow(
    ["features", "nose"],
    "features.nose: villager and textured noses",
    [noseBox],
  );
  const emissiveRow = optionRow(
    ["features", "emissive"],
    "features.emissive: fullbright glow overlays",
    [emissiveBox],
  );
  const blinkFeatureRow = optionRow(
    ["features", "blink"],
    "features.blink: automatic blinking and the fixed eye states",
    [blinkBox],
  );
  const enchantedRow = optionRow(
    ["features", "enchanted"],
    "features.enchanted: the enchanted (glint) overlay",
    [enchantedBox],
  );
  const blinkGroupRow = optionRow(
    ["blink"],
    "blink: the blink behavior options",
    [],
  );
  const stateRow = optionRow(
    ["blink", "state"],
    "blink.state: auto blinks periodically; " +
      "open / halfClosed / closed hold that state",
    [blinkStateSelect],
  );
  const periodRow = optionRow(
    ["blink", "periodMs"],
    "blink.periodMs: ms between blinks; equal ends = a fixed interval",
    [periodMin, periodMax],
    periodReset,
  );
  const closedRow = optionRow(
    ["blink", "closedMs"],
    "blink.closedMs: fully closed phase in ms (default 250)",
    [closedInput],
    closedReset,
  );
  const halfClosedRow = optionRow(
    ["blink", "halfClosedMs"],
    "blink.halfClosedMs: half-closed lead phase, 2-frame modes " +
      "(default closedMs / 2)",
    [halfClosedInput],
    halfClosedReset,
  );
  const reopenRow = optionRow(
    ["blink", "reopenMs"],
    "blink.reopenMs: half-closed tail phase, 2-frame modes; " +
      "0 = pop open (default halfClosedMs)",
    [reopenInput],
    reopenReset,
  );
  const glintGroupRow = optionRow(
    ["glint"],
    "glint: the enchanted overlay options",
    [],
  );
  const glintTextureRow = optionRow(
    ["glint", "texture"],
    "glint.texture: the pattern image; defaults to the built-in " +
      "self-drawn texture, null renders no glint",
    [glintPicker.input],
    glintPicker.reset,
  );
  const glintSpeedRow = optionRow(
    ["glint", "speed"],
    `glint.speed: diagonal scroll in UV units per second (default ` +
      `${DEFAULT_GLINT_OPTIONS.speed}); 0 freezes, negative reverses`,
    [glintSpeedInput],
    glintSpeedReset,
  );
  const glintOpacityRow = optionRow(
    ["glint", "opacity"],
    `glint.opacity: additive brightness in 0..1 (default ` +
      `${DEFAULT_GLINT_OPTIONS.opacity}); values outside are clamped`,
    [glintOpacityInput],
    glintOpacityReset,
  );
  const glintScaleRow = optionRow(
    ["glint", "scale"],
    `glint.scale: pattern tiling across the UVs (default ` +
      `${DEFAULT_GLINT_OPTIONS.scale}); <= 0 falls back to the default`,
    [glintScaleInput],
    glintScaleReset,
  );
  const glintSmoothRow = optionRow(
    ["glint", "smooth"],
    `glint.smooth: bilinear pattern filtering (default ` +
      `${DEFAULT_GLINT_OPTIONS.smooth}); false keeps crisp pixels`,
    [glintSmoothBox],
    glintSmoothReset,
  );
  const villagerNoseGroupRow = optionRow(
    ["villagerNose"],
    "villagerNose: the flat villager nose options",
    [],
  );
  const villagerNoseTextureRow = optionRow(
    ["villagerNose", "texture"],
    "villagerNose.texture: the flat nose image; defaults to the " +
      "built-in texture, null disables villager noses",
    [nosePicker.input],
    nosePicker.reset,
  );

  const etfTable = controlTable("skinview3d-etf:", [
    attachRow,
    detachRow,
    featuresGroupRow,
    transparencyRow,
    noseRow,
    emissiveRow,
    blinkFeatureRow,
    enchantedRow,
    blinkGroupRow,
    stateRow,
    periodRow,
    closedRow,
    halfClosedRow,
    reopenRow,
    glintGroupRow,
    glintTextureRow,
    glintSpeedRow,
    glintOpacityRow,
    glintScaleRow,
    glintSmoothRow,
    villagerNoseGroupRow,
    villagerNoseTextureRow,
  ]);

  const loadSkinButton = executeButton("execute loadSkin", () => {
    const current = getSelectedFixture();
    if (current !== undefined) {
      loadFixture(current);
    }
  });
  loadSkinButton.disabled = true;
  const loadSkinSource = lockedInput(
    "",
    "loadSkin.source: the texture to load - locked, the demo fills " +
      "it from the fixture bar selection (fixture.url)",
  );

  const hostTable = controlTable("skinview3d:", [
    optionRow(["viewer"], "viewer: the SkinViewer instance", []),
    optionRow(
      ["viewer", "animation"],
      "viewer.animation: a built-in PlayerAnimation preset",
      [animationSelect],
    ),
    optionRow(["viewer", "background"], "viewer.background: solid color", [
      backgroundInput,
    ]),
    optionRow(
      ["viewer", "globalLight"],
      "viewer.globalLight: the viewer's global light",
      [],
    ),
    optionRow(
      ["viewer", "globalLight", "intensity"],
      "viewer.globalLight.intensity: 0..4 (natural 0.6)",
      [globalLightInput, globalLightReset],
    ),
    optionRow(
      ["viewer", "cameraLight"],
      "viewer.cameraLight: the viewer's camera-attached light",
      [],
    ),
    optionRow(
      ["viewer", "cameraLight", "intensity"],
      "viewer.cameraLight.intensity: 0..2 (natural 0.6)",
      [cameraLightInput, cameraLightReset],
    ),
    optionRow(
      ["loadSkin"],
      "loadSkin(source, options): load a skin texture; re-runs with " +
        "the current fixture and model",
      [loadSkinButton],
    ),
    optionRow(
      ["loadSkin", "source"],
      "loadSkin.source: the texture source - locked, the demo fills " +
        "it from the fixture bar selection (fixture.url)",
      [loadSkinSource],
    ),
    optionRow(["loadSkin", "options"], "loadSkin.options: SkinLoadOptions", []),
    optionRow(
      ["loadSkin", "options", "model"],
      "loadSkin.options.model: auto-detect infers slim from the texture",
      [modelSelect],
    ),
  ]);

  const controls = document.createElement("div");
  controls.className = "controls";
  controls.append(etfTable, blockbenchGroup.table, hostTable);
  container.append(controls, status);

  /**
   * Loads a fixture and attaches the controller on the first success.
   *
   * @param fixture - The fixture to show.
   */
  const loadFixture = (fixture: Fixture): void => {
    showFixture(fixture)
      .then(() => {
        attach();
      })
      .catch((error: unknown) => {
        report(`load failed: ${String(error)}`);
      });
  };

  onFixtureSelected(loadFixture);
  const initial = getSelectedFixture();
  if (initial === undefined) {
    report("select a sample skin or upload a PNG skin to start");
  } else {
    loadFixture(initial);
  }

  return {
    activate: () => {
      viewer.renderPaused = false;
    },
    deactivate: () => {
      viewer.renderPaused = true;
    },
  };
}
