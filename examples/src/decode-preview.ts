/**
 * The decoder preview tab.
 *
 * Runs the public `decodeSkin()` API on every example skin and draws
 * each prepared artifact (modified base skin, blink frames, nose
 * texture, coat texture, emissive/enchanted masks) onto a canvas at a
 * uniform size, with a JSON summary panel below. Artifacts that are
 * absent are omitted from the grid.
 */

import type { DecodeResult, PixelData } from "../../src/index";
import { decodeSkin } from "../../src/index";
import {
  getSelectedFixture,
  loadImageData,
  onFixtureSelected,
  type Fixture,
} from "./fixtures";

/**
 * Creates a canvas showing a pixel buffer at an integer scale.
 *
 * @param pixelData - The buffer to draw.
 * @param scale - Integer display scale.
 * @returns The display canvas.
 */
function imageCanvas(pixelData: PixelData, scale: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const source = document.createElement("canvas");
  source.width = pixelData.width;
  source.height = pixelData.height;
  const sourceContext = source.getContext("2d");
  if (sourceContext === null) {
    throw new Error("2d context unavailable");
  }
  const imageData = sourceContext.createImageData(
    pixelData.width,
    pixelData.height,
  );
  imageData.data.set(pixelData.data);
  sourceContext.putImageData(imageData, 0, 0);
  canvas.width = pixelData.width * scale;
  canvas.height = pixelData.height * scale;
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("2d context unavailable");
  }
  context.imageSmoothingEnabled = false;
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Wraps an artifact in a labeled figure.
 *
 * @param title - The caption text.
 * @param pixelData - The buffer to show, or `null` when the feature
 * is absent and the figure should be skipped.
 * @param scale - Integer display scale.
 * @returns The figure element, or `null` for an absent artifact.
 */
function labeled(
  title: string,
  pixelData: PixelData | null,
  scale: number,
): HTMLElement | null {
  if (pixelData === null) {
    return null;
  }
  const figure = document.createElement("figure");
  const caption = document.createElement("figcaption");
  caption.textContent = title;
  figure.append(imageCanvas(pixelData, scale), caption);
  return figure;
}

/**
 * Builds the summary text of one decode result (buffers omitted).
 *
 * @param result - The decode result.
 * @returns Pretty-printed JSON text.
 */
function summaryText(result: DecodeResult): string {
  const summary = {
    supported: result.supported,
    warnings: result.warnings,
    hasMarker: result.hasMarker,
    cells: result.cells,
    slots: result.slots,
    transparency: result.transparency,
    blink:
      result.blink === null
        ? null
        : {
            mode: result.blink.mode,
            eyeHeight: result.blink.eyeHeight,
            frames: result.blink.frames.length,
          },
    nose:
      result.nose === null
        ? null
        : {
            villager: result.nose.villager,
            villagerSkinTextured: result.nose.villagerSkinTextured,
            variant: result.nose.variant,
            removesSource: result.nose.removesSource,
          },
    jacket:
      result.jacket === null
        ? null
        : {
            style: result.jacket.style,
            length: result.jacket.length,
            fat: result.jacket.fat,
            moved: result.jacket.moved,
            top: result.jacket.top,
          },
    emissive:
      result.emissive === null
        ? null
        : { box: result.emissive.box, keys: result.emissive.keys.length },
    enchanted:
      result.enchanted === null
        ? null
        : { box: result.enchanted.box, keys: result.enchanted.keys.length },
  };
  return JSON.stringify(summary, null, 2);
}

/**
 * Decodes one fixture and fills the output container.
 *
 * @param output - The container to fill.
 * @param fixture - The fixture to decode.
 */
async function showFixture(
  output: HTMLElement,
  fixture: Fixture,
): Promise<void> {
  output.textContent = `decoding ${fixture.name}...`;
  const imageData = await loadImageData(fixture.url);
  const original: PixelData = {
    width: imageData.width,
    height: imageData.height,
    data: imageData.data,
  };
  const result = decodeSkin(original);
  const grid = document.createElement("div");
  grid.className = "grid";
  const tiles = [
    labeled("original skin", original, 4),
    labeled("decoded base skin", result.skin, 4),
    labeled("emissive mask", result.emissive?.mask ?? null, 4),
    labeled("enchanted mask", result.enchanted?.mask ?? null, 4),
    labeled("nose texture (8x8)", result.nose?.texture ?? null, 32),
    labeled("coat texture", result.jacket?.texture ?? null, 4),
    ...(result.blink?.frames ?? []).map((frame, index) =>
      labeled(`blink frame ${index + 1}`, frame, 4),
    ),
  ];
  grid.append(...tiles.filter((tile): tile is HTMLElement => tile !== null));
  const summary = document.createElement("pre");
  summary.textContent = summaryText(result);
  output.replaceChildren(grid, summary);
}

/**
 * Reports a failure inside the output container.
 *
 * @param output - The container to fill.
 * @param error - The thrown value.
 */
function showError(output: HTMLElement, error: unknown): void {
  output.textContent = `decode failed: ${String(error)}`;
}

/**
 * Builds the decoder preview UI inside the given container.
 *
 * @param container - The tab panel element.
 */
export function initDecodePreview(container: HTMLElement): void {
  const output = document.createElement("div");
  container.append(output);
  onFixtureSelected((fixture) => {
    showFixture(output, fixture).catch((error: unknown) => {
      showError(output, error);
    });
  });
  const initial = getSelectedFixture();
  if (initial === undefined) {
    output.textContent = "select a sample skin or upload a PNG skin to start";
  } else {
    showFixture(output, initial).catch((error: unknown) => {
      showError(output, error);
    });
  }
}
