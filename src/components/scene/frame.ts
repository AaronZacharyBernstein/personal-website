import type { CSSProperties } from "react";
import {
	SCENE_ASPECT_RATIO,
	SCENE_FIT_MARGIN,
	SCENE_MAX_WIDTH,
} from "#/config/scene";

/**
 * Inline style for anything sized as the scene box (`data-scene-frame`):
 * the scene itself, the calibration canvas, and the placeholder that holds
 * the layout while the calibration chunk loads. The `[data-scene-frame]`
 * rules in styles.css turn these into a width, a max-width and an aspect
 * ratio — in a stylesheet rather than here because the fit-to-height width
 * applies only at md and up, and inline styles cannot be media-scoped.
 */
export const SCENE_FRAME_STYLE = {
	"--scene-max-width": SCENE_MAX_WIDTH,
	"--scene-fit-margin": SCENE_FIT_MARGIN,
	"--scene-aspect": SCENE_ASPECT_RATIO,
} as CSSProperties;
