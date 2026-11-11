/**
 * The desktop board's layout, in one place and in two forms that must
 * agree: `boardVariables()` hands the numbers to the stylesheet, which does
 * the real layout in CSS, and `boardLayout()` does the same arithmetic in
 * JavaScript for `npm run check-scene`, which has no browser.
 *
 * At md and up the board is the viewport. The wood frame runs round the
 * edge of the screen as a 9-slice of the board art; cork is tiled inside
 * it. On that cork sit two things:
 *
 *   the composition — everything but the team pins. It keeps the layout it
 *   was drawn with, inside its own invisible "scene box" (the stage), which
 *   is sized by the fit-to-height rule and centred on the cork;
 *
 *   the team pins — anchored to the cork's top-right corner instead, the
 *   same distance from the frame they were drawn at.
 *
 * Frame thickness is what the art's frame measured when the board was a
 * 1152px image in a 1440x900 window, scaled by height/900 or by
 * width/1440, whichever is SMALLER. On a window as wide as the reference
 * or wider that is the height, so the wood is as thick on an ultrawide as
 * on a laptop of the same height; on a narrower one it is the width, so a
 * portrait window gets a thinner frame and more cork.
 */
// Relative imports: the image scripts load this file through tsx.
import { BOARD_FRAME } from "./board-frame.gen";
import {
	SCENE_ASPECT_RATIO,
	SCENE_BOARD_ART,
	SCENE_FIT_MARGIN,
	SCENE_MAX_WIDTH,
	SCENE_REFERENCE_WIDTH,
} from "./scene";

/** The window in which the frame is exactly as thick as it was drawn. */
export const BOARD_REFERENCE_VIEWPORT = { width: 1440, height: 900 } as const;

/** CSS pixels per pixel of board art, in the reference window. */
const REFERENCE_UNIT = SCENE_REFERENCE_WIDTH / BOARD_FRAME.width;

/**
 * CSS pixels per pixel of board art, per pixel of viewport height and per
 * pixel of viewport width. The board's unit is the smaller of the two
 * products, and that one number scales the frame, the cork tile and the
 * inner shadow together, so the cork's grain always matches the frame it
 * sits in. The two agree at the reference window's shape (16:10); height
 * decides on anything wider, width on anything narrower.
 */
export const BOARD_SCALE = {
	height: REFERENCE_UNIT / BOARD_REFERENCE_VIEWPORT.height,
	width: REFERENCE_UNIT / BOARD_REFERENCE_VIEWPORT.width,
} as const;

/**
 * The composition's own cork: the part of its scene box that the art's
 * frame leaves open, as fractions of the box. Centring this on the real
 * cork is what "centred" means, and its top-right corner is what the pins
 * were drawn against.
 */
export const STAGE_CORK = (() => {
	const { width, height, slice } = BOARD_FRAME;
	const x0 = slice.left / width;
	const x1 = 1 - slice.right / width;
	const y0 = slice.top / height;
	const y1 = 1 - slice.bottom / height;
	return {
		x0,
		x1,
		y0,
		y1,
		width: x1 - x0,
		height: y1 - y0,
		centerX: (x0 + x1) / 2,
		centerY: (y0 + y1) / 2,
	};
})();

const round = (value: number) => Number(value.toFixed(6));
/** The per-viewport-pixel scales are tiny; keep enough digits to matter at 5120px. */
const scale = (value: number) => Number(value.toFixed(9));

/**
 * Custom properties for the stylesheet's board rules, set once on the
 * scene layout's root. The image URLs are inert tokens here; only the rules
 * inside the md media query substitute them, so a phone fetches none.
 */
