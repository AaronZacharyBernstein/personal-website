/**
 * Build-time tool: derives hit polygons from hotspot art. Never imported by
 * the app.
 *
 *   npm run trace-polygons               # print the polygons
 *   npm run trace-polygons -- --write    # write them into src/config/scene.ts
 *   npm run trace-polygons -- --analyze  # trimmed sizes, aspects, row profiles
 *
 * Pipeline per hotspot: trimmed source pixels (lib/source-art — the same
 * pixels the optimizer encodes, so the two agree on the geometry) ->
 * threshold alpha at 32 -> largest connected component -> Moore-neighbor
 * boundary trace -> Ramer-Douglas-Peucker to 8..24 vertices -> each vertex
 * as a fraction of the trimmed image.
 *
 * Polygons are a function of the art alone. They live in the item's own box
 * space, so moving, resizing or rotating a layer needs no re-trace; run this
 * again only when a hotspot's art changes.
 */

import process from "node:process";
import { SCENE_ASPECT_RATIO, SCENE_LAYERS } from "../src/config/scene";
import {
	readSceneSource,
	setPolygon,
	writeSceneSource,
} from "./lib/scene-source";
import { baseName, loadTrimmed } from "./lib/source-art";

const ALPHA_THRESHOLD = 32;
const MIN_VERTICES = 8;
const MAX_VERTICES = 24;

interface DecodedAlpha {
	width: number;
	height: number;
	alpha: Uint8Array;
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
const write = process.argv.includes("--write");
let source = write ? readSceneSource() : "";

for (const layer of SCENE_LAYERS) {
	let decoded: DecodedAlpha;
	try {
		const art = await loadTrimmed(baseName(layer.image));
		const alpha = new Uint8Array(art.width * art.height);
		for (let i = 0; i < alpha.length; i++) {
			alpha[i] = art.data[i * 4 + 3];
		}
		decoded = { width: art.width, height: art.height, alpha };
	} catch (error) {
		console.log(`${layer.id}: SKIP (${(error as Error).message})`);
		continue;
	}
	const mask = buildMask(decoded);
	const { component, pixels } = largestComponent(mask, decoded.width, decoded.height);
	const box = alphaBoundingBox(component, decoded.width, decoded.height);

	if (analyze) {
		const imageAspect = decoded.width / decoded.height;
		const lockedHeight = round4(
			(layer.box.width * SCENE_ASPECT_RATIO) / imageAspect,
		);
		console.log(
			`${layer.id}: trimmed ${decoded.width}x${decoded.height} aspect=${round4(imageAspect)} ` +
				`box.width=${layer.box.width} -> locked height ${lockedHeight} (is ${layer.box.height}) pixels=${pixels}`,
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

	const contour = traceBoundary(component, decoded.width, decoded.height);
	const { polygon, epsilon } = simplifyToBudget(contour);
	const polygonArea = shoelaceArea(polygon);
	console.log(
		`// ${layer.id}: contour=${contour.length}pts -> ${polygon.length} vertices (eps=${round4(epsilon)}px), ` +
			`polygonArea/maskArea=${round4(polygonArea / pixels)}`,
	);
	// Pixel centres as fractions of the trimmed image: the item's box space.
	const points = polygon.map(
		([px, py]) =>
			[
				round4((px + 0.5) / decoded.width),
				round4((py + 0.5) / decoded.height),
			] as const,
	);
	if (write) {
		source = setPolygon(source, layer.id, points);
	} else {
		const lines = points.map(([x, y]) => `\t\t\t[${x}, ${y}],`);
		console.log(`\t\tpolygon: [\n${lines.join("\n")}\n\t\t],`);
	}
}

if (write) {
	writeSceneSource(source);
	console.log("// polygons written to src/config/scene.ts");
}
