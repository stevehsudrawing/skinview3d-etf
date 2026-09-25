/**
 * The 3D demo tab.
 *
 * Creates a `SkinViewer` inside a square stage (with a `reset`
 * overlay that restores the camera pose), attaches the ETF features
 * through the public `attachETFSkinFeatures()` API and offers three
 * aligned control tables grouped by owning package (the extension,
 * the blockbench animation provider, the host viewer). Every control
 * surface is the exact API keyword with its description in a tooltip;
 * the blink rows couple to each other, the reset buttons share one
 * column, and the blockbench group picks its input file (`animation`,
 * the bundled copy or a
 * transient `[upload]` entry) and the name to play (`animationName`,
 * the list following the file) with the provider's `paused` /
 * `speed` / `setAnimation` controls. The host picker and the
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
import { SkinViewBlockbench } from "skinview3d-blockbench";
import type { BlinkState, ETFController } from "../../src/index";
import { attachETFSkinFeatures } from "../../src/index";
import exampleAnimation from "./assets/animations/example.animation.json";
import {
  getSelectedFixture,
  onFixtureSelected,
  type Fixture,
} from "./fixtures";
import { createAnimationUploadControl } from "./upload";

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

/** The documented blink defaults the demo resets back to. */
const BLINK_DEFAULTS = {
  /** Fixed interval between blinks, in ms. */
  periodMs: 6000,
  /** Fully closed phase, in ms. */
  closedMs: 250,
  /** Half-closed lead phase, in ms. */
  halfClosedMs: 125,
  /** Half-closed tail phase, in ms. */
  reopenMs: 125,
} as const;

/** Animation names inside the bundled blockbench fixture. */
const BLOCKBENCH_NAMES = Object.keys(exampleAnimation.animations);

/**
 * Builds one option row for a control table: the label is the API
 * keyword wrapped in a `code` element whose `title` describes it, and
 * the controls are tied to the label through `aria-labelledby` (the
 * id is namespaced by `controlTable`).
 *
 * @param label - The API keyword (left column).
 * @param description - The plain-English tooltip text.
 * @param controls - The control elements (right column).
 * @param reset - A per-row reset button, when the row has one.
 * @returns The `<tr>` element.
 */
function optionRow(
  label: string,
  description: string,
  controls: readonly Node[],
  reset?: HTMLButtonElement,
): HTMLTableRowElement {
  const row = document.createElement("tr");
  const header = document.createElement("th");
  header.id = `demo-option-${label.toLowerCase()}`;
  header.scope = "row";
  const keyword = document.createElement("code");
  keyword.textContent = label;
  keyword.title = description;
  header.append(keyword);
  const cell = document.createElement("td");
  for (const control of controls) {
    if (
      (control instanceof HTMLInputElement ||
        control instanceof HTMLSelectElement) &&
      !control.hasAttribute("aria-label")
    ) {
      control.setAttribute("aria-labelledby", header.id);
    }
  }
  cell.append(...controls);
  if (reset !== undefined) {
    cell.append(reset);
  }
  row.append(header, cell);
  return row;
}

/**
 * Builds a control table for one owner group; the group title doubles
 * as the `<th>` id namespace, so equal keywords in different tables
 * stay addressable.
 *
 * @param title - The group title.
 * @param rows - The option rows.
 * @returns The `<table>` element.
 */
function controlTable(
  title: string,
  rows: readonly HTMLTableRowElement[],
): HTMLTableElement {
  const table = document.createElement("table");
  table.className = "control-group";
  const titleRow = document.createElement("tr");
  const header = document.createElement("th");
  header.colSpan = 2;
  header.className = "group-title";
  header.textContent = title;
  titleRow.append(header);
  const slug = title.replace(/:$/, "").toLowerCase();
  for (const row of rows) {
    const rowHeader = row.querySelector("th");
    const keyword = rowHeader?.querySelector("code")?.textContent;
    if (rowHeader === null || keyword === undefined) {
      continue;
    }
    const previousId = rowHeader.id;
    rowHeader.id = `demo-option-${slug}-${keyword.toLowerCase()}`;
    for (const control of row.querySelectorAll(
      `[aria-labelledby="${previousId}"]`,
    )) {
      control.setAttribute("aria-labelledby", rowHeader.id);
    }
  }
  table.append(titleRow, ...rows);
  return table;
}

/**
 * Builds a row action button; the `row-reset` class lets every row
 * action align in one column. The visible text is the API keyword.
 *
 * @param text - The visible label (the API keyword).
 * @param label - The accessible label.
 * @param onClick - The click handler.
 * @returns The `<button>` element.
 */
