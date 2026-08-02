import { SCENE_MOBILE_IMAGE } from "#/config/scene";
import { cn } from "#/lib/utils.ts";
import { useImageLoad } from "./use-image-load";

/**
 * Below the md breakpoint the scene is decorative, not interactive: a single
 * flattened image with no hotspot layers and no hit-test overlay. SectionNav
 * is the primary navigation on mobile. No background of its own: the scene
 * sits directly on the page field.
 */
export function SceneMobile() {
	const image = useImageLoad();

	return (
		<div aria-hidden="true" className="pointer-events-none h-full w-full">
			<img
				ref={image.ref}
				src={SCENE_MOBILE_IMAGE}
				alt=""
				draggable={false}
				onLoad={image.onLoad}
				onError={image.onError}
				className={cn(
					"h-full w-full object-cover",
					image.status !== "loaded" && "opacity-0",
				)}
			/>
		</div>
	);
}
