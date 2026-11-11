/**
 * Build-time tool: measures the board's composition rules from the art
 * itself instead of judging them by eye. Never imported by the app.
 *
 *   npm run check-scene
 *
 * Every layer and tack is drawn into the composition's scene box exactly as
 * the browser places it (lib/render-layer: trimmed art, box, rotation about
 * the pivot), and the rules are counted in pixels of real silhouette, not
 * bounding boxes.
 *
 * The composition's own rules do not depend on the window:
 *
 *   - nothing overlaps the name card
 *   - no hotspot is more than MAX_COVERED hidden under other items
 *   - no tack is covered by anything
 *   - no tack's nearest neighbour shares its colour; all three variants used
 *   - the hotspots' reading order on the board matches the nav order
 *
 * The rest do, because on desktop the board is the viewport: the frame's
 * thickness follows the window's height (or its width, on a window
 * narrower than 16:10), the composition is fitted and
 * centred on whatever cork that leaves, and the team pins are carried to
 * the cork's corner. So for each viewport in VIEWPORTS (and, more coarsely,
 * across a sweep of every plausible window size), using the same layout
 * arithmetic as the stylesheet (src/config/board.ts):
 *
 *   - every item and tack sits on the cork, clear of the frame
 *   - so does every team pin, where it has been carried to
 *   - no team pin touches the composition
 *
 * Exits non-zero if any rule fails.
 */

