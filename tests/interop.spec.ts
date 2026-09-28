/**
 * Compile-time interop guard: the public texture-input types must
 * stay exactly the host utility layer's (`skinview-utils`) own types,
 * and the texture options must keep accepting the host's sources.
 *
 * The assertions are checked by the type checker and are no-ops at
 * runtime; `pnpm typecheck` and `pnpm test` both keep them honest.
 */

import type {
  RemoteImage as HostRemoteImage,
  TextureCanvas as HostTextureCanvas,
  TextureSource as HostTextureSource,
} from "skinview-utils";
import { describe, expectTypeOf, it } from "vitest";
import type {
  ETFTextureInput,
  RemoteImage,
  TextureCanvas,
  TextureSource,
} from "../src/index";

describe("texture input interop with skinview-utils", () => {
  it("re-uses the host's input types verbatim", () => {
    expectTypeOf<TextureSource>().toEqualTypeOf<HostTextureSource>();
    expectTypeOf<HostTextureSource>().toEqualTypeOf<TextureSource>();
    expectTypeOf<TextureCanvas>().toEqualTypeOf<HostTextureCanvas>();
    expectTypeOf<HostTextureCanvas>().toEqualTypeOf<TextureCanvas>();
    expectTypeOf<RemoteImage>().toEqualTypeOf<HostRemoteImage>();
    expectTypeOf<HostRemoteImage>().toEqualTypeOf<RemoteImage>();
    expectTypeOf<HostTextureSource>().toExtend<ETFTextureInput>();
    expectTypeOf<HostRemoteImage>().toExtend<ETFTextureInput>();
  });
});
