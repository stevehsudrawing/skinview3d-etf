/**
 * File controls for the demo shell: one shared hidden-input +
 * `choose`-button pair behind every picker (the PNG skin upload, the
 * Blockbench animation upload and the texture rows), plus the PNG
 * validation flow and the animation parser. Rejections surface
 * through `alert()`; uploaded data never leaves the browser.
 */

import {
  SkinViewBlockbench,
  type AnimationFileType,
} from "skinview3d-blockbench";
import { loadImageData, setUploadedFixture, type Fixture } from "./fixtures";

/** Options accepted by {@link createFileControl}. */
interface FileControlOptions {
  /** The visible button text. */
  label: string;
  /** The `accept` attribute for the picker. */
  accept: string;
  /** The button tooltip, when the control needs one. */
  title?: string;
  /** Receives every picked file (thrown errors alert). */
  handle: (file: File) => void | Promise<void>;
}

/** Handle over one file control. */
interface FileControl {
  /** The hidden native input (in the DOM so the picker opens). */
  input: HTMLInputElement;
  /** The visible button that opens the file picker. */
  button: HTMLButtonElement;
}

/**
 * Builds the shared file-pick pair: a hidden native input and the
 * visible button that opens it - one styled button instead of the
 * browser's own control. Every pick funnels through `handle` with the
 * shared rejection flow (the picker value resets so the same file can
 * be picked again, and thrown errors alert).
 *
 * @param options - The button text, the `accept` filter, the optional
 *   tooltip and the pick handler.
 * @returns The hidden input and the visible button.
 */
export function createFileControl(options: FileControlOptions): FileControl {
  const { label, accept, title, handle } = options;
  const choose = async (file: File): Promise<void> => {
    try {
      await handle(file);
    } catch (error) {
      alert(`upload failed: ${String(error)}`);
    }
  };
  const input = document.createElement("input");
  input.type = "file";
  input.accept = accept;
  input.hidden = true;
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    // Reset the value so picking the same file again still fires.
    input.value = "";
    if (file !== undefined) {
      void choose(file);
    }
  });
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  if (title !== undefined) {
    button.title = title;
  }
  button.addEventListener("click", () => input.click());
  return { input, button };
}

/** The PNG file signature (first eight bytes). */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Whether a size is a skin the demo accepts (64x64 or legacy 64x32).
 *
 * @param width - Image width in pixels.
 * @param height - Image height in pixels.
 * @returns `true` for the supported skin sizes.
 */
function isSupportedSize(width: number, height: number): boolean {
  return (width === 64 && height === 64) || (width === 64 && height === 32);
}

/**
 * Checks the leading bytes of a file against the PNG signature.
 *
 * @param file - The picked file.
 * @returns `true` when the file starts with the PNG signature.
 */
async function hasPngSignature(file: File): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  return (
    head.length === PNG_SIGNATURE.length &&
    PNG_SIGNATURE.every((byte, index) => head[index] === byte)
  );
}

/**
 * Builds the upload control: a button (with its hidden input) that
 * validates the picked PNG, alerts on rejections and publishes
 * accepted skins as the shared fixture.
 *
 * @param onUploaded - Receives the message for an accepted upload.
 * @returns The hidden input and the visible `upload PNG` button.
 */
export function createUploadControl(
  onUploaded: (message: string) => void,
): FileControl {
  /**
   * Probes the image and publishes it when it passes validation.
   *
   * @param file - The picked file.
   */
  const addFixture = async (file: File): Promise<void> => {
    if (!(await hasPngSignature(file))) {
      alert("only PNG files are supported");
      return;
    }
    const url = URL.createObjectURL(file);
    let probe: ImageData;
    try {
      probe = await loadImageData(url);
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
    if (!isSupportedSize(probe.width, probe.height)) {
      URL.revokeObjectURL(url);
      alert(
        `unsupported skin size ${probe.width}x${probe.height}: ` +
          "use a 64x64 skin or a legacy 64x32 skin",
      );
      return;
    }
    const fixture: Fixture = { name: file.name, url, origin: "uploaded" };
    setUploadedFixture(fixture);
    const note = probe.height === 32 ? " (legacy 64x32, converted)" : "";
    onUploaded(`uploaded ${file.name}${note}`);
  };

  return createFileControl({
    label: "upload PNG",
    accept: "image/png",
    handle: addFixture,
  });
}

/**
 * Builds the animation-file upload control: reads the picked
 * `.animation.json`, validates it by trial-building the provider and
 * hands both to the control row (the button's tooltip explains the
 * picker).
 *
 * @param onLoaded - Receives the file name and the provider built
 * from the parsed file.
 * @returns The hidden input and the visible `choose` button.
 */
export function createAnimationUploadControl(
  onLoaded: (name: string, provider: SkinViewBlockbench) => void,
): FileControl {
  /**
   * Parses and builds the provider for one picked file.
   *
   * @param file - The picked file.
   */
  const addAnimation = async (file: File): Promise<void> => {
    const animation = JSON.parse(await file.text()) as AnimationFileType;
    const provider = new SkinViewBlockbench({ animation });
    onLoaded(file.name, provider);
  };

  return createFileControl({
    label: "choose",
    accept: ".json,application/json",
    title: "upload your own Blockbench .animation.json",
    handle: addAnimation,
  });
}
