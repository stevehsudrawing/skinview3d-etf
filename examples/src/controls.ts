/**
 * Reusable control-table builders for the demo: API-path rows (the
 * label is the path's last segment, the depth indents it), the
 * per-package tables with hierarchical row ids, the row action
 * buttons aligned in one column, the `execute` buttons and the
 * per-row availability helpers.
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
 * @param controls - The control elements (right column).
 * @param action - A per-row action button, when the row has one.
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
  if (action !== undefined) {
    cell.append(action);
  }
  row.append(header, cell);
  return row;
}

/**
 * Builds a control table for one owner group; the group title doubles
 * as the id namespace and the ids encode the API path
 * (`demo-option-<slug>-<lowercased path segments>`), so equal leaf
 * keywords in different groups stay addressable, and every control
 * without its own label is tied to its row header.
 *
 * @param title - The group title.
 * @param rows - The option rows.
 * @returns The `<table>` element.
 */
export function controlTable(
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
 * action align in one column. The visible text is the API keyword.
 *
 * @param text - The visible label (the API keyword).
 * @param label - The accessible label.
 * @param onClick - The click handler.
 * @returns The `<button>` element.
 */
export function actionButton(
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
 * Builds an `execute` button for a row that runs one API function;
 * the text is the literal `execute` and the accessible name carries
 * the dotted path. The button stays in the control column
 * (left-aligned - no `row-action` class).
 *
 * @param label - The accessible name (`execute glint.texture`).
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
