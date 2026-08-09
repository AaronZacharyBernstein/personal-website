export const SCENE_ASPECT_RATIO = 2; // width / height

/** Max rendered width of the scene box. Tune here, nowhere else. */
export const SCENE_MAX_WIDTH = "72rem";

export type HotspotId =
	| "resume"
	| "links"
	| "github"
	| "projects"
	| "timeline"
	| "education";

export type SectionRoute =
	| "/resume"
	| "/links"
	| "/github"
	| "/projects"
	| "/timeline"
	| "/education";

interface SceneLayerBase {
	id: string;
	/**
	 * Path under /images, always the generated `.webp`. The editable source
	 * is the matching `.png` under assets/images-src; run
	 * `npm run optimize-images` after touching one.
	 */
	image: string;
	/** Normalized 0..1 bounding box. */
	box: { x: number; y: number; width: number; height: number };
	zIndex: number;
	/** Debug stroke and load-failure fallback fill. */
	placeholderColor: string;
}

export interface DecorativeLayer extends SceneLayerBase {
	kind: "decorative";
}

export interface HotspotLayer extends SceneLayerBase {
	kind: "hotspot";
	id: HotspotId;
	label: string;
	route: SectionRoute;
	/**
	 * Normalized 0..1 points defining the clickable shape. Machine-generated:
	 * re-run `npx tsx scripts/trace-hotspot-polygons.ts` and paste the block
	 * verbatim whenever a box moves. Because these blocks are replaced
	 * wholesale, biome.json turns `noApproximativeNumericConstant` off for
	 * this file — a vertex landing on 0.7071 is a coincidence, not
	 * `Math.SQRT1_2`, and an inline biome-ignore would not survive the paste.
	 */
	polygon: Array<[number, number]>;
}

export type SceneLayer = DecorativeLayer | HotspotLayer;

/**
 * The whole scene, one ordered list. Paint order is zIndex, never array
 * order. Hotspot array order defines nav and tab order (reader scan order:
 * top row left to right, then bottom row), so reordering z never reorders
 * the nav.
 */
