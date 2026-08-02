import { SCENE_ASPECT_RATIO, SCENE_LAYERS } from "#/config/scene";

export const VIEWBOX_WIDTH = 1000;
export const VIEWBOX_HEIGHT = VIEWBOX_WIDTH / SCENE_ASPECT_RATIO;

/** Overlays must sit above every art layer, whatever the config says. */
export const HIT_OVERLAY_Z =
	Math.max(...SCENE_LAYERS.map((layer) => layer.zIndex)) + 10;
export const DEBUG_OVERLAY_Z = HIT_OVERLAY_Z + 10;

export function toViewBoxPoints(
	polygon: ReadonlyArray<[number, number]>,
): string {
	return polygon
		.map(([x, y]) => `${x * VIEWBOX_WIDTH},${y * VIEWBOX_HEIGHT}`)
		.join(" ");
}

/** Vertex average; good enough for the small convex hotspot polygons. */
export function polygonCentroid(
	polygon: ReadonlyArray<[number, number]>,
): [number, number] {
	let sumX = 0;
	let sumY = 0;
	for (const [x, y] of polygon) {
		sumX += x;
		sumY += y;
	}
	return [sumX / polygon.length, sumY / polygon.length];
}
