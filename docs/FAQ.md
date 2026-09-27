# FAQ

## 1. Why does my skin render no features - or only some of them?

### 1.1 Nothing renders at all

The ETF features live outside the vanilla skin format: the decoder
needs the ETF marker in the top-left corner. A plain skin simply
decodes as `hasMarker: false`. The
[official ETF skin guide](https://github.com/Traben-0/Entity_Texture_Features/blob/ETF-Main/.github/README-assets/SKIN_GUIDE.md)
explains how to mark a skin.

The official
[ETF example skins](https://github.com/Traben-0/Entity_Texture_Features/tree/ETF-Main/.github/README-assets/mod-skins)
show what fully marked skins look like.

### 1.2 The marker is there, but one feature does not render

Every feature also needs its own choice cells or slots filled; a
feature whose data is missing decodes as `null` and renders nothing
even while its `features.*` toggle is on. The demo's preview tab
lists the slots, the cells and every decoded value, so it shows
exactly what is missing.

#### 1.2.1 transparency

The base layer's alpha is honored per body part, so a fully opaque
base layer simply has nothing to show. The `forcedSolid` slot
covers the opposite case: skins that painted the format's reserved
solid regions translucent get their alpha stripped back to opaque.

#### 1.2.2 emissive

The marker's pattern cells must select a pattern box, and the skin
must carry pixels matching that box's colors - the matching pixels
become the emitted mask.

#### 1.2.3 blinking

The `blink` slot picks the mode (1-5); the pixel-tall eye modes
(3-5) also read the `eyePosition` slot, which falls back to the
first eye row when it is unset or out of range.

#### 1.2.4 nose

The `nose` slot selects a villager or textured variant; the legacy
floating-face style is still detected from its painted pixels.

#### 1.2.5 enchanted

The same rule as emissive, with the marker's enchanted pattern
cell and its box.

#### 1.2.6 jacket

The jacket needs its own data: the `jacketStyle` (1-8) and
`jacketLength` (1-8) slots, the leg source pixels copied into the
jacket texture, and `features.jacket` switched on. The shell hangs
from the body's outer layer, so hiding that layer hides the jacket
with it. Its emissive / enchanted overlays reuse the skin's pattern
keys, cut from the jacket texture itself; the moved styles clear
their leg source pixels from the decoded skin first, so the base
masks can lose pixels the jacket keeps (the wizard example skin's
base enchant mask shrinks by two pixels this way).

## 2. Why does the result look different from the in-game ETF?

The decoder is spec-faithful; rendering, timing and option semantics
deliberately deviate where a different model wins - no texture
surgery, extra tunability, or assets this project may not bundle.
The differences, one per affected family:

### 2.1 emissive

The game cuts the emissive pixels out of the base texture (dropping
their transparency) and redraws them at an extra-bright light level
(`FULL_BRIGHT + 2`). Here they are a separate unlit overlay drawn
over the base skin: the transparency stays intact, the pixels keep
their own color, and the surrounding light is yours to tune (the
demo exposes `viewer.globalLight` / `viewer.cameraLight`; the
reserved `bloom` option does nothing yet).

### 2.2 enchanted

Upstream renders the glint with fixed render types and no knobs,
and the game's glint look comes from its own enchantment texture -
this project bundles no such assets, so the built-in pattern is a
self-drawn mock. It is drawn as one additive overlay with `speed`,
`opacity`, `scale` and `smooth`; the decode data is spec-faithful,
and the defaults are tuned against the in-game look (speed `0.1`,
opacity `1`, scale `1`, smoothing on). See [Options](Options.md)
§1.3, and pass your own `texture` for a different pattern.

### 2.3 blinking

The schedule is seeded per skin - the same skin always blinks the
same way - and every phase is tunable. One deliberate difference:
the default reopens the eyes with a short animated phase where the
game pops them open; set `reopenMs: 0` for the game's pop-open. The
frame semantics themselves follow the official guide.

### 2.4 jacket

The game hides the extension while leg armor is worn; that
suppression has no counterpart here (there is no armor model), and
the jacket's emissive / enchanted overlays follow the enchanted
rule above.

Otherwise transparency and the noses reproduce the in-game behavior
by design - a visibly missing feature usually means missing skin
data (see §1.2). The in-skin cape no longer exists upstream, so it
is out of scope here as well.

## 3. Why must I call refresh() after loadSkin()?

The extension cannot observe texture swaps. `viewer.loadSkin()`
recreates the skin textures and resets the host canvas, so the
controller re-decodes the current skin and re-applies everything on
the next `controller.refresh()` call.

## 4. Does it work next to skinview3d-blockbench?

Yes - coexistence is a design goal. Both extensions add to the
existing scene without rebuilding it; when another provider takes
the `viewer.animation` slot, the ETF ticker hooks through
`addAnimation()` instead of seizing the slot. Call
`controller.rebind()` after the slot object changes (see
[Getting Started](Getting-Started.md) §3.2).

## 5. How do I use my own texture for the enchanted pixels or the nose?

Set the group's `texture` - at attach time or through
`setEnchantedOptions()` / `setVillagerNoseOptions()` ([Options](Options.md)
§3 lists every accepted input form). Remote URLs need CORS headers;
the demo's file pickers show the local-file flow.

## 6. Can I run the timed features from my own render loop?

Yes: pass `manageTicker: false` and call `controller.update(dt)`
with the elapsed seconds. Blinking (in the `"auto"` state) and the
scrolling enchanted pattern follow that clock.

## 7. Still stuck?

If nothing here covers your case, open an
[issue](https://github.com/stevehsudrawing/skinview3d-etf/issues):
the bug report and the feature request templates guide the fields
they need.