export function boardVariables(): Record<string, string | number> {
	const { slice, tile, shadow } = BOARD_FRAME;
	const art = (pixels: number) => `calc(var(--board-unit) * ${pixels})`;
	return {
		"--board-unit": `min(calc(100dvh * ${scale(BOARD_SCALE.height)}), calc(100dvw * ${scale(BOARD_SCALE.width)}))`,
		"--frame-top": art(slice.top),
		"--frame-right": art(slice.right),
		"--frame-bottom": art(slice.bottom),
		"--frame-left": art(slice.left),
		"--frame-slice": `${slice.top} ${slice.right} ${slice.bottom} ${slice.left}`,
		"--frame-image": `url('${SCENE_BOARD_ART.frame}')`,
		"--cork-image": `url('${SCENE_BOARD_ART.cork}')`,
		"--cork-tile": `${art(tile.width)} ${art(tile.height)}`,
		"--shadow-image": `url('${SCENE_BOARD_ART.shadow}')`,
		"--shadow-top": art(shadow.slice.top),
		"--shadow-left": art(shadow.slice.left),
		"--shadow-slice": `${shadow.slice.top} 0 0 ${shadow.slice.left}`,
		"--scene-max-width": SCENE_MAX_WIDTH,
		"--scene-fit-margin": SCENE_FIT_MARGIN,
		"--scene-aspect": round(SCENE_ASPECT_RATIO),
		"--stage-cork-width": round(STAGE_CORK.width),
		"--stage-cork-height": round(STAGE_CORK.height),
		"--stage-cork-center-x": round(STAGE_CORK.centerX),
		"--stage-cork-center-y": round(STAGE_CORK.centerY),
	};
}

function cssLengthToPixels(
	value: string,
	viewportHeight: number,
	rootFontSize: number,
): number {
	const match = /^\s*([\d.]+)(rem|px|dvh)\s*$/.exec(value);
	if (!match) {
		throw new Error(`"${value}" is not a rem, px or dvh length`);
	}
	const amount = Number(match[1]);
	if (match[2] === "rem") {
		return amount * rootFontSize;
	}
	if (match[2] === "dvh") {
		return (amount / 100) * viewportHeight;
	}
	return amount;
}

export interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface BoardLayout {
	/** CSS pixels per pixel of board art. */
	unit: number;
	frame: { top: number; right: number; bottom: number; left: number };
	/** The visible cork, in viewport pixels. */
	cork: Rect;
	/** The composition's scene box, in viewport pixels. */
	stage: Rect;
	/** Which limit set the stage's width. */
	bound: "max-width" | "viewport-height" | "cork-width" | "cork-height";
	/**
	 * How far an anchored layer travels from where the composition would
	 * have put it: right by x, up by y (so y is zero or negative). Zero when
	 * the composition's cork already fills the real one on that axis — the
	 * pins are then exactly where they were drawn.
	 */
	anchorShift: { x: number; y: number };
}

/**
 * The board at a given viewport. The same arithmetic as the `@media
 * (min-width: 768px)` board rules in styles.css; keep the two in step.
 */
export function boardLayout(
	viewportWidth: number,
	viewportHeight: number,
	rootFontSize = 16,
): BoardLayout {
	const { slice } = BOARD_FRAME;
	const unit = Math.min(
		viewportHeight * BOARD_SCALE.height,
		viewportWidth * BOARD_SCALE.width,
	);
	const frame = {
		top: slice.top * unit,
		right: slice.right * unit,
		bottom: slice.bottom * unit,
		left: slice.left * unit,
	};
	const cork: Rect = {
		x: frame.left,
		y: frame.top,
		width: viewportWidth - frame.left - frame.right,
		height: viewportHeight - frame.top - frame.bottom,
	};

	// The fit rule: never wider than the max, never taller than the viewport
	// allows — and its own cork never larger than the real one, which is
	// what binds on a narrow or portrait viewport.
	const limits = {
		"max-width": cssLengthToPixels(
			SCENE_MAX_WIDTH,
			viewportHeight,
			rootFontSize,
		),
		"viewport-height":
			(viewportHeight -
				cssLengthToPixels(SCENE_FIT_MARGIN, viewportHeight, rootFontSize)) *
			SCENE_ASPECT_RATIO,
		"cork-width": cork.width / STAGE_CORK.width,
		"cork-height": (cork.height / STAGE_CORK.height) * SCENE_ASPECT_RATIO,
	} as const;
	let bound: BoardLayout["bound"] = "max-width";
	for (const key of Object.keys(limits) as Array<BoardLayout["bound"]>) {
		if (limits[key] < limits[bound]) {
			bound = key;
		}
	}
	const width = limits[bound];
	const height = width / SCENE_ASPECT_RATIO;

	return {
		unit,
		frame,
		cork,
		stage: {
			x: cork.x + cork.width / 2 - width * STAGE_CORK.centerX,
			y: cork.y + cork.height / 2 - height * STAGE_CORK.centerY,
			width,
			height,
		},
		bound,
		anchorShift: {
			x: Math.max(0, cork.width / 2 - (width * STAGE_CORK.width) / 2),
			y: -Math.max(0, cork.height / 2 - (height * STAGE_CORK.height) / 2),
		},
	};
}
