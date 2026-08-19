/**
 * Section-panel presentation tunables. The panel is the content surface the
 * section routes share, not scene geometry, so these live apart from
 * scene.ts. Sizes are consumed as inline custom properties / styles, never
 * hardcoded in components.
 */

/** Max width of the desktop panel box. */
export const PANEL_MAX_WIDTH = "56rem";

/** Max height of the desktop panel box; the body scrolls internally past it. */
export const PANEL_MAX_HEIGHT = "85vh";
