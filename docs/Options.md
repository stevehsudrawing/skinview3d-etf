# Options

Every option is passed to `attachETFSkinFeatures(viewer, options)`
and can be changed at runtime through the controller's setters; the
groups and their defaults are listed below. Invalid values fall back
to the documented defaults.

## 1. Attach options

### 1.1 features

| Key            | Default | Effect                                                           |
| -------------- | ------- | ---------------------------------------------------------------- |
| `transparency` | `true`  | honor the decoded base-layer alpha, per body part;               |
| `emissive`     | `true`  | fullbright glow overlays for the decoded emissive pixels;        |
| `blink`        | `true`  | automatic blinking and the fixed eye states;                     |
| `nose`         | `true`  | villager and textured noses;                                     |
| `enchanted`    | `true`  | the enchanted (glint) overlay;                                   |
| `jacket`       | `true`  | deferred - accepted and ignored until the jacket renderer lands. |

### 1.2 blink

| Key            | Default        | Effect                                                                                                                                                       |
| -------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `state`        | `"auto"`       | `auto` blinks periodically; `open` / `halfClosed` / `closed` hold that state (`halfClosed` needs a 2-frame blink mode; 1-frame modes fall back to `closed`); |
| `periodMs`     | `6000`         | ms between blinks; a `[minMs, maxMs]` tuple re-rolls the interval after every blink, clamped so blinks never overlap;                                        |
| `closedMs`     | `250`          | the fully closed phase in ms;                                                                                                                                |
| `halfClosedMs` | `closedMs / 2` | half-closed lead phase, 2-frame modes; `0` skips it;                                                                                                         |
| `reopenMs`     | `halfClosedMs` | half-closed tail phase, 2-frame modes; `0` pops the eyes open.                                                                                               |

The documented defaults are exported as `DEFAULT_BLINK_OPTIONS`.

### 1.3 glint

| Key       | Default  | Effect                                                                              |
| --------- | -------- | ----------------------------------------------------------------------------------- |
| `texture` | built-in | the pattern image; `null` renders no glint;                                         |
| `speed`   | `0.1`    | diagonal scroll in UV units per second; `0` freezes, negative reverses;             |
| `opacity` | `1`      | additive brightness factor, clamped to 0..1;                                        |
| `scale`   | `1`      | pattern tiling across the UVs; `<= 0` falls back to the default;                    |
| `smooth`  | `true`   | bilinear pattern filtering (the smoothed in-game look); `false` keeps crisp pixels. |

The documented defaults are exported as `DEFAULT_GLINT_OPTIONS`.

### 1.4 villagerNose

| Key       | Default  | Effect                                                        |
| --------- | -------- | ------------------------------------------------------------- |
| `texture` | built-in | the flat villager nose image; `null` disables villager noses. |

### 1.5 Other

| Key            | Default        | Effect                                                                                                   |
| -------------- | -------------- | -------------------------------------------------------------------------------------------------------- |
| `bloom`        | `false`        | reserved - accepted and ignored;                                                                         |
| `manageTicker` | `true`         | the controller drives `update(dt)` from the animation slot; see [Getting Started](Getting-Started) §3.3; |
| `onWarning`    | `console.warn` | warning sink, deduplicated once per message.                                                             |

## 2. Runtime setters

| Setter                            | Group                           |
| --------------------------------- | ------------------------------- |
| `setFeatures(partial)`            | `features`                      |
| `setBlinkOptions(partial)`        | `blink` (restarts the schedule) |
| `setGlintOptions(partial)`        | `glint`                         |
| `setVillagerNoseOptions(partial)` | `villagerNose`                  |

Every setter merges partial updates: an omitted property keeps its
current value. The two texture options add one nuance - an explicit
`texture: undefined` restores the built-in default, while
`texture: null` turns the feature off.

## 3. Texture inputs

Both texture options accept the same `ETFTextureInput` union:

- a URL string;
- `{ src, crossOrigin?, referrerPolicy? }` for CORS-controlled
  remote images;
- an `HTMLImageElement`, `HTMLVideoElement`, `ImageBitmap`,
  `HTMLCanvasElement` or `OffscreenCanvas`;
- an `ImageData`-compatible pixel buffer;
- a `three` `Texture` wrapping any of the above in its `image`.

Remote URLs load with `crossOrigin: "anonymous"` unless you supply
the object form. Caller objects are only read, never mutated or
disposed.

## 4. Migration from v0.0.1

Breaking (expected before 1.0): the flat v0.0.1 keys moved into
option groups.

| v0.0.1                | v0.0.2                 |
| --------------------- | ---------------------- |
| `villagerNoseTexture` | `villagerNose.texture` |
| `glintTexture`        | `glint.texture`        |

`ETFController.setVillagerNoseTexture()` is replaced by
`setVillagerNoseOptions()`, and `setGlintOptions()` is new.
