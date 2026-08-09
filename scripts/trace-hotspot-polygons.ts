/**
 * Build-time tool: derives hit polygons from hotspot PNG alpha channels.
 * Never imported by the app.
 *
 *   npx tsx scripts/trace-hotspot-polygons.ts            # print polygons to paste into scene.ts
 *   npx tsx scripts/trace-hotspot-polygons.ts --analyze  # dims, alpha bboxes, row profiles
 *
 * Pipeline per hotspot: decode PNG (8-bit non-interlaced RGBA only, via
 * node:zlib) -> threshold alpha at 32 -> largest connected component ->
 * Moore-neighbor boundary trace -> Ramer-Douglas-Peucker to 8..16 vertices
 * -> map pixel coords into scene-normalized 0..1 via the layer's box.
 * Polygons are a function of the box: re-run whenever a box changes.
 */

import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import process from "node:process";
import { SCENE_LAYERS } from "../src/config/scene";

const ALPHA_THRESHOLD = 32;
const MIN_VERTICES = 8;
const MAX_VERTICES = 16;

/**
 * The full-resolution PNG sources, not the generated WebP the app loads:
 * this decoder handles 8-bit non-interlaced RGBA only, and tracing the
 * downscaled art would quantize every vertex to the smaller pixel grid.
 */
const imagesDir = fileURLToPath(new URL("../assets/images-src/", import.meta.url));

interface DecodedAlpha {
	width: number;
	height: number;
	alpha: Uint8Array;
}

function decodePngAlpha(buffer: Buffer): DecodedAlpha {
	const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
	for (let i = 0; i < signature.length; i++) {
		if (buffer[i] !== signature[i]) {
			throw new Error("not a PNG");
		}
	}
	let offset = 8;
	let width = 0;
	let height = 0;
	let bitDepth = 0;
	let colorType = 0;
	let interlace = 0;
	const idatParts: Buffer[] = [];
	while (offset < buffer.length) {
		const length = buffer.readUInt32BE(offset);
		const type = buffer.toString("ascii", offset + 4, offset + 8);
		const dataStart = offset + 8;
		if (type === "IHDR") {
			width = buffer.readUInt32BE(dataStart);
			height = buffer.readUInt32BE(dataStart + 4);
			bitDepth = buffer[dataStart + 8];
			colorType = buffer[dataStart + 9];
			interlace = buffer[dataStart + 12];
		} else if (type === "IDAT") {
			idatParts.push(buffer.subarray(dataStart, dataStart + length));
		} else if (type === "IEND") {
			break;
		}
		offset = dataStart + length + 4; // + CRC
	}
	if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
		throw new Error(
			`unsupported PNG (bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace}); only 8-bit non-interlaced RGBA is handled`,
		);
	}
	const raw = inflateSync(Buffer.concat(idatParts));
	const bytesPerPixel = 4;
	const stride = width * bytesPerPixel;
	const alpha = new Uint8Array(width * height);
	const prior = new Uint8Array(stride);
	const current = new Uint8Array(stride);
	let pos = 0;
	for (let y = 0; y < height; y++) {
		const filter = raw[pos];
		pos += 1;
		for (let x = 0; x < stride; x++) {
			const rawByte = raw[pos + x];
			const left = x >= bytesPerPixel ? current[x - bytesPerPixel] : 0;
			const up = prior[x];
			const upLeft = x >= bytesPerPixel ? prior[x - bytesPerPixel] : 0;
			let value: number;
			switch (filter) {
				case 0:
					value = rawByte;
					break;
				case 1:
					value = rawByte + left;
					break;
				case 2:
					value = rawByte + up;
					break;
				case 3:
					value = rawByte + ((left + up) >> 1);
					break;
				case 4: {
					const p = left + up - upLeft;
					const pa = Math.abs(p - left);
					const pb = Math.abs(p - up);
					const pc = Math.abs(p - upLeft);
					value =
						rawByte + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft);
					break;
				}
				default:
					throw new Error(`bad filter ${filter} in row ${y}`);
			}
			current[x] = value & 0xff;
		}
		pos += stride;
		for (let x = 0; x < width; x++) {
			alpha[y * width + x] = current[x * bytesPerPixel + 3];
		}
		prior.set(current);
	}
	return { width, height, alpha };
}

