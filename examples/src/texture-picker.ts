/**
 * The shared custom-image picker for the demo's texture rows
 * (`enchanted.texture` and `villagerNose.texture`) and the cape row:
 * a select showing the current choice - the API states (`undefined`,
 * `null`) or a bundled / transient `[upload] <name>` entry - plus a
 * `choose` button opening the file picker. Picked images live as
 * object URLs; the row reset revokes the URL, drops the entry and
 * restores the first empty choice. Uploaded files are processed in
 * the browser only.
 */

import { createFileControl } from "./upload";

/** The select value for the API's `undefined` (the built-in default). */
const UNDEFINED = "undefined";

/** The select value for the API's `null` (the feature off / the unload). */
const NULL = "null";

/** One ready-made entry of a texture picker. */
interface TexturePickerEntry {
  /** The select value (passed to `apply` when chosen). */
  value: string;
  /** The visible option label. */
  label: string;
}

/** Options accepted by {@link createTexturePicker}. */
interface TexturePickerOptions {
  /** Ready-made entries, placed after the empty choices. */
  entries?: readonly TexturePickerEntry[];
  /** The API-state choices to offer, in order. */
  empties?: readonly ("undefined" | "null")[];
}

/** Handle over one texture picker. */
interface TexturePicker {
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
 * Builds the picker: the select switches between the empty choices,
 * the ready-made entries and the uploaded file; choosing a file
 * replaces the current object URL (revoking the previous one); the
 * reset revokes the URL, drops the upload entry and restores the
 * first empty choice.
 *
 * @param apply - Receives every chosen source.
 * @param options - The ready-made entries and the empty choices
 *   (the defaults reproduce the two texture rows).
 * @returns The select, the choose button (with its hidden input)
 *   and the reset.
 */
export function createTexturePicker(
  apply: (source: string | null | undefined) => void,
  options: TexturePickerOptions = {},
): TexturePicker {
  const empties = options.empties ?? [UNDEFINED, NULL];
  const entries = options.entries ?? [];
  let currentUrl: string | null = null;
  let uploadOption: HTMLOptionElement | null = null;

  const select = document.createElement("select");
  for (const value of empties) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  }
  for (const entry of entries) {
    const option = document.createElement("option");
    option.value = entry.value;
    option.textContent = entry.label;
    select.append(option);
  }
  /** Applies one select value through the picker's source mapping. */
  const applyChoice = (choice: string): void => {
    apply(choice === UNDEFINED ? undefined : choice === NULL ? null : choice);
  };
  select.addEventListener("change", () => {
    applyChoice(select.value);
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
    const target = empties[0] ?? UNDEFINED;
    select.value = target;
    applyChoice(target);
  };

  return { select, choose: button, input, reset };
}
