import type { CSSProperties } from "react";
import { SCENE_MOBILE_IMAGE } from "#/config/scene";

/**
 * Below the md breakpoint the scene is decorative, not interactive: a single
 * flattened image with no hotspot layers and no hit-test overlay. SectionNav
 * is the primary navigation on mobile. No background of its own: the scene
 * sits directly on the page field.
 *
 * Like the desktop layers, the art is a background applied inside a media
 * query — here `[data-scene-mobile]` in styles.css, scoped to max-width 767.
 * Desktop therefore never requests the flat image, and this box paints
 * nothing until the art decodes.
 */
export function SceneMobile() {
	return (
		<div
			aria-hidden="true"
			data-scene-mobile=""
			className="pointer-events-none h-full w-full md:hidden"
			style={
				{
					"--scene-mobile-image": `url('${SCENE_MOBILE_IMAGE}')`,
				} as CSSProperties
			}
		/>
	);
}
