# skinview3d-etf

> [!WARNING]
> This project is in **pre-alpha**. The public API, rendering
> behaviour, package layout and documentation may change without
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

## 2. Roadmap

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

## 3. Credits and disclaimer

Not affiliated with or endorsed by the ETF or skinview3d projects. ETF
is LGPL-3.0 and serves as a specification reference only; no ETF code,
comments, or assets are copied into this project.

## 4. License

MIT - see [LICENSE](LICENSE).
