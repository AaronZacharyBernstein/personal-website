/**
 * Build-time tool: measures the board's composition rules from the art
 * itself instead of judging them by eye. Never imported by the app.
 *
 *   npm run check-scene
 *
 * Every layer and tack is drawn into scene space exactly as the browser
 * places it (lib/render-layer: trimmed art, box, rotation about the pivot),
 * and the rules are then counted in pixels of real silhouette, not bounding
 * boxes:
 *
 *   - every item and tack sits inside the cork (SCENE_CORK), never on the frame
 *   - nothing overlaps the name card
 *   - no hotspot is more than MAX_COVERED hidden under other items
 *   - no tack is covered by anything
 *   - no tack's nearest neighbour shares its colour; all three variants used
 *   - the hotspots' reading order on the board matches the nav order
 *
 * Exits non-zero if any rule fails.
 */

import process from "node:process";
import {
	SCENE_BOARD_ID,
	SCENE_BOARD_PIXELS,
	SCENE_CORK,
	SCENE_HOTSPOTS,
	SCENE_LAYERS,
	SCENE_NAME_CARD_ID,
} from "../src/config/scene";
import { tackLayers } from "../src/config/scene-geometry";
import {
	type RenderLayer,
	renderLayer,
	renderLayers,
} from "./lib/render-layer";
import { baseName, loadTrimmed } from "./lib/source-art";

/** A hotspot may lose this much of its silhouette under other items. */
const MAX_COVERED = 0.15;
/** Alpha at or above this counts as solid, as in the polygon tracer. */
const SOLID_ALPHA = 32;
/** Hotspots whose centres are within this much of the scene's height read as one row. */
const ROW_BAND = 0.22;

const WIDTH = SCENE_BOARD_PIXELS.width;
const HEIGHT = SCENE_BOARD_PIXELS.height;

interface Drawn {
	layer: RenderLayer;
	mask: Uint8Array;
	pixels: number;
}

async function draw(layer: RenderLayer): Promise<Drawn> {
	const raster = await renderLayer(layer, WIDTH, HEIGHT);
	const mask = new Uint8Array(WIDTH * HEIGHT);
	let pixels = 0;
	for (let y = 0; y < raster.height; y++) {
		const sceneY = raster.top + y;
		if (sceneY < 0 || sceneY >= HEIGHT) continue;
		for (let x = 0; x < raster.width; x++) {
			const sceneX = raster.left + x;
			if (sceneX < 0 || sceneX >= WIDTH) continue;
			if (raster.data[(y * raster.width + x) * 4 + 3] >= SOLID_ALPHA) {
				mask[sceneY * WIDTH + sceneX] = 1;
				pixels++;
			}
		}
	}
	return { layer, mask, pixels };
}

function overlap(a: Uint8Array, b: Uint8Array): number {
	let count = 0;
	for (let i = 0; i < a.length; i++) {
		if (a[i] === 1 && b[i] === 1) count++;
	}
	return count;
}

const percent = (fraction: number) => `${(fraction * 100).toFixed(1)}%`;

const all = await Promise.all(renderLayers(SCENE_LAYERS).map(draw));
const drawn = all.filter((entry) => entry.layer.role !== "board");
const items = drawn.filter((entry) => entry.layer.role === "item");
const tacks = drawn.filter((entry) => entry.layer.role === "tack");

const failures: string[] = [];
const report: string[] = [];