function buildMask(decoded: DecodedAlpha): Uint8Array {
	const mask = new Uint8Array(decoded.alpha.length);
	for (let i = 0; i < decoded.alpha.length; i++) {
		mask[i] = decoded.alpha[i] >= ALPHA_THRESHOLD ? 1 : 0;
	}
	return mask;
}

/** Keep only the largest 8-connected component; returns its pixel count. */
function largestComponent(
	mask: Uint8Array,
	width: number,
	height: number,
): { component: Uint8Array; pixels: number } {
	const labels = new Int32Array(mask.length).fill(-1);
	const sizes: number[] = [];
	const queue = new Int32Array(mask.length);
	for (let start = 0; start < mask.length; start++) {
		if (mask[start] === 0 || labels[start] !== -1) {
			continue;
		}
		const label = sizes.length;
		let head = 0;
		let tail = 0;
		queue[tail++] = start;
		labels[start] = label;
		let size = 0;
		while (head < tail) {
			const index = queue[head++];
			size++;
			const x = index % width;
			const y = (index - x) / width;
			for (let dy = -1; dy <= 1; dy++) {
				for (let dx = -1; dx <= 1; dx++) {
					if (dx === 0 && dy === 0) {
						continue;
					}
					const nx = x + dx;
					const ny = y + dy;
					if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
						continue;
					}
					const ni = ny * width + nx;
					if (mask[ni] === 1 && labels[ni] === -1) {
						labels[ni] = label;
						queue[tail++] = ni;
					}
				}
			}
		}
		sizes.push(size);
	}
	if (sizes.length === 0) {
		throw new Error("empty mask");
	}
	let best = 0;
	for (let i = 1; i < sizes.length; i++) {
		if (sizes[i] > sizes[best]) {
			best = i;
		}
	}
	const component = new Uint8Array(mask.length);
	for (let i = 0; i < mask.length; i++) {
		component[i] = labels[i] === best ? 1 : 0;
	}
	return { component, pixels: sizes[best] };
}

/** Moore-neighbor boundary trace with Jacob's stopping criterion. */
function traceBoundary(
	mask: Uint8Array,
	width: number,
	height: number,
): Array<[number, number]> {
	const solid = (x: number, y: number) =>
		x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x] === 1;
	// Clockwise Moore neighborhood starting west.
	const neighbors: Array<[number, number]> = [
		[-1, 0],
		[-1, -1],
		[0, -1],
		[1, -1],
		[1, 0],
		[1, 1],
		[0, 1],
		[-1, 1],
	];
	// Topmost-leftmost solid pixel; its west neighbor is background.
	let startX = -1;
	let startY = -1;
	outer: for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (mask[y * width + x] === 1) {
				startX = x;
				startY = y;
				break outer;
			}
		}
	}
	if (startX === -1) {
		throw new Error("empty component");
	}
	const contour: Array<[number, number]> = [[startX, startY]];
	let currentX = startX;
	let currentY = startY;
	// Index of the neighbor we backtracked from (start: west).
	let backtrack = 0;
	let firstMove = -1;
	const maxSteps = width * height * 4;
	for (let step = 0; step < maxSteps; step++) {
		let found = -1;
		for (let i = 1; i <= 8; i++) {
			const candidate = (backtrack + i) % 8;
			const [dx, dy] = neighbors[candidate];
			if (solid(currentX + dx, currentY + dy)) {
				found = candidate;
				break;
			}
		}
		if (found === -1) {
			return contour; // isolated pixel
		}
		if (
			currentX === startX &&
			currentY === startY &&
			firstMove !== -1 &&
			found === firstMove
		) {
			return contour; // Jacob's criterion: same entry repeated at start
		}
		if (firstMove === -1) {
			firstMove = found;
		}
		const [dx, dy] = neighbors[found];
		currentX += dx;
		currentY += dy;
		contour.push([currentX, currentY]);
		// New backtrack: the neighbor index pointing at the previous pixel.
		backtrack = (found + 4) % 8;
		// Resume scanning clockwise from just after the backtrack direction:
		// step back one so the next loop starts at backtrack+1.
	}
	throw new Error("boundary trace did not terminate");
}

