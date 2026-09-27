/**
 * Demo shell: renders the shared fixture bar above the tabs and
 * lazily initializes each panel (the 3D viewer is only created once
 * its tab is visible). The bar offers the bundled sample skins and a
 * PNG upload control.
 */

import { initDecodePreview } from "./decode-preview";
import { initDemo, type DemoHandle } from "./demo";
import { createFixtureSelect, fixtures } from "./fixtures";
import { createUploadControl } from "./upload";

/**
 * Builds the tab activator: it toggles the button/panel states,
 * initializes each panel on first use and pauses the 3D viewer while
 * hidden.
 *
 * @param demoPanel - The 3D demo panel.
 * @param previewPanel - The decoder preview panel.
 * @param buttons - The tab buttons kept `aria-selected` in sync.
 * @returns The activator for one tab id.
 */
function makeActivator(
  demoPanel: HTMLElement,
  previewPanel: HTMLElement,
  buttons: readonly HTMLButtonElement[],
): (id: string) => void {
  let demoHandle: DemoHandle | null = null;
  let previewReady = false;
  return (id: string): void => {
    for (const button of buttons) {
      button.setAttribute("aria-selected", String(button.dataset.tab === id));
    }
    demoPanel.hidden = id !== "demo";
    previewPanel.hidden = id !== "preview";
    if (id === "demo") {
      demoHandle ??= initDemo(demoPanel);
      demoHandle.activate();
    } else if (id === "preview") {
      if (demoHandle !== null) {
        demoHandle.deactivate();
      }
      if (!previewReady) {
        initDecodePreview(previewPanel);
        previewReady = true;
      }
    }
  };
}

/** Boots the demo shell. */
function main(): void {
  const demoPanel = document.getElementById("panel-demo");
  const previewPanel = document.getElementById("panel-preview");
  if (demoPanel === null || previewPanel === null) {
    throw new Error("demo shell markup is missing");
  }
  const buttons = [
    ...document.querySelectorAll<HTMLButtonElement>("[data-tab]"),
  ];
  const activate = makeActivator(demoPanel, previewPanel, buttons);
  const fixtureBar = document.getElementById("fixture-bar");
  if (fixtureBar !== null) {
    if (fixtures.length > 0) {
      fixtureBar.append("samples: ", createFixtureSelect(), " ");
    }
    const uploadStatus = document.createElement("span");
    uploadStatus.className = "status";
    const uploadControl = createUploadControl((message) => {
      uploadStatus.textContent = message;
    });
    fixtureBar.append(uploadControl.button, uploadControl.input, uploadStatus);
  }
  for (const button of buttons) {
    button.addEventListener("click", () => {
      const id = button.dataset.tab;
      if (id !== undefined) {
        activate(id);
      }
    });
  }
  activate("demo");
}

main();
