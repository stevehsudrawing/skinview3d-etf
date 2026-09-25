/**
 * PNG-only skin upload for the demo shell: validates the picked file
 * locally and publishes it as the shared fixture. Rejections surface
 * through `alert()`; accepted uploads are reported through the
 * callback. Uploaded pixels never leave the browser.
 */

import { loadImageData, setUploadedFixture, type Fixture } from "./fixtures";

/** The PNG file signature (first eight bytes). */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Whether a size is a skin the demo accepts (64x64 or legacy 64x32).
 *
 * @param width - Image width in pixels.
 * @param height - Image height in pixels.
 * @returns `true` for the supported skin sizes.
 */
function isSupportedSize(width: number, height: number): boolean {
  return (width === 64 && height === 64) || (width === 64 && height === 32);
}

/**
 * Checks the leading bytes of a file against the PNG signature.
 *
 * @param file - The picked file.
 * @returns `true` when the file starts with the PNG signature.
 */
async function hasPngSignature(file: File): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  return (
    head.length === PNG_SIGNATURE.length &&
    PNG_SIGNATURE.every((byte, index) => head[index] === byte)
  );
}

/**
 * Builds the upload control: a labeled file input that validates the
 * picked PNG, alerts on rejections and publishes accepted skins as
 * the shared fixture.
 *
 * @param onUploaded - Receives the message for an accepted upload.
 * @returns The `<label>` element wrapping the file input.
 */
export function createUploadControl(
  onUploaded: (message: string) => void,
): HTMLLabelElement {
  /**
   * Probes the image and publishes it when it passes validation.
   *
   * @param file - The picked file.
   */
  const addFixture = async (file: File): Promise<void> => {
    if (!(await hasPngSignature(file))) {
      alert("only PNG files are supported");
      return;
    }
    const url = URL.createObjectURL(file);
    let probe: ImageData;
    try {
      probe = await loadImageData(url);
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
    if (!isSupportedSize(probe.width, probe.height)) {
      URL.revokeObjectURL(url);
      alert(
        `unsupported skin size ${probe.width}x${probe.height}: ` +
          "use a 64x64 skin or a legacy 64x32 skin",
      );
      return;
    }
    const fixture: Fixture = { name: file.name, url, origin: "uploaded" };
    setUploadedFixture(fixture);
    const note = probe.height === 32 ? " (legacy 64x32, converted)" : "";
    onUploaded(`uploaded ${file.name}${note}`);
  };

  /**
   * Validates and publishes one picked file.
   *
   * @param file - The picked file.
   */
  const choose = async (file: File): Promise<void> => {
    try {
      await addFixture(file);
    } catch (error) {
      alert(`upload failed: ${String(error)}`);
    }
  };

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/png";
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    // Reset the value so picking the same file again still fires.
    input.value = "";
    if (file !== undefined) {
      void choose(file);
    }
  });

  const label = document.createElement("label");
  label.className = "upload";
  label.append("upload PNG ", input);
  return label;
}
