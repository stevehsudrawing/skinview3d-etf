/**
 * The shared custom-image picker for the demo's texture rows
 * (`enchanted.texture` and `villagerNose.texture`): a select showing
 * the current choice - `undefined` (the built-in default), `null`
 * (the feature off) or a transient `[upload] <name>` entry - plus a
 * `choose` button opening the file picker. Picked images live as
 * object URLs; the row reset revokes the URL, drops the entry and
 * restores `undefined`. Uploaded files are processed in the browser
 * only.
 */

import { createFileControl } from "./upload";

/** The select value for the API's `undefined` (the built-in default). */
const UNDEFINED = "undefined";

/** The select value for the API's `null` (the feature off). */
const NULL = "null";

/** Handle over one texture picker. */
export interface TexturePicker {
  /** The choice select for the row's control column. */
  select: HTMLSelectElement;
  /** The visible button opening the file picker. */
  choose: HTMLButtonElement;
  /** The hidden native input behind the button (kept in the DOM). */
  input: HTMLInputElement;
  /** Restores the pristine state (revokes the upload URL). */
  reset(): void;
}

/**
 * Builds the picker: the select switches between the API states and
 * the uploaded file; choosing a file replaces the current object URL
 * (revoking the previous one); the reset revokes the URL, drops the
 * upload entry and restores the built-in default.
 *
 * @param apply - Receives every chosen source.
 * @returns The select, the choose button (with its hidden input)
 *   and the reset.
 */
export function createTexturePicker(
  apply: (source: string | null | undefined) => void,
): TexturePicker {
  let currentUrl: string | null = null;
  let uploadOption: HTMLOptionElement | null = null;

  const select = document.createElement("select");
  for (const value of [UNDEFINED, NULL]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  }
  select.addEventListener("change", () => {
    const choice = select.value;
    apply(choice === UNDEFINED ? undefined : choice === NULL ? null : choice);
  });

  const { input, button } = createFileControl({
    label: "choose",
    accept: "image/*",
    handle: (file) => {
      if (currentUrl !== null) {
        URL.revokeObjectURL(currentUrl);
      }
      currentUrl = URL.createObjectURL(file);
      if (uploadOption === null) {
        uploadOption = document.createElement("option");
        select.append(uploadOption);
      }
      uploadOption.value = currentUrl;
      uploadOption.textContent = `[upload] ${file.name}`;
      select.value = currentUrl;
      apply(currentUrl);
    },
  });

  const reset = (): void => {
    if (currentUrl !== null) {
      URL.revokeObjectURL(currentUrl);
      currentUrl = null;
    }
    uploadOption?.remove();
    uploadOption = null;
    select.value = UNDEFINED;
    apply(undefined);
  };

  return { select, choose: button, input, reset };
}
