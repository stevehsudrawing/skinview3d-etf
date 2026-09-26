# FAQ

## 1. My skin renders no features - what is wrong?

The ETF features live outside the vanilla skin format: the decoder
needs the ETF marker in the top-left corner, and every feature needs
its own choice cells or slots filled - the
[official ETF skin guide](https://github.com/Traben-0/Entity_Texture_Features/blob/ETF-Main/.github/README-assets/SKIN_GUIDE.md)
explains how to mark a skin and fill them. A plain skin simply
decodes as `hasMarker: false`. Open the demo's preview tab with the
same skin to see what `decodeSkin()` actually finds.

## 2. Why must I call refresh() after loadSkin()?

The extension cannot observe texture swaps. `viewer.loadSkin()`
recreates the skin textures and resets the host canvas, so the
controller re-decodes the current skin and re-applies everything on
the next `controller.refresh()` call.

## 3. Does it work next to skinview3d-blockbench?

Yes - coexistence is a design goal. Both extensions add to the
existing scene without rebuilding it; when another provider takes
the `viewer.animation` slot, the ETF ticker hooks through
`addAnimation()` instead of seizing the slot. Call
`controller.rebind()` after the slot object changes (see
[Getting Started](Getting-Started.md) §3.2).

## 4. Why does the glint look different from the in-game ETF?

Upstream renders the glint with fixed render types and no knobs.
Here it is one additive shader overlay with `speed`, `opacity`,
`scale` and `smooth`; the decode data is spec-faithful, and the
defaults are tuned against the in-game look (speed `0.1`, opacity
`1`, scale `1`, smoothing on). See [Options](Options.md) §1.3.

## 5. How do I use my own texture for the glint or the nose?

Set the group's `texture` - at attach time or through
`setGlintOptions()` / `setVillagerNoseOptions()` ([Options](Options.md)
§3 lists every accepted input form). Remote URLs need CORS headers;
the demo's file pickers show the local-file flow.

## 6. Can I run the timed features from my own render loop?

Yes: pass `manageTicker: false` and call `controller.update(dt)`
with the elapsed seconds. Blinking (in the `"auto"` state) and the
scrolling glint follow that clock.
