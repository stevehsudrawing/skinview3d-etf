# skinview3d-etf

> [!WARNING]
> This project is in **alpha** (first release `0.0.1`). The public
> API, rendering behavior, package layout and documentation may still
> change in any `0.x` release; treat every minor release as
> potentially breaking. Do not use it in production yet.

Unofficial, community-built extension for
[skinview3d](https://github.com/bs-community/skinview3d) that renders
[ETF (Entity Texture Features)](https://github.com/Traben-0/Entity_Texture_Features)
player skin features on the 3D player model:

- transparency on the base skin layer;
- emissive (glowing) pixels;
- blinking eyes;
- nose (villager and textured);
- enchanted (glint) overlay;
- jacket/dress extension.

The v0.0.1 decoder is complete and available now: `decodeSkin()` reads
every ETF player skin feature - the marker and its choice cells, the
palette and the seven choice slots, transparency and forced-solid,
blinking, nose, jacket (styles 1-8) and the emissive/enchanted pattern
data - and prepares the overlay images the renderer consumes. The
renderer ships transparency, the nose (villager and textured), the
emissive (glowing) pixels, blinking eyes and the enchanted (glint)
overlay through `attachETFSkinFeatures()` on a live viewer; jacket
rendering is not implemented yet.

The in-skin cape no longer exists upstream (all code paths are
commented out), so it is out of scope; the five former cape texture
regions are reused as textured-nose sources.

## 1. Status

Early development. The decoder (`decodeSkin()`) is complete and
unit-tested against the
[ETF example skins](https://github.com/Traben-0/Entity_Texture_Features/tree/ETF-Main/.github/README-assets/mod-skins).
The renderer ships transparency, the nose (villager and textured),
the emissive (glowing) pixels, blinking eyes and the enchanted
(glint) overlay on a live viewer; jacket rendering is not
implemented yet. Published on npm as `skinview3d-etf`; a live demo
deploys from `main` (§4).

## 2. Usage

Install from npm:

```sh
npm install skinview3d-etf
```

`skinview3d` and `three` are peer dependencies, so install the
versions the viewer already uses.

```ts
import { SkinViewer } from "skinview3d";
import { attachETFSkinFeatures } from "skinview3d-etf";

const viewer = new SkinViewer({ canvas, width: 400, height: 400 });
await viewer.loadSkin(skinUrl);

const controller = attachETFSkinFeatures(viewer, {
  features: { transparency: true, emissive: true, nose: true },
  // Blinking: intervals are in ms; a [min, max] tuple re-rolls the
  // interval after every blink.
  blink: { periodMs: [4000, 10000], closedMs: 200 },
  onWarning: (message) => console.warn(message),
});

// Required after every viewer.loadSkin() call - skin changes are not
// detected automatically:
controller.refresh();

// Restores every artifact and leaves the viewer exactly as it was:
controller.detach();
```

Blinking runs automatically while the viewer's animation slot is free
(or shared through `addAnimation`); pass `manageTicker: false` and
call `controller.update(dt)` yourself in a custom render loop, and use
`controller.setBlinkOptions({ state: "closed" })` to hold a fixed eye
state or change the timing at runtime. The documented defaults are
exported as `DEFAULT_BLINK_OPTIONS`.

The options form four groups: `features` (the five toggles -
including `enchanted`), `blink`, `glint` (`texture`, `speed`,
`opacity`, `scale`, `smooth`) and `villagerNose` (`texture`).
`DEFAULT_GLINT_OPTIONS` exports the glint defaults, and the runtime
setters (`setFeatures()`, `setBlinkOptions()`, `setGlintOptions()`,
`setVillagerNoseOptions()`) merge partial updates: an omitted
property keeps its current value, while for the two texture options
an explicit `texture: undefined` restores the built-in default and
`null` turns the feature off.

The extension never rebuilds the scene graph and never seizes the
viewer's animation slot; it adds artifacts under the existing meshes
and cleans all of them up on `detach()`.

The decoder is a standalone, three-free module that operates on plain
pixel buffers (`ImageData`-compatible; 64x64, plus legacy 64x32 skins,
which are converted to the 1.8 layout first):

```ts
import { decodeSkin } from "skinview3d-etf";

const result = decodeSkin(imageData);
// result.skin, result.emissive?.mask, result.blink?.frames, ...
```

Note the migration from v0.0.1 (breaking, expected before 1.0): the
flat `villagerNoseTexture` option moved to `villagerNose.texture`,
and the reserved `glintTexture` option is now `glint.texture` (the
`glint` group adds `speed`, `opacity`, `scale` and `smooth`).

**Browser support:** the build targets ES2022 and the runtime expects
WebGL 2 (matching the `three` release's own browser target) - the
current versions of Chrome, Edge, Opera, Firefox and Safari all
qualify.

## 3. Building

Requirements: Node.js 22.12 or newer (see `engines` in `package.json`)
and pnpm enabled through `corepack enable` (the repository pins
`pnpm@12.5.1`). Then:

```sh
pnpm install
pnpm typecheck   # tsc --noEmit
pnpm build       # tsup -> dist/ (minified ESM + type declarations)
pnpm test        # vitest; real-fixture specs skip when the local
                 # example skins are absent
pnpm lint        # eslint
pnpm format:check
```

## 4. Demo

A Vite demo lives in `examples/` and is part of this repository:

```sh
pnpm install
pnpm dev    # serves the demo (default http://localhost:5173/)
```

A live build is deployed from `main` to the
[demo page](https://stevehsudrawing.github.io/skinview3d-etf/).

- The page mounts a live `skinview3d` viewer in a square stage.
- The fixture bar offers the bundled sample skin
  (`examples/src/assets/skins/example.png`) and accepts a PNG upload
  of your own skin: 64x64, or a legacy 64x32 skin that is converted
  automatically (rejected files raise a browser alert).
- The 3D tab shows three control trees grouped by owning package
  (the extension, the blockbench provider, the host viewer): every
  row carries one exact API keyword at its API-path depth, the
  tooltip shows the dotted path plus a description, and after every
  load the demo decodes the skin and grays the rows the skin has no
  data for (a skin without the ETF marker grays almost everything).
- Function rows (`attachETFSkinFeatures`, `detach`, `loadSkin`,
  `setAnimation`) carry an `execute` button with their parameters
  as child rows; values the demo derives itself (the fixture
  source, the animation name) are locked read-only inputs that
  explain the derivation in their tooltip.
- The `skinview3d-etf:` tree gates everything on its
  `attachETFSkinFeatures` / `detach` execute rows; the `blink` rows
  couple to the feature switch, the `glint` rows to `enchanted` and
  the `villagerNose.texture` row to the villager nose; a `reset`
  button in the stage's corner restores the camera pose.
- The `skinview3d-blockbench:` tree picks its input file
  (`animation`, the bundled self-made copy or a transient `[upload]`
  entry) and plays its animations (`animationName`, `setAnimation`,
  `forceLoop`, `paused`, `speed`) next to the ETF features.
- The footer links back to the source repository; uploaded files are
  processed in the browser only and are never sent anywhere.
- The decoder preview tab draws every prepared `decodeSkin()` artifact
  next to the 3D view.
- The demo is not part of the npm package.

## 5. Roadmap

v0.0.2 (current milestone):

- [x] render the enchanted (glint) overlay with the reworked
      texture options (`smooth`, the texture-slot state machine);
- [x] rebuild the demo control tree and rewrite the README;
- [x] sync the documentation pages and prepare the release record;
- [x] v0.0.2 release.

History:

- [x] v0.0.1 release.

## 6. Credits and disclaimer

Not affiliated with or endorsed by the ETF or skinview3d projects. ETF
is LGPL-3.0 and serves as a specification reference only; no ETF code,
comments, or assets are copied into this project.

## 7. License

MIT - see [LICENSE](LICENSE).
