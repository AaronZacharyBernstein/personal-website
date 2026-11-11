import { SCENE_ASPECT_RATIO, SCENE_LAYERS } from "#/config/scene";
import { type Point, SCENE_TACKS } from "#/config/scene-geometry";

export const VIEWBOX_WIDTH = 1000;
/** Same aspect as the scene box, so SVG overlays scale uniformly. */
export const VIEWBOX_HEIGHT = VIEWBOX_WIDTH / SCENE_ASPECT_RATIO;

/** Overlays must sit above every art layer and tack, whatever the config says. */
export const HIT_OVERLAY_Z =
	Math.max(
		...SCENE_LAYERS.map((layer) => layer.zIndex),
		...SCENE_TACKS.map((tack) => tack.zIndex),
	) + 10;
/** The hover label takes no pointer events, so it can ride above the hit overlay. */
export const LABEL_Z = HIT_OVERLAY_Z + 5;
export const DEBUG_OVERLAY_Z = HIT_OVERLAY_Z + 10;

/** Normalized scene points to an SVG `points` attribute. */
export function toViewBoxPoints(polygon: ReadonlyArray<Point>): string {
	return polygon
		.map(([x, y]) => `${x * VIEWBOX_WIDTH},${y * VIEWBOX_HEIGHT}`)
		.join(" ");
}

/** Vertex average; good enough for the small hotspot polygons. */
export function polygonCentroid(polygon: ReadonlyArray<Point>): Point {
	let sumX = 0;
	let sumY = 0;
	for (const [x, y] of polygon) {
		sumX += x;
		sumY += y;
	}
	return [sumX / polygon.length, sumY / polygon.length];
}
