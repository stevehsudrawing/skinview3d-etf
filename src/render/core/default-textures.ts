/**
 * Built-in, self-drawn textures shipped with the renderer.
 *
 * The villager texture is the project's own artwork. It substitutes
 * the vanilla villager skin for the flat villager nose; only the nose
 * box UVs `(24,0)-(32,6)` are sampled, so the transparent background
 * is irrelevant. No third-party assets are embedded.
 */

import { resolveTextureInput } from "./textures";

/**
 * Data URL of the self-drawn 64x64 villager texture (only the nose box
 * region carries pixels).
 */
export const DEFAULT_VILLAGER_NOSE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAeElEQVR4nO3SwQmDUAwG4LzOIPTQIdotdJt6affROew4HgR3eAWhYC+9lIeC33dKTn9IkqKwnPMS8GxuS3E5V5/AdO+GSKn4CD+dNk3fgeLrf9TXr8uP0xzrvu1fm77A4T/AAnYwAwAAAAAAAAAAAAAAAAAA/Csi3jdiDgvbSE+SAAAAAElFTkSuQmCC";

/**
 * Loads the built-in villager texture as a canvas.
 *
 * @returns A canvas holding the 64x64 villager texture.
 */
export function loadDefaultVillagerNose(): Promise<HTMLCanvasElement> {
  return resolveTextureInput(DEFAULT_VILLAGER_NOSE_DATA_URL);
}
