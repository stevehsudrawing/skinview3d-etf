/**
 * Texture slot specs: the async resolution state machine with an
 * injected resolver - single flight, stale discard and the failure
 * behavior.
 */

import { describe, expect, it, vi } from "vitest";
import { createTextureSlot } from "../../src/render/core/texture-slot";

/** A promise handle whose settlement the specs control. */
interface Deferred {
  /** Resolves with the given canvas. */
  resolve: (canvas: HTMLCanvasElement) => void;
  /** Rejects with the given reason. */
  reject: (error: unknown) => void;
  /** The underlying promise. */
  promise: Promise<HTMLCanvasElement>;
}

/**
 * Creates a controlled deferred.
 *
 * @returns The handle.
 */
function defer(): Deferred {
  let resolve!: (canvas: HTMLCanvasElement) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<HTMLCanvasElement>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { resolve, reject, promise };
}

/** Flushes the microtask queue. */
async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Creates an opaque canvas placeholder.
 *
 * @returns The placeholder.
 */
function fakeCanvas(): HTMLCanvasElement {
  return {} as HTMLCanvasElement;
}

describe("createTextureSlot", () => {
  it("resolves once via the injected resolver and reports ready", async () => {
    const deferred = defer();
    const calls: unknown[] = [];
    const canvas = fakeCanvas();
    const onReady = vi.fn();
    const onError = vi.fn();
    const slot = createTextureSlot((input) => {
      calls.push(input);
      return deferred.promise;
    });

    slot.ensure("input-a", onReady, onError);
    expect(calls).toEqual(["input-a"]);
    expect(slot.canvas).toBeNull();

    deferred.resolve(canvas);
    await flush();

    expect(slot.canvas).toBe(canvas);
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();

    // Already resolved: further ensures are no-ops.
    slot.ensure("input-b", onReady, onError);
    expect(calls).toEqual(["input-a"]);
  });

  it("keeps a single flight while a load is pending", async () => {
    const deferred = defer();
    const calls: unknown[] = [];
    const canvas = fakeCanvas();
    const onReady = vi.fn();
    const slot = createTextureSlot((input) => {
      calls.push(input);
      return deferred.promise;
    });

    slot.ensure("input-a", onReady, vi.fn());
    slot.ensure("input-b", onReady, vi.fn());
    expect(calls).toEqual(["input-a"]);

    deferred.resolve(canvas);
    await flush();

    expect(slot.canvas).toBe(canvas);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("discards a load made stale by reset()", async () => {
    const deferred = defer();
    const canvas = fakeCanvas();
    const onReady = vi.fn();
    const slot = createTextureSlot(() => deferred.promise);

    slot.ensure("input-a", onReady, vi.fn());
    slot.reset();
    deferred.resolve(canvas);
    await flush();

    expect(slot.canvas).toBeNull();
    expect(onReady).not.toHaveBeenCalled();
  });

  it("reports a failure once and does not retry until reset()", async () => {
    const first = defer();
    const second = defer();
    let current = first;
    const calls: unknown[] = [];
    const onReady = vi.fn();
    const onError = vi.fn();
    const slot = createTextureSlot((input) => {
      calls.push(input);
      return current.promise;
    });

    slot.ensure("input-a", onReady, onError);
    first.reject(new Error("load failed"));
    await flush();

    expect(slot.canvas).toBeNull();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(String(onError.mock.calls[0][0])).toContain("load failed");
    expect(onReady).not.toHaveBeenCalled();

    // Failed: no retry before reset().
    slot.ensure("input-b", onReady, onError);
    expect(calls).toEqual(["input-a"]);

    // After reset() a fresh attempt is allowed.
    current = second;
    slot.reset();
    const canvas = fakeCanvas();
    slot.ensure("input-b", onReady, onError);
    expect(calls).toEqual(["input-a", "input-b"]);

    second.resolve(canvas);
    await flush();

    expect(slot.canvas).toBe(canvas);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("resolves again after reset()", async () => {
    const first = defer();
    const second = defer();
    let current = first;
    const onReady = vi.fn();
    const slot = createTextureSlot(() => current.promise);
    const canvasA = fakeCanvas();
    const canvasB = fakeCanvas();

    slot.ensure("input-a", onReady, vi.fn());
    first.resolve(canvasA);
    await flush();
    expect(slot.canvas).toBe(canvasA);

    slot.reset();
    expect(slot.canvas).toBeNull();

    current = second;
    slot.ensure("input-b", onReady, vi.fn());
    second.resolve(canvasB);
    await flush();

    expect(slot.canvas).toBe(canvasB);
    expect(onReady).toHaveBeenCalledTimes(2);
  });
});
