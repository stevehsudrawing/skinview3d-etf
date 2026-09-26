/**
 * Async texture resolution for the renderer's texture options (the
 * villager nose and the glint pattern): a small state machine around
 * one lazy load per input.
 *
 * The slot resolves at most one input at a time (single flight),
 * never retries after a failure until `reset()`, and discards stale
 * results when `reset()` interrupts a pending load - so a texture
 * replacement or `detach()` can never be overwritten by a late load.
 */

import { resolveTextureInput } from "./textures";
import type { ETFTextureInput } from "./types";

/** Turns a texture input into a canvas. */
export type TextureResolver = (
  input: ETFTextureInput,
) => Promise<HTMLCanvasElement>;

/** One lazy texture resolution slot. */
export interface TextureSlot {
  /** The resolved canvas, or `null` while idle, pending or failed. */
  readonly canvas: HTMLCanvasElement | null;
  /**
   * Starts resolving `input` when the slot is idle; a no-op while a
   * load is pending, after a success and after a failure. The
   * callbacks run exactly once for the current attempt; results made
   * stale by `reset()` are discarded silently.
   *
   * @param input - The input to resolve.
   * @param onReady - Called after the canvas has been stored.
   * @param onError - Called with the failure reason.
   */
  ensure(
    input: ETFTextureInput,
    onReady: () => void,
    onError: (error: unknown) => void,
  ): void;
  /** Invalidates in-flight loads and forgets the resolved canvas. */
  reset(): void;
}

/**
 * Creates a texture slot.
 *
 * @param resolve - The resolver to use; defaults to the shared
 *   texture-input resolver. Injectable for tests.
 * @returns The slot.
 */
export function createTextureSlot(
  resolve: TextureResolver = resolveTextureInput,
): TextureSlot {
  let canvas: HTMLCanvasElement | null = null;
  let pending = false;
  let failed = false;
  let generation = 0;

  return {
    get canvas(): HTMLCanvasElement | null {
      return canvas;
    },
    ensure(
      input: ETFTextureInput,
      onReady: () => void,
      onError: (error: unknown) => void,
    ): void {
      if (canvas !== null || pending || failed) {
        return;
      }
      const attempt = generation;
      pending = true;
      resolve(input)
        .then((resolved) => {
          if (attempt !== generation) {
            return;
          }
          pending = false;
          canvas = resolved;
          onReady();
        })
        .catch((error: unknown) => {
          if (attempt !== generation) {
            return;
          }
          pending = false;
          failed = true;
          onError(error);
        });
    },
    reset(): void {
      generation++;
      canvas = null;
      pending = false;
      failed = false;
    },
  };
}
