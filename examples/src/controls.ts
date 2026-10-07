/**
 * Reusable control-table builders for the demo: API-path rows (the
 * label is the path's last segment, the depth indents it), the
 * per-package tables with hierarchical row ids, the row action
 * buttons (resets) aligned in their own column, the group resets,
 * the `execute` buttons, the locked parameters, the value-reset
 * helpers, the number inputs and the per-row availability helpers.
 */

/**
 * Builds one option row for a control table: the label is the last
 * segment of the row's API path, wrapped in a `code` element whose
 * `title` carries the description; the path depth becomes the
 * `--depth` indent (set on the label), and `controlTable` composes
 * the row id from the whole path and ties every direct input /
 * select child to it through `aria-labelledby`.
 *
 * @param path - The API path (display = last segment, depth =
 *   `path.length - 1`).
 * @param description - The plain-English tooltip text.
 * @param controls - The control elements (the middle column).
 * @param action - A per-row action button, when the row has one; it
 *   renders in the row's action column (the third cell).
 * @returns The `<tr>` element.
 */
export function optionRow(
  path: readonly string[],
  description: string,
  controls: readonly Node[],
  action?: HTMLButtonElement,
): HTMLTableRowElement {
  const row = document.createElement("tr");
  row.dataset.optionPath = path.join(".");
  const header = document.createElement("th");
  header.scope = "row";
  const keyword = document.createElement("code");
  keyword.textContent = path[path.length - 1] ?? "";
  keyword.style.setProperty("--depth", String(path.length - 1));
  keyword.title = description;
  header.append(keyword);
  const cell = document.createElement("td");
  cell.append(...controls);
  const actionCell = document.createElement("td");
  actionCell.className = "row-action-cell";
  if (action !== undefined) {
    actionCell.append(action);
  }
  row.append(header, cell, actionCell);
  return row;
}

/**
 * Builds a control table for one owner group; the group title renders
 * as a link and doubles as the id namespace - the ids encode the API
 * path (`demo-option-<slug>-<lowercased path segments>`), where the
 * slug is the title's segment before the first `/` (the package
 * name), so version bumps never move the ids, and every control
 * without its own label is tied to its row header.
 *
 * @param title - The group title (the `name/v/version` display path).
 * @param titleHref - The title's link target (its versioned npm page).
 * @param rows - The option rows.
 * @param resets - The row resets collected in row order; when given,
 *   the title row gains the group `reset` (it runs every callback
 *   directly, so disabled rows reset too).
 * @returns The `<table>` element.
 */
export function controlTable(
  title: string,
  titleHref: string,
  rows: readonly HTMLTableRowElement[],
  resets?: readonly (() => void)[],
): HTMLTableElement {
  const table = document.createElement("table");
  table.className = "control-group";
  const titleRow = document.createElement("tr");
  const header = document.createElement("th");
  header.colSpan = resets === undefined ? 3 : 2;
  header.className = "group-title";
  const link = document.createElement("a");
  link.href = titleHref;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = title;
  header.append(link);
  titleRow.append(header);
  // The package name (before the first `/`) is the id namespace.
  const slug = title.split("/")[0].toLowerCase();
  if (resets !== undefined) {
    const actionCell = document.createElement("td");
    actionCell.className = "row-action-cell";
    actionCell.append(resetAllButton(`reset ${slug}`, resets));
    titleRow.append(actionCell);
  }
  for (const row of rows) {
    const rowHeader = row.querySelector("th");
    const path = row.dataset.optionPath?.split(".");
    if (rowHeader === null || path === undefined || path.length === 0) {
      continue;
    }
    const suffix = path.map((segment) => segment.toLowerCase()).join("-");
    rowHeader.id = `demo-option-${slug}-${suffix}`;
    for (const control of row.querySelectorAll("td > *")) {
      if (
        (control instanceof HTMLInputElement ||
          control instanceof HTMLSelectElement) &&
        !control.hasAttribute("aria-label")
      ) {
        control.setAttribute("aria-labelledby", rowHeader.id);
      }
    }
  }
  table.append(titleRow, ...rows);
  return table;
}

/**
 * Builds a row action button; the `row-action` class lets every row
 * action align in the action column. The visible text is the API
 * keyword.
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
  button.className = "row-action";
  button.textContent = text;
  button.setAttribute("aria-label", label);
  button.addEventListener("click", onClick);
  return button;
}

/**
 * Builds one row's `reset` control and registers its callback with
 * every given list (the table's and its parameter groups'). The
 * group resets run the callbacks directly - a disabled row disables
 * its button too, so clicks cannot be replayed.
 *
 * @param path - The row's API path (the accessible name reads
 *   `reset <dotted path>`).
 * @param reset - Restores the row's default.
 * @param groups - The reset lists to append to (in row order per
 *   list).
 * @returns The reset button for the row's action cell.
 */
