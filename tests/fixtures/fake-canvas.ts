/**
 * Shared fake canvas for the render specs: a 2d-context stub that
 * mimics the `createImageData` / `getImageData` / `putImageData`
 * subset the canvas helpers use, with the HTML-spec dirty-rectangle
 * destination semantics. Setting `width` / `height` reallocates (and
 * therefore clears) the pixel store, like a real canvas resize.
 */

/** The fake `ImageData` handed out by the stub context. */
interface FakeImageData {
  /** Width in pixels. */
  width: number;
  /** Height in pixels. */
  height: number;
  /** The RGBA bytes. */
  data: Uint8ClampedArray;
}

/** The 2d-context subset the canvas helpers call. */
class FakeContext {
  /**
   * @param canvas - The canvas backing this context.
   */
  constructor(private readonly canvas: FakeCanvas) {}

  /**
   * @param width - The image width.
   * @param height - The image height.
   * @returns A blank image buffer.
   */
  createImageData(width: number, height: number): FakeImageData {
    return { width, height, data: new Uint8ClampedArray(width * height * 4) };
  }

  /**
   * @param x - Source x.
   * @param y - Source y.
   * @param width - Source width.
   * @param height - Source height.
   * @returns A copy of the canvas region.
   */
  getImageData(
    x: number,
    y: number,
    width: number,
    height: number,
  ): FakeImageData {
    const image = this.createImageData(width, height);
    for (let row = 0; row < height; row++) {
      const from = ((y + row) * this.canvas.width + x) * 4;
      image.data.set(
        this.canvas.pixels.subarray(from, from + width * 4),
        row * width * 4,
      );
    }
    return image;
  }

  /**
   * Writes an image region onto the canvas. Follows the HTML spec:
   * the dirty rectangle selects the source pixels and the destination
   * is offset by `(dx + dirtyX, dy + dirtyY)`.
   *
   * @param image - The source buffer.
   * @param dx - Destination x offset.
   * @param dy - Destination y offset.
   * @param dirtyX - Source rectangle x.
   * @param dirtyY - Source rectangle y.
   * @param dirtyWidth - Source rectangle width.
   * @param dirtyHeight - Source rectangle height.
   */
  putImageData(
    image: FakeImageData,
    dx: number,
    dy: number,
    dirtyX = 0,
    dirtyY = 0,
    dirtyWidth = image.width,
    dirtyHeight = image.height,
  ): void {
    for (let row = dirtyY; row < dirtyY + dirtyHeight; row++) {
      for (let col = dirtyX; col < dirtyX + dirtyWidth; col++) {
        const from = (row * image.width + col) * 4;
        const to = ((row + dy) * this.canvas.width + (col + dx)) * 4;
        this.canvas.pixels.set(image.data.subarray(from, from + 4), to);
      }
    }
  }
}

/** The fake canvas itself. */
export class FakeCanvas {
  /** The backing pixel store. */
  pixels: Uint8ClampedArray;
  private readonly context = new FakeContext(this);
  private widthValue: number;
  private heightValue: number;

  /**
   * @param width - Initial width in pixels.
   * @param height - Initial height in pixels.
   */
  constructor(width = 64, height = 64) {
    this.widthValue = width;
    this.heightValue = height;
    this.pixels = new Uint8ClampedArray(width * height * 4);
  }

  /** The canvas width in pixels; setting it clears the pixel store. */
  get width(): number {
    return this.widthValue;
  }

  set width(value: number) {
    this.widthValue = value;
    this.pixels = new Uint8ClampedArray(value * this.heightValue * 4);
  }

  /** The canvas height in pixels; setting it clears the pixel store. */
  get height(): number {
    return this.heightValue;
  }

  set height(value: number) {
    this.heightValue = value;
    this.pixels = new Uint8ClampedArray(this.widthValue * value * 4);
  }

  /**
   * @returns The shared stub context (the arguments are ignored).
   */
  getContext(): FakeContext {
    return this.context;
  }
}
