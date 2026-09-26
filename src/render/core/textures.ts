/**
 * Texture input resolution for the renderer options: every accepted
 * source is copied into our own canvas, and canvases are wrapped in
 * pixel-art textures that sample in skin space.
 */

import {
  CanvasTexture,
  ClampToEdgeWrapping,
  NearestFilter,
  type Texture,
} from "three";
import type { PixelData } from "../../decode/core/types";
import { paintCanvasPixels, pixelsToCanvas } from "./canvas";
import type { ETFTextureInput, RemoteImage, TextureSource } from "./types";

/**
 * Loads a remote image (`string` URL or `{ src, crossOrigin,
 * referrerPolicy }`) through a dedicated `<img>` element.
 *
 * @param source - The URL description.
 * @returns The loaded image element.
 * @throws Error when loading fails.
 */
export function loadRemoteImage(
  source: RemoteImage,
): Promise<HTMLImageElement> {
  const url = typeof source === "string" ? source : source.src;
  const image = document.createElement("img");
  image.crossOrigin = "anonymous";
  if (typeof source !== "string") {
    if (source.crossOrigin !== undefined) {
      image.crossOrigin = source.crossOrigin;
    }
    if (source.referrerPolicy !== undefined) {
      image.referrerPolicy = source.referrerPolicy;
    }
  }
  const loaded = new Promise<HTMLImageElement>((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`failed to load texture: ${url}`));
  });
  image.src = url;
  return loaded;
}

/**
 * Checks whether a value is one of the ready-to-use image sources.
 *
 * @param value - The value to inspect.
 * @returns True for images, videos, bitmaps and canvases.
 */
function isTextureSourceValue(value: unknown): value is TextureSource {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (
    typeof HTMLImageElement !== "undefined" &&
    value instanceof HTMLImageElement
  ) {
    return true;
  }
  if (
    typeof HTMLVideoElement !== "undefined" &&
    value instanceof HTMLVideoElement
  ) {
    return true;
  }
  if (
    typeof HTMLCanvasElement !== "undefined" &&
    value instanceof HTMLCanvasElement
  ) {
    return true;
  }
  if (typeof ImageBitmap !== "undefined" && value instanceof ImageBitmap) {
    return true;
  }
  if (
    typeof OffscreenCanvas !== "undefined" &&
    value instanceof OffscreenCanvas
  ) {
    return true;
  }
  return false;
}

/**
 * Checks whether a value is a pixel buffer.
 *
 * @param value - The value to inspect.
 * @returns True for `{ width, height, data }` objects (e.g. ImageData).
 */
function isPixelData(value: unknown): value is PixelData {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as {
    data?: unknown;
    width?: unknown;
    height?: unknown;
  };
  return (
    candidate.data instanceof Uint8ClampedArray &&
    typeof candidate.width === "number" &&
    typeof candidate.height === "number"
  );
}

/**
 * Checks whether a value is a `THREE.Texture` instance.
 *
 * @param value - The value to inspect.
 * @returns True for texture instances.
 */
function isTexture(value: unknown): value is Texture {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { isTexture?: unknown }).isTexture === true
  );
}

/**
 * Checks whether a value is the `{ src, ... }` remote image form.
 *
 * @param value - The value to inspect.
 * @returns True for objects with a string `src`.
 */
function isRemoteImageObject(
  value: unknown,
): value is Exclude<RemoteImage, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { src?: unknown }).src === "string"
  );
}

/**
 * Measures a ready-to-use source in pixels.
 *
 * @param source - The source to measure.
 * @returns The native width and height.
 */
function sourceSize(source: TextureSource): { width: number; height: number } {
  if (
    typeof HTMLVideoElement !== "undefined" &&
    source instanceof HTMLVideoElement
  ) {
    return { width: source.videoWidth, height: source.videoHeight };
  }
  if (
    typeof HTMLImageElement !== "undefined" &&
    source instanceof HTMLImageElement
  ) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }
  return { width: source.width, height: source.height };
}

/**
 * Copies a ready-to-use source into a new canvas at native size.
 *
 * @param source - The image source to copy.
 * @returns A canvas holding the pixels.
 * @throws Error for empty sources or missing contexts.
 */
function drawToCanvas(source: TextureSource): HTMLCanvasElement {
  const { width, height } = sourceSize(source);
  if (width === 0 || height === 0) {
    throw new Error("texture source has no pixels");
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("2d canvas context unavailable");
  }
  context.drawImage(source, 0, 0);
  return canvas;
}

/**
 * Resolves any accepted texture input into our own canvas. Caller
 * objects are only read, never mutated or disposed.
 *
 * @param input - The texture source to resolve.
 * @returns A canvas holding the pixels at native size.
 * @throws Error for unsupported values or failed loads.
 */
export async function resolveTextureInput(
  input: ETFTextureInput,
): Promise<HTMLCanvasElement> {
  if (typeof input === "string" || isRemoteImageObject(input)) {
    return drawToCanvas(await loadRemoteImage(input));
  }
  if (isTexture(input)) {
    const image: unknown = input.image;
    if (isTextureSourceValue(image)) {
      return drawToCanvas(image);
    }
    if (isPixelData(image)) {
      return pixelsToCanvas(image);
    }
    throw new Error(
      "THREE.Texture input must wrap a canvas, image or pixel data",
    );
  }
  if (isPixelData(input)) {
    return pixelsToCanvas(input);
  }
  if (isTextureSourceValue(input)) {
    return drawToCanvas(input);
  }
  throw new Error("unsupported texture input");
}

/**
 * Wraps a canvas as a nearest-filtered texture. With `flipY = false`
 * (the default) UVs are sampled in skin space, where `v = y / 64`
 * grows downwards.
 *
 * @param canvas - The canvas to wrap.
 * @param flipY - When true, sample with the regular bottom-up V axis.
 * @returns The prepared texture.
 */
export function createSkinSpaceTexture(
  canvas: HTMLCanvasElement,
  flipY = false,
): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  texture.flipY = flipY;
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  return texture;
}

/**
 * Wraps a decoded overlay mask as a texture. The sampler
 * configuration mirrors the host's skin texture (a plain canvas
 * texture with nearest filtering and the default `flipY`), because
 * the overlays that sample it reuse the host geometry and UVs.
 *
 * @param mask - The skin-sized RGBA mask pixels.
 * @returns The prepared texture, owned by the caller.
 */
export function createMaskTexture(mask: PixelData): CanvasTexture {
  const texture = new CanvasTexture(pixelsToCanvas(mask));
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  return texture;
}

/**
 * Repaints an existing mask texture with new mask pixels.
 *
 * @param texture - A texture created by {@link createMaskTexture}.
 * @param mask - The skin-sized RGBA mask pixels.
 */
export function repaintMaskTexture(
  texture: CanvasTexture,
  mask: PixelData,
): void {
  const canvas = texture.image as HTMLCanvasElement;
  paintCanvasPixels(canvas, mask);
  texture.needsUpdate = true;
}