function actionButton(
  text: string,
  label: string,
  onClick: () => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "row-reset";
  button.textContent = text;
  button.setAttribute("aria-label", label);
  button.addEventListener("click", onClick);
  return button;
}

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

  const periodMin = timingInput(BLINK_DEFAULTS.periodMs, 100, applyPeriod);
  const periodMax = timingInput(BLINK_DEFAULTS.periodMs, 100, applyPeriod);
  const closedInput = timingInput(BLINK_DEFAULTS.closedMs, 10, (value) =>
    controller?.setBlinkOptions({ closedMs: value }),
  );
  const halfClosedInput = timingInput(
    BLINK_DEFAULTS.halfClosedMs,
    10,
    (value) => controller?.setBlinkOptions({ halfClosedMs: value }),
  );
  const reopenInput = timingInput(BLINK_DEFAULTS.reopenMs, 10, (value) =>
    controller?.setBlinkOptions({ reopenMs: value }),
  );
  const periodReset = actionButton("reset", "reset periodMs", () => {
    periodMin.value = String(BLINK_DEFAULTS.periodMs);
    periodMax.value = String(BLINK_DEFAULTS.periodMs);
    controller?.setBlinkOptions({ periodMs: BLINK_DEFAULTS.periodMs });
  });
  const closedReset = actionButton("reset", "reset closedMs", () => {
    closedInput.value = String(BLINK_DEFAULTS.closedMs);
    controller?.setBlinkOptions({ closedMs: BLINK_DEFAULTS.closedMs });
  });
  const halfClosedReset = actionButton("reset", "reset halfClosedMs", () => {
    halfClosedInput.value = String(BLINK_DEFAULTS.halfClosedMs);
    controller?.setBlinkOptions({ halfClosedMs: BLINK_DEFAULTS.halfClosedMs });
  });
  const reopenReset = actionButton("reset", "reset reopenMs", () => {
    reopenInput.value = String(BLINK_DEFAULTS.reopenMs);
    controller?.setBlinkOptions({ reopenMs: BLINK_DEFAULTS.reopenMs });
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
    animationNameSelect.value = "none";
    syncBlockbenchAvailability();
    controller?.rebind();
  });

  const forceLoopBox = document.createElement("input");
  forceLoopBox.type = "checkbox";
  forceLoopBox.checked = true;
  forceLoopBox.addEventListener("change", () => {
    const provider = currentProvider();
    if (provider !== null) {
      provider.forceLoop = forceLoopBox.checked;
    }
  });

  const pausedBox = document.createElement("input");
  pausedBox.type = "checkbox";
  pausedBox.addEventListener("change", () => {
    const provider = currentProvider();
    if (provider !== null) {
      provider.paused = pausedBox.checked;
    }
  });

  const speedInput = document.createElement("input");
  speedInput.type = "number";
  speedInput.min = "0";
  speedInput.step = "0.25";
  speedInput.value = "1";
  speedInput.addEventListener("change", () => {
    const parsed = Number.parseFloat(speedInput.value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return;
    }
    const provider = currentProvider();
    if (provider !== null) {
      provider.speed = parsed;
    }
  });

  /** The bundled provider, built lazily on first use. */
  let blockbench: SkinViewBlockbench | null = null;

  /**
   * The transient upload (file name and the provider built from it),
   * mirroring the skin bar's single `[upload]` entry.
   */
  let animationUpload: {
    /** File name shown in the picker. */
    name: string;
    /** The provider built from the parsed file. */
    provider: SkinViewBlockbench;
  } | null = null;

  /** The file option reserved for the current upload. */
  let uploadOption: HTMLOptionElement | null = null;

  /**
   * Returns the animation names of one file picker value.
   *
   * @param value - The file picker value.
   * @returns The names inside that file.
   */
  const fileNames = (value: string): readonly string[] =>
    value.startsWith("uploaded:")
      ? (animationUpload?.provider.animationNames ?? [])
      : BLOCKBENCH_NAMES;

  /**
   * Returns the provider of the selected file, building the bundled
   * one on first use.
   *
   * @returns The provider behind the file picker.
   */
  const fileProvider = (): SkinViewBlockbench | null => {
    if (animationFileSelect.value.startsWith("uploaded:")) {
      return animationUpload?.provider ?? null;
    }
    blockbench ??= new SkinViewBlockbench({
      animation: exampleAnimation,
      onFinish: () => {
        report("animation finished");
      },
    });
    return blockbench;
  };

  /**
   * Resolves the provider behind the current name picker value.
   *
   * @returns The active provider, or `null` for `none`.
   */
  const currentProvider = (): SkinViewBlockbench | null =>
    animationNameSelect.value === "none" ? null : fileProvider();

  /**
   * Applies the name picker: moves the selected file's provider into
   * the slot when needed and (re)starts its animation.
   */
  const play = (): void => {
    const provider = fileProvider();
    if (provider === null) {
      return;
    }
    const name = animationNameSelect.value;
    if (name === "none") {
      if (viewer.animation === provider) {
        viewer.animation = null;
        controller?.rebind();
      }
      return;
    }
    if (viewer.animation !== provider) {
      viewer.animation = provider;
      controller?.rebind();
    }
    provider.forceLoop = forceLoopBox.checked;
    provider.setAnimation(name);
    pausedBox.checked = provider.paused;
    speedInput.value = String(provider.speed);
    animationSelect.value = "none";
  };

  const animationFileSelect = document.createElement("select");
  {
    const option = document.createElement("option");
    option.value = "example.animation.json";
    option.textContent = "example.animation.json";
    animationFileSelect.append(option);
  }

  const animationNameSelect = document.createElement("select");

  /**
   * Rebuilds the animation-name list for the selected file.
   *
   * @param startFirst - Start the file's first animation.
   */
  const applyFile = (startFirst: boolean): void => {
    const names = fileNames(animationFileSelect.value);
    animationNameSelect.replaceChildren();
    const noneOption = document.createElement("option");
    noneOption.value = "none";
    noneOption.textContent = "none";
    animationNameSelect.append(noneOption);
    for (const name of names) {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      animationNameSelect.append(option);
    }
    animationNameSelect.value =
      startFirst && names[0] !== undefined ? names[0] : "none";
    if (startFirst) {
      play();
    }
  };

  animationFileSelect.addEventListener("change", () => {
    applyFile(true);
    syncBlockbenchAvailability();
  });
  animationNameSelect.addEventListener("change", () => {
    play();
    syncBlockbenchAvailability();
  });

  const restartButton = actionButton("setAnimation", "setAnimation", () => {
    if (animationNameSelect.value !== "none") {
      play();
    }
  });
  restartButton.title = "restart the selected animation from the start";

  const uploadInput = createAnimationUploadControl((name, provider) => {
    provider.onFinish = () => {
      report("animation finished");
    };
    animationUpload = { name, provider };
    if (uploadOption === null) {
      uploadOption = document.createElement("option");
      animationFileSelect.append(uploadOption);
    }
    uploadOption.value = `uploaded:${name}`;
    uploadOption.textContent = `[upload] ${name}`;
    animationFileSelect.value = uploadOption.value;
    applyFile(true);
    syncBlockbenchAvailability();
    report(`uploaded ${name}`);
  });

  /**
   * Recomputes which blockbench controls accept input: the playback
   * rows follow the animation picker; the file picker, the upload and
   * `forceLoop` stay available.
   */
  function syncBlockbenchAvailability(): void {
    const active = animationNameSelect.value !== "none";
    pausedBox.disabled = !active;
    speedInput.disabled = !active;
    restartButton.disabled = !active;
  }

  applyFile(false);
  syncBlockbenchAvailability();

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

  const blockbenchTable = controlTable("skinview3d-blockbench:", [
    optionRow(
      "animation",
      "animation: the provider's input file; pick the bundled copy " +
        "or an uploaded one - the animation list follows this file",
      [animationFileSelect, uploadInput],
    ),
    optionRow(
      "animationName",
      "SkinViewBlockbench.animationName: play a name from the selected " +
        "file; none removes viewer.animation (the torso grouping " +
        "persists once created)",
      [animationNameSelect, restartButton],
    ),
    optionRow(
      "forceLoop",
      "forceLoop: keep looping; the fixture has no loop key, so " +
        "unchecked plays once",
      [forceLoopBox],
    ),
    optionRow(
      "paused",
      "paused: freeze playback; resuming advances the provider's own " +
        "clock (a jump) and a paused provider silences the hooked " +
        "blink; a finished single play stays paused",
      [pausedBox],
    ),
    optionRow(
      "speed",
      "speed: playback rate; 0 freezes without the clock jump (the " +
        "blink timebase freezes with it)",
      [speedInput],
    ),
  ]);

  const controls = document.createElement("div");
  controls.className = "controls";
  controls.append(etfTable, blockbenchTable, hostTable);
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
