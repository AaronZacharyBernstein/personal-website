/**
 * The one place source art is read and trimmed. The optimizer, the polygon
 * tracer and the scene checker all take their pixels from loadTrimmed, so
 * they agree to the pixel about where an item's visible content is.
 *
 * Generated art arrives with transparent padding around the object. Boxes
 * have to hug the visible content, or the layout, the hit polygons and the
 * drop animation are all measured against empty space. The trim happens in
 * memory only: the files in assets/images-src are never written.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

/**
 * A pixel counts as content above this alpha. Not "any non-zero pixel": the
 * sources carry faint speckle (alpha 1-8) out to the canvas edge, which
 * would defeat the trim entirely.
 */
export const TRIM_ALPHA_THRESHOLD = 8;

/** Transparent pixels kept around the content, so soft edges are not cut. */
export const TRIM_MARGIN = 2;

export const sourceDir = fileURLToPath(
	new URL("../../assets/images-src/", import.meta.url),
);

/** "/images/desk.webp" -> "desk". */
export function baseName(imagePath: string): string {
	return (imagePath.split("/").pop() ?? "").replace(/\.[^.]+$/, "");
}

export interface TrimmedArt {
	name: string;
	/** Trimmed size. */
	width: number;
	height: number;
	/** Trimmed pixels, RGBA, row-major. */
	data: Buffer;
	/** Untrimmed size and file weight, for reporting. */
	sourceWidth: number;
	sourceHeight: number;
	sourceBytes: number;
	/** Where the trimmed rectangle sits in the source. */
	left: number;
	top: number;
}

const cache = new Map<string, Promise<TrimmedArt>>();

/** The source for `name` (no extension), cropped to its visible content. */
export function loadTrimmed(name: string): Promise<TrimmedArt> {
	let pending = cache.get(name);
	if (!pending) {
		pending = trim(name);
		cache.set(name, pending);
	}
	return pending;
}

async function trim(name: string): Promise<TrimmedArt> {
	const file = readFileSync(`${sourceDir}${name}.png`);
	const { data, info } = await sharp(file)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const { width: sourceWidth, height: sourceHeight } = info;

	let x0 = sourceWidth;
	let y0 = sourceHeight;
	let x1 = -1;
	let y1 = -1;
	for (let y = 0; y < sourceHeight; y++) {
		for (let x = 0; x < sourceWidth; x++) {
			if (data[(y * sourceWidth + x) * 4 + 3] > TRIM_ALPHA_THRESHOLD) {
				if (x < x0) x0 = x;
				if (x > x1) x1 = x;
				if (y < y0) y0 = y;
				if (y > y1) y1 = y;
			}
		}
	}
	if (x1 < 0) {
		throw new Error(`${name}.png has no visible content`);
	}

	const left = Math.max(0, x0 - TRIM_MARGIN);
	const top = Math.max(0, y0 - TRIM_MARGIN);
	const right = Math.min(sourceWidth - 1, x1 + TRIM_MARGIN);
	const bottom = Math.min(sourceHeight - 1, y1 + TRIM_MARGIN);
	const width = right - left + 1;
	const height = bottom - top + 1;

	const trimmed = Buffer.alloc(width * height * 4);
	for (let y = 0; y < height; y++) {
		const from = ((top + y) * sourceWidth + left) * 4;
		data.copy(trimmed, y * width * 4, from, from + width * 4);
	}

	return {
		name,
		width,
		height,
		data: trimmed,
		sourceWidth,
		sourceHeight,
		sourceBytes: file.length,
		left,
		top,
	};
}

/** A sharp pipeline over trimmed art. */
export function sharpFrom(art: TrimmedArt): ReturnType<typeof sharp> {
	return sharp(art.data, {
		raw: { width: art.width, height: art.height, channels: 4 },
	});
}
