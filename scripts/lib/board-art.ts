/**
 * Everything the full-viewport desktop board needs from board.png, measured
 * from the art rather than typed in by hand:
 *
 *   - the 9-slice offsets: how far each side of the wood frame reaches in
 *     from the edge of the art, to the inner end of its inner outline;
 *   - a frame image (the board with its cork cut out) for `border-image`;
 *   - a cork tile: a patch of clean cork mirrored 2x2, so every edge of the
 *     tile meets its own reflection and the tiling has no seam;
 *   - the inner shadow the art has along the top and left of the cork, as a
 *     translucent overlay, so tiled cork still reads as recessed.
 *
 * All from lib/source-art's trimmed pixels — the same ones the mobile
 * composite is built on.
 */

import sharp from "sharp";
import { loadTrimmed, type TrimmedArt } from "./source-art";

/** Luminance below this is outline ink. */
const INK = 70;
/** Side of the square cork patch. The tile is twice this each way. */
const TILE_PATCH = 512;
/** How far in from the frame the shadow overlay looks for shadow, in art px. */
const SHADOW_ZONE = 72;
/** Opacity of the overlay where the art's shadow is at full strength. */
const SHADOW_ALPHA = 0.3;

export interface BoardMeasure {
	width: number;
	height: number;
	/** Art px from each edge to where the cork begins. The 9-slice offsets. */
	slice: { top: number; right: number; bottom: number; left: number };
	/** The cork tile, in art px. */
	tile: { width: number; height: number };
	/** The shadow overlay image and its own 9-slice (right and bottom are 0). */
	shadow: {
		width: number;
		height: number;
		slice: { top: number; left: number };
	};
}

function luminance(art: TrimmedArt, x: number, y: number): number {
	const i = (y * art.width + x) * 4;
	return (
		0.299 * art.data[i] + 0.587 * art.data[i + 1] + 0.114 * art.data[i + 2]
	);
}

function isInk(art: TrimmedArt, x: number, y: number): boolean {
	return (
		art.data[(y * art.width + x) * 4 + 3] > 128 && luminance(art, x, y) < INK
	);
}

function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Walk inward from one edge along one line and return how far the frame
 * reaches: the end of the first run of ink that starts between 3% and 8% of
 * the art's width in. (The outer outline is nearer the edge than that; the
 * cork's speckle is further in.) Null if the line has no such run.
 */
function frameReach(
	art: TrimmedArt,
	ink: (step: number) => boolean,
): number | null {
	let step = Math.round(art.width * 0.03);
	const limit = Math.round(art.width * 0.08);
	while (step < limit && !ink(step)) step++;
	if (step >= limit) return null;
	while (step < art.width * 0.15 && ink(step)) step++;
	return step;
}

/**
 * The slice offsets: for each side, the deepest the inner outline reaches
 * anywhere along it. The outline is hand-drawn and wobbles, so a slice at
 * its deepest point keeps every bit of ink in the frame and none in the
 * cork. Two passes: the first, over the middle of each side, finds roughly
 * where the perpendicular sides are; the second runs each side's full
 * length between them.
 */
function measureSlices(art: TrimmedArt): BoardMeasure["slice"] {
	const { width, height } = art;
	const pass = (x0: number, x1: number, y0: number, y1: number) => {
		let left = 0;
		let right = 0;
		let top = 0;
		let bottom = 0;
		for (let y = y0; y < y1; y++) {
			left = Math.max(left, frameReach(art, (s) => isInk(art, s, y)) ?? 0);
			right = Math.max(
				right,
				frameReach(art, (s) => isInk(art, width - 1 - s, y)) ?? 0,
			);
		}
		for (let x = x0; x < x1; x++) {
			top = Math.max(top, frameReach(art, (s) => isInk(art, x, s)) ?? 0);
			bottom = Math.max(
				bottom,
				frameReach(art, (s) => isInk(art, x, height - 1 - s)) ?? 0,
			);
		}
		return { top, right, bottom, left };
	};
	const rough = pass(
		Math.round(width * 0.2),
		Math.round(width * 0.8),
		Math.round(height * 0.2),
		Math.round(height * 0.8),
	);
	// Clear of the corners, where a line along one side would run straight
	// down the neighbouring side's outline.
	const clear = 14;
	return pass(
		rough.left + clear,
		width - rough.right - clear,
		rough.top + clear,
		height - rough.bottom - clear,
	);
}

interface Rgba {
	data: Buffer;
	width: number;
	height: number;
}

type WebpOptions = Parameters<ReturnType<typeof sharp>["webp"]>[0];

