/**
 * The shared custom-image picker for the demo's texture rows
 * (`glint.texture` and `villagerNose.texture`): a file input that
 * feeds the picked image to a setter as an object URL (revoking the
 * previous one), plus a reset action restoring the built-in default.
 * Uploaded files are processed in the browser only.
 */

import { actionButton } from "./controls";

/** Options accepted by {@link createTexturePicker}. */
export interface TexturePickerOptions {
  /** The dotted API path for the accessible names. */
  path: string;
  /** Receives the picked object URL, or `undefined` on reset. */
  apply: (source: string | undefined) => void;
}

/** Handle over one texture picker. */
export interface TexturePicker {
  /** The file input for the row's control column. */
  input: HTMLInputElement;
  /** The reset button for the row's action column. */
  reset: HTMLButtonElement;
}

/**
 * Builds the picker: picking a file replaces the current object URL
 * and applies it; resetting revokes it and restores the built-in
 * default.
 *
 * @param options - The dotted path and the apply sink.
 * @returns The input and the reset button.
 */
export function createTexturePicker(
  options: TexturePickerOptions,
): TexturePicker {
  const { path, apply } = options;
  let currentUrl: string | null = null;

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    // Reset the value so picking the same file again still fires.
    input.value = "";
    if (file === undefined) {
      return;
    }
    if (currentUrl !== null) {
      URL.revokeObjectURL(currentUrl);
    }
    currentUrl = URL.createObjectURL(file);
    apply(currentUrl);
  });

  const reset = actionButton("reset", `reset ${path}`, () => {
    if (currentUrl !== null) {
      URL.revokeObjectURL(currentUrl);
      currentUrl = null;
    }
    apply(undefined);
  });

  return { input, reset };
}
