# skinview3d-etf

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
renderer for transparency, emissive, blinking and nose arrives in
later v0.0.1 commits; jacket and glint rendering is planned after
that.

The in-skin cape no longer exists upstream (all code paths are
commented out), so it is out of scope; the five former cape texture
regions are reused as textured-nose sources.

## 1. Status

Early development. The decoder (`decodeSkin()`) is implemented and
unit-tested against the ETF example skins; the renderer and the
`attachETFSkinFeatures()` entry point are still pending. Nothing is
published to npm yet.

## 2. Roadmap

- [x] package scaffold and tooling (build, test, lint, git hooks);
- [x] decoder for the ETF player skin format (complete: marker, slots,
      transparency, blinking, nose, jacket, emissive, enchanted);
- [ ] transparency, nose and blinking rendering;
- [ ] emissive (glowing) pixels rendering;
- [ ] integration entry point and a local demo page;
- [ ] v0.0.1 release on npm.

## 3. Credits and disclaimer

Not affiliated with or endorsed by the ETF or skinview3d projects. ETF
is LGPL-3.0 and serves as a specification reference only; no ETF code,
comments, or assets are copied into this project.

## 4. License

MIT - see [LICENSE](LICENSE).
