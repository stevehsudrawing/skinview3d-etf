/**
 * Ticker policy specs: the animation-slot contract (hook a busy slot,
 * install a private animation only into an empty one) and the
 * per-frame delta derivation, against a fake viewer (no WebGL).
 */

import { FunctionAnimation, type SkinViewer } from "skinview3d";
import { describe, expect, it, vi } from "vitest";
import { startTicker } from "../../src/render/core/ticker";

describe("startTicker", () => {
  it("installs a private function animation into an empty slot", () => {
    const viewer = { animation: null } as unknown as SkinViewer;
    const handle = startTicker(viewer, () => undefined);
    expect(viewer.animation).toBeInstanceOf(FunctionAnimation);
    handle.dispose();
    expect(viewer.animation).toBeNull();
  });

  it("leaves a replaced animation alone on dispose", () => {
    const viewer = { animation: null } as unknown as SkinViewer;
    const handle = startTicker(viewer, () => undefined);
    const foreign = new FunctionAnimation(() => undefined);
    viewer.animation = foreign;
    handle.dispose();
    expect(viewer.animation).toBe(foreign);
  });

  it("hooks a busy slot and derives per-frame deltas", () => {
    const callbacks: ((player: unknown, progress: number) => void)[] = [];
    const removeAnimation = vi.fn();
    const addAnimation = vi.fn(
      (callback: (player: unknown, progress: number) => void) => {
        callbacks.push(callback);
        return 7;
      },
    );
    const viewer = {
      animation: { addAnimation, removeAnimation },
    } as unknown as SkinViewer;
    const ticks: number[] = [];
    const handle = startTicker(viewer, (dt) => ticks.push(dt));

    expect(addAnimation).toHaveBeenCalledTimes(1);
    callbacks[0](null, 10); // Baseline only: no tick yet.
    callbacks[0](null, 10.5); // +0.5 s.
    callbacks[0](null, 10.5); // Zero delta: ignored.
    callbacks[0](null, 9.75); // Negative delta: ignored.
    expect(ticks).toEqual([0.5]);

    handle.dispose();
    expect(removeAnimation).toHaveBeenCalledWith(7);
  });
});