function toWebp(image: Rgba, options: WebpOptions): Promise<Buffer> {
	return sharp(image.data, {
		raw: { width: image.width, height: image.height, channels: 4 },
	})
		.webp(options)
		.toBuffer();
}

/** The board with its cork cut out: only the frame's pixels remain. */
function cutFrame(art: TrimmedArt, slice: BoardMeasure["slice"]): Rgba {
	const data = Buffer.from(art.data);
	for (let y = slice.top; y < art.height - slice.bottom; y++) {
		data.fill(
			0,
			(y * art.width + slice.left) * 4,
			(y * art.width + art.width - slice.right) * 4,
		);
	}
	return { data, width: art.width, height: art.height };
}

/**
 * A patch from the middle of the cork — clear of the inner shadow — laid
 * out with its mirror images: P and P flipped left-right on top, the same
 * pair flipped upside down below. Every edge of the result, and every join
 * inside it, is a row or column of pixels beside its own reflection.
 */
function mirrorTile(art: TrimmedArt, slice: BoardMeasure["slice"]): Rgba {
	const corkWidth = art.width - slice.left - slice.right;
	const corkHeight = art.height - slice.top - slice.bottom;
	const patch = Math.min(
		TILE_PATCH,
		corkWidth - 2 * SHADOW_ZONE,
		corkHeight - 2 * SHADOW_ZONE,
	);
	// Where to cut. A mirror join hides a seam but not a speckle that sits on
	// it: the dark fleck meets its own reflection and becomes a doubled blob
	// on the axis, which is the one thing that gives the mirroring away. So
	// try every position the patch can take without touching the shadow, and
	// take the one whose four edges cross the fewest flecks.
	const fleck = (x: number, y: number) => luminance(art, x, y) < 128;
	const edge = 5;
	// Running counts of flecks, so an edge band costs four lookups.
	const sums = new Int32Array((art.width + 1) * (art.height + 1));
	for (let y = 0; y < art.height; y++) {
		let row = 0;
		for (let x = 0; x < art.width; x++) {
			row += fleck(x, y) ? 1 : 0;
			sums[(y + 1) * (art.width + 1) + x + 1] =
				sums[y * (art.width + 1) + x + 1] + row;
		}
	}
	const count = (left: number, top: number, w: number, h: number) =>
		sums[(top + h) * (art.width + 1) + left + w] -
		sums[top * (art.width + 1) + left + w] -
		sums[(top + h) * (art.width + 1) + left] +
		sums[top * (art.width + 1) + left];
	const minX = slice.left + SHADOW_ZONE;
	const maxX = art.width - slice.right - SHADOW_ZONE - patch;
	const minY = slice.top + SHADOW_ZONE;
	const maxY = art.height - slice.bottom - SHADOW_ZONE - patch;
	let x0 = slice.left + Math.floor((corkWidth - patch) / 2);
	let y0 = slice.top + Math.floor((corkHeight - patch) / 2);
	let fewest = Number.POSITIVE_INFINITY;
	for (let y = minY; y <= maxY; y++) {
		for (let x = minX; x <= maxX; x++) {
			const cost =
				count(x, y, patch, edge) +
				count(x, y + patch - edge, patch, edge) +
				count(x, y, edge, patch) +
				count(x + patch - edge, y, edge, patch);
			if (cost < fewest) {
				fewest = cost;
				x0 = x;
				y0 = y;
			}
		}
	}
	const size = patch * 2;
	const data = Buffer.alloc(size * size * 4);
	for (let y = 0; y < size; y++) {
		const sourceY = y0 + (y < patch ? y : size - 1 - y);
		for (let x = 0; x < size; x++) {
			const sourceX = x0 + (x < patch ? x : size - 1 - x);
			const from = (sourceY * art.width + sourceX) * 4;
			const to = (y * size + x) * 4;
			data[to] = art.data[from];
			data[to + 1] = art.data[from + 1];
			data[to + 2] = art.data[from + 2];
			// The art's cork is 99% opaque; the tile is the board's ground
			// and has nothing beneath it worth showing.
			data[to + 3] = 255;
		}
	}
	return { data, width: size, height: size };
}

/**
 * The art's inner shadow as an overlay for tiled cork.
 *
 * In the art the cork just inside the top and left of the frame is a flat,
 * darker band, with a rounded inside corner. Over the cork rectangle: take
 * luminance, median-filter it so the speckle drops out, and read "how
 * shadowed" as the distance from clean cork toward the band's colour. That,
 * times a fixed tint, composited over clean cork, gives back the band.
 *
 * Its slices are chosen so the corner block holds the whole rounded corner:
 * the top and left strips then contain only straight band and can stretch.
 */
