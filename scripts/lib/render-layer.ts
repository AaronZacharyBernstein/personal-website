/**
 * Draws a scene layer the way the browser does — trimmed art stretched to
 * its box, turned about its pivot — into pixels at a given scene size. The
 * mobile composite and the scene checker both build on it, so "what the
 * checker measured" and "what was flattened" are the same picture.
 */

import sharp from "sharp";
import type { SceneLayer, SceneShadow } from "../../src/config/scene";
import { SCENE_BOARD_ID } from "../../src/config/scene";
import {
	layerPivot,
	type Placed,
	tackLayers,
} from "../../src/config/scene-geometry";
import { baseName, loadTrimmed, sharpFrom } from "./source-art";

export interface RenderLayer extends Placed {
	id: string;
	image: string;
	zIndex: number;
	role: "board" | "item" | "tack";
	/** For a tack, the item it holds. */
	ownerId?: string;
	/** Set on a layer the desktop board carries to a corner of the cork. */
	anchor?: SceneLayer["anchor"];
}

/** Items and their derived tacks, in paint order. */
export function renderLayers(layers: ReadonlyArray<SceneLayer>): RenderLayer[] {
	const items: RenderLayer[] = layers.map((layer) => ({
		id: layer.id,
		image: layer.image,
		zIndex: layer.zIndex,
		box: layer.box,
		rotation: layer.rotation,
		tack: layer.tack,
		anchor: layer.anchor,
		role: layer.id === SCENE_BOARD_ID ? "board" : "item",
	}));
	const tacks: RenderLayer[] = tackLayers(layers).map((tack) => ({
		id: tack.id,
		image: tack.image,
		zIndex: tack.zIndex,
		box: tack.box,
		role: "tack",
		ownerId: tack.ownerId,
	}));
	// Stable sort: equal z keeps config order, as the DOM does.
	return [...items, ...tacks].sort((a, b) => a.zIndex - b.zIndex);
}

/** RGBA pixels and where their top-left corner sits in the scene. */
export interface Raster {
	data: Buffer;
	width: number;
	height: number;
	left: number;
	top: number;
}

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

export async function renderLayer(
	layer: RenderLayer,
	sceneWidth: number,
	sceneHeight: number,
): Promise<Raster> {
	const art = await loadTrimmed(baseName(layer.image));
	const boxLeft = layer.box.x * sceneWidth;
	const boxTop = layer.box.y * sceneHeight;
	const boxWidth = layer.box.width * sceneWidth;
	const boxHeight = layer.box.height * sceneHeight;
	const width = Math.max(1, Math.round(boxWidth));
	const height = Math.max(1, Math.round(boxHeight));

	// `fill`, like the CSS `background-size: 100% 100%` it mirrors.
	const resized = await sharpFrom(art)
		.resize(width, height, { fit: "fill" })
		.raw()
		.toBuffer();

	const rotation = layer.rotation ?? 0;
	if (rotation === 0) {
		return {
			data: resized,
			width,
			height,
			left: Math.round(boxLeft),
			top: Math.round(boxTop),
		};
	}

	// A second pipeline: sharp fixes the order of operations within one, and
	// the rotation has to follow the resize.
	const { data, info } = await sharp(resized, {
		raw: { width, height, channels: 4 },
	})
		.rotate(rotation, { background: TRANSPARENT })
		.raw()
		.toBuffer({ resolveWithObject: true });

	// sharp turns the image about its own centre and grows the canvas; the
	// browser turns it about the pivot. So find where the box's centre lands
	// after the pivot rotation and hang the grown canvas on that.
	const [pivotU, pivotV] = layerPivot(layer);
	const pivotX = boxLeft + pivotU * boxWidth;
	const pivotY = boxTop + pivotV * boxHeight;
	const radians = (rotation * Math.PI) / 180;
	const cos = Math.cos(radians);
	const sin = Math.sin(radians);
	const dx = boxLeft + boxWidth / 2 - pivotX;
	const dy = boxTop + boxHeight / 2 - pivotY;
	const centerX = pivotX + dx * cos - dy * sin;
	const centerY = pivotY + dx * sin + dy * cos;

	return {
		data,
		width: info.width,
		height: info.height,
		left: Math.round(centerX - info.width / 2),
		top: Math.round(centerY - info.height / 2),
	};
}

