/**
 * The `skinview3d-blockbench` control group: the file picker (the
 * bundled fixture plus one transient `[upload]` entry), the animation
 * list that follows the selected file, and the playback controls
 * (`forceLoop`, `connectCape`, `paused`, `speed`, `setAnimation`).
 * The group owns the provider state and drives the shared
 * `viewer.animation` slot; the demo reveals it through the
 * `SkinViewBlockbench` mode of the viewer's animation picker and
 * calls `release()` when the mode is left. Every parameter row and
 * the provider row carry a `reset`; both group resets also restore
 * the bundled provider's playback and binding values.
 */

import type { SkinViewer } from "skinview3d";
import { SkinViewBlockbench } from "skinview3d-blockbench";
import exampleAnimation from "./assets/animations/example.animation.json";
import {
  controlTable,
  executeButton,
  lockedInput,
  numberInput,
  optionRow,
  resetAllButton,
  resetCheckbox,
  resetRow,
  resetValue,
} from "./controls";
import { createAnimationUploadControl } from "./upload";

/** Animation names inside the bundled blockbench fixture. */
const BLOCKBENCH_NAMES = Object.keys(exampleAnimation.animations);

/** The bundled animation file's picker value. */
const BUNDLED_FILE = "example.animation.json";

/** The playback speed the group starts from (and resets to). */
const DEFAULT_SPEED = 1;

/** Options accepted by {@link createBlockbenchGroup}. */
export interface BlockbenchGroupOptions {
  /** The viewer whose `animation` slot the group drives. */
  viewer: SkinViewer;
  /** Status-line sink for upload and finish messages. */
  report: (message: string) => void;
  /** The group table's title (the versioned npm path). */
  title: string;
  /** The title's link target (its versioned npm page). */
  titleHref: string;
  /** Called whenever the group takes or releases the slot. */
  onSlotChange: () => void;
}

/** Handle over the blockbench control group. */
export interface BlockbenchGroup {
  /** The blockbench control table (the title comes from options). */
  table: HTMLTableElement;
  /** Clears the pickers; call when the host picker takes the slot. */
  release(): void;
}

/**
 * Builds the blockbench control group.
 *
 * @param options - The viewer, the status sink and the slot callback.
 * @returns The group handle with its table.
 */
