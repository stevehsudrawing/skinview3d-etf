/**
 * Ticker: drives time-based features from the viewer's animation slot.
 * When the slot is occupied the hook is appended through the public
 * `addAnimation()` API; when it is empty a private `FunctionAnimation`
 * is installed. Both paths report per-frame deltas in seconds.
 *
 * Note: assigning `viewer.animation` (including installing or removing
 * the private animation) resets the player's pose once - the host's
 * animation setter does that on every slot change. Call
 * `controller.rebind()` after replacing `viewer.animation` yourself to
 * re-attach the hook.
 */

import { FunctionAnimation, type SkinViewer } from "skinview3d";

/** Handle returned by {@link startTicker}. */
export interface TickerHandle {
  /** Removes the hook (and the private animation when still ours). */
  dispose(): void;
}

/**
 * Starts driving `onTick` with per-frame deltas in seconds.
 *
 * @param viewer - The viewer whose animation slot supplies the clock.
 * @param onTick - Receives the time delta since the previous frame.
 * @returns The handle that removes the ticker again.
 */
export function startTicker(
  viewer: SkinViewer,
  onTick: (dtSeconds: number) => void,
): TickerHandle {
  const existing = viewer.animation;
  if (existing !== null) {
    // `addAnimation` reports the progress since registration, so the
    // per-frame delta is derived by subtraction.
    let last: number | null = null;
    const id = existing.addAnimation((_player, progress) => {
      if (last === null) {
        last = progress;
        return;
      }
      const delta = progress - last;
      last = progress;
      if (delta > 0) {
        onTick(delta);
      }
    });
    return {
      dispose: () => {
        existing.removeAnimation(id);
      },
    };
  }

  // The slot is empty: install a private function animation.
  const animation = new FunctionAnimation((_player, _progress, delta) => {
    if (delta > 0) {
      onTick(delta);
    }
  });
  viewer.animation = animation;
  return {
    dispose: () => {
      if (viewer.animation === animation) {
        viewer.animation = null;
      }
    },
  };
}
