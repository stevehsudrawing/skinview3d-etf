/**
 * Enchanted feature: an additive scrolling overlay driven by one
 * shared shader material.
 *
 * The fragment stage samples the pattern with the scrolling offset
 * applied before the tiling scale, so the pattern's apparent movement
 * across the model is `speed x direction` UV units per second no
 * matter the `scale` - the parameters stay decoupled from the
 * perceived speed.
 * The material is additive (three: SrcAlpha/One, so the contribution
 * is the pattern color x the mask alpha x `opacity`), depth-read-only
 * and pushed slightly in front of the source mesh via the shared
 * overlay polygon offset. The built-in pattern is fully opaque, so
 * the texture's own alpha is not used. Upstream ETF has no such
 * knobs and renders the enchanted pixels with fixed render types;
 * the parameter semantics here are our own.
 */

import {
  AdditiveBlending,
  CanvasTexture,
  DoubleSide,
  LinearFilter,
  NearestFilter,
  RepeatWrapping,
  ShaderMaterial,
  Vector2,
  type Texture,
} from "three";
import { OVERLAY_OFFSET } from "../core/overlays";

/** Vertex stage: passes the host geometry UVs through. */
const ENCHANTED_VERTEX_SHADER = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/** Fragment stage: pattern color x mask alpha, additive. */
const ENCHANTED_FRAGMENT_SHADER = `
uniform sampler2D uMask;
uniform sampler2D uEnchanted;
uniform vec2 uOffset;
uniform float uScale;
uniform float uOpacity;
varying vec2 vUv;

void main() {
  vec4 m = texture2D(uMask, vUv);
  vec4 g = texture2D(uEnchanted, (vUv + uOffset) * uScale);
  gl_FragColor = vec4(g.rgb, m.a * uOpacity);
}
`;

/**
 * The enchanted pattern's sampling offset, in UV units: each axis
 * advances independently and wraps at one pattern tile.
 */
export interface EnchantedOffset {
  /** Horizontal offset within `[0, 1 / scale)`. */
  x: number;
  /** Vertical offset within `[0, 1 / scale)`. */
  y: number;
}

/**
 * Wraps an offset value into `[0, wrap)` by subtracting whole
 * periods, so any input range normalizes in one step.
 *
 * @param value - The value to wrap.
 * @param wrap - The wrap period.
 * @returns The wrapped value within `[0, wrap)`.
 */
function wrapOffset(value: number, wrap: number): number {
  return value - Math.floor(value / wrap) * wrap;
}

/**
 * Advances the enchanted pattern's offset by `speed x direction x dt`
 * and wraps each axis into one tile period (`[0, 1 / scale)`). The
 * wrap period is a whole tile on both axes, so every wrap shifts the
 * pattern by exactly one tile and the scroll stays seamless for any
 * direction and scale; with `[1, 1]` both axes advance and wrap
 * exactly like the original diagonal phase.
 *
 * @param offset - The current offset within `[0, 1 / scale)`.
 * @param speed - The scroll speed in UV units per second.
 * @param direction - The UV-space scroll vector.
 * @param dt - Elapsed time in seconds (non-negative).
 * @param scale - The pattern tiling (the wrap period is `1 / scale`).
 * @returns The advanced offset within `[0, 1 / scale)`.
 */
export function advanceEnchantedOffset(
  offset: EnchantedOffset,
  speed: number,
  direction: readonly [number, number],
  dt: number,
  scale: number,
): EnchantedOffset {
  const wrap = 1 / scale;
  return {
    x: wrapOffset(offset.x + speed * direction[0] * dt, wrap),
    y: wrapOffset(offset.y + speed * direction[1] * dt, wrap),
  };
}

/**
 * Wraps a resolved pattern canvas as a repeating texture. The
 * sampler repeats (the pattern tiles across the skin UVs); `smooth`
 * selects bilinear filtering (the smoothed in-game look) or
 * nearest pixels (crisp pixel art). Mipmaps are off so the tiling
 * never bleeds between texture levels.
 *
 * @param canvas - The resolved pattern canvas.
 * @param smooth - Bilinear filtering when `true`, nearest otherwise.
 * @returns The prepared texture, owned by the caller.
 */
export function createEnchantedTexture(
  canvas: HTMLCanvasElement,
  smooth: boolean,
): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.magFilter = smooth ? LinearFilter : NearestFilter;
  texture.minFilter = smooth ? LinearFilter : NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

/**
 * Updates a repeating pattern texture in place: swaps in a new source
 * canvas and / or refreshes the filtering pair. Both changes need
 * `needsUpdate` because three applies the sampler parameters when
 * the texture uploads; an unchanged call leaves the texture
 * untouched.
 *
 * @param texture - A texture created by {@link createEnchantedTexture}.
 * @param canvas - The resolved pattern canvas (the new source).
 * @param smooth - Bilinear filtering when `true`, nearest otherwise.
 */
export function updateEnchantedTexture(
  texture: CanvasTexture,
  canvas: HTMLCanvasElement,
  smooth: boolean,
): void {
  if (texture.image !== canvas) {
    texture.image = canvas;
    texture.needsUpdate = true;
  }
  const filter = smooth ? LinearFilter : NearestFilter;
  if (texture.magFilter !== filter) {
    texture.magFilter = filter;
    texture.minFilter = filter;
    texture.needsUpdate = true;
  }
}

/**
 * Draw order of the enchanted overlays: one above the emissive
 * overlays (which draw at the default order 0), so the additive
 * pattern is never hidden behind them.
 */
export const ENCHANTED_RENDER_ORDER = 1;

/**
 * Creates the shared enchanted material: the decoded mask x the
 * scrolling pattern, additively blended.
 *
 * @param mask - The decoded enchanted mask texture (reused host UVs).
 * @param pattern - The repeating pattern texture.
 * @param scale - The pattern tiling across the UVs.
 * @param opacity - The additive brightness factor, 0..1.
 * @param offset - The initial scroll offset, in UV units.
 * @returns The prepared material, owned by the caller.
 */
export function createEnchantedMaterial(
  mask: Texture,
  pattern: Texture,
  scale: number,
  opacity: number,
  offset: EnchantedOffset,
): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uMask: { value: mask },
      uEnchanted: { value: pattern },
      uOffset: { value: new Vector2(offset.x, offset.y) },
      uScale: { value: scale },
      uOpacity: { value: opacity },
    },
    vertexShader: ENCHANTED_VERTEX_SHADER,
    fragmentShader: ENCHANTED_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
    ...OVERLAY_OFFSET,
  });
}

/**
 * Updates the scroll offset uniform in place; uniform value mutation
 * needs no `needsUpdate`.
 *
 * @param material - A material created by {@link createEnchantedMaterial}.
 * @param offset - The new offset, in UV units per axis.
 */
export function setEnchantedOffset(
  material: ShaderMaterial,
  offset: EnchantedOffset,
): void {
  (material.uniforms.uOffset.value as Vector2).set(offset.x, offset.y);
}

/**
 * Updates the live tuning uniforms (tiling scale and additive
 * brightness) in place; the scroll offset stays with
 * {@link setEnchantedOffset}.
 *
 * @param material - A material created by {@link createEnchantedMaterial}.
 * @param scale - The pattern tiling across the UVs.
 * @param opacity - The additive brightness factor, 0..1.
 */
export function setEnchantedTuning(
  material: ShaderMaterial,
  scale: number,
  opacity: number,
): void {
  material.uniforms.uScale.value = scale;
  material.uniforms.uOpacity.value = opacity;
}