export function createBlockbenchGroup(
  options: BlockbenchGroupOptions,
): BlockbenchGroup {
  const { viewer, report, title, titleHref, onSlotChange } = options;

  /** The row resets in row order; the title row's `reset` runs them. */
  const resets: Array<() => void> = [];

  const forceLoopBox = document.createElement("input");
  forceLoopBox.type = "checkbox";
  forceLoopBox.checked = true;
  forceLoopBox.addEventListener("change", () => {
    const provider = currentProvider();
    if (provider !== null) {
      provider.forceLoop = forceLoopBox.checked;
    }
  });

  const connectCapeBox = document.createElement("input");
  connectCapeBox.type = "checkbox";
  connectCapeBox.addEventListener("change", () => {
    const provider = currentProvider();
    if (provider !== null) {
      provider.connectCape = connectCapeBox.checked;
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

  const speedInput = numberInput(
    DEFAULT_SPEED,
    0.25,
    (value) => {
      if (value < 0) {
        return;
      }
      const provider = currentProvider();
      if (provider !== null) {
        provider.speed = value;
      }
    },
    0,
  );

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
        onSlotChange();
      }
      return;
    }
    if (viewer.animation !== provider) {
      viewer.animation = provider;
      onSlotChange();
    }
    provider.forceLoop = forceLoopBox.checked;
    provider.connectCape = connectCapeBox.checked;
    provider.setAnimation(name);
    pausedBox.checked = provider.paused;
    speedInput.value = String(provider.speed);
  };

  const animationFileSelect = document.createElement("select");
  {
    const option = document.createElement("option");
    option.value = BUNDLED_FILE;
    option.textContent = BUNDLED_FILE;
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
    noneOption.textContent = "null";
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

  /** The `setAnimation` description: button tooltip and row share it. */
  const setAnimationDescription =
    "SkinViewBlockbench.setAnimation(animation_name, options?): " +
    "restart the selected animation from the start (the optional " +
    "options parameter is unused here)";
  /** The `animation_name` description: lock reason and row share it. */
  const animationNameDescription =
    "SkinViewBlockbench.setAnimation.animation_name: locked, the " +
    "demo passes the animationName picker selection";
  const setAnimationButton = executeButton(
    "execute SkinViewBlockbench.setAnimation",
    () => {
      if (animationNameSelect.value !== "none") {
        play();
      }
    },
  );
  setAnimationButton.title = setAnimationDescription;
  const animationNameParam = lockedInput("", animationNameDescription);

  const upload = createAnimationUploadControl((name, provider) => {
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
    setAnimationButton.disabled = !active;
    animationNameParam.value = animationNameSelect.value;
  }

  const rows = [
    optionRow(
      ["SkinViewBlockbench"],
      "SkinViewBlockbench: the blockbench animation provider",
      [],
      resetAllButton("reset SkinViewBlockbench", resets),
    ),
    optionRow(
      ["SkinViewBlockbench", "animation"],
      "SkinViewBlockbench.animation: the provider's input file; pick " +
        "the bundled copy or an uploaded one - the animation list " +
        "follows this file",
      [animationFileSelect, upload.button, upload.input],
      resetRow(
        ["SkinViewBlockbench", "animation"],
        () => {
          // Back to the bundled file; the transient upload goes away.
          animationUpload = null;
          uploadOption?.remove();
          uploadOption = null;
          resetValue(animationFileSelect, BUNDLED_FILE);
        },
        resets,
      ),
    ),
    optionRow(
      ["SkinViewBlockbench", "animationName"],
      "SkinViewBlockbench.animationName: play a name from the selected " +
        "file; null releases the slot (viewer.animation = null; the " +
        "torso grouping persists once created)",
      [animationNameSelect],
      resetRow(
        ["SkinViewBlockbench", "animationName"],
        () => resetValue(animationNameSelect, "none"),
        resets,
      ),
    ),
    optionRow(["SkinViewBlockbench", "setAnimation"], setAnimationDescription, [
      setAnimationButton,
    ]),
    optionRow(
      ["SkinViewBlockbench", "setAnimation", "animation_name"],
      animationNameDescription,
      [animationNameParam],
    ),
    optionRow(
      ["SkinViewBlockbench", "forceLoop"],
      "SkinViewBlockbench.forceLoop: keep looping; the fixture has " +
        "no loop key, so unchecked plays once",
      [forceLoopBox],
      resetRow(
        ["SkinViewBlockbench", "forceLoop"],
        () => resetCheckbox(forceLoopBox, true),
        resets,
      ),
    ),
    optionRow(
      ["SkinViewBlockbench", "connectCape"],
      "SkinViewBlockbench.connectCape: wrap the cape while a " +
        "Torso-bone animation drives the body; the binding forms " +
        "once, on the first animated frame, and later toggles neither " +
        "connect nor disconnect (reload to rebind)",
      [connectCapeBox],
      resetRow(
        ["SkinViewBlockbench", "connectCape"],
        () => resetCheckbox(connectCapeBox, false),
        resets,
      ),
    ),
    optionRow(
      ["SkinViewBlockbench", "paused"],
      "SkinViewBlockbench.paused: freeze playback; resuming advances " +
        "the provider's own clock (a jump) and a paused provider " +
        "silences the hooked blink; a finished single play stays " +
        "paused",
      [pausedBox],
      resetRow(
        ["SkinViewBlockbench", "paused"],
        () => resetCheckbox(pausedBox, false),
        resets,
      ),
    ),
    optionRow(
      ["SkinViewBlockbench", "speed"],
      "SkinViewBlockbench.speed: playback rate; 0 freezes without " +
        "the clock jump (the blink timebase freezes with it)",
      [speedInput],
      resetRow(
        ["SkinViewBlockbench", "speed"],
        () => resetValue(speedInput, String(DEFAULT_SPEED)),
        resets,
      ),
    ),
  ];
  // One trailing step: the row resets stop the playback first, so
  // the controls no longer reach the bundled provider - but `play()`
  // re-reads the provider's values, so the pristine state must reach
  // it too (the upload provider is gone with its entry).
  resets.push(() => {
    if (blockbench !== null) {
      blockbench.forceLoop = true;
      blockbench.connectCape = false;
      blockbench.paused = false;
      blockbench.speed = DEFAULT_SPEED;
    }
  });
  const table = controlTable(title, titleHref, rows, resets);

  /**
   * Clears the pickers; the demo calls this when the viewer's picker
   * leaves the blockbench mode.
   */
  const release = (): void => {
    animationNameSelect.value = "none";
    syncBlockbenchAvailability();
  };

  applyFile(false);
  syncBlockbenchAvailability();

  return { table, release };
}