function perpendicularDistance(
	point: [number, number],
	lineStart: [number, number],
	lineEnd: [number, number],
): number {
	const dx = lineEnd[0] - lineStart[0];
	const dy = lineEnd[1] - lineStart[1];
	const lengthSquared = dx * dx + dy * dy;
	if (lengthSquared === 0) {
		return Math.hypot(point[0] - lineStart[0], point[1] - lineStart[1]);
	}
	const cross =
		dx * (lineStart[1] - point[1]) - dy * (lineStart[0] - point[0]);
	return Math.abs(cross) / Math.sqrt(lengthSquared);
}

function rdp(
	points: Array<[number, number]>,
	epsilon: number,
): Array<[number, number]> {
	if (points.length <= 2) {
		return points.slice();
	}
	let maxDistance = 0;
	let maxIndex = 0;
	const first = points[0];
	const last = points[points.length - 1];
	for (let i = 1; i < points.length - 1; i++) {
		const distance = perpendicularDistance(points[i], first, last);
		if (distance > maxDistance) {
			maxDistance = distance;
			maxIndex = i;
		}
	}
	if (maxDistance <= epsilon) {
		return [first, last];
	}
	const left = rdp(points.slice(0, maxIndex + 1), epsilon);
	const right = rdp(points.slice(maxIndex), epsilon);
	return left.slice(0, -1).concat(right);
}

/** RDP for a closed contour: split at the point farthest from point 0. */
function simplifyClosed(
	contour: Array<[number, number]>,
	epsilon: number,
): Array<[number, number]> {
	if (contour.length <= 4) {
		return contour.slice();
	}
	let farIndex = 1;
	let farDistance = 0;
	for (let i = 1; i < contour.length; i++) {
		const d = Math.hypot(
			contour[i][0] - contour[0][0],
			contour[i][1] - contour[0][1],
		);
		if (d > farDistance) {
			farDistance = d;
			farIndex = i;
		}
	}
	const half1 = rdp(contour.slice(0, farIndex + 1), epsilon);
	const half2 = rdp(contour.slice(farIndex).concat([contour[0]]), epsilon);
	return half1.slice(0, -1).concat(half2.slice(0, -1));
}

/**
 * Find an epsilon whose simplified vertex count lands in [MIN, MAX].
 * Epsilon grows geometrically; counts shrink as it grows, so the first
 * epsilon that fits under the cap is the densest acceptable polygon.
 */
function simplifyToBudget(contour: Array<[number, number]>): {
	polygon: Array<[number, number]>;
	epsilon: number;
} {
	let below: { polygon: Array<[number, number]>; epsilon: number } | null =
		null;
	for (let epsilon = 0.5; epsilon <= 400; epsilon *= 1.03) {
		const polygon = simplifyClosed(contour, epsilon);
		if (polygon.length > MAX_VERTICES) {
			continue;
		}
		if (polygon.length >= MIN_VERTICES) {
			return { polygon, epsilon };
		}
		if (!below) {
			below = { polygon, epsilon };
		}
	}
	if (below) {
		console.log(
			`// WARNING: vertex count ${below.polygon.length} fell below the target minimum ${MIN_VERTICES}`,
		);
		return below;
	}
	throw new Error("could not simplify contour into vertex budget");
}

function shoelaceArea(points: Array<[number, number]>): number {
	let sum = 0;
	for (let i = 0; i < points.length; i++) {
		const [x1, y1] = points[i];
		const [x2, y2] = points[(i + 1) % points.length];
		sum += x1 * y2 - x2 * y1;
	}
	return Math.abs(sum) / 2;
}

function round4(value: number): number {
	return Number(value.toFixed(4));
}

interface AlphaBox {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
}

