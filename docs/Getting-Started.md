# Getting Started

## 1. Install

Install from npm:

```sh
npm install skinview3d-etf
```

`skinview3d` and `three` are peer dependencies; install the versions
your viewer already uses.

## 2. Attach the features

The extension attaches to a live `skinview3d` viewer through
`attachETFSkinFeatures()`:

```ts
import { SkinViewer } from "skinview3d";
import { attachETFSkinFeatures } from "skinview3d-etf";

const viewer = new SkinViewer({ canvas, width: 400, height: 400 });
await viewer.loadSkin(skinUrl);

const controller = attachETFSkinFeatures(viewer, {
  features: { transparency: true, emissive: true, nose: true },
  blink: { periodMs: [4000, 10000], closedMs: 200 },
  onWarning: (message) => console.warn(message),
});
```

Every feature defaults to enabled; [Options](Options) documents the
option groups (`features`, `blink`, `glint`, `villagerNose`) and the
exported defaults. The controller never rebuilds the scene graph and
never seizes the viewer's animation slot: it adds artifacts under
the existing meshes and cleans all of them up on `detach()`.

## 3. Lifecycle

### 3.1 Skin changes: refresh()

Skin changes are never detected automatically: call
`controller.refresh()` after every `viewer.loadSkin()` call. The
host recreates the skin textures and resets its canvas, so the
controller re-decodes the current skin and re-applies everything.

### 3.2 Re-parenting and slot swaps: rebind()

Call `controller.rebind()` after the player object is replaced or
the model is re-parented (another extension may move parts into its
own groups), and after you replace `viewer.animation` yourself - a
replaced slot object disconnects the ticker hook.

### 3.3 Timed features: the managed ticker and update(dt)

Blinking (in the `"auto"` state) and the scrolling glint need a
clock. By default the controller manages one: it hooks the viewer's
animation slot through `addAnimation()` while an animation is
assigned, and installs a private `FunctionAnimation` while the slot
is empty. Assigning `viewer.animation` resets the player's pose once
(the host does that on every slot change) and drops a private
ticker - call `controller.rebind()` afterwards.

For custom render loops, pass `manageTicker: false` and call
`controller.update(dt)` yourself with the elapsed seconds; negative
deltas are ignored.

### 3.4 Teardown: detach()

`controller.detach()` restores everything the extension touched -
canvas pixels, material swaps, textures, overlays and ticker hooks -
and is idempotent. Call `attachETFSkinFeatures()` again to
re-attach; a fresh controller starts from the documented defaults.

## 4. Decode without rendering

`decodeSkin()` is a standalone, three-free module that operates on
plain pixel buffers (`ImageData`-compatible; 64x64, plus legacy
64x32 skins, which are converted to the 1.8 layout first):

```ts
import { decodeSkin } from "skinview3d-etf";

const result = decodeSkin(imageData);
// result.skin, result.emissive?.mask, result.blink?.frames, ...
```

Any other size decodes as `supported: false` with a warning and no
features; a malformed buffer throws a `TypeError`. A skin without
the ETF marker decodes as `hasMarker: false` - use the demo's
preview tab to inspect what a skin actually carries.

## 5. The demo

The repository ships a Vite demo (`pnpm dev` in a checkout) with
several sample skins, a PNG upload, live control tables for every
option and a decoder preview tab. A live build is deployed at
<https://stevehsudrawing.github.io/skinview3d-etf/>; the demo is not
part of the npm package.