export const SCENE_LAYERS: ReadonlyArray<SceneLayer> = [
	{
		/**
		 * Aspect-locked like every other layer (2*width/height == the 3:1 of
		 * desk.png), so the box is fixed by two choices: content spans scene
		 * x 0.03..0.97 (cream field on both sides, nothing bleeding off), and
		 * the slab bottom lands at y 0.925 (a 7.5% cream strip below it).
		 * Everything else follows from desk.png's own alpha: content occupies
		 * image fx 0.0368..0.9885 and fy 0.2901..0.7169, with the front-edge
		 * outline at fy 0.6492. That puts the surface line at 0.6440, the
		 * front edge at 0.8805 and the visible slab at 28.1% of scene height
		 * — the reference is 17.9%, and the whole excess is tabletop depth
		 * baked into the asset (content aspect 6.69 against the reference's
		 * 10.92). Fixing it needs a re-crop, not a different box.
		 */
		kind: "decorative",
		id: "desk",
		image: "/images/desk.webp",
		box: { x: -0.0064, y: 0.453, width: 0.9878, height: 0.6585 },
		zIndex: 10,
		placeholderColor: "#64748b",
	},
	{
		kind: "decorative",
		id: "aaron",
		image: "/images/aaron.webp",
		box: { x: 0.4092, y: 0.1148, width: 0.1817, height: 0.5451 },
		zIndex: 5,
		placeholderColor: "#ec4899",
	},
	{
		kind: "hotspot",
		id: "timeline",
		label: "Timeline",
		route: "/timeline",
		image: "/images/chalkboard.webp",
		box: { x: -0.0472, y: 0.0671, width: 0.5297, height: 0.4903 },
		zIndex: 15,
		placeholderColor: "#8b5cf6",
		polygon: [
			[0.0394, 0.1145],
			[0.389, 0.1151],
			[0.389, 0.4571],
			[0.3896, 0.4594],
			[0.3893, 0.4732],
			[0.0397, 0.4738],
			[0.0391, 0.4565],
		],
	},
	{
		// Immediately after timeline: the two boards are adjacent on the wall,
		// and array order is the nav/tab/roving order.
		kind: "hotspot",
		id: "education",
		label: "Education",
		route: "/education",
		image: "/images/whiteboard.webp",
		box: { x: 0.6088, y: 0.0894, width: 0.3642, height: 0.4099 },
		zIndex: 4,
		placeholderColor: "#14b8a6",
		polygon: [
			[0.9435, 0.1144],
			[0.9557, 0.1162],
			[0.9594, 0.1219],
			[0.9607, 0.1301],
			[0.9609, 0.4263],
			[0.9603, 0.4451],
			[0.9579, 0.452],
			[0.9337, 0.4538],
			[0.9319, 0.4729],
			[0.6584, 0.4738],
			[0.6505, 0.4716],
			[0.6492, 0.4529],
			[0.6298, 0.4533],
			[0.6231, 0.4455],
			[0.6215, 0.1314],
			[0.6252, 0.1179],
		],
	},
	{
		kind: "hotspot",
		id: "projects",
		label: "Projects",
		route: "/projects",
		image: "/images/computer.webp",
		box: { x: 0.3504, y: 0.4765, width: 0.2925, height: 0.3608 },
		zIndex: 20,
		placeholderColor: "#3b82f6",
		polygon: [
			[0.5805, 0.506],
			[0.6012, 0.5071],
			[0.606, 0.5133],
			[0.6086, 0.5243],
			[0.5939, 0.7353],
			[0.5921, 0.7485],
			[0.5842, 0.7694],
			[0.4369, 0.8056],
			[0.3825, 0.7419],
			[0.3816, 0.7192],
			[0.3847, 0.7118],
			[0.4272, 0.7001],
			[0.4324, 0.5481],
			[0.4386, 0.5261],
			[0.467, 0.5177],
		],
	},
	{
		kind: "hotspot",
		id: "links",
		label: "Links",
		route: "/links",
		image: "/images/phone.webp",
		box: { x: 0.6876, y: 0.7331, width: 0.0546, height: 0.126 },
		zIndex: 35,
		placeholderColor: "#10b981",
		polygon: [
			[0.7118, 0.7386],
			[0.7166, 0.7401],
			[0.7202, 0.7459],
			[0.7407, 0.8169],
			[0.7403, 0.8252],
			[0.7382, 0.8294],
			[0.7194, 0.8488],
			[0.7133, 0.8534],
			[0.7098, 0.8519],
			[0.7071, 0.8461],
			[0.6989, 0.8067],
			[0.6911, 0.776],
			[0.6891, 0.7624],
			[0.6898, 0.7533],
			[0.6913, 0.7492],
		],
	},
	{
		kind: "hotspot",
		id: "resume",
		label: "Resume",
		route: "/resume",
		image: "/images/paper.webp",
		box: { x: 0.1844, y: 0.6848, width: 0.1529, height: 0.1645 },
		zIndex: 30,
		placeholderColor: "#f59e0b",
		polygon: [
			[0.2283, 0.6997],
			[0.2357, 0.7053],
			[0.2459, 0.7001],
			[0.2843, 0.7271],
			[0.327, 0.7387],
			[0.3243, 0.745],
			[0.3317, 0.7505],
			[0.3273, 0.7591],
			[0.3272, 0.7875],
			[0.3311, 0.787],
			[0.2727, 0.8295],
			[0.1928, 0.7745],
			[0.19, 0.7693],
			[0.1921, 0.7398],
			[0.1886, 0.7351],
			[0.2161, 0.719],
		],
	},
	{
		kind: "hotspot",
		id: "github",
		label: "GitHub",
		route: "/github",
		image: "/images/github.webp",
		box: { x: 0.8136, y: 0.6501, width: 0.1126, height: 0.2251 },
		zIndex: 25,
		placeholderColor: "#ef4444",
		polygon: [
			[0.8469, 0.6757],
			[0.8963, 0.6786],
			[0.9006, 0.7477],
			[0.9167, 0.7514],
			[0.8821, 0.7766],
			[0.8946, 0.8365],
			[0.8429, 0.8313],
			[0.8567, 0.8021],
			[0.8379, 0.773],
			[0.8605, 0.7762],
			[0.8422, 0.7539],
			[0.8242, 0.762],
			[0.8411, 0.7495],
			[0.8233, 0.7529],
			[0.8408, 0.7482],
		],
	},
];

/** Hotspots in nav/tab order, derived from the single layer list. */
export const SCENE_HOTSPOTS: ReadonlyArray<HotspotLayer> = SCENE_LAYERS.filter(
	(layer): layer is HotspotLayer => layer.kind === "hotspot",
);

/** Label for a section route, so route files never hardcode one. */
export function sectionLabel(route: string): string {
	return (
		SCENE_HOTSPOTS.find((hotspot) => hotspot.route === route)?.label ?? route
	);
}

/** Nav entry back to the scene itself; the scene is the homepage. */
export const SCENE_HOME = { label: "Home", route: "/" } as const;

/**
 * The flat below-md scene. Still unpainted: no source exists in
 * assets/images-src/ yet, so `npm run optimize-images` skips it and this
 * URL 404s. Because the background is applied only inside the mobile media
 * query, the miss costs a desktop visitor nothing and paints nothing on
 * mobile — the scene box simply reserves its 2:1 space until the art lands.
 */
export const SCENE_MOBILE_IMAGE = "/images/scene-flat-mobile.webp";
