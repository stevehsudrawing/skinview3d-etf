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
 * Activates one tab: toggles the button/panel states, initializes the
 * panel on first use and pauses the 3D viewer while hidden.
 *
 * @param demoPanel - The 3D demo panel.
 * @param previewPanel - The decoder preview panel.
 * @param id - The tab to activate.
 */
function makeActivator(
  demoPanel: HTMLElement,
  previewPanel: HTMLElement,
): (id: string) => void {
  const buttons = [
    ...document.querySelectorAll<HTMLButtonElement>("[data-tab]"),
  ];
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
  const activate = makeActivator(demoPanel, previewPanel);
  const fixtureBar = document.getElementById("fixture-bar");
  if (fixtureBar !== null) {
    if (fixtures.length > 0) {
      fixtureBar.append("samples: ", createFixtureSelect(), " ");
    }
    const uploadStatus = document.createElement("span");
    uploadStatus.className = "status";
    fixtureBar.append(
      createUploadControl((message) => {
        uploadStatus.textContent = message;
      }),
      uploadStatus,
    );
  }
  const buttons = [
    ...document.querySelectorAll<HTMLButtonElement>("[data-tab]"),
  ];
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
