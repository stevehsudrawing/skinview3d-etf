# skinview3d-etf

> [!WARNING]
> This project is in **pre-alpha**. The public API, rendering
> behavior, package layout and documentation may change without
> notice at any time; undocumented breaking changes can occur in any
> release. Do not use it in production yet.

Unofficial, community-built extension for
[skinview3d](https://github.com/bs-community/skinview3d) that renders
[ETF (Entity Texture Features)](https://github.com/Traben-0/Entity_Texture_Features)
player skin features on the 3D player model:

- transparency on the base skin layer;
- emissive (glowing) pixels;
- blinking eyes;
- nose (villager and textured);
- jacket/dress extension.

The v0.0.1 decoder is complete and available now: `decodeSkin()` reads
every ETF player skin feature - the marker and its choice cells, the
palette and the seven choice slots, transparency and forced-solid,
blinking, nose, jacket (styles 1-8) and the emissive/enchanted pattern
data - and prepares the overlay images the renderer consumes. The
renderer is underway: `attachETFSkinFeatures()` renders transparency,
the nose (villager and textured) and the emissive (glowing) pixels
on a live viewer; blinking arrives in a later v0.0.1 commit, and
jacket and glint rendering are planned after that.

The in-skin cape no longer exists upstream (all code paths are
commented out), so it is out of scope; the five former cape texture
regions are reused as textured-nose sources.

## 1. Status

Early development. The decoder (`decodeSkin()`) is complete and
unit-tested against the ETF example skins. The renderer is underway:
`attachETFSkinFeatures()` renders transparency, the nose (villager
and textured) and the emissive (glowing) pixels on a live viewer;
blinking arrives next. Nothing is published to npm yet.

## 2. Usage

The package is not published to npm yet (see §1). Until the release,
use it from a local build or a checkout. `skinview3d` and `three` are
peer dependencies, so install the versions the viewer already uses.

```ts
import { SkinViewer } from "skinview3d";
import { attachETFSkinFeatures } from "skinview3d-etf";

const viewer = new SkinViewer({ canvas, width: 400, height: 400 });
await viewer.loadSkin(skinUrl);

const controller = attachETFSkinFeatures(viewer, {
  features: { transparency: true, emissive: true, nose: true },
  onWarning: (message) => console.warn(message),
});

// Required after every viewer.loadSkin() call - skin changes are not
// detected automatically:
controller.refresh();

// Restores every artifact and leaves the viewer exactly as it was:
controller.detach();
```

The extension never rebuilds the scene graph and never seizes the
viewer's animation slot; it adds artifacts under the existing meshes
and cleans all of them up on `detach()`.

The decoder is a standalone, three-free module that operates on plain
pixel buffers (`ImageData`-compatible):

```ts
import { decodeSkin } from "skinview3d-etf";

const result = decodeSkin(imageData);
// result.skin, result.emissive?.mask, result.blink?.frames, ...
```

## 3. Building

Requirements: Node.js 22.12 or newer (see `engines` in `package.json`)
and pnpm enabled through `corepack enable` (the repository pins
`pnpm@12.5.1`). Then:

```sh
pnpm install
pnpm typecheck   # tsc --noEmit
pnpm build       # tsup -> dist/ (ESM + type declarations)
pnpm test        # vitest; real-fixture specs skip when the local
                 # example skins are absent
pnpm lint        # eslint
pnpm format:check
```

The maintainer's local demo (`pnpm dev`, a Vite SPA that attaches the
extension to a live viewer) lives in a local-only `examples/` tree
that is not part of the repository and does not ship in the package;
it expects example skins under `examples/images/example-skins/`.

## 4. Roadmap

- [x] package scaffold and tooling (build, test, lint, git hooks);
- [x] decoder for the ETF player skin format (complete: marker, slots,
      transparency, blinking, nose, jacket, emissive, enchanted);
- [x] renderer entry point (`attachETFSkinFeatures()`) with
      transparency and nose rendering;
- [x] emissive (glowing) pixels rendering;
- [ ] blinking rendering;
- [ ] demo integration (per-feature toggles, blockbench coexistence)
      and the release checklist;
- [ ] v0.0.1 release on npm.

## 5. Credits and disclaimer

Not affiliated with or endorsed by the ETF or skinview3d projects. ETF
is LGPL-3.0 and serves as a specification reference only; no ETF code,
comments, or assets are copied into this project.

## 6. License

MIT - see [LICENSE](LICENSE).
