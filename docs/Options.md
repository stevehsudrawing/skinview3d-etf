# Options

Every option is passed to `attachETFSkinFeatures(viewer, options)` and can be
changed at runtime through the controller's setters; the groups and their
defaults are listed below. Invalid values fall back to the documented defaults.

## 1. Attach options

### 1.1 features

| Key            | Default | Effect                                                         |
| -------------- | ------- | -------------------------------------------------------------- |
| `transparency` | `true`  | honor the decoded base-layer alpha, per body part;             |
| `emissive`     | `true`  | fullbright overlays for the decoded emissive pixels;           |
| `blink`        | `true`  | automatic blinking and the fixed eye states;                   |
| `nose`         | `true`  | villager and textured noses;                                   |
| `enchanted`    | `true`  | the enchanted pixel overlay;                                   |
| `jacket`       | `true`  | the jacket/dress extension (thin / wide, top / no-top styles); |

### 1.2 emissive

| Key     | Default | Effect                           |
| ------- | ------- | -------------------------------- |
| `bloom` | `false` | reserved - accepted and ignored; |

### 1.3 blink

| Key            | Default        | Effect                                                                                                                                                       |
| -------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `state`        | `"auto"`       | `auto` blinks periodically; `open` / `halfClosed` / `closed` hold that state (`halfClosed` needs a 2-frame blink mode; 1-frame modes fall back to `closed`); |
| `periodMs`     | `6000`         | ms between blinks; a `[minMs, maxMs]` tuple re-rolls the interval after every blink, clamped so blinks never overlap;                                        |
| `closedMs`     | `250`          | the fully closed phase in ms;                                                                                                                                |
| `halfClosedMs` | `closedMs / 2` | half-closed lead phase, 2-frame modes; `0` skips it;                                                                                                         |
| `reopenMs`     | `halfClosedMs` | half-closed tail phase, 2-frame modes; `0` pops the eyes open.                                                                                               |

The documented defaults are exported as `DEFAULT_BLINK_OPTIONS`.

### 1.4 villagerNose

| Key       | Default  | Effect                                                        |
| --------- | -------- | ------------------------------------------------------------- |
| `texture` | built-in | the flat villager nose image; `null` disables villager noses. |

### 1.5 enchanted

| Key         | Default  | Effect                                                                                                                            |
| ----------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `texture`   | built-in | the pattern image; `null` renders no enchanted pixels;                                                                            |
| `speed`     | `0.1`    | scroll speed in UV units per second; the offset advances by `speed x direction`; `0` freezes, negative reverses;                  |
| `direction` | `[1, 1]` | the scroll vector in UV space; each axis wraps at one tile period, so any direction stays seamless; `[0, 0]` freezes the pattern; |
| `opacity`   | `1`      | additive brightness factor, clamped to 0..1;                                                                                      |
| `scale`     | `1`      | pattern tiling across the UVs; `<= 0` falls back to the default;                                                                  |
| `smooth`    | `true`   | bilinear pattern filtering (the smoothed in-game look); `false` keeps crisp pixels.                                               |

The documented defaults are exported as `DEFAULT_ENCHANTED_OPTIONS`.

### 1.6 Other

| Key            | Default        | Effect                                                                                                      |
| -------------- | -------------- | ----------------------------------------------------------------------------------------------------------- |
| `manageTicker` | `true`         | the controller drives `update(dt)` from the animation slot; see [Getting Started](Getting-Started.md) §3.3; |
| `onWarning`    | `console.warn` | warning sink, deduplicated once per message.                                                                |

## 2. Runtime setters

| Setter                            | Group                           |
| --------------------------------- | ------------------------------- |
| `setFeatures(partial)`            | `features`                      |
| `setEmissiveOptions(partial)`     | `emissive`                      |
| `setBlinkOptions(partial)`        | `blink` (restarts the schedule) |
| `setVillagerNoseOptions(partial)` | `villagerNose`                  |
| `setEnchantedOptions(partial)`    | `enchanted`                     |

Every setter merges partial updates: an omitted property keeps its current
value, and an explicit `undefined` counts as omitted (it does not clear the
setting). The two texture options keep their presence-based contract - an
explicit `texture: undefined` restores the built-in default, while
`texture: null` turns the feature off.

## 3. Texture inputs

Both texture options accept the same `ETFTextureInput` union - the host's input
forms re-used from `skinview-utils`
([GitHub](https://github.com/bs-community/skinview-utils) |
[npm](https://www.npmjs.com/package/skinview-utils)) (`RemoteImage` /
`TextureSource`), plus a pixel buffer and a `three`
([GitHub](https://github.com/mrdoob/three.js) |
[npm](https://www.npmjs.com/package/three)) `Texture`:

- a URL string;
- `{ src, crossOrigin?, referrerPolicy? }` for CORS-controlled remote images;
- an `HTMLImageElement`, `HTMLVideoElement`, `ImageBitmap`, `HTMLCanvasElement`
  or `OffscreenCanvas`;
- an `ImageData`-compatible pixel buffer;
- a `three` `Texture` wrapping any of the above in its `image`.

Remote URLs load with `crossOrigin: "anonymous"` unless you supply the object
form. Caller objects are only read, never mutated or disposed.

## 4. Migration

Breaking (expected before 1.0): the flat v0.0.1 keys moved into option groups in
v0.0.2, v0.0.3 renamed the glint group after its feature family and reworked the
decode geometry, and v0.0.5 moved the reserved `bloom` flag under its feature
group. The release notes list every mapping.

| Entry              | v0.0.1                                               | v0.0.2                     | current                                               |
| ------------------ | ---------------------------------------------------- | -------------------------- | ----------------------------------------------------- |
| nose texture       | `villagerNoseTexture`                                | `villagerNose.texture`     | (unchanged)                                           |
| enchanted texture  | `glintTexture`                                       | `glint.texture`            | `enchanted.texture`                                   |
| nose setter        | `setVillagerNoseTexture()`                           | `setVillagerNoseOptions()` | (unchanged)                                           |
| enchanted setter   | (new)                                                | `setGlintOptions()`        | `setEnchantedOptions()`                               |
| enchanted defaults | (new)                                                | `DEFAULT_GLINT_OPTIONS`    | `DEFAULT_ENCHANTED_OPTIONS`                           |
| rect corners       | `x1` / `y1` / `x2` / `y2`                            | (unchanged)                | `topLeft` / `bottomRight` (readonly points)           |
| blink eye row      | `eyeHeight`                                          | (unchanged)                | `eyePosition`                                         |
| nose fields        | `villagerSkinTextured` / `variant` / `removesSource` | (unchanged)                | `villagerTextured` / `textured` / `removesFacePixels` |
| jacket width flag  | `fat`                                                | (unchanged)                | `wide`                                                |
| jacket length type | `number`                                             | (unchanged)                | `1`-`8` union                                         |
| bloom flag         | `bloom`                                              | (unchanged)                | `emissive.bloom`                                      |
