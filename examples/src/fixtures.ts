/// <reference types="vite/client" />
/**
 * Demo support: the bundled fixture list, the selection shared by the
 * whole demo shell (fixture bar and tabs) and small helpers.
 */

/** One fixture skin. */
export interface Fixture {
  /** File name including the `.png` suffix. */
  name: string;
  /** URL the browser loads the image from. */
  url: string;
  /** Where the fixture comes from. */
  origin: "bundled" | "uploaded";
}

const fixtureModules = import.meta.glob("./assets/skins/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

/** Every bundled fixture skin, sorted by name. */
export const fixtures: Fixture[] = Object.entries(fixtureModules)
  .map(([path, url]) => ({
    name: path.split("/").pop() ?? path,
    url,
    origin: "bundled" as const,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

/** The fixture preferred on load, when present. */
const PREFERRED_FIXTURE_NAME = "example.png";

/**
 * Returns the fixture selected on load.
 *
 * @returns The preferred fixture, the first one, or `undefined` when
 * no fixtures exist.
 */
function preferredFixture(): Fixture | undefined {
  return (
    fixtures.find((fixture) => fixture.name === PREFERRED_FIXTURE_NAME) ??
    fixtures[0]
  );
}

/** The fixture selected in both tabs. */
let selected: Fixture | undefined = preferredFixture();

/** Listeners notified whenever the shared selection changes. */
const listeners = new Set<(fixture: Fixture) => void>();

/** The most recent upload; its object URL is revoked when replaced. */
let uploaded: Fixture | null = null;

/**
 * Returns the fixture both tabs are showing.
 *
 * @returns The selected fixture, or `undefined` when none exist.
 */
export function getSelectedFixture(): Fixture | undefined {
  return selected;
}

/**
 * Replaces the shared selection and notifies every listener. Selecting
 * the fixture that is already selected does nothing unless `force` is
 * set (uploads re-notify so the same file name reloads).
 *
 * @param fixture - The fixture to select.
 * @param force - Notify even when the fixture is already selected.
 */
export function setSelectedFixture(fixture: Fixture, force = false): void {
  if (!force && selected !== undefined && selected.name === fixture.name) {
    return;
  }
  selected = fixture;
  for (const listener of [...listeners]) {
    listener(fixture);
  }
}

/**
 * Publishes an uploaded skin as the shared fixture and revokes the
 * object URL of the previous upload.
 *
 * @param fixture - The uploaded fixture (origin `"uploaded"`).
 */
export function setUploadedFixture(fixture: Fixture): void {
  if (uploaded !== null && uploaded.url !== fixture.url) {
    URL.revokeObjectURL(uploaded.url);
  }
  uploaded = fixture;
  setSelectedFixture(fixture, true);
}

/**
 * Returns the current upload, when one exists.
 *
 * @returns The uploaded fixture, or `null`.
 */
export function getUploadedFixture(): Fixture | null {
  return uploaded;
}

/**
 * Subscribes to shared-selection changes.
 *
 * @param listener - Called with the new fixture on every change.
 * @returns A function that removes the subscription.
 */
export function onFixtureSelected(
  listener: (fixture: Fixture) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Loads a PNG into an `ImageData` through a 2d canvas.
 *
 * @param url - The image URL to load.
 * @returns The decoded pixels.
 */
export async function loadImageData(url: string): Promise<ImageData> {
  const image = new Image();
  image.src = url;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (context === null) {
    throw new Error("2d context unavailable");
  }
  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Builds the fixture picker for the shared fixture bar: it lists the
 * bundled skins, keeps one transient `[upload]` entry for the current
 * upload and stays in sync with the shared selection.
 *
 * @returns The `<select>` element.
 */
export function createFixtureSelect(): HTMLSelectElement {
  const select = document.createElement("select");
  for (const fixture of fixtures) {
    const option = document.createElement("option");
    option.value = fixture.name;
    option.textContent = fixture.name;
    select.append(option);
  }
  let uploadOption: HTMLOptionElement | null = null;
  /** Mirrors one selection change into the picker. */
  const sync = (fixture: Fixture): void => {
    if (fixture.origin === "uploaded") {
      if (uploadOption === null) {
        uploadOption = document.createElement("option");
        select.append(uploadOption);
      }
      uploadOption.value = `uploaded:${fixture.name}`;
      uploadOption.textContent = `[upload] ${fixture.name}`;
      select.value = uploadOption.value;
      return;
    }
    select.value = fixture.name;
  };
  const current = getSelectedFixture();
  if (current !== undefined) {
    sync(current);
  }
  select.addEventListener("change", () => {
    if (select.value.startsWith("uploaded:")) {
      const upload = getUploadedFixture();
      if (upload !== null) {
        setSelectedFixture(upload, true);
      }
      return;
    }
    const fixture = fixtures.find((entry) => entry.name === select.value);
    if (fixture !== undefined) {
      setSelectedFixture(fixture);
    }
  });
  onFixtureSelected(sync);
  return select;
}
