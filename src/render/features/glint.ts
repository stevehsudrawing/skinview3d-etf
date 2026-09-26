/**
 * Enchanted (glint) feature: an additive scrolling overlay driven by
 * one shared shader material.
 *
 * The fragment stage samples the pattern with the scrolling offset
 * applied before the tiling scale, so the pattern's apparent movement
 * across the model is `speed` UV units per second no matter the
 * `scale` - the parameter stays decoupled from the perceived speed.
 * The material is additive (three: SrcAlpha/One, so the contribution
 * is the pattern color x the mask alpha x `opacity`), depth-read-only
 * and pushed slightly in front of the source mesh via the shared
 * overlay polygon offset. The built-in glint pattern is fully opaque,
 * so the texture's own alpha is not used. Upstream ETF has no such
 * knobs and renders the glint with fixed render types; the parameter
 * semantics here are our own.
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
const GLINT_VERTEX_SHADER = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/** Fragment stage: pattern color x mask alpha, additive. */
const GLINT_FRAGMENT_SHADER = `
uniform sampler2D uMask;
uniform sampler2D uGlint;
uniform vec2 uOffset;
uniform float uScale;
uniform float uOpacity;
varying vec2 vUv;

void main() {
  vec4 m = texture2D(uMask, vUv);
  vec4 g = texture2D(uGlint, (vUv + uOffset) * uScale);
  gl_FragColor = vec4(g.rgb, m.a * uOpacity);
}
`;

/**
 * Advances the glint phase by `speed * dt` and wraps it into one
 * tile period (`[0, 1 / scale)`). Positive speeds scroll along the
 * (u, v) diagonal, negative speeds against it. Because the wrap
 * period is a whole tile, every wrap shifts the pattern by exactly
 * one tile - the scroll stays seamless at any scale.
 *
 * @param phase - The current phase in `[0, 1 / scale)`.
 * @param speed - The scroll speed in UV units per second.
 * @param dt - Elapsed time in seconds (non-negative).
 * @param scale - The pattern tiling (the wrap period is `1 / scale`).
 * @returns The advanced phase in `[0, 1 / scale)`.
 */
export function advanceGlintPhase(
  phase: number,
  speed: number,
  dt: number,
  scale: number,
): number {
  const wrap = 1 / scale;
  const advanced = phase + speed * dt;
  return advanced - Math.floor(advanced / wrap) * wrap;
}

/**
 * Wraps a resolved glint pattern canvas as a repeating texture. The
 * sampler repeats (the pattern tiles across the skin UVs); `smooth`
 * selects bilinear filtering (the smoothed in-game glint look) or
 * nearest pixels (crisp pixel art). Mipmaps are off so the tiling
 * never bleeds between texture levels.
 *
 * @param canvas - The resolved pattern canvas.
 * @param smooth - Bilinear filtering when `true`, nearest otherwise.
 * @returns The prepared texture, owned by the caller.
 */
export function createGlintTexture(
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
 * @param texture - A texture created by {@link createGlintTexture}.
 * @param canvas - The resolved pattern canvas (the new source).
 * @param smooth - Bilinear filtering when `true`, nearest otherwise.
 */
export function updateGlintTexture(
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
 * Creates the shared glint material: the decoded mask x the scrolling
 * pattern, additively blended.
 *
 * @param mask - The decoded enchanted mask texture (reused host UVs).
 * @param glint - The repeating pattern texture.
 * @param scale - The pattern tiling across the UVs.
 * @param opacity - The additive brightness factor, 0..1.
 * @param phase - The initial scroll phase in `[0, 1 / scale)`.
 * @returns The prepared material, owned by the caller.
 */
export function createGlintMaterial(
  mask: Texture,
  glint: Texture,
  scale: number,
  opacity: number,
  phase: number,
): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uMask: { value: mask },
      uGlint: { value: glint },
      uOffset: { value: new Vector2(phase, phase) },
      uScale: { value: scale },
      uOpacity: { value: opacity },
    },
    vertexShader: GLINT_VERTEX_SHADER,
    fragmentShader: GLINT_FRAGMENT_SHADER,
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
 * @param material - A material created by {@link createGlintMaterial}.
 * @param phase - The new phase in `[0, 1 / scale)`.
 */
export function setGlintPhase(material: ShaderMaterial, phase: number): void {
  (material.uniforms.uOffset.value as Vector2).set(phase, phase);
}

/**
 * Updates the live tuning uniforms (tiling scale and additive
 * brightness) in place; the scroll offset stays with
 * {@link setGlintPhase}.
 *
 * @param material - A material created by {@link createGlintMaterial}.
 * @param scale - The pattern tiling across the UVs.
 * @param opacity - The additive brightness factor, 0..1.
 */
export function setGlintTuning(
  material: ShaderMaterial,
  scale: number,
  opacity: number,
): void {
  material.uniforms.uScale.value = scale;
  material.uniforms.uOpacity.value = opacity;
}
