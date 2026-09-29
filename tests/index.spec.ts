/**
 * Public entry surface: the runtime exports of `src/index.ts` are the
 * package's contract, so a lost re-export must fail here.
 */

import { decodeSkin } from "etf-skin-decoder";
import { describe, expect, it } from "vitest";
import * as entry from "../src/index";
import { attachETFSkinFeatures } from "../src/render/controller";
import {
  DEFAULT_BLINK_OPTIONS,
  DEFAULT_ENCHANTED_OPTIONS,
} from "../src/render/core/options";

describe("public entry", () => {
  it("re-exports the decoder and the renderer entry points", () => {
    expect(entry.decodeSkin).toBe(decodeSkin);
    expect(entry.attachETFSkinFeatures).toBe(attachETFSkinFeatures);
  });

  it("re-exports the option defaults", () => {
    expect(entry.DEFAULT_BLINK_OPTIONS).toBe(DEFAULT_BLINK_OPTIONS);
    expect(entry.DEFAULT_ENCHANTED_OPTIONS).toBe(DEFAULT_ENCHANTED_OPTIONS);
  });
});
