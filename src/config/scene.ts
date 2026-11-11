// Relative, not "#/": the image scripts load this file through tsx.
import { SAY_HI_URL } from "../content/contact";

/**
 * Pixel size of board.png after the pipeline's trim. The scene IS the board,
 * so this pair is the scene's aspect ratio; `npm run optimize-images` fails
 * if the real file ever disagrees with it.
 */
export const SCENE_BOARD_PIXELS = { width: 1319, height: 889 } as const;

export const SCENE_ASPECT_RATIO =
	SCENE_BOARD_PIXELS.width / SCENE_BOARD_PIXELS.height; // width / height

/**
 * Matches Tailwind's `md` breakpoint — the cutover between the interactive
 * desktop scene and the decorative mobile one. JS mirror of the media
 * queries in styles.css; if the breakpoint ever moves, change both together
 * or hover/inert logic and the visible variant will disagree about which
 * side of the line a viewport is on.
 */
export const DESKTOP_MEDIA_QUERY = "(min-width: 768px)";

/** Max rendered width of the scene box. Tune here, nowhere else. */
export const SCENE_MAX_WIDTH = "72rem";

/**
 * SCENE_MAX_WIDTH in pixels at the default root font size. Lengths that
 * must scale with the board (shadows) are authored in pixels at this width
 * and converted to container units, so they read as "what it looks like at
 * full size".
 */
export const SCENE_REFERENCE_WIDTH = 1152;

/**
 * Vertical room the desktop board leaves free when it shrinks to fit the
 * viewport height: the page's py-6 gutters plus a little air, so the whole
 * board is visible without scrolling.
 */
export const SCENE_FIT_MARGIN = "4rem";

/**
 * The usable cork: the area inside the frame's inner outline, normalized,
 * with a small inset for the outline's hand-drawn wobble. Every item must
 * sit inside it; `npm run check-scene` enforces that and `?debug=1` draws it.
 */
export const SCENE_CORK = {
	x0: 0.066,
	y0: 0.106,
	x1: 0.926,
	y1: 0.898,
} as const;

export type HotspotId =
	| "resume"
	| "projects"
	| "career"
	| "education"
	| "github"
	| "links"
	| "say-hi";

export type SectionRoute =
	| "/resume"
	| "/projects"
	| "/timeline"
	| "/education"
	| "/github"
	| "/links";

export type TackColor = "red" | "yellow" | "green" | "blue";
export type TackVariant = 1 | 2 | 3;

/**
 * The thumbtack holding an item to the board. Fixed here, never chosen at
 * runtime: a random pick on the server and another on the client is a
 * hydration mismatch.
 */
export interface TackSpec {
	color: TackColor;
	/** 1 is head-on; 2 and 3 are tilted right and left. Never rotated in CSS. */
	variant: TackVariant;
	/**
	 * Where the tack sits, as a point inside the item's own box (0..1 on each
	 * axis, before rotation). It is also the item's pivot: `rotation` and the
	 * hover swing both turn about this point, the way a pinned sheet does.
	 */
	at: [number, number];
}

interface SceneLayerBase {
	id: string;
	/**
	 * Path under /images, always the generated `.webp`. The editable source
	 * is the matching `.png` under assets/images-src; run
	 * `npm run optimize-images` after touching one.
	 */
	image: string;
	/**
	 * Normalized 0..1 bounding box of the art before rotation. Its aspect
	 * must match the trimmed art; `npm run optimize-images -- --lock`
	 * rewrites `height` from `width` to keep it so.
	 */
	box: { x: number; y: number; width: number; height: number };
	zIndex: number;
	/** Debug stroke and calibration outline. */
	placeholderColor: string;
	/**
	 * Degrees clockwise, applied in CSS about the tack point (the box centre
	 * for an item with no tack). The hit polygon gets the same transform
	 * through scene-geometry's projectToScene, so the two cannot drift.
	 */
	rotation?: number;
	tack?: TackSpec;
}