export function resetRow(
  path: readonly string[],
  reset: () => void,
  ...groups: Array<Array<() => void>>
): HTMLButtonElement {
  for (const group of groups) {
    group.push(reset);
  }
  return actionButton("reset", `reset ${path.join(".")}`, reset);
}

/**
 * Builds a `reset` control that runs the given callbacks in order;
 * the table titles and the parameter-group rows use it (registered
 * row resets stay on the rows themselves).
 *
 * @param label - The accessible name (`reset <dotted path>`).
 * @param steps - The callbacks to run.
 * @returns The `<button>` element.
 */
export function resetAllButton(
  label: string,
  steps: readonly (() => void)[],
): HTMLButtonElement {
  return actionButton("reset", label, () => {
    for (const step of steps) {
      step();
    }
  });
}

/**
 * Restores one checkbox to a value and replays its `change`
 * listeners, so the row's own handler applies the default; the
 * programmatic event reaches disabled controls, and the handlers
 * guard their controller access. Controls wired to `input` events
 * (the color and range rows) reset directly instead.
 *
 * @param box - The checkbox to restore.
 * @param checked - The default checked state.
 */
export function resetCheckbox(box: HTMLInputElement, checked: boolean): void {
  box.checked = checked;
  box.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Restores one select or change-driven input value and replays its
 * `change` listeners.
 *
 * @param control - The control to restore.
 * @param value - The default value.
 */
export function resetValue(
  control: HTMLInputElement | HTMLSelectElement,
  value: string,
): void {
  control.value = value;
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Builds an `execute` button for a row that runs one API function;
 * the text is the literal `execute` and the accessible name carries
 * the dotted path. The button stays in the control column
 * (left-aligned - no `row-action` class).
 *
 * @param label - The accessible name (`execute enchanted.texture`).
 * @param onClick - The click handler.
 * @returns The `<button>` element.
 */
export function executeButton(
  label: string,
  onClick: () => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "row-execute";
  button.textContent = "execute";
  button.setAttribute("aria-label", label);
  button.addEventListener("click", onClick);
  return button;
}

/**
 * Builds a locked parameter for an operation row: a read-only text
 * input whose value the demo derives from elsewhere. `readonly` (not
 * `disabled`) keeps the input focusable, selectable and hoverable -
 * disabled form controls swallow mouse events, which would break the
 * tooltip carrying the lock reason. Callers keep the value in sync
 * and explain the derivation in `reason`.
 *
 * @param value - The initial text value.
 * @param reason - The tooltip explaining why the value is locked.
 * @returns The read-only input element.
 */
export function lockedInput(value: string, reason: string): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "text";
  input.readOnly = true;
  input.className = "locked";
  input.value = value;
  input.title = reason;
  return input;
}

/**
 * Builds one number input for a control row (blink timings, enchanted
 * values, the blockbench playback speed).
 *
 * @param value - The initial value.
 * @param step - The spinner step.
 * @param apply - Receives every valid value (change events only).
 * @param min - The `min` attribute, when the value has a floor.
 * @param max - The `max` attribute, when the value has a ceiling.
 * @returns The input element.
 */
export function numberInput(
  value: number,
  step: number,
  apply: (value: number) => void,
  min: number | null = null,
  max: number | null = null,
): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "number";
  if (min !== null) {
    input.min = String(min);
  }
  if (max !== null) {
    input.max = String(max);
  }
  input.step = String(step);
  input.value = String(value);
  input.addEventListener("change", () => {
    const parsed = Number.parseFloat(input.value);
    if (Number.isFinite(parsed)) {
      apply(parsed);
    }
  });
  return input;
}

/**
 * Enables or disables every form control in a row.
 *
 * @param row - The row to update.
 * @param disabled - Whether the controls accept input.
 */
export function setRowDisabled(
  row: HTMLTableRowElement,
  disabled: boolean,
): void {
  for (const control of row.querySelectorAll("input, select, button")) {
    if (
      control instanceof HTMLInputElement ||
      control instanceof HTMLSelectElement ||
      control instanceof HTMLButtonElement
    ) {
      control.disabled = disabled;
    }
  }
}

/**
 * Marks a row as inapplicable to the current skin: the label grays
 * out and the tooltip gains a note (the base title is remembered so
 * the note is removed again when the row becomes applicable).
 * Control enablement stays with the caller (see
 * {@link setRowDisabled}).
 *
 * @param row - The row to mark.
 * @param inactive - Whether the row is inapplicable.
 */
export function setRowInapplicable(
  row: HTMLTableRowElement,
  inactive: boolean,
): void {
  row.classList.toggle("inapplicable", inactive);
  const keyword = row.querySelector("code");
  if (keyword === null) {
    return;
  }
  const base = keyword.dataset.baseTitle ?? keyword.title;
  keyword.dataset.baseTitle = base;
  keyword.title =
    inactive && base !== ""
      ? `${base} (not applicable to the current skin)`
      : base;
}