function alphaBoundingBox(mask: Uint8Array, width: number, height: number): AlphaBox {
	let x0 = width;
	let y0 = height;
	let x1 = -1;
	let y1 = -1;
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (mask[y * width + x] === 1) {
				if (x < x0) x0 = x;
				if (x > x1) x1 = x;
				if (y < y0) y0 = y;
				if (y > y1) y1 = y;
			}
		}
	}
	return { x0, y0, x1, y1 };
}

const analyze = process.argv.includes("--analyze");

for (const layer of SCENE_LAYERS) {
	const fileName = (layer.image.split("/").pop() ?? "").replace(
		/\.[^.]+$/,
		".png",
	);
	let decoded: DecodedAlpha;
	try {
		decoded = decodePngAlpha(readFileSync(imagesDir + fileName));
	} catch (error) {
		console.log(`${layer.id}: SKIP (${(error as Error).message})`);
		continue;
	}
	const mask = buildMask(decoded);
	const { component, pixels } = largestComponent(mask, decoded.width, decoded.height);
	const box = alphaBoundingBox(component, decoded.width, decoded.height);

	if (analyze) {
		const fx0 = round4(box.x0 / decoded.width);
		const fy0 = round4(box.y0 / decoded.height);
		const fx1 = round4((box.x1 + 1) / decoded.width);
		const fy1 = round4((box.y1 + 1) / decoded.height);
		const contentAspect = (box.x1 + 1 - box.x0) / (box.y1 + 1 - box.y0);
		console.log(
			`${layer.id}: ${decoded.width}x${decoded.height} imageAspect=${round4(decoded.width / decoded.height)} ` +
				`alphaBBoxFrac=[x ${fx0}..${fx1}, y ${fy0}..${fy1}] contentAspect=${round4(contentAspect)} pixels=${pixels}`,
		);
		// Row coverage profile inside the alpha bbox (fraction of bbox width).
		const rows = 24;
		const parts: string[] = [];
		for (let r = 0; r < rows; r++) {
			const y = Math.min(
				box.y1,
				box.y0 + Math.round(((box.y1 - box.y0) * r) / (rows - 1)),
			);
			let count = 0;
			for (let x = box.x0; x <= box.x1; x++) {
				if (component[y * decoded.width + x] === 1) count++;
			}
			parts.push(
				`y=${round4(y / decoded.height)}:${Math.round((100 * count) / (box.x1 - box.x0 + 1))}%`,
			);
		}
		console.log(`  rows: ${parts.join(" ")}`);
		continue;
	}

	if (layer.kind !== "hotspot") {
		continue;
	}

	// The polygon mapping assumes the image fills its box (object-contain
	// with a matching aspect). Warn loudly when that assumption is broken.
	const boxDisplayAspect = (2 * layer.box.width) / layer.box.height;
	const imageAspect = decoded.width / decoded.height;
	const aspectError = Math.abs(boxDisplayAspect / imageAspect - 1);
	if (aspectError > 0.01) {
		console.log(
			`// WARNING ${layer.id}: box display aspect ${round4(boxDisplayAspect)} != image aspect ${round4(imageAspect)} (${round4(aspectError * 100)}% off) — polygon will be misaligned`,
		);
	}

	const contour = traceBoundary(component, decoded.width, decoded.height);
	const { polygon, epsilon } = simplifyToBudget(contour);
	const polygonArea = shoelaceArea(polygon);
	console.log(
		`// ${layer.id}: contour=${contour.length}pts -> ${polygon.length} vertices (eps=${round4(epsilon)}px), ` +
			`polygonArea/maskArea=${round4(polygonArea / pixels)}`,
	);
	const lines = polygon.map(([px, py]) => {
		const nx = round4(layer.box.x + ((px + 0.5) / decoded.width) * layer.box.width);
		const ny = round4(layer.box.y + ((py + 0.5) / decoded.height) * layer.box.height);
		return `\t\t\t[${nx}, ${ny}],`;
	});
	console.log(`\t\tpolygon: [\n${lines.join("\n")}\n\t\t],`);
}