export interface DecorativeLayer extends SceneLayerBase {
	kind: "decorative";
}

interface HotspotLayerBase extends SceneLayerBase {
	kind: "hotspot";
	id: HotspotId;
	label: string;
	tack: TackSpec;
	/**
	 * The clickable shape, as points inside the item's own box (0..1 on each
	 * axis, before rotation) — a function of the art alone, so it follows the
	 * item when its box moves, resizes or rotates. Machine-generated: run
	 * `npm run trace-polygons -- --write` after changing a hotspot's art.
	 * Because these blocks are replaced wholesale, biome.json turns
	 * `noApproximativeNumericConstant` off for this file — a vertex landing
	 * on 0.7071 is a coincidence, not `Math.SQRT1_2`.
	 */
	polygon: Array<[number, number]>;
}

/** Opens a section route in the panel. */
export interface SectionHotspotLayer extends HotspotLayerBase {
	route: SectionRoute;
	href?: undefined;
}

/** Opens an external URL in a new tab; it has no route and no panel. */
export interface ExternalHotspotLayer extends HotspotLayerBase {
	href: string;
	route?: undefined;
}

export type HotspotLayer = SectionHotspotLayer | ExternalHotspotLayer;

export type SceneLayer = DecorativeLayer | HotspotLayer;

/** The board itself: fills the scene, casts no shadow, fades in first. */
export const SCENE_BOARD_ID = "board";
/** Drops last in the intro, and nothing may overlap it. */
export const SCENE_NAME_CARD_ID = "name-card";

/**
 * Rendered tack height as a fraction of the scene's WIDTH (the same unit as
 * a box width, so a tack keeps its size against the items around it).
 */
export const SCENE_TACK_HEIGHT = 0.019;

/** width / height of each trimmed tack variant; optimize-images checks it. */
export const SCENE_TACK_ASPECT: Record<TackVariant, number> = {
	1: 0.982,
	2: 0.776,
	3: 0.808,
};

/** How far a hovered item swings about its tack, in degrees. */
export const SCENE_HOVER_SWING = 2;

export interface SceneShadow {
	/** Pixels at SCENE_REFERENCE_WIDTH. Positive x is right, positive y down. */
	x: number;
	y: number;
	blur: number;
	opacity: number;
}

/**
 * One light for the whole board, from the top left: every shadow falls down
 * and to the right. `rest` is what every item and tack wears, `hover` is the
 * slightly lifted item, and `falling` is where an item's shadow starts in
 * the intro before it tightens to `rest`.
 */
export const SCENE_SHADOWS = {
	rest: { x: 2, y: 3, blur: 4, opacity: 0.4 },
	hover: { x: 4, y: 7, blur: 10, opacity: 0.34 },
	falling: { x: 12, y: 20, blur: 26, opacity: 0.2 },
} as const satisfies Record<string, SceneShadow>;

/**
 * The whole scene, one ordered list. Paint order is zIndex, never array
 * order. Hotspot array order defines nav and tab order (reader scan order:
 * top row left to right, then bottom row), so reordering z never reorders
 * the nav. Tack layers are not listed: each is derived from its item's
 * `tack` (see scene-geometry), so a tack always travels with its item.
 */
