export const SCENE_ASPECT_RATIO = 2; // width / height

/** Max rendered width of the scene box. Tune here, nowhere else. */
export const SCENE_MAX_WIDTH = "72rem";

export type HotspotId = "resume" | "links" | "github" | "projects" | "timeline";

export type SectionRoute =
	| "/resume"
	| "/links"
	| "/github"
	| "/projects"
	| "/timeline";

interface SceneLayerBase {
	id: string;
	/** Path under /images. May point at art that does not exist yet. */
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
	/** Normalized 0..1 points defining the clickable shape. */
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
		kind: "decorative",
		id: "desk",
		image: "/images/desk.png",
		box: { x: 0, y: 0, width: 1, height: 1 },
		zIndex: 0,
		placeholderColor: "#64748b",
	},
	{
		kind: "decorative",
		id: "aaron",
		image: "/images/aaron.png",
		box: { x: 0.4, y: 0.3, width: 0.2, height: 0.4 },
		zIndex: 5,
		placeholderColor: "#ec4899",
	},
	{
		kind: "hotspot",
		id: "timeline",
		label: "Timeline",
		route: "/timeline",
		image: "/images/chalkboard.png",
		box: { x: 0.05, y: 0.08, width: 0.3, height: 0.42 },
		zIndex: 10,
		placeholderColor: "#8b5cf6",
		polygon: [
			[0.05, 0.08],
			[0.35, 0.08],
			[0.35, 0.5],
			[0.05, 0.5],
		],
	},
	{
		kind: "hotspot",
		id: "projects",
		label: "Projects",
		route: "/projects",
		image: "/images/computer.png",
		box: { x: 0.52, y: 0.18, width: 0.26, height: 0.42 },
		zIndex: 20,
		placeholderColor: "#3b82f6",
		polygon: [
			[0.52, 0.18],
			[0.78, 0.18],
			[0.78, 0.5],
			[0.69, 0.6],
			[0.61, 0.6],
			[0.52, 0.5],
		],
	},
	{
		kind: "hotspot",
		id: "links",
		label: "Links",
		route: "/links",
		image: "/images/phone.png",
		box: { x: 0.09, y: 0.62, width: 0.11, height: 0.24 },
		zIndex: 30,
		placeholderColor: "#10b981",
		polygon: [
			[0.11, 0.62],
			[0.2, 0.64],
			[0.18, 0.86],
			[0.09, 0.84],
		],
	},
	{
		kind: "hotspot",
		id: "resume",
		label: "Resume",
		route: "/resume",
		image: "/images/paper.png",
		box: { x: 0.36, y: 0.66, width: 0.16, height: 0.24 },
		zIndex: 40,
		placeholderColor: "#f59e0b",
		polygon: [
			[0.37, 0.66],
			[0.52, 0.68],
			[0.5, 0.9],
			[0.36, 0.88],
		],
	},
	{
		kind: "hotspot",
		id: "github",
		label: "GitHub",
		route: "/github",
		image: "/images/github.png",
		box: { x: 0.8, y: 0.58, width: 0.12, height: 0.3 },
		zIndex: 50,
		placeholderColor: "#ef4444",
		polygon: [
			[0.82, 0.58],
			[0.9, 0.58],
			[0.92, 0.74],
			[0.86, 0.88],
			[0.8, 0.74],
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

export const SCENE_MOBILE_IMAGE = "/images/scene-flat-mobile.png";
