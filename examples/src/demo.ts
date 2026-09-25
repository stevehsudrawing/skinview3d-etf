/**
 * The 3D demo tab: the page assembly around the shared fixture bar.
 *
 * Creates a `SkinViewer` inside a square stage (with a `reset`
 * overlay that restores the camera pose), attaches the ETF features
 * through the public `attachETFSkinFeatures()` API and offers three
 * aligned control tables grouped by owning package (the extension,
 * the blockbench animation provider, the host viewer; the builders
 * live in `controls.ts`, the provider group in `blockbench.ts`).
 * Every control surface is the exact API keyword with its
 * description in a tooltip; the blink rows couple to each other and
 * the row action buttons share one column. The host picker and the
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
import type { BlinkState, ETFController } from "../../src/index";
import { attachETFSkinFeatures, DEFAULT_BLINK_OPTIONS } from "../../src/index";
import { createBlockbenchGroup } from "./blockbench";
import { actionButton, controlTable, optionRow } from "./controls";
import {
  getSelectedFixture,
  onFixtureSelected,
  type Fixture,
} from "./fixtures";

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

/** Model picker entries: the label shown and the `loadSkin()` value. */
const MODEL_OPTIONS: ReadonlyArray<{
  /** Option label shown in the picker. */
  label: string;
  /** Value passed to `loadSkin()`. */
  model: NonNullable<SkinLoadOptions["model"]>;
}> = [
  { label: "auto", model: "auto-detect" },
  { label: "Steve", model: "default" },
  { label: "Alex", model: "slim" },
];

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
      },
      onWarning: (message) => {
        report(`warning: ${message}`);
        console.warn(message);
      },
    });
    (window as unknown as { __etf?: ETFController | null }).__etf = controller;
    attachBox.checked = true;
    attachBox.disabled = false;
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
    attachBox.checked = false;
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

  /**
   * Builds one number input for a blink timing value.
   *
   * @param value - The initial value in ms.
   * @param step - The spinner step.
   * @param apply - Receives every valid value (change events only).
   * @returns The input element.
   */
  function timingInput(
    value: number,
    step: number,
    apply: (value: number) => void,
  ): HTMLInputElement {
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = String(step);
    input.value = String(value);
    input.addEventListener("change", () => {
      const parsed = readTiming(input);
      if (parsed !== null) {
        apply(parsed);
      }
    });
    return input;
  }

  const periodMin = timingInput(
    DEFAULT_BLINK_OPTIONS.periodMs,
    100,
    applyPeriod,
  );
  const periodMax = timingInput(
    DEFAULT_BLINK_OPTIONS.periodMs,
    100,
    applyPeriod,
  );
  const closedInput = timingInput(DEFAULT_BLINK_OPTIONS.closedMs, 10, (value) =>
    controller?.setBlinkOptions({ closedMs: value }),
  );
  const halfClosedInput = timingInput(
    DEFAULT_BLINK_OPTIONS.halfClosedMs,
    10,
    (value) => controller?.setBlinkOptions({ halfClosedMs: value }),
  );
  const reopenInput = timingInput(DEFAULT_BLINK_OPTIONS.reopenMs, 10, (value) =>
    controller?.setBlinkOptions({ reopenMs: value }),
  );
  const periodReset = actionButton("reset", "reset periodMs", () => {
    periodMin.value = String(DEFAULT_BLINK_OPTIONS.periodMs);
    periodMax.value = String(DEFAULT_BLINK_OPTIONS.periodMs);
    controller?.setBlinkOptions({ periodMs: DEFAULT_BLINK_OPTIONS.periodMs });
  });
  const closedReset = actionButton("reset", "reset closedMs", () => {
    closedInput.value = String(DEFAULT_BLINK_OPTIONS.closedMs);
    controller?.setBlinkOptions({ closedMs: DEFAULT_BLINK_OPTIONS.closedMs });
  });
  const halfClosedReset = actionButton("reset", "reset halfClosedMs", () => {
    halfClosedInput.value = String(DEFAULT_BLINK_OPTIONS.halfClosedMs);
    controller?.setBlinkOptions({
      halfClosedMs: DEFAULT_BLINK_OPTIONS.halfClosedMs,
    });
  });
  const reopenReset = actionButton("reset", "reset reopenMs", () => {
    reopenInput.value = String(DEFAULT_BLINK_OPTIONS.reopenMs);
    controller?.setBlinkOptions({ reopenMs: DEFAULT_BLINK_OPTIONS.reopenMs });
  });

  /**
   * Recomputes which controls accept input: the feature switches
   * follow the attach state, the eye state follows `blink`, and the
   * timing rows (inputs and resets) follow `state === "auto"`.
   */
  function syncControlAvailability(): void {
    const attached = controller !== null;
    transparencyBox.disabled = !attached;
    noseBox.disabled = !attached;
    emissiveBox.disabled = !attached;
    blinkBox.disabled = !attached;
    const eyesOn = attached && blinkBox.checked;
    blinkStateSelect.disabled = !eyesOn;
    const timingOn = eyesOn && blinkStateSelect.value === "auto";
    for (const control of [
      periodMin,
      periodMax,
      closedInput,
      halfClosedInput,
      reopenInput,
    ]) {
      control.disabled = !timingOn;
    }
    for (const reset of [
      periodReset,
      closedReset,
      halfClosedReset,
      reopenReset,
    ]) {
      reset.disabled = !timingOn;
    }
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
    option.textContent = entry.label;
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

  const attachBox = document.createElement("input");
  attachBox.type = "checkbox";
  attachBox.disabled = true;
  attachBox.addEventListener("change", () => {
    if (attachBox.checked) {
      attach();
    } else {
      detachController();
    }
  });

  const etfTable = controlTable("skinview3d-etf:", [
    optionRow(
      "attach",
      "attach / detach the extension (attachETFSkinFeatures / detach)",
      [attachBox],
    ),
    optionRow(
      "transparency",
      "features.transparency: honor the decoded base-layer alpha",
      [transparencyBox],
    ),
    optionRow("nose", "features.nose: villager and textured noses", [noseBox]),
    optionRow("emissive", "features.emissive: fullbright glow overlays", [
      emissiveBox,
    ]),
    optionRow(
      "blink",
      "features.blink: automatic blinking and the fixed eye states",
      [blinkBox],
    ),
    optionRow(
      "state",
      "blink.state: auto blinks periodically; " +
        "open / halfClosed / closed hold that state",
      [blinkStateSelect],
    ),
    optionRow(
      "periodMs",
      "blink.periodMs: ms between blinks; equal ends = a fixed interval",
      [periodMin, periodMax],
      periodReset,
    ),
    optionRow(
      "closedMs",
      "blink.closedMs: fully closed phase in ms (default 250)",
      [closedInput],
      closedReset,
    ),
    optionRow(
      "halfClosedMs",
      "blink.halfClosedMs: half-closed lead phase, 2-frame modes " +
        "(default closedMs / 2)",
      [halfClosedInput],
      halfClosedReset,
    ),
    optionRow(
      "reopenMs",
      "blink.reopenMs: half-closed tail phase, 2-frame modes; " +
        "0 = pop open (default halfClosedMs)",
      [reopenInput],
      reopenReset,
    ),
  ]);

  const hostTable = controlTable("skinview3d:", [
    optionRow(
      "animation",
      "viewer.animation: a built-in PlayerAnimation preset",
      [animationSelect],
    ),
    optionRow(
      "model",
      "loadSkin({ model }): auto-detect infers slim from the texture",
      [modelSelect],
    ),
    optionRow("background", "viewer.background: solid color", [
      backgroundInput,
    ]),
    optionRow("globalLight", "viewer.globalLight.intensity", [
      globalLightInput,
      globalLightReset,
    ]),
    optionRow("cameraLight", "viewer.cameraLight.intensity", [
      cameraLightInput,
      cameraLightReset,
    ]),
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