export const SCENE_LAYERS: ReadonlyArray<SceneLayer> = [
	{
		kind: "decorative",
		id: "board",
		image: "/images/board.webp",
		box: { x: 0, y: 0, width: 1, height: 1 },
		zIndex: 0,
		placeholderColor: "#64748b",
	},
	{
		kind: "decorative",
		id: "name-card",
		image: "/images/name-card.webp",
		box: { x: 0.355, y: 0.118, width: 0.29, height: 0.1519 },
		zIndex: 90,
		placeholderColor: "#ec4899",
		tack: { color: "red", variant: 1, at: [0.945, 0.2] },
	},
	{
		kind: "hotspot",
		id: "resume",
		label: "Resume",
		route: "/resume",
		image: "/images/resume.webp",
		box: { x: 0.085, y: 0.135, width: 0.215, height: 0.4198 },
		zIndex: 10,
		placeholderColor: "#f59e0b",
		rotation: -2,
		tack: { color: "blue", variant: 2, at: [0.5, 0.045] },
		polygon: [
			[0.929, 0.0018],
			[0.9487, 0.0061],
			[0.9572, 0.0225],
			[0.9534, 0.2891],
			[0.96, 0.4886],
			[0.976, 0.6401],
			[0.9873, 0.8703],
			[0.9976, 0.9496],
			[0.992, 0.9646],
			[0.9751, 0.9703],
			[0.9139, 0.9753],
			[0.5339, 0.9918],
			[0.0127, 0.9954],
			[0.0042, 0.9875],
			[0.0033, 0.9746],
			[0.0174, 0.7938],
			[0.0193, 0.5407],
			[0.0268, 0.3785],
			[0.0259, 0.2327],
			[0.0127, 0.0733],
			[0.0165, 0.0533],
			[0.0315, 0.0461],
			[0.1218, 0.0404],
			[0.421, 0.0332],
		],
	},
	{
		kind: "hotspot",
		id: "projects",
		label: "Projects",
		route: "/projects",
		image: "/images/projects.webp",
		box: { x: 0.375, y: 0.31, width: 0.225, height: 0.2247 },
		zIndex: 20,
		placeholderColor: "#3b82f6",
		rotation: 1.5,
		tack: { color: "green", variant: 3, at: [0.52, 0.2] },
		polygon: [
			[0.291, 0.0036],
			[0.33, 0.0119],
			[0.3592, 0.0894],
			[0.3703, 0.0987],
			[0.9072, 0.047],
			[0.9496, 0.0594],
			[0.96, 0.0852],
			[0.9635, 0.1286],
			[0.9955, 0.7784],
			[0.9983, 0.8931],
			[0.9906, 0.9292],
			[0.9774, 0.9427],
			[0.951, 0.9468],
			[0.5511, 0.9737],
			[0.0949, 0.9964],
			[0.0372, 0.9964],
			[0.0212, 0.985],
			[0.0115, 0.9199],
			[0.0024, 0.2846],
			[0.0017, 0.1989],
			[0.0094, 0.1513],
			[0.0414, 0.1142],
			[0.0567, 0.0439],
			[0.0741, 0.0232],
		],
	},
	{
		kind: "hotspot",
		id: "career",
		label: "Career",
		route: "/timeline",
		image: "/images/career.webp",
		box: { x: 0.625, y: 0.305, width: 0.152, height: 0.297 },
		zIndex: 30,
		placeholderColor: "#8b5cf6",
		rotation: 2,
		tack: { color: "yellow", variant: 1, at: [0.5, 0.035] },
		polygon: [
			[0.4707, 0.0021],
			[0.8439, 0.0347],
			[0.934, 0.0758],
			[0.9848, 0.1408],
			[0.9927, 0.2393],
			[0.9521, 0.3035],
			[0.6263, 0.4756],
			[0.5474, 0.5741],
			[0.9059, 0.5766],
			[0.9667, 0.604],
			[0.9837, 0.9302],
			[0.9386, 0.9799],
			[0.0964, 0.9979],
			[0.013, 0.9628],
			[0.0254, 0.6134],
			[0.1392, 0.5878],
			[0.4504, 0.5852],
			[0.4549, 0.5612],
			[0.3794, 0.4756],
			[0.0547, 0.3018],
			[0.0085, 0.2359],
			[0.0118, 0.1528],
			[0.0637, 0.092],
			[0.164, 0.0449],
		],
	},
	{
		kind: "hotspot",
		id: "education",
		label: "Education",
		route: "/education",
		image: "/images/education.webp",
		box: { x: 0.095, y: 0.64, width: 0.19, height: 0.2257 },
		zIndex: 40,
		placeholderColor: "#14b8a6",
		rotation: -3,
		tack: { color: "red", variant: 3, at: [0.455, 0.035] },
		polygon: [
			[0.462, 0.0022],
			[0.5093, 0.0264],
			[0.5251, 0.0828],
			[0.4835, 0.2816],
			[0.8806, 0.4615],
			[0.6656, 0.6164],
			[0.7466, 0.6003],
			[0.976, 0.6808],
			[0.9975, 0.7355],
			[0.9595, 0.8841],
			[0.9215, 0.9002],
			[0.6907, 0.8196],
			[0.6606, 0.654],
			[0.6384, 0.6737],
			[0.695, 0.9575],
			[0.6534, 0.9879],
			[0.5394, 0.9673],
			[0.5473, 0.8653],
			[0.3588, 0.8966],
			[0.1681, 0.8098],
			[0.1918, 0.5985],
			[0.0032, 0.4884],
			[0.4348, 0.2833],
			[0.4018, 0.0998],
		],
	},
	{
		kind: "hotspot",
		id: "github",
		label: "GitHub",
		route: "/github",
		image: "/images/github.webp",
		box: { x: 0.335, y: 0.63, width: 0.11, height: 0.166 },
		zIndex: 50,
		placeholderColor: "#ef4444",
		rotation: 4,
		tack: { color: "yellow", variant: 2, at: [0.5, 0.08] },
		polygon: [
			[0.491, 0.0039],
			[0.6175, 0.0194],
			[0.6876, 0.0439],
			[0.8333, 0.1372],
			[0.909, 0.2239],
			[0.9542, 0.305],
			[0.9847, 0.3972],
			[0.996, 0.4994],
			[0.9633, 0.6717],
			[0.8842, 0.8094],
			[0.8299, 0.8661],
			[0.7316, 0.9328],
			[0.535, 0.9961],
			[0.4175, 0.9894],
			[0.3034, 0.955],
			[0.1475, 0.8483],
			[0.0537, 0.715],
			[0.013, 0.6106],
			[0.0028, 0.5183],
			[0.013, 0.4117],
			[0.0401, 0.3206],
			[0.1542, 0.1517],
			[0.3079, 0.0472],
			[0.3836, 0.0194],
		],
	},
	{
		kind: "hotspot",
		id: "links",
		label: "Links",
		route: "/links",
		image: "/images/links.webp",
		box: { x: 0.505, y: 0.715, width: 0.135, height: 0.1363 },
		zIndex: 60,
		placeholderColor: "#10b981",
		tack: { color: "green", variant: 1, at: [0.5, 0.11] },
		polygon: [
			[0.8921, 0.0036],
			[0.9265, 0.016],
			[0.9434, 0.0687],
			[0.9539, 0.2949],
			[0.9673, 0.3962],
			[0.9722, 0.5418],
			[0.9982, 0.8342],
			[0.9947, 0.8631],
			[0.9842, 0.8848],
			[0.956, 0.8993],
			[0.8238, 0.922],
			[0.5018, 0.9499],
			[0.1607, 0.9923],
			[0.077, 0.9974],
			[0.0538, 0.9809],
			[0.0454, 0.953],
			[0.0313, 0.7825],
			[0.0032, 0.2412],
			[0.0025, 0.1844],
			[0.0144, 0.1513],
			[0.0489, 0.1338],
			[0.2233, 0.0997],
			[0.3168, 0.0945],
		],
	},
	{
		kind: "hotspot",
		id: "say-hi",
		label: "Say hi",
		href: SAY_HI_URL,
		image: "/images/say-hi.webp",
		box: { x: 0.755, y: 0.628, width: 0.155, height: 0.2203 },
		zIndex: 70,
		placeholderColor: "#0ea5e9",
		rotation: -3,
		tack: { color: "blue", variant: 3, at: [0.5, 0.1] },
		polygon: [
			[0.5005, 0.0025],
			[0.529, 0.0075],
			[0.5824, 0.0403],
			[0.8062, 0.2033],
			[0.8986, 0.2828],
			[0.9729, 0.3623],
			[0.9824, 0.4289],
			[0.9929, 0.6963],
			[0.9929, 0.922],
			[0.971, 0.9478],
			[0.8776, 0.9627],
			[0.5614, 0.9697],
			[0.0995, 0.9965],
			[0.0605, 0.9935],
			[0.03, 0.9687],
			[0.0205, 0.9269],
			[0.0214, 0.6854],
			[0.0024, 0.4717],
			[0.0043, 0.419],
			[0.0129, 0.3931],
			[0.0329, 0.3673],
			[0.15, 0.2599],
			[0.3462, 0.0999],
			[0.4614, 0.0144],
		],
	},
	{
		kind: "decorative",
		id: "pin-49ers",
		image: "/images/pin-49ers.webp",
		box: { x: 0.752, y: 0.112, width: 0.074, height: 0.1114 },
		zIndex: 80,
		placeholderColor: "#b91c1c",
		rotation: -8,
	},
	{
		kind: "decorative",
		id: "pin-giants",
		image: "/images/pin-giants.webp",
		box: { x: 0.826, y: 0.116, width: 0.094, height: 0.1131 },
		zIndex: 81,
		placeholderColor: "#ea580c",
		rotation: 6,
	},
	{
		kind: "decorative",
		id: "pin-kings",
		image: "/images/pin-kings.webp",
		box: { x: 0.792, y: 0.196, width: 0.074, height: 0.1121 },
		zIndex: 83,
		placeholderColor: "#7c3aed",
		rotation: 10,
	},
	{
		kind: "decorative",
		id: "pin-sharks",
		image: "/images/pin-sharks.webp",
		box: { x: 0.852, y: 0.214, width: 0.07, height: 0.1071 },
		zIndex: 82,
		placeholderColor: "#0d9488",
		rotation: -12,
	},
	{
		kind: "decorative",
		id: "pin-manutd",
		image: "/images/pin-manutd.webp",
		box: { x: 0.754, y: 0.268, width: 0.072, height: 0.1092 },
		zIndex: 84,
		placeholderColor: "#dc2626",
		rotation: -5,
	},
	{
		kind: "decorative",
		id: "pin-pennstate",
		image: "/images/pin-pennstate.webp",
		box: { x: 0.82, y: 0.288, width: 0.072, height: 0.1092 },
		zIndex: 85,
		placeholderColor: "#1e3a8a",
		rotation: 14,
	},
];

/** Hotspots in nav/tab order, derived from the single layer list. */
export const SCENE_HOTSPOTS: ReadonlyArray<HotspotLayer> = SCENE_LAYERS.filter(
	(layer): layer is HotspotLayer => layer.kind === "hotspot",
);

/** The hotspots that open a section panel (everything but external links). */
export const SCENE_SECTION_HOTSPOTS: ReadonlyArray<SectionHotspotLayer> =
	SCENE_HOTSPOTS.filter(
		(hotspot): hotspot is SectionHotspotLayer => hotspot.route !== undefined,
	);

/** Label for a section route, so route files never hardcode one. */
export function sectionLabel(route: string): string {
	return (
		SCENE_SECTION_HOTSPOTS.find((hotspot) => hotspot.route === route)?.label ??
		route
	);
}

/** Nav entry back to the scene itself; the scene is the homepage. */
export const SCENE_HOME = { label: "Home", route: "/" } as const;

/**
 * The flat below-md scene: every layer and tack composited onto the board
 * by `npm run optimize-images`. Applied only inside the mobile media query,
 * so a desktop visitor never requests it.
 */
export const SCENE_MOBILE_IMAGE = "/images/scene-flat-mobile.webp";
