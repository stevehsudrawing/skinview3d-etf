/**
 * Assertions on the committed self-drawn `example.png` fixture: it is
 * the only committed skin, so these specs run on a clean checkout.
 * They assert structure only - pinned pixel counts would break
 * whenever the demo artwork is retouched.
 */

import { describe, expect, it } from "vitest";
import { decodeSkin } from "../../src/decode/index";
import { loadSkin } from "../fixtures/skins";

describe("example.png", () => {
  const result = decodeSkin(loadSkin("example.png"));

  it("decodes the committed jacket fixture", () => {
    expect(result.supported).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.hasMarker).toBe(true);
    expect(result.cells).toEqual([1, 2, null, null]);
    expect(result.slots.jacketStyle).toBe(2);
    expect(result.slots.jacketLength).toBe(4);
    expect(result.jacket).toMatchObject({
      style: 2,
      length: 4,
      wide: false,
      moved: true,
      top: true,
    });
    expect(result.blink).toMatchObject({ mode: 5, eyeHeight: 4 });
    expect(result.emissive).not.toBeNull();
    expect(result.enchanted).not.toBeNull();
  });

  it("carries both jacket masks", () => {
    expect(result.jacket?.emissiveMask).not.toBeNull();
    expect(result.jacket?.enchantedMask).not.toBeNull();
  });
});
