/**
 * The one place item space meets scene space. Everything that needs to know
 * where a point of an item ends up on the board — the hit overlay, the debug
 * overlay, the calibration tool, the image scripts — goes through
 * projectToScene, so an item's art, its polygon and its tack can never
 * disagree about a rotation.
 *
 * Pure and DOM-free: the build scripts import it through tsx.
 */
import type {
	HotspotLayer,
	SceneLayer,
	SceneShadow,
	TackColor,
	TackVariant,
} from "./scene";
import {
	SCENE_ASPECT_RATIO,
	SCENE_LAYERS,
	SCENE_REFERENCE_WIDTH,
	SCENE_TACK_ASPECT,
	SCENE_TACK_HEIGHT,
} from "./scene";

export type Point = [number, number];

/** What projectToScene needs from a layer; tacks and items both satisfy it. */
export interface Placed {
	box: { x: number; y: number; width: number; height: number };
	rotation?: number;
	tack?: { at: [number, number] };
}

/** The point an item turns about, in its own box space. */
export function layerPivot(layer: Placed): Point {
	return layer.tack ? layer.tack.at : [0.5, 0.5];
}

function rotationTerms(layer: Placed): { cos: number; sin: number } | null {
	const degrees = layer.rotation ?? 0;
	if (degrees === 0) {
		return null;
	}
	const radians = (degrees * Math.PI) / 180;
	return { cos: Math.cos(radians), sin: Math.sin(radians) };
}

function pivotInScene(layer: Placed): Point {
	const [u, v] = layerPivot(layer);
	return [
		layer.box.x + u * layer.box.width,
		layer.box.y + v * layer.box.height,
	];
}

/**
 * Item space (0..1 inside the layer's box, before rotation) to normalized
 * scene space, with the layer's CSS rotation applied about its pivot.
 *
 * The rotation runs in an aspect-true space — x scaled by the scene's aspect
 * ratio so one unit is the same length on both axes — because normalized x
 * and y are fractions of different lengths. Matches CSS `rotate()`: positive
 * is clockwise with y pointing down.
 */
export function projectToScene(layer: Placed, [u, v]: Point): Point {
	const x = layer.box.x + u * layer.box.width;
	const y = layer.box.y + v * layer.box.height;
	const terms = rotationTerms(layer);
	if (!terms) {
		return [x, y];
	}
	const [pivotX, pivotY] = pivotInScene(layer);
	const dx = (x - pivotX) * SCENE_ASPECT_RATIO;
	const dy = y - pivotY;
	return [
		pivotX + (dx * terms.cos - dy * terms.sin) / SCENE_ASPECT_RATIO,
		pivotY + dx * terms.sin + dy * terms.cos,
	];
}

/** Inverse of projectToScene: a scene point back into the layer's box space. */
export function projectFromScene(layer: Placed, [x, y]: Point): Point {
	let unrotatedX = x;
	let unrotatedY = y;
	const terms = rotationTerms(layer);
	if (terms) {
		const [pivotX, pivotY] = pivotInScene(layer);
		const dx = (x - pivotX) * SCENE_ASPECT_RATIO;
		const dy = y - pivotY;
		unrotatedX =
			pivotX + (dx * terms.cos + dy * terms.sin) / SCENE_ASPECT_RATIO;
		unrotatedY = pivotY - dx * terms.sin + dy * terms.cos;
	}
	return [
		(unrotatedX - layer.box.x) / layer.box.width,
		(unrotatedY - layer.box.y) / layer.box.height,
	];
}

/** A hotspot's clickable shape in scene space, rotation included. */
export function layerPolygonInScene(layer: HotspotLayer): Point[] {
	return layer.polygon.map((point) => projectToScene(layer, point));
}

/** A thumbtack as its own paintable layer, derived from its item. */
export interface TackLayer {
	id: string;
	/** The item this tack holds. */
	ownerId: string;
	image: string;
	box: { x: number; y: number; width: number; height: number };
	zIndex: number;
	color: TackColor;
	variant: TackVariant;
}

export function tackImage(color: TackColor, variant: TackVariant): string {
	return `/images/thumbtack-${color}-${variant}.webp`;
}

/**
 * The tack for one item, or null if it has none. Centred on the item's
 * pivot — which rotation leaves where it is — and drawn one step above the
 * item. It carries no rotation of its own: the highlight baked into the art
 * has to stay in the upper left.
 */
export function tackLayerFor(layer: SceneLayer): TackLayer | null {
	if (!layer.tack) {
		return null;
	}
	const [centerX, centerY] = pivotInScene(layer);
	const width = SCENE_TACK_HEIGHT * SCENE_TACK_ASPECT[layer.tack.variant];
	// SCENE_TACK_HEIGHT is a fraction of the scene's width; a box height is a
	// fraction of its height.
	const height = SCENE_TACK_HEIGHT * SCENE_ASPECT_RATIO;
	return {
		id: `${layer.id}-tack`,
		ownerId: layer.id,
		image: tackImage(layer.tack.color, layer.tack.variant),
		box: {
			x: centerX - width / 2,
			y: centerY - height / 2,
			width,
			height,
		},
		zIndex: layer.zIndex + 1,
		color: layer.tack.color,
		variant: layer.tack.variant,
	};
}

/** Every tack on the board, in the order of the items that own them. */
export function tackLayers(
	layers: ReadonlyArray<SceneLayer> = SCENE_LAYERS,
): TackLayer[] {
	return layers
		.map(tackLayerFor)
		.filter((tack): tack is TackLayer => tack !== null);
}

export const SCENE_TACKS: ReadonlyArray<TackLayer> = tackLayers();

/** Pixels at the reference width, as a fraction of the scene's width. */
export function referencePixels(pixels: number): number {
	return pixels / SCENE_REFERENCE_WIDTH;
}

/**
 * A shadow preset as a CSS filter. Lengths are fractions of --stage-w, the
 * composition's rendered width (declared on the stage in styles.css), so a
 * shadow scales with the items instead of staying a fixed pixel size on a
 * shrunken board.
 */
export function shadowFilter(shadow: SceneShadow): string {
	const length = (pixels: number) =>
		`calc(var(--stage-w) * ${Number(referencePixels(pixels).toFixed(6))})`;
	return `drop-shadow(${length(shadow.x)} ${length(shadow.y)} ${length(shadow.blur)} rgba(0,0,0,${shadow.opacity}))`;
}

/**
 * The same shadow resolved to pixels for a scene of the given width. GSAP
 * tweens between two of these, and the image script bakes one into the
 * mobile composite.
 */
export function shadowAtWidth(
	shadow: SceneShadow,
	sceneWidth: number,
): SceneShadow {
	const scale = sceneWidth / SCENE_REFERENCE_WIDTH;
	return {
		x: shadow.x * scale,
		y: shadow.y * scale,
		blur: shadow.blur * scale,
		opacity: shadow.opacity,
	};
}
