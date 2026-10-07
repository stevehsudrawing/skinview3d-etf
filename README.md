# skinview3d-etf

[![npm version](https://img.shields.io/npm/v/skinview3d-etf?style=flat-square)](https://www.npmjs.com/package/skinview3d-etf)
[![license: MIT](https://img.shields.io/npm/l/skinview3d-etf?style=flat-square)](https://github.com/stevehsudrawing/skinview3d-etf/blob/main/LICENSE)
[![demo](https://img.shields.io/badge/demo-live-blue?style=flat-square)](https://stevehsudrawing.github.io/skinview3d-etf/)
[![docs](https://img.shields.io/badge/docs-wiki-blue?style=flat-square)](https://github.com/stevehsudrawing/skinview3d-etf/wiki)

> [!WARNING]
>
> This project is in **alpha**. The public API, rendering behavior, package
> layout and documentation may still change in any `0.x` release; treat every
> minor release as potentially breaking. Do not use it in production yet.

Unofficial, community-built extension for `skinview3d`
([GitHub](https://github.com/bs-community/skinview3d) |
[npm](https://www.npmjs.com/package/skinview3d)) that renders
[ETF (Entity Texture Features)](https://github.com/Traben-0/Entity_Texture_Features)
player skin features on the 3D player model:

- transparency on the base skin layer;
- emissive pixels;
- blinking eyes;
- nose (villager and textured);
- enchanted pixel overlay;
- jacket/dress extension.

The decoder (`decodeSkin()`) is complete and available now: it reads every ETF
player skin feature - the marker and its choice cells, the palette and the seven
choice slots, transparency and forced-solid, blinking, nose, jacket (styles 1-8)
and the emissive/enchanted pattern data - and prepares the overlay images the
renderer consumes. The renderer ships all six features - including the
jacket/dress extension - through `attachETFSkinFeatures()` on a live viewer.

The in-skin cape no longer exists upstream (all code paths are commented out),
so it is out of scope; the five former cape texture regions are reused as
textured-nose sources.

## 1. Status

Early development. The decoder (`decodeSkin()`) is complete and unit-tested
against the
[ETF example skins](https://github.com/Traben-0/Entity_Texture_Features/tree/ETF-Main/.github/README-assets/mod-skins).
The renderer ships all six features - transparency, the nose (villager and
textured), the emissive pixels, blinking eyes, the enchanted pixel overlay and
the jacket/dress extension - on a live viewer. Published on npm as
`skinview3d-etf` ([GitHub](https://github.com/stevehsudrawing/skinview3d-etf) |
[npm](https://www.npmjs.com/package/skinview3d-etf)); a live demo deploys from
`main` (§4).

The full documentation lives in this repository under
[`docs/`](https://github.com/stevehsudrawing/skinview3d-etf/tree/main/docs); the
[Wiki](https://github.com/stevehsudrawing/skinview3d-etf/wiki) mirrors the same
pages.

## 2. Usage

Install from npm:

```sh
npm install skinview3d-etf
```

`skinview3d` and `three` ([GitHub](https://github.com/mrdoob/three.js) |
[npm](https://www.npmjs.com/package/three)) are peer dependencies, so install
the versions the viewer already uses.

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

Blinking runs automatically while the viewer's animation slot is free (or shared
through `addAnimation`); pass `manageTicker: false` and call
`controller.update(dt)` yourself in a custom render loop, and use
`controller.setBlinkOptions({ state: "closed" })` to hold a fixed eye state or
change the timing at runtime. The documented defaults are exported as
`DEFAULT_BLINK_OPTIONS`.

The options form five groups: `features` (the six toggles - `transparency`,
`emissive`, `blink`, `nose`, `enchanted` and `jacket`), `emissive` (the reserved
`bloom` flag), `blink`, `villagerNose` (`texture`) and `enchanted` (`texture`,
`speed`, `direction`, `opacity`, `scale`, `smooth`). `DEFAULT_ENCHANTED_OPTIONS`
exports the enchanted defaults, and the runtime setters (`setFeatures()`,
`setEmissiveOptions()`, `setBlinkOptions()`, `setVillagerNoseOptions()`,
`setEnchantedOptions()`) merge partial updates: an omitted property keeps its
current value, while for the two texture options an explicit
`texture: undefined` restores the built-in default and `null` turns the feature
off.

The texture options accept the host's input forms unchanged: the `TextureSource`
/ `RemoteImage` types are re-used from `skinview-utils`
([GitHub](https://github.com/bs-community/skinview-utils) |
[npm](https://www.npmjs.com/package/skinview-utils)), so a canvas from
`loadSkinToCanvas()` / `loadCapeToCanvas()` passes directly; `decodeSkin()`
likewise takes any plain `ImageData`-shaped buffer (e.g. `ctx.getImageData()`).

The extension never rebuilds the scene graph and never seizes the viewer's
animation slot; it adds artifacts under the existing meshes and cleans all of
them up on `detach()`.

The decoder is a standalone, three-free module that operates on plain pixel
buffers (`ImageData`-compatible; 64x64, plus legacy 64x32 skins, which are
converted to the 1.8 layout first):

```ts
import { decodeSkin } from "skinview3d-etf";

const result = decodeSkin(imageData);
// result.skin, result.emissive?.mask, result.blink?.frames, ...
```

> [!CAUTION]
>
> The decoder API (`decodeSkin()` and its types) now lives in the standalone
> `etf-skin-decoder`
> ([GitHub](https://github.com/stevehsudrawing/etf-skin-decoder) |
> [npm](https://www.npmjs.com/package/etf-skin-decoder)) package and is
> re-exported here for the rest of the v0.0.x line. **v0.1.0 will remove it from
> this package** (BREAKING). New code should import it from `etf-skin-decoder`
> directly.

Note the migrations (breaking, expected before 1.0): the flat v0.0.1
`villagerNoseTexture` option moved to `villagerNose.texture`, and the reserved
v0.0.1 `glintTexture` option is now `enchanted.texture` (the group adds `speed`,
`opacity`, `scale` and `smooth`). Upgrading from v0.0.2, the `glint` option
group and its setter are renamed `enchanted` (`glint.texture` ->
`enchanted.texture`, `setGlintOptions()` -> `setEnchantedOptions()`). Upgrading
from v0.0.4, the reserved `bloom` flag moved under its feature group (`bloom` ->
`emissive.bloom`).

**Browser support:** the build targets ES2022 and the runtime expects WebGL 2
(matching the `three` release's own browser target) - the current versions of
Chrome, Edge, Opera, Firefox and Safari all qualify.

## 3. Building

Requirements: Node.js 22.12 or newer (see `engines` in `package.json`) and pnpm
enabled through `corepack enable` (the repository pins `pnpm@12.5.1`). Then:

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
  (`examples/src/assets/skins/example.png`) and accepts a PNG upload of your own
  skin: 64x64, or a legacy 64x32 skin that is converted automatically (rejected
  files raise a browser alert).
- The 3D tab shows three control trees grouped by owning package, in order:
  `skinview3d-etf`, the host `skinview3d` and `skinview3d-blockbench`
  ([GitHub](https://github.com/Andcool-Systems/skinview3d-blockbench-animation)
  | [npm](https://www.npmjs.com/package/skinview3d-blockbench)) (hidden until
  its `SkinViewBlockbench` mode is picked in the `viewer.animation` row); every
  group title is a link to that package version on npm (`name/v/version`). Each
  row carries one exact API keyword at its API-path depth and its tooltip shows
  the dotted path plus a description; after every load the demo decodes the skin
  and grays the rows the skin has no data for (a skin without the ETF marker
  grays almost everything).
- Function rows (`attachETFSkinFeatures`, `detach`, `loadSkin`, `loadCape`,
  `setAnimation`) carry an `execute` button with their parameters as child rows;
  values the demo derives itself (the fixture source, the animation name) are
  locked read-only inputs that explain the derivation in their tooltip.
- The host tree's cape rows load or unload a cape (`loadCape.source`: `null`
  first, the bundled self-made cape and a transient `[upload]` entry, applied
  immediately) and pick the back equipment (`loadCape.options.backEquipment`:
  cape / elytra); the empty choices in the cape, `viewer.animation` and
  blockbench pickers display the API's `null`.
- Every parameter row carries a `reset` in its own action column, and every
  table title and parameter group (the container rows) carries a group `reset`
  that restores every row in its group; the texture rows pick between the
  built-in default, the off state and a transient `[upload]` entry through one
  `(select) [choose]` pair. The `reset` button in the stage's corner restores
  the camera pose.
- The `skinview3d-etf:` tree gates everything on its `attachETFSkinFeatures` /
  `detach` execute rows; the `blink` rows couple to the feature switch, the
  `enchanted` rows to `features.enchanted` and the `villagerNose.texture` row to
  the villager nose.
- The `skinview3d-blockbench:` tree picks its input file (`animation`, the
  bundled self-made copy or a transient `[upload]` entry) and plays its
  animations (`animationName`, `setAnimation`, `forceLoop`, `connectCape`,
  `paused`, `speed`) next to the ETF features.
- Uploaded files are processed in the browser only and are never sent anywhere.
- The decoder preview tab draws every prepared `decodeSkin()` artifact next to
  the 3D view.
- The demo is not part of the npm package.

## 5. Roadmap

v0.0.5 (current milestone):

- [x] add the `enchanted.direction` scroll vector (a UV vector with a seamless
      per-axis wrap);
- [x] align the jacket's enchanted overlay with the host UV convention - it
      scrolls with the body outer layer and stitches across the waist;
- [x] move the reserved `bloom` flag under `emissive` (breaking; see the
      migration note above);
- [x] update `skinview3d-blockbench` to `^1.0.20` and extend the demo (linked
      npm titles, cape controls, `null` labels);
- [x] correct the nose box UV orientation and complete the milestone audit;
- [x] v0.0.5 release.

Planned:

- [ ] remove the decoder API (v0.1.0; breaking).

Exploring (no timeline):

- optional bloom quality mode;
- headless rendering (Node) for screenshot tests.

History:

- [x] v0.0.4 release.
- [x] v0.0.3 release.
- [x] v0.0.2 release.
- [x] v0.0.1 release.

Bug reports and feature requests are welcome through the
[issue tracker](https://github.com/stevehsudrawing/skinview3d-etf/issues).

## 6. Credits and disclaimer

Not affiliated with or endorsed by the ETF or skinview3d projects. ETF is
LGPL-3.0 and serves as a specification reference only; no ETF code, comments, or
assets are copied into this project.

## 7. License

MIT - see [LICENSE](LICENSE).