async function shadowOverlay(
	art: TrimmedArt,
	slice: BoardMeasure["slice"],
): Promise<{ image: Rgba; slice: { top: number; left: number } }> {
	const width = art.width - slice.left - slice.right;
	const height = art.height - slice.top - slice.bottom;
	const at = (x: number, y: number, channel: number) =>
		art.data[((slice.top + y) * art.width + slice.left + x) * 4 + channel];

	// Reference colours: clean cork from the middle, the band from just
	// inside the top edge along its middle.
	const cork = [0, 1, 2].map((channel) => {
		const values: number[] = [];
		for (let y = Math.round(height * 0.3); y < height * 0.7; y += 5) {
			for (let x = Math.round(width * 0.3); x < width * 0.7; x += 5) {
				values.push(at(x, y, channel));
			}
		}
		return median(values);
	});
	const band = [0, 1, 2].map((channel) => {
		const values: number[] = [];
		for (let x = Math.round(width * 0.3); x < width * 0.7; x += 3) {
			for (let y = 2; y <= 5; y++) {
				values.push(at(x, y, channel));
			}
		}
		return median(values);
	});
	const lum = (rgb: number[]) =>
		0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
	const corkLum = lum(cork);
	const bandLum = lum(band);
	if (corkLum - bandLum < 10) {
		throw new Error("board.png has no measurable inner shadow");
	}
	// band = (1 - a) * cork + a * tint  =>  tint = (band - (1 - a) * cork) / a
	const tint = cork.map((value, channel) =>
		Math.max(
			0,
			Math.min(
				255,
				Math.round((band[channel] - (1 - SHADOW_ALPHA) * value) / SHADOW_ALPHA),
			),
		),
	);

	const grey = Buffer.alloc(width * height);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			grey[y * width + x] = Math.round(
				lum([at(x, y, 0), at(x, y, 1), at(x, y, 2)]),
			);
		}
	}
	// sharp hands a one-channel input back with three; read it by its own
	// channel count rather than assuming.
	const { data: smooth, info: smoothInfo } = await sharp(grey, {
		raw: { width, height, channels: 1 },
	})
		.median(9)
		.blur(0.8)
		.raw()
		.toBuffer({ resolveWithObject: true });

	const strength = new Float32Array(width * height);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (x >= SHADOW_ZONE && y >= SHADOW_ZONE) continue;
			const value =
				(corkLum - smooth[(y * width + x) * smoothInfo.channels]) /
				(corkLum - bandLum);
			strength[y * width + x] = Math.max(0, Math.min(1, value));
		}
	}

	// Keep only shadow that is attached to the frame: flood outward from the
	// top row and the left column. A dark fleck of cork that survived the
	// median filter is not shadow, and one of them deep in the search zone
	// would otherwise set the slice depth for the whole edge.
	const threshold = 0.2;
	const attached = new Uint8Array(width * height);
	const queue: number[] = [];
	const visit = (x: number, y: number) => {
		if (x < 0 || y < 0 || x >= width || y >= height) return;
		const index = y * width + x;
		if (attached[index] === 1 || strength[index] <= threshold) return;
		attached[index] = 1;
		queue.push(index);
	};
	for (let x = 0; x < width; x++) visit(x, 0);
	for (let y = 0; y < height; y++) visit(0, y);
	while (queue.length > 0) {
		const index = queue.pop() as number;
		const x = index % width;
		const y = (index - x) / width;
		visit(x + 1, y);
		visit(x - 1, y);
		visit(x, y + 1);
		visit(x, y - 1);
	}
	// The soft edge of the band is below the threshold, so let it through
	// where it borders attached shadow, and drop everything else.
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const index = y * width + x;
			if (attached[index] === 1 || strength[index] === 0) continue;
			let near = false;
			for (let dy = -3; dy <= 3 && !near; dy++) {
				for (let dx = -3; dx <= 3 && !near; dx++) {
					const nx = x + dx;
					const ny = y + dy;
					if (nx >= 0 && ny >= 0 && nx < width && ny < height) {
						near = attached[ny * width + nx] === 1;
					}
				}
			}
			if (!near) strength[index] = 0;
		}
	}

	// How deep the straight band runs along each side, away from the corner…
	const present = (x: number, y: number) => attached[y * width + x] === 1;
	let bandTop = 0;
	let bandLeft = 0;
	// (Stopping short of the far end of each band: the last few pixels there
	// are the soft edge of the neighbouring side's outline, which is dark all
	// the way down and is not shadow.)
	const farEnd = 8;
	for (let x = SHADOW_ZONE; x < width - farEnd; x++) {
		for (let y = 0; y < SHADOW_ZONE; y++) {
			if (present(x, y)) bandTop = Math.max(bandTop, y + 1);
		}
	}
	for (let y = SHADOW_ZONE; y < height - farEnd; y++) {
		for (let x = 0; x < SHADOW_ZONE; x++) {
			if (present(x, y)) bandLeft = Math.max(bandLeft, x + 1);
		}
	}
	// …and how far the rounded corner reaches past each band: everything
	// shadowed below the top band or right of the left band.
	let cornerRight = bandLeft;
	let cornerBottom = bandTop;
	for (let y = 0; y < SHADOW_ZONE; y++) {
		for (let x = 0; x < SHADOW_ZONE; x++) {
			if (!present(x, y)) continue;
			if (y >= bandTop) cornerRight = Math.max(cornerRight, x + 1);
			if (x >= bandLeft) cornerBottom = Math.max(cornerBottom, y + 1);
		}
	}
	const margin = 2;
	const shadowSlice = {
		top: cornerBottom + margin,
		left: cornerRight + margin,
	};
	if (shadowSlice.top >= SHADOW_ZONE || shadowSlice.left >= SHADOW_ZONE) {
		throw new Error(
			`the inner shadow reaches the edge of its ${SHADOW_ZONE}px search zone`,
		);
	}

	const data = Buffer.alloc(width * height * 4);
	for (let i = 0; i < width * height; i++) {
		data[i * 4] = tint[0];
		data[i * 4 + 1] = tint[1];
		data[i * 4 + 2] = tint[2];
		data[i * 4 + 3] = Math.round(strength[i] * SHADOW_ALPHA * 255);
	}
	return { image: { data, width, height }, slice: shadowSlice };
}