// --- The cork itself: where does the frame's inner outline actually end? ---
{
	const board = await loadTrimmed(baseName(`${SCENE_BOARD_ID}.webp`));
	const dark = (x: number, y: number) => {
		const i = (y * board.width + x) * 4;
		const luminance =
			0.299 * board.data[i] +
			0.587 * board.data[i + 1] +
			0.114 * board.data[i + 2];
		return board.data[i + 3] > 128 && luminance < 70;
	};
	/**
	 * Walk inward from one edge along one line and return how far the inner
	 * outline reaches: the end of the first dark run that starts between 3%
	 * and 8% of the way in (the outer outline is nearer the edge than that,
	 * and the cork's speckle is further in).
	 */
	const innerEdge = (length: number, isDark: (step: number) => boolean) => {
		let step = Math.round(length * 0.03);
		const limit = Math.round(length * 0.08);
		while (step < limit && !isDark(step)) step++;
		if (step >= limit) return null;
		while (step < length * 0.15 && isDark(step)) step++;
		return step;
	};
	let left = 0;
	let right = 0;
	let top = 0;
	let bottom = 0;
	for (let y = Math.round(board.height * 0.2); y < board.height * 0.8; y++) {
		left = Math.max(left, innerEdge(board.width, (s) => dark(s, y)) ?? 0);
		right = Math.max(
			right,
			innerEdge(board.width, (s) => dark(board.width - 1 - s, y)) ?? 0,
		);
	}
	for (let x = Math.round(board.width * 0.2); x < board.width * 0.8; x++) {
		// The frame is thicker relative to the height, so scale the window.
		const scale = board.width / board.height;
		const edge = (isDark: (step: number) => boolean) => {
			let step = Math.round(board.height * 0.03 * scale);
			const limit = Math.round(board.height * 0.08 * scale);
			while (step < limit && !isDark(step)) step++;
			if (step >= limit) return 0;
			while (step < board.height * 0.15 * scale && isDark(step)) step++;
			return step;
		};
		top = Math.max(top, edge((s) => dark(x, s)));
		bottom = Math.max(bottom, edge((s) => dark(x, board.height - 1 - s)));
	}
	const measured = {
		x0: left / board.width,
		y0: top / board.height,
		x1: 1 - right / board.width,
		y1: 1 - bottom / board.height,
	};
	report.push(
		`cork measured from board art: x ${measured.x0.toFixed(4)}..${measured.x1.toFixed(4)}, y ${measured.y0.toFixed(4)}..${measured.y1.toFixed(4)}`,
		`cork configured (SCENE_CORK): x ${SCENE_CORK.x0}..${SCENE_CORK.x1}, y ${SCENE_CORK.y0}..${SCENE_CORK.y1}`,
	);
	if (
		SCENE_CORK.x0 < measured.x0 ||
		SCENE_CORK.y0 < measured.y0 ||
		SCENE_CORK.x1 > measured.x1 ||
		SCENE_CORK.y1 > measured.y1
	) {
		failures.push("SCENE_CORK reaches onto the frame's outline");
	}
}

// --- Inside the cork ---
{
	const x0 = Math.ceil(SCENE_CORK.x0 * WIDTH);
	const x1 = Math.floor(SCENE_CORK.x1 * WIDTH);
	const y0 = Math.ceil(SCENE_CORK.y0 * HEIGHT);
	const y1 = Math.floor(SCENE_CORK.y1 * HEIGHT);
	for (const { layer, mask } of drawn) {
		let outside = 0;
		let reach = 0;
		for (let y = 0; y < HEIGHT; y++) {
			for (let x = 0; x < WIDTH; x++) {
				if (mask[y * WIDTH + x] !== 1) continue;
				const over = Math.max(x0 - x, x - x1, y0 - y, y - y1, 0);
				if (over > 0) {
					outside++;
					reach = Math.max(reach, over);
				}
			}
		}
		if (outside > 0) {
			failures.push(
				`${layer.id} leaves the cork: ${outside}px outside, up to ${reach}px past the edge`,
			);
		}
	}
	report.push("inside cork: checked every item and tack");
}

// --- Nothing overlaps the name card ---
{
	const card = items.find((entry) => entry.layer.id === SCENE_NAME_CARD_ID);
	if (!card) {
		failures.push(`no "${SCENE_NAME_CARD_ID}" layer`);
	} else {
		for (const other of drawn) {
			if (
				other === card ||
				(other.layer.role === "tack" && other.layer.ownerId === card.layer.id)
			) {
				continue;
			}
			const shared = overlap(card.mask, other.mask);
			if (shared > 0) {
				failures.push(`${other.layer.id} overlaps the name card by ${shared}px`);
			}
		}
		report.push("name card: checked against every other layer");
	}
}

// --- Hotspot coverage ---
for (const hotspot of SCENE_HOTSPOTS) {
	const self = items.find((entry) => entry.layer.id === hotspot.id);
	if (!self) continue;
	const covered = new Uint8Array(WIDTH * HEIGHT);
	const by: string[] = [];
	for (const other of items) {
		if (other === self || other.layer.zIndex <= self.layer.zIndex) continue;
		const shared = overlap(self.mask, other.mask);
		if (shared === 0) continue;
		by.push(`${other.layer.id} ${percent(shared / self.pixels)}`);
		for (let i = 0; i < covered.length; i++) {
			if (other.mask[i] === 1) covered[i] = 1;
		}
	}
	const fraction = overlap(self.mask, covered) / self.pixels;
	report.push(
		`covered ${hotspot.id.padEnd(10)} ${percent(fraction).padStart(6)}${by.length ? `  (${by.join(", ")})` : ""}`,
	);
	if (fraction > MAX_COVERED) {
		failures.push(
			`${hotspot.id} is ${percent(fraction)} covered (limit ${percent(MAX_COVERED)})`,
		);
	}
}