import process from "node:process";
import { BOARD_FRAME } from "../src/config/board-frame.gen";
import { boardLayout, STAGE_CORK } from "../src/config/board";
import {
	SCENE_BOARD_PIXELS,
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

/** A hotspot may lose this much of its silhouette under other items. */
const MAX_COVERED = 0.15;
/** Alpha at or above this counts as solid, as in the polygon tracer. */
const SOLID_ALPHA = 32;
/** Hotspots whose centres are within this much of the scene's height read as one row. */
const ROW_BAND = 0.22;
/** Everything keeps at least this far from the frame, in pixels of board art. */
const FRAME_CLEARANCE = 3;
/** Below md the board is one flat image; these rules are for md and up. */
const MIN_WIDTH = 768;

/** The windows the board is checked at by name. */
const VIEWPORTS: ReadonlyArray<readonly [number, number, string]> = [
	[1366, 768, "laptop"],
	[1440, 900, "reference"],
	[1920, 1080, "full HD"],
	[2560, 1440, "QHD"],
	[3440, 1440, "ultrawide"],
	[820, 1180, "portrait tablet"],
	[768, 1024, "narrowest desktop layout"],
	[1024, 600, "short"],
];

// The composition is drawn at the art's own resolution: one grid pixel is
// one pixel of board art.
const WIDTH = SCENE_BOARD_PIXELS.width;
const HEIGHT = SCENE_BOARD_PIXELS.height;

interface Drawn {
	layer: RenderLayer;
	mask: Uint8Array;
	pixels: number;
	/** Extent of the silhouette, in grid pixels (x1 and y1 inclusive). */
	x0: number;
	y0: number;
	x1: number;
	y1: number;
}

async function draw(layer: RenderLayer): Promise<Drawn> {
	const raster = await renderLayer(layer, WIDTH, HEIGHT);
	const mask = new Uint8Array(WIDTH * HEIGHT);
	const drawn: Drawn = {
		layer,
		mask,
		pixels: 0,
		x0: WIDTH,
		y0: HEIGHT,
		x1: -1,
		y1: -1,
	};
	for (let y = 0; y < raster.height; y++) {
		const sceneY = raster.top + y;
		if (sceneY < 0 || sceneY >= HEIGHT) continue;
		for (let x = 0; x < raster.width; x++) {
			const sceneX = raster.left + x;
			if (sceneX < 0 || sceneX >= WIDTH) continue;
			if (raster.data[(y * raster.width + x) * 4 + 3] >= SOLID_ALPHA) {
				mask[sceneY * WIDTH + sceneX] = 1;
				drawn.pixels++;
				if (sceneX < drawn.x0) drawn.x0 = sceneX;
				if (sceneX > drawn.x1) drawn.x1 = sceneX;
				if (sceneY < drawn.y0) drawn.y0 = sceneY;
				if (sceneY > drawn.y1) drawn.y1 = sceneY;
			}
		}
	}
	return drawn;
}

function overlap(a: Uint8Array, b: Uint8Array): number {
	let count = 0;
	for (let i = 0; i < a.length; i++) {
		if (a[i] === 1 && b[i] === 1) count++;
	}
	return count;
}

const percent = (fraction: number) => `${(fraction * 100).toFixed(1)}%`;

if (
	BOARD_FRAME.width !== WIDTH ||
	BOARD_FRAME.height !== HEIGHT
) {
	console.log(
		`FAIL board-frame.gen.ts is for a ${BOARD_FRAME.width}x${BOARD_FRAME.height} board but SCENE_BOARD_PIXELS is ${WIDTH}x${HEIGHT}; run npm run optimize-images`,
	);
	process.exit(1);
}

const all = await Promise.all(renderLayers(SCENE_LAYERS).map(draw));
const drawn = all.filter((entry) => entry.layer.role !== "board");
/** Layers the desktop board carries to a corner of the cork: the team pins. */
const pins = drawn.filter((entry) => entry.layer.anchor !== undefined);
/** Everything else: the composition, tacks included. */
const composition = drawn.filter((entry) => entry.layer.anchor === undefined);
const items = composition.filter((entry) => entry.layer.role === "item");
const tacks = composition.filter((entry) => entry.layer.role === "tack");

const compositionMask = new Uint8Array(WIDTH * HEIGHT);
for (const { mask } of composition) {
	for (let i = 0; i < mask.length; i++) {
		if (mask[i] === 1) compositionMask[i] = 1;
	}
}
const extent = (entries: Drawn[]) => ({
	x0: Math.min(...entries.map((entry) => entry.x0)),
	y0: Math.min(...entries.map((entry) => entry.y0)),
	x1: Math.max(...entries.map((entry) => entry.x1)),
	y1: Math.max(...entries.map((entry) => entry.y1)),
});
const compositionExtent = extent(composition);
const pinExtent = extent(pins);

const failures: string[] = [];
const report: string[] = [];

// ---------------------------------------------------------------------------
// The composition's own rules.
// ---------------------------------------------------------------------------

// --- Nothing in the composition overlaps the name card ---
{
	const card = items.find((entry) => entry.layer.id === SCENE_NAME_CARD_ID);
	if (!card) {
		failures.push(`no "${SCENE_NAME_CARD_ID}" layer`);
	} else {
		for (const other of composition) {
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
	for (const other of composition) {
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

// ---------------------------------------------------------------------------
// The board at a given window.
// ---------------------------------------------------------------------------

interface ViewportResult {
	problems: string[];
	line: string;
}

/**
 * Everything is measured in the composition's grid: the real cork and the
 * pins' journey are converted into grid pixels, so the silhouettes drawn
 * once above serve every viewport.
 */
function checkViewport(width: number, height: number): ViewportResult {
	const layout = boardLayout(width, height);
	const problems: string[] = [];
	/** CSS pixels per grid pixel. */
	const scale = layout.stage.width / WIDTH;
	// The real cork, in grid pixels, pulled in by the clearance.
	const cork = {
		x0: (layout.cork.x - layout.stage.x) / scale + FRAME_CLEARANCE,
		y0: (layout.cork.y - layout.stage.y) / scale + FRAME_CLEARANCE,
		x1:
			(layout.cork.x + layout.cork.width - layout.stage.x) / scale -
			FRAME_CLEARANCE,
		y1:
			(layout.cork.y + layout.cork.height - layout.stage.y) / scale -
			FRAME_CLEARANCE,
	};
	// Whole grid pixels, as the stylesheet's transform is not rounded but
	// a silhouette test has to be: round toward the composition, the
	// conservative direction for the collision check.
	const shiftX = Math.floor(layout.anchorShift.x / scale);
	const shiftY = -Math.floor(-layout.anchorShift.y / scale);

	if (layout.cork.width <= 0 || layout.cork.height <= 0) {
		problems.push("the frame leaves no cork");
	}
	if (
		compositionExtent.x0 < cork.x0 ||
		compositionExtent.y0 < cork.y0 ||
		compositionExtent.x1 + 1 > cork.x1 ||
		compositionExtent.y1 + 1 > cork.y1
	) {
		const culprit = composition.find(
			(entry) =>
				entry.x0 < cork.x0 ||
				entry.y0 < cork.y0 ||
				entry.x1 + 1 > cork.x1 ||
				entry.y1 + 1 > cork.y1,
		);
		problems.push(`${culprit?.layer.id ?? "the composition"} overlaps the frame`);
	}
	if (
		pinExtent.x0 + shiftX < cork.x0 ||
		pinExtent.y0 + shiftY < cork.y0 ||
		pinExtent.x1 + 1 + shiftX > cork.x1 ||
		pinExtent.y1 + 1 + shiftY > cork.y1
	) {
		problems.push("a team pin overlaps the frame");
	}
	let touching = 0;
	for (const pin of pins) {
		for (let y = pin.y0; y <= pin.y1; y++) {
			const targetY = y + shiftY;
			if (targetY < 0 || targetY >= HEIGHT) continue;
			for (let x = pin.x0; x <= pin.x1; x++) {
				if (pin.mask[y * WIDTH + x] !== 1) continue;
				const targetX = x + shiftX;
				if (targetX < 0 || targetX >= WIDTH) continue;
				if (compositionMask[targetY * WIDTH + targetX] === 1) touching++;
			}
		}
	}
	if (touching > 0) {
		problems.push(`the team pins overlap the composition by ${touching}px`);
	}

	// How far the pins end up from the composition, in CSS pixels: the gap
	// between the clump's left edge and the composition's right edge.
	const gap = Math.round(
		(pinExtent.x0 + shiftX - compositionExtent.x1) * scale,
	);
	const line =
		`${`${width}x${height}`.padEnd(10)} frame ${layout.frame.top.toFixed(0)}/${layout.frame.right.toFixed(0)}/${layout.frame.bottom.toFixed(0)}/${layout.frame.left.toFixed(0)}px` +
		`  cork ${layout.cork.width.toFixed(0)}x${layout.cork.height.toFixed(0)}` +
		`  composition ${layout.stage.width.toFixed(0)}px wide (${layout.bound})` +
		`  pins moved ${layout.anchorShift.x.toFixed(0)}px right, ${(-layout.anchorShift.y).toFixed(0)}px up` +
		`${gap > 0 ? `, ${gap}px clear of the composition` : ", beside the composition as drawn"}`;
	return { problems, line };
}

report.push("");
report.push(
	`frame slices (art px): top ${BOARD_FRAME.slice.top}, right ${BOARD_FRAME.slice.right}, bottom ${BOARD_FRAME.slice.bottom}, left ${BOARD_FRAME.slice.left}` +
		`; the composition's cork is ${percent(STAGE_CORK.width)} x ${percent(STAGE_CORK.height)} of its scene box`,
);
for (const [width, height, name] of VIEWPORTS) {
	const result = checkViewport(width, height);
	report.push(`${result.line}  [${name}]`);
	for (const problem of result.problems) {
		failures.push(`at ${width}x${height} (${name}): ${problem}`);
	}
}

// --- Every plausible window, coarsely ---
{
	let checked = 0;
	const bad: string[] = [];
	for (let width = MIN_WIDTH; width <= 5120; width += 32) {
		for (let height = 480; height <= 2160; height += 24) {
			checked++;
			const result = checkViewport(width, height);
			if (result.problems.length > 0 && bad.length < 5) {
				bad.push(`at ${width}x${height}: ${result.problems.join("; ")}`);
			}
		}
	}
	report.push(
		`sweep: ${checked} window sizes from ${MIN_WIDTH}x480 to 5120x2160, ${bad.length === 0 ? "none with a problem" : "problems found"}`,
	);
	failures.push(...bad);
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
