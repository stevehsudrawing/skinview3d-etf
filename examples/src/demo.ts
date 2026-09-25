/**
 * The 3D demo tab.
 *
 * Creates a `SkinViewer` inside a square stage, attaches the ETF
 * features through the public `attachETFSkinFeatures()` API and
 * offers two-column controls grouped by owner (the extension first):
 * the extension's attach switch plus the transparency / nose /
 * emissive toggles, and the host's built-in action presets plus
 * light-intensity sliders. The skin shown comes from the shared
 * fixture bar above the tabs.
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
} from "skinview3d";
import type { ETFController } from "../../src/index";
import { attachETFSkinFeatures } from "../../src/index";
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
      },
      onWarning: (message) => {
        report(`warning: ${message}`);
        console.warn(message);
      },
    });
    attachBox.checked = true;
    attachBox.disabled = false;
    transparencyBox.disabled = false;
    noseBox.disabled = false;
    emissiveBox.disabled = false;
  };

  /** Detaches and disposes the controller when attached. */
  const detachController = (): void => {
    if (controller === null) {
      return;
    }
    controller.detach();
    controller = null;
    attachBox.checked = false;
    transparencyBox.disabled = true;
    noseBox.disabled = true;
    emissiveBox.disabled = true;
  };

  /**
   * Loads a fixture skin and refreshes the controller.
   *
   * @param fixture - The fixture to show.
   */
  const showFixture = async (fixture: Fixture): Promise<void> => {
    report(`loading ${fixture.name}...`);
    await viewer.loadSkin(fixture.url);
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
  });

  const ambientLight = document.createElement("input");
  ambientLight.type = "range";
  ambientLight.min = "0";
  ambientLight.max = "4";
  ambientLight.step = "0.1";
  ambientLight.title = "globalLight.intensity";
  ambientLight.value = String(viewer.globalLight.intensity);
  ambientLight.addEventListener("input", () => {
    viewer.globalLight.intensity = Number(ambientLight.value);
  });

  const cameraLight = document.createElement("input");
  cameraLight.type = "range";
  cameraLight.min = "0";
  cameraLight.max = "2";
  cameraLight.step = "0.1";
  cameraLight.title = "cameraLight.intensity";
  cameraLight.value = String(viewer.cameraLight.intensity);
  cameraLight.addEventListener("input", () => {
    viewer.cameraLight.intensity = Number(cameraLight.value);
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

  const attachRow = document.createElement("label");
  attachRow.append(attachBox, " attach");
  const transparencyRow = document.createElement("label");
  transparencyRow.append(transparencyBox, " transparency");
  const noseRow = document.createElement("label");
  noseRow.append(noseBox, " nose");
  const emissiveRow = document.createElement("label");
  emissiveRow.append(emissiveBox, " emissive");

  const etfGroup = document.createElement("div");
  etfGroup.className = "control-group";
  const etfLabel = document.createElement("span");
  etfLabel.className = "label";
  etfLabel.textContent = "skinview3d-etf:";
  etfGroup.append(etfLabel, attachRow, transparencyRow, noseRow, emissiveRow);

  const actionRow = document.createElement("label");
  actionRow.append("action ", animationSelect);
  const ambientRow = document.createElement("label");
  ambientRow.append("ambient ", ambientLight);
  const cameraRow = document.createElement("label");
  cameraRow.append("camera ", cameraLight);

  const hostGroup = document.createElement("div");
  hostGroup.className = "control-group";
  const hostLabel = document.createElement("span");
  hostLabel.className = "label";
  hostLabel.textContent = "skinview3d:";
  hostGroup.append(hostLabel, actionRow, ambientRow, cameraRow);

  const controls = document.createElement("div");
  controls.className = "controls";
  controls.append(etfGroup, hostGroup);
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