// --- Tacks: uncovered, colours apart, variants spread ---
for (const tack of tacks) {
	for (const other of drawn) {
		if (other === tack || other.layer.zIndex <= tack.layer.zIndex) continue;
		const shared = overlap(tack.mask, other.mask);
		if (shared > 0) {
			failures.push(`${tack.layer.id} is covered by ${other.layer.id} (${shared}px)`);
		}
	}
}
{
	const specs = tackLayers(SCENE_LAYERS).map((tack) => ({
		...tack,
		centerX: (tack.box.x + tack.box.width / 2) * WIDTH,
		centerY: (tack.box.y + tack.box.height / 2) * HEIGHT,
	}));
	for (const tack of specs) {
		let nearest: (typeof specs)[number] | null = null;
		let distance = Number.POSITIVE_INFINITY;
		for (const other of specs) {
			if (other === tack) continue;
			const d = Math.hypot(
				other.centerX - tack.centerX,
				other.centerY - tack.centerY,
			);
			if (d < distance) {
				distance = d;
				nearest = other;
			}
		}
		report.push(
			`tack ${tack.ownerId.padEnd(10)} ${tack.color}-${tack.variant}  nearest: ${nearest?.ownerId} (${nearest?.color}-${nearest?.variant}, ${Math.round(distance)}px)`,
		);
		if (nearest && nearest.color === tack.color) {
			failures.push(
				`${tack.ownerId} and its nearest tack ${nearest.ownerId} are both ${tack.color}`,
			);
		}
	}
	const variants = new Map<number, number>();
	for (const tack of specs) {
		variants.set(tack.variant, (variants.get(tack.variant) ?? 0) + 1);
	}
	report.push(
		`tack variants: ${[1, 2, 3].map((v) => `${v}x${variants.get(v) ?? 0}`).join(" ")}`,
	);
	for (const variant of [1, 2, 3]) {
		if (!variants.has(variant)) {
			failures.push(`tack variant ${variant} is unused`);
		}
	}
}

// --- Reading order vs nav order ---
{
	const centres = SCENE_HOTSPOTS.map((hotspot) => {
		const self = items.find((entry) => entry.layer.id === hotspot.id);
		let sumX = 0;
		let sumY = 0;
		if (self) {
			for (let y = 0; y < HEIGHT; y++) {
				for (let x = 0; x < WIDTH; x++) {
					if (self.mask[y * WIDTH + x] === 1) {
						sumX += x;
						sumY += y;
					}
				}
			}
		}
		const pixels = self?.pixels || 1;
		return {
			id: hotspot.id,
			x: sumX / pixels / WIDTH,
			y: sumY / pixels / HEIGHT,
		};
	});
	// Rows: sort by y, start a new row whenever the next centre is more than
	// ROW_BAND below the row's first; then left to right within a row.
	const byY = [...centres].sort((a, b) => a.y - b.y);
	const rows: (typeof centres)[] = [];
	for (const centre of byY) {
		const row = rows[rows.length - 1];
		if (row && centre.y - row[0].y <= ROW_BAND) {
			row.push(centre);
		} else {
			rows.push([centre]);
		}
	}
	const reading = rows.flatMap((row) =>
		[...row].sort((a, b) => a.x - b.x).map((centre) => centre.id),
	);
	const nav = SCENE_HOTSPOTS.map((hotspot) => hotspot.id);
	report.push(`reading order: ${reading.join(", ")}`);
	report.push(`nav order:     ${nav.join(", ")}`);
	if (reading.join() !== nav.join()) {
		failures.push("the board's reading order does not match the nav order");
	}
}

for (const line of report) {
	console.log(line);
}
console.log("");
if (failures.length === 0) {
	console.log("PASS: every composition rule holds");
} else {
	for (const failure of failures) {
		console.log(`FAIL ${failure}`);
	}
	process.exit(1);
}