/**
 * The drop shadow a raster casts: its alpha, blurred, tinted black and
 * offset. `shadow` is in pixels at the scene size being rendered. Mirrors
 * CSS `drop-shadow()`, whose blur radius is twice the Gaussian's sigma.
 */
export async function renderShadow(
	raster: Raster,
	shadow: SceneShadow,
): Promise<Raster> {
	const sigma = Math.max(0.3, shadow.blur / 2);
	const pad = Math.ceil(sigma * 3) + 1;
	const width = raster.width + pad * 2;
	const height = raster.height + pad * 2;

	const alpha = Buffer.alloc(width * height);
	for (let y = 0; y < raster.height; y++) {
		for (let x = 0; x < raster.width; x++) {
			alpha[(y + pad) * width + x + pad] =
				raster.data[(y * raster.width + x) * 4 + 3];
		}
	}
	const { data: blurred, info } = await sharp(alpha, {
		raw: { width, height, channels: 1 },
	})
		.blur(sigma)
		.raw()
		.toBuffer({ resolveWithObject: true });

	const data = Buffer.alloc(width * height * 4);
	for (let i = 0; i < width * height; i++) {
		data[i * 4 + 3] = Math.round(blurred[i * info.channels] * shadow.opacity);
	}
	return {
		data,
		width,
		height,
		left: raster.left - pad + Math.round(shadow.x),
		top: raster.top - pad + Math.round(shadow.y),
	};
}

/** Crop a raster to the scene canvas; null if it lies wholly outside. */
export function clipToScene(
	raster: Raster,
	sceneWidth: number,
	sceneHeight: number,
): Raster | null {
	const left = Math.max(0, raster.left);
	const top = Math.max(0, raster.top);
	const right = Math.min(sceneWidth, raster.left + raster.width);
	const bottom = Math.min(sceneHeight, raster.top + raster.height);
	if (right <= left || bottom <= top) {
		return null;
	}
	if (
		left === raster.left &&
		top === raster.top &&
		right === raster.left + raster.width &&
		bottom === raster.top + raster.height
	) {
		return raster;
	}
	const width = right - left;
	const height = bottom - top;
	const data = Buffer.alloc(width * height * 4);
	for (let y = 0; y < height; y++) {
		const from =
			((top - raster.top + y) * raster.width + (left - raster.left)) * 4;
		raster.data.copy(data, y * width * 4, from, from + width * 4);
	}
	return { data, width, height, left, top };
}

/**
 * The finished board as one image: every layer and tack in paint order at
 * its box and rotation, each over its own shadow. The board casts none.
 */
export async function composeScene(
	layers: ReadonlyArray<SceneLayer>,
	sceneWidth: number,
	sceneHeight: number,
	shadow: SceneShadow,
): Promise<ReturnType<typeof sharp>> {
	const overlays: Parameters<ReturnType<typeof sharp>["composite"]>[0] = [];
	const push = (raster: Raster | null) => {
		if (raster) {
			overlays.push({
				input: raster.data,
				raw: { width: raster.width, height: raster.height, channels: 4 },
				left: raster.left,
				top: raster.top,
			});
		}
	};
	for (const layer of renderLayers(layers)) {
		const raster = await renderLayer(layer, sceneWidth, sceneHeight);
		if (layer.role !== "board") {
			push(
				clipToScene(
					await renderShadow(raster, shadow),
					sceneWidth,
					sceneHeight,
				),
			);
		}
		push(clipToScene(raster, sceneWidth, sceneHeight));
	}
	return sharp({
		create: {
			width: sceneWidth,
			height: sceneHeight,
			channels: 4,
			background: TRANSPARENT,
		},
	}).composite(overlays);
}
