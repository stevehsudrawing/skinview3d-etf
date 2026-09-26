# skinview3d-etf

> [!WARNING]
> This project is in **alpha**. The public API, rendering behavior,
> package layout and documentation may still change in any `0.x`
> release; treat every minor release as potentially breaking. Do not
> use it in production yet.

Unofficial, community-built extension for
[skinview3d](https://github.com/bs-community/skinview3d) that renders
[ETF (Entity Texture Features)](https://github.com/Traben-0/Entity_Texture_Features)
player skin features on the 3D player model. Not affiliated with or
endorsed by the ETF or skinview3d projects.

## 1. What it renders

- transparency on the base skin layer;
- emissive (glowing) pixels;
- blinking eyes;
- nose (villager and textured);
- enchanted (glint) overlay;
- jacket/dress extension (the renderer is deferred).

The decoder (`decodeSkin()`) reads every ETF player skin feature -
the jacket and enchanted data included - and is complete and
unit-tested; the renderer covers everything except the jacket. See
[Options](Options.md) for every knob and
[Getting Started](Getting-Started.md) for the integration guide.

## 2. Install and quick start

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
  blink: { periodMs: [4000, 10000], closedMs: 200 },
  onWarning: (message) => console.warn(message),
});

// Required after every viewer.loadSkin() call:
controller.refresh();

// Restores every artifact and leaves the viewer exactly as it was:
controller.detach();
```

## 3. Documentation

- [Getting Started](Getting-Started.md) - install, attach, lifecycle
  and the standalone decoder;
- [Options](Options.md) - the option groups, defaults, runtime setters
  and the v0.0.1 migration;
- [FAQ](FAQ.md) - common questions and answers.

## 4. Project links

- [Live demo](https://stevehsudrawing.github.io/skinview3d-etf/) - a
  Vite page with several sample skins and a PNG upload;
- [npm package](https://www.npmjs.com/package/skinview3d-etf);
- [Repository](https://github.com/stevehsudrawing/skinview3d-etf);
- [Wiki](https://github.com/stevehsudrawing/skinview3d-etf/wiki) -
  the latest-state mirror of this documentation.

## 5. Browser support

The build targets ES2022 and the runtime expects WebGL 2 (matching
the `three` release's own browser target); the current versions of
Chrome, Edge, Opera, Firefox and Safari all qualify.