export interface BoardArt {
	measure: BoardMeasure;
	/** Encoded WebP files, keyed by what they are. */
	files: { frame: Buffer; cork: Buffer; shadow: Buffer };
}

/** Measure board.png and cut the three images the desktop board is built from. */
export async function buildBoardArt(
	name: string,
	quality: { frame: number; cork: number; alpha: number; effort: number },
): Promise<BoardArt> {
	const art = await loadTrimmed(name);
	const slice = measureSlices(art);
	for (const [side, value] of Object.entries(slice)) {
		if (value === 0) {
			throw new Error(`could not find the frame's inner outline on the ${side}`);
		}
	}
	const tile = mirrorTile(art, slice);
	const shadow = await shadowOverlay(art, slice);
	return {
		measure: {
			width: art.width,
			height: art.height,
			slice,
			tile: { width: tile.width, height: tile.height },
			shadow: {
				width: shadow.image.width,
				height: shadow.image.height,
				slice: shadow.slice,
			},
		},
		files: {
			frame: await toWebp(cutFrame(art, slice), {
				quality: quality.frame,
				alphaQuality: quality.alpha,
				effort: quality.effort,
			}),
			cork: await toWebp(tile, {
				quality: quality.cork,
				effort: quality.effort,
			}),
			// Lossless: it is a smooth alpha ramp, tiny either way, and lossy
			// alpha would band it.
			shadow: await toWebp(shadow.image, { lossless: true, effort: quality.effort }),
		},
	};
}

/** The generated config module, in the repo's Biome style. */
export function boardFrameModule(measure: BoardMeasure): string {
	return `/**
 * Generated by \`npm run optimize-images\` from assets/images-src/board.png.
 * Do not edit by hand: every number here is measured from the art.
 *
 * Lengths are pixels of the trimmed board art. \`slice\` is how far each side
 * of the wood frame reaches in from the edge — the 9-slice offsets, and so
 * also where the cork begins. \`shadow\` is the inner-shadow overlay (its
 * right and bottom slices are zero).
 */
export const BOARD_FRAME = {
	width: ${measure.width},
	height: ${measure.height},
	slice: {
		top: ${measure.slice.top},
		right: ${measure.slice.right},
		bottom: ${measure.slice.bottom},
		left: ${measure.slice.left},
	},
	tile: { width: ${measure.tile.width}, height: ${measure.tile.height} },
	shadow: {
		width: ${measure.shadow.width},
		height: ${measure.shadow.height},
		slice: { top: ${measure.shadow.slice.top}, left: ${measure.shadow.slice.left} },
	},
} as const;
`;
}
