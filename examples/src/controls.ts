/**
 * Reusable control-table builders for the demo: keyword-labeled
 * option rows, the per-package tables with namespaced row ids, and
 * the row action buttons aligned in one column.
 */

/**
 * Builds one option row for a control table: the label is the API
 * keyword wrapped in a `code` element whose `title` describes it.
 * `controlTable` assigns the row id and ties every direct input /
 * select child to it through `aria-labelledby`.
 *
 * @param label - The API keyword (left column).
 * @param description - The plain-English tooltip text.
 * @param controls - The control elements (right column).
 * @param action - A per-row action button, when the row has one.
 * @returns The `<tr>` element.
 */
export function optionRow(
  label: string,
  description: string,
  controls: readonly Node[],
  action?: HTMLButtonElement,
): HTMLTableRowElement {
  const row = document.createElement("tr");
  const header = document.createElement("th");
  header.scope = "row";
  const keyword = document.createElement("code");
  keyword.textContent = label;
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
 * as the `<th>` id namespace (`demo-option-<slug>-<keyword>`), so
 * equal keywords in different tables stay addressable, and every
 * control without its own label is tied to its row header.
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
    const keyword = rowHeader?.querySelector("code")?.textContent;
    if (rowHeader === null || keyword === undefined) {
      continue;
    }
    rowHeader.id = `demo-option-${slug}-${keyword.toLowerCase()}`;
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
